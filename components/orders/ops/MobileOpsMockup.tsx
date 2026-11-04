'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Camera, PackageOpen, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export function MobileOpsMockup() {
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  return (
    <div className="relative mx-auto mt-8 flex h-[80vh] min-h-[600px] w-full max-w-[400px] flex-col overflow-hidden rounded-[40px] border-[8px] border-slate-900 bg-slate-50 shadow-2xl dark:border-slate-800 dark:bg-slate-950">
      {/* Header */}
      <header className="flex items-center justify-between bg-white px-6 pt-12 pb-4 shadow-sm dark:bg-slate-900 z-10" dir="rtl">
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">ניהול מלאי</h2>
        <Button variant="ghost" className="h-10 w-10 p-0 shrink-0 rounded-full">
          <Search className="h-5 w-5 text-slate-500" />
        </Button>
      </header>

      {/* Content Area */}
      <main className="flex-1 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom,80px)+80px)] pt-6" dir="rtl">
        <div className="space-y-4">
          {/* Mock content items */}
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                <PackageOpen className="h-6 w-6 text-slate-400 dark:text-slate-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate font-bold text-slate-900 dark:text-slate-100">פריט #{2040 + i}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">ארון הזזה גליה...</p>
              </div>
              <Button
                variant="outline"
                className="h-9 px-3 shrink-0 rounded-full text-xs font-semibold"
                onClick={() => setIsSheetOpen(true)}
              >
                עדכן סטטוס
              </Button>
            </div>
          ))}
        </div>
      </main>

      {/* Floating Action Button (FAB) */}
      <div className="absolute bottom-[calc(env(safe-area-inset-bottom,20px)+20px)] left-6 z-20">
        <button
          onClick={() => alert('Scanner opened')}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-white shadow-[0_8px_30px_rgb(37,99,235,0.3)] transition-transform hover:scale-105 active:scale-95"
          aria-label="Scan Barcode"
        >
          <Camera className="h-7 w-7" />
        </button>
      </div>

      {/* Bottom Sheet Overlay */}
      {isSheetOpen && (
        <div 
          className="absolute inset-0 z-30 bg-slate-900/40 backdrop-blur-sm transition-opacity" 
          onClick={() => setIsSheetOpen(false)}
        />
      )}

      {/* Bottom Sheet */}
      <div
        className={cn(
          'absolute bottom-0 left-0 right-0 z-40 flex flex-col rounded-t-[32px] bg-white shadow-2xl transition-transform duration-300 ease-in-out dark:bg-slate-900',
          isSheetOpen ? 'translate-y-0' : 'translate-y-full'
        )}
      >
        <div className="flex h-8 w-full items-center justify-center cursor-pointer" onClick={() => setIsSheetOpen(false)}>
          <div className="h-1.5 w-12 rounded-full bg-slate-200 dark:bg-slate-700" />
        </div>
        
        <div className="px-6 pb-[calc(env(safe-area-inset-bottom,20px)+24px)]" dir="rtl">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">פעולות לפריט</h3>
            <Button variant="ghost" onClick={() => setIsSheetOpen(false)} className="h-10 w-10 p-0 rounded-full">
              <X className="h-5 w-5 text-slate-500" />
            </Button>
          </div>
          
          <div className="grid gap-3">
            <Button className="h-14 justify-start rounded-2xl px-6 text-base font-semibold">
              סמן כהושלם
            </Button>
            <Button variant="outline" className="h-14 justify-start rounded-2xl px-6 text-base font-semibold border-slate-200 dark:border-slate-800">
              דווח על חוסר/פגם
            </Button>
            <Button variant="ghost" className="h-14 justify-start rounded-2xl px-6 text-base font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50">
              הסר מההזמנה
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
