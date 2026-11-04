'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';

interface DisclosureCardProps {
  title: React.ReactNode;
  subTitle?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  rightMeta?: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  onToggle?: (isOpen: boolean) => void;
}

export function DisclosureCard({
  title,
  subTitle,
  actions,
  children,
  rightMeta,
  defaultOpen = false,
  className,
  onToggle,
}: DisclosureCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const toggleOpen = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    onToggle?.(newState);
  };

  return (
    <div
      className={cn("disclosure-card", className)}
      data-expanded={isOpen}
      onClick={toggleOpen}
      role="button"
      aria-expanded={isOpen}
      onKeyDown={(e) => {
         if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleOpen();
         }
      }}
      tabIndex={0}
    >
      <div className="disclosure-header">
         <div className="line-1">
           <div className="truncate flex-1">{title}</div>
           {rightMeta && <div className="shrink-0 ms-2">{rightMeta}</div>}
         </div>
         {subTitle && <div className="line-2 truncate">{subTitle}</div>}
         {actions && (
           <div className="quick-actions" onClick={(e) => e.stopPropagation()}>
             {actions}
           </div>
         )}
      </div>
      <div className="disclosure-content">
        <div onClick={(e) => e.stopPropagation()}>
          {children}
        </div>
      </div>
    </div>
  );
}
