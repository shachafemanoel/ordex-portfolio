'use client';

import * as React from 'react';
import { DayPicker } from 'react-day-picker';

import { cn } from '@/lib/utils';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

// Local implementation of button variants to match Button.tsx without exporting it from there
const buttonVariants = ({ variant }: { variant: 'outline' | 'ghost' }) => {
  const baseStyles =
    'inline-flex items-center justify-center font-bold tracking-wide transition-all duration-200 ease-in-out focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    outline:
      'border border-primary text-primary bg-transparent hover:bg-primary/5 hover:border-primary-light hover:-translate-y-[1px] active:translate-y-0 focus:ring-2 focus:ring-primary/20',
    ghost:
      'text-text-secondary hover:text-primary hover:bg-primary/5 hover:-translate-y-[1px] active:translate-y-0 focus:ring-2 focus:ring-primary/20',
  };

  return cn(baseStyles, variants[variant]);
};

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={{
        months: 'flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0',
        month: 'space-y-4 font-sans',
        caption: 'flex justify-center pt-1 relative items-center',
        caption_label: 'text-sm font-bold text-text-primary',
        nav: 'space-x-1 flex items-center',
        nav_button: cn(
          buttonVariants({ variant: 'outline' }),
          'h-7 w-7 bg-transparent p-0 opacity-70 hover:opacity-100 rounded-lg'
        ),
        nav_button_previous: 'absolute left-1',
        nav_button_next: 'absolute right-1',
        table: 'w-full border-collapse space-y-1',
        head_row: 'flex',
        head_cell: 'text-text-secondary/60 rounded-md w-9 font-bold text-[0.7rem] uppercase tracking-wider',
        row: 'flex w-full mt-2',
        cell: 'h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-xl [&:has([aria-selected].day-outside)]:bg-slate-50/50 [&:has([aria-selected])]:bg-slate-50 first:[&:has([aria-selected])]:rounded-l-xl last:[&:has([aria-selected])]:rounded-r-xl focus-within:relative focus-within:z-20',
        day: cn(
          buttonVariants({ variant: 'ghost' }),
          'h-9 w-9 p-0 font-medium rounded-xl aria-selected:opacity-100 hover:rounded-xl transition-all'
        ),
        day_range_end: 'day-range-end',
        day_selected:
          'bg-primary text-on-dark hover:bg-primary-hover hover:text-on-dark focus:bg-primary focus:text-on-dark rounded-xl shadow-sm',
        day_today: 'bg-blue-50 text-primary font-bold rounded-xl',
        day_outside:
          'day-outside text-text-secondary/40 opacity-50 aria-selected:bg-slate-50/50 aria-selected:text-text-secondary/40 aria-selected:opacity-30',
        day_disabled: 'text-text-secondary/30 opacity-50',
        day_range_middle: 'aria-selected:bg-slate-50 aria-selected:text-text-primary',
        day_hidden: 'invisible',
        ...classNames,
      }}
      {...props}
    />
  );
}
Calendar.displayName = 'Calendar';

export { Calendar };
