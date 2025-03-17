// src/app/statistics/winnersLosers.tsx

import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, Animated, Easing } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Text } from '@/components/common/Text';
import { Card } from '@/components/common/Card';
import { Icon } from '@/components/common/Icon';
import { Dropdown } from '@/components/common/Dropdown';
import { getWinnersLosersStatistics } from '@/services/statistics/playerStatistics';
import { WinnersLosersStats, StatisticsFilter } from '@/models/Statistics';
import StatisticsChart from '@/components/statistics/StatisticsChart';
import StatCard from '@/components/statistics/StatCard';
import StatisticsList from '@/components/statistics/StatisticsList';
import PlayersRanking from '@/components/statistics/PlayersRanking';
import { useGroups } from '@/hooks/useAppStore';
import TabBar from '@/components/common/TabBar';
import { fetchAllGames, filterGames, clearStatsCache } from '@/services/statistics/statisticsService';
import { Game } from '@/models/Game';
import Toast from 'react-native-toast-message';
import { formatCurrency } from '@/utils/formatters/currencyFormatter';
import HeaderBar from '@/components/navigation/HeaderBar';
import { syncService } from '@/store/SyncService';

const CASINO_COLORS = {
  background: '#0D1B1E',
  primary: '#35654d',
  gold: '#FFD700',
  surface: '#1C2C2E',
  text: '#FFFFFF',
  textSecondary: '#B8B8B8',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444'
};

// TABS enum
enum TABS {
  GENERAL = 'general',
  RANKING = 'ranking',
  CHAMPIONS = 'champions'
}

// טיפוס לתוצאות שחקן מהפונקציות השונות
interface PlayerEntry {
  id: string;
  name: string;
  value: number; // הערך העיקרי לפיו ממיינים
  gamesPlayed: number;
  winRate?: number; // אופציונלי כי חסר ב-winRateList
  gameDetails?: any; // מידע נוסף על משחק ספציפי
  isPositive?: boolean;
  // שדות נוספים שמופיעים ב-winRateList
  cumulativeProfit?: number;
  gamesWon?: number;
  gamesLost?: number;
}

// Types for player rankings
interface PlayerRankings {
  bestSingleGameProfitList: PlayerEntry[];
  cumulativeProfitList: PlayerEntry[];
  winRateList: PlayerEntry[];
  worstSingleGameLossList: PlayerEntry[];
  rawData?: Map<string, any>;
}

// Type for ranking types
type RankingType = 'single' | 'cumulative' | 'rate' | 'loss';

// פונקציית עזר לאיסוף וניתוח סטטיסטיקות השחקנים מהמשחקים
const collectPlayerStatistics = (games: Game[]) => {
  console.log(`collectPlayerStatistics: מתחיל עיבוד של ${games.length} משחקים`);
  
  // יצירת מפה לשמירת סטטיסטיקות עבור כל שחקן
  // המפתח הוא מזהה השחקן, הערך הוא אובייקט עם כל הסטטיסטיקות
  const playersStats = new Map<string, {
    id: string;               // מזהה השחקן
    name: string;             // שם השחקן
    gamesPlayed: number;      // מספר המשחקים
    gamesWon: number;         // מספר המשחקים שהסתיימו ברווח
    gamesLost: number;        // מספר המשחקים שהסתיימו בהפסד
    cumulativeProfit: number; // רווח/הפסד מצטבר
    winRate: number;          // אחוז ניצחונות
    bestSingleGameProfit: number;  // הרווח הגבוה ביותר במשחק בודד
    worstSingleGameLoss: number;   // ההפסד הגבוה ביותר במשחק בודד (כערך שלילי)
    bestGameDetails: {        // פרטים על המשחק עם הרווח הגבוה ביותר
      gameId: string;
      date: string;
    } | null;
    worstGameDetails: {       // פרטים על המשחק עם ההפסד הגבוה ביותר
      gameId: string;
      date: string;
    } | null;
  }>();

  // מעקב אחר מספר המשחקים עם נתונים תקינים
  let validGamesCount = 0;
  let invalidPlayersCount = 0;
  
  // מעבר על כל המשחקים
  games.forEach((game, gameIndex) => {
    // בדיקה שיש שחקנים במשחק
    if (!game.players || game.players.length === 0) {
      console.log(`collectPlayerStatistics: משחק ${gameIndex} ללא שחקנים, דילוג`);
      return;
    }

    // בדיקה שיש מזהה משחק
    const gameId = game.id || `game_${gameIndex}`;
    
    // בדיקת פורמט תאריך
    const gameDate = game.date ? 
      `${game.date.day}/${game.date.month}/${game.date.year}` : 
      new Date(game.createdAt || Date.now()).toLocaleDateString();
      
    console.log(`collectPlayerStatistics: מעבד משחק ${gameId} מתאריך ${gameDate} עם ${game.players.length} שחקנים`);
    
    let validPlayersInGame = 0;
    
    // עיבוד הנתונים של כל שחקן במשחק
    game.players.forEach((player, playerIndex) => {
      // חילוץ הנתונים הדרושים מהשחקן במשחק
      const playerId = player.userId || player.id;
      const playerName = player.name || `שחקן ${playerIndex + 1}`;
      
      // בדיקת תקינות התוצאה הסופית
      let finalResult = 0;
      if (player.finalResultMoney !== undefined && player.finalResultMoney !== null) {
        finalResult = player.finalResultMoney;
      } else if (player.finalResult !== undefined && player.finalResult !== null) {
        finalResult = player.finalResult;
      }
      
      if (!playerId) {
        console.warn(`collectPlayerStatistics: שחקן ללא מזהה במשחק ${gameId}, שם: ${playerName}, דילוג`);
        invalidPlayersCount++;
        return;
      }
      
      // אם השחקן לא קיים במפה, נוסיף אותו עם נתונים התחלתיים
      if (!playersStats.has(playerId)) {
        playersStats.set(playerId, {
          id: playerId,
          name: playerName || 'שחקן לא ידוע',
          gamesPlayed: 0,
          gamesWon: 0,
          gamesLost: 0,
          cumulativeProfit: 0,
          winRate: 0,
          bestSingleGameProfit: 0,
          worstSingleGameLoss: 0,
          bestGameDetails: null,
          worstGameDetails: null
        });
      }

      // עדכון הנתונים של השחקן
      const playerStats = playersStats.get(playerId)!;
      
      // עדכון שם השחקן אם חסר
      if (!playerStats.name || playerStats.name === 'שחקן לא ידוע') {
        playerStats.name = playerName;
      }
      
      // הוספת משחק למניין
      playerStats.gamesPlayed++;
      
      // עדכון הרווח/הפסד המצטבר
      playerStats.cumulativeProfit += finalResult;
      
      // עדכון מניין הניצחונות/הפסדים
      if (finalResult > 0) {
        playerStats.gamesWon++;
        
        // בדיקה אם זה הרווח הגבוה ביותר שראינו עבור שחקן זה
        if (finalResult > playerStats.bestSingleGameProfit) {
          playerStats.bestSingleGameProfit = finalResult;
          playerStats.bestGameDetails = {
            gameId,
            date: gameDate
          };
        }
      } else if (finalResult < 0) {
        playerStats.gamesLost++;
        
        // בדיקה אם זה ההפסד הגבוה ביותר שראינו עבור שחקן זה
        // שים לב שמדובר בערך שלילי, לכן ההשוואה היא < (קטן יותר שלילי)
        if (finalResult < playerStats.worstSingleGameLoss) {
          playerStats.worstSingleGameLoss = finalResult;
          playerStats.worstGameDetails = {
            gameId,
            date: gameDate
          };
        }
      }
      
      // חישוב אחוז הניצחונות - כמה אחוז מהמשחקים הסתיימו ברווח
      if (playerStats.gamesPlayed > 0) {
        playerStats.winRate = (playerStats.gamesWon / playerStats.gamesPlayed) * 100;
      } else {
        playerStats.winRate = 0;
      }
      
      validPlayersInGame++;
    });
    
    if (validPlayersInGame > 0) {
      validGamesCount++;
    } else {
      console.warn(`collectPlayerStatistics: משחק ${gameId} אין שחקנים תקינים`);
    }
  });

  console.log(`collectPlayerStatistics: סיום עיבוד עם ${playersStats.size} שחקנים שונים מתוך ${validGamesCount} משחקים תקינים (דילוג על ${invalidPlayersCount} שחקנים לא תקינים)`);
  
  // לוג של מספר שחקנים לפי קריטריונים שונים
  let winnersCount = 0;
  let losersCount = 0;
  let neutralCount = 0;
  
  playersStats.forEach(player => {
    if (player.cumulativeProfit > 0) winnersCount++;
    else if (player.cumulativeProfit < 0) losersCount++;
    else neutralCount++;
    
    // וידוא שיש ערכים תקינים לכל שדה
    if (player.bestSingleGameProfit <= 0) {
      console.warn(`collectPlayerStatistics: שחקן ${player.name} ללא רווח במשחק בודד, מאתחל ל-0`);
      player.bestSingleGameProfit = 0;
    }
    
    if (player.worstSingleGameLoss >= 0) {
      console.warn(`collectPlayerStatistics: שחקן ${player.name} ללא הפסד במשחק בודד, מאתחל ל-0`);
      player.worstSingleGameLoss = 0;
    }
  });
  
  console.log(`collectPlayerStatistics: סטטיסטיקה: ${winnersCount} מנצחים, ${losersCount} מפסידים, ${neutralCount} נייטרליים`);
  
  return playersStats;
};

// פונקציה 1: רשימה ממוינת לפי רווח הכי גבוה במשחק בודד (מהגבוה לנמוך)
const getBestSingleGameProfitList = (playersStats: Map<string, any>) => {
  console.log(`getBestSingleGameProfitList: נקראה עם ${playersStats.size} שחקנים`);
  
  const result = Array.from(playersStats.values())
    .sort((a, b) => b.bestSingleGameProfit - a.bestSingleGameProfit)
    .map(player => ({
      id: player.id,
      name: player.name,
      value: player.bestSingleGameProfit, // הערך לפיו ממיינים
      gamesPlayed: player.gamesPlayed,
      winRate: player.winRate,
      gameDetails: player.bestGameDetails, // פרטים על המשחק עם הרווח המקסימלי
      // מידע נוסף שיכול להיות שימושי להצגה
      isPositive: player.bestSingleGameProfit > 0
    }));
    
  console.log(`getBestSingleGameProfitList: החזירה ${result.length} פריטים`);
  if (result.length > 0) {
    console.log(`getBestSingleGameProfitList: ערך ראשון: ${result[0].name} עם ${result[0].value}`);
    if (result.length < 3) {
      console.warn(`getBestSingleGameProfitList: הוחזרו פחות מ-3 שחקנים`);
    }
  } else {
    console.warn(`getBestSingleGameProfitList: הוחזרה רשימה ריקה!`);
  }
  
  return result;
};

// פונקציה 2: רשימה ממוינת לפי רווח מצטבר (מהגבוה לנמוך)
const getCumulativeProfitList = (playersStats: Map<string, any>) => {
  console.log(`getCumulativeProfitList: נקראה עם ${playersStats.size} שחקנים`);
  
  const result = Array.from(playersStats.values())
    .sort((a, b) => b.cumulativeProfit - a.cumulativeProfit)
    .map(player => ({
      id: player.id,
      name: player.name,
      value: player.cumulativeProfit, // הערך לפיו ממיינים
      gamesPlayed: player.gamesPlayed,
      winRate: player.winRate,
      // מידע נוסף שיכול להיות שימושי להצגה
      isPositive: player.cumulativeProfit > 0
    }));
    
  console.log(`getCumulativeProfitList: החזירה ${result.length} פריטים`);
  if (result.length > 0) {
    console.log(`getCumulativeProfitList: ערך ראשון: ${result[0].name} עם ${result[0].value}`);
    if (result.length < 3) {
      console.warn(`getCumulativeProfitList: הוחזרו פחות מ-3 שחקנים`);
    }
  } else {
    console.warn(`getCumulativeProfitList: הוחזרה רשימה ריקה!`);
  }
  
  return result;
};

// פונקציה 3: רשימה ממוינת לפי אחוז ניצחונות (מהגבוה לנמוך)
const getWinRateList = (playersStats: Map<string, any>) => {
  console.log(`getWinRateList: נקראה עם ${playersStats.size} שחקנים`);
  
  const result = Array.from(playersStats.values())
    // סינון שחקנים עם מספר משחקים מינימלי (למשל 3) כדי שהסטטיסטה תהיה משמעותית
    .filter(player => player.gamesPlayed >= 1)
    .sort((a, b) => b.winRate - a.winRate)
    .map(player => ({
      id: player.id,
      name: player.name,
      value: player.winRate, // הערך לפיו ממיינים
      gamesPlayed: player.gamesPlayed,
      cumulativeProfit: player.cumulativeProfit,
      // מידע נוסף שיכול להיות שימושי להצגה
      gamesWon: player.gamesWon,
      gamesLost: player.gamesLost
    }));
    
  console.log(`getWinRateList: החזירה ${result.length} פריטים`);
  if (result.length > 0) {
    console.log(`getWinRateList: ערך ראשון: ${result[0].name} עם ${result[0].value}%`);
    if (result.length < 3) {
      console.warn(`getWinRateList: הוחזרו פחות מ-3 שחקנים`);
    }
  } else {
    console.warn(`getWinRateList: הוחזרה רשימה ריקה!`);
  }
  
  return result;
};

// פונקציה 4: רשימה ממוינת לפי הפסד הכי גבוה במשחק בודד (מההפסד הגדול ביותר לקטן ביותר)
const getWorstSingleGameLossList = (playersStats: Map<string, any>) => {
  console.log(`getWorstSingleGameLossList: נקראה עם ${playersStats.size} שחקנים`);
  
  const result = Array.from(playersStats.values())
    // סינון רק שחקנים שהפסידו לפחות במשחק אחד
    .filter(player => player.worstSingleGameLoss < 0)
    // מיון לפי הערך המוחלט של ההפסד (מההפסד הגדול לקטן)
    .sort((a, b) => a.worstSingleGameLoss - b.worstSingleGameLoss)
    .map(player => ({
      id: player.id,
      name: player.name,
      value: player.worstSingleGameLoss, // הערך לפיו ממיינים (שלילי)
      gamesPlayed: player.gamesPlayed,
      winRate: player.winRate,
      gameDetails: player.worstGameDetails, // פרטים על המשחק עם ההפסד המקסימלי
    }));
    
  console.log(`getWorstSingleGameLossList: החזירה ${result.length} פריטים`);
  if (result.length > 0) {
    console.log(`getWorstSingleGameLossList: ערך ראשון: ${result[0].name} עם ${result[0].value}`);
    if (result.length < 3) {
      console.warn(`getWorstSingleGameLossList: הוחזרו פחות מ-3 שחקנים`);
    }
  } else {
    console.warn(`getWorstSingleGameLossList: הוחזרה רשימה ריקה!`);
  }
  
  return result;
};

// פונקציה מרכזית שמביאה את הנתונים, מבצעת סינון, ומחזירה את כל הסטטיסטיקות
const getPlayerRankings = async (
  filter: StatisticsFilter = { timeFilter: 'all' }
) => {
  console.log(`getPlayerRankings: נקראה עם פילטר`, filter);
  
  try {
    // מביאים את כל המשחקים
    const allGames = await fetchAllGames();
    console.log(`getPlayerRankings: התקבלו ${allGames.length} משחקים מהשרת`);
    
    // בדיקה שיש משחקים בכלל
    if (!allGames || allGames.length === 0) {
      console.warn("getPlayerRankings: לא התקבלו משחקים מהשרת");
      return {
        bestSingleGameProfitList: [],
        cumulativeProfitList: [],
        winRateList: [],
        worstSingleGameLossList: [],
        rawData: new Map()
      };
    }
    
    // בדיקת תקינות המשחקים
    if (allGames.length > 0) {
      const sampleGame = allGames[0];
      console.log(`getPlayerRankings: דוגמה למשחק ראשון:`, {
        id: sampleGame.id,
        date: sampleGame.date,
        groupId: sampleGame.groupId,
        playersCount: sampleGame.players?.length || 0,
        hasPlayers: !!sampleGame.players && sampleGame.players.length > 0
      });
      
      // בדיקת שחקן ראשון במשחק ראשון
      if (sampleGame.players && sampleGame.players.length > 0) {
        const samplePlayer = sampleGame.players[0];
        console.log(`getPlayerRankings: דוגמה לשחקן ראשון במשחק ראשון:`, {
          userId: samplePlayer.userId,
          name: samplePlayer.name,
          finalResultMoney: samplePlayer.finalResultMoney
        });
      } else {
        console.warn("getPlayerRankings: המשחק הראשון לא מכיל שחקנים");
      }
    }
    
    // מסננים את המשחקים לפי הפילטר (זמן, קבוצה וכו')
    const filteredGames = filterGames(allGames, filter);
    console.log(`getPlayerRankings: לאחר סינון נשארו ${filteredGames.length} משחקים`);
    
    if (filteredGames.length === 0) {
      console.warn("getPlayerRankings: אין משחקים לאחר סינון - ננסה להשתמש בכל המשחקים במקום");
      // אם אין משחקים אחרי סינון, ננסה להשתמש בכל המשחקים במקום
      // זה יכול לעזור במצב שהפילטר מחמיר מדי
      if (allGames.length > 0) {
        console.log(`getPlayerRankings: מנסה להשתמש בכל ${allGames.length} המשחקים ללא סינון`);
        
        // בדיקה שכל המשחקים מכילים שחקנים
        const gamesWithPlayers = allGames.filter(game => 
          game.players && game.players.length > 0 && 
          game.players.some(player => player.userId && player.finalResultMoney !== undefined)
        );
        
        if (gamesWithPlayers.length > 0) {
          console.log(`getPlayerRankings: מצאנו ${gamesWithPlayers.length} משחקים עם שחקנים תקינים מתוך כל המשחקים`);
          
          // מפעילים את פונקציית איסוף הנתונים
          const playersStats = collectPlayerStatistics(gamesWithPlayers);
          
          if (playersStats.size > 0) {
            console.log(`getPlayerRankings: אספנו נתונים על ${playersStats.size} שחקנים - מחזיר תוצאות ללא סינון`);
            
            // מחזירים אובייקט עם כל הרשימות הממוינות
            return {
              bestSingleGameProfitList: getBestSingleGameProfitList(playersStats),
              cumulativeProfitList: getCumulativeProfitList(playersStats),
              winRateList: getWinRateList(playersStats),
              worstSingleGameLossList: getWorstSingleGameLossList(playersStats),
              rawData: playersStats
            };
          }
        }
      }
      
      console.warn("getPlayerRankings: גם ללא סינון לא נמצאו משחקים תקינים - מחזיר רשימות ריקות");
      return {
        bestSingleGameProfitList: [],
        cumulativeProfitList: [],
        winRateList: [],
        worstSingleGameLossList: [],
        rawData: new Map()
      };
    }
    
    // בדיקה שכל המשחקים מכילים שחקנים
    const gamesWithPlayers = filteredGames.filter(game => 
      game.players && game.players.length > 0 && 
      game.players.some(player => player.userId && player.finalResultMoney !== undefined)
    );
    
    if (gamesWithPlayers.length === 0) {
      console.warn("getPlayerRankings: אין משחקים עם שחקנים תקינים לאחר סינון - ננסה עם סינון פחות מחמיר");
      
      // ננסה שוב עם פילטר פחות מחמיר
      // למשל, אם היה סינון לפי קבוצה, ננסה בלי סינון קבוצה
      const relaxedFilter: StatisticsFilter = { timeFilter: 'all' };
      const relaxedFilteredGames = filterGames(allGames, relaxedFilter);
      console.log(`getPlayerRankings: לאחר סינון מקל נשארו ${relaxedFilteredGames.length} משחקים`);
      
      const relaxedGamesWithPlayers = relaxedFilteredGames.filter(game => 
        game.players && game.players.length > 0 && 
        game.players.some(player => player.userId && player.finalResultMoney !== undefined)
      );
      
      if (relaxedGamesWithPlayers.length > 0) {
        console.log(`getPlayerRankings: מצאנו ${relaxedGamesWithPlayers.length} משחקים עם שחקנים תקינים עם סינון פחות מחמיר`);
        
        // מפעילים את פונקציית איסוף הנתונים
        const playersStats = collectPlayerStatistics(relaxedGamesWithPlayers);
        
        if (playersStats.size > 0) {
          console.log(`getPlayerRankings: אספנו נתונים על ${playersStats.size} שחקנים - מחזיר תוצאות עם סינון פחות מחמיר`);
          
          // נציג הודעה למשתמש שהפילטר הוקל
          Toast.show({
            type: 'info',
            text1: 'לא נמצאו נתונים בפילטר שנבחר',
            text2: 'מציג את כל הנתונים הזמינים',
            position: 'bottom',
            visibilityTime: 3000,
          });
          
          // מחזירים אובייקט עם כל הרשימות הממוינות
          return {
            bestSingleGameProfitList: getBestSingleGameProfitList(playersStats),
            cumulativeProfitList: getCumulativeProfitList(playersStats),
            winRateList: getWinRateList(playersStats),
            worstSingleGameLossList: getWorstSingleGameLossList(playersStats),
            rawData: playersStats
          };
        }
      }
      
      return {
        bestSingleGameProfitList: [],
        cumulativeProfitList: [],
        winRateList: [],
        worstSingleGameLossList: [],
        rawData: new Map()
      };
    }
    
    console.log(`getPlayerRankings: ${gamesWithPlayers.length} משחקים תקינים עם שחקנים מתוך ${filteredGames.length} משחקים מסוננים`);
    
    // מפעילים את פונקציית איסוף הנתונים שכתבנו
    const playersStats = collectPlayerStatistics(gamesWithPlayers);
    
    // בדיקה אם יש מידע על שחקנים
    if (playersStats.size === 0) {
      console.warn("getPlayerRankings: לא נאספו נתוני שחקנים - מחזיר רשימות ריקות");
      return {
        bestSingleGameProfitList: [],
        cumulativeProfitList: [],
        winRateList: [],
        worstSingleGameLossList: [],
        rawData: new Map()
      };
    }
    
    // מחזירים אובייקט עם כל הרשימות הממוינות
    const results = {
      // רשימה 1: רווח הכי גבוה במשחק בודד
      bestSingleGameProfitList: getBestSingleGameProfitList(playersStats),
      
      // רשימה 2: רווח מצטבר
      cumulativeProfitList: getCumulativeProfitList(playersStats),
      
      // רשימה 3: אחוז ניצחונות
      winRateList: getWinRateList(playersStats),
      
      // רשימה 4: הפסד הכי גבוה במשחק בודד
      worstSingleGameLossList: getWorstSingleGameLossList(playersStats),
      
      // אוסף הנתונים הגולמיים (אם יהיה צורך)
      rawData: playersStats
    };
    
    // בדיקת תקינות הנתונים
    console.log(`getPlayerRankings: התקבלו הרשימות הבאות:
      bestSingleGameProfitList: ${results.bestSingleGameProfitList.length} שחקנים
      cumulativeProfitList: ${results.cumulativeProfitList.length} שחקנים
      winRateList: ${results.winRateList.length} שחקנים
      worstSingleGameLossList: ${results.worstSingleGameLossList.length} שחקנים
    `);
    
    if (results.bestSingleGameProfitList.length === 0) {
      console.warn("getPlayerRankings: רשימת רווח בודד ריקה!");
    }
    
    if (results.cumulativeProfitList.length === 0) {
      console.warn("getPlayerRankings: רשימת רווח מצטבר ריקה!");
    }
    
    return results;
  } catch (error) {
    console.error('Error fetching player rankings:', error);
    throw error;
  }
};

// פונקציית עזר להכנת פריטי רשימה לתצוגה
const prepareDisplayItems = (
  players: any[], 
  rankingType: 'single' | 'cumulative' | 'rate' | 'loss',
  formatCurrency: (amount: number) => string
) => {
  return players.map((player, index) => {
    let value = '';
    let subtitle = '';
    let valueColor = CASINO_COLORS.textSecondary;
    let prefix = '';
    
    switch (rankingType) {
      case 'single': // רווח הכי גבוה במשחק בודד
        value = formatCurrency(Math.abs(player.value));
        subtitle = `${player.gamesPlayed} משחקים, ${player.winRate?.toFixed(1) || ''}% אחוז ניצחון`;
        valueColor = player.value >= 0 ? CASINO_COLORS.success : CASINO_COLORS.error;
        prefix = player.value >= 0 ? '' : '-';
        break;
        
      case 'cumulative': // רווח מצטבר
        value = formatCurrency(Math.abs(player.value));
        subtitle = `${player.gamesPlayed} משחקים, ${player.winRate?.toFixed(1) || ''}% אחוז ניצחון`;
        valueColor = player.value >= 0 ? CASINO_COLORS.success : CASINO_COLORS.error;
        prefix = player.value >= 0 ? '' : '-';
        break;
        
      case 'rate': // אחוז ניצחונות
        value = `${player.value.toFixed(1)}%`;
        subtitle = `${player.gamesPlayed} משחקים, ${formatCurrency(Math.abs(player.cumulativeProfit || 0))} ${player.cumulativeProfit && player.cumulativeProfit >= 0 ? 'רווח' : 'הפסד'}`;
        valueColor = player.value > 50 ? CASINO_COLORS.success : 
                    (player.value > 30 ? CASINO_COLORS.warning : CASINO_COLORS.error);
        break;
        
      case 'loss': // הפסד הכי גבוה במשחק בודד
        value = formatCurrency(Math.abs(player.value));
        subtitle = `${player.gamesPlayed} משחקים, ${player.winRate?.toFixed(1) || ''}% אחוז ניצחון`;
        valueColor = CASINO_COLORS.error; // תמיד אדום כי מדובר בהפסד
        prefix = '-'; // תמיד שלילי
        break;
    }
    
    // יצירת מזהה ייחודי שמשלב את מזהה השחקן וסוג הדירוג
    // זה מבטיח שאותו שחקן המופיע במספר רשימות יקבל מזהה שונה בכל רשימה
    const uniqueId = `${player.id}-${rankingType}-${index}`;
    
    return {
      id: uniqueId, // שימוש במזהה ייחודי במקום מזהה השחקן המקורי
      title: player.name,
      value,
      subtitle,
      icon: index < 3 ? 
        (rankingType === 'loss' ? 
          (index === 0 ? 'emoticon-dead-outline' : (index === 1 ? 'emoticon-sad-outline' : 'emoticon-neutral-outline')) 
          : (index === 0 ? 'trophy' : (index === 1 ? 'medal' : 'podium'))) 
        : undefined,
      valueColor,
      prefix
    };
  });
};

export default function WinnersLosersStatisticsScreen() {
  const router = useRouter();
  
  // הוקים לגישה לנתונים
  const { groups, loading: groupsLoading } = useGroups();
  
  // State
  const [activeTab, setActiveTab] = useState<TABS>(TABS.GENERAL);
  const [showWinners, setShowWinners] = useState(true);
  const [timeFilter, setTimeFilter] = useState<string>('all');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [stats, setStats] = useState<WinnersLosersStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playerRankings, setPlayerRankings] = useState<PlayerRankings | null>(null);
  const [rankingType, setRankingType] = useState<RankingType>('cumulative');
  const [localLoading, setLocalLoading] = useState(false);
  const [groupOptions, setGroupOptions] = useState<{ label: string, value: string }[]>([]);
  
  // Time filter options
  const timeFilterOptions = [
    { label: 'כל הזמנים', value: 'all' },
    { label: 'חודש אחרון', value: 'month' },
    { label: 'רבעון אחרון', value: 'quarter' },
    { label: 'שנה אחרונה', value: 'year' }
  ];
  
  // יצירת אפשרויות הקבוצה מהנתונים שהתקבלו מההוק
  useEffect(() => {
    if (groups && groups.length > 0) {
      const options = [
        { label: 'כל הקבוצות', value: 'all' },
        ...groups.map(group => ({
          label: group.name,
          value: group.id
        }))
      ];
      setGroupOptions(options);
    }
  }, [groups]);
  
  // טעינת הנתונים כאשר משתנים הפילטרים
  useEffect(() => {
    if (!groupsLoading) {
      loadData();
    }
  }, [timeFilter, groupFilter, groupsLoading]);
  
  // טעינת הנתונים לפי סינון
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('WinnersLosersScreen: מנקה מטמון ומרענן נתונים');
      clearStatsCache();
      await syncService.forceRefresh();
      
      // יצירת אובייקט הסינון עם הערכים הנוכחיים
      const filter: StatisticsFilter = {
        timeFilter: timeFilter as 'all' | 'month' | 'quarter' | 'year',
        groupId: groupFilter !== 'all' ? groupFilter : undefined,
        statuses: ['completed', 'final_results']
      };
      
      console.log('WinnersLosersScreen: מבקש סטטיסטיקות מנצחים ומפסידים עם פילטר:', filter);
      
      // קבלת הנתונים מהשירות עם מגבלה של 15 תוצאות
      const limit = 15;
      const winnersLosersData = await getWinnersLosersStatistics(limit, filter);
      setStats(winnersLosersData);
      
      console.log('WinnersLosersScreen: התקבלו נתוני מנצחים ומפסידים בהצלחה');
    } catch (error) {
      console.error('שגיאה בטעינת סטטיסטיקות מנצחים ומפסידים:', error);
      setError('שגיאה בטעינת הנתונים. נסה שוב.');
    } finally {
      setLoading(false);
    }
  };
  
  // פונקציית רענון
  const handleRefresh = () => {
    loadData();
  };
  
  // חזרה למסך הסטטיסטיקה הראשי
  const handleBack = () => {
    router.back();
  };
  
  // טאבים לקומפוננטה
  const tabsConfig = [
    {
      label: 'כללי',
      isActive: activeTab === TABS.GENERAL,
      onPress: () => setActiveTab(TABS.GENERAL)
    },
    {
      label: 'דירוג',
      isActive: activeTab === TABS.RANKING,
      onPress: () => setActiveTab(TABS.RANKING)
    },
    {
      label: 'שיאנים',
      isActive: activeTab === TABS.CHAMPIONS,
      onPress: () => setActiveTab(TABS.CHAMPIONS)
    }
  ];
  
  // רנדור טאב כללי
  const renderGeneralTab = () => {
    return (
      <>
        {/* Toggle Tab for Winners/Losers */}
        <Card style={styles.toggleCard}>
          <View style={styles.toggleContainer}>
            <TouchableOpacity 
              style={[
                styles.toggleButton, 
                showWinners && styles.toggleButtonActive
              ]}
              onPress={() => setShowWinners(true)}
            >
              <Text style={[
                styles.toggleText,
                showWinners && styles.toggleTextActive
              ]}>
                מנצחים
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.toggleButton, 
                !showWinners && styles.toggleButtonActive
              ]}
              onPress={() => setShowWinners(false)}
            >
              <Text style={[
                styles.toggleText,
                !showWinners && styles.toggleTextActive
              ]}>
                מפסידים
              </Text>
            </TouchableOpacity>
          </View>
          
          {/* Visualization Charts */}
          {showWinners ? (
            stats && stats.topWinners.length > 0 ? (
              <View style={styles.chartContainer}>
                <Text style={styles.chartTitle}>רווח מצטבר למנצחים המובילים</Text>
                <StatisticsChart
                  type="bar"
                  data={{
                    labels: stats.topWinners.slice(0, 7).map(winner => winner.playerName),
                    datasets: [{
                      data: stats.topWinners.slice(0, 7).map(winner => winner.netProfit),
                      colors: [CASINO_COLORS.success]
                    }]
                  }}
                  yAxisSuffix=" ₪"
                  height={220}
                  formatYLabel={(value) => {
                    const num = parseInt(value);
                    if (num >= 1000) {
                      return (num / 1000).toFixed(0) + 'K';
                    }
                    return value;
                  }}
                />
              </View>
            ) : (
              <Text style={styles.noDataText}>אין נתונים זמינים</Text>
            )
          ) : (
            stats && stats.topLosers.length > 0 ? (
              <View style={styles.chartContainer}>
                <Text style={styles.chartTitle}>הפסד מצטבר למפסידים המובילים</Text>
                <StatisticsChart
                  type="bar"
                  data={{
                    labels: stats.topLosers.slice(0, 7).map(loser => loser.playerName),
                    datasets: [{
                      data: stats.topLosers.slice(0, 7).map(loser => loser.netLoss),
                      colors: [CASINO_COLORS.error]
                    }]
                  }}
                  yAxisSuffix=" ₪"
                  height={220}
                  formatYLabel={(value) => {
                    const num = parseInt(value);
                    if (num >= 1000) {
                      return (num / 1000).toFixed(0) + 'K';
                    }
                    return value;
                  }}
                />
              </View>
            ) : (
              <Text style={styles.noDataText}>אין נתונים זמינים</Text>
            )
          )}
        </Card>
        
        {/* Win Rate / Loss Rate Distribution */}
        {stats && (
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>
              {showWinners ? "התפלגות שיעור ניצחון" : "התפלגות שיעור הפסד"}
            </Text>
            
            <StatisticsChart
              type="pie"
              data={{
                labels: showWinners 
                  ? stats.topWinners.slice(0, 5).map(winner => winner.playerName)
                  : stats.topLosers.slice(0, 5).map(loser => loser.playerName),
                datasets: [{
                  data: showWinners
                    ? stats.topWinners.slice(0, 5).map(winner => winner.winRate)
                    : stats.topLosers.slice(0, 5).map(loser => loser.lossRate),
                  colors: showWinners
                    ? [
                        'rgba(34, 197, 94, 0.9)',
                        'rgba(34, 197, 94, 0.8)',
                        'rgba(34, 197, 94, 0.7)',
                        'rgba(34, 197, 94, 0.6)',
                        'rgba(34, 197, 94, 0.5)'
                      ]
                    : [
                        'rgba(239, 68, 68, 0.9)',
                        'rgba(239, 68, 68, 0.8)',
                        'rgba(239, 68, 68, 0.7)',
                        'rgba(239, 68, 68, 0.6)',
                        'rgba(239, 68, 68, 0.5)'
                      ]
                }]
              }}
              height={240}
            />
            
            <Text style={styles.chartSubtitle}>5 השחקנים המובילים</Text>
          </Card>
        )}
        
        {/* Performance Metrics */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>מדדי ביצוע</Text>
          
          <View style={styles.metricsContainer}>
            {showWinners && stats?.topWinners.length ? (
              <>
                <StatCard
                  title="רווח גבוה ביותר"
                  value={stats.topWinners[0].netProfit}
                  icon="trending-up"
                  format="currency"
                  valueColor={CASINO_COLORS.success}
                  size="medium"
                  style={styles.metricCard}
                />
                
                <StatCard
                  title="שיעור ניצחון ממוצע"
                  value={stats.topWinners.reduce((sum, w) => sum + w.winRate, 0) / stats.topWinners.length}
                  icon="percent"
                  format="percentage"
                  valueColor={CASINO_COLORS.gold}
                  size="medium"
                  style={styles.metricCard}
                />
                
                <StatCard
                  title="סך הכל רווחים"
                  value={stats.topWinners.reduce((sum, w) => sum + w.netProfit, 0)}
                  icon="cash-multiple"
                  format="currency"
                  valueColor={CASINO_COLORS.success}
                  size="medium"
                  style={styles.metricCard}
                />
              </>
            ) : !showWinners && stats?.topLosers.length ? (
              <>
                <StatCard
                  title="הפסד גבוה ביותר"
                  value={stats.topLosers[0].netLoss}
                  icon="trending-down"
                  format="currency"
                  valueColor={CASINO_COLORS.error}
                  size="medium"
                  style={styles.metricCard}
                />
                
                <StatCard
                  title="שיעור הפסד ממוצע"
                  value={stats.topLosers.reduce((sum, l) => sum + l.lossRate, 0) / stats.topLosers.length}
                  icon="percent"
                  format="percentage"
                  valueColor={CASINO_COLORS.gold}
                  size="medium"
                  style={styles.metricCard}
                />
                
                <StatCard
                  title="סך הכל הפסדים"
                  value={stats.topLosers.reduce((sum, l) => sum + l.netLoss, 0)}
                  icon="cash-minus"
                  format="currency"
                  valueColor={CASINO_COLORS.error}
                  size="medium"
                  style={styles.metricCard}
                />
              </>
            ) : (
              <Text style={styles.noDataText}>אין נתונים זמינים</Text>
            )}
          </View>
        </Card>
      </>
    );
  };
  
  // רנדור טאב דירוג
  const renderRankingTab = () => {
    // הפונקציה לשינוי סוג הדירוג
    const handleRankingTypeChange = (newType: 'single' | 'cumulative' | 'rate' | 'loss') => {
      setLocalLoading(true);
      setRankingType(newType);
      // מדמה טעינה קצרה לרענון התצוגה
      setTimeout(() => {
        setLocalLoading(false);
      }, 300);
    };
    
    if (!playerRankings) {
      console.log("renderRankingTab: playerRankings הוא null");
      return (
        <Card style={styles.rankingCard}>
          <View style={styles.emptyStateContainer}>
            <Icon name="alert-circle" size="large" color={CASINO_COLORS.gold} />
            <Text style={styles.noDataText}>אין נתונים זמינים</Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => {
                setLoading(true);
                // קורא לפונקציה שטוענת את הנתונים מחדש
                const loadData = async () => {
                  try {
                    const filter: StatisticsFilter = {
                      timeFilter: timeFilter as any,
                      groupId: groupFilter !== 'all' ? groupFilter : undefined
                    };
                    
                    // מבקש לדלג על ה-cache ולטעון מהשרת
                    const allGames = await fetchAllGames(true);
                    const filteredGames = filterGames(allGames, filter);
                    const playersStats = collectPlayerStatistics(filteredGames);
                    
                    // עדכון הדירוגים עם הנתונים החדשים
                    const rankings = {
                      bestSingleGameProfitList: getBestSingleGameProfitList(playersStats),
                      cumulativeProfitList: getCumulativeProfitList(playersStats),
                      winRateList: getWinRateList(playersStats),
                      worstSingleGameLossList: getWorstSingleGameLossList(playersStats),
                      rawData: playersStats
                    };
                    
                    setPlayerRankings(rankings);
                    
                    // הודעה למשתמש
                    Toast.show({
                      type: 'success',
                      text1: 'הנתונים נטענו בהצלחה',
                      position: 'bottom',
                      visibilityTime: 2000,
                    });
                    
                  } catch (error) {
                    console.error('Error loading player rankings:', error);
                    setError('טעינת הנתונים נכשלה. אנא נסה שוב.');
                    
                    // הודעת שגיאה למשתמש
                    Toast.show({
                      type: 'error',
                      text1: 'שגיאה בטעינת הנתונים',
                      text2: 'אנא נסה שוב מאוחר יותר',
                      position: 'bottom',
                      visibilityTime: 3000,
                    });
                  } finally {
                    setLoading(false);
                  }
                };
                
                loadData();
              }}
            >
              <Text style={styles.retryButtonText}>טען נתונים</Text>
            </TouchableOpacity>
          </View>
        </Card>
      );
    }
    
    console.log("renderRankingTab: התקבלו נתוני דירוג", {
      bestSingleGameProfitList: playerRankings.bestSingleGameProfitList.length,
      cumulativeProfitList: playerRankings.cumulativeProfitList.length,
      winRateList: playerRankings.winRateList.length,
      worstSingleGameLossList: playerRankings.worstSingleGameLossList.length
    });
    
    // בדיקה: האם יש נתונים ברשימות?
    if (playerRankings.cumulativeProfitList.length === 0 &&
        playerRankings.bestSingleGameProfitList.length === 0 &&
        playerRankings.winRateList.length === 0 &&
        playerRankings.worstSingleGameLossList.length === 0) {
      console.error("renderRankingTab: כל הרשימות ריקות!");
      return (
        <Card style={styles.rankingCard}>
          <View style={styles.emptyStateContainer}>
            <Icon name="alert-circle" size="large" color={CASINO_COLORS.gold} />
            <Text style={styles.noDataText}>אין נתונים זמינים. יתכן שהפילטרים שבחרת לא מחזירים תוצאות.</Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => {
                setLoading(true);
                // קורא לפונקציה שטוענת את הנתונים מחדש
                const loadData = async () => {
                  try {
                    const filter: StatisticsFilter = {
                      timeFilter: timeFilter as any,
                      groupId: groupFilter !== 'all' ? groupFilter : undefined
                    };
                    
                    // מבקש לדלג על ה-cache ולטעון מהשרת
                    const allGames = await fetchAllGames(true);
                    const filteredGames = filterGames(allGames, filter);
                    const playersStats = collectPlayerStatistics(filteredGames);
                    
                    // עדכון הדירוגים עם הנתונים החדשים
                    const rankings = {
                      bestSingleGameProfitList: getBestSingleGameProfitList(playersStats),
                      cumulativeProfitList: getCumulativeProfitList(playersStats),
                      winRateList: getWinRateList(playersStats),
                      worstSingleGameLossList: getWorstSingleGameLossList(playersStats),
                      rawData: playersStats
                    };
                    
                    setPlayerRankings(rankings);
                    
                    // עדכון גם את הנתונים הישנים
                    const winnersLosersStats = await getWinnersLosersStatistics(15, filter);
                    setStats(winnersLosersStats);
                    
                    // הודעה למשתמש
                    Toast.show({
                      type: 'success',
                      text1: 'הנתונים עודכנו בהצלחה',
                      position: 'bottom',
                      visibilityTime: 2000,
                    });
                    
                  } catch (error) {
                    console.error('Error refreshing data:', error);
                    setError('טעינת הנתונים נכשלה. אנא נסה שוב.');
                    
                    // הודעת שגיאה למשתמש
                    Toast.show({
                      type: 'error',
                      text1: 'שגיאה בטעינת הנתונים',
                      text2: 'אנא נסה שוב מאוחר יותר',
                      position: 'bottom',
                      visibilityTime: 3000,
                    });
                  } finally {
                    setLoading(false);
                  }
                };
                
                loadData();
              }}
            >
              <Text style={styles.retryButtonText}>נסה לטעון מחדש</Text>
            </TouchableOpacity>
          </View>
        </Card>
      );
    }
    
    // בחירת הרשימה המתאימה לפי סוג הדירוג שנבחר
    let playersList: any[] = [];
    switch (rankingType) {
      case 'single':
        playersList = playerRankings.bestSingleGameProfitList;
        break;
      case 'cumulative':
        playersList = playerRankings.cumulativeProfitList;
        break;
      case 'rate':
        playersList = playerRankings.winRateList;
        break;
      case 'loss':
        playersList = playerRankings.worstSingleGameLossList;
        break;
    }
    
    console.log(`renderRankingTab: נבחרה רשימת ${rankingType} עם ${playersList.length} שחקנים`);
    console.log("renderRankingTab: דוגמאות לשחקנים ברשימה:", playersList.slice(0, 3));
    
    // בדיקת ID כפולים
    const ids = playersList.map(player => player.id);
    const hasDuplicateIds = ids.length !== new Set(ids).size;
    if (hasDuplicateIds) {
      console.error("נמצאו מזהים כפולים ברשימת השחקנים!", ids);
    }
    
    // הכנת הפריטים לתצוגה
    const displayItems = prepareDisplayItems(playersList, rankingType, formatCurrency);
    
    console.log(`renderRankingTab: הוכנו ${displayItems.length} פריטי תצוגה`);
    
    // אם אין פריטים בכלל, מציג הודעה מתאימה
    if (displayItems.length === 0) {
      return (
        <Card style={styles.rankingCard}>
          <Text style={styles.noDataText}>אין נתונים זמינים לסוג דירוג זה.</Text>
        </Card>
      );
    }
    
    // בדיקת תקינות הפריטים
    if (displayItems.length > 0) {
      console.log(`renderRankingTab: דוגמה לפריט ראשון:`, {
        id: displayItems[0].id,
        title: displayItems[0].title,
        value: displayItems[0].value,
        subtitle: displayItems[0].subtitle,
        icon: displayItems[0].icon,
        valueColor: displayItems[0].valueColor,
        prefix: displayItems[0].prefix
      });
    }
    
    // התאמת הכותרת לפי סוג הדירוג
    const getRankingTitle = () => {
      switch (rankingType) {
        case 'single':
          return 'דירוג - רווח במשחק בודד';
        case 'cumulative':
          return 'דירוג - רווח מצטבר';
        case 'rate':
          return 'דירוג - אחוז ניצחון';
        case 'loss':
          return 'דירוג - הפסד במשחק בודד';
        default:
          return 'דירוג כולל';
      }
    };
    
    return (
      <Card style={styles.rankingCard}>
        <View style={styles.rankingHeader}>
          <Icon 
            name="trophy" 
            size="medium" 
            color={CASINO_COLORS.gold} 
          />
          <Text style={styles.rankingTitle}>
            {getRankingTitle()}
          </Text>
          <TouchableOpacity 
            style={styles.refreshButton}
            onPress={() => {
              setLoading(true);
              // רוטציה פשוטה לאיקון בזמן טעינה 
              const rotationAnimation = new Animated.Value(0);
              Animated.timing(rotationAnimation, {
                toValue: 1,
                duration: 1000,
                useNativeDriver: true,
                easing: Easing.linear
              }).start();
              
              const spin = rotationAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', '360deg']
              });
              
              // קורא לפונקציה שטוענת את הנתונים מחדש
              const loadData = async () => {
                try {
                  const filter: StatisticsFilter = {
                    timeFilter: timeFilter as any,
                    groupId: groupFilter !== 'all' ? groupFilter : undefined
                  };
                  
                  // מבקש לדלג על ה-cache ולטעון מהשרת
                  const allGames = await fetchAllGames(true);
                  const filteredGames = filterGames(allGames, filter);
                  const playersStats = collectPlayerStatistics(filteredGames);
                  
                  // עדכון הדירוגים עם הנתונים החדשים
                  const rankings = {
                    bestSingleGameProfitList: getBestSingleGameProfitList(playersStats),
                    cumulativeProfitList: getCumulativeProfitList(playersStats),
                    winRateList: getWinRateList(playersStats),
                    worstSingleGameLossList: getWorstSingleGameLossList(playersStats),
                    rawData: playersStats
                  };
                  
                  setPlayerRankings(rankings);
                  
                  // עדכון גם את הנתונים הישנים
                  const winnersLosersStats = await getWinnersLosersStatistics(15, filter);
                  setStats(winnersLosersStats);
                  
                  // הודעה למשתמש
                  Toast.show({
                    type: 'success',
                    text1: 'הנתונים עודכנו בהצלחה',
                    position: 'bottom',
                    visibilityTime: 2000,
                  });
                  
                } catch (error) {
                  console.error('Error refreshing data:', error);
                  setError('טעינת הנתונים נכשלה. אנא נסה שוב.');
                  
                  // הודעת שגיאה למשתמש
                  Toast.show({
                    type: 'error',
                    text1: 'שגיאה בטעינת הנתונים',
                    text2: 'אנא נסה שוב מאוחר יותר',
                    position: 'bottom',
                    visibilityTime: 3000,
                  });
                } finally {
                  setLoading(false);
                }
              };
              
              loadData();
            }}
          >
            <Animated.View style={{ transform: [{ rotate: loading ? '360deg' : '0deg' }] }}>
              <Icon
                name="refresh"
                size="small"
                color={CASINO_COLORS.gold}
              />
            </Animated.View>
          </TouchableOpacity>
        </View>
        
        {/* כפתורי סינון */}
        <View style={styles.toggleContainer}>
          <TouchableOpacity 
            style={[
              styles.toggleButton, 
              rankingType === 'cumulative' && styles.toggleButtonActive
            ]}
            onPress={() => handleRankingTypeChange('cumulative')}
            disabled={localLoading}
          >
            <Text style={[
              styles.toggleText,
              rankingType === 'cumulative' && styles.toggleTextActive
            ]}>
              רווח מצטבר
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.toggleButton, 
              rankingType === 'single' && styles.toggleButtonActive
            ]}
            onPress={() => handleRankingTypeChange('single')}
            disabled={localLoading}
          >
            <Text style={[
              styles.toggleText,
              rankingType === 'single' && styles.toggleTextActive
            ]}>
              משחק בודד
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.toggleButton, 
              rankingType === 'rate' && styles.toggleButtonActive
            ]}
            onPress={() => handleRankingTypeChange('rate')}
            disabled={localLoading}
          >
            <Text style={[
              styles.toggleText,
              rankingType === 'rate' && styles.toggleTextActive
            ]}>
              אחוז ניצחון
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.toggleButton, 
              rankingType === 'loss' && styles.toggleButtonActive
            ]}
            onPress={() => handleRankingTypeChange('loss')}
            disabled={localLoading}
          >
            <Text style={[
              styles.toggleText,
              rankingType === 'loss' && styles.toggleTextActive
            ]}>
              הפסד גדול
            </Text>
          </TouchableOpacity>
        </View>
        
        {localLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={CASINO_COLORS.gold} />
            <Text style={styles.loadingText}>טוען נתונים...</Text>
          </View>
        ) : playersList.length > 0 ? (
          <StatisticsList
            items={displayItems}
            showRank={true}
            showDividers={true}
            emptyMessage="אין נתונים זמינים לסוג דירוג זה"
            alignRight={true}
            highlightTop={3}
            title={`${getRankingTitle()} (${displayItems.length} שחקנים)`}
          />
        ) : (
          <Text style={styles.noDataText}>אין נתונים זמינים</Text>
        )}
      </Card>
    );
  };
  
  // רנדור טאב שיאנים
  const renderChampionsTab = () => {
    return (
      <Card style={styles.recordsCard}>
        <View style={styles.recordsHeader}>
          <View style={styles.recordSection}>
            <Text style={styles.recordTitle}>הזכייה הגדולה ביותר</Text>
            {stats?.biggestWin ? (
              <View style={styles.recordContent}>
                <StatCard 
                  title={stats.biggestWin.playerName}
                  value={stats.biggestWin.amount}
                  icon="trophy"
                  format="currency"
                  valueColor={CASINO_COLORS.success}
                  size="medium"
                  style={styles.recordStatCard}
                />
                <Text style={styles.recordDate}>{stats.biggestWin.date}</Text>
                <TouchableOpacity 
                  style={styles.viewGameButton}
                  onPress={() => router.push(`/history/${stats.biggestWin.gameId}`)}
                >
                  <Text style={styles.viewGameText}>צפה במשחק</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.noDataText}>אין נתונים זמינים</Text>
            )}
          </View>
          
          <View style={[styles.recordSection, styles.recordSectionDivider]}>
            <Text style={styles.recordTitle}>ההפסד הגדול ביותר</Text>
            {stats?.biggestLoss ? (
              <View style={styles.recordContent}>
                <StatCard 
                  title={stats.biggestLoss.playerName}
                  value={stats.biggestLoss.amount}
                  icon="emoticon-sad-outline"
                  format="currency"
                  valueColor={CASINO_COLORS.error}
                  size="medium"
                  style={styles.recordStatCard}
                />
                <Text style={styles.recordDate}>{stats.biggestLoss.date}</Text>
                <TouchableOpacity 
                  style={styles.viewGameButton}
                  onPress={() => router.push(`/history/${stats.biggestLoss.gameId}`)}
                >
                  <Text style={styles.viewGameText}>צפה במשחק</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.noDataText}>אין נתונים זמינים</Text>
            )}
          </View>
        </View>
      </Card>
    );
  };
  
  // רנדור התוכן לפי טאב נבחר
  const renderTabContent = () => {
    switch (activeTab) {
      case TABS.GENERAL:
        return renderGeneralTab();
      case TABS.RANKING:
        return renderRankingTab();
      case TABS.CHAMPIONS:
        return renderChampionsTab();
      default:
        return renderGeneralTab();
    }
  };
  
  return (
    <View style={styles.container}>
      {/* כותרת עם אפשרות חזרה */}
      <HeaderBar
        title="מנצחים ומפסידים"
        onBack={() => router.back()}
        backgroundColor={CASINO_COLORS.primary}
      />
      
      {/* פילטרים */}
      <View style={styles.filtersContainer}>
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>קבוצה:</Text>
          <View style={styles.filterDropdown}>
            <Dropdown
              value={groupFilter}
              onSelect={setGroupFilter}
              items={groupOptions}
            />
          </View>
        </View>
        
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>תקופה:</Text>
          <View style={styles.filterDropdown}>
            <Dropdown
              value={timeFilter}
              onSelect={setTimeFilter}
              items={timeFilterOptions}
            />
          </View>
          
          {/* כפתור רענון */}
          <TouchableOpacity 
            style={styles.refreshButton}
            onPress={loadData}
            disabled={loading}
          >
            <Icon name="refresh" size="medium" color={CASINO_COLORS.gold} />
          </TouchableOpacity>
        </View>
      </View>
      
      {/* המשך הרנדור הקיים */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={CASINO_COLORS.gold} />
          <Text style={styles.loadingText}>טוען סטטיסטיקות...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Icon name="alert-circle" size="large" color={CASINO_COLORS.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollView}>
          {renderTabContent()}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CASINO_COLORS.background,
  },
  header: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: CASINO_COLORS.primary,
    padding: 16,
    borderBottomWidth: 2,
    borderBottomColor: CASINO_COLORS.gold,
  },
  headerTitle: {
    color: CASINO_COLORS.gold,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: 'bold',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filtersContainer: {
    backgroundColor: CASINO_COLORS.surface,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: CASINO_COLORS.gold,
  },
  filterRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 12,
  },
  filterLabel: {
    color: CASINO_COLORS.gold,
    width: 80,
    textAlign: 'right',
    marginLeft: 12,
  },
  filterControl: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: CASINO_COLORS.gold,
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: CASINO_COLORS.error,
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  recordsCard: {
    backgroundColor: CASINO_COLORS.surface,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: CASINO_COLORS.gold,
  },
  recordsHeader: {
    flexDirection: 'column',
  },
  recordSection: {
    marginBottom: 16,
  },
  recordSectionDivider: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 215, 0, 0.2)',
    paddingTop: 16,
  },
  recordTitle: {
    color: CASINO_COLORS.gold,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'right',
  },
  recordContent: {
    alignItems: 'center',
  },
  recordStatCard: {
    marginBottom: 8,
  },
  recordDate: {
    color: CASINO_COLORS.textSecondary,
    marginBottom: 12,
  },
  viewGameButton: {
    backgroundColor: CASINO_COLORS.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: CASINO_COLORS.gold,
    width: '100%',
  },
  viewGameText: {
    color: CASINO_COLORS.gold,
    fontSize: 14,
    fontWeight: 'bold',
  },
  toggleCard: {
    backgroundColor: CASINO_COLORS.surface,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: CASINO_COLORS.gold,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 8,
    marginBottom: 16,
    overflow: 'hidden',
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: CASINO_COLORS.primary,
  },
  toggleText: {
    color: CASINO_COLORS.textSecondary,
    fontWeight: 'bold',
  },
  toggleTextActive: {
    color: CASINO_COLORS.gold,
  },
  chartContainer: {
    marginBottom: 8,
  },
  chartTitle: {
    color: CASINO_COLORS.gold,
    textAlign: 'center',
    marginBottom: 12,
    fontSize: 16,
  },
  chartSubtitle: {
    color: CASINO_COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  rankingCard: {
    margin: 10,
    borderRadius: 10,
    backgroundColor: CASINO_COLORS.surface, // שינוי cardBackground ל-surface
  },
  rankingHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 16,
  },
  rankingTitle: {
    color: CASINO_COLORS.gold,
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
    borderWidth: 1,
    borderColor: CASINO_COLORS.gold,
  },
  card: {
    backgroundColor: CASINO_COLORS.surface,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: CASINO_COLORS.gold,
  },
  cardTitle: {
    color: CASINO_COLORS.gold,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  metricsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  metricCard: {
    width: '48%',
    marginBottom: 16,
  },
  noDataText: {
    color: CASINO_COLORS.textSecondary,
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 10,
  },
  emptyStateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  retryButton: {
    backgroundColor: CASINO_COLORS.gold,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 15,
  },
  retryButtonText: {
    color: CASINO_COLORS.background,
    fontWeight: 'bold',
    fontSize: 14,
  },
  tab: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
    backgroundColor: CASINO_COLORS.surface,
    borderRadius: 10,
    marginHorizontal: 10,
    marginTop: 10,
  },
  tabButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 5,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: CASINO_COLORS.gold,
  },
  tabText: {
    color: CASINO_COLORS.text,
    fontWeight: 'bold',
  },
  activeTabText: {
    color: CASINO_COLORS.background,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    color: CASINO_COLORS.textSecondary,
    fontSize: 16,
  },
  noDataText: {
    color: CASINO_COLORS.textSecondary,
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 10,
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  retryButton: {
    backgroundColor: CASINO_COLORS.gold,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 5,
    marginTop: 15,
  },
  retryButtonText: {
    color: CASINO_COLORS.background,
    fontWeight: 'bold',
    fontSize: 14,
  },
});