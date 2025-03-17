import { GameDate } from '@/models/Game';

/**
 * ממיר אובייקט תאריך משחק למחרוזת בפורמט מקוצר
 * @param date אובייקט תאריך משחק
 * @returns מחרוזת בפורמט DD/MM/YY
 */
export const formatShortDate = (date?: GameDate | null): string => {
  if (!date) return 'תאריך לא ידוע';
  
  const day = date.day.toString().padStart(2, '0');
  const month = date.month.toString().padStart(2, '0');
  const year = date.year.toString().slice(-2);
  
  return `${day}/${month}/${year}`;
};

/**
 * ממיר אובייקט תאריך משחק למחרוזת בפורמט מלא
 * @param date אובייקט תאריך משחק
 * @returns מחרוזת בפורמט DD בMMMM YYYY
 */
export const formatLongDate = (date?: GameDate | null): string => {
  if (!date) return 'תאריך לא ידוע';
  
  const day = date.day;
  const monthNames = [
    'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
    'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
  ];
  const monthName = monthNames[date.month - 1];
  const year = date.year;
  
  return `${day} ב${monthName} ${year}`;
};

/**
 * ממיר אובייקט תאריך משחק למחרוזת בפורמט יום ותאריך
 * @param date אובייקט תאריך משחק
 * @returns מחרוזת בפורמט 'יום שלישי, 15 במרץ 2023'
 */
export const formatDayAndDate = (date?: GameDate | null): string => {
  if (!date) return 'תאריך לא ידוע';
  
  const jsDate = new Date(date.year, date.month - 1, date.day);
  
  const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const dayName = dayNames[jsDate.getDay()];
  
  const day = date.day;
  const monthNames = [
    'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
    'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
  ];
  const monthName = monthNames[date.month - 1];
  const year = date.year;
  
  return `יום ${dayName}, ${day} ב${monthName} ${year}`;
};

/**
 * ממיר אובייקט תאריך משחק לאובייקט Date של JavaScript
 * @param date אובייקט תאריך משחק
 * @returns אובייקט Date של JavaScript
 */
export const gameToJsDate = (date?: GameDate | null): Date | null => {
  if (!date) return null;
  return new Date(date.year, date.month - 1, date.day);
};

/**
 * ממיר אובייקט Date של JavaScript לאובייקט תאריך משחק
 * @param date אובייקט Date של JavaScript
 * @returns אובייקט תאריך משחק
 */
export const jsToGameDate = (date: Date): GameDate => {
  return {
    day: date.getDate(),
    month: date.getMonth() + 1,
    year: date.getFullYear(),
    timestamp: date.getTime()
  };
};

/**
 * מחשב את מספר הימים שעברו מאז תאריך מסוים
 * @param date אובייקט תאריך משחק
 * @returns מספר הימים שעברו
 */
export const getDaysSince = (date?: GameDate | null): number | null => {
  if (!date) return null;
  
  const jsDate = gameToJsDate(date);
  if (!jsDate) return null;
  
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - jsDate.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
};

/**
 * מחזיר תיאור יחסי של זמן שעבר מאז תאריך מסוים
 * @param date אובייקט תאריך משחק
 * @returns תיאור יחסי של הזמן שעבר (לדוגמה: "לפני 3 ימים")
 */
export const getRelativeTimeDescription = (date?: GameDate | null): string => {
  if (!date) return 'זמן לא ידוע';
  
  const days = getDaysSince(date);
  if (days === null) return 'זמן לא ידוע';
  
  if (days === 0) return 'היום';
  if (days === 1) return 'אתמול';
  if (days < 7) return `לפני ${days} ימים`;
  
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return 'לפני שבוע';
  if (weeks < 5) return `לפני ${weeks} שבועות`;
  
  const months = Math.floor(days / 30);
  if (months === 1) return 'לפני חודש';
  if (months < 12) return `לפני ${months} חודשים`;
  
  const years = Math.floor(days / 365);
  if (years === 1) return 'לפני שנה';
  return `לפני ${years} שנים`;
}; 