import { useQuery } from '@tanstack/react-query';
import { getAdminMe, getStoreConfig } from '../lib/api';

export function useStoreConfig() {
  return useQuery({
    queryKey: ['store-config'],
    queryFn: ({ signal }) => getStoreConfig(signal),
    staleTime: 5 * 60 * 1000,
  });
}

export function useAdminMe() {
  return useQuery({
    queryKey: ['admin', 'me'],
    queryFn: ({ signal }) => getAdminMe(signal),
    retry: false,
    staleTime: 60 * 1000,
  });
}
