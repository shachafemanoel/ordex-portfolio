'use client';

import { Input } from '@/components/ui/Input';
import { Search, X } from 'lucide-react';

interface OrdersOpsSearchInputProps {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onClear: () => void;
}

export function OrdersOpsSearchInput({
  value,
  placeholder,
  onChange,
  onClear,
}: Readonly<OrdersOpsSearchInputProps>) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ops-icon-muted" />
      <Input
        placeholder={placeholder}
        className="h-11 rounded-full border-surface-soft bg-surface-translucent pr-11 text-sm text-fg shadow-none backdrop-blur-md transition-shadow focus:bg-surface-translucent-strong focus:shadow-md focus:shadow-primary-500/10"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {value ? (
        <button
          type="button"
          onClick={onClear}
          className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-ops-icon-muted transition-colors hover:bg-surface-translucent hover:text-fg"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
