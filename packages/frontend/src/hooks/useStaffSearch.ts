import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { staffApi, type StaffMember } from '../services/api';
import { useDebounce } from './useDebounce';

export function useStaffSearch(initialQuery: string = '') {
  const [query, setQuery] = useState(initialQuery);
  const debouncedQuery = useDebounce(query, 300);

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['staff-search', debouncedQuery],
    queryFn: () => staffApi.search(debouncedQuery, 10),
    enabled: debouncedQuery.length >= 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const searchStaff = useCallback((searchQuery: string) => {
    setQuery(searchQuery);
  }, []);

  const clearSearch = useCallback(() => {
    setQuery('');
  }, []);

  return {
    query,
    searchStaff,
    clearSearch,
    results: data?.data || [],
    isLoading: isLoading && debouncedQuery.length >= 2,
    error,
    refetch,
    hasResults: (data?.count || 0) > 0,
  };
}

export function useStaffMember(aadId: string | null | undefined) {
  return useQuery({
    queryKey: ['staff-member', aadId],
    queryFn: () => staffApi.getById(aadId!),
    enabled: !!aadId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
} 