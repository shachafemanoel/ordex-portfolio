'use client';

import { cn } from '@/lib/utils';
import { Loader2, MapPin } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/Input';

function useDebounce<T>(value: T, delay: number): [T] {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return [debouncedValue];
}

export interface ParsedAddress {
  street: string;
  streetNumber: string;
  city: string;
  postalCode: string;
  country: string;
  formattedAddress: string;
  placeId: string;
  lat: number;
  lng: number;
}

interface Suggestion {
  id: string;
  mainText: string;
  secondaryText: string;
  fullAddress: string;
  street: string;
  streetNumber: string;
  city: string;
  postalCode: string;
  country: string;
  lat: number;
  lng: number;
}

interface PlacesAutocompleteProps extends React.HTMLAttributes<HTMLDivElement> {
  onAddressSelect: (address: ParsedAddress) => void;
  apiKey?: string;
  placeholder?: string;
  defaultValue?: string;
}

export function PlacesAutocomplete({
  onAddressSelect,
  className,
  placeholder,
  defaultValue = '',
  ...props
}: PlacesAutocompleteProps) {
  const [inputValue, setInputValue] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [debouncedValue] = useDebounce(inputValue, 300);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Fetch suggestions from Mapbox via server proxy
  useEffect(() => {
    if (!debouncedValue || debouncedValue.length < 2) {
      setSuggestions([]);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    fetch(`/api/maps/autocomplete?q=${encodeURIComponent(debouncedValue)}`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error('Search failed');
        return res.json();
      })
      .then((data: { suggestions: Suggestion[] }) => {
        setSuggestions(data.suggestions || []);
        if (data.suggestions?.length > 0) setIsOpen(true);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setSuggestions([]);
          setError('שגיאה בחיפוש כתובת');
        }
      })
      .finally(() => {
        setIsLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [debouncedValue]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (suggestion: Suggestion) => {
    const displayText = [suggestion.street, suggestion.streetNumber, suggestion.city]
      .filter(Boolean)
      .join(' ');
    setInputValue(displayText || suggestion.fullAddress);
    setIsOpen(false);

    onAddressSelect({
      street: suggestion.street,
      streetNumber: suggestion.streetNumber,
      city: suggestion.city,
      postalCode: suggestion.postalCode,
      country: suggestion.country,
      formattedAddress: suggestion.fullAddress,
      placeId: suggestion.id,
      lat: suggestion.lat,
      lng: suggestion.lng,
    });
  };

  return (
    <div ref={wrapperRef} className={cn('relative w-full', className)} {...props}>
      <div className="relative">
        <Input
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            if (!e.target.value) setIsOpen(false);
          }}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder || 'חפש כתובת...'}
          className={cn(error && 'border-red-500')}
          dir="rtl"
        />
        {isLoading && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}

      {isOpen && suggestions.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto py-1 text-sm">
          {suggestions.map((suggestion) => (
            <li
              key={suggestion.id}
              onClick={() => handleSelect(suggestion)}
              className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-start gap-2"
              dir="rtl"
            >
              <MapPin className="h-4 w-4 mt-0.5 text-gray-400 shrink-0" />
              <div>
                <div className="font-medium text-gray-900">
                  {suggestion.mainText}
                </div>
                <div className="text-xs text-gray-500">
                  {suggestion.secondaryText}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
