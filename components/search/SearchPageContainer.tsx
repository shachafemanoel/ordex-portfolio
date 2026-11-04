'use client';

import { globalSearch, type GlobalSearchResult } from '@/app/actions/globalSearch';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/card';
import { ListPageTemplate } from '@/components/layout/ListPageTemplate';
import { cn } from '@/lib/utils';
import { Filter, Search, ShoppingCart, User, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

type SearchFilter = 'all' | 'order' | 'customer';

type SearchFilterOption = {
  value: SearchFilter;
  label: string;
};

const SEARCH_FILTERS: SearchFilterOption[] = [
  { value: 'all', label: 'הכל' },
  { value: 'order', label: 'הזמנות' },
  { value: 'customer', label: 'לקוחות' },
];

function getResultIcon(type: GlobalSearchResult['type']) {
  return type === 'order' ? ShoppingCart : User;
}

function getResultLabel(type: GlobalSearchResult['type']) {
  return type === 'order' ? 'הזמנה' : 'לקוח';
}

function getBadgeVariant(type: GlobalSearchResult['type']) {
  return type === 'order' ? 'info' : 'warning';
}

interface SearchAutocompleteProps {
  items: GlobalSearchResult[];
  highlightedIndex: number;
  isLoading: boolean;
  query: string;
  onSelect: (item: GlobalSearchResult) => void;
  onSearch: () => void;
  onHover: (index: number) => void;
}

function SearchAutocomplete({
  items,
  highlightedIndex,
  isLoading,
  query,
  onSelect,
  onSearch,
  onHover,
}: SearchAutocompleteProps) {
  if (isLoading) {
    return <div className="px-4 py-3 text-sm text-[var(--color-text-secondary)]">מחפש הצעות...</div>;
  }

  if (items.length === 0) {
    return (
      <button
        onClick={onSearch}
        className="w-full px-4 py-3 text-right text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-primary-50)]"
      >
        חפש עבור &quot;{query}&quot;
      </button>
    );
  }

  return (
    <div className="max-h-72 overflow-y-auto py-1">
      <button
        onClick={onSearch}
        className={cn(
          'w-full border-b border-[var(--color-border-primary)] px-4 py-2.5 text-right text-sm font-medium',
          highlightedIndex === -1
            ? 'bg-[var(--tone-info-bg)] text-[var(--tone-info-text)]'
            : 'text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-primary-50)]'
        )}
      >
        חפש עבור &quot;{query}&quot;
      </button>
      {items.map((item, index) => {
        const Icon = getResultIcon(item.type);

        return (
          <button
            key={`${item.type}-${item.id}`}
            onClick={() => onSelect(item)}
            onMouseEnter={() => onHover(index)}
            className={cn(
              'flex w-full items-center gap-3 px-4 py-2.5 text-right transition-colors',
              highlightedIndex === index
                ? 'bg-[var(--color-primary-50)]'
                : 'hover:bg-[var(--color-bg-secondary)]'
            )}
          >
            <div className="tone-info flex h-8 w-8 items-center justify-center rounded-lg">
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                {item.title}
              </div>
              <div className="truncate text-xs text-[var(--color-text-secondary)]">
                {item.subtitle}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

interface SearchFilterBarProps {
  activeFilter: SearchFilter;
  onChange: (filter: SearchFilter) => void;
}

function SearchFilterBar({ activeFilter, onChange }: SearchFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Filter className="h-5 w-5 text-[var(--color-text-secondary)]" />
      <span className="text-sm font-medium text-[var(--color-text-secondary)]">סינון:</span>
      {SEARCH_FILTERS.map((filter) => (
        <Button
          key={filter.value}
          type="button"
          size="sm"
          variant={activeFilter === filter.value ? 'primary' : 'secondary'}
          onClick={() => onChange(filter.value)}
        >
          {filter.label}
        </Button>
      ))}
      {activeFilter !== 'all' ? (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="me-auto h-9 w-9"
          aria-label="אפס סינון"
          onClick={() => onChange('all')}
        >
          <X className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
}

function SearchLoadingState() {
  return (
    <div className="py-12 text-center">
      <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary-600)] border-r-transparent" />
      <p className="mt-4 text-[var(--color-text-secondary)]">מחפש...</p>
    </div>
  );
}

function SearchEmptyState() {
  return (
    <Card className="p-12 text-center">
      <Search className="mx-auto mb-4 h-16 w-16 text-[var(--color-text-tertiary)]" />
      <h3 className="mb-2 text-lg font-semibold text-[var(--color-text-primary)]">לא נמצאו תוצאות</h3>
      <p className="text-[var(--color-text-secondary)]">נסה לחפש עם מילות חיפוש אחרות</p>
    </Card>
  );
}

interface SearchResultCardProps {
  result: GlobalSearchResult;
}

function SearchResultCard({ result }: SearchResultCardProps) {
  const Icon = getResultIcon(result.type);

  return (
    <Link key={`${result.type}-${result.id}`} href={result.url}>
      <Card className="p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]">
        <div className="flex items-start gap-4">
          <div className="surface-subtle flex h-12 w-12 items-center justify-center rounded-xl">
            <Icon className="h-6 w-6 text-[var(--color-primary-600)]" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <h3 className="truncate font-semibold text-[var(--color-text-primary)]">
                {result.title}
              </h3>
              <Badge variant={getBadgeVariant(result.type)}>{getResultLabel(result.type)}</Badge>
            </div>
            <p className="text-sm text-[var(--color-text-secondary)]">{result.subtitle}</p>
          </div>
        </div>
      </Card>
    </Link>
  );
}

export function SearchPageContainer() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get('q') || '';
  const [searchInput, setSearchInput] = useState(query);
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [autocompleteResults, setAutocompleteResults] = useState<GlobalSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAutocompleteLoading, setIsAutocompleteLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<SearchFilter>('all');
  const [isAutocompleteOpen, setIsAutocompleteOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const debouncedInput = useMemo(() => searchInput.trim(), [searchInput]);

  useEffect(() => {
    setSearchInput(query);
  }, [query]);

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    let cancelled = false;

    async function fetchResults() {
      setIsLoading(true);
      try {
        const data = await globalSearch(query);
        if (!cancelled) {
          setResults(data);
        }
      } catch (error) {
        console.error('Failed to fetch search results', error);
        if (!cancelled) {
          setResults([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void fetchResults();

    return () => {
      cancelled = true;
    };
  }, [query]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (debouncedInput.length < 2) {
        setAutocompleteResults([]);
        setIsAutocompleteLoading(false);
        return;
      }

      setIsAutocompleteLoading(true);
      try {
        const data = await globalSearch(debouncedInput);
        setAutocompleteResults(data.slice(0, 8));
      } catch (error) {
        console.error('Failed to fetch autocomplete results', error);
        setAutocompleteResults([]);
      } finally {
        setIsAutocompleteLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [debouncedInput]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsAutocompleteOpen(false);
        setHighlightedIndex(-1);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredResults =
    activeFilter === 'all' ? results : results.filter((result) => result.type === activeFilter);
  const pageDescription = query
    ? `תוצאות עבור "${query}"`
    : 'חפש לקוחות והזמנות ממקום אחד בעזרת אותם רכיבי UI והמשטחים המשותפים.';

  const submitSearch = (nextQuery: string) => {
    const trimmed = nextQuery.trim();
    if (!trimmed) {
      router.replace('/search');
      return;
    }

    router.replace(`/search?q=${encodeURIComponent(trimmed)}`);
    setIsAutocompleteOpen(false);
    setHighlightedIndex(-1);
  };

  const handleAutocompleteSelect = (item: GlobalSearchResult) => {
    setIsAutocompleteOpen(false);
    setHighlightedIndex(-1);
    router.push(item.url);
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isAutocompleteOpen || autocompleteResults.length === 0) {
      if (event.key === 'Enter') {
        event.preventDefault();
        submitSearch(searchInput);
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % autocompleteResults.length);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((prev) => (prev <= 0 ? autocompleteResults.length - 1 : prev - 1));
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < autocompleteResults.length) {
        handleAutocompleteSelect(autocompleteResults[highlightedIndex]);
      } else {
        submitSearch(searchInput);
      }
      return;
    }

    if (event.key === 'Escape') {
      setIsAutocompleteOpen(false);
      setHighlightedIndex(-1);
    }
  };

  return (
    <ListPageTemplate
      title="חיפוש חכם"
      description={pageDescription}
      className="mx-auto max-w-4xl"
      isEmpty={!isLoading && filteredResults.length === 0}
      emptyState={{
        title: 'לא נמצאו תוצאות',
        description: query ? 'נסה לחפש עם מילות חיפוש אחרות.' : 'התחל להקליד כדי לחפש הזמנות או לקוחות.',
      }}
      filters={
        <div ref={containerRef} className="space-y-4">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
            <Input
              type="text"
              value={searchInput}
              onChange={(event) => {
                setSearchInput(event.target.value);
                setIsAutocompleteOpen(event.target.value.trim().length >= 2);
                setHighlightedIndex(-1);
              }}
              onFocus={() => {
                if (searchInput.trim().length >= 2) {
                  setIsAutocompleteOpen(true);
                }
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder="חפש הזמנה או לקוח..."
              className="ps-10 pe-10"
            />
            {searchInput ? (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="absolute left-2 top-1/2 h-8 w-8 -translate-y-1/2"
                aria-label="נקה חיפוש"
                onClick={() => {
                  setSearchInput('');
                  setAutocompleteResults([]);
                  setIsAutocompleteOpen(false);
                  setHighlightedIndex(-1);
                  router.replace('/search');
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            ) : null}
          </div>

          {isAutocompleteOpen && searchInput.trim().length >= 2 ? (
            <Card className="overflow-hidden p-0">
              <SearchAutocomplete
                items={autocompleteResults}
                highlightedIndex={highlightedIndex}
                isLoading={isAutocompleteLoading}
                query={searchInput.trim()}
                onSelect={handleAutocompleteSelect}
                onSearch={() => submitSearch(searchInput)}
                onHover={setHighlightedIndex}
              />
            </Card>
          ) : null}

          <SearchFilterBar activeFilter={activeFilter} onChange={setActiveFilter} />
        </div>
      }
    >
      {isLoading ? (
        <SearchLoadingState />
      ) : (
        <div className="space-y-3 p-4 sm:p-5">
          <p className="text-sm text-[var(--color-text-secondary)]">נמצאו {filteredResults.length} תוצאות</p>

          {filteredResults.map((result) => (
            <SearchResultCard key={`${result.type}-${result.id}`} result={result} />
          ))}
        </div>
      )}
    </ListPageTemplate>
  );
}
