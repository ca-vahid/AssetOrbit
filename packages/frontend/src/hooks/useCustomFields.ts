import { useQuery } from '@tanstack/react-query';
import { customFieldsApi } from '../services/api';
import type { CustomField } from '@ats/shared';

export const useCustomFields = () => {
  return useQuery<CustomField[]>({
    queryKey: ['customFields'],
    queryFn: () => customFieldsApi.getAll(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}; 