// src/utils/dateUtils.ts
import { GameDate } from '@/models/Game';

/**
 * Creates a standardized GameDate object from a JavaScript Date
 */
export function createGameDate(date: Date = new Date()): GameDate {
  return {
    day: date.getDate(),
    month: date.getMonth() + 1, // JavaScript months are 0-based
    year: date.getFullYear(),
    timestamp: date.getTime()
  };
}

/**
 * Validates and fixes a GameDate object to ensure all required fields are present
 * Falls back to the current date if the provided date is invalid
 */
export function validateGameDate(gameDate: any): GameDate {
  // If completely missing, use current date
  if (!gameDate) {
    return createGameDate();
  }
  
  // If it already has all fields, use it as is
  if (typeof gameDate.day === 'number' && 
      typeof gameDate.month === 'number' && 
      typeof gameDate.year === 'number' && 
      typeof gameDate.timestamp === 'number') {
    return gameDate as GameDate;
  }
  
  // If it has timestamp but missing other fields, recreate from timestamp
  if (typeof gameDate.timestamp === 'number') {
    const date = new Date(gameDate.timestamp);
    return {
      day: date.getDate(),
      month: date.getMonth() + 1,
      year: date.getFullYear(),
      timestamp: gameDate.timestamp
    };
  }
  
  // If it has date components but no timestamp
  if (typeof gameDate.day === 'number' && 
      typeof gameDate.month === 'number' && 
      typeof gameDate.year === 'number') {
    const date = new Date(gameDate.year, gameDate.month - 1, gameDate.day);
    return {
      ...gameDate,
      timestamp: date.getTime()
    };
  }
  
  // As a last resort, use current date
  return createGameDate();
}

/**
 * Formats a GameDate for display
 */
export function formatGameDate(gameDate: any): string {
  try {
    // If missing altogether, show placeholder
    if (!gameDate) return 'תאריך לא זמין';
    
    // Try to create a date from the components
    if (typeof gameDate.day === 'number' && 
        typeof gameDate.month === 'number' && 
        typeof gameDate.year === 'number') {
      const date = new Date(gameDate.year, gameDate.month - 1, gameDate.day);
      return date.toLocaleDateString('he-IL');
    }
    
    // Try to use timestamp as fallback
    if (typeof gameDate.timestamp === 'number') {
      return new Date(gameDate.timestamp).toLocaleDateString('he-IL');
    }
    
    // As a last resort
    return 'תאריך לא זמין';
  } catch (e) {
    console.error('Error formatting date:', e);
    return 'תאריך לא זמין';
  }
}