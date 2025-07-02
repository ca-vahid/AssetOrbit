import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  ExternalLink,
  Eye,
  Filter,
  ChevronDown,
  Users,
  Briefcase,
  Calendar,
  X
} from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Select from '@radix-ui/react-select';
import { usersApi, staffApi } from '../services/api';
import { useStore } from '../store';
import { useNavigate } from 'react-router-dom';
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
}

// Custom hook for profile photos
const useProfilePhoto = (azureAdId: string | undefined) => {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAttempted, setHasAttempted] = useState(false);

  useEffect(() => {
    if (!azureAdId || hasAttempted) return;

    const loadPhoto = async () => {
      setIsLoading(true);
      setError(null);
      setHasAttempted(true);
      
      try {
        const photoBlob = await staffApi.getProfilePhoto(azureAdId);
        const url = URL.createObjectURL(photoBlob);
        setPhotoUrl(url);
      } catch (err: any) {
        if (err.response?.status === 404) {
          // No photo available - this is normal, don't set as error
          setPhotoUrl(null);
          setError(null);
        } else {
          setError('Failed to load photo');
          console.error('Error loading profile photo:', err);
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadPhoto();

    // Cleanup function to revoke object URL
    return () => {
      if (photoUrl) {
        URL.revokeObjectURL(photoUrl);
      }
    };
  }, [azureAdId, hasAttempted]);

  // Reset when azureAdId changes
  useEffect(() => {
    setHasAttempted(false);
    setPhotoUrl(null);
    setError(null);
  }, [azureAdId]);

  return { photoUrl, isLoading, error };
};

// Profile picture component with fallback to initials
const ProfilePicture: React.FC<{
  azureAdId?: string;
  displayName?: string;
  size: 'sm' | 'lg';
  className?: string;
}> = ({ azureAdId, displayName, size, className }) => {
  const { photoUrl, isLoading } = useProfilePhoto(azureAdId);
  
  const sizeClasses = {
    sm: 'w-12 h-12 text-base',
    lg: 'w-20 h-20 text-xl',
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
          size === 'lg' && 'border-4 shadow-lg',
          className
        )}
        onError={() => {
          // If image fails to load, we'll fall back to initials
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
      size === 'lg' && 'border-4 shadow-lg',
      className
    )}>
      <span className="select-none font-bold text-white">
        {getInitials(displayName)}
      </span>
    </div>
  );
};

const Staff: React.FC = () => {
  const { currentUser } = useStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [selectedStaff, setSelectedStaff] = useState<StaffDetails | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [enrichedStaff, setEnrichedStaff] = useState<EnrichedStaffMember[]>([]);

  const { data: staffData, isLoading, error, refetch } = useQuery({
    queryKey: ['staff-with-assets', { search: searchQuery, page, department: departmentFilter }],
    queryFn: () => usersApi.getStaffWithAssets({ 
      search: searchQuery || undefined,
      page,
      limit: 50,
      department: departmentFilter !== 'all' ? departmentFilter : undefined,
    }),
  });

  // Enrich staff data with Graph API details
  useEffect(() => {
    if (staffData?.data) {
      const enrichStaffData = async () => {
        const enriched = await Promise.all(
          staffData.data.map(async (staff) => {
            try {
              const details = await staffApi.getById(staff.azureAdId);
              return {
                ...staff,
                details: {
                  ...details,
                  azureAdId: staff.azureAdId,
                },
                isLoading: false,
              };
            } catch (error) {
              console.error(`Error fetching details for ${staff.azureAdId}:`, error);
              return {
                ...staff,
                isLoading: false,
                error: 'Failed to load details',
              };
            }
          })
        );
        setEnrichedStaff(enriched);
      };

      // Set loading state first
      setEnrichedStaff(
        staffData.data.map(staff => ({
          ...staff,
          isLoading: true,
        }))
      );

      enrichStaffData();
    }
  }, [staffData]);

  const handleViewDetails = (staff: EnrichedStaffMember) => {
    if (staff.details) {
      setSelectedStaff(staff.details);
      setDetailsDialogOpen(true);
    }
  };

  const handleViewAssets = (azureAdId: string) => {
    navigate(`/assets?assignedTo=${azureAdId}`);
  };

  // Get unique departments for filter
  const departments = Array.from(
    new Set(
      enrichedStaff
        .filter(staff => staff.details?.department)
        .map(staff => staff.details!.department!)
    )
  ).sort();

  if (currentUser?.role !== 'ADMIN') {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-medium">Access Denied</span>
          </div>
          <p className="text-red-600 dark:text-red-400 mt-1">
            You need administrator privileges to view staff information.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
            <UserCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Staff Members
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              Staff members with assigned assets ({enrichedStaff.length} total)
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

      {/* Search and Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search staff members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div className="flex gap-2">
            <Select.Root value={departmentFilter} onValueChange={setDepartmentFilter}>
              <Select.Trigger className="flex items-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 min-w-[140px]">
                <Filter className="w-4 h-4" />
                <Select.Value placeholder="Department" />
                <Select.Icon>
                  <ChevronDown className="w-4 h-4" />
                </Select.Icon>
              </Select.Trigger>
              <Select.Portal>
                <Select.Content className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50">
                  <Select.Viewport className="p-1">
                    <Select.Item value="all" className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer rounded-md">
                      <Select.ItemText>All Departments</Select.ItemText>
                    </Select.Item>
                    {departments.map((dept) => (
                      <Select.Item key={dept} value={dept} className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer rounded-md">
                        <Select.ItemText>{dept}</Select.ItemText>
                      </Select.Item>
                    ))}
                  </Select.Viewport>
                </Select.Content>
              </Select.Portal>
            </Select.Root>
          </div>
        </div>
      </div>

      {/* Staff Grid */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full animate-pulse mx-auto mb-4" />
            <p className="text-slate-600 dark:text-slate-400">Loading staff members...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <div className="text-red-500 mb-2">Error loading staff members</div>
            <button 
              onClick={() => refetch()}
              className="text-blue-600 hover:text-blue-700"
            >
              Try again
            </button>
          </div>
        ) : enrichedStaff.length === 0 ? (
          <div className="p-8 text-center">
            <UserCheck className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600 dark:text-slate-400">No staff members with assigned assets found</p>
          </div>
        ) : (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {enrichedStaff.map((staff) => (
                <motion.div
                  key={staff.azureAdId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-slate-50 dark:bg-slate-700 rounded-xl p-6 border border-slate-200 dark:border-slate-600 hover:shadow-lg hover:border-blue-200 dark:hover:border-blue-700 transition-all duration-200 w-full max-w-sm mx-auto overflow-hidden"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <ProfilePicture azureAdId={staff.azureAdId} displayName={staff.details?.displayName} size="sm" />
                      <div className="min-w-0 flex-1">
                        {staff.isLoading ? (
                          <div className="space-y-2">
                            <div className="h-4 bg-slate-200 dark:bg-slate-600 rounded animate-pulse" />
                            <div className="h-3 bg-slate-200 dark:bg-slate-600 rounded animate-pulse w-3/4" />
                          </div>
                        ) : staff.error ? (
                          <div className="min-w-0">
                            <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                              Staff Member
                            </div>
                            <div className="text-sm text-red-500 truncate">
                              Failed to load
                            </div>
                          </div>
                        ) : (
                          <div className="min-w-0">
                            <div className="font-medium text-slate-900 dark:text-slate-100 truncate break-words" title={staff.details?.displayName}>
                              {staff.details?.displayName || 'Unknown User'}
                            </div>
                            <div className="text-sm text-slate-500 dark:text-slate-400 truncate break-all" title={staff.details?.mail || staff.details?.userPrincipalName}>
                              {staff.details?.mail || staff.details?.userPrincipalName || 'No email'}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors flex-shrink-0 ml-2">
                        <MoreHorizontal className="w-4 h-4" />
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Portal>
                        <DropdownMenu.Content className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50 min-w-[160px]">
                          <DropdownMenu.Item 
                            className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer text-sm flex items-center gap-2"
                            onClick={() => handleViewDetails(staff)}
                            disabled={!staff.details}
                          >
                            <Eye className="w-3 h-3" />
                            View Details
                          </DropdownMenu.Item>
                          <DropdownMenu.Item 
                            className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer text-sm flex items-center gap-2"
                            onClick={() => handleViewAssets(staff.azureAdId)}
                          >
                            <Package className="w-3 h-3" />
                            View Assets
                          </DropdownMenu.Item>
                        </DropdownMenu.Content>
                      </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                  </div>

                  {/* Staff Info */}
                  <div className="space-y-3 min-w-0">
                    {staff.details?.jobTitle && (
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 min-w-0">
                        <Briefcase className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate break-words" title={staff.details.jobTitle}>{staff.details.jobTitle}</span>
                      </div>
                    )}
                    
                    {staff.details?.department && (
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 min-w-0">
                        <Building className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate break-words" title={staff.details.department}>{staff.details.department}</span>
                      </div>
                    )}
                    
                    {staff.details?.officeLocation && (
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 min-w-0">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate break-words" title={staff.details.officeLocation}>{staff.details.officeLocation}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2 text-sm">
                      <Package className="w-3 h-3 text-blue-500 flex-shrink-0" />
                      <span className="text-slate-900 dark:text-slate-100 font-medium">
                        {staff.assetCount} asset{staff.assetCount !== 1 ? 's' : ''} assigned
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-600">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleViewDetails(staff)}
                        disabled={!staff.details}
                        className="flex-1 px-3 py-2 text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        Details
                      </button>
                      <button
                        onClick={() => handleViewAssets(staff.azureAdId)}
                        className="flex-1 px-3 py-2 text-sm bg-slate-100 dark:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-500 transition-colors flex items-center justify-center gap-1"
                      >
                        <Package className="w-3 h-3" />
                        Assets
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Pagination */}
            {staffData?.pagination && staffData.pagination.totalPages > 1 && (
              <div className="mt-8 flex items-center justify-between">
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Showing {((staffData.pagination.page - 1) * staffData.pagination.limit) + 1} to{' '}
                  {Math.min(staffData.pagination.page * staffData.pagination.limit, staffData.pagination.total)} of{' '}
                  {staffData.pagination.total} staff members
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                    className="px-4 py-2 text-sm bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  <span className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 flex items-center">
                    Page {page} of {staffData.pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={page === staffData.pagination.totalPages}
                    className="px-4 py-2 text-sm bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Staff Details Dialog */}
      <Dialog.Root open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 w-full max-w-2xl z-50 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <Dialog.Title className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                Staff Member Details
              </Dialog.Title>
              <Dialog.Close asChild>
                <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </Dialog.Close>
            </div>
            
            {selectedStaff && (
              <div className="space-y-6">
                {/* Profile Header */}
                <div className="flex items-center gap-6 p-6 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl border border-blue-200 dark:border-blue-700">
                  <ProfilePicture azureAdId={selectedStaff.azureAdId} displayName={selectedStaff.displayName} size="lg" />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">
                      {selectedStaff.displayName}
                    </h3>
                    <p className="text-blue-600 dark:text-blue-400 font-medium mb-2">
                      {selectedStaff.jobTitle || 'Employee'}
                    </p>
                    {selectedStaff.department && (
                      <div className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm">
                        <Building className="w-3 h-3" />
                        <span className="truncate">{selectedStaff.department}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Contact Information */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <Mail className="w-5 h-5" />
                      Contact Information
                    </h4>
                    
                    <div className="space-y-3">
                      {selectedStaff.mail && (
                        <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                          <Mail className="w-4 h-4 text-slate-500" />
                          <div>
                            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Email</div>
                            <div className="text-sm text-slate-600 dark:text-slate-400">{selectedStaff.mail}</div>
                          </div>
                        </div>
                      )}

                      {selectedStaff.mobilePhone && (
                        <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                          <Phone className="w-4 h-4 text-slate-500" />
                          <div>
                            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Mobile Phone</div>
                            <div className="text-sm text-slate-600 dark:text-slate-400">{selectedStaff.mobilePhone}</div>
                          </div>
                        </div>
                      )}

                      {selectedStaff.businessPhones && selectedStaff.businessPhones.length > 0 && (
                        <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                          <Phone className="w-4 h-4 text-slate-500" />
                          <div>
                            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Business Phone</div>
                            <div className="text-sm text-slate-600 dark:text-slate-400">{selectedStaff.businessPhones[0]}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Organization Information */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <Building className="w-5 h-5" />
                      Organization
                    </h4>
                    
                    <div className="space-y-3">
                      {selectedStaff.officeLocation && (
                        <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                          <MapPin className="w-4 h-4 text-slate-500" />
                          <div>
                            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Office Location</div>
                            <div className="text-sm text-slate-600 dark:text-slate-400">{selectedStaff.officeLocation}</div>
                          </div>
                        </div>
                      )}

                      {selectedStaff.employeeId && (
                        <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                          <User className="w-4 h-4 text-slate-500" />
                          <div>
                            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Employee ID</div>
                            <div className="text-sm text-slate-600 dark:text-slate-400">{selectedStaff.employeeId}</div>
                          </div>
                        </div>
                      )}

                      {selectedStaff.manager && (
                        <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                          <Users className="w-4 h-4 text-slate-500" />
                          <div>
                            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Manager</div>
                            <div className="text-sm text-slate-600 dark:text-slate-400">
                              {selectedStaff.manager.displayName}
                              {selectedStaff.manager.mail && (
                                <div className="text-xs text-slate-500">{selectedStaff.manager.mail}</div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-6 border-t border-slate-200 dark:border-slate-700">
                  <Dialog.Close asChild>
                    <button className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                      Close
                    </button>
                  </Dialog.Close>
                  <button
                    onClick={() => {
                      setDetailsDialogOpen(false);
                      handleViewAssets(selectedStaff.id);
                    }}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <Package className="w-4 h-4" />
                    View Assets
                  </button>
                </div>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
};

export default Staff; 