import { useMutation } from '@tanstack/react-query';
import { api } from '../services/api';

interface ResolvePayload {
  usernames: string[];
  locations: string[];
  serialNumbers: string[];
}

interface ResolveResponse {
  userMap: Record<string, { id: string; displayName: string; officeLocation?: string } | null>;
  locationMap: Record<string, string | null>;
  conflicts: Record<string, { id: string; assetTag: string; serialNumber: string }>;
}

export const useResolveImport = () => {
  return useMutation<ResolveResponse, unknown, ResolvePayload>(
    (payload) => api.post('/import/resolve', payload).then((res) => res.data),
    {
      // Automatically retry transient network / service errors (Graph throttling, etc.)
      retry: 3,
      // Exponential-backoff retry delay: 1s, 2s, 4s (max 8s)
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    },
  );
}; 