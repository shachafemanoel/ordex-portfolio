'use client';

/**
 * SearchModal - Global Search Component
 * Keyboard-accessible search modal with recent searches
 */

import { focusRing } from '@/lib/design-tokens';
import { cn } from '@/lib/utils';
import { ArrowRight, Clock, Search, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Load recent searches from localStorage
  useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem('ordex-recent-searches');
      if (saved) {
        setRecentSearches(JSON.parse(saved));
      }
      // Focus input when modal opens
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K to open search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (!isOpen) {
          // This will be handled by parent component
        }
      }
      // Escape to close
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSearch = (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    // Save to recent searches
    const updated = [searchQuery, ...recentSearches.filter((s) => s !== searchQuery)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('ordex-recent-searches', JSON.stringify(updated));

    // Navigate to search results
    router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(query);
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem('ordex-recent-searches');
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-x-4 top-20 z-50 mx-auto max-w-2xl animate-in slide-in-from-top-4 duration-300">
        <div className="rounded-none border-[4px] border-black bg-white shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] dark:border-white dark:bg-slate-900 dark:shadow-[12px_12px_0px_0px_rgba(255,255,255,1)]">
          {/* Search Input */}
          <form onSubmit={handleSubmit} className="relative">
            <Search className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חפש הזמנות, לקוחות, מוצרים..."
              className={cn(
                'w-full rounded-none border-b-[4px] border-black bg-[#fbbf24] px-4 py-6 pr-12 text-xl font-black uppercase tracking-tighter outline-none placeholder:text-black/40',
                'dark:border-white dark:text-black dark:placeholder:text-black/40'
              )}
            />
            <button
              type="button"
              onClick={onClose}
              className="absolute left-4 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
          </form>

          {/* Recent Searches */}
          {recentSearches.length > 0 && query === '' && (
            <div className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  חיפושים אחרונים
                </h3>
                <button
                  onClick={clearRecentSearches}
                  className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  נקה הכל
                </button>
              </div>
              <div className="space-y-1">
                {recentSearches.map((search, index) => (
                  <button
                    key={index}
                    onClick={() => handleSearch(search)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-none border-2 border-transparent px-3 py-3 text-right transition-all font-bold uppercase tracking-tighter',
                      'hover:bg-[#0055ff] hover:text-white hover:border-black dark:hover:bg-[#0055ff]'
                    )}
                  >
                    <Clock className="h-4 w-4 text-slate-400" />
                    <span className="flex-1 text-sm text-slate-700 dark:text-slate-300">
                      {search}
                    </span>
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick Links */}
          <div className="border-t border-slate-200 p-4 dark:border-slate-700">
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/orders"
                onClick={onClose}
                className={cn(
                  'flex items-center gap-2 rounded-none border-[3px] border-black bg-white px-4 py-4 text-sm font-black uppercase tracking-tighter text-black transition-all hover:bg-[#0055ff] hover:text-white active:translate-x-[2px] active:translate-y-[2px]',
                  'dark:bg-slate-800 dark:text-white dark:border-white dark:hover:bg-[#0055ff]'
                )}
              >
                <span>📦</span>
                <span>כל ההזמנות</span>
              </Link>
              <Link
                href="/customers"
                onClick={onClose}
                className={cn(
                  'flex items-center gap-2 rounded-none border-[3px] border-black bg-white px-4 py-4 text-sm font-black uppercase tracking-tighter text-black transition-all hover:bg-[#0055ff] hover:text-white active:translate-x-[2px] active:translate-y-[2px]',
                  'dark:bg-slate-800 dark:text-white dark:border-white dark:hover:bg-[#0055ff]'
                )}
              >
                <span>👥</span>
                <span>לקוחות</span>
              </Link>
            </div>
          </div>

          {/* Keyboard Shortcuts Hint */}
          <div className="border-t border-slate-200 px-4 py-2 dark:border-slate-700">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>הקש Enter לחיפוש</span>
              <span>ESC לסגירה</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
