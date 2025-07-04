import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Save, X, ChevronDown, ChevronUp, Check, Tag, User, MapPin, Package, Calendar, DollarSign, FileText, Settings, Monitor, Cpu, HardDrive, Copy } from 'lucide-react';
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
  // New specs fields
  processor?: string;
  ram?: string;
  storage?: string;
  operatingSystem?: string;
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
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-[9999]">
          <div className="p-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 rounded-t-xl">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <Tag className="w-4 h-4 text-purple-500" />
              Select Workload Categories
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto rounded-b-xl">
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

// Common hardware options
const COMMON_MAKES = [
  'Dell', 'HP', 'Lenovo', 'Apple', 'Asus', 'Acer', 'Microsoft', 'Samsung', 'Other'
];

const COMMON_MODELS = {
  'Dell': ['Latitude 5420', 'Latitude 7420', 'OptiPlex 7090', 'Inspiron 15', 'XPS 13', 'Precision 5560'],
  'HP': ['EliteBook 840', 'ProBook 450', 'Pavilion 15', 'ZBook Studio', 'Elite Desktop 800'],
  'Lenovo': ['ThinkPad X1 Carbon', 'ThinkPad T14', 'ThinkPad P1', 'IdeaPad 3', 'ThinkCentre M90'],
  'Apple': ['MacBook Pro 13"', 'MacBook Pro 14"', 'MacBook Pro 16"', 'MacBook Air M1', 'iMac 24"'],
  'Other': []
};

const RAM_OPTIONS = ['4GB', '8GB', '16GB', '32GB', '64GB', '96GB', '128GB'];
const STORAGE_OPTIONS = ['128GB SSD', '256GB SSD', '512GB SSD', '1TB SSD', '2TB SSD', '1TB HDD', '2TB HDD'];
const PROCESSOR_OPTIONS = [
  'Intel Core i3', 'Intel Core i5', 'Intel Core i7', 'Intel Core i9',
  'AMD Ryzen 3', 'AMD Ryzen 5', 'AMD Ryzen 7', 'AMD Ryzen 9',
  'Apple M1', 'Apple M1 Pro', 'Apple M1 Max', 'Apple M2', 'Apple M2 Pro', 'Apple M2 Max'
];

const OS_OPTIONS = [
  'Windows 10', 'Windows 11', 'macOS Monterey', 'macOS Ventura', 'macOS Sonoma', 
  'Ubuntu 20.04', 'Ubuntu 22.04', 'Other Linux'
];

// Smart Dropdown Component
const SmartDropdown: React.FC<{
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  required?: boolean;
  error?: string;
}> = ({ label, options, value, onChange, placeholder, icon, required, error }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [filteredOptions, setFilteredOptions] = useState(options);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    if (inputValue) {
      const filtered = options.filter(option =>
        option.toLowerCase().includes(inputValue.toLowerCase())
      );
      setFilteredOptions(filtered);
    } else {
      setFilteredOptions(options);
    }
  }, [inputValue, options]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue);
    setIsOpen(true);
  };

  const handleOptionSelect = (option: string) => {
    setInputValue(option);
    onChange(option);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400">
            {icon}
          </div>
        )}
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          placeholder={placeholder}
          className={`w-full ${icon ? 'pl-10' : 'pl-4'} pr-10 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200 ${error ? 'border-red-500' : ''}`}
        />
        <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
      </div>
      
      {isOpen && filteredOptions.length > 0 && (
        <div className="absolute z-[9999] w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-60 overflow-y-auto">
          {filteredOptions.map((option, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleOptionSelect(option)}
              className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border-b border-slate-100 dark:border-slate-700 last:border-b-0"
            >
              {option}
            </button>
          ))}
        </div>
      )}
      
      {error && (
        <p className="text-red-500 text-sm mt-1">{error}</p>
      )}
    </div>
  );
};

// Collapsible Section Component
const CollapsibleSection: React.FC<{
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  completedFields?: number;
  totalFields?: number;
  colorClass?: string;
}> = ({ title, icon, children, defaultOpen = true, completedFields, totalFields, colorClass = 'blue' }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  const getColorClasses = (color: string) => {
    const colors = {
      blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
      green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
      purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
      emerald: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
      amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  return (
    <div className="bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-900/50 rounded-2xl shadow-lg border border-slate-200/50 dark:border-slate-700/50 overflow-visible">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-6 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-700/50 transition-colors rounded-t-2xl"
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${getColorClasses(colorClass)}`}>
            {icon}
          </div>
          <div className="text-left">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {title}
            </h2>
            {completedFields !== undefined && totalFields !== undefined && (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {completedFields} of {totalFields} fields completed
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {completedFields !== undefined && totalFields !== undefined && (
            <div className="flex items-center gap-2">
              <div className="w-16 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-brand-500 transition-all duration-300"
                  style={{ width: `${(completedFields / totalFields) * 100}%` }}
                />
              </div>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {Math.round((completedFields / totalFields) * 100)}%
              </span>
            </div>
          )}
          {isOpen ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </div>
      </button>
      
      {isOpen && (
        <div className="px-6 pb-6 overflow-visible">
          {children}
        </div>
      )}
    </div>
  );
};

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
  const [locationAutoUpdated, setLocationAutoUpdated] = useState(false);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
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
  const watchedMake = watch('make');
  const watchedAssetTag = watch('assetTag');
  const watchedModel = watch('model');
  const watchedSerialNumber = watch('serialNumber');
  const watchedProcessor = watch('processor');
  const watchedRam = watch('ram');
  const watchedStorage = watch('storage');

  // Reset form when initial data changes (only if we have initial data)
  useEffect(() => {
    if (Object.keys(initialData).length > 0) {
      // Extract specifications into individual fields
      const specs = initialData.specifications || {};
      const formData = {
        assetType: 'LAPTOP',
        status: 'AVAILABLE',
        condition: 'GOOD',
        ...initialData,
        processor: specs.processor || '',
        ram: specs.ram || '',
        storage: specs.storage || '',
        operatingSystem: specs.operatingSystem || '',
      };
      
      reset(formData);
      setSelectedStaff(initialStaff);
    }
  }, [initialData, initialStaff, reset]);

  // Handle staff selection changes and update form
  const handleStaffChange = (staff: StaffMember | null) => {
    setSelectedStaff(staff);
    setValue('assignedToAadId', staff?.id || '', { shouldDirty: true });
    
    // Auto-update status when staff is assigned/unassigned
    if (staff) {
      setValue('status', 'ASSIGNED', { shouldDirty: true });
      
      // Auto-update location if staff has a location
      if (staff.officeLocation && locations) {
        console.log('🔍 LOCATION MATCHING DEBUG:');
        console.log('Staff office location (raw):', `"${staff.officeLocation}"`);
        console.log('Available locations in database:', locations.map(loc => ({
          id: loc.id,
          display: `${loc.city}, ${loc.province}, ${loc.country}`,
          city: loc.city,
          province: loc.province,
          country: loc.country
        })));
        
        const officeLocation = staff.officeLocation.toLowerCase().trim();
        console.log('Normalized office location:', `"${officeLocation}"`);
        
        // More precise matching algorithm
        let matchingLocation = null;
        let matchReason = '';
        
        // Strategy 1: Look for city names in the office location
        for (const loc of locations) {
          const city = loc.city.toLowerCase().trim();
          const province = loc.province.toLowerCase().trim();
          const country = loc.country.toLowerCase().trim();
          
          console.log(`🔍 Checking location: ${city}, ${province}, ${country}`);
          
          // Exact city match
          if (officeLocation === city) {
            matchingLocation = loc;
            matchReason = `Exact city match: "${city}"`;
            break;
          }
          
          // Check if office location starts with the city name
          if (officeLocation.startsWith(city + ',') || officeLocation.startsWith(city + ' ')) {
            matchingLocation = loc;
            matchReason = `Office location starts with city: "${city}"`;
            break;
          }
          
          // Check for "City, Province" format
          if (officeLocation.includes(',')) {
            const parts = officeLocation.split(',').map(p => p.trim());
            const cityPart = parts[0];
            const provincePart = parts[1];
            
            if (cityPart === city && (
              provincePart === province || 
              provincePart === province.substring(0, 2) || // BC vs British Columbia
              province.startsWith(provincePart) ||
              provincePart.includes(province.substring(0, 2))
            )) {
              matchingLocation = loc;
              matchReason = `City + Province match: "${cityPart}, ${provincePart}" → "${city}, ${province}"`;
              break;
            }
          }
          
          // Check if city name appears anywhere in office location (but be more strict)
          if (officeLocation.includes(city) && city.length >= 4) { // Only for cities with 4+ chars to avoid false matches
            matchingLocation = loc;
            matchReason = `City name found in office location: "${city}"`;
            break;
          }
        }
        
        if (matchingLocation) {
          console.log('✅ MATCH FOUND!');
          console.log('Matching location:', matchingLocation);
          console.log('Match reason:', matchReason);
          setValue('locationId', matchingLocation.id, { shouldDirty: true });
          setLocationAutoUpdated(true);
          
          // Clear the notification after 3 seconds
          setTimeout(() => {
            setLocationAutoUpdated(false);
          }, 3000);
        } else {
          console.log('❌ NO MATCH FOUND');
          console.log('Office location did not match any database locations');
        }
      }
    } else {
      setValue('status', 'AVAILABLE', { shouldDirty: true });
    }
  };

  // Calculate completion for sections
  const calculateBasicInfoCompletion = () => {
    const fields = [watchedAssetTag, watchedMake, watchedModel, watchedSerialNumber];
    const completed = fields.filter(field => field && field.trim() !== '').length;
    return { completed, total: 4 };
  };

  const calculateSpecsCompletion = () => {
    const fields = [watchedProcessor, watchedRam, watchedStorage];
    const completed = fields.filter(field => field && field.trim() !== '').length;
    return { completed, total: 3 };
  };

  // Clone asset function
  const handleCloneAsset = () => {
    const currentValues = watch();
    reset({
      ...currentValues,
      assetTag: '', // Clear asset tag for new asset
      serialNumber: '', // Clear serial number for new asset
      assignedToAadId: '', // Clear assignment
      status: 'AVAILABLE', // Reset to available
    });
    setSelectedStaff(null);
  };

  const handleFormSubmit = async (data: AssetFormData) => {
    // Build specifications object from individual fields
    const specifications = {
      processor: data.processor,
      ram: data.ram,
      storage: data.storage,
      operatingSystem: data.operatingSystem,
    };

    // Remove individual spec fields and add specifications object
    const { processor, ram, storage, operatingSystem, ...restData } = data;
    const submitData = {
      ...restData,
      specifications,
    };

    await onSubmit(submitData, selectedStaff);
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
    <div className="space-y-8 relative">
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
        <div className="flex items-center gap-3">
          {/* Clone Button */}
          <button
            type="button"
            onClick={handleCloneAsset}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <Copy className="w-4 h-4" />
            Clone
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-4 h-4" />
            Cancel
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6 overflow-visible">
        {/* Basic Information */}
        <CollapsibleSection
          title="Basic Information"
          icon={<Package className="w-6 h-6" />}
          colorClass="blue"
          defaultOpen={true}
          completedFields={calculateBasicInfoCompletion().completed}
          totalFields={calculateBasicInfoCompletion().total}
        >
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
              <Controller
                name="make"
                control={control}
                rules={{ required: 'Make is required' }}
                render={({ field }) => (
                  <SmartDropdown
                    label="Make"
                    options={COMMON_MAKES}
                    value={field.value || ''}
                    onChange={field.onChange}
                    placeholder="e.g., Dell, Lenovo, HP"
                    required={true}
                    error={errors.make?.message}
                  />
                )}
              />
            </div>

            <div>
              <Controller
                name="model"
                control={control}
                rules={{ required: 'Model is required' }}
                render={({ field }) => (
                  <SmartDropdown
                    label="Model"
                    options={watchedMake && COMMON_MODELS[watchedMake as keyof typeof COMMON_MODELS] || []}
                    value={field.value || ''}
                    onChange={field.onChange}
                    placeholder="e.g., Latitude 5420, ThinkPad X1"
                    required={true}
                    error={errors.model?.message}
                  />
                )}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Serial Number
              </label>
              <input
                {...register('serialNumber')}
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200 font-mono"
                placeholder="Device serial number"
              />
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
        </CollapsibleSection>

        {/* Specifications */}
        <CollapsibleSection
          title="Specifications"
          icon={<Monitor className="w-6 h-6" />}
          colorClass="purple"
          defaultOpen={true}
          completedFields={calculateSpecsCompletion().completed}
          totalFields={calculateSpecsCompletion().total}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Controller
                name="processor"
                control={control}
                render={({ field }) => (
                  <SmartDropdown
                    label="Processor"
                    options={PROCESSOR_OPTIONS}
                    value={field.value || ''}
                    onChange={field.onChange}
                    placeholder="e.g., Intel Core i5, AMD Ryzen 5"
                    icon={<Cpu className="w-4 h-4" />}
                  />
                )}
              />
            </div>

            <div>
              <Controller
                name="ram"
                control={control}
                render={({ field }) => (
                  <SmartDropdown
                    label="Memory (RAM)"
                    options={RAM_OPTIONS}
                    value={field.value || ''}
                    onChange={field.onChange}
                    placeholder="e.g., 8GB, 16GB"
                    icon={<Monitor className="w-4 h-4" />}
                  />
                )}
              />
            </div>

            <div>
              <Controller
                name="storage"
                control={control}
                render={({ field }) => (
                  <SmartDropdown
                    label="Storage"
                    options={STORAGE_OPTIONS}
                    value={field.value || ''}
                    onChange={field.onChange}
                    placeholder="e.g., 256GB SSD, 1TB HDD"
                    icon={<HardDrive className="w-4 h-4" />}
                  />
                )}
              />
            </div>

            <div>
              <Controller
                name="operatingSystem"
                control={control}
                render={({ field }) => (
                  <SmartDropdown
                    label="Operating System"
                    options={OS_OPTIONS}
                    value={field.value || ''}
                    onChange={field.onChange}
                    placeholder="e.g., Windows 11, macOS"
                  />
                )}
              />
            </div>
          </div>
        </CollapsibleSection>

        {/* Assignment & Location */}
        <CollapsibleSection
          title="Assignment & Location"
          icon={<User className="w-6 h-6" />}
          colorClass="green"
          defaultOpen={true}
        >
          <div className="space-y-6">
            {/* Status and Staff Assignment */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  Assigned To Staff Member
                </label>
                <StaffSearch
                  value={selectedStaff?.id || null}
                  onChange={handleStaffChange}
                  placeholder="Search for staff member..."
                />
                {/* Debug: Show Azure AD location data */}
                {selectedStaff?.officeLocation && (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => setShowDebugInfo(!showDebugInfo)}
                      className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 transition-colors"
                    >
                      {showDebugInfo ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                      🔍 Azure AD Debug Info
                    </button>
                    
                    {showDebugInfo && (
                      <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
                        <div className="space-y-1">
                          <div className="text-sm">
                            <span className="text-blue-600 dark:text-blue-300 font-medium">Office Location:</span>
                            <span className="ml-2 text-blue-700 dark:text-blue-300 font-mono bg-blue-100 dark:bg-blue-800/50 px-2 py-1 rounded">
                              "{selectedStaff.officeLocation}"
                            </span>
                          </div>
                          {selectedStaff.department && (
                            <div className="text-sm">
                              <span className="text-blue-600 dark:text-blue-300 font-medium">Department:</span>
                              <span className="ml-2 text-blue-700 dark:text-blue-300">
                                {selectedStaff.department}
                              </span>
                            </div>
                          )}
                          {selectedStaff.jobTitle && (
                            <div className="text-sm">
                              <span className="text-blue-600 dark:text-blue-300 font-medium">Job Title:</span>
                              <span className="ml-2 text-blue-700 dark:text-blue-300">
                                {selectedStaff.jobTitle}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {/* Hidden field to track staff assignment for form dirty state */}
                <input
                  type="hidden"
                  {...register('assignedToAadId')}
                  value={selectedStaff?.id || ''}
                />
              </div>
            </div>

            {/* Workload Categories and Location */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  {locationAutoUpdated && (
                    <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      Auto-updated
                    </span>
                  )}
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <select
                    {...register('locationId')}
                    className={`w-full pl-11 pr-4 py-3 border rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200 ${
                      locationAutoUpdated 
                        ? 'border-green-400 dark:border-green-500 bg-green-50 dark:bg-green-900/20' 
                        : 'border-slate-300 dark:border-slate-600'
                    }`}
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
        </CollapsibleSection>

        {/* Purchase & Warranty */}
        <CollapsibleSection
          title="Purchase & Warranty"
          icon={<DollarSign className="w-6 h-6" />}
          colorClass="emerald"
          defaultOpen={false}
        >
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
        </CollapsibleSection>

        {/* Notes */}
        <CollapsibleSection
          title="Notes"
          icon={<FileText className="w-6 h-6" />}
          colorClass="amber"
          defaultOpen={false}
        >
          <textarea
            {...register('notes')}
            rows={4}
            className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200 resize-none"
            placeholder="Add any additional notes about this asset..."
          />
        </CollapsibleSection>

        {/* Custom Fields */}
        {customFields && customFields.length > 0 && (
          <CollapsibleSection
            title="Additional Attributes"
            icon={<Settings className="w-6 h-6" />}
            colorClass="purple"
            defaultOpen={false}
          >
            {customFieldsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {customFields.map(renderCustomField)}
              </div>
            )}
          </CollapsibleSection>
        )}

        {/* Submit Actions */}
        <div className="sticky bottom-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 p-6 -mx-6 -mb-6 mt-8">
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-600 dark:text-slate-400">
              {isDirty ? 'You have unsaved changes' : 'No changes made'}
            </div>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={onCancel}
                className="px-6 py-3 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-200 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-3 px-8 py-3 bg-gradient-to-r from-brand-600 to-brand-700 text-white rounded-xl hover:from-brand-700 hover:to-brand-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none font-semibold"
              >
                <Save className="w-5 h-5" />
                {isSubmitting ? 'Saving...' : submitButtonText}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default AssetForm;