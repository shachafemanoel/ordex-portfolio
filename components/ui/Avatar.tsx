'use client';

import { cn } from '@/lib/utils';
import React from 'react';

interface AvatarProps {
  name?: string;
  src?: string | null;
  size?: number;
  className?: string;
}

/**
 * Lightweight avatar with optional remote image and initials fallback.
 * Uses a soft gradient background to stay on-brand.
 */
export function Avatar({ name = '', src, size = 48, className }: AvatarProps) {
  const initials =
    name
      ?.trim()
      .split(/\s+/)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'O';

  const style: React.CSSProperties = {
    width: size,
    height: size,
  };

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-full border border-[var(--color-border-primary)] shadow-sm bg-gradient-to-br from-[var(--color-primary-600)]/5 via-[var(--color-bg-primary)] to-[var(--color-primary-600)]/10 text-[var(--color-text-primary)] flex items-center justify-center font-bold text-sm',
        className
      )}
      style={style}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name}
          className="w-full h-full object-cover"
          onError={(e) => {
            const target = e.currentTarget as HTMLImageElement;
            target.style.display = 'none';
          }}
        />
      ) : null}
      <span className="absolute inset-0 flex items-center justify-center">{initials}</span>
    </div>
  );
}

