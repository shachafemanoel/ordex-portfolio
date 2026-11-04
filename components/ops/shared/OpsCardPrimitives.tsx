'use client';

import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

export interface OpsCardTone {
  accentBar: string;
  badge: string;
  ring: string;
  surface: string;
  border: string;
}

export interface OpsCardFrameProps {
  tone: OpsCardTone;
  onClick?: () => void;
  onMouseEnter?: () => void;
  className?: string;
  children: ReactNode;
}

export function OpsCardFrame({
  tone,
  onClick,
  onMouseEnter,
  className,
  children,
}: Readonly<OpsCardFrameProps>) {
  return (
    <article
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={cn(
        'group overflow-hidden rounded-[24px] border border-white/60 bg-white/72 backdrop-blur-xl backdrop-saturate-150',
        'shadow-[0_4px_20px_-8px_rgba(15,23,42,0.10)]',
        'transition-all duration-200',
        'hover:-translate-y-1 hover:shadow-[0_12px_36px_-12px_rgba(15,23,42,0.16)] hover:bg-white/82',
        'active:scale-[0.985] active:shadow-[0_2px_10px_-4px_rgba(15,23,42,0.08)]',
        onClick ? 'cursor-pointer touch-manipulation select-none' : '',
        tone.border,
        className
      )}
    >
      {/* Gradient accent bar */}
      <div className={cn('h-1 w-full', tone.accentBar)} />
      {children}
    </article>
  );
}

export interface OpsProgressRingProps {
  progress: number;
  centerLabel: string;
  toneClassName: string;
  size?: 'sm' | 'md' | 'lg';
}

export function OpsProgressRing({
  progress,
  centerLabel,
  toneClassName,
  size = 'lg',
}: Readonly<OpsProgressRingProps>) {
  const safeProgress = Math.max(0, Math.min(progress, 100));

  const sizeMap = {
    sm: { radius: 14, box: 36, dimension: 'h-10 w-10', text: 'text-[9px]' },
    md: { radius: 18, box: 44, dimension: 'h-14 w-14', text: 'text-[10px]' },
    lg: { radius: 20, box: 48, dimension: 'h-16 w-16', text: 'text-[11px]' },
  };

  const { radius, box, dimension, text } = sizeMap[size] ?? sizeMap.lg;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (safeProgress / 100) * circumference;

  return (
    <div className={cn('relative flex shrink-0 items-center justify-center', dimension)}>
      <svg className={cn('-rotate-90', dimension)} viewBox={`0 0 ${box} ${box}`}>
        {/* Track */}
        <circle
          cx={box / 2}
          cy={box / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          className="text-[#e7eef8]"
        />
        {/* Progress */}
        <circle
          cx={box / 2}
          cy={box / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className={cn(toneClassName, 'transition-all duration-500 ease-out')}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={cn('font-black text-[#0f172a]', text)}>{centerLabel}</span>
      </div>
    </div>
  );
}
