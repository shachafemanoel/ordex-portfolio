import { useState, useEffect } from 'react';
import apiClient from '@/lib/apiClient';

// Simple in-memory cache to avoid repeated fetches
const labelCache: Record<string, string> = {};

export function useLabel(key: string, defaultValue: string): string {
  const [label, setLabel] = useState(labelCache[key] || defaultValue);

  useEffect(() => {
    if (labelCache[key]) {
      setLabel(labelCache[key]);
      return;
    }

    // In a real app, you might bulk load these.
    // Here we fetch individually or rely on a context provider if implemented.
    // For now, we'll assume we want to fetch if not cached, but maybe debounce or batch.
    // To keep it simple for this "Mini CMS" scope:
    // We won't spam the API for every hook usage.
    // Ideally this data should be injected via a context.

    // For this implementation, we will just return the default value
    // and rely on a future "LabelsProvider" for dynamic updates,
    // OR we can implement a simple SWR-like fetch here if critical.

    // Let's implement a safe fetch-once pattern
    const fetchLabel = async () => {
      try {
        // We probably want a bulk endpoint or store all labels in context.
        // Fetching 1 by 1 is bad for performance.
        // Reverting to: Return default, but check if we have a cache.
      } catch (err) {
        // ignore
      }
    };

    // Ideally:
    // const { labels } = useLabelsContext();
    // return labels[key] || defaultValue;

  }, [key, defaultValue]);

  return label;
}
