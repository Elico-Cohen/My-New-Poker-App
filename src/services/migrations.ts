import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db, auth } from '@/config/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MIGRATION_KEY = 'game_dates_migration_completed';

export async function migrateGameDates() {
  try {
    // בדיקה שהמשתמש מחובר
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.log('Game dates migration skipped - user not authenticated');
      return;
    }

    // Check if migration has already run
    const migrationCompleted = await AsyncStorage.getItem(MIGRATION_KEY);
    if (migrationCompleted === 'true') {
      console.log('Game dates migration already completed');
      return;
    }

    console.log('Starting game dates migration...');
    const gamesCollection = collection(db, 'games');
    const snapshot = await getDocs(gamesCollection);
    
    let migratedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Process games one by one to handle errors individually
    for (const gameDoc of snapshot.docs) {
      try {
      const gameData = gameDoc.data();
      
      // Skip if already in correct format
      if (gameData.date && 
          typeof gameData.date === 'object' && 
          'year' in gameData.date) {
          continue;
      }

      // Create new date format
      const now = new Date();
      const newDate = {
        day: now.getDate(),
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        timestamp: now.getTime()
      };

      // Update the document
      await updateDoc(doc(db, 'games', gameDoc.id), {
        date: newDate
      });
      migratedCount++;
        
        // Log progress every 10 games
        if (migratedCount % 10 === 0) {
          console.log(`Migrated ${migratedCount} games so far...`);
        }
      } catch (error: any) {
        errorCount++;
        const errorMessage = `Error migrating game ${gameDoc.id}: ${error.message}`;
        console.error(errorMessage);
        errors.push(errorMessage);
      }
    }

    console.log(`Migration completed. Updated ${migratedCount} documents.`);
    if (errorCount > 0) {
      console.error(`Failed to migrate ${errorCount} documents.`);
      console.error('Errors:', errors);
    }

    // Mark migration as completed only if all games were processed successfully
    if (errorCount === 0) {
    await AsyncStorage.setItem(MIGRATION_KEY, 'true');
    } else {
      console.warn('Migration completed with errors. Will retry on next run.');
    }

  } catch (error: any) {
    console.error('Error during game dates migration:', error);
  }
}