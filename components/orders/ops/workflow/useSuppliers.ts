import { useState, useEffect } from 'react';
import type { SupplierOption } from './types';
import { extractSuppliersFromResponse } from './utils';

export function useSuppliers() {
  const [supplierOptions, setSupplierOptions] = useState<SupplierOption[]>([]);
  const [suppliersLoading, setSuppliersLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const fetchSuppliers = async () => {
      setSuppliersLoading(true);
      try {
        const response = await fetch('/api/suppliers?limit=200', { credentials: 'include' });
        const payload = await response.json().catch(() => null);
        if (!mounted) return;
        if (!response.ok) {
          setSupplierOptions([]);
          return;
        }
        setSupplierOptions(extractSuppliersFromResponse(payload));
      } catch {
        if (mounted) setSupplierOptions([]);
      } finally {
        if (mounted) setSuppliersLoading(false);
      }
    };
    void fetchSuppliers();
    return () => { mounted = false; };
  }, []);

  return { supplierOptions, suppliersLoading };
}
