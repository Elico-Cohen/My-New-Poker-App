// Debug script to check all games in Firestore
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

// Firebase config (replace with your actual config)
const firebaseConfig = {
  // Add your config here if needed for direct access
};

// For debugging, we'll assume the user will run this from their environment
async function checkAllGames() {
  try {
    const db = getFirestore();
    const gamesCollection = collection(db, 'games');
    const snapshot = await getDocs(gamesCollection);
    
    console.log(`Total games in Firestore: ${snapshot.size}`);
    
    const statusCounts = {};
    const gameDetails = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const status = data.status || 'no_status';
      
      statusCounts[status] = (statusCounts[status] || 0) + 1;
      
      gameDetails.push({
        id: doc.id,
        status: status,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        groupId: data.groupId,
        players: data.players?.length || 0
      });
    });
    
    console.log('Status counts:', statusCounts);
    
    // Show games that are not completed
    const nonCompleted = gameDetails.filter(g => g.status !== 'completed');
    if (nonCompleted.length > 0) {
      console.log('\nNon-completed games:');
      nonCompleted.forEach(game => {
        console.log(`- ${game.id}: status=${game.status}, players=${game.players}`);
      });
    }
    
    // Show all games sorted by createdAt
    console.log('\nAll games (sorted by creation time):');
    gameDetails
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .forEach((game, index) => {
        console.log(`${index + 1}. ${game.id}: status=${game.status}, players=${game.players}`);
      });
      
  } catch (error) {
    console.error('Error checking games:', error);
  }
}

// Export for manual execution
module.exports = { checkAllGames }; 