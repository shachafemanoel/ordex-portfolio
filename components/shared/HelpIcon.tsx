'use client';

import { useState, useRef } from 'react';
import apiClient from '@/lib/apiClient';
import { HelpCircle, Info, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface HelpIconProps {
  helpKey: string;
  className?: string;
  variant?: 'tooltip' | 'inline';
}

export function HelpIcon({ helpKey, className }: HelpIconProps) {
  const [content, setContent] = useState<{ title: string; body: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const loadedKey = useRef<string | null>(null);

  const loadContent = async () => {
    if (loadedKey.current === helpKey || loading) return;

    setLoading(true);
    setError(false);

    try {
      const res = await apiClient(`/api/help/${helpKey}`);
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setContent(json.data);
          loadedKey.current = helpKey;
        } else {
          setError(true);
        }
      } else {
        setError(true);
      }
    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Popover onOpenChange={(open) => open && loadContent()}>
      <PopoverTrigger asChild>
        <button
          className={`text-gray-400 hover:text-blue-600 transition-colors ${className}`}
          aria-label="Help"
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="start" dir="rtl">
        {loading ? (
          <div className="flex items-center justify-center py-4 text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            <span>טוען עזרה...</span>
          </div>
        ) : error ? (
          <div className="text-center text-sm text-gray-500 py-2">
            לא נמצא מידע עבור נושא זה.
          </div>
        ) : content ? (
          <div className="space-y-2">
            <h4 className="font-semibold text-sm text-gray-900">{content.title}</h4>
            <div className="text-sm text-gray-600 whitespace-pre-wrap">{content.body}</div>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
