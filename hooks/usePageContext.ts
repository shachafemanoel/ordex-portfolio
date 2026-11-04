'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export interface PageContext {
  url: string;
  title: string;
  data?: any;
}

export function usePageContext() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [context, setContext] = useState<PageContext | null>(null);

  useEffect(() => {
    // Basic context from URL
    const fullUrl = `${pathname}${searchParams.toString() ? '?' + searchParams.toString() : ''}`;

    // Try to scrape title or metadata (basic version)
    // In a real app, pages could expose a context provider
    const pageTitle = document.title;

    // Detect basic entities from URL
    const data: any = {};
    const orderMatch = pathname.match(/\/orders\/([a-zA-Z0-9-]+)/);
    if (orderMatch) {
      data.orderId = orderMatch[1];
      data.entity = 'order';
    }

    setContext({
      url: fullUrl,
      title: pageTitle,
      data,
    });
  }, [pathname, searchParams]);

  return context;
}
