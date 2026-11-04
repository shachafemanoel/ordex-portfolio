type ParsedApiError = {
  code: string;
  message: string;
  detail?: unknown;
  status?: number;
};

const ERROR_MESSAGES: Record<string, string> = {
  validation_error: 'נתוני הטופס אינם תקינים. בדקו את השדות שסימנו או את הערכים שהזנתם.',
  foreign_key_violation: 'נראה שהקישור ללקוח או למוצר שגוי. ודאו שהנתונים קיימים במערכת.',
  conflict: 'הרשומה כבר קיימת. בדקו שאין כפילות במספר הזמנה או נתון מזהה אחר.',
  not_found: 'המשאב שביקשתם לא נמצא.',
  order_not_found: 'ההזמנה לא נמצאה.',
  customer_not_found: 'לא הצלחנו לאתר את הלקוח שבחרתם.',
  customer_missing_address: 'ללקוח חסרות כתובות חיוניות לטיפול בהזמנה.',
  product_not_found: 'אחד או יותר מהפריטים לא קיימים במלאי.',
  supplier_not_found: 'אחד או יותר מהספקים שנבחרו לא קיימים.',
  supplier_mismatch: 'הספק שנבחר לא תואם לפריט שבחרתם.',
  invalid_status_transition: 'אי אפשר לבצע את שינוי הסטטוס המבוקש ממצב ההזמנה הנוכחי.',
  status_guard_failed: 'יש להשלים את הצעדים הנדרשים לפני שינוי סטטוס זה.',
  status_prerequisite_failed: 'הסטטוס שבחרתם דורש שדות חובה נוספים.',
  status_permission_denied: 'אין לכם הרשאות לבצע את שינוי הסטטוס הזה.',
  purchase_order_missing_supplier: 'אי אפשר ליצור הזמנת רכש ללא ספק ברירת מחדל לכל פריט.',
  purchase_order_missing_product: 'אי אפשר ליצור הזמנת רכש לפריט ללא מק"ט תקין.',
  database_not_configured:
    'המערכת לא מחוברת למסד הנתונים. עדכנו את משתנה הסביבה DATABASE_URL בקונסולת הניהול והפעילו את השירות מחדש.',
  unauthorized: 'אין חיבור התחברות פעיל. התחברו מחדש והמשיכו.',
  forbidden: 'אין לכם הרשאות לגשת למשאב הזה.',
  session_expired: 'פג תוקף ההתחברות. התחברו מחדש כדי להמשיך.',
  internal_error: 'אירעה תקלה בשרת. נסו שוב או פנו לתמיכה.',
  unknown_error: 'אירעה תקלה. נסו שוב או פנו לתמיכה.',
};

const fallbackMessage: string = ERROR_MESSAGES.internal_error ?? 'אירעה תקלה בשרת. נסו שוב או פנו לתמיכה.';

export function parseErrorPayload(payload: any, status?: number): ParsedApiError {
  let code: string | undefined;
  let detail: unknown;

  if (payload && typeof payload === 'object') {
    if (typeof payload.error === 'string') {
      code = payload.error;
    } else if (payload.error && typeof payload.error.code === 'string') {
      code = payload.error.code;
      detail = payload.error.detail ?? payload.error.details ?? detail;
    } else if (typeof payload.code === 'string') {
      code = payload.code;
    }

    if (detail === undefined) {
      detail = payload.detail ?? payload.details ?? payload.error?.detail ?? payload.error?.details;
    }
  }

  if (!code) {
    if (status === 401) code = 'unauthorized';
    else if (status === 403) code = 'forbidden';
    else if (status === 404) code = 'not_found';
    else if (status === 409) code = 'conflict';
    else if (status && status >= 400 && status < 500) code = 'validation_error';
    else code = status && status >= 500 ? 'internal_error' : 'unknown_error';
  }

  const normalized = typeof code === 'string' ? code.toLowerCase() : 'unknown_error';
  let message: string = ERROR_MESSAGES[normalized] ?? fallbackMessage;

  if (typeof detail === 'string' && detail.trim()) {
    message = detail.trim();
  } else if (detail && typeof detail === 'object') {
    if ('message' in (detail as any) && typeof (detail as any).message === 'string') {
      const customMessage = (detail as any).message as string;
      if (customMessage.trim()) {
        message = customMessage.trim();
      }
    } else if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0];
      if (first && typeof first.message === 'string' && first.message.trim()) {
        message = first.message.trim();
      }
    }
  }

  return {
    code: normalized,
    message,
    detail,
    status,
  };
}

export function friendlyMessageFromError(err: unknown): string {
  if (err instanceof Error) {
    try {
      const parsed = JSON.parse(err.message) as { code?: string; message?: string };
      if (parsed?.message && parsed.message.trim()) {
        return parsed.message.trim();
      }
      if (parsed?.code) {
        const errorMessage = ERROR_MESSAGES[parsed.code];
        if (errorMessage) {
          return errorMessage;
        }
      }
    } catch {
      if (err.message && err.message.trim()) {
        return err.message.trim();
      }
    }
  }
  return fallbackMessage;
}

export async function extractErrorMessage(response: Response): Promise<ParsedApiError> {
  let payload: any = null;
  try {
    payload = await response.clone().json();
  } catch {
    payload = null;
  }
  return parseErrorPayload(payload, response.status);
}
