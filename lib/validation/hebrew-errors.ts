import { z } from 'zod';

/**
 * Hebrew error messages for Zod validation
 * Provides localized validation error messages for all Zod error types
 */

export const hebrewErrorMap: z.ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      if (issue.received === 'undefined') {
        return { message: 'שדה חובה' };
      }
      return { message: `צפוי ${issue.expected}, התקבל ${issue.received}` };

    case z.ZodIssueCode.invalid_literal:
      return { message: `ערך לא תקין, צפוי ${JSON.stringify(issue.expected)}` };

    case z.ZodIssueCode.unrecognized_keys:
      return {
        message: `מפתחות לא מזוהים באובייקט: ${issue.keys.map((k) => `'${k}'`).join(', ')}`,
      };

    case z.ZodIssueCode.invalid_union:
      return { message: 'קלט לא תקין' };

    case z.ZodIssueCode.invalid_union_discriminator:
      return {
        message: `ערך מבחין לא תקין. צפוי ${issue.options.map((o) => `'${String(o)}'`).join(' | ')}`,
      };

    case z.ZodIssueCode.invalid_enum_value:
      return {
        message: `ערך לא תקין. צפוי ${issue.options.map((o) => `'${String(o)}'`).join(' | ')}, התקבל '${issue.received}'`,
      };

    case z.ZodIssueCode.invalid_arguments:
      return { message: 'ארגומנטים לא תקינים לפונקציה' };

    case z.ZodIssueCode.invalid_return_type:
      return { message: 'סוג החזרה לא תקין מהפונקציה' };

    case z.ZodIssueCode.invalid_date:
      return { message: 'תאריך לא תקין' };

    case z.ZodIssueCode.invalid_string:
      if (typeof issue.validation === 'object') {
        if ('startsWith' in issue.validation) {
          return { message: `חייב להתחיל ב-"${issue.validation.startsWith}"` };
        }
        if ('endsWith' in issue.validation) {
          return { message: `חייב להסתיים ב-"${issue.validation.endsWith}"` };
        }
      } else {
        switch (issue.validation) {
          case 'email':
            return { message: 'כתובת אימייל לא תקינה' };
          case 'url':
            return { message: 'כתובת URL לא תקינה' };
          case 'uuid':
            return { message: 'UUID לא תקין' };
          case 'cuid':
            return { message: 'CUID לא תקין' };
          case 'regex':
            return { message: 'פורמט לא תקין' };
          case 'datetime':
            return { message: 'תאריך ושעה לא תקינים' };
          default:
            return { message: 'מחרוזת לא תקינה' };
        }
      }
      return { message: 'מחרוזת לא תקינה' };

    case z.ZodIssueCode.too_small:
      if (issue.type === 'array') {
        return {
          message: issue.exact
            ? `המערך חייב להכיל בדיוק ${issue.minimum} פריט${issue.minimum === 1 ? '' : 'ים'}`
            : `המערך חייב להכיל לפחות ${issue.minimum} פריט${issue.minimum === 1 ? '' : 'ים'}`,
        };
      }
      if (issue.type === 'string') {
        return {
          message: issue.exact
            ? `המחרוזת חייבת להכיל בדיוק ${issue.minimum} תו${issue.minimum === 1 ? '' : 'ים'}`
            : `המחרוזת חייבת להכיל לפחות ${issue.minimum} תו${issue.minimum === 1 ? '' : 'ים'}`,
        };
      }
      if (issue.type === 'number') {
        return {
          message: issue.exact
            ? `המספר חייב להיות בדיוק ${issue.minimum}`
            : issue.inclusive
              ? `המספר חייב להיות גדול או שווה ל-${issue.minimum}`
              : `המספר חייב להיות גדול מ-${issue.minimum}`,
        };
      }
      if (issue.type === 'date') {
        return {
          message: issue.exact
            ? `התאריך חייב להיות בדיוק ${new Date(issue.minimum as number).toLocaleDateString('he-IL')}`
            : issue.inclusive
              ? `התאריך חייב להיות ${new Date(issue.minimum as number).toLocaleDateString('he-IL')} או מאוחר יותר`
              : `התאריך חייב להיות מאוחר יותר מ-${new Date(issue.minimum as number).toLocaleDateString('he-IL')}`,
        };
      }
      return { message: 'ערך קטן מדי' };

    case z.ZodIssueCode.too_big:
      if (issue.type === 'array') {
        return {
          message: issue.exact
            ? `המערך חייב להכיל בדיוק ${issue.maximum} פריט${issue.maximum === 1 ? '' : 'ים'}`
            : `המערך חייב להכיל לכל היותר ${issue.maximum} פריט${issue.maximum === 1 ? '' : 'ים'}`,
        };
      }
      if (issue.type === 'string') {
        return {
          message: issue.exact
            ? `המחרוזת חייבת להכיל בדיוק ${issue.maximum} תו${issue.maximum === 1 ? '' : 'ים'}`
            : `המחרוזת חייבת להכיל לכל היותר ${issue.maximum} תו${issue.maximum === 1 ? '' : 'ים'}`,
        };
      }
      if (issue.type === 'number') {
        return {
          message: issue.exact
            ? `המספר חייב להיות בדיוק ${issue.maximum}`
            : issue.inclusive
              ? `המספר חייב להיות קטן או שווה ל-${issue.maximum}`
              : `המספר חייב להיות קטן מ-${issue.maximum}`,
        };
      }
      if (issue.type === 'date') {
        return {
          message: issue.exact
            ? `התאריך חייב להיות בדיוק ${new Date(issue.maximum as number).toLocaleDateString('he-IL')}`
            : issue.inclusive
              ? `התאריך חייב להיות ${new Date(issue.maximum as number).toLocaleDateString('he-IL')} או מוקדם יותר`
              : `התאריך חייב להיות מוקדם יותר מ-${new Date(issue.maximum as number).toLocaleDateString('he-IL')}`,
        };
      }
      return { message: 'ערך גדול מדי' };

    case z.ZodIssueCode.custom:
      return { message: ctx.defaultError };

    case z.ZodIssueCode.invalid_intersection_types:
      return { message: 'לא ניתן למזג את סוגי הצומת' };

    case z.ZodIssueCode.not_multiple_of:
      return { message: `המספר חייב להיות כפולה של ${issue.multipleOf}` };

    case z.ZodIssueCode.not_finite:
      return { message: 'המספר חייב להיות סופי' };

    default:
      return { message: ctx.defaultError };
  }
};

/**
 * Apply Hebrew error map globally to all Zod schemas
 * Call this function once at app initialization
 */
export function applyHebrewErrorMap() {
  z.setErrorMap(hebrewErrorMap);
}
