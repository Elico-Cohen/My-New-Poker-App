/**
 * ממיר מספר לפורמט מטבע עם סימן שקל
 * @param amount הסכום לפורמט
 * @param showZero האם להציג אפס או להחזיר מחרוזת ריקה
 * @returns מחרוזת מפורמטת של הסכום
 */
export const formatCurrency = (amount?: number | null, showZero: boolean = true): string => {
  if (amount === undefined || amount === null) {
    return '';
  }
  
  if (amount === 0 && !showZero) {
    return '';
  }
  
  // עיגול לשתי ספרות אחרי הנקודה
  const roundedAmount = Math.round(amount * 100) / 100;
  
  // פורמט המספר עם פסיקים להפרדת אלפים
  const formattedNumber = roundedAmount.toLocaleString('he-IL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
  
  return `₪${formattedNumber}`;
};

/**
 * ממיר מספר לפורמט מטבע עם סימן שקל וסימן חיובי/שלילי
 * @param amount הסכום לפורמט
 * @returns מחרוזת מפורמטת של הסכום עם סימן + או -
 */
export const formatCurrencyWithSign = (amount?: number | null): string => {
  if (amount === undefined || amount === null) {
    return '';
  }
  
  const formattedAmount = formatCurrency(Math.abs(amount));
  
  if (amount === 0) {
    return formattedAmount;
  }
  
  return amount > 0 ? `+${formattedAmount}` : `-${formattedAmount}`;
};

/**
 * ממיר מספר לפורמט מטבע עם צבע (ירוק לחיובי, אדום לשלילי)
 * פונקציה זו מחזירה אובייקט עם הסכום המפורמט והצבע המתאים
 * @param amount הסכום לפורמט
 * @returns אובייקט עם הסכום המפורמט והצבע המתאים
 */
export const formatCurrencyWithColor = (amount?: number | null): { text: string; color: string } => {
  if (amount === undefined || amount === null) {
    return { text: '', color: 'text-gray-500' };
  }
  
  const formattedAmount = formatCurrency(Math.abs(amount));
  
  if (amount === 0) {
    return { text: formattedAmount, color: 'text-gray-500' };
  }
  
  if (amount > 0) {
    return { text: `+${formattedAmount}`, color: 'text-green-500' };
  } else {
    return { text: `-${formattedAmount}`, color: 'text-red-500' };
  }
};

/**
 * ממיר מספר לפורמט מטבע מקוצר (K לאלפים, M למיליונים)
 * @param amount הסכום לפורמט
 * @returns מחרוזת מפורמטת של הסכום בפורמט מקוצר
 */
export const formatShortCurrency = (amount?: number | null): string => {
  if (amount === undefined || amount === null) {
    return '';
  }
  
  let formattedAmount: string;
  const absAmount = Math.abs(amount);
  
  if (absAmount >= 1000000) {
    formattedAmount = `${(absAmount / 1000000).toFixed(1)}M`;
  } else if (absAmount >= 1000) {
    formattedAmount = `${(absAmount / 1000).toFixed(1)}K`;
  } else {
    formattedAmount = absAmount.toString();
  }
  
  return `₪${formattedAmount}`;
}; 