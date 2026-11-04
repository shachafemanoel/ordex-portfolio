'use client';

import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/ToastProvider';
import apiClient from '@/lib/apiClient';
import { useUITranslation } from '@/lib/i18n/hooks/useTranslation';
import { formatAddress } from '@/lib/utils/formatAddress';
import { Loader2, Mail, MapPin, Phone, Search, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export interface CustomerAddress {
  id: string;
  type: 'BILLING' | 'SHIPPING';
  city: string;
  street: string;
  number: string;
  floor?: string | null;
  apartment?: string | null;
  notes?: string | null;
}

export interface CustomerSearchResult {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  addresses?: CustomerAddress[];
  ordersCount?: number;
  clvCents?: number;
}

interface CustomerAutocompleteProps {
  onSelect: (customer: CustomerSearchResult) => void;
  placeholder?: string;
  selectedCustomerName?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

export function CustomerAutocomplete({
  onSelect,
  placeholder,
  selectedCustomerName,
  disabled = false,
  autoFocus = false,
}: CustomerAutocompleteProps) {
  const { error: showError } = useToast();
  const { t, locale, direction } = useUITranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [customers, setCustomers] = useState<CustomerSearchResult[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();
  const localeTag = locale === 'he' ? 'he-IL' : 'en-US';
  const inputPlaceholder =
    selectedCustomerName || placeholder || t('orders.new.customer.autocomplete.placeholder');

  // Stable refs to avoid re-render loops from callback dependencies
  const showErrorRef = useRef(showError);
  showErrorRef.current = showError;
  const tRef = useRef(t);
  tRef.current = t;

  // Debounced search - only depends on searchTerm to avoid render loops
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    const trimmedTerm = searchTerm.trim();
    if (trimmedTerm && trimmedTerm.length >= 2) {
      debounceRef.current = setTimeout(async () => {
        setIsLoading(true);
        try {
          const params = new URLSearchParams({ term: trimmedTerm, limit: '10' });
          const response = await apiClient(`/api/customers/search?${params}`, {
            cache: 'no-store',
          });

          if (!response.ok) {
            throw new Error(tRef.current('orders.new.customer.autocomplete.searchFailed'));
          }

          const data = await response.json();
          const customersList = data.data?.customers || data.customers || [];
          setCustomers(customersList);
        } catch (error) {
          console.error('Customer search error:', error);
          showErrorRef.current(tRef.current('orders.new.customer.autocomplete.searchFailed'));
          setCustomers([]);
        } finally {
          setIsLoading(false);
        }
      }, 300);
    } else if (!trimmedTerm || trimmedTerm.length < 2) {
      setCustomers([]);
      setIsLoading(false);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchTerm]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle customer selection
  const handleSelect = (customer: CustomerSearchResult) => {
    onSelect(customer);
    setSearchTerm('');
    setIsOpen(false);
    setCustomers([]);
  };

  return (
    <div ref={containerRef} className="relative" dir={direction}>
      <div className="relative">
        <Input
          ref={inputRef}
          placeholder={inputPlaceholder}
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (searchTerm.length >= 2) {
              setIsOpen(true);
            }
          }}
          disabled={disabled}
          autoFocus={autoFocus}
          className={selectedCustomerName && !searchTerm ? 'text-gray-900 font-medium' : ''}
        />
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
        </div>
      </div>

      {isOpen && (searchTerm.trim().length >= 2 || customers.length > 0) && (
        <div className="absolute top-full left-0 right-0 z-[100] mt-2 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          {/* Customer results */}
          {customers.length > 0 && (
            <div className="max-h-80 overflow-y-auto">
              {customers.map((customer) => {
                const shippingAddress = customer.addresses?.find(
                  (addr) => addr.type === 'SHIPPING'
                );
                const ordersCount = customer.ordersCount || 0;
                const clv = customer.clvCents || 0;

                return (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => handleSelect(customer)}
                    className="w-full text-right px-5 py-4 hover:bg-ordex-primary/5 border-b border-gray-100 last:border-b-0 transition-all group/item focus:outline-none focus:bg-ordex-primary/5"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 p-1.5 bg-gray-100 rounded">
                        <User className="w-4 h-4 text-gray-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-gray-900 group-hover/item:text-ordex-primary transition-colors">
                          {customer.name}
                        </div>

                        {/* Contact info */}
                        <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
                          {customer.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {customer.phone}
                            </span>
                          )}
                          {customer.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {customer.email}
                            </span>
                          )}
                        </div>

                        {/* Address */}
                        {shippingAddress && (
                          <div className="flex items-start gap-1 mt-1 text-xs text-gray-500">
                            <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                            <span className="truncate">
                              {formatAddress(shippingAddress, {
                                includeNotes: false,
                                separator: ' · ',
                              })}
                            </span>
                          </div>
                        )}

                        {/* Stats */}
                        <div className="flex gap-3 mt-1.5 text-xs">
                          {ordersCount > 0 && (
                            <span className="text-blue-600 font-medium">
                              {t('orders.new.customer.autocomplete.ordersCount', undefined, {
                                params: { count: ordersCount },
                              })}
                            </span>
                          )}
                          {clv > 0 && (
                            <span className="text-green-600 font-medium">
                              {t('orders.new.customer.autocomplete.clvPrefix')} ₪
                              {(clv / 100).toLocaleString(localeTag)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* No results message */}
          {!isLoading && searchTerm.trim().length >= 2 && customers.length === 0 && (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-gray-500">
                {t('orders.new.customer.autocomplete.noResults')}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {t('orders.new.customer.autocomplete.noResultsHint')}
              </p>
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="px-4 py-6 text-sm text-gray-500 text-center">
              <Loader2 className="w-5 h-5 animate-spin inline-block ml-2" />
              {t('orders.new.customer.autocomplete.loading')}
            </div>
          )}

          {/* Hint for more characters */}
          {searchTerm.trim().length === 1 && (
            <div className="px-4 py-3 text-xs text-gray-400 text-center">
              {t('orders.new.customer.autocomplete.minChars')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
