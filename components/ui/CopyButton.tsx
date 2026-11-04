'use client';

import { Button } from '@/components/ui/Button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/Tooltip';
import { cn } from '@/lib/utils';
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

interface CopyButtonProps {
  text: string;
  label?: string;
  className?: string;
  iconSize?: 'xs' | 'sm' | 'md';
}

export function CopyButton({ text, label = 'העתק', className, iconSize = 'sm' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const iconDimensions = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
  };

  return (
    <Tooltip delayDuration={300} open={copied || isOpen} onOpenChange={setIsOpen}>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="xs"
          onClick={handleCopy}
          className={cn('h-6 w-6 p-0 hover:bg-neutral-100 rounded-full', className)}
          aria-label={copied ? 'הועתק!' : label}
        >
          {copied ? (
            <Check className={cn('text-green-600', iconDimensions[iconSize])} />
          ) : (
            <Copy className={cn('text-neutral-500', iconDimensions[iconSize])} />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{copied ? 'הועתק!' : label}</p>
      </TooltipContent>
    </Tooltip>
  );
}
