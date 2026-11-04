import { useMemo } from 'react';
import { ActionContext, checkActionPermission } from '@/shared/lib/quick-actions/action-permissions';
import {
  QUICK_ACTIONS,
  QuickActionSurface,
  getActionConfig,
} from '../lib/quick-actions/action-registry';

/**
 * Hook to retrieve allowed quick actions for a given context and surface.
 */
export function useQuickActions({
  context,
  surface,
}: {
  context: ActionContext;
  surface?: QuickActionSurface;
}) {
  const actions = useMemo(() => {
    // 1. Get all potential actions (or just the ones defined in the system)
    // In a real app, maybe we iterate keys of QUICK_ACTIONS or keys of 'allowedActions' from status config.
    // Status config gives 'allowedActions' strings. We map them to full config.

    // Strategy:
    // If context.status is present, get allowedActions from status-config, then map to QuickAction.
    // If not, maybe return global actions?

    // For this MVP, let's assume we want valid actions for the entity's status.

    let candidateIds: string[] = [];

    if (context.status) {
      // We import getOrderStatusConfig dynamically or use the allowedActions provided by backend/status-config
      // Importing status-config here might be circular if we are not careful, but hook depends on lib, so it's fine.
      // Actually, we can just use the registry + permission check.

      // Optimization: Iterate all QUICK_ACTIONS and check permission?
      // Or better: Use `status-config` to get the list of IDs directly.
      // But `checkActionPermission` uses `status-config`.

      // Let's iterate over ALL defined QUICK_ACTIONS and filter.
      candidateIds = Object.keys(QUICK_ACTIONS);
    } else {
      candidateIds = Object.keys(QUICK_ACTIONS);
    }

    return candidateIds
      .filter((id) => {
        // 1. Check Permissions
        if (!checkActionPermission(id, context)) return false;

        // 2. Check Surface (if specified)
        const config = getActionConfig(id);
        if (!config) return false;
        if (surface && !config.surface.includes(surface)) return false;

        return true;
      })
      .map((id) => getActionConfig(id)!) // map to config objects
      .sort((a, b) => {
        // efficient sort? maybe by definition order or explicit priority field
        return 0;
      });
  }, [context, surface]);

  return actions;
}
