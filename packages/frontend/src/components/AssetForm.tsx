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
        className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:border-slate-400 dark:hover:border-slate-500"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <Tag className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
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
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Selected Categories Preview */}
      {selectedCategories.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {selectedCategories.map((category) => (
            <span
              key={category.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-md text-xs font-medium border border-purple-200 dark:border-purple-700"
            >
              <div className="w-1.5 h-1.5 bg-purple-500 rounded-full" />
              {category.name}
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleCategory(category.id);
                  }}
                  className="ml-0.5 hover:bg-purple-200 dark:hover:bg-purple-800 rounded-full p-0.5 transition-colors"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-[9999]">
          <div className="p-2.5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 rounded-t-lg">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
              <Tag className="w-3.5 h-3.5 text-purple-500" />
              Select Workload Categories
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto rounded-b-lg">
            {categories.map((category) => {
              const isSelected = value.includes(category.id);
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => toggleCategory(category.id)}
                  className="w-full px-3 py-2.5 flex items-center gap-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left"
                >
                  <div className={`w-4 h-4 rounded-md border-2 flex items-center justify-center transition-all duration-200 ${
                    isSelected 
                      ? 'bg-purple-500 border-purple-500' 
                      : 'border-slate-300 dark:border-slate-600 hover:border-purple-400'
                  }`}>
                    {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {category.name}
                    </div>
                    {category.description && (
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {category.description}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          {categories.length === 0 && (
            <div className="p-3 text-center text-slate-500 dark:text-slate-400 text-sm">
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

// Asset-type-specific field configurations
const ASSET_TYPE_CONFIGS = {
  LAPTOP: {
    specFields: [
      { key: 'processor', label: 'Processor', icon: Cpu, options: PROCESSOR_OPTIONS, required: false },
      { key: 'ram', label: 'Memory (RAM)', icon: Monitor, options: RAM_OPTIONS, required: false },
      { key: 'storage', label: 'Storage', icon: HardDrive, options: STORAGE_OPTIONS, required: false },
      { key: 'operatingSystem', label: 'Operating System', icon: Settings, options: OS_OPTIONS, required: false },
      { key: 'screenSize', label: 'Screen Size', icon: Monitor, options: ['13"', '14"', '15"', '16"', '17"'], required: false },
      { key: 'batteryHealth', label: 'Battery Health', icon: Settings, options: ['Excellent', 'Good', 'Fair', 'Poor', 'Needs Replacement'], required: false },
    ],
    title: 'Hardware Specifications',
    description: 'Laptop hardware and performance details'
  },
  DESKTOP: {
    specFields: [
      { key: 'processor', label: 'Processor', icon: Cpu, options: PROCESSOR_OPTIONS, required: false },
      { key: 'ram', label: 'Memory (RAM)', icon: Monitor, options: RAM_OPTIONS, required: false },
      { key: 'storage', label: 'Storage', icon: HardDrive, options: STORAGE_OPTIONS, required: false },
      { key: 'operatingSystem', label: 'Operating System', icon: Settings, options: OS_OPTIONS, required: false },
      { key: 'graphicsCard', label: 'Graphics Card', icon: Monitor, options: ['Integrated', 'NVIDIA GTX 1650', 'NVIDIA RTX 3060', 'NVIDIA RTX 4070', 'AMD Radeon', 'Other'], required: false },
      { key: 'formFactor', label: 'Form Factor', icon: Package, options: ['Mini Tower', 'Mid Tower', 'Full Tower', 'Small Form Factor', 'All-in-One'], required: false },
    ],
    title: 'Hardware Specifications',
    description: 'Desktop computer hardware details'
  },
  TABLET: {
    specFields: [
      { key: 'operatingSystem', label: 'Operating System', icon: Settings, options: ['iPadOS 16', 'iPadOS 17', 'Android 12', 'Android 13', 'Windows 11'], required: false },
      { key: 'storage', label: 'Storage Capacity', icon: HardDrive, options: ['32GB', '64GB', '128GB', '256GB', '512GB', '1TB'], required: false },
      { key: 'screenSize', label: 'Screen Size', icon: Monitor, options: ['7"', '8"', '9"', '10"', '11"', '12"', '13"'], required: false },
      { key: 'connectivity', label: 'Connectivity', icon: Settings, options: ['Wi-Fi Only', 'Wi-Fi + Cellular', 'Wi-Fi + 5G'], required: false },
      { key: 'imei', label: 'IMEI (if cellular)', icon: Settings, options: [], required: false },
      { key: 'carrier', label: 'Carrier', icon: Settings, options: ['Rogers', 'Bell', 'Telus', 'Freedom', 'Unlocked', 'N/A'], required: false },
    ],
    title: 'Device Specifications',
    description: 'Tablet device and connectivity details'
  },
  PHONE: {
    specFields: [
      { key: 'operatingSystem', label: 'Operating System', icon: Settings, options: ['iOS 16', 'iOS 17', 'Android 12', 'Android 13', 'Android 14'], required: false },
      { key: 'storage', label: 'Storage Capacity', icon: HardDrive, options: ['64GB', '128GB', '256GB', '512GB', '1TB'], required: false },
      { key: 'phoneNumber', label: 'Phone Number', icon: Settings, options: [], required: false },
      { key: 'imei', label: 'IMEI', icon: Settings, options: [], required: true },
      { key: 'carrier', label: 'Carrier', icon: Settings, options: ['Rogers', 'Bell', 'Telus', 'Freedom', 'Unlocked'], required: false },
      { key: 'planType', label: 'Plan Type', icon: Settings, options: ['Corporate', 'BYOD', 'Personal', 'Prepaid'], required: false },
    ],
    title: 'Device & Service Details',
    description: 'Phone specifications and service information'
  },
  OTHER: {
    specFields: [
      { key: 'deviceCategory', label: 'Device Category', icon: Package, options: ['Monitor', 'Printer', 'Projector', 'Camera', 'Audio Equipment', 'Network Equipment', 'Other'], required: false },
      { key: 'specifications', label: 'Key Specifications', icon: Settings, options: [], required: false },
    ],
    title: 'Device Information',
    description: 'General device specifications'
  },
};

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
      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        {icon && (
          <div className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-slate-400">
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
          className={`w-full ${icon ? 'pl-8' : 'pl-3'} pr-8 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200 ${error ? 'border-red-500' : ''}`}
        />
        <ChevronDown className="absolute right-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
      </div>
      
      {isOpen && filteredOptions.length > 0 && (
        <div className="absolute z-[9999] w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-48 overflow-y-auto">
          {filteredOptions.map((option, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleOptionSelect(option)}
              className="w-full px-3 py-2 text-sm text-left hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border-b border-slate-100 dark:border-slate-700 last:border-b-0"
            >
              {option}
            </button>
          ))}
        </div>
      )}
      
      {error && (
        <p className="text-red-500 text-xs mt-1">{error}</p>
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
  const watchedAssetType = watch('assetType');
  const watchedMake = watch('make');
  const watchedAssetTag = watch('assetTag');
  const watchedModel = watch('model');
  const watchedSerialNumber = watch('serialNumber');
  const watchedProcessor = watch('processor');
  const watchedRam = watch('ram');
  const watchedStorage = watch('storage');

  // Debug asset type changes
  useEffect(() => {
    console.log('🎯 Asset type changed to:', watchedAssetType);
  }, [watchedAssetType]);

  // Reset form when initial data changes (only if we have initial data)
  useEffect(() => {
    if (Object.keys(initialData).length > 0) {
      // Extract specifications into individual fields for all asset types
      const specs = initialData.specifications || {};
      const formData = {
        assetType: 'LAPTOP',
        status: 'AVAILABLE',
        condition: 'GOOD',
        ...initialData,
        // Add all possible specification fields
        ...specs,
      };
      
      reset(formData);
      setSelectedStaff(initialStaff);
    }
  }, [initialData, initialStaff, reset]);

  // Clear specification fields when asset type changes (but only for new assets)
  const isNewAsset = Object.keys(initialData).length === 0;
  const [previousAssetType, setPreviousAssetType] = useState<string | null>(null);
  
  useEffect(() => {
    // Initialize previous asset type on first render
    if (previousAssetType === null) {
      setPreviousAssetType(watchedAssetType);
      return;
    }
    
    // Only clear specs for new assets and when asset type actually changes
    if (isNewAsset && watchedAssetType !== previousAssetType) {
      console.log('🧹 Clearing specs because asset type changed from', previousAssetType, 'to', watchedAssetType);
      
      // Get all possible spec field keys from all asset types
      const allSpecFields = Object.values(ASSET_TYPE_CONFIGS).flatMap(config => 
        config.specFields.map(field => field.key)
      );
      
      // Clear all spec fields
      allSpecFields.forEach(fieldKey => {
        setValue(fieldKey, '', { shouldDirty: false });
      });
      
      setPreviousAssetType(watchedAssetType);
    }
  }, [watchedAssetType, previousAssetType, setValue, isNewAsset]);

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
    const requiredFields = [watchedSerialNumber, watchedMake, watchedModel]; // Always required
    let totalFields = 3;
    let completedFields = requiredFields.filter(field => field && field.trim() !== '').length;
    
    // BGC Tag is only required when assigned
    const isBgcTagRequired = watchedStatus === 'ASSIGNED' || selectedStaff;
    if (isBgcTagRequired) {
      totalFields += 1;
      if (watchedAssetTag && watchedAssetTag.trim() !== '') {
        completedFields += 1;
      }
    } else {
      // Count BGC tag as completed if it's filled (even when not required)
      if (watchedAssetTag && watchedAssetTag.trim() !== '') {
        completedFields += 1;
        totalFields += 1;
      }
    }
    
    return { completed: completedFields, total: totalFields };
  };

  const calculateSpecsCompletion = () => {
    const config = ASSET_TYPE_CONFIGS[watchedAssetType as keyof typeof ASSET_TYPE_CONFIGS];
    if (!config) return { completed: 0, total: 0 };
    
    const fieldValues = config.specFields.map(field => watch(field.key));
    const completed = fieldValues.filter(value => value && value.toString().trim() !== '').length;
    return { completed, total: config.specFields.length };
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
    // Build specifications object from all dynamic fields based on asset type
    const config = ASSET_TYPE_CONFIGS[data.assetType as keyof typeof ASSET_TYPE_CONFIGS];
    const specifications: Record<string, any> = {};
    const fieldsToRemove: string[] = [];
    
    if (config) {
      config.specFields.forEach(field => {
        const value = data[field.key];
        if (value && value.toString().trim() !== '') {
          specifications[field.key] = value;
        }
        fieldsToRemove.push(field.key);
      });
    }

    // Remove individual spec fields and add specifications object
    const restData = { ...data };
    fieldsToRemove.forEach(field => {
      delete restData[field];
    });
    
    const submitData = {
      ...restData,
      specifications,
    };

    await onSubmit(submitData, selectedStaff);
  };

  // Render dynamic specification fields based on asset type
  const renderSpecificationField = (field: any) => {
    const fieldName = field.key;
    const IconComponent = field.icon;
    
    if (field.options.length > 0) {
      // Dropdown field
      return (
        <div key={field.key}>
          <Controller
            name={fieldName}
            control={control}
            rules={{ required: field.required ? `${field.label} is required` : false }}
            render={({ field: controllerField }) => (
              <SmartDropdown
                label={field.label}
                options={field.options}
                value={controllerField.value || ''}
                onChange={controllerField.onChange}
                placeholder={`Enter ${field.label.toLowerCase()}`}
                icon={<IconComponent className="w-3.5 h-3.5" />}
                required={field.required}
                error={errors[fieldName]?.message as string}
              />
            )}
          />
        </div>
      );
    } else {
      // Text input field
      return (
        <div key={field.key}>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            {field.label} {field.required && <span className="text-red-500">*</span>}
          </label>
          <div className="relative">
            <div className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-slate-400">
              <IconComponent className="w-3.5 h-3.5" />
            </div>
            <input
              {...register(fieldName, { 
                required: field.required ? `${field.label} is required` : false 
              })}
              className="w-full pl-8 pr-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200"
              placeholder={`Enter ${field.label.toLowerCase()}`}
            />
          </div>
          {errors[fieldName] && (
            <p className="text-red-500 text-xs mt-1">{String(errors[fieldName]?.message)}</p>
          )}
        </div>
      );
    }
  };

  const renderCustomField = (field: CustomField) => {
    const fieldName = `custom_${field.id}`;
    const isRequired = field.isRequired;

    switch (field.fieldType) {
      case 'STRING':
        return (
          <div key={field.id}>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              {field.name} {isRequired && <span className="text-red-500">*</span>}
            </label>
            <input
              {...register(fieldName, { 
                required: isRequired ? `${field.name} is required` : false 
              })}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200 font-mono"
            />
            {errors[fieldName] && (
              <p className="text-red-500 text-xs mt-1">{String(errors[fieldName]?.message)}</p>
            )}
          </div>
        );

      case 'NUMBER':
        return (
          <div key={field.id}>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              {field.name} {isRequired && <span className="text-red-500">*</span>}
            </label>
            <input
              type="number"
              {...register(fieldName, { 
                required: isRequired ? `${field.name} is required` : false,
                valueAsNumber: true,
              })}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200 font-mono"
            />
            {errors[fieldName] && (
              <p className="text-red-500 text-xs mt-1">{String(errors[fieldName]?.message)}</p>
            )}
          </div>
        );

      case 'SINGLE_SELECT':
        const options = field.options || [];
        return (
          <div key={field.id}>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              {field.name} {isRequired && <span className="text-red-500">*</span>}
            </label>
            <select
              {...register(fieldName, { 
                required: isRequired ? `${field.name} is required` : false 
              })}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200 font-mono"
            >
              <option value="">Select {field.name}</option>
              {options.map((option: string) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            {errors[fieldName] && (
              <p className="text-red-500 text-xs mt-1">{String(errors[fieldName]?.message)}</p>
            )}
          </div>
        );

      // New case for MULTI_SELECT custom fields
      case 'MULTI_SELECT':
        const multiOptions = field.options || [];
        return (
          <div key={field.id}>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
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
                  <div className="flex flex-col gap-1.5">
                    {multiOptions.map((option) => {
                      const isChecked = selected.includes(option);
                      return (
                        <label key={option} className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            className="w-4 h-4 text-brand-600 border-slate-300 rounded focus:ring-brand-500 transition-colors"
                            checked={isChecked}
                            onChange={(e) => toggleOption(option, e.target.checked)}
                          />
                          <span className="text-xs text-slate-700 dark:text-slate-300">{option}</span>
                        </label>
                      );
                    })}
                  </div>
                );
              }}
            />
            {errors[fieldName] && (
              <p className="text-red-500 text-xs mt-1">{String(errors[fieldName]?.message)}</p>
            )}
          </div>
        );

      case 'DATE':
        return (
          <div key={field.id}>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              {field.name} {isRequired && <span className="text-red-500">*</span>}
            </label>
            <input
              type="date"
              {...register(fieldName, { 
                required: isRequired ? `${field.name} is required` : false 
              })}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200 font-mono"
            />
            {errors[fieldName] && (
              <p className="text-red-500 text-xs mt-1">{String(errors[fieldName]?.message)}</p>
            )}
          </div>
        );

      case 'BOOLEAN':
        return (
          <div key={field.id} className="flex items-center space-x-2.5 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
            <input
              type="checkbox"
              {...register(fieldName)}
              className="w-4 h-4 text-brand-600 border-slate-300 rounded focus:ring-brand-500 transition-colors"
            />
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              {field.name}
            </label>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 relative">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {title}
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm">
            {subtitle}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Clone Button */}
          <button
            type="button"
            onClick={handleCloneAsset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
            Clone
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Cancel
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-5 overflow-visible">
        {/* Asset Type Selection - Compact */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4 border border-blue-200/50 dark:border-blue-700/50">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Asset Type
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Select the type of device you're adding
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {ASSET_TYPES.map((type) => {
              const isSelected = watchedAssetType === type.value;
              return (
                <label
                  key={type.value}
                  className={`relative flex flex-col items-center p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 hover:shadow-sm ${
                    isSelected
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 shadow-sm transform scale-105'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <input
                    type="radio"
                    {...register('assetType', { required: 'Asset type is required' })}
                    value={type.value}
                    className="sr-only"
                  />
                  <div className={`text-2xl mb-1 transition-transform duration-200 ${isSelected ? 'scale-110' : ''}`}>
                    {type.icon}
                  </div>
                  <span className={`text-xs font-medium transition-colors duration-200 ${
                    isSelected 
                      ? 'text-brand-700 dark:text-brand-300' 
                      : 'text-slate-700 dark:text-slate-300'
                  }`}>
                    {type.label}
                  </span>
                  {isSelected && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-brand-500 text-white rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                </label>
              );
            })}
          </div>
          {errors.assetType && (
            <p className="text-red-500 text-xs mt-2">{errors.assetType.message}</p>
          )}
        </div>

        {/* Basic Information & Hardware Specifications - Side by Side */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Basic Information */}
          <CollapsibleSection
            title="Basic Information"
            icon={<Package className="w-5 h-5" />}
            colorClass="blue"
            defaultOpen={true}
            completedFields={calculateBasicInfoCompletion().completed}
            totalFields={calculateBasicInfoCompletion().total}
          >
            <div className="space-y-4">
              {/* Service Tag (SN) - First field, mandatory */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Service Tag (SN) <span className="text-red-500">*</span>
                </label>
                <input
                  {...register('serialNumber', { required: 'Service tag is required' })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200 font-mono"
                  placeholder="e.g., 2NK4GHA"
                />
                {errors.serialNumber && (
                  <p className="text-red-500 text-xs mt-1">{errors.serialNumber.message}</p>
                )}
              </div>

              {/* BGC Tag - Second field, required only when assigned */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  BGC Tag {(watchedStatus === 'ASSIGNED' || selectedStaff) && <span className="text-red-500">*</span>}
                  {(watchedStatus !== 'ASSIGNED' && !selectedStaff) && (
                    <span className="text-xs text-slate-500 dark:text-slate-400 ml-1">(required when assigned)</span>
                  )}
                </label>
                <input
                  {...register('assetTag', { 
                    required: (watchedStatus === 'ASSIGNED' || selectedStaff) ? 'BGC tag is required when asset is assigned' : false 
                  })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200 font-mono"
                  placeholder="e.g., BGC3755"
                />
                {errors.assetTag && (
                  <p className="text-red-500 text-xs mt-1">{errors.assetTag.message}</p>
                )}
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
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Condition
                </label>
                <select
                  {...register('condition')}
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200"
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

          {/* Dynamic Specifications based on Asset Type */}
          {watchedAssetType && (() => {
            const config = ASSET_TYPE_CONFIGS[watchedAssetType as keyof typeof ASSET_TYPE_CONFIGS];
            
            if (!config || config.specFields.length === 0) {
              return null;
            }
            
            return (
              <CollapsibleSection
                key={`specs-${watchedAssetType}`} // Force re-render when asset type changes
                title={config.title}
                icon={<Monitor className="w-5 h-5" />}
                colorClass="purple"
                defaultOpen={true}
                completedFields={calculateSpecsCompletion().completed}
                totalFields={calculateSpecsCompletion().total}
              >
                <div className="space-y-1 mb-3">
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {config.description}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-purple-600 dark:text-purple-400">
                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse"></div>
                    {config.specFields.length} fields for {ASSET_TYPES.find(t => t.value === watchedAssetType)?.label}
                  </div>
                </div>
                <div className="space-y-4">
                  {config.specFields.map((field, index) => (
                    <div key={`${watchedAssetType}-${field.key}-${index}`}>
                      {renderSpecificationField(field)}
                    </div>
                  ))}
                </div>
              </CollapsibleSection>
            );
          })()}
        </div>

        {/* Assignment & Location */}
        <CollapsibleSection
          title="Assignment & Location"
          icon={<User className="w-5 h-5" />}
          colorClass="green"
          defaultOpen={true}
        >
          <div className="space-y-4">
            {/* Status and Staff Assignment */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Status
                </label>
                <select
                  {...register('status')}
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200"
                >
                  {ASSET_STATUSES.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
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
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Location
                  {locationAutoUpdated && (
                    <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      Auto-updated
                    </span>
                  )}
                </label>
                <div className="relative">
                  <MapPin className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select
                    {...register('locationId')}
                    className={`w-full pl-8 pr-3 py-2 text-sm border rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200 ${
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
          icon={<DollarSign className="w-5 h-5" />}
          colorClass="emerald"
          defaultOpen={false}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Purchase Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="date"
                  {...register('purchaseDate')}
                  className="w-full pl-8 pr-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Purchase Price
              </label>
              <div className="relative">
                <DollarSign className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="number"
                  step="0.01"
                  {...register('purchasePrice', { valueAsNumber: true })}
                  className="w-full pl-8 pr-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Vendor
              </label>
              <select
                {...register('vendorId')}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200"
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
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Warranty End Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="date"
                  {...register('warrantyEndDate')}
                  className="w-full pl-8 pr-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200"
                />
              </div>
            </div>
          </div>
        </CollapsibleSection>

        {/* Notes */}
        <CollapsibleSection
          title="Notes"
          icon={<FileText className="w-5 h-5" />}
          colorClass="amber"
          defaultOpen={false}
        >
          <textarea
            {...register('notes')}
            rows={3}
            className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200 resize-none"
            placeholder="Add any additional notes about this asset..."
          />
        </CollapsibleSection>

        {/* Custom Fields */}
        {customFields && customFields.length > 0 && (
          <CollapsibleSection
            title="Additional Attributes"
            icon={<Settings className="w-5 h-5" />}
            colorClass="purple"
            defaultOpen={false}
          >
            {customFieldsLoading ? (
              <div className="flex items-center justify-center py-6">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-brand-600"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {customFields.map(renderCustomField)}
              </div>
            )}
          </CollapsibleSection>
        )}

        {/* Submit Actions - now inline */}
        <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 p-6 -mx-6 -mb-6 mt-8">
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