import { useQuery } from '@tanstack/react-query';
import { assetFieldsApi, type AssetFieldMeta } from '../services/api';

export const useAssetFields = () => {
  return useQuery<AssetFieldMeta[]>({
    queryKey: ['assetFields'],
    queryFn: () => assetFieldsApi.getAll(),
    staleTime: 1000 * 60 * 10, // 10 mins
  });
}; 