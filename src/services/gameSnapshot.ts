import { db, auth } from '@/config/firebase';
import { collection, addDoc, getFirestore } from 'firebase/firestore';
import { Game } from '@/models/Game';
import { verifyAccessControl } from '@/utils/securityAudit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

// קבוע למפתח שמירה מקומית של משחקים
const LOCAL_GAMES_STORAGE_KEY = 'local_games_storage';

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
  
  const gameToSave: Omit<Game, 'id'> = {
    ...game,
    createdAt: now,
    updatedAt: now,
    createdBy: currentUser.uid, // הוספת מזהה המשתמש שיצר את המשחק
  };
  
  try {
    // ניסיון שמירה בפיירבייס
    const docRef = await addDoc(gamesCollection, gameToSave);
    console.log('Game saved successfully with ID:', docRef.id);
    
    // ניקוי משחקים מקומיים אם השמירה בפיירבייס הצליחה
    await clearAllLocalGames();
    
    return docRef.id;
  } catch (error: any) {
    console.error('Error saving game:', error);
    console.log('Game data attempted to save:', JSON.stringify(gameToSave));
    
    // הסרנו את השמירה המקומית כי פיירבייס עובד כעת
    throw error;
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
