import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Save, X, ChevronDown, Check, Tag, User, MapPin, Package, Calendar, DollarSign, FileText, Settings } from 'lucide-react';
import { categoriesApi, locationsApi, vendorsApi, type StaffMember, type WorkloadCategory } from '../services/api';
import { useCustomFields } from '../hooks/useCustomFields';
import { useQuery } from '@tanstack/react-query';
import StaffSearch from './StaffSearch';
import type { CustomField } from '@ats/shared';

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

interface AssetFormProps {
  initialData?: Partial<AssetFormData>;
  initialStaff?: StaffMember | null;
  onSubmit: (data: AssetFormData, selectedStaff: StaffMember | null) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
  submitButtonText?: string;
  title?: string;
  subtitle?: string;
}

// Multi-select component for workload categories
const WorkloadCategorySelector: React.FC<{
  value: string[];
  onChange: (value: string[]) => void;
  categories: WorkloadCategory[];
  disabled?: boolean;
}> = ({ value, onChange, categories, disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedCategories = categories.filter(cat => value.includes(cat.id));

  const toggleCategory = (categoryId: string) => {
    if (disabled) return;
    
    const newValue = value.includes(categoryId)
      ? value.filter(id => id !== categoryId)
      : [...value, categoryId];
    onChange(newValue);
  };

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:border-slate-400 dark:hover:border-slate-500"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Tag className="w-4 h-4 text-purple-500 flex-shrink-0" />
            <div className="flex-1 text-left">
              {selectedCategories.length === 0 ? (
                <span className="text-slate-500 dark:text-slate-400">Select workload categories...</span>
              ) : selectedCategories.length === 1 ? (
                <span className="font-medium">{selectedCategories[0].name}</span>
              ) : (
                <span className="font-medium">{selectedCategories.length} categories selected</span>
              )}
            </div>
          </div>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Selected Categories Preview */}
      {selectedCategories.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {selectedCategories.map((category) => (
            <span
              key={category.id}
              className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg text-sm font-medium border border-purple-200 dark:border-purple-700"
            >
              <div className="w-2 h-2 bg-purple-500 rounded-full" />
              {category.name}
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleCategory(category.id);
                  }}
                  className="ml-1 hover:bg-purple-200 dark:hover:bg-purple-800 rounded-full p-0.5 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="p-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <Tag className="w-4 h-4 text-purple-500" />
              Select Workload Categories
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {categories.map((category) => {
              const isSelected = value.includes(category.id);
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => toggleCategory(category.id)}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left"
                >
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200 ${
                    isSelected 
                      ? 'bg-purple-500 border-purple-500' 
                      : 'border-slate-300 dark:border-slate-600 hover:border-purple-400'
                  }`}>
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      {category.name}
                    </div>
                    {category.description && (
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        {category.description}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          {categories.length === 0 && (
            <div className="p-4 text-center text-slate-500 dark:text-slate-400">
              No workload categories available
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const ASSET_TYPES = [
  { value: 'LAPTOP', label: 'Laptop', icon: '💻' },
  { value: 'DESKTOP', label: 'Desktop', icon: '🖥️' },
  { value: 'TABLET', label: 'Tablet', icon: '📱' },
  { value: 'PHONE', label: 'Phone', icon: '📞' },
  { value: 'OTHER', label: 'Other', icon: '📦' },
];

const ASSET_STATUSES = [
  { value: 'AVAILABLE', label: 'Available', color: 'emerald' },
  { value: 'ASSIGNED', label: 'Assigned', color: 'blue' },
  { value: 'SPARE', label: 'Spare', color: 'amber' },
  { value: 'MAINTENANCE', label: 'Maintenance', color: 'orange' },
  { value: 'RETIRED', label: 'Retired', color: 'slate' },
  { value: 'DISPOSED', label: 'Disposed', color: 'red' },
];

const ASSET_CONDITIONS = [
  { value: 'NEW', label: 'New', color: 'emerald' },
  { value: 'GOOD', label: 'Good', color: 'blue' },
  { value: 'FAIR', label: 'Fair', color: 'amber' },
  { value: 'POOR', label: 'Poor', color: 'red' },
];

const AssetForm: React.FC<AssetFormProps> = ({
  initialData = {},
  initialStaff = null,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitButtonText = 'Save Changes',
  title = 'Asset Form',
  subtitle = 'Manage asset information'
}) => {
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(initialStaff);
  const { data: customFields, isLoading: customFieldsLoading } = useCustomFields();
  
  // Fetch dropdown data
  const { data: categories } = useQuery({
    queryKey: ['workload-categories'],
    queryFn: () => categoriesApi.getAll(),
  });
  
  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: () => locationsApi.getLocations(),
  });
  
  const { data: vendors } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => vendorsApi.getAll(),
  });

  const {
    register,
    handleSubmit,
    watch,
    reset,
    control,
    setValue,
    formState: { errors, isDirty },
  } = useForm<AssetFormData>({
    defaultValues: {
      assetType: 'LAPTOP',
      status: 'AVAILABLE',
      condition: 'GOOD',
      ...initialData,
    },
  });

  const watchedStatus = watch('status');

  // Reset form when initial data changes (only if we have initial data)
  useEffect(() => {
    if (Object.keys(initialData).length > 0) {
      reset({
        assetType: 'LAPTOP',
        status: 'AVAILABLE',
        condition: 'GOOD',
        ...initialData,
      });
      setSelectedStaff(initialStaff);
    }
  }, [initialData, initialStaff, reset]);

  // Handle staff selection changes and update form
  const handleStaffChange = (staff: StaffMember | null) => {
    setSelectedStaff(staff);
    setValue('assignedToAadId', staff?.id || '', { shouldDirty: true });
  };

  const handleFormSubmit = async (data: AssetFormData) => {
    await onSubmit(data, selectedStaff);
  };

  const renderCustomField = (field: CustomField) => {
    const fieldName = `custom_${field.id}`;
    const isRequired = field.isRequired;

    switch (field.fieldType) {
      case 'STRING':
        return (
          <div key={field.id}>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {field.name} {isRequired && <span className="text-red-500">*</span>}
            </label>
            <input
              {...register(fieldName, { 
                required: isRequired ? `${field.name} is required` : false 
              })}
              className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200 font-mono"
            />
            {errors[fieldName] && (
              <p className="text-red-500 text-sm mt-1">{String(errors[fieldName]?.message)}</p>
            )}
          </div>
        );

      case 'NUMBER':
        return (
          <div key={field.id}>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {field.name} {isRequired && <span className="text-red-500">*</span>}
            </label>
            <input
              type="number"
              {...register(fieldName, { 
                required: isRequired ? `${field.name} is required` : false,
                valueAsNumber: true,
              })}
              className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200 font-mono"
            />
            {errors[fieldName] && (
              <p className="text-red-500 text-sm mt-1">{String(errors[fieldName]?.message)}</p>
            )}
          </div>
        );

      case 'SINGLE_SELECT':
        const options = field.options || [];
        return (
          <div key={field.id}>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {field.name} {isRequired && <span className="text-red-500">*</span>}
            </label>
            <select
              {...register(fieldName, { 
                required: isRequired ? `${field.name} is required` : false 
              })}
              className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200 font-mono"
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

      // New case for MULTI_SELECT custom fields
      case 'MULTI_SELECT':
        const multiOptions = field.options || [];
        return (
          <div key={field.id}>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {field.name} {isRequired && <span className="text-red-500">*</span>}
            </label>
            <Controller
              name={fieldName}
              control={control}
              defaultValue={[]}
              rules={{
                validate: (val: any) =>
                  isRequired && (!val || val.length === 0)
                    ? `${field.name} is required`
                    : true,
              }}
              render={({ field: { value, onChange } }) => {
                // Ensure value is an array
                const selected: string[] = Array.isArray(value)
                  ? value
                  : typeof value === 'string'
                  ? (() => {
                      try {
                        return JSON.parse(value);
                      } catch {
                        return [];
                      }
                    })()
                  : [];

                const toggleOption = (option: string, checked: boolean) => {
                  if (checked) {
                    onChange([...selected, option]);
                  } else {
                    onChange(selected.filter((v) => v !== option));
                  }
                };

                return (
                  <div className="flex flex-col gap-2">
                    {multiOptions.map((option) => {
                      const isChecked = selected.includes(option);
                      return (
                        <label key={option} className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            className="w-5 h-5 text-brand-600 border-slate-300 rounded focus:ring-brand-500 transition-colors"
                            checked={isChecked}
                            onChange={(e) => toggleOption(option, e.target.checked)}
                          />
                          <span className="text-sm text-slate-700 dark:text-slate-300">{option}</span>
                        </label>
                      );
                    })}
                  </div>
                );
              }}
            />
            {errors[fieldName] && (
              <p className="text-red-500 text-sm mt-1">{String(errors[fieldName]?.message)}</p>
            )}
          </div>
        );

      case 'DATE':
        return (
          <div key={field.id}>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {field.name} {isRequired && <span className="text-red-500">*</span>}
            </label>
            <input
              type="date"
              {...register(fieldName, { 
                required: isRequired ? `${field.name} is required` : false 
              })}
              className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200 font-mono"
            />
            {errors[fieldName] && (
              <p className="text-red-500 text-sm mt-1">{String(errors[fieldName]?.message)}</p>
            )}
          </div>
        );

      case 'BOOLEAN':
        return (
          <div key={field.id} className="flex items-center space-x-3 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600">
            <input
              type="checkbox"
              {...register(fieldName)}
              className="w-5 h-5 text-brand-600 border-slate-300 rounded focus:ring-brand-500 transition-colors"
            />
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {field.name}
            </label>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            {title}
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            {subtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        >
          <X className="w-4 h-4" />
          Cancel
        </button>
      </div>

      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-8">
        {/* Basic Information */}
        <div className="bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-900/50 rounded-2xl shadow-lg border border-slate-200/50 dark:border-slate-700/50 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
              <Package className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Basic Information
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Asset Tag <span className="text-red-500">*</span>
              </label>
              <input
                {...register('assetTag', { required: 'Asset tag is required' })}
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200 font-mono"
                placeholder="e.g., LT-001"
              />
              {errors.assetTag && (
                <p className="text-red-500 text-sm mt-1">{errors.assetTag.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Asset Type <span className="text-red-500">*</span>
              </label>
              <select
                {...register('assetType', { required: 'Asset type is required' })}
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200"
              >
                {ASSET_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.icon} {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Make <span className="text-red-500">*</span>
              </label>
              <input
                {...register('make', { required: 'Make is required' })}
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200 font-mono"
                placeholder="e.g., Dell, Lenovo, HP"
              />
              {errors.make && (
                <p className="text-red-500 text-sm mt-1">{errors.make.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Model <span className="text-red-500">*</span>
              </label>
              <input
                {...register('model', { required: 'Model is required' })}
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200 font-mono"
                placeholder="e.g., Latitude 5420, ThinkPad X1"
              />
              {errors.model && (
                <p className="text-red-500 text-sm mt-1">{errors.model.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Serial Number
              </label>
              <input
                {...register('serialNumber')}
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200 font-mono"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Status
              </label>
              <select
                {...register('status')}
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200"
              >
                {ASSET_STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Condition
              </label>
              <select
                {...register('condition')}
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200"
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
        <div className="bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-900/50 rounded-2xl shadow-lg border border-slate-200/50 dark:border-slate-700/50 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-xl">
              <User className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Assignment & Location
            </h2>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {watchedStatus === 'ASSIGNED' && (
              <div className="lg:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
                  Assigned To Staff Member
                </label>
                
                {/* Staff Search */}
                <div>
                  <StaffSearch
                    value={selectedStaff?.id || null}
                    onChange={handleStaffChange}
                    placeholder="Search for staff member..."
                  />
                  {/* Hidden field to track staff assignment for form dirty state */}
                  <input
                    type="hidden"
                    {...register('assignedToAadId')}
                    value={selectedStaff?.id || ''}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Workload Categories
              </label>
              <Controller
                name="categoryIds"
                control={control}
                defaultValue={[]}
                render={({ field }) => (
                  <WorkloadCategorySelector
                    value={field.value || []}
                    onChange={field.onChange}
                    categories={categories || []}
                  />
                )}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Location
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <select
                  {...register('locationId')}
                  className="w-full pl-11 pr-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200"
                >
                  <option value="">Select Location</option>
                  {locations?.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.city}, {location.province}, {location.country}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Purchase & Warranty */}
        <div className="bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-900/50 rounded-2xl shadow-lg border border-slate-200/50 dark:border-slate-700/50 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
              <DollarSign className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Purchase & Warranty
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Purchase Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="date"
                  {...register('purchaseDate')}
                  className="w-full pl-11 pr-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Purchase Price
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="number"
                  step="0.01"
                  {...register('purchasePrice', { valueAsNumber: true })}
                  className="w-full pl-11 pr-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Vendor
              </label>
              <select
                {...register('vendorId')}
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200"
              >
                <option value="">Select Vendor</option>
                {vendors?.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Warranty End Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="date"
                  {...register('warrantyEndDate')}
                  className="w-full pl-11 pr-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-900/50 rounded-2xl shadow-lg border border-slate-200/50 dark:border-slate-700/50 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
              <FileText className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Notes
            </h2>
          </div>
          
          <textarea
            {...register('notes')}
            rows={4}
            className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200 resize-none"
            placeholder="Add any additional notes about this asset..."
          />
        </div>

        {/* Custom Fields */}
        {customFields && customFields.length > 0 && (
          <div className="bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-900/50 rounded-2xl shadow-lg border border-slate-200/50 dark:border-slate-700/50 p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                <Settings className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Additional Attributes
              </h2>
            </div>
            
            {customFieldsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {customFields.map(renderCustomField)}
              </div>
            )}
          </div>
        )}

        {/* Submit Actions */}
        <div className="flex gap-4 pt-6">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-brand-600 to-brand-700 text-white rounded-xl hover:from-brand-700 hover:to-brand-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none font-semibold"
          >
            <Save className="w-5 h-5" />
            {isSubmitting ? 'Saving...' : submitButtonText}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-8 py-4 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-200 font-semibold"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default AssetForm;