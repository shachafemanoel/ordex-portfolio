'use client';

import { EntitySurface } from '@/components/shared/display/EntityPrimitives';
import { DISPLAY_TEXT } from '@/components/shared/display/displayText';
import { cn } from '@/lib/utils';
import { Mail, Phone } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

interface CustomerIdentityCardProps {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  href?: string;
  meta?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function CustomerIdentityCard({
  name,
  phone,
  email,
  href,
  meta,
  footer,
  className,
}: Readonly<CustomerIdentityCardProps>) {
  const displayName = name?.trim() || DISPLAY_TEXT.unknownCustomer;
  const initial = displayName.charAt(0) || 'ל';

  return (
    <EntitySurface className={cn('relative overflow-hidden p-4', className)}>
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-primary-100 bg-gradient-to-br from-primary-50 to-primary-100 text-sm font-bold text-primary-700">
          {initial}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {href ? (
                <Link href={href} className="block">
                  <h3 className="truncate font-bold text-slate-900 transition-colors hover:text-primary-700">
                    {displayName}
                  </h3>
                </Link>
              ) : (
                <h3 className="truncate font-bold text-slate-900">{displayName}</h3>
              )}

              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                {phone ? (
                  <span dir="ltr" className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {phone}
                  </span>
                ) : null}
                {email ? (
                  <span className="flex max-w-[220px] items-center gap-1 truncate">
                    <Mail className="h-3 w-3" />
                    {email}
                  </span>
                ) : null}
              </div>
            </div>

            {meta ? <div className="shrink-0 text-end">{meta}</div> : null}
          </div>
        </div>
      </div>

      {footer ? <div className="mt-3 border-t border-slate-100 pt-3">{footer}</div> : null}
    </EntitySurface>
  );
}
