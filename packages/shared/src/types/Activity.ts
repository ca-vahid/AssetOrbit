export interface Activity {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  details?: string;
  userId: string;
  user?: {
    id: string;
    displayName: string;
    email: string;
  };
  createdAt: string;
} 