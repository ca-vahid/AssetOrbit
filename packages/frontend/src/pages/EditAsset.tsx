import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, X } from 'lucide-react';
import { assetsApi, departmentsApi, locationsApi, vendorsApi, usersApi, type Asset as ApiAsset } from '../services/api';
import { useCustomFields } from '../hooks/useCustomFields';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

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
  assignedToId?: string;
  departmentId?: string;
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

const ASSET_TYPES = [
  { value: 'LAPTOP', label: 'Laptop' },
  { value: 'DESKTOP', label: 'Desktop' },
  { value: 'TABLET', label: 'Tablet' },
  { value: 'PHONE', label: 'Phone' },
  { value: 'OTHER', label: 'Other' },
];

const ASSET_STATUSES = [
  { value: 'AVAILABLE', label: 'Available' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'SPARE', label: 'Spare' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'RETIRED', label: 'Retired' },
  { value: 'DISPOSED', label: 'Disposed' },
];

const ASSET_CONDITIONS = [
  { value: 'NEW', label: 'New' },
  { value: 'GOOD', label: 'Good' },
  { value: 'FAIR', label: 'Fair' },
  { value: 'POOR', label: 'Poor' },
];

const EditAsset: React.FC<EditAssetProps> = ({ asset: propAsset, onSave, onCancel, isModal = false }) => {
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();
  
  // Debug logging
  console.log('EditAsset render:', { propAsset: !!propAsset, isModal, id });
  
  // If asset is passed as prop, use it; otherwise fetch from API
  const { data: fetchedAsset, isLoading: assetLoading } = useQuery({
    queryKey: ['asset', id],
    queryFn: () => assetsApi.getById(id!),
    enabled: !propAsset && !!id,
  });
  
  const asset = propAsset || fetchedAsset;
  
  // When propAsset is provided, we're not loading
  const isActuallyLoading = propAsset ? false : assetLoading;
  
  const { data: customFields, isLoading: customFieldsLoading } = useCustomFields();
  
  // Fetch dropdown data
  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsApi.getAll(),
  });
  
  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: () => locationsApi.getAll(),
  });
  
  const { data: vendors } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => vendorsApi.getAll(),
  });
  
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.getAll(),
  });

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

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isDirty },
  } = useForm<AssetFormData>();

  const watchedStatus = watch('status');

  // Reset form when asset data is loaded
  useEffect(() => {
    if (asset) {
      const formData: AssetFormData = {
        assetTag: asset.assetTag,
        assetType: asset.assetType,
        status: asset.status,
        condition: asset.condition,
        make: asset.make,
        model: asset.model,
        serialNumber: asset.serialNumber || '',
        assignedToId: asset.assignedTo?.id || '',
        departmentId: asset.department?.id || '',
        locationId: asset.location?.id || '',
        purchaseDate: asset.purchaseDate ? asset.purchaseDate.split('T')[0] : '',
        purchasePrice: asset.purchasePrice ? parseFloat(asset.purchasePrice) : undefined,
        vendorId: asset.vendor?.id || '',
        warrantyEndDate: asset.warrantyEndDate ? asset.warrantyEndDate.split('T')[0] : '',
        notes: asset.notes || '',
      };

      // Add custom field values
      if (asset.customFields && customFields) {
        console.log('Setting custom field values:', { assetCustomFields: asset.customFields, customFields });
        customFields.forEach((field) => {
          const value = asset.customFields![field.id];
          console.log(`Custom field ${field.name} (${field.id}):`, value);
          if (value !== undefined && value !== null) {
            formData[`custom_${field.id}`] = value;
          }
        });
      }

      reset(formData);
    }
  }, [asset, customFields, reset]);

  const onSubmit = async (data: AssetFormData) => {
    try {
      // Extract custom field values
      const customFieldValues: Record<string, any> = {};
      customFields?.forEach((field) => {
        const value = data[`custom_${field.id}`];
        if (value !== undefined && value !== '') {
          customFieldValues[field.id] = value;
        }
      });

      // Build payload
      const payload = {
        assetTag: data.assetTag,
        assetType: data.assetType,
        status: data.status,
        condition: data.condition,
        make: data.make,
        model: data.model,
        serialNumber: data.serialNumber || null,
        assignedToId: data.assignedToId || null,
        departmentId: data.departmentId || null,
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

  const renderCustomField = (field: any) => {
    const fieldName = `custom_${field.id}`;
    const isRequired = field.isRequired;

    switch (field.fieldType) {
      case 'STRING':
        return (
          <div key={field.id}>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {field.name} {isRequired && <span className="text-red-500">*</span>}
            </label>
            <input
              {...register(fieldName, { 
                required: isRequired ? `${field.name} is required` : false 
              })}
                             className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
             />
             {errors[fieldName] && (
               <p className="text-red-500 text-sm mt-1">{String(errors[fieldName]?.message)}</p>
             )}
           </div>
         );

       case 'NUMBER':
        return (
          <div key={field.id}>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {field.name} {isRequired && <span className="text-red-500">*</span>}
            </label>
            <input
              type="number"
              {...register(fieldName, { 
                required: isRequired ? `${field.name} is required` : false,
                valueAsNumber: true,
              })}
                             className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
             />
             {errors[fieldName] && (
               <p className="text-red-500 text-sm mt-1">{String(errors[fieldName]?.message)}</p>
             )}
           </div>
         );

       case 'SINGLE_SELECT':
        const options = field.options || [];
        console.log(`SINGLE_SELECT field ${field.name} options:`, options);
        return (
          <div key={field.id}>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {field.name} {isRequired && <span className="text-red-500">*</span>}
            </label>
            <select
              {...register(fieldName, { 
                required: isRequired ? `${field.name} is required` : false 
              })}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            >
              <option value="">Select {field.name}</option>
              {options.map((option: string) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
                         </select>
             {errors[fieldName] && (
               <p className="text-red-500 text-sm mt-1">{String(errors[fieldName]?.message)}</p>
             )}
           </div>
         );

       case 'DATE':
        return (
          <div key={field.id}>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {field.name} {isRequired && <span className="text-red-500">*</span>}
            </label>
            <input
              type="date"
              {...register(fieldName, { 
                required: isRequired ? `${field.name} is required` : false 
              })}
                             className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
             />
             {errors[fieldName] && (
               <p className="text-red-500 text-sm mt-1">{String(errors[fieldName]?.message)}</p>
             )}
           </div>
         );

       case 'BOOLEAN':
        return (
          <div key={field.id} className="flex items-center">
            <input
              type="checkbox"
              {...register(fieldName)}
              className="w-4 h-4 text-brand-600 border-slate-300 rounded focus:ring-brand-500"
            />
            <label className="ml-2 text-sm text-slate-700 dark:text-slate-300">
              {field.name}
            </label>
          </div>
        );

      default:
        return null;
    }
  };

  // Debug the loading states
  console.log('EditAsset loading states:', { 
    assetLoading, 
    isActuallyLoading,
    customFieldsLoading, 
    asset: !!asset, 
    propAsset: !!propAsset,
    customFields: !!customFields 
  });

  // Only show loading if we're fetching asset data (not when asset is passed as prop)
  if (isActuallyLoading || (!propAsset && customFieldsLoading)) {
    console.log('EditAsset showing loading spinner');
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
    <div className={isModal ? 'space-y-6' : 'space-y-6'}>
      {!isModal && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Edit Asset
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              Update asset information
            </p>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-4 h-4" />
            Cancel
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Information */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-glass border border-white/20 dark:border-slate-700/50 p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Basic Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Asset Tag <span className="text-red-500">*</span>
              </label>
              <input
                {...register('assetTag', { required: 'Asset tag is required' })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
              {errors.assetTag && (
                <p className="text-red-500 text-sm mt-1">{errors.assetTag.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Asset Type <span className="text-red-500">*</span>
              </label>
              <select
                {...register('assetType', { required: 'Asset type is required' })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              >
                {ASSET_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Make <span className="text-red-500">*</span>
              </label>
              <input
                {...register('make', { required: 'Make is required' })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
              {errors.make && (
                <p className="text-red-500 text-sm mt-1">{errors.make.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Model <span className="text-red-500">*</span>
              </label>
              <input
                {...register('model', { required: 'Model is required' })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
              {errors.model && (
                <p className="text-red-500 text-sm mt-1">{errors.model.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Serial Number
              </label>
              <input
                {...register('serialNumber')}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Status
              </label>
              <select
                {...register('status')}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              >
                {ASSET_STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Condition
              </label>
              <select
                {...register('condition')}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              >
                {ASSET_CONDITIONS.map((condition) => (
                  <option key={condition.value} value={condition.value}>
                    {condition.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Assignment & Location */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-glass border border-white/20 dark:border-slate-700/50 p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Assignment & Location
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {watchedStatus === 'ASSIGNED' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Assigned To
                </label>
                <select
                  {...register('assignedToId')}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                >
                  <option value="">Select User</option>
                  {users?.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.displayName} ({user.email})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Department
              </label>
              <select
                {...register('departmentId')}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              >
                <option value="">Select Department</option>
                {departments?.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Location
              </label>
              <select
                {...register('locationId')}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              >
                <option value="">Select Location</option>
                {locations?.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Custom Fields */}
        {customFields && customFields.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-glass border border-white/20 dark:border-slate-700/50 p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
              Additional Attributes
            </h2>
            {customFieldsLoading ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {customFields.map(renderCustomField)}
              </div>
            )}
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={updateMutation.isPending || !isDirty}
            className="flex items-center gap-2 px-6 py-3 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Save className="w-4 h-4" />
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="px-6 py-3 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );

  if (isModal) {
    return content;
  }

  return content;
};

export default EditAsset; 