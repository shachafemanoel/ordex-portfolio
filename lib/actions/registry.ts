import { z } from 'zod';

export type ActionUIType = 'inline' | 'modal' | 'drawer' | 'confirm';

export interface ActionDefinition<TEntity = any, TPayload = any> {
  id: string;
  label: string;
  entityType: string;
  description?: string;
  icon?: any; // Lucide icon component or name
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';

  // Availability Logic
  isAvailable: (entity: TEntity) => boolean;
  unavailableReason?: (entity: TEntity) => string | null;

  // UI Configuration
  ui: {
    type: ActionUIType;
    componentKey?: string; // Key to lookup component in renderer
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
    title?: string; // Modal/Drawer title
    description?: string; // Modal/Drawer description
    confirmMessage?: string; // For 'confirm' type
  };

  // Data Validation
  payloadSchema?: z.ZodType<TPayload>;

  // API Configuration
  api?: {
    method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE'; // Defaults to POST
  };
}

export type ActionRegistry = Record<string, ActionDefinition[]>;
