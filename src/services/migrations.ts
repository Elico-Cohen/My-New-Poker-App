import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MIGRATION_KEY = 'game_dates_migration_completed';

export async function migrateGameDates() {
  try {
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
    const updates = snapshot.docs.map(async (gameDoc) => {
      const gameData = gameDoc.data();
      
      // Skip if already in correct format
      if (gameData.date && 
          typeof gameData.date === 'object' && 
          'year' in gameData.date) {
        return;
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
    });

    await Promise.all(updates);
    console.log(`Migration completed. Updated ${migratedCount} documents.`);

    // Mark migration as completed
    await AsyncStorage.setItem(MIGRATION_KEY, 'true');

  } catch (error) {
    console.error('Error during game dates migration:', error);
  }
}