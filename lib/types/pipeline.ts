export type PipelineStage = {
  id: string;
  label: string;
  value: number;
  status: 'completed' | 'active' | 'pending' | 'warning';
  lastUpdated?: string;
  assignee?: {
    name: string;
    avatarUrl?: string;
    initials: string;
  };
};
