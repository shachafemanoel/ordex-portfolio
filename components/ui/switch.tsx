import { cn } from '@/lib/utils';
import { InputHTMLAttributes, forwardRef } from 'react';

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  onCheckedChange?: (checked: boolean) => void;
}

const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, onCheckedChange, checked, onChange, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (typeof onCheckedChange === 'function') {
        onCheckedChange(e.target.checked);
      }
      if (typeof onChange === 'function') {
        onChange(e);
      }
    };

    return (
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          className="sr-only peer"
          ref={ref}
          checked={checked}
          onChange={handleChange}
          {...props}
        />
        <div
          className={cn(
            'w-12 h-6 bg-slate-200 dark:bg-slate-800 border-2 border-black dark:border-white transition-all',
            'peer-focus:outline-none peer-focus:shadow-[0_0_0_2px_#0055ff]',
            'rounded-none peer',
            'peer-checked:bg-[#0055ff]',
            'after:content-[""] after:absolute after:top-[4px] after:start-[4px] after:bg-black dark:after:bg-white after:border-none after:rounded-none after:h-4 after:w-4 after:transition-all',
            'peer-checked:after:translate-x-6 rtl:peer-checked:after:-translate-x-6',
            className
          )}
        />
      </label>
    );
  }
);
Switch.displayName = 'Switch';

export { Switch };
