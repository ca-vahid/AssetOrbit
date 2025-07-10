import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Search,
  UserCheck,
  MoreHorizontal,
  RefreshCw,
  AlertTriangle,
  Package,
  MapPin,
  Phone,
  Mail,
  Building,
  User,
  Eye,
  Filter,
  ChevronDown,
  Users,
  Briefcase,
  X,
  Tablet,
  Monitor,
  Settings,
  HelpCircle,
  Glasses,
  ExternalLink,
  Calendar,
  Shield,
} from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Select from '@radix-ui/react-select';
import { usersApi, staffApi } from '../services/api';
import { useStore } from '../store';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDebounce } from '../hooks/useDebounce';
import { usePhoto, usePhotoBatch } from '../contexts/PhotoBatchContext';
import { categorizeNonStaff, getUserCategoryDisplay, getUserTypeIcon, UserType } from '../utils/staffUtils';
import clsx from 'clsx';

interface StaffWithAssets {
  azureAdId: string;
  assetCount: number;
}

interface StaffDetails {
  id: string;
  azureAdId?: string;
  displayName: string;
  mail?: string;
  userPrincipalName?: string;
  jobTitle?: string;
  department?: string;
  officeLocation?: string;
  mobilePhone?: string;
  businessPhones?: string[];
  employeeId?: string;
  companyName?: string;
  city?: string;
  country?: string;
  streetAddress?: string;
  manager?: {
    displayName: string;
    mail?: string;
  };
}

interface EnrichedStaffMember extends StaffWithAssets {
  details?: StaffDetails;
  isLoading?: boolean;
  error?: string;
  userType: UserType;
}

// Get icon component for user type
const getUserTypeIconComponent = (userType: UserType) => {
  switch (userType.type) {
    case 'staff':
      return User;
    case 'equipment':
      if (userType.category === 'Mobile Device') return Tablet;
      if (userType.category === 'AR/VR Device') return Glasses;
      return Monitor;
    case 'service_account':
      return Settings;
    default:
      return HelpCircle;
  }
};

// Helper function to detect non-AD accounts
const isNonADAccount = (staff: EnrichedStaffMember): boolean => {
  // Simple rule: if Azure AD can't find it, it's a non-AD account
  return staff.error === 'Not found in Azure AD';
};

// Profile picture component with fallback to initials
const ProfilePicture: React.FC<{
  azureAdId?: string;
  displayName?: string;
  size: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  userType?: UserType;
}> = ({ azureAdId, displayName, size, className, userType }) => {
  const shouldLoadPhoto = userType?.type === 'staff' && azureAdId;
  const { url: photoUrl, isLoading } = usePhoto(shouldLoadPhoto ? azureAdId : undefined);

  const sizeClasses = {
    sm: 'w-10 h-10 text-sm',
    md: 'w-12 h-12 text-base',
    lg: 'w-16 h-16 text-lg',
    xl: 'w-20 h-20 text-xl',
  };

  const getInitials = (name?: string): string => {
    if (!name) return '?';
    const parts = name.trim().split(' ').filter(part => part.length > 0);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  if (photoUrl && !isLoading) {
    return (
      <img
        src={photoUrl}
        alt={`${displayName || 'User'} profile`}
        className={clsx(
          sizeClasses[size],
          'rounded-full object-cover border-2 border-white shadow-sm flex-shrink-0',
          (size === 'lg' || size === 'xl') && 'border-4 shadow-lg',
          className
        )}
        onError={() => {
          console.log('Profile image failed to load for:', displayName);
        }}
      />
    );
  }

  // Fallback to initials
  return (
    <div className={clsx(
      sizeClasses[size],
      'bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 border-2 border-white shadow-sm',
      (size === 'lg' || size === 'xl') && 'border-4 shadow-lg',
      className
    )}>
      <span className="select-none font-bold text-white">
        {getInitials(displayName)}
      </span>
    </div>
  );
};

// Utility function to generate BambooHR link
const getBambooHRLink = (employeeId?: string): string | null => {
  if (!employeeId) return null;
  return `https://bgcengineering.bamboohr.com/employees/employee.php?id=${employeeId}`;
};

// BambooHR Link Component
const BambooHRLink: React.FC<{ employeeId?: string; className?: string; showLabel?: boolean }> = ({ employeeId, className, showLabel = false }) => {
  const link = getBambooHRLink(employeeId);
  
  if (!link) return null;
  
  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      className={clsx(
        'inline-flex items-center gap-1 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors',
        className
      )}
      title={`View in BambooHR (Employee ID: ${employeeId})`}
    >
      {showLabel && <span className="text-sm">HR Profile</span>}
      <ExternalLink className="w-3 h-3" />
    </a>
  );
};

const Staff: React.FC = () => {
  const { currentUser } = useStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [userTypeFilter, setUserTypeFilter] = useState<'all' | 'staff' | 'non_ad'>('all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [viewMode, setViewMode] = useState<'large' | 'medium' | 'compact'>('medium');
  const [selectedStaff, setSelectedStaff] = useState<StaffDetails | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [enrichedStaff, setEnrichedStaff] = useState<EnrichedStaffMember[]>([]);
  const { preloadPhotos } = usePhotoBatch();

  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearchQuery, departmentFilter, userTypeFilter]);

  const { data: staffData, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['staff-with-assets', { search: debouncedSearchQuery, page, limit, department: departmentFilter, userType: userTypeFilter }],
    queryFn: () => usersApi.getStaffWithAssets({ 
      search: debouncedSearchQuery || undefined,
      page,
      limit,
      department: departmentFilter !== 'all' ? departmentFilter : undefined,
      userType: userTypeFilter !== 'all' ? userTypeFilter : undefined,
    }),
    keepPreviousData: true,
  });

  const processBatchedAzureAdQueries = async (staffList: StaffWithAssets[]): Promise<EnrichedStaffMember[]> => {
    const BATCH_SIZE = 50;
    const batches = [];
    for (let i = 0; i < staffList.length; i += BATCH_SIZE) {
      batches.push(staffList.slice(i, i + BATCH_SIZE));
    }

    let allResults: EnrichedStaffMember[] = [];
    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map(async (staff) => {
          try {
            const details = await staffApi.getById(staff.azureAdId);
            return {
              ...staff,
              userType: { type: 'staff' as const, displayName: details.displayName },
              details: { ...details, azureAdId: staff.azureAdId },
              isLoading: false,
            };
          } catch (err) {
            const userType = categorizeNonStaff(staff.azureAdId);
            return {
              ...staff,
              userType,
              isLoading: false,
              error: 'Not found in Azure AD',
              details: {
                id: staff.azureAdId,
                azureAdId: staff.azureAdId,
                displayName: userType.displayName || staff.azureAdId,
              },
            };
          }
        })
      );
      allResults = [...allResults, ...batchResults];
    }
    return allResults;
  };
  
  useEffect(() => {
    if (staffData?.data) {
      const enrichStaffData = async () => {
        setEnrichedStaff(staffData.data.map(staff => ({
          ...staff,
          userType: { type: 'staff' },
          isLoading: true,
        })));
        
        const enriched = await processBatchedAzureAdQueries(staffData.data);
        setEnrichedStaff(enriched);

        const staffAzureAdIds = enriched.filter(s => s.userType.type === 'staff').map(s => s.azureAdId);
        if (staffAzureAdIds.length > 0) {
          preloadPhotos(staffAzureAdIds);
        }
      };
      enrichStaffData();
    } else if (!isLoading) {
      setEnrichedStaff([]);
    }
  }, [staffData, isLoading]);

  const filteredStaff = enrichedStaff;

  useEffect(() => {
    const staffAzureAdIds = filteredStaff.filter(s => s.userType.type === 'staff').map(s => s.azureAdId);
    if (staffAzureAdIds.length > 0) {
      preloadPhotos(staffAzureAdIds);
    }
  }, [filteredStaff, preloadPhotos]);

  useEffect(() => {
    const userId = searchParams.get('user');
    if (userId && enrichedStaff.length > 0) {
      const staffMember = enrichedStaff.find(staff => staff.azureAdId === userId);
      if (staffMember?.details) {
        setSelectedStaff(staffMember.details);
        setDetailsDialogOpen(true);
        const newSearchParams = new URLSearchParams(searchParams);
        newSearchParams.delete('user');
        setSearchParams(newSearchParams, { replace: true });
      }
    }
  }, [enrichedStaff, searchParams, setSearchParams]);

  const handleViewDetails = (staff: EnrichedStaffMember) => {
    if (staff.details) {
      setSelectedStaff(staff.details);
      setDetailsDialogOpen(true);
    }
  };

  const handleViewAssets = (azureAdId: string) => {
    navigate(`/assets?assignedTo=${azureAdId}`);
  };

  const departments = Array.from(new Set(enrichedStaff.map(s => s.details?.department).filter((d): d is string => !!d))).sort();

  if (currentUser?.role !== 'ADMIN') {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-medium">Access Denied</span>
          </div>
          <p className="text-red-600 dark:text-red-400 mt-1">You need administrator privileges to view staff information.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
            <UserCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Staff Members</h1>
            <p className="text-slate-600 dark:text-slate-400">
              {(() => {
                const totalCount = staffData?.pagination?.total ?? 0;
                const staffCount = enrichedStaff.filter(s => s.userType.type === 'staff').length;
                const nonAdCount = enrichedStaff.filter(s => isNonADAccount(s)).length;
                
                if (debouncedSearchQuery || userTypeFilter !== 'all') {
                  return `${filteredStaff.length} shown of ${totalCount} total`;
                }
                return `${totalCount} total (${staffCount} staff, ${nonAdCount} non-AD)`;
              })()}
            </p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        >
          <RefreshCw className={clsx("w-4 h-4", isLoading && "animate-spin")} />
          Refresh
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search staff..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700"
            />
            {isFetching && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <RefreshCw className="w-4 h-4 text-slate-400 animate-spin" />
              </div>
            )}
          </div>
          
          <div className="flex gap-2">
            <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 p-1">
              <button 
                onClick={() => setViewMode('large')} 
                className={clsx(
                  'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  viewMode === 'large' 
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600'
                )}
              >
                Large
              </button>
              <button 
                onClick={() => setViewMode('medium')} 
                className={clsx(
                  'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  viewMode === 'medium' 
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600'
                )}
              >
                Medium
              </button>
              <button 
                onClick={() => setViewMode('compact')} 
                className={clsx(
                  'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  viewMode === 'compact' 
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600'
                )}
              >
                Compact
              </button>
            </div>
            <Select.Root value={userTypeFilter} onValueChange={(value) => setUserTypeFilter(value as any)}>
              <Select.Trigger className="flex items-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 min-w-[120px]">
                <Users className="w-4 h-4" />
                <Select.Value placeholder="Type" />
                <Select.Icon><ChevronDown className="w-4 h-4" /></Select.Icon>
              </Select.Trigger>
              <Select.Portal>
                <Select.Content className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50">
                  <Select.Viewport className="p-1">
                    <Select.Item value="all" className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer rounded-md"><Select.ItemText>All Types</Select.ItemText></Select.Item>
                    <Select.Item value="staff" className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer rounded-md"><Select.ItemText>Staff</Select.ItemText></Select.Item>
                    <Select.Item value="non_ad" className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer rounded-md"><Select.ItemText>Non-AD Accounts</Select.ItemText></Select.Item>
                  </Select.Viewport>
                </Select.Content>
              </Select.Portal>
            </Select.Root>
            
            <Select.Root value={departmentFilter} onValueChange={setDepartmentFilter}>
              <Select.Trigger className="flex items-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 min-w-[140px]">
                <Filter className="w-4 h-4" />
                <Select.Value placeholder="Department" />
                <Select.Icon><ChevronDown className="w-4 h-4" /></Select.Icon>
              </Select.Trigger>
              <Select.Portal>
                <Select.Content className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50">
                  <Select.Viewport className="p-1">
                    <Select.Item value="all" className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer rounded-md"><Select.ItemText>All Departments</Select.ItemText></Select.Item>
                    {departments.map((dept) => (
                      <Select.Item key={dept} value={dept} className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer rounded-md"><Select.ItemText>{dept}</Select.ItemText></Select.Item>
                    ))}
                  </Select.Viewport>
                </Select.Content>
              </Select.Portal>
            </Select.Root>

            <Select.Root value={String(limit)} onValueChange={(value) => setLimit(Number(value))}>
              <Select.Trigger className="flex items-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 min-w-[100px]">
                <Select.Value placeholder="Per Page" />
                <Select.Icon><ChevronDown className="w-4 h-4" /></Select.Icon>
              </Select.Trigger>
              <Select.Portal>
                <Select.Content className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50">
                  <Select.Viewport className="p-1">
                    <Select.Item value="50" className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer rounded-md"><Select.ItemText>50 / page</Select.ItemText></Select.Item>
                    <Select.Item value="100" className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer rounded-md"><Select.ItemText>100 / page</Select.ItemText></Select.Item>
                    <Select.Item value="250" className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer rounded-md"><Select.ItemText>250 / page</Select.ItemText></Select.Item>
                    <Select.Item value="500" className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer rounded-md"><Select.ItemText>500 / page</Select.ItemText></Select.Item>
                  </Select.Viewport>
                </Select.Content>
              </Select.Portal>
            </Select.Root>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {isLoading && !isFetching && enrichedStaff.length === 0 ? (
          <div className="p-12 text-center">
            <div className="relative mx-auto mb-6 w-16 h-16">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full animate-pulse" />
              <div className="absolute inset-2 bg-white dark:bg-slate-800 rounded-full" />
              <div className="absolute inset-3 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full animate-pulse" />
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-lg font-medium">Loading staff members...</p>
            <p className="text-slate-500 dark:text-slate-500 text-sm mt-2">Please wait while we fetch the latest data</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center">
            <div className="relative mx-auto mb-6 w-16 h-16">
              <div className="absolute inset-0 bg-red-100 dark:bg-red-900/20 rounded-full" />
              <AlertTriangle className="w-8 h-8 text-red-500 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
            </div>
            <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">Error loading staff members</h3>
            <p className="text-slate-500 dark:text-slate-500 text-sm mb-4">We encountered an issue while fetching the staff data</p>
            <button 
              onClick={() => refetch()} 
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Try again
            </button>
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="p-12 text-center">
            <div className="relative mx-auto mb-6 w-16 h-16">
              <div className="absolute inset-0 bg-slate-100 dark:bg-slate-700 rounded-full" />
              <UserCheck className="w-8 h-8 text-slate-400 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
            </div>
            <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-300 mb-2">No staff members found</h3>
            <p className="text-slate-500 dark:text-slate-500 text-sm">Try adjusting your search criteria or filters</p>
          </div>
        ) : (
          <div className="p-6">
            {viewMode === 'compact' ? (
              <div className="space-y-0">
                <div className="grid grid-cols-12 gap-4 px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide bg-slate-50 dark:bg-slate-700 border-b border-slate-200 dark:border-slate-600">
                  <div className="col-span-3">Staff Member</div>
                  <div className="col-span-2">Department</div>
                  <div className="col-span-2">Location</div>
                  <div className="col-span-2">Contact</div>
                  <div className="col-span-1">Assets</div>
                  <div className="col-span-2">Actions</div>
                </div>
                {filteredStaff.map((staff) => (
                  <motion.div
                    key={staff.azureAdId}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="grid grid-cols-12 gap-4 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors duration-200 border-b border-slate-100 dark:border-slate-800 last:border-b-0"
                  >
                    <div className="col-span-3 flex items-center gap-3 min-w-0">
                      <ProfilePicture azureAdId={staff.azureAdId} displayName={staff.details?.displayName} size="sm" userType={staff.userType} />
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900 dark:text-slate-100 truncate">{staff.details?.displayName || 'Unknown User'}</div>
                        <div className="text-sm text-slate-500 dark:text-slate-400 truncate">
                          {staff.userType.type === 'staff' ? staff.details?.jobTitle || 'No title' : getUserCategoryDisplay(staff.userType)}
                        </div>
                      </div>
                    </div>
                    <div className="col-span-2 flex items-center">
                      <div className="text-sm text-slate-600 dark:text-slate-400 truncate">{staff.details?.department || '-'}</div>
                    </div>
                    <div className="col-span-2 flex items-center">
                      <div className="text-sm text-slate-600 dark:text-slate-400 truncate">{staff.details?.officeLocation || '-'}</div>
                    </div>
                    <div className="col-span-2 flex items-center">
                      <div className="min-w-0">
                        {staff.userType.type === 'staff' && staff.details?.mail && (
                          <div className="text-sm text-slate-600 dark:text-slate-400 truncate">{staff.details.mail}</div>
                        )}
                        {staff.userType.type === 'staff' && staff.details?.mobilePhone && (
                          <div className="text-xs text-slate-500 dark:text-slate-500 truncate">{staff.details.mobilePhone}</div>
                        )}
                        {staff.userType.type === 'staff' && staff.details?.employeeId && (
                          <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-500">
                            <span>ID: {staff.details.employeeId}</span>
                            <BambooHRLink employeeId={staff.details.employeeId} />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="col-span-1 flex items-center">
                      <div className="flex items-center gap-1">
                        <Package className="w-4 h-4 text-blue-500" />
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{staff.assetCount}</span>
                      </div>
                    </div>
                    <div className="col-span-2 flex items-center gap-2">
                      <button 
                        onClick={() => handleViewDetails(staff)} 
                        disabled={!staff.details || staff.userType.type !== 'staff'} 
                        className="p-2 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors disabled:opacity-50"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleViewAssets(staff.azureAdId)} 
                        className="p-2 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors"
                        title="View Assets"
                      >
                        <Package className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className={clsx(
                'grid gap-6',
                viewMode === 'large' ? 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
              )}>
                {filteredStaff.map((staff) => (
                  <motion.div
                    key={staff.azureAdId}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={clsx(
                      'bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:shadow-lg hover:border-blue-200 dark:hover:border-blue-700 transition-all duration-200',
                      viewMode === 'large' ? 'p-6' : 'p-4'
                    )}
                  >
                    {viewMode === 'large' ? (
                      // Large view layout
                      <div className="space-y-4">
                        <div className="flex items-start gap-4">
                          <ProfilePicture azureAdId={staff.azureAdId} displayName={staff.details?.displayName} size="xl" userType={staff.userType} />
                          <div className="flex-1 min-w-0">
                            {staff.isLoading ? (
                              <div className="space-y-2">
                                <div className="h-6 bg-slate-200 dark:bg-slate-600 rounded animate-pulse" />
                                <div className="h-4 bg-slate-200 dark:bg-slate-600 rounded animate-pulse w-3/4" />
                                <div className="h-4 bg-slate-200 dark:bg-slate-600 rounded animate-pulse w-1/2" />
                              </div>
                            ) : staff.error ? (
                              <div className="min-w-0">
                                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 truncate">{staff.details?.displayName || 'Unknown User'}</h3>
                                <p className="text-sm text-red-500 truncate">{staff.error}</p>
                              </div>
                            ) : (
                              <div className="min-w-0">
                                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 truncate" title={staff.details?.displayName}>
                                  {staff.details?.displayName || 'Unknown User'}
                                </h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 truncate mb-2" title={staff.details?.mail || staff.details?.userPrincipalName}>
                                  {staff.userType.type === 'staff' ? staff.details?.mail || staff.details?.userPrincipalName || 'No email' : getUserCategoryDisplay(staff.userType)}
                                </p>
                                {staff.userType.type === 'staff' && staff.details?.jobTitle && (
                                  <div className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium">
                                    <Briefcase className="w-3 h-3" />
                                    {staff.details.jobTitle}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          <DropdownMenu.Root>
                            <DropdownMenu.Trigger className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                              <MoreHorizontal className="w-4 h-4" />
                            </DropdownMenu.Trigger>
                            <DropdownMenu.Portal>
                              <DropdownMenu.Content className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50 min-w-[160px]">
                                <DropdownMenu.Item className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm flex items-center gap-2 cursor-pointer" onClick={() => handleViewDetails(staff)} disabled={!staff.details || staff.userType.type !== 'staff'}>
                                  <Eye className="w-4 h-4" />View Details
                                </DropdownMenu.Item>
                                <DropdownMenu.Item className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm flex items-center gap-2 cursor-pointer" onClick={() => handleViewAssets(staff.azureAdId)}>
                                  <Package className="w-4 h-4" />View Assets
                                </DropdownMenu.Item>
                              </DropdownMenu.Content>
                            </DropdownMenu.Portal>
                          </DropdownMenu.Root>
                        </div>
                        
                        <div className="space-y-3">
                          {staff.userType.type === 'staff' && staff.details?.department && (
                            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                              <Building className="w-4 h-4 text-slate-500 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Department</div>
                                <div className="text-sm text-slate-600 dark:text-slate-400 truncate">{staff.details.department}</div>
                              </div>
                            </div>
                          )}
                          {staff.userType.type === 'staff' && staff.details?.officeLocation && (
                            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                              <MapPin className="w-4 h-4 text-slate-500 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Office Location</div>
                                <div className="text-sm text-slate-600 dark:text-slate-400 truncate">{staff.details.officeLocation}</div>
                              </div>
                            </div>
                          )}
                          {staff.userType.type === 'staff' && staff.details?.employeeId && (
                            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                              <User className="w-4 h-4 text-slate-500 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Employee ID</div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-slate-600 dark:text-slate-400">{staff.details.employeeId}</span>
                                  <BambooHRLink employeeId={staff.details.employeeId} />
                                </div>
                              </div>
                            </div>
                          )}
                          {staff.userType.type === 'staff' && staff.details?.mobilePhone && (
                            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                              <Phone className="w-4 h-4 text-slate-500 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Mobile Phone</div>
                                <div className="text-sm text-slate-600 dark:text-slate-400 truncate">{staff.details.mobilePhone}</div>
                              </div>
                            </div>
                          )}
                          {staff.userType.type === 'staff' && staff.details?.businessPhones && staff.details.businessPhones.length > 0 && (
                            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                              <Phone className="w-4 h-4 text-slate-500 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Business Phone</div>
                                <div className="text-sm text-slate-600 dark:text-slate-400 truncate">{staff.details.businessPhones[0]}</div>
                              </div>
                            </div>
                          )}
                          {staff.userType.type === 'staff' && staff.details?.mail && (
                            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                              <Mail className="w-4 h-4 text-slate-500 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Email</div>
                                <div className="text-sm text-slate-600 dark:text-slate-400 truncate">{staff.details.mail}</div>
                              </div>
                            </div>
                          )}
                          <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                            <Package className="w-4 h-4 text-blue-500 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Assets Assigned</div>
                              <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">{staff.assetCount} asset{staff.assetCount !== 1 ? 's' : ''}</div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex gap-2 pt-2">
                          <button 
                            onClick={() => handleViewDetails(staff)} 
                            disabled={!staff.details || staff.userType.type !== 'staff'} 
                            className="flex-1 px-4 py-2 text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                          >
                            <Eye className="w-4 h-4" />
                            Details
                          </button>
                          <button 
                            onClick={() => handleViewAssets(staff.azureAdId)} 
                            className="flex-1 px-4 py-2 text-sm bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
                          >
                            <Package className="w-4 h-4" />
                            Assets
                          </button>
                        </div>
                      </div>
                    ) : (
                      // Medium view layout
                      <div className="space-y-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <ProfilePicture azureAdId={staff.azureAdId} displayName={staff.details?.displayName} size="md" userType={staff.userType} />
                            <div className="min-w-0 flex-1">
                              {staff.isLoading ? (
                                <div className="space-y-2">
                                  <div className="h-4 bg-slate-200 dark:bg-slate-600 rounded animate-pulse" />
                                  <div className="h-3 bg-slate-200 dark:bg-slate-600 rounded animate-pulse w-3/4" />
                                </div>
                              ) : staff.error ? (
                                <div className="min-w-0">
                                  <div className="font-medium text-slate-900 dark:text-slate-100 truncate">{staff.details?.displayName || 'Unknown User'}</div>
                                  <div className="text-sm text-red-500 truncate">{staff.error}</div>
                                </div>
                              ) : (
                                <div className="min-w-0">
                                  <div className="font-medium text-slate-900 dark:text-slate-100 truncate" title={staff.details?.displayName}>
                                    {staff.details?.displayName || 'Unknown User'}
                                  </div>
                                  <div className="text-sm text-slate-500 dark:text-slate-400 truncate" title={staff.details?.mail || staff.details?.userPrincipalName}>
                                    {staff.userType.type === 'staff' ? staff.details?.mail || staff.details?.userPrincipalName || 'No email' : getUserCategoryDisplay(staff.userType)}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                          <DropdownMenu.Root>
                            <DropdownMenu.Trigger className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                              <MoreHorizontal className="w-4 h-4" />
                            </DropdownMenu.Trigger>
                            <DropdownMenu.Portal>
                              <DropdownMenu.Content className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50 min-w-[160px]">
                                <DropdownMenu.Item className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm flex items-center gap-2 cursor-pointer" onClick={() => handleViewDetails(staff)} disabled={!staff.details || staff.userType.type !== 'staff'}>
                                  <Eye className="w-4 h-4" />View Details
                                </DropdownMenu.Item>
                                <DropdownMenu.Item className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm flex items-center gap-2 cursor-pointer" onClick={() => handleViewAssets(staff.azureAdId)}>
                                  <Package className="w-4 h-4" />View Assets
                                </DropdownMenu.Item>
                              </DropdownMenu.Content>
                            </DropdownMenu.Portal>
                          </DropdownMenu.Root>
                        </div>
                        
                        <div className="space-y-2">
                          {staff.userType.type === 'staff' && staff.details?.jobTitle && (
                            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                              <Briefcase className="w-4 h-4 flex-shrink-0" />
                              <span className="truncate">{staff.details.jobTitle}</span>
                            </div>
                          )}
                          {staff.userType.type === 'staff' && staff.details?.department && (
                            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                              <Building className="w-4 h-4 flex-shrink-0" />
                              <span className="truncate">{staff.details.department}</span>
                            </div>
                          )}
                          {staff.userType.type === 'staff' && staff.details?.officeLocation && (
                            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                              <MapPin className="w-4 h-4 flex-shrink-0" />
                              <span className="truncate">{staff.details.officeLocation}</span>
                            </div>
                          )}
                          {staff.userType.type === 'staff' && staff.details?.employeeId && (
                            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                              <User className="w-4 h-4 flex-shrink-0" />
                              <span className="truncate">ID: {staff.details.employeeId}</span>
                              <BambooHRLink employeeId={staff.details.employeeId} />
                            </div>
                          )}
                          {staff.userType.type === 'staff' && staff.details?.mobilePhone && (
                            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                              <Phone className="w-4 h-4 flex-shrink-0" />
                              <span className="truncate">{staff.details.mobilePhone}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2 text-sm">
                            <Package className="w-4 h-4 text-blue-500 flex-shrink-0" />
                            <span className="text-slate-900 dark:text-slate-100 font-medium">{staff.assetCount} asset{staff.assetCount !== 1 ? 's' : ''}</span>
                          </div>
                        </div>
                        
                        <div className="flex gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                          <button 
                            onClick={() => handleViewDetails(staff)} 
                            disabled={!staff.details || staff.userType.type !== 'staff'} 
                            className="flex-1 px-3 py-2 text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 disabled:opacity-50 transition-colors flex items-center justify-center gap-1"
                          >
                            <Eye className="w-3 h-3" />
                            Details
                          </button>
                          <button 
                            onClick={() => handleViewAssets(staff.azureAdId)} 
                            className="flex-1 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-1"
                          >
                            <Package className="w-3 h-3" />
                            Assets
                          </button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
            
            {staffData?.pagination && staffData.pagination.totalPages > 1 && (
              <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-sm text-slate-600 dark:text-slate-400 order-2 sm:order-1">
                    Showing <span className="font-medium text-slate-900 dark:text-slate-100">{((staffData.pagination.page - 1) * staffData.pagination.limit) + 1}</span> to{' '}
                    <span className="font-medium text-slate-900 dark:text-slate-100">{Math.min(staffData.pagination.page * staffData.pagination.limit, staffData.pagination.total)}</span> of{' '}
                    <span className="font-medium text-slate-900 dark:text-slate-100">{staffData.pagination.total}</span> staff members
                  </div>
                  <div className="flex items-center gap-2 order-1 sm:order-2">
                    <button 
                      onClick={() => setPage(p => p - 1)} 
                      disabled={page === 1} 
                      className="px-4 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                      Previous
                    </button>
                    <div className="flex items-center px-4 py-2 text-sm bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
                      <span className="text-blue-600 dark:text-blue-400 font-medium">Page {page} of {staffData.pagination.totalPages}</span>
                    </div>
                    <button 
                      onClick={() => setPage(p => p + 1)} 
                      disabled={page === staffData.pagination.totalPages} 
                      className="px-4 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedStaff && (
        <Dialog.Root open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
            <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-slate-800 rounded-xl border-slate-200 dark:border-slate-700 p-6 w-full max-w-2xl z-50 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <Dialog.Title className="text-xl font-semibold text-slate-900 dark:text-slate-100">Staff Member Details</Dialog.Title>
                <Dialog.Close asChild><button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"><X className="w-4 h-4" /></button></Dialog.Close>
              </div>
              <div className="space-y-6">
                <div className="flex items-center gap-6 p-6 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl border-blue-200 dark:border-blue-700">
                  <ProfilePicture azureAdId={selectedStaff.azureAdId} displayName={selectedStaff.displayName} size="lg" userType={enrichedStaff.find(s => s.azureAdId === selectedStaff.azureAdId)?.userType} />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">{selectedStaff.displayName}</h3>
                    <p className="text-blue-600 dark:text-blue-400 font-medium mb-2">{selectedStaff.jobTitle || 'Employee'}</p>
                    {selectedStaff.department && (
                      <div className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm">
                        <Building className="w-3 h-3" />
                        <span className="truncate">{selectedStaff.department}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2"><Mail className="w-5 h-5" />Contact Information</h4>
                    <div className="space-y-3">
                      {selectedStaff.mail && (<div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700 rounded-lg"><Mail className="w-4 h-4 text-slate-500" /><div><div className="text-sm font-medium">Email</div><div className="text-sm text-slate-600">{selectedStaff.mail}</div></div></div>)}
                      {selectedStaff.mobilePhone && (<div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700 rounded-lg"><Phone className="w-4 h-4 text-slate-500" /><div><div className="text-sm font-medium">Mobile Phone</div><div className="text-sm text-slate-600">{selectedStaff.mobilePhone}</div></div></div>)}
                      {selectedStaff.businessPhones && selectedStaff.businessPhones.length > 0 && (<div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700 rounded-lg"><Phone className="w-4 h-4 text-slate-500" /><div><div className="text-sm font-medium">Business Phone</div><div className="text-sm text-slate-600">{selectedStaff.businessPhones[0]}</div></div></div>)}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2"><Building className="w-5 h-5" />Organization</h4>
                    <div className="space-y-3">
                      {selectedStaff.officeLocation && (<div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700 rounded-lg"><MapPin className="w-4 h-4 text-slate-500" /><div><div className="text-sm font-medium">Office Location</div><div className="text-sm text-slate-600">{selectedStaff.officeLocation}</div></div></div>)}
                      {selectedStaff.employeeId && (
                        <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                          <User className="w-4 h-4 text-slate-500" />
                          <div className="flex-1">
                            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Employee ID</div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-slate-600 dark:text-slate-400">{selectedStaff.employeeId}</span>
                              <BambooHRLink employeeId={selectedStaff.employeeId} showLabel />
                            </div>
                          </div>
                        </div>
                      )}
                      {selectedStaff.manager && (<div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700 rounded-lg"><Users className="w-4 h-4 text-slate-500" /><div><div className="text-sm font-medium">Manager</div><div className="text-sm text-slate-600">{selectedStaff.manager.displayName}{selectedStaff.manager.mail && <div className="text-xs text-slate-500">{selectedStaff.manager.mail}</div>}</div></div></div>)}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-6 border-t border-slate-200 dark:border-slate-700">
                  <Dialog.Close asChild><button className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300">Close</button></Dialog.Close>
                  <button onClick={() => { setDetailsDialogOpen(false); handleViewAssets(selectedStaff.id); }} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"><Package className="w-4 h-4" />View Assets</button>
                </div>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </div>
  );
};

export default Staff; 