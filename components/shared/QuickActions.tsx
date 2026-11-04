import { Button } from '@/components/ui/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Eye, LucideIcon, MessageCircle, MoreHorizontal, Phone } from 'lucide-react';
import Link from 'next/link';

export interface CustomAction {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  variant?: 'default' | 'destructive' | 'outline' | 'ghost' | 'link';
}

interface QuickActionsProps {
  phoneNumber?: string | null;
  whatsappNumber?: string | null;
  detailsLink?: string;
  onOpenDetails?: () => void;
  customActions?: CustomAction[];
  className?: string;
  size?: 'sm' | 'default' | 'lg' | 'icon';
  variant?: 'default' | 'ghost';
}

/**
 * Quick customer actions (call, WhatsApp, details, and optional custom actions).
 * Requires at least one customer contact channel for communication actions.
 */
export function QuickActions({
  phoneNumber,
  whatsappNumber,
  detailsLink,
  onOpenDetails,
  customActions = [],
  className,
  size = 'default',
  variant = 'default',
}: QuickActionsProps) {
  const whatsappTarget = whatsappNumber || phoneNumber;

  // Clean phone number for tel: link (remove spaces, dashes)
  const cleanPhone = phoneNumber?.replace(/[^\d+]/g, '');
  // Clean phone number for whatsapp (remove leading 0, add 972 if needed, or just keep digits)
  // Assuming input is relatively clean or local format.
  // Simple heuristic: if starts with 0, replace with 972.
  const cleanWhatsapp = whatsappTarget?.replace(/[^\d]/g, '').replace(/^0/, '972');

  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const buttonSize = size === 'sm' ? 'h-7 w-7' : 'h-9 w-9';

  const isGhost = variant === 'ghost';

  // Styles
  const validButtonClass = isGhost
    ? cn(
        buttonSize,
        'rounded-full text-on-bright-subtle hover:bg-[var(--color-bg-tertiary)] hover:text-on-bright-muted'
      )
    : cn(
        buttonSize,
        'rounded-full border-[var(--entity-surface-border)] bg-[var(--color-bg-secondary)] text-on-bright-muted hover:bg-primary-50 hover:border-primary-200 hover:text-primary-600'
      );

  const whatsappButtonClass = isGhost
    ? cn(
        buttonSize,
        'rounded-full text-on-bright-subtle hover:bg-[var(--color-bg-tertiary)] hover:text-on-bright-muted'
      )
    : cn(
        buttonSize,
        'rounded-full border-[var(--entity-surface-border)] bg-[var(--color-bg-secondary)] text-on-bright-muted hover:bg-primary-50 hover:border-primary-200 hover:text-primary-600'
      );

  const detailsButtonClass = cn(
    buttonSize,
    'rounded-full text-on-bright-subtle hover:bg-[var(--color-bg-tertiary)] hover:text-on-bright-muted'
  );

  return (
    <div className={cn('flex items-center gap-1', className)} onClick={(e) => e.stopPropagation()}>
      {/* Call Action */}
      {phoneNumber && (
        <a href={`tel:${cleanPhone}`} target="_blank" rel="noreferrer" title="התקשר">
          <Button variant={isGhost ? 'ghost' : 'outline'} size="icon" className={validButtonClass}>
            <Phone className={iconSize} />
            <span className="sr-only">התקשר</span>
          </Button>
        </a>
      )}

      {/* WhatsApp Action */}
      {whatsappTarget && (
        <a href={`https://wa.me/${cleanWhatsapp}?text=`} target="_blank" rel="noreferrer" title="שלח הודעת WhatsApp">
          <Button
            variant={isGhost ? 'ghost' : 'outline'}
            size="icon"
            className={whatsappButtonClass}
          >
            <MessageCircle className={iconSize} />
            <span className="sr-only">WhatsApp</span>
          </Button>
        </a>
      )}

      {/* Details Action (Direct Link or Button) */}
      {(detailsLink || onOpenDetails) &&
        (detailsLink ? (
          <Link href={detailsLink} title="צפה בפרטים">
            <Button variant="ghost" size="icon" className={detailsButtonClass}>
              <Eye className={iconSize} />
              <span className="sr-only">צפה בפרטים</span>
            </Button>
          </Link>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenDetails}
            title="צפה בפרטים"
            className={detailsButtonClass}
          >
            <Eye className={iconSize} />
            <span className="sr-only">צפה בפרטים</span>
          </Button>
        ))}

      {/* Custom Actions Dropdown */}
      {customActions.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className={detailsButtonClass}>
              <MoreHorizontal className={iconSize} />
              <span className="sr-only">More Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {customActions.map((action, idx) => {
              const ActionIcon = action.icon;
              return (
                <DropdownMenuItem
                  key={idx}
                  onClick={action.onClick}
                  className={
                    action.variant === 'destructive'
                      ? 'text-red-600 focus:text-red-600 focus:bg-red-50'
                      : ''
                  }
                >
                  {ActionIcon && <ActionIcon className="mr-2 h-4 w-4" />}
                  {action.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
