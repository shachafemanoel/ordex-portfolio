'use client';

import { useState, useId, useRef, useCallback } from 'react';

interface InlineEditFieldProps {
  label: string;
  value: string;
  onSave: (newValue: string) => Promise<void>;
  type?: 'text' | 'email' | 'tel' | 'textarea';
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
}

export function InlineEditField({
  label,
  value,
  onSave,
  type = 'text',
  placeholder,
  disabled = false,
  rows = 3,
}: InlineEditFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();

  // Track if we need to restore focus to the edit button
  const shouldFocusRef = useRef(false);

  const handleStartEdit = () => {
    if (disabled) return;
    setIsEditing(true);
    setEditValue(value);
    setError(null);
  };

  const handleCancel = () => {
    shouldFocusRef.current = true;
    setIsEditing(false);
    setEditValue(value);
    setError(null);
  };

  const handleSave = async () => {
    if (editValue.trim() === value.trim()) {
      shouldFocusRef.current = true;
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave(editValue.trim());
      shouldFocusRef.current = true;
      setIsEditing(false);
    } catch (err: any) {
      setError(err.message || 'שגיאה בשמירה');
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (type !== 'textarea') {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      } else if (e.key === 'Escape') {
        handleCancel();
      }
    } else {
      if (e.key === 'Escape') {
        handleCancel();
      }
    }
  };

  const viewButtonRef = useCallback((node: HTMLButtonElement | null) => {
    if (node && shouldFocusRef.current) {
      node.focus();
      shouldFocusRef.current = false;
    }
  }, []);

  return (
    <div className="group">
      <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>

      {!isEditing ? (
        <button
          ref={viewButtonRef}
          type="button"
          onClick={handleStartEdit}
          disabled={disabled}
          className={`
            w-full text-right relative px-3 py-2 rounded-lg border-2 border-transparent
            ${disabled
              ? 'bg-gray-100 cursor-not-allowed'
              : 'hover:border-blue-200 hover:bg-blue-50 cursor-pointer'
            }
            transition-colors min-h-[2.5rem] flex items-center
          `}
          aria-label={`${label}: ${value || placeholder || 'לחץ לעריכה'}`}
        >
          <span className={value ? 'text-gray-900' : 'text-gray-400'}>
            {value || placeholder || 'לחץ לעריכה'}
          </span>
          {!disabled && (
            <svg
              className="w-4 h-4 mr-2 text-gray-400 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              />
            </svg>
          )}
        </button>
      ) : (
        <div className="space-y-2">
          {type === 'textarea' ? (
            <textarea
              id={inputId}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              rows={rows}
              disabled={isSaving}
              autoFocus
              className="w-full px-3 py-2 border-2 border-blue-500 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          ) : (
            <input
              id={inputId}
              type={type}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={isSaving}
              autoFocus
              className="w-full px-3 py-2 border-2 border-blue-500 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-3 py-1.5 bg-blue-600 text-on-dark rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>שומר...</span>
                </>
              ) : 'שמור'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSaving}
              className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 disabled:opacity-50"
            >
              ביטול
            </button>
            {type !== 'textarea' && (
              <span className="text-xs text-gray-500">
                Enter לשמירה, Esc לביטול
              </span>
            )}
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2" role="alert">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
