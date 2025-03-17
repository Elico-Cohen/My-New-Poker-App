import { Game } from '@/models/Game';
import { UserProfile } from '@/models/UserProfile';

/**
 * מחשב את סך הכסף שהשחקן הרוויח/הפסיד במשחקים
 * @param games רשימת משחקים
 * @param userId מזהה השחקן
 * @returns סכום הרווח/הפסד
 */
export const calculateTotalProfit = (games: Game[], userId: string): number => {
  return games.reduce((total, game) => {
    const playerResult = game.players?.find(player => player.id === userId);
    if (playerResult && (playerResult as any).profit !== undefined) {
      return total + (playerResult as any).profit;
    }
    return total;
  }, 0);
};

/**
 * מחשב את מספר המשחקים שהשחקן השתתף בהם
 * @param games רשימת משחקים
 * @param userId מזהה השחקן
 * @returns מספר המשחקים
 */
export const calculateGamesPlayed = (games: Game[], userId: string): number => {
  return games.filter(game => 
    game.players?.some(player => player.id === userId)
  ).length;
};

/**
 * מחשב את מספר המשחקים שהשחקן ניצח בהם
 * @param games רשימת משחקים
 * @param userId מזהה השחקן
 * @returns מספר הניצחונות
 */
export const calculateGamesWon = (games: Game[], userId: string): number => {
  return games.filter(game => {
    const playerResult = game.players?.find(player => player.id === userId);
    return playerResult && (playerResult as any).profit !== undefined && (playerResult as any).profit > 0;
  }).length;
};

/**
 * מחשב את אחוז הניצחונות של השחקן
 * @param games רשימת משחקים
 * @param userId מזהה השחקן
 * @returns אחוז הניצחונות (0-100)
 */
export const calculateWinPercentage = (games: Game[], userId: string): number => {
  const gamesPlayed = calculateGamesPlayed(games, userId);
  if (gamesPlayed === 0) return 0;
  
  const gamesWon = calculateGamesWon(games, userId);
  return (gamesWon / gamesPlayed) * 100;
};

/**
 * מחשב את הרווח הממוצע למשחק
 * @param games רשימת משחקים
 * @param userId מזהה השחקן
 * @returns רווח ממוצע למשחק
 */
export const calculateAverageProfitPerGame = (games: Game[], userId: string): number => {
  const gamesPlayed = calculateGamesPlayed(games, userId);
  if (gamesPlayed === 0) return 0;
  
  const totalProfit = calculateTotalProfit(games, userId);
  return totalProfit / gamesPlayed;
};

/**
 * מחשב את מספר הריבאיים שהשחקן ביצע
 * @param games רשימת משחקים
 * @param userId מזהה השחקן
 * @returns מספר הריבאיים
 */
export const calculateTotalRebuys = (games: Game[], userId: string): number => {
  return games.reduce((total, game) => {
    const playerResult = game.players?.find(player => player.id === userId);
    if (playerResult && (playerResult as any).rebuys !== undefined) {
      return total + (playerResult as any).rebuys;
    }
    return total;
  }, 0);
};

/**
 * מחשב את ממוצע הריבאיים למשחק
 * @param games רשימת משחקים
 * @param userId מזהה השחקן
 * @returns ממוצע ריבאיים למשחק
 */
export const calculateAverageRebuysPerGame = (games: Game[], userId: string): number => {
  const gamesPlayed = calculateGamesPlayed(games, userId);
  if (gamesPlayed === 0) return 0;
  
  const totalRebuys = calculateTotalRebuys(games, userId);
  return totalRebuys / gamesPlayed;
};

/**
 * מחשב את הרווח הגבוה ביותר במשחק בודד
 * @param games רשימת משחקים
 * @param userId מזהה השחקן
 * @returns הרווח הגבוה ביותר
 */
export const calculateBiggestWin = (games: Game[], userId: string): number => {
  let maxProfit = 0;
  
  games.forEach(game => {
    const playerResult = game.players?.find(player => player.id === userId);
    if (playerResult && (playerResult as any).profit !== undefined && (playerResult as any).profit > maxProfit) {
      maxProfit = (playerResult as any).profit;
    }
  });
  
  return maxProfit;
};

/**
 * מחשב את ההפסד הגדול ביותר במשחק בודד
 * @param games רשימת משחקים
 * @param userId מזהה השחקן
 * @returns ההפסד הגדול ביותר (כערך מוחלט)
 */
export const calculateBiggestLoss = (games: Game[], userId: string): number => {
  let maxLoss = 0;
  
  games.forEach(game => {
    const playerResult = game.players?.find(player => player.id === userId);
    if (playerResult && (playerResult as any).profit !== undefined && (playerResult as any).profit < maxLoss) {
      maxLoss = Math.abs((playerResult as any).profit);
    }
  });
  
  return maxLoss;
};

/**
 * מחשב את הרצף הארוך ביותר של ניצחונות
 * @param games רשימת משחקים (ממוינים לפי תאריך)
 * @param userId מזהה השחקן
 * @returns אורך רצף הניצחונות הארוך ביותר
 */
export const calculateLongestWinStreak = (games: Game[], userId: string): number => {
  let currentStreak = 0;
  let maxStreak = 0;
  
  // מיון המשחקים לפי תאריך (מהישן לחדש)
  const sortedGames = [...games].sort((a, b) => {
    const aTime = a.date?.timestamp || a.createdAt || 0;
    const bTime = b.date?.timestamp || b.createdAt || 0;
    return aTime - bTime;
  });
  
  // חישוב הרצף
  sortedGames.forEach(game => {
    const playerResult = game.players?.find(player => player.id === userId);
    
    if (playerResult && (playerResult as any).profit !== undefined) {
      if ((playerResult as any).profit > 0) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }
  });
  
  return maxStreak;
};

/**
 * מחשב את הרצף הארוך ביותר של הפסדים
 * @param games רשימת משחקים (ממוינים לפי תאריך)
 * @param userId מזהה השחקן
 * @returns אורך רצף ההפסדים הארוך ביותר
 */
export const calculateLongestLossStreak = (games: Game[], userId: string): number => {
  let currentStreak = 0;
  let maxStreak = 0;
  
  // מיון המשחקים לפי תאריך (מהישן לחדש)
  const sortedGames = [...games].sort((a, b) => {
    const aTime = a.date?.timestamp || a.createdAt || 0;
    const bTime = b.date?.timestamp || b.createdAt || 0;
    return aTime - bTime;
  });
  
  // חישוב הרצף
  sortedGames.forEach(game => {
    const playerResult = game.players?.find(player => player.id === userId);
    
    if (playerResult && (playerResult as any).profit !== undefined) {
      if ((playerResult as any).profit < 0) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }
  });
  
  return maxStreak;
};

/**
 * מחשב את דירוג השחקנים לפי רווח כולל
 * @param games רשימת משחקים
 * @param users רשימת שחקנים
 * @returns מערך של שחקנים עם הרווח הכולל שלהם, ממוין מהגבוה לנמוך
 */
export const calculatePlayerRankingByProfit = (games: Game[], users: UserProfile[]): Array<{
  user: UserProfile;
  totalProfit: number;
  gamesPlayed: number;
  averageProfit: number;
}> => {
  const playerStats = users.map(user => {
    const totalProfit = calculateTotalProfit(games, user.id);
    const gamesPlayed = calculateGamesPlayed(games, user.id);
    const averageProfit = gamesPlayed > 0 ? totalProfit / gamesPlayed : 0;
    
    return {
      user,
      totalProfit,
      gamesPlayed,
      averageProfit
    };
  });
  
  // סינון שחקנים שלא שיחקו משחקים
  const activePlayerStats = playerStats.filter(stats => stats.gamesPlayed > 0);
  
  // מיון לפי רווח כולל (מהגבוה לנמוך)
  return activePlayerStats.sort((a, b) => b.totalProfit - a.totalProfit);
};

/**
 * מחשב את דירוג השחקנים לפי רווח ממוצע למשחק
 * @param games רשימת משחקים
 * @param users רשימת שחקנים
 * @param minGames מספר מינימלי של משחקים שנדרש כדי להיכלל בדירוג
 * @returns מערך של שחקנים עם הרווח הממוצע שלהם, ממוין מהגבוה לנמוך
 */
export const calculatePlayerRankingByAverageProfit = (
  games: Game[],
  users: UserProfile[],
  minGames: number = 3
): Array<{
  user: UserProfile;
  averageProfit: number;
  gamesPlayed: number;
  totalProfit: number;
}> => {
  const playerStats = users.map(user => {
    const totalProfit = calculateTotalProfit(games, user.id);
    const gamesPlayed = calculateGamesPlayed(games, user.id);
    const averageProfit = gamesPlayed > 0 ? totalProfit / gamesPlayed : 0;
    
    return {
      user,
      totalProfit,
      gamesPlayed,
      averageProfit
    };
  });
  
  // סינון שחקנים שלא שיחקו מספיק משחקים
  const qualifiedPlayerStats = playerStats.filter(stats => stats.gamesPlayed >= minGames);
  
  // מיון לפי רווח ממוצע (מהגבוה לנמוך)
  return qualifiedPlayerStats.sort((a, b) => b.averageProfit - a.averageProfit);
}; 