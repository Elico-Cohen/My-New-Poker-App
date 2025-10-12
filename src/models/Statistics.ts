// src/models/Statistics.ts

/**
 * Models for statistics data structures
 */

// Basic game statistics summary
export interface GameStatsSummary {
    totalGames: number;
    totalMoney: number;
    totalPlayers: number;
    totalRebuys: number;
    averageGameDuration?: number; // in minutes
    maxPlayers?: number; // מספר מקסימלי של שחקנים במשחק
    minPlayers?: number; // מספר מינימלי של שחקנים במשחק
    averagePlayersPerGame?: number; // ממוצע שחקנים למשחק
  }
  
  // Player performance statistics
  export interface PlayerStats {
    playerId: string;
    playerName: string;
    gamesPlayed: number;
    winCount: number;
    lossCount: number;
    netProfit: number;
    totalBuyIns: number;
    totalRebuys: number;
    totalInvestment: number;
    totalReturn: number;
    winRate: number; // percentage of games won
    roi: number; // return on investment percentage
    avgProfitPerGame: number;
    bestGame?: {
      gameId: string;
      date: string;
      profit: number;
    };
    worstGame?: {
      gameId: string;
      date: string;
      loss: number;
    };
  }
  
  // Group statistics
  export interface GroupStats {
    groupId: string;
    groupName: string;
    gamesPlayed: number;
    totalMoney: number;
    averagePlayersPerGame: number;
    mostFrequentPlayers: {playerId: string, playerName: string, gamesCount: number}[];
    lastGameDate?: string;
  }
  
  // Rebuy statistics
  export interface RebuyStats {
    totalRebuys: number;
    totalPurchases: number; // סך כל הקניות (באי-אין + ריבאי) של כל השחקנים בכל המשחקים
    averageRebuysPerGame: number;
    averageRebuysPerPlayer: number;
    averagePurchasesPerPlayer: number; // ממוצע קניות לשחקן (מחושב לפי מספר המשתתפים הכולל)
    gamesCount: number; // מספר המשחקים הכולל
    // החלק החדש - סטטיסטיקת קבוצות
    groupsRebuyStats?: {
      groupId: string;
      groupName: string;
      totalRebuys: number;
      totalPurchases: number;
      gamesCount: number; // מספר המשחקים בקבוצה
    }[];
    playerWithMostRebuys: {
      playerId: string;
      playerName: string;
      rebuyCount: number;
    };
    playerWithMostTotalRebuys: {
      playerId: string;
      playerName: string;
      totalRebuyCount: number;
    };
    playerWithLeastTotalRebuys: {
      playerId: string;
      playerName: string;
      totalRebuyCount: number;
      gamesCount: number;  // מספר המשחקים שהשחקן השתתף בהם
    };
    playerWithLowestRebuyAverage: {
      playerId: string;
      playerName: string;
      rebuyAverage: number;  // ממוצע ריבאיים למשחק
      totalRebuyCount: number;  // סה"כ ריבאיים
      gamesCount: number;  // מספר המשחקים שהשחקן השתתף בהם
    };
    playerWithHighestTotalPurchases: {
      playerId: string;
      playerName: string;
      totalPurchaseAmount: number;  // סה"כ סכום הריבאיים + סה"כ סכום הבאי אין
    };
    playerWithLowestTotalPurchases: {
      playerId: string;
      playerName: string;
      totalPurchaseAmount: number;  // סה"כ סכום הריבאיים + סה"כ סכום הבאי אין
      gamesCount: number;  // מספר המשחקים שהשחקן השתתף בהם
    };
    playerWithHighestSingleGamePurchase: {
      playerId: string;
      playerName: string;
      gameId: string;
      date: string;
      purchaseAmount: number;  // סה"כ סכום הקנייה במשחק בודד (באי-אין + ריבאי)
    };
    playerWithLargestSingleGameDifference: {
      playerId: string;
      playerName: string;
      gameId: string;
      date: string;
      purchaseAmount: number;  // סה"כ הקניות במשחק
      finalResult: number;     // התוצאה הסופית של המשחק
      difference: number;      // ההפרש בין הקניות לתוצאה
    };
    playerWithLargestCumulativeDifference: {
      playerId: string;
      playerName: string;
      totalPurchaseAmount: number;   // סה"כ קניות מצטבר בכל המשחקים
      totalFinalResult: number;      // סה"כ תוצאה סופית מצטברת בכל המשחקים
      totalDifference: number;       // ההפרש בין סה"כ הקניות לסה"כ התוצאות
      gamesCount: number;            // מספר המשחקים שהשחקן השתתף בהם
    };
    gameWithMostRebuys: {
      gameId: string;
      date: string;
      rebuyCount: number;
      playersCount: number;     // מספר השחקנים במשחק
      groupName: string;        // שם הקבוצה של המשחק
      topRebuyPlayers: {        // שלושת השחקנים עם הכי הרבה ריבאיים במשחק הזה
        playerId: string;
        playerName: string;
        rebuyCount: number;
      }[];
    };
    gameWithLeastRebuys: {
      gameId: string;
      date: string;
      rebuyCount: number;
      playersCount: number;     // מספר השחקנים במשחק
      groupName: string;        // שם הקבוצה של המשחק
      topRebuyPlayers: {        // שלושת השחקנים עם הכי הרבה ריבאיים במשחק הזה
        playerId: string;
        playerName: string;
        rebuyCount: number;
      }[];
    };
    gameWithMostPurchases: {
      gameId: string;
      date: string;
      purchaseAmount: number;   // סה"כ סכום הקניות במשחק (באי-אין + ריבאי)
      playersCount: number;     // מספר השחקנים במשחק
      groupName: string;        // שם הקבוצה של המשחק
      topPurchasePlayers: {     // שלושת השחקנים עם הכי הרבה קניות במשחק הזה
        playerId: string;
        playerName: string;
        purchaseAmount: number; // סה"כ קניות של השחקן (באי-אין + ריבאי)
      }[];
    };
    gameWithLeastPurchases: {
      gameId: string;
      date: string;
      purchaseAmount: number;   // סה"כ סכום הקניות במשחק (באי-אין + ריבאי)
      playersCount: number;     // מספר השחקנים במשחק
      groupName: string;        // שם הקבוצה של המשחק
      topPurchasePlayers: {     // שלושת השחקנים עם הכי הרבה קניות במשחק הזה
        playerId: string;
        playerName: string;
        purchaseAmount: number; // סה"כ קניות של השחקן (באי-אין + ריבאי)
      }[];
    };
  }
  
  // Open games statistics
  export interface OpenGamesStats {
    totalOpenGames: number;
    topWinners: {
      playerId: string;
      playerName: string;
      winCount: number;
      totalWon: number;
    }[];
    averageOpenGamesPerGame: number;
    gamesCount?: number; // מספר המשחקים הכולל (אופציונלי)
  }
  
  // Player participation statistics
  export interface ParticipationStats {
    playerParticipation: {
      playerId: string;
      playerName: string;
      gamesCount: number;
      participationRate: number; // percentage of total games
    }[];
    mostActivePlayerCount: number;
    leastActivePlayerCount: number;
  }
  
  // Winner/Loser statistics
  export interface WinnersLosersStats {
    bestSingleGamePlayers: {
      playerId: string;
      playerName: string;
      gamesPlayed: number;
      gamesWon: number;
      bestSingleGameProfit: number;
      bestSingleGameId: string;
      bestSingleGameDate: string;
      cumulativeProfit: number;
      winRate: number;
    }[];
    bestCumulativePlayers: {
      playerId: string;
      playerName: string;
      gamesPlayed: number;
      gamesWon: number;
      bestSingleGameProfit: number;
      bestSingleGameId: string;
      bestSingleGameDate: string;
      cumulativeProfit: number;
      winRate: number;
    }[];
    mostWinningGamesPlayers: {
      playerId: string;
      playerName: string;
      gamesPlayed: number;
      gamesWon: number;
      bestSingleGameProfit: number;
      bestSingleGameId: string;
      bestSingleGameDate: string;
      cumulativeProfit: number;
      winRate: number;
    }[];
    bestWinRatePlayers: {
      playerId: string;
      playerName: string;
      gamesPlayed: number;
      gamesWon: number;
      bestSingleGameProfit: number;
      bestSingleGameId: string;
      bestSingleGameDate: string;
      cumulativeProfit: number;
      winRate: number;
    }[];
    totalPlayers: number;
    totalGames: number;
  }
  
  // Time-based filters for statistics
  export type TimeFilter = 'all' | 'month' | 'quarter' | 'year' | 'custom';
  
  // Filter options for statistics queries
  export interface StatisticsFilter {
    timeFilter: TimeFilter;
    groupId?: string;
    playerId?: string;
    startDate?: Date;
    endDate?: Date;
    statuses?: string[];        // רשימת סטטוסים לסינון (למשל ['completed', 'final_results'])
    includeAllStatuses?: boolean; // אם true, לא יבוצע סינון לפי סטטוס כלל
    _refreshToken?: string;      // מזהה רענון ייחודי - לא חלק מהמודל, משמש רק לעקיפת מטמון
  }