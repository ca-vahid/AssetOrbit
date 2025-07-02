import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { assetsApi, type Asset as ApiAsset, type StaffMember } from '../services/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AssetForm from '../components/AssetForm';

interface EditAssetProps {
  asset?: ApiAsset;
  onSave?: (asset: ApiAsset) => void;
  onCancel?: () => void;
  isModal?: boolean;
}

interface AssetFormData {
  assetTag: string;
  assetType: string;
  status: string;
  condition: string;
  make: string;
  model: string;
  serialNumber?: string;
  assignedToAadId?: string;
  categoryIds?: string[];
  locationId?: string;
  purchaseDate?: string;
  purchasePrice?: number;
  vendorId?: string;
  warrantyStartDate?: string;
  warrantyEndDate?: string;
  warrantyNotes?: string;
  notes?: string;
  [key: string]: any;
}

const EditAsset: React.FC<EditAssetProps> = ({ asset: propAsset, onSave, onCancel, isModal = false }) => {
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();
  
  // State for initial staff member
  const [initialStaff, setInitialStaff] = useState<StaffMember | null>(null);
  const [initialData, setInitialData] = useState<Partial<AssetFormData>>({});
  
  // If asset is passed as prop, use it; otherwise fetch from API
  const { data: fetchedAsset, isLoading: assetLoading } = useQuery({
    queryKey: ['asset', id],
    queryFn: () => assetsApi.getById(id!),
    enabled: !propAsset && !!id,
  });
  
  const asset = propAsset || fetchedAsset;
  
  // When propAsset is provided, we're not loading
  const isActuallyLoading = propAsset ? false : assetLoading;

  const updateMutation = useMutation({
    mutationFn: (data: any) => assetsApi.update(asset!.id, data),
    onSuccess: (updatedAsset) => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['asset', asset!.id] });
      
      if (onSave) {
        onSave(updatedAsset);
      } else {
        navigate('/assets');
      }
    },
  });

  // Prepare initial data when asset is loaded
  useEffect(() => {
    if (asset) {
      const formData: Partial<AssetFormData> = {
        assetTag: asset.assetTag,
        assetType: asset.assetType,
        status: asset.status,
        condition: asset.condition,
        make: asset.make,
        model: asset.model,
        serialNumber: asset.serialNumber || '',
        assignedToAadId: asset.assignedToAadId || '',
        categoryIds: asset.workloadCategories?.map(cat => cat.id) || [],
        locationId: asset.location?.id || '',
        purchaseDate: asset.purchaseDate ? asset.purchaseDate.split('T')[0] : '',
        purchasePrice: asset.purchasePrice ? parseFloat(asset.purchasePrice) : undefined,
        vendorId: asset.vendor?.id || '',
        warrantyEndDate: asset.warrantyEndDate ? asset.warrantyEndDate.split('T')[0] : '',
        notes: asset.notes || '',
      };

      // Add custom field values
      if (asset.customFields) {
        Object.entries(asset.customFields).forEach(([fieldId, value]) => {
          if (value !== undefined && value !== null) {
            formData[`custom_${fieldId}`] = value;
          }
        });
      }

      setInitialData(formData);

      // Set initial staff member if assigned
      if (asset.assignedToAadId && asset.assignedToStaff) {
        setInitialStaff(asset.assignedToStaff);
      } else {
        setInitialStaff(null);
      }
    }
  }, [asset]);

  const handleSubmit = async (data: AssetFormData, selectedStaff: StaffMember | null) => {
    try {
      // Extract custom field values
      const customFieldValues: Record<string, any> = {};
      Object.keys(data).forEach(key => {
        if (key.startsWith('custom_')) {
          const fieldId = key.replace('custom_', '');
          customFieldValues[fieldId] = data[key];
        }
      });

      // Build payload with staff assignment only
      const payload = {
        assetTag: data.assetTag,
        assetType: data.assetType,
        status: data.status,
        condition: data.condition,
        make: data.make,
        model: data.model,
        serialNumber: data.serialNumber || null,
        // Only staff assignment supported now
        assignedToId: null,
        assignedToAadId: selectedStaff?.id || null,
        categoryIds: data.categoryIds || [],
        locationId: data.locationId || null,
        purchaseDate: data.purchaseDate || null,
        purchasePrice: data.purchasePrice || null,
        vendorId: data.vendorId || null,
        warrantyEndDate: data.warrantyEndDate || null,
        notes: data.notes || null,
        customFields: customFieldValues,
      };

      updateMutation.mutate(payload);
    } catch (error) {
      console.error('Error updating asset:', error);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      navigate('/assets');
    }
  };

  // Only show loading if we're fetching asset data
  if (isActuallyLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500 dark:text-slate-400">Asset not found.</p>
      </div>
    );
  }

  const content = (
    <AssetForm
      initialData={initialData}
      initialStaff={initialStaff}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      isSubmitting={updateMutation.isPending}
      submitButtonText="Save Changes"
      title="Edit Asset"
      subtitle="Update asset information and assignments"
    />
  );

  if (isModal) {
    return (
      <div className="space-y-6">
        {content}
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {content}
    </div>
  );
};

export default EditAsset; 