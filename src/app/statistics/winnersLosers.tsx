// src/app/statistics/winnersLosers.tsx

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { View, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, Animated, Easing } from 'react-native';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
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
import { store } from '@/store/AppStore';

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
const collectPlayerStatistics = (games: Game[], filter?: StatisticsFilter) => {
  console.log(`collectPlayerStatistics: מתחיל עיבוד של ${games.length} משחקים עם פילטר:`, filter);
  
  // קבלת השחקנים הקבועים של הקבוצה אם יש סינון לפי קבוצה
  let permanentPlayersInGroup: Set<string> | null = null;
  if (filter?.groupId && filter.groupId !== 'all') {
    const group = store.getGroup(filter.groupId);
    if (group && group.permanentPlayers) {
      permanentPlayersInGroup = new Set(group.permanentPlayers);
      console.log(`collectPlayerStatistics: מסנן לפי קבוצה ${group.name}, שחקנים קבועים: ${group.permanentPlayers.length}`);
    }
  }
  
  // יצירת מפה לשמירת סטטיסטיקות עבור כל שחקן
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
  let filteredOutPlayersCount = 0;
  
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
      
      // סינון שחקנים קבועים אם יש סינון לפי קבוצה
      if (permanentPlayersInGroup && !permanentPlayersInGroup.has(playerId)) {
        filteredOutPlayersCount++;
        return; // דלג על שחקן זה כי הוא לא שחקן קבוע בקבוצה
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
          bestSingleGameProfit: -Infinity,  // שינוי מ-0 ל-Infinity שלילי
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
        if (finalResult < playerStats.worstSingleGameLoss) {
          playerStats.worstSingleGameLoss = finalResult;
          playerStats.worstGameDetails = {
            gameId,
            date: gameDate
          };
        }
        
        // עדכון bestSingleGameProfit אם זה המשחק הראשון או אם זה התוצאה הטובה ביותר עד כה
        if (playerStats.bestSingleGameProfit === -Infinity || finalResult > playerStats.bestSingleGameProfit) {
          playerStats.bestSingleGameProfit = finalResult;
          playerStats.bestGameDetails = {
            gameId,
            date: gameDate
          };
        }
      } else {
        // אם התוצאה היא 0 ועדיין לא ראינו אף משחק, נעדכן את bestSingleGameProfit
        if (playerStats.bestSingleGameProfit === -Infinity) {
          playerStats.bestSingleGameProfit = 0;
          playerStats.bestGameDetails = {
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

  console.log(`collectPlayerStatistics: סיום עיבוד עם ${playersStats.size} שחקנים שונים מתוך ${validGamesCount} משחקים תקינים (דילוג על ${invalidPlayersCount} שחקנים לא תקינים${filteredOutPlayersCount > 0 ? `, סינון ${filteredOutPlayersCount} שחקני אורח` : ''})`);
  
  // לוג של מספר שחקנים לפי קריטריונים שונים
  let winnersCount = 0;
  let losersCount = 0;
  let neutralCount = 0;
  
  playersStats.forEach(player => {
    if (player.cumulativeProfit > 0) winnersCount++;
    else if (player.cumulativeProfit < 0) losersCount++;
    else neutralCount++;
  });
  
  console.log(`collectPlayerStatistics: סטטיסטיקה: ${winnersCount} מנצחים, ${losersCount} מפסידים, ${neutralCount} נייטרליים`);
  
  return playersStats;
};

// פונקציה 1: רשימה ממוינת לפי רווח הכי גבוה במשחק בודד (מהגבוה לנמוך)
const getBestSingleGameProfitList = (playersStats: Map<string, any>) => {
  console.log(`getBestSingleGameProfitList: נקראה עם ${playersStats.size} שחקנים`);
  
  const result = Array.from(playersStats.values())
    // מיון לפי הערך האמיתי של הרווח/הפסד במשחק בודד (מהגבוה לנמוך)
    .sort((a, b) => b.bestSingleGameProfit - a.bestSingleGameProfit)
    .map(player => ({
      id: player.id,
      name: player.name,
      value: player.bestSingleGameProfit,
      gamesPlayed: player.gamesPlayed,
      winRate: player.winRate,
      gameDetails: player.bestGameDetails,
      isPositive: player.bestSingleGameProfit >= 0
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
          const playersStats = collectPlayerStatistics(gamesWithPlayers, filter);
          
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
        const playersStats = collectPlayerStatistics(relaxedGamesWithPlayers, filter);
        
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
    const playersStats = collectPlayerStatistics(gamesWithPlayers, filter);
    
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
  const [stats, setStats] = useState<WinnersLosersStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [rankingType, setRankingType] = useState<'profits' | 'winningGames'>('profits');
  const [profitRankingType, setProfitRankingType] = useState<'single' | 'cumulative'>('single');
  const [winningGamesRankingType, setWinningGamesRankingType] = useState<'count' | 'percentage'>('count');
  const [groupOptions, setGroupOptions] = useState<{ label: string, value: string }[]>([]);
  
  // אפשרויות פילטר זמן
  const timeFilterOptions = [
    { label: 'כל הזמנים', value: 'all' },
    { label: 'חודש אחרון', value: 'month' },
    { label: 'רבעון אחרון', value: 'quarter' },
    { label: 'שנה אחרונה', value: 'year' }
  ];
  
  // טעינת הנתונים לפי סינון
  const loadData = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('WinnersLosersScreen: טוען סטטיסטיקות מנצחים ומפסידים');
      
      if (forceRefresh) {
        console.log('WinnersLosersScreen: ביצוע רענון מאולץ - מנקה מטמון');
        clearStatsCache();
        await syncService.forceRefresh();
      }
      
      console.log('WinnersLosersScreen: מבקש סטטיסטיקות מנצחים ומפסידים עם פילטר:', {
        groupId: groupFilter === 'all' ? undefined : groupFilter,
        timeFilter
      });
      
      const data = await getWinnersLosersStatistics(undefined, {
        timeFilter: timeFilter as 'all' | 'month' | 'quarter' | 'year',
        groupId: groupFilter === 'all' ? undefined : groupFilter
      });
      
      setStats(data);
      console.log('WinnersLosersScreen: התקבלו נתוני מנצחים ומפסידים בהצלחה');
    } catch (err) {
      console.error('WinnersLosersScreen: שגיאה בטעינת נתוני מנצחים ומפסידים:', err);
      setError('אירעה שגיאה בטעינת הנתונים');
    } finally {
      setLoading(false);
    }
  }, [timeFilter, groupFilter]);

  // טעינת אפשרויות הקבוצות כשהן זמינות
  useEffect(() => {
    if (!groupsLoading && groups) {
      // סינון רק קבוצות פעילות
      const activeGroups = groups.filter(group => group.isActive);
      
      const options = [
        { label: 'כל הקבוצות', value: 'all', isDefault: true },
        ...activeGroups.map(group => ({
          label: group.name,
          value: group.id
        }))
      ];
      setGroupOptions(options);
    }
  }, [groups, groupsLoading]);

  // טעינת נתונים בעת חזרה למסך
  useFocusEffect(
    useCallback(() => {
      console.log('WinnersLosersScreen: המסך קיבל פוקוס');
      
      // רענון הנתונים
      loadData();
      
      return () => {
        console.log('WinnersLosersScreen: המסך איבד פוקוס');
      };
    }, [loadData])
  );

  // רענון נתונים
  const handleRefresh = useCallback(() => {
    console.log('WinnersLosersScreen: הופעל רענון ידני');
    loadData(true);
  }, [loadData]);

  // חזרה למסך הסטטיסטיקה הראשי
  const handleBack = () => {
    console.log('WinnersLosersScreen: לחיצה על כפתור חזרה - חוזר למסך הסטטיסטיקות הראשי');
    router.replace("../index");
  };
  
  // רנדור הרשימה
  const renderList = () => {
    if (!stats) return null;

    let displayData;
    let title = '';

    if (rankingType === 'profits') {
      if (profitRankingType === 'single') {
        displayData = stats.bestSingleGamePlayers;
        title = 'דירוג לפי רווח במשחק בודד';
      } else {
        displayData = stats.bestCumulativePlayers;
        title = 'דירוג לפי רווח מצטבר';
      }
    } else {
      if (winningGamesRankingType === 'count') {
        displayData = stats.mostWinningGamesPlayers;
        title = 'דירוג לפי מספר משחקים שהסתיימו ברווח';
      } else {
        displayData = stats.bestWinRatePlayers;
        title = 'דירוג לפי אחוז משחקים שהסתיימו ברווח';
      }
    }

    return (
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>
              {rankingType === 'profits' ? 'דירוג לפי רווח ' : 'דירוג לפי '}
              <TouchableOpacity 
                onPress={() => {
                  if (rankingType === 'profits') {
                    setProfitRankingType(profitRankingType === 'single' ? 'cumulative' : 'single');
                  } else {
                    setWinningGamesRankingType(winningGamesRankingType === 'count' ? 'percentage' : 'count');
                  }
                }}
                style={styles.cardTitleButton}
              >
                <Text style={styles.cardTitleButtonText}>
                  {rankingType === 'profits' 
                    ? (profitRankingType === 'single' ? 'במשחק בודד' : 'מצטבר')
                    : (winningGamesRankingType === 'count' ? 'מספר' : 'אחוז')
                  }
                </Text>
              </TouchableOpacity>
              {rankingType === 'profits' ? '' : ' משחקים ברווח'}
            </Text>
          </View>
        </View>

        <ScrollView style={styles.listContainer}>
          {displayData?.map((player, index) => (
            <View key={player.playerId} style={styles.playerRow}>
              <Text style={styles.rank}>{index + 1}</Text>
              <Text style={styles.playerName}>{player.playerName}</Text>
              <Text style={[
                styles.value,
                rankingType === 'profits' && {
                  color: profitRankingType === 'single'
                    ? (player.bestSingleGameProfit >= 0 ? CASINO_COLORS.success : CASINO_COLORS.error)
                    : (player.cumulativeProfit >= 0 ? CASINO_COLORS.success : CASINO_COLORS.error)
                }
              ]}>
                {rankingType === 'profits' 
                  ? formatCurrency(profitRankingType === 'single' 
                      ? player.bestSingleGameProfit 
                      : player.cumulativeProfit)
                  : winningGamesRankingType === 'count'
                    ? `${player.gamesWon}/${player.gamesPlayed} משחקים`
                    : `${player.winRate.toFixed(1)}%`
                }
              </Text>
            </View>
          ))}
        </ScrollView>
      </Card>
    );
  };

  // טיפול בשינוי פילטר זמן
  const handleTimeFilterChange = (value: string) => {
    setTimeFilter(value);
  };

  // טיפול בשינוי פילטר קבוצה
  const handleGroupFilterChange = (value: string) => {
    setGroupFilter(value);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{
          headerShown: false
        }}
      />
      
      <HeaderBar
        title="סטטיסטיקת מנצחים ומפסידים"
        showBack={true}
        backgroundColor={CASINO_COLORS.primary}
        textColor={CASINO_COLORS.gold}
        borderColor={CASINO_COLORS.gold}
        onBackPress={handleBack}
        leftElement={
          <TouchableOpacity onPress={handleRefresh} style={styles.headerButtonCircle}>
            <Icon name="refresh" size={24} color={CASINO_COLORS.gold} />
          </TouchableOpacity>
        }
      />

      <View style={styles.filtersContainer}>
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>קבוצה:</Text>
          <View style={styles.filterControl}>
            <Dropdown
              value={groupFilter}
              items={groupOptions}
              onSelect={handleGroupFilterChange}
              rtl={true}
            />
          </View>
        </View>
        
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>תקופה:</Text>
          <View style={styles.filterControl}>
            <Dropdown
              value={timeFilter}
              items={timeFilterOptions}
              onSelect={handleTimeFilterChange}
              rtl={true}
            />
          </View>
        </View>
      </View>

      <View style={styles.rankingTypeContainer}>
        <View style={styles.rankingTypeRow}>
          <Text style={styles.rankingTypeLabel}>דירוג לפי:</Text>
          <TouchableOpacity 
            style={[
              styles.rankingTypeButton,
              rankingType === 'profits' && styles.rankingTypeButtonActive
            ]}
            onPress={() => setRankingType('profits')}
          >
            <Text style={[
              styles.rankingTypeButtonText,
              rankingType === 'profits' && styles.rankingTypeButtonTextActive
            ]}>
              רווחים
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[
              styles.rankingTypeButton,
              rankingType === 'winningGames' && styles.rankingTypeButtonActive
            ]}
            onPress={() => setRankingType('winningGames')}
          >
            <Text style={[
              styles.rankingTypeButtonText,
              rankingType === 'winningGames' && styles.rankingTypeButtonTextActive
            ]}>
              משחקים ברווח
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={CASINO_COLORS.gold} />
          <Text style={styles.loadingText}>טוען נתונים...</Text>
        </View>
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        renderList()
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CASINO_COLORS.background,
  },
  filtersContainer: {
    backgroundColor: CASINO_COLORS.surface,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,215,0,0.1)',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  filterLabel: {
    width: 80,
    fontSize: 16,
    color: CASINO_COLORS.text,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  filterControl: {
    flex: 1,
  },
  rankingTypeContainer: {
    padding: 16,
    backgroundColor: CASINO_COLORS.surface,
  },
  rankingTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  rankingTypeLabel: {
    color: CASINO_COLORS.gold,
    fontSize: 16,
    fontWeight: 'bold',
  },
  rankingTypeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: CASINO_COLORS.surface,
    marginHorizontal: 8,
  },
  rankingTypeButtonActive: {
    backgroundColor: CASINO_COLORS.primary,
  },
  rankingTypeButtonText: {
    color: CASINO_COLORS.textSecondary,
    fontWeight: 'bold',
  },
  rankingTypeButtonTextActive: {
    color: CASINO_COLORS.text,
  },
  subTypeButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: CASINO_COLORS.primary,
  },
  subTypeButtonText: {
    color: CASINO_COLORS.gold,
    fontSize: 14,
  },
  card: {
    margin: 16,
    backgroundColor: CASINO_COLORS.surface,
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CASINO_COLORS.gold,
  },
  cardHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,215,0,0.1)',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  cardTitle: {
    color: CASINO_COLORS.gold,
    fontSize: 18,
    fontWeight: 'bold',
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    lineHeight: 24,
  },
  cardTitleButton: {
    backgroundColor: CASINO_COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 16,
    justifyContent: 'center',
    marginHorizontal: 4,
    height: 20,
    alignSelf: 'center',
    marginBottom: 2,
  },
  cardTitleButtonText: {
    color: CASINO_COLORS.text,
    fontWeight: 'bold',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 14,
  },
  listContainer: {
    flex: 1,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,215,0,0.1)',
  },
  rank: {
    width: 40,
    color: CASINO_COLORS.gold,
    fontSize: 16,
    textAlign: 'center',
  },
  playerName: {
    flex: 1,
    color: CASINO_COLORS.text,
    fontSize: 16,
    marginHorizontal: 16,
    textAlign: 'right',
  },
  value: {
    color: CASINO_COLORS.success,
    fontSize: 16,
    textAlign: 'left',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: CASINO_COLORS.text,
    marginTop: 16,
  },
  errorText: {
    color: CASINO_COLORS.error,
    textAlign: 'center',
    margin: 16,
  },
  headerButtonCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});