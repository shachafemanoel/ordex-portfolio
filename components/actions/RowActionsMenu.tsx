import { ActionDefinition } from '@/lib/actions/registry';
import { Button } from '@/components/ui/Button';
import { ActionRenderer } from '@/components/actions/ActionRenderer';
import { useState } from 'react';
import { useActionRunner } from '@/components/actions/useActionRunner';
import * as Icons from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';

interface RowActionsMenuProps<TEntity> {
  actions: ActionDefinition<TEntity>[];
  entity: TEntity;
  entityType: string;
  entityId: string;
}

export function RowActionsMenu<TEntity>({ actions, entity, entityType, entityId }: RowActionsMenuProps<TEntity>) {
  const [selectedAction, setSelectedAction] = useState<ActionDefinition<TEntity> | null>(null);
  const { runAction, isLoading } = useActionRunner({ entityType, entityId });

  const availableActions = actions.filter(a => a.isAvailable(entity));

  const handleActionClick = (action: ActionDefinition<TEntity>) => {
    setSelectedAction(action);
  };

  const handleConfirm = async (payload: any) => {
    if (selectedAction) {
      await runAction(selectedAction as ActionDefinition<unknown>, payload);
      setSelectedAction(null);
    }
  };

  const renderIcon = (iconName: any) => {
    if (!iconName) return null;
    if (typeof iconName === 'string') {
        const Icon = (Icons as any)[iconName];
        return Icon ? <Icon className="w-4 h-4 mr-2" /> : null;
    }
    return null;
  };

  // Primary action is the first one
  const primaryAction = availableActions.length > 0 ? availableActions[0] : null;
  const otherActions = availableActions.slice(1);

  if (availableActions.length === 0) return null;

  return (
    <div className="flex items-center gap-2 justify-end" onClick={(e) => e.stopPropagation()}>
      {primaryAction && (
        <Button
          onClick={(e) => { e.stopPropagation(); handleActionClick(primaryAction); }}
          variant={primaryAction.variant || 'outline'}
          disabled={isLoading}
          size="default"
          className="touch-manipulation"
        >
          {renderIcon(primaryAction.icon)}
          {primaryAction.label}
        </Button>
      )}

      {otherActions.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="touch-manipulation">
              <span className="sr-only">פתח תפריט</span>
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[180px]">
            {otherActions.map(action => (
              <DropdownMenuItem
                key={action.id}
                onClick={(e) => { e.stopPropagation(); handleActionClick(action); }}
                className="min-h-[44px] py-3 touch-manipulation"
              >
                {renderIcon(action.icon)}
                {action.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {selectedAction && (
        <ActionRenderer
          action={selectedAction as ActionDefinition<unknown>}
          isOpen={!!selectedAction}
          onClose={() => setSelectedAction(null)}
          entity={entity as unknown}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
}
