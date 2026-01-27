// src/utils/whatsappPayment.ts
import { Linking, Alert, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';

interface PaymentInfo {
  fromName: string;
  toName: string;
  amount: number;
}

interface PlayerPaymentSummary {
  recipientName: string;
  recipientPhone?: string;
  type: 'payer' | 'receiver';
  payments: PaymentInfo[];
  totalAmount: number;
}

interface GameInfo {
  groupName: string;
  gameDate: string;
}

/**
 * Generate a consolidated group message with all payments
 */
export const generateGroupMessage = (
  payments: PaymentInfo[],
  gameInfo: GameInfo
): string => {
  const paymentLines = payments
    .map(p => `• ${p.fromName} ← ${p.toName}: ${p.amount.toFixed(0)}₪`)
    .join('\n');

  return `תזכורת תשלומים מערב פוקר 🃏
קבוצה: ${gameInfo.groupName} | תאריך: ${gameInfo.gameDate}

💸 תשלומים:
${paymentLines}

בהצלחה! 🃏`;
};

/**
 * Generate individual message for a payer (someone who needs to pay)
 */
export const generatePayerMessage = (
  recipientName: string,
  payments: PaymentInfo[],
  gameInfo: GameInfo
): string => {
  const paymentLines = payments
    .map(p => `• ל${p.toName}: ${p.amount.toFixed(0)}₪`)
    .join('\n');

  const total = payments.reduce((sum, p) => sum + p.amount, 0);

  return `היי ${recipientName}! 👋
תזכורת מערב פוקר (${gameInfo.groupName}, ${gameInfo.gameDate})

עליך לשלם:
${paymentLines}

סה"כ: ${total.toFixed(0)}₪`;
};

/**
 * Generate individual message for a receiver (someone who should get paid)
 */
export const generateReceiverMessage = (
  recipientName: string,
  payments: PaymentInfo[],
  gameInfo: GameInfo
): string => {
  const paymentLines = payments
    .map(p => `• מ${p.fromName}: ${p.amount.toFixed(0)}₪`)
    .join('\n');

  const total = payments.reduce((sum, p) => sum + p.amount, 0);

  return `היי ${recipientName}! 👋
תזכורת מערב פוקר (${gameInfo.groupName}, ${gameInfo.gameDate})

מגיע לך:
${paymentLines}

סה"כ: ${total.toFixed(0)}₪`;
};

/**
 * Copy message to clipboard
 */
export const copyToClipboard = async (message: string): Promise<boolean> => {
  try {
    await Clipboard.setStringAsync(message);
    return true;
  } catch (error) {
    console.error('Error copying to clipboard:', error);
    return false;
  }
};

/**
 * Format phone number for WhatsApp (remove leading 0, add country code)
 */
export const formatPhoneForWhatsApp = (phone: string): string => {
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');

  // If starts with 0, replace with Israel country code
  if (cleaned.startsWith('0')) {
    cleaned = '972' + cleaned.substring(1);
  }

  // If doesn't start with country code, assume Israel
  if (!cleaned.startsWith('972') && cleaned.length === 9) {
    cleaned = '972' + cleaned;
  }

  return cleaned;
};

/**
 * Open WhatsApp with a pre-filled message
 * Returns true if successful, false otherwise
 */
export const openWhatsAppWithMessage = async (
  phone: string,
  message: string
): Promise<boolean> => {
  const formattedPhone = formatPhoneForWhatsApp(phone);
  const encodedMessage = encodeURIComponent(message);

  // WhatsApp deep link
  const whatsappUrl = `whatsapp://send?phone=${formattedPhone}&text=${encodedMessage}`;

  try {
    const canOpen = await Linking.canOpenURL(whatsappUrl);

    if (canOpen) {
      await Linking.openURL(whatsappUrl);
      return true;
    } else {
      // Try web WhatsApp as fallback
      const webWhatsAppUrl = `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
      const canOpenWeb = await Linking.canOpenURL(webWhatsAppUrl);

      if (canOpenWeb) {
        await Linking.openURL(webWhatsAppUrl);
        return true;
      }

      return false;
    }
  } catch (error) {
    console.error('Error opening WhatsApp:', error);
    return false;
  }
};

/**
 * Send individual WhatsApp message
 * Returns true if sent, false if failed or no phone
 */
export const sendIndividualMessage = async (
  summary: PlayerPaymentSummary,
  gameInfo: GameInfo
): Promise<{ success: boolean; reason?: string }> => {
  if (!summary.recipientPhone) {
    return { success: false, reason: 'no_phone' };
  }

  const message = summary.type === 'payer'
    ? generatePayerMessage(summary.recipientName, summary.payments, gameInfo)
    : generateReceiverMessage(summary.recipientName, summary.payments, gameInfo);

  const sent = await openWhatsAppWithMessage(summary.recipientPhone, message);

  if (!sent) {
    return { success: false, reason: 'whatsapp_failed' };
  }

  return { success: true };
};

/**
 * Group payments by payer - returns summaries for each payer
 */
export const groupPaymentsByPayer = (
  payments: PaymentInfo[],
  getPhone: (name: string) => string | undefined
): PlayerPaymentSummary[] => {
  const payerMap = new Map<string, PaymentInfo[]>();

  payments.forEach(payment => {
    const existing = payerMap.get(payment.fromName) || [];
    existing.push(payment);
    payerMap.set(payment.fromName, existing);
  });

  return Array.from(payerMap.entries()).map(([name, paymentList]) => ({
    recipientName: name,
    recipientPhone: getPhone(name),
    type: 'payer' as const,
    payments: paymentList,
    totalAmount: paymentList.reduce((sum, p) => sum + p.amount, 0)
  }));
};

/**
 * Group payments by receiver - returns summaries for each receiver
 */
export const groupPaymentsByReceiver = (
  payments: PaymentInfo[],
  getPhone: (name: string) => string | undefined
): PlayerPaymentSummary[] => {
  const receiverMap = new Map<string, PaymentInfo[]>();

  payments.forEach(payment => {
    const existing = receiverMap.get(payment.toName) || [];
    existing.push(payment);
    receiverMap.set(payment.toName, existing);
  });

  return Array.from(receiverMap.entries()).map(([name, paymentList]) => ({
    recipientName: name,
    recipientPhone: getPhone(name),
    type: 'receiver' as const,
    payments: paymentList,
    totalAmount: paymentList.reduce((sum, p) => sum + p.amount, 0)
  }));
};

export default {
  generateGroupMessage,
  generatePayerMessage,
  generateReceiverMessage,
  copyToClipboard,
  formatPhoneForWhatsApp,
  openWhatsAppWithMessage,
  sendIndividualMessage,
  groupPaymentsByPayer,
  groupPaymentsByReceiver,
};
