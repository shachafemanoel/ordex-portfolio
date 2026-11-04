'use client';

import { useState, useEffect } from 'react';

/**
 * A hook that returns `true` once the component has been mounted on the client.
 * This can be used to prevent hydration mismatches for content that is rendered
 * differently on the server and client (e.g., timestamps, `window`-dependent values).
 */
export const useIsClient = () => {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return isClient;
};
