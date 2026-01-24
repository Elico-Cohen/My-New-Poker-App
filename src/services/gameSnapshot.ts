import { db, auth } from '@/config/firebase';
import { collection, addDoc, getFirestore, updateDoc, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { Game } from '@/models/Game';
import { verifyAccessControl } from '@/utils/securityAudit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

// קבוע למפתח שמירה מקומית של משחקים
const LOCAL_GAMES_STORAGE_KEY = 'local_games_storage';
// קבוע למפתח שמירה מקומית של משחק פעיל
const ACTIVE_GAME_STORAGE_KEY = 'active_game_storage';

const gamesCollection = collection(db, 'games');

/**
 * פונקציה פרטית לשמירת משחק באחסון מקומי במקום פיירבייס
 * משמשת במקרה של כשל בהרשאות פיירבייס
 */
async function saveGameLocally(game: Omit<Game, 'id'>): Promise<string> {
  try {
    // יצירת מזהה מקומי למשחק
    const localId = `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // הוסף מזהה משחק מקומי
    const gameWithId = {
      ...game,
      id: localId,
      isLocalOnly: true // סימון שזה משחק מקומי בלבד
    };
    
    // קריאת משחקים מקומיים קיימים
    const existingGamesJSON = await AsyncStorage.getItem(LOCAL_GAMES_STORAGE_KEY);
    let existingGames = existingGamesJSON ? JSON.parse(existingGamesJSON) : [];
    
    // הוספת המשחק החדש
    existingGames.push(gameWithId);
    
    // שמירת הרשימה המעודכנת
    await AsyncStorage.setItem(LOCAL_GAMES_STORAGE_KEY, JSON.stringify(existingGames));
    
    console.log(`משחק נשמר מקומית עם מזהה: ${localId}`);
    return localId;
  } catch (error) {
    console.error('שגיאה בשמירה מקומית:', error);
    throw new Error('שגיאה בשמירה מקומית של המשחק');
  }
}

/**
 * מנקה ערכים undefined מאובייקט ומחליף אותם ב-null (Firestore תומך ב-null אבל לא ב-undefined)
 * אבל משמיר undefined עבור שדות שצריכים להישאר undefined במבנה הנתונים
 */
function cleanUndefinedValues(obj: any, preserveUndefinedFields: string[] = []): any {
  if (obj === null || obj === undefined) {
    return null;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => cleanUndefinedValues(item, preserveUndefinedFields));
  }
  
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];
        if (value === undefined) {
          // אם זה שדה שצריך לשמר undefined, לא נכלול אותו בכלל
          if (preserveUndefinedFields.includes(key)) {
            // לא מוסיפים את השדה כדי שהוא יישאר undefined
            continue;
          } else {
            cleaned[key] = null;
          }
        } else {
          cleaned[key] = cleanUndefinedValues(value, preserveUndefinedFields);
        }
      }
    }
    return cleaned;
  }
  
  return obj;
}

/**
 * saveGameSnapshot
 * שומר את snapshot המשחק במסד הנתונים.
 * הקלט הוא אובייקט Game (ללא שדה id) המכיל את כל הנתונים הרלוונטיים כפי שהם בזמן סיום המשחק.
 * הפונקציה מוסיפה את השדות createdAt, updatedAt, וגם createdBy (מזהה המשתמש) ושומרת את המסמך.
 * מחזירה את המזהה (id) של המסמך שנוצר.
 */
export async function saveGameSnapshot(game: Omit<Game, 'id'>): Promise<string> {
  const now = Date.now();
  const currentUser = auth.currentUser;

  if (!currentUser) {
    console.error('No authenticated user found when trying to save game!');
    throw new Error('המשתמש לא מחובר. יש להתחבר מחדש ולנסות שוב');
  }

  console.log('Saving game with authenticated user:', currentUser.uid);
  console.log('User email:', currentUser.email);

  // הכנת הנתונים לשמירה - תמיד השתמש ב-currentUser.uid (authUid), לא ב-Firestore user ID
  const gameData = cleanUndefinedValues({
    ...game,
    createdAt: now,
    updatedAt: now,
    createdBy: currentUser.uid, // Always use Firebase Auth UID (authUid)
  }, ['remainingChips', 'exactChipsValue', 'roundedRebuysCount', 'resultBeforeOpenGames', 'openGameWins', 'finalResultMoney', 'finalResult']);
  
  try {
    // ניסיון שמירה בפיירבייס
    const docRef = await addDoc(gamesCollection, gameData);
    console.log('Game saved successfully with ID:', docRef.id);
    
    // ניקוי משחקים מקומיים אם השמירה בפיירבייס הצליחה
    await clearAllLocalGames();
    
    return docRef.id;
  } catch (error: any) {
    console.error('Error saving game:', error);
    console.log('Game data attempted to save:', JSON.stringify(gameData));
    
    // אם אין חיבור לאינטרנט, שמור מקומית עם התראה
    console.log('No internet connection, saving game locally');
    const gameId = await saveGameLocally(gameData);
    
    Alert.alert(
      'שגיאת חיבור', 
      'לא ניתן לחבר לשרת כרגע. המשחק נשמר מקומית ויסונכרן מאוחר יותר.',
      [{ text: 'הבנתי' }]
    );
    
    return gameId;
  }
}

/**
 * saveOrUpdateActiveGame
 * שומר או מעדכן משחק פעיל ב-Firestore.
 * אם המשחק כבר קיים (יש לו מזהה), הפונקציה תעדכן את המסמך הקיים.
 * אם המשחק חדש (אין לו מזהה), הפונקציה תיצור מסמך חדש.
 * במקרה של אין חיבור לאינטרנט, המשחק יישמר מקומית.
 * הפונקציה מחזירה את מזהה המשחק.
 */
export async function saveOrUpdateActiveGame(game: Game | Omit<Game, 'id'>): Promise<string> {
  console.log('🔧 === SAVE OR UPDATE ACTIVE GAME STARTED === 🔧');
  console.log('Game has ID:', 'id' in game ? game.id : 'NO ID - NEW GAME');
  console.log('Game status:', game.status);
  
  const now = Date.now();
  const currentUser = auth.currentUser;
  
  if (!currentUser) {
    console.error('No authenticated user found when trying to save/update active game!');
    throw new Error('המשתמש לא מחובר. יש להתחבר מחדש ולנסות שוב');
  }
  
  console.log('Current user:', currentUser.uid);
  
  // בדיקת חיבור לאינטרנט
  const netInfo = await NetInfo.fetch();
  const isConnected = netInfo.isConnected;
  console.log('Internet connected:', isConnected);
  
  // הכנת הנתונים לשמירה
  const gameToSave = cleanUndefinedValues({
    ...game,
    updatedAt: now,
  }, ['remainingChips', 'exactChipsValue', 'roundedRebuysCount', 'resultBeforeOpenGames', 'openGameWins', 'finalResultMoney', 'finalResult']) as any;

  // אם זה משחק חדש, הוסף מטה-נתונים
  if (!('id' in game) || !game.id) {
    console.log('New game - adding metadata');
    gameToSave.createdAt = now;
    gameToSave.createdBy = currentUser.uid; // Always use Firebase Auth UID (authUid)
    console.log('Set createdBy to:', gameToSave.createdBy);
  } else {
    console.log('Existing game - updating game ID:', game.id);
  }
  
  try {
    // אם אין חיבור לאינטרנט, שמור מקומית
    if (!isConnected) {
      console.log('No internet connection, saving active game locally');
      await saveActiveGameLocally(gameToSave);
      return 'id' in game && game.id ? game.id : 'local_temp_id';
    }
    
    // אם יש מזהה, עדכן את המסמך הקיים
    if ('id' in game && game.id) {
      const gameId = game.id;
      console.log('🔄 Updating existing game with ID:', gameId);
      const { id, ...dataWithoutId } = gameToSave; // הסר את המזהה מהנתונים לעדכון
      
      try {
        // בדוק תחילה אם המסמך קיים
        console.log('Checking if document exists in Firestore...');
        const docRef = doc(db, 'games', gameId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          console.log('Document exists - updating...');
          // אם המסמך קיים, עדכן אותו
          const cleanDataWithoutId = cleanUndefinedValues(dataWithoutId, ['remainingChips', 'exactChipsValue', 'roundedRebuysCount', 'resultBeforeOpenGames', 'openGameWins', 'finalResultMoney', 'finalResult']);
          await updateDoc(docRef, cleanDataWithoutId);
          console.log('✅ Active game updated successfully with ID:', gameId);
          
          // שמור מקומית גם כן למקרה של ניתוק
          await saveActiveGameLocally(gameToSave);
          
          return gameId;
        } else {
          // אם המסמך לא קיים, צור חדש
          console.log(`Document with ID ${gameId} does not exist anymore. Creating new document.`);
          const cleanDataWithoutId = cleanUndefinedValues(dataWithoutId, ['remainingChips', 'exactChipsValue', 'roundedRebuysCount', 'resultBeforeOpenGames', 'openGameWins', 'finalResultMoney', 'finalResult']);
          const newDocRef = await addDoc(gamesCollection, cleanDataWithoutId);
          console.log('New active game saved successfully with ID:', newDocRef.id);
          
          // שמור מקומית עם המזהה החדש
          await saveActiveGameLocally({...dataWithoutId, id: newDocRef.id});
          
          return newDocRef.id;
        }
      } catch (error: any) {
        // במקרה של שגיאה ספציפית של "no document to update", ננסה ליצור מסמך חדש
        if (error.message && error.message.includes('No document to update')) {
          console.log('No document to update, creating new document');
          const cleanDataWithoutId = cleanUndefinedValues(dataWithoutId, ['remainingChips', 'exactChipsValue', 'roundedRebuysCount', 'resultBeforeOpenGames', 'openGameWins', 'finalResultMoney', 'finalResult']);
          const newDocRef = await addDoc(gamesCollection, cleanDataWithoutId);
          console.log('New active game saved successfully with ID:', newDocRef.id);
          
          // שמור מקומית עם המזהה החדש
          await saveActiveGameLocally({...dataWithoutId, id: newDocRef.id});
          
          return newDocRef.id;
        } else {
          // זרוק את השגיאה המקורית אם זו לא שגיאת "no document"
          console.error('Error updating game:', error);
          
          // ננסה לשמור מקומית במקרה של שגיאה
          await saveActiveGameLocally(gameToSave);
          
          throw error;
        }
      }
    } 
    // אחרת, צור מסמך חדש
    else {
      try {
        console.log('🆕 Creating new game document...');
        console.log('Game data to save:', {
          status: gameToSave.status,
          createdBy: gameToSave.createdBy,
          playersCount: gameToSave.players?.length
        });
        
        // הגנה נגד כפילויות - בדוק אם יש כבר משחק עם אותם נתונים בדקות האחרונות
        if (gameToSave.createdBy && gameToSave.players?.length > 0) {
          console.log('🔍 Checking for potential duplicate games...');
          const recentTimeThreshold = now - (5 * 60 * 1000); // 5 דקות אחרונות
          
          try {
            const duplicateQuery = query(
              gamesCollection,
              where('createdBy', '==', gameToSave.createdBy),
              where('status', '==', 'active'),
              where('createdAt', '>=', recentTimeThreshold)
            );
            
            const duplicateSnapshot = await getDocs(duplicateQuery);
            
            if (!duplicateSnapshot.empty) {
              console.log(`⚠️ Found ${duplicateSnapshot.size} recent active games by same user`);
              
              // בדוק אם יש משחק זהה (אותה קבוצה ואותה כמות שחקנים)
              for (const duplicateDoc of duplicateSnapshot.docs) {
                const duplicateData = duplicateDoc.data();
                if (duplicateData.groupId === gameToSave.groupId && 
                    duplicateData.players?.length === gameToSave.players?.length) {
                  console.log(`🚫 Found duplicate game ${duplicateDoc.id}, returning existing ID instead of creating new one`);
                  return duplicateDoc.id;
                }
              }
            }
          } catch (duplicateCheckError) {
            console.log('Non-critical error checking for duplicates:', duplicateCheckError);
            // ממשיכים ליצור משחק חדש גם אם הבדיקה נכשלת
          }
        }
        
        const docRef = await addDoc(gamesCollection, gameToSave);
        console.log('✅ New active game saved successfully with ID:', docRef.id);
        
        // נסה לשמור גם מקומית את המשחק עם המזהה החדש (למקרה של ניתוק)
        await saveActiveGameLocally({...gameToSave, id: docRef.id});
        
        console.log('🔧 === SAVE OR UPDATE ACTIVE GAME COMPLETED === 🔧');
        return docRef.id;
      } catch (error: any) {
        console.error('❌ Error creating new game document:', error);
        
        // במקרה של שגיאה, שמור מקומית
        await saveActiveGameLocally(gameToSave);
        
        throw error;
      }
    }
  } catch (error: any) {
    console.error('Error saving/updating active game:', error);
    
    // במקרה של שגיאה, שמור מקומית
    console.log('Error occurred, saving active game locally');
    await saveActiveGameLocally(gameToSave);
    
    throw error;
  }
}

/**
 * שומר משחק פעיל באחסון מקומי
 */
async function saveActiveGameLocally(game: any): Promise<void> {
  try {
    await AsyncStorage.setItem(ACTIVE_GAME_STORAGE_KEY, JSON.stringify(game));
    console.log('Active game saved locally successfully');
  } catch (error) {
    console.error('Error saving active game locally:', error);
    throw new Error('שגיאה בשמירה מקומית של המשחק הפעיל');
  }
}

/**
 * getActiveGameById
 * מביא משחק פעיל מ-Firestore לפי מזהה
 */
export async function getActiveGameById(gameId: string): Promise<Game | null> {
  try {
    console.log(`Getting active game by ID: ${gameId}`);
    
    // בדיקה שהמשתמש מחובר לפני ניסיון טעינת משחק
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.log('User not authenticated, skipping active game loading');
      return null;
    }
    
    // בדיקת חיבור לאינטרנט
    const netInfo = await NetInfo.fetch();
    const isConnected = netInfo.isConnected;
    
    // אם אין חיבור לאינטרנט, נסה לטעון מקומית
    if (!isConnected) {
      console.log('No internet connection, trying to load local active game');
      const localGame = await getLocalActiveGame();
      
      // אם יש משחק מקומי עם אותו מזהה, החזר אותו
      if (localGame && (localGame.id === gameId || gameId === 'local_temp_id')) {
        return localGame;
      }
      
      return null;
    }
    
    // טעינה מ-Firestore
    const docRef = doc(db, 'games', gameId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const gameData = { id: docSnap.id, ...docSnap.data() } as Game;
      
      // שמור עותק מקומי של המשחק שנטען
      await saveActiveGameLocally(gameData);
      
      return gameData;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting active game by ID:', error);
    
    // במקרה של שגיאה, נסה לטעון מקומית
    const localGame = await getLocalActiveGame();
    if (localGame && (localGame.id === gameId || gameId === 'local_temp_id')) {
      return localGame;
    }
    
    return null;
  }
}

/**
 * getActiveGames
 * מביא את כל המשחקים הפעילים (שאינם במצב 'completed' או 'deleted') של המשתמש הנוכחי
 */
export async function getActiveGames(): Promise<Game[]> {
  try {
    console.log('=== getActiveGames: Starting ===');
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
      console.log('❌ User not authenticated, trying to load local active game instead');
      const localGame = await getLocalActiveGame();
      console.log('Local game found:', localGame ? `ID: ${localGame.id}, Status: ${localGame.status}` : 'None');
      return localGame ? [localGame] : [];
    }
    
    console.log(`✅ User authenticated: ${currentUser.uid} (${currentUser.email})`);
    
    // בדיקת חיבור לאינטרנט
    const netInfo = await NetInfo.fetch();
    const isConnected = netInfo.isConnected;
    console.log(`Network connected: ${isConnected}`);
    
    // אם אין חיבור לאינטרנט, נסה לטעון מקומית
    if (!isConnected) {
      console.log('❌ No internet connection, trying to load local active game');
      const localGame = await getLocalActiveGame();
      console.log('Local game found:', localGame ? `ID: ${localGame.id}, Status: ${localGame.status}` : 'None');
      return localGame ? [localGame] : [];
    }
    
    console.log('🔍 Querying Firestore for active games...');
    
    // טעינה מ-Firestore - חיפוש ראשוני לפי UID
    const activeGamesQuery = query(
      gamesCollection,
      where('createdBy', '==', currentUser.uid),
      where('status', 'in', ['active', 'ended', 'open_games', 'final_results', 'payments'])
    );
    
    console.log(`Query filters: createdBy == "${currentUser.uid}", status in [active, ended, open_games, final_results, payments]`);
    
    const querySnapshot = await getDocs(activeGamesQuery);
    let activeGames: Game[] = [];
    
    console.log(`📊 Query returned ${querySnapshot.size} documents`);
    
    querySnapshot.forEach(doc => {
      const gameData = { id: doc.id, ...doc.data() } as Game;
      console.log(`  📄 Game: ${gameData.id}`);
      console.log(`      CreatedBy: ${gameData.createdBy}`);
      console.log(`      Status: ${gameData.status}`);
      console.log(`      Date: ${gameData.date?.day}/${gameData.date?.month}/${gameData.date?.year}`);
      console.log(`      Players: ${gameData.players?.length || 0}`);
      activeGames.push(gameData);
    });
    
    // אם לא נמצאו משחקים עם UID, נחפש לפי אימייל כ-fallback
    if (activeGames.length === 0 && currentUser.email) {
      console.log('🔄 No games found by UID, trying fallback search by email...');
      
      // חיפוש נוסף בכל המשחקים הפעילים והשוואת האימייל
      const fallbackQuery = query(
        gamesCollection,
        where('status', 'in', ['active', 'ended', 'open_games', 'final_results', 'payments'])
      );
      
      const fallbackSnapshot = await getDocs(fallbackQuery);
      console.log(`📊 Fallback query returned ${fallbackSnapshot.size} documents`);
      
      // נטען את כל המשתמשים כדי להשוות אימיילים
      const { getAllUsers } = require('./users');
      const allUsers = await getAllUsers();
      const userEmailMap = new Map<string, string>(); // UID -> Email
      allUsers.forEach((user: any) => {
        if (user.email) {
          userEmailMap.set(user.id, user.email.toLowerCase());
        }
      });
      
      console.log(`📧 Looking for games created by email: ${currentUser.email.toLowerCase()}`);
      
             fallbackSnapshot.forEach(doc => {
         const gameData = { id: doc.id, ...doc.data() } as Game;
         const creatorEmail = userEmailMap.get(gameData.createdBy || '');
         
         if (creatorEmail && creatorEmail.toLowerCase() === currentUser.email?.toLowerCase()) {
           console.log(`✅ Found game ${gameData.id} created by same email through different UID: ${gameData.createdBy}`);
           console.log(`    Game Status: ${gameData.status}`);
           console.log(`    Game Date: ${gameData.date?.day}/${gameData.date?.month}/${gameData.date?.year}`);
           console.log(`    Players: ${gameData.players?.length || 0}`);
           
           // עדכן את ה-createdBy למזהה הנוכחי כדי למנוע בעיות בעתיד
           console.log(`🔄 Updating createdBy from ${gameData.createdBy} to ${currentUser.uid}`);
           gameData.createdBy = currentUser.uid;
           
           // שמור את העדכון ב-Firestore (ברקע)
           updateDoc(doc.ref, { createdBy: currentUser.uid })
             .then(() => {
               console.log(`✅ Successfully updated createdBy for game ${gameData.id}`);
             })
             .catch((error) => {
               console.error(`❌ Failed to update createdBy for game ${gameData.id}:`, error);
             });
           
           activeGames.push(gameData);
         }
       });
      
      if (activeGames.length > 0) {
        console.log(`📧 Fallback search found ${activeGames.length} games by email match`);
      } else {
        console.log(`📧 No games found by email fallback either`);
      }
    }
    
    console.log(`✅ getActiveGames: Found ${activeGames.length} active games for user ${currentUser.uid}`);
    console.log('=== getActiveGames: Complete ===');
    return activeGames;
  } catch (error) {
    console.error('❌ Error getting active games:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    
    // במקרה של שגיאה, נסה לטעון מקומית
    const localGame = await getLocalActiveGame();
    console.log('Fallback to local game:', localGame ? `ID: ${localGame.id}, Status: ${localGame.status}` : 'None');
    return localGame ? [localGame] : [];
  }
}

/**
 * getLocalActiveGame
 * מחזיר את המשחק הפעיל ששמור מקומית, אם קיים
 */
export async function getLocalActiveGame(): Promise<Game | null> {
  try {
    const gameJSON = await AsyncStorage.getItem(ACTIVE_GAME_STORAGE_KEY);
    if (!gameJSON) {
      return null;
    }
    return JSON.parse(gameJSON) as Game;
  } catch (error) {
    console.error('שגיאה בקריאת משחק פעיל מקומי:', error);
    return null;
  }
}

/**
 * clearLocalActiveGame
 * מוחק את המשחק הפעיל ששמור מקומית
 */
export async function clearLocalActiveGame(): Promise<boolean> {
  try {
    await AsyncStorage.removeItem(ACTIVE_GAME_STORAGE_KEY);
    console.log('משחק פעיל מקומי נמחק בהצלחה');
    return true;
  } catch (error) {
    console.error('שגיאה במחיקת משחק פעיל מקומי:', error);
    return false;
  }
}

/**
 * syncLocalActiveGameToFirestore
 * מסנכרן משחק פעיל מקומי ל-Firestore כאשר יש חיבור לאינטרנט
 * שימושי כשהמשתמש שיחק כשהיה מנותק ועכשיו יש חיבור
 */
export async function syncLocalActiveGameToFirestore(): Promise<string | null> {
  try {
    // בדיקה שהמשתמש מחובר
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.log('User not authenticated, cannot sync to Firestore');
      return null;
    }
    
    const localGame = await getLocalActiveGame();
    
    if (!localGame) {
      console.log('No local game to sync to Firestore');
      return null;
    }
    
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      console.log('No internet connection for syncing to Firestore');
      return null;
    }
    
    console.log(`Trying to sync local game with ID: ${localGame.id || 'new'} to Firestore`);
    
    // נבדוק תחילה אם המסמך קיים ב-Firestore
    let documentExists = false;
    if (localGame.id && localGame.id !== 'local_temp_id') {
      try {
        const docRef = doc(db, 'games', localGame.id);
        const docSnap = await getDoc(docRef);
        documentExists = docSnap.exists();
        console.log(`Document existence check: ${documentExists ? 'exists' : 'does not exist'}`);
      } catch (error) {
        console.log('Error checking document existence:', error);
        // אם יש שגיאה בבדיקה, נניח שהמסמך לא קיים
        documentExists = false;
      }
    }
    
    // אם יש מזהה למשחק אבל המסמך לא קיים, ניצור מסמך חדש
    if (localGame.id && localGame.id !== 'local_temp_id' && !documentExists) {
      console.log(`Document with ID ${localGame.id} does not exist anymore. Creating new document.`);
      // נמחק את המזהה הישן כדי שייווצר מסמך חדש
      const { id, ...gameWithoutId } = localGame;
      // נצטרך לשמור עם מזהה חדש
      const cleanGameWithoutId = cleanUndefinedValues(gameWithoutId);
      const newDocRef = await addDoc(gamesCollection, cleanGameWithoutId);
      console.log('New active game saved successfully with ID:', newDocRef.id);
      
      // נעדכן את העותק המקומי עם המזהה החדש
      await saveActiveGameLocally({...localGame, id: newDocRef.id});
      
      console.log(`Created new document with ID: ${newDocRef.id}`);
      return newDocRef.id;
    }
    
    // במקרה הרגיל, ננסה לשמור/לעדכן את המשחק ב-Firestore
    try {
      const gameId = await saveOrUpdateActiveGame(localGame);
      
      // אם ההעלאה הצליחה, נעדכן את המשחק המקומי עם המזהה החדש
      if (gameId && gameId !== 'local_temp_id' && gameId !== localGame.id) {
        await saveActiveGameLocally({...localGame, id: gameId});
        console.log(`Updated local game with new ID: ${gameId}`);
      }
      
      return gameId;
    } catch (error) {
      // במקרה של שגיאה "No document to update", ננסה ליצור מסמך חדש
      if (error instanceof Error && error.message && error.message.includes('No document to update')) {
        console.log('No document to update error detected, creating new document');
        
        // נמחק את המזהה הישן כדי שייווצר מסמך חדש
        const { id, ...gameWithoutId } = localGame;
        // נצטרך לשמור עם מזהה חדש
        const cleanGameWithoutId = cleanUndefinedValues(gameWithoutId);
        const newDocRef = await addDoc(gamesCollection, cleanGameWithoutId);
        console.log('New active game saved successfully with ID:', newDocRef.id);
        
        // נעדכן את העותק המקומי עם המזהה החדש
        await saveActiveGameLocally({...localGame, id: newDocRef.id});
        
        console.log(`Created new document after error with ID: ${newDocRef.id}`);
        return newDocRef.id;
      }
      
      // זריקת השגיאה המקורית אם לא טופלה
      throw error;
    }
  } catch (error) {
    console.error('Error syncing local active game to Firestore:', error);
    return null;
  }
}

/**
 * קורא את כל המשחקים המקומיים ששמורים במכשיר
 * משמש כאשר יש בעיות הרשאה בפיירבייס
 */
export async function getLocalGames(): Promise<any[]> {
  try {
    const gamesJSON = await AsyncStorage.getItem(LOCAL_GAMES_STORAGE_KEY);
    if (!gamesJSON) {
      return [];
    }
    const games = JSON.parse(gamesJSON);
    console.log(`נמצאו ${games.length} משחקים מקומיים`);
    return games;
  } catch (error) {
    console.error('שגיאה בקריאת משחקים מקומיים:', error);
    return [];
  }
}

/**
 * מוחק משחק מקומי
 */
export async function deleteLocalGame(gameId: string): Promise<boolean> {
  try {
    const games = await getLocalGames();
    const updatedGames = games.filter(game => game.id !== gameId);
    
    if (games.length === updatedGames.length) {
      console.log(`לא נמצא משחק מקומי עם מזהה: ${gameId}`);
      return false;
    }
    
    await AsyncStorage.setItem(LOCAL_GAMES_STORAGE_KEY, JSON.stringify(updatedGames));
    console.log(`משחק מקומי ${gameId} נמחק בהצלחה`);
    return true;
  } catch (error) {
    console.error('שגיאה במחיקת משחק מקומי:', error);
    return false;
  }
}

/**
 * מוחק את כל המשחקים המקומיים
 * שימושי אחרי שתיקנת את חוקי האבטחה
 */
export async function clearAllLocalGames(): Promise<boolean> {
  try {
    await AsyncStorage.removeItem(LOCAL_GAMES_STORAGE_KEY);
    console.log('כל המשחקים המקומיים נמחקו בהצלחה');
    return true;
  } catch (error) {
    console.error('שגיאה במחיקת משחקים מקומיים:', error);
    return false;
  }
}
