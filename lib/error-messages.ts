/**
 * Mappings for technical English error messages to friendly Hebrew ones.
 */

export const ERROR_MESSAGE_MAP: Record<string, string> = {
  'Action not allowed': 'לא ניתן לבצע פעולה זו בשלב הנוכחי',
  Unauthorized: 'אין לך הרשאה לבצע פעולה זו',
  'Not found': 'המשאב המבוקש לא נמצא',
  'Internal Server Error': 'שגיאת שרת פנימית, נסה שוב מאוחר יותר',
  Forbidden: 'הגישה נדחתה',
  'Missing requirements': 'חסרות דרישות להמשך התהליך',
  'Invalid input': 'קלט לא תקין, בדוק את הנתונים ונסה שוב',
  'Failed to fetch': 'שגיאה בתקשורת עם השרת, בדוק את חיבור האינטרנט',
};

/**
 * Returns a human-friendly Hebrew error message.
 * Falls back to a generic message if no mapping exists.
 */
export function getFriendlyErrorMessage(error: any): string {
  if (!error) return 'משהו השתבש, נסה שוב';

  const message = typeof error === 'string' ? error : error.message || '';

  // Check exact match
  if (ERROR_MESSAGE_MAP[message]) {
    return ERROR_MESSAGE_MAP[message];
  }

  // Check partial match (case insensitive)
  const lowerMessage = message.toLowerCase();
  for (const [key, value] of Object.entries(ERROR_MESSAGE_MAP)) {
    if (lowerMessage.includes(key.toLowerCase())) {
      return value;
    }
  }

  return 'משהו השתבש, נסה שוב';
}
