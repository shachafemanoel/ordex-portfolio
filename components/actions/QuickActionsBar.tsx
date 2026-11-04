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
} from '@/components/ui/dropdown-menu'; // Assuming this exists or similar

interface QuickActionsBarProps<TEntity> {
  actions: ActionDefinition<TEntity>[];
  entity: TEntity;
  entityType: string;
  entityId: string;
  className?: string;
  maxVisible?: number;
}

export function QuickActionsBar<TEntity>({
  actions,
  entity,
  entityType,
  entityId,
  className,
  maxVisible = 3
}: QuickActionsBarProps<TEntity>) {
  const [selectedAction, setSelectedAction] = useState<ActionDefinition<TEntity> | null>(null);
  const { runAction, isLoading } = useActionRunner({ entityType, entityId });

  const availableActions = actions.filter(a => a.isAvailable(entity));

  const visibleActions = availableActions.slice(0, maxVisible);
  const overflowActions = availableActions.slice(maxVisible);

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
    return null; // Or render component if it's a component
  };

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      {visibleActions.map(action => (
        <Button
          key={action.id}
          onClick={() => handleActionClick(action)}
          variant={action.variant || 'outline'}
          disabled={isLoading}
          size="default"
          className="touch-manipulation"
        >
          {renderIcon(action.icon)}
          {action.label}
        </Button>
      ))}

      {overflowActions.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="default" className="touch-manipulation">
              עוד...
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[180px]">
            {overflowActions.map(action => (
              <DropdownMenuItem
                key={action.id}
                onClick={() => handleActionClick(action)}
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
