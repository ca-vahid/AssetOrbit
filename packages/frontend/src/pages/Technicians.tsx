import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { 
  Search, 
  Filter, 
  UserCog, 
  MoreHorizontal,
  Shield,
  ShieldCheck,
  Crown,
  RefreshCw,
  AlertTriangle,
  Eye,
  Package,
  Activity,
  User,
  Mail,
  Building,
  MapPin,
  Phone,
  Calendar,
  X,
  Edit,
  Trash2
} from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Select from '@radix-ui/react-select';
import { usersApi, activitiesApi } from '../services/api';
import { useStore } from '../store';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';

interface Technician {
  id: string;
  azureAdId: string;
  email: string;
  displayName: string;
  givenName?: string;
  surname?: string;
  jobTitle?: string;
  department?: string;
  officeLocation?: string;
  role: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt?: string;
  _count?: {
    assignedAssets: number;
    createdAssets?: number;
    activities?: number;
  };
}

const roleConfig = {
  READ: { 
    label: 'Read Only', 
    icon: Shield, 
    color: 'text-slate-600 dark:text-slate-400',
    bg: 'bg-slate-100 dark:bg-slate-800'
  },
  WRITE: { 
    label: 'Read + Write', 
    icon: ShieldCheck, 
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-100 dark:bg-blue-900/30'
  },
  ADMIN: { 
    label: 'Administrator', 
    icon: Crown, 
    color: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-100 dark:bg-purple-900/30'
  }
};

const Technicians: React.FC = () => {
  const { currentUser } = useStore();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState('all');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [bulkRoleDialogOpen, setBulkRoleDialogOpen] = useState(false);
  const [bulkRole, setBulkRole] = useState('');
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [selectedTechnician, setSelectedTechnician] = useState<Technician | null>(null);
  const [updateRoleDialogOpen, setUpdateRoleDialogOpen] = useState(false);
  const [deleteUserDialogOpen, setDeleteUserDialogOpen] = useState(false);
  const [newRole, setNewRole] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data: technicians, isLoading, error, refetch } = useQuery({
    queryKey: ['users', { search: searchQuery, role: selectedRole }],
    queryFn: () => usersApi.getAll({ 
      search: searchQuery || undefined,
      role: selectedRole === 'all' ? undefined : selectedRole,
      limit: 50
    }),
  });

  const { data: activities, isLoading: activitiesLoading } = useQuery({
    queryKey: ['user-activities', selectedTechnician?.id],
    queryFn: () => selectedTechnician ? activitiesApi.getByEntity('USER', selectedTechnician.id) : Promise.resolve([]),
    enabled: !!selectedTechnician && activityDialogOpen,
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => usersApi.updateRole(id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: ({ userIds, role }: { userIds: string[]; role: string }) => 
      usersApi.bulkUpdateRoles(userIds, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setSelectedUsers([]);
      setBulkRoleDialogOpen(false);
      setBulkRole('');
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) => usersApi.deleteUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setDeleteUserDialogOpen(false);
      setSelectedTechnician(null);
      setDeleteError(null);
    },
    onError: (error: any) => {
      // Extract error message from response
      const errorMessage = error?.response?.data?.error || error?.message || 'Failed to delete user';
      setDeleteError(errorMessage);
    },
  });

  const handleRoleChange = (userId: string, newRole: string) => {
    updateRoleMutation.mutate({ id: userId, role: newRole });
  };

  const handleBulkRoleUpdate = () => {
    if (selectedUsers.length > 0 && bulkRole && bulkRole !== 'all') {
      bulkUpdateMutation.mutate({ userIds: selectedUsers, role: bulkRole });
    }
  };

  const handleSelectAll = () => {
    if (selectedUsers.length === technicians?.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(technicians?.map(t => t.id) || []);
    }
  };

  const handleSelectUser = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleViewDetails = (technician: Technician) => {
    setSelectedTechnician(technician);
    setDetailsDialogOpen(true);
  };

  const handleViewAssets = (technician: Technician) => {
    // Navigate to assets page with filter for this technician
    navigate(`/assets?assignedTo=${technician.id}`);
  };

  const handleViewActivity = (technician: Technician) => {
    setSelectedTechnician(technician);
    setActivityDialogOpen(true);
  };

  const handleUpdateRole = (technician: Technician) => {
    setSelectedTechnician(technician);
    setNewRole(technician.role);
    setUpdateRoleDialogOpen(true);
  };

  const handleDeleteUser = (technician: Technician) => {
    setSelectedTechnician(technician);
    setDeleteError(null);
    setDeleteUserDialogOpen(true);
  };

  const handleConfirmRoleUpdate = () => {
    if (selectedTechnician && newRole && newRole !== selectedTechnician.role) {
      updateRoleMutation.mutate({ id: selectedTechnician.id, role: newRole });
      setUpdateRoleDialogOpen(false);
      setSelectedTechnician(null);
      setNewRole('');
    }
  };

  const handleConfirmDeleteUser = () => {
    if (selectedTechnician) {
      deleteUserMutation.mutate(selectedTechnician.id);
    }
  };

  if (currentUser?.role !== 'ADMIN') {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-medium">Access Denied</span>
          </div>
          <p className="text-red-600 dark:text-red-400 mt-1">
            You need administrator privileges to manage technicians.
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
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
            <UserCog className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Users
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              Manage user permissions and access levels
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

      {/* Stats Cards */}
      {technicians && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {technicians.length}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Total Users
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Crown className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {technicians.filter(t => t.role === 'ADMIN').length}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Administrators
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {technicians.filter(t => t.role === 'WRITE').length}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Read + Write
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-slate-500 to-slate-600 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {technicians.filter(t => t.role === 'READ').length}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Read Only
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Role Filter */}
          <Select.Root value={selectedRole} onValueChange={setSelectedRole}>
            <Select.Trigger className="flex items-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 min-w-[140px]">
              <Filter className="w-4 h-4" />
              <Select.Value placeholder="All Roles" />
            </Select.Trigger>
            <Select.Portal>
              <Select.Content className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50">
                <Select.Item value="all" className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer">
                  All Roles
                </Select.Item>
                <Select.Item value="READ" className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer">
                  Read Only
                </Select.Item>
                <Select.Item value="WRITE" className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer">
                  Read + Write
                </Select.Item>
                <Select.Item value="ADMIN" className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer">
                  Administrator
                </Select.Item>
              </Select.Content>
            </Select.Portal>
          </Select.Root>
        </div>

        {/* Bulk Actions */}
        {selectedUsers.length > 0 && (
          <div className="mt-4 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-purple-700 dark:text-purple-300">
                {selectedUsers.length} user{selectedUsers.length > 1 ? 's' : ''} selected
              </span>
              <button
                onClick={() => setBulkRoleDialogOpen(true)}
                className="px-3 py-1 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm"
              >
                Update Roles
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Technicians Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-purple-600 rounded-full animate-pulse mx-auto mb-4" />
            <p className="text-slate-600 dark:text-slate-400">Loading users...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <div className="text-red-500 mb-2">Error loading users</div>
            <button 
              onClick={() => refetch()}
              className="text-purple-600 hover:text-purple-700"
            >
              Try again
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedUsers.length === technicians?.length && technicians?.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-slate-300 dark:border-slate-600"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-300">
                    User
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-300">
                    Role
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-300">
                    Department
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-300">
                    Assets
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-300">
                    Last Login
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-slate-700 dark:text-slate-300">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {technicians?.map((technician) => {
                  const roleInfo = roleConfig[technician.role as keyof typeof roleConfig];
                  return (
                    <motion.tr
                      key={technician.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="hover:bg-slate-50 dark:hover:bg-slate-700/50"
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(technician.id)}
                          onChange={() => handleSelectUser(technician.id)}
                          className="rounded border-slate-300 dark:border-slate-600"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center">
                            <span className="text-white text-sm font-medium">
                              {technician.displayName.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <div className="font-medium text-slate-900 dark:text-slate-100">
                              {technician.displayName}
                            </div>
                            <div className="text-sm text-slate-500 dark:text-slate-400">
                              {technician.email}
                            </div>
                            {technician.jobTitle && (
                              <div className="text-xs text-slate-400 dark:text-slate-500">
                                {technician.jobTitle}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Select.Root
                          value={technician.role}
                          onValueChange={(newRole: string) => handleRoleChange(technician.id, newRole)}
                        >
                          <Select.Trigger className={clsx(
                            "flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium",
                            roleInfo?.bg,
                            roleInfo?.color
                          )}>
                            {roleInfo?.icon && <roleInfo.icon className="w-3 h-3" />}
                            <Select.Value />
                          </Select.Trigger>
                          <Select.Portal>
                            <Select.Content className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50">
                              <Select.Item value="READ" className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer">
                                <div className="flex items-center gap-2">
                                  <Shield className="w-3 h-3" />
                                  Read Only
                                </div>
                              </Select.Item>
                              <Select.Item value="WRITE" className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer">
                                <div className="flex items-center gap-2">
                                  <ShieldCheck className="w-3 h-3" />
                                  Read + Write
                                </div>
                              </Select.Item>
                              <Select.Item value="ADMIN" className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer">
                                <div className="flex items-center gap-2">
                                  <Crown className="w-3 h-3" />
                                  Administrator
                                </div>
                              </Select.Item>
                            </Select.Content>
                          </Select.Portal>
                        </Select.Root>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {technician.department || 'Not specified'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {technician._count?.assignedAssets || 0} assigned
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {technician.lastLoginAt 
                          ? new Date(technician.lastLoginAt).toLocaleString()
                          : 'Never'
                        }
                      </td>
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu.Root>
                          <DropdownMenu.Trigger className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded">
                            <MoreHorizontal className="w-4 h-4" />
                          </DropdownMenu.Trigger>
                          <DropdownMenu.Portal>
                            <DropdownMenu.Content className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50 min-w-[160px]">
                              <DropdownMenu.Item 
                                className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer text-sm flex items-center gap-2"
                                onClick={() => handleViewDetails(technician)}
                              >
                                <Eye className="w-3 h-3" />
                                View Details
                              </DropdownMenu.Item>
                              <DropdownMenu.Item 
                                className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer text-sm flex items-center gap-2"
                                onClick={() => handleViewAssets(technician)}
                              >
                                <Package className="w-3 h-3" />
                                View Assets
                              </DropdownMenu.Item>
                              <DropdownMenu.Item 
                                className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer text-sm flex items-center gap-2"
                                onClick={() => handleViewActivity(technician)}
                              >
                                <Activity className="w-3 h-3" />
                                Activity Log
                              </DropdownMenu.Item>
                              <DropdownMenu.Separator className="h-px bg-slate-200 dark:bg-slate-600 my-1" />
                              <DropdownMenu.Item 
                                className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer text-sm flex items-center gap-2"
                                onClick={() => handleUpdateRole(technician)}
                              >
                                <Edit className="w-3 h-3" />
                                Update Role
                              </DropdownMenu.Item>
                              <DropdownMenu.Item 
                                className="px-3 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer text-sm flex items-center gap-2 text-red-600 dark:text-red-400"
                                onClick={() => handleDeleteUser(technician)}
                              >
                                <Trash2 className="w-3 h-3" />
                                Delete User
                              </DropdownMenu.Item>
                            </DropdownMenu.Content>
                          </DropdownMenu.Portal>
                        </DropdownMenu.Root>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bulk Role Update Dialog */}
      <Dialog.Root open={bulkRoleDialogOpen} onOpenChange={setBulkRoleDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 w-full max-w-md z-50">
            <Dialog.Title className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
              Update Roles for {selectedUsers.length} User{selectedUsers.length > 1 ? 's' : ''}
            </Dialog.Title>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  New Role
                </label>
                <Select.Root value={bulkRole} onValueChange={setBulkRole}>
                  <Select.Trigger className="w-full flex items-center justify-between px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100">
                    <Select.Value placeholder="Select a role" />
                    <Select.Icon>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </Select.Icon>
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Content 
                      className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg overflow-hidden"
                      style={{ zIndex: 9999 }}
                      position="popper"
                      sideOffset={5}
                    >
                      <Select.Viewport className="p-1">
                        <Select.Item 
                          value="READ" 
                          className="relative flex items-center px-3 py-2 text-sm rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer select-none outline-none data-[highlighted]:bg-slate-100 dark:data-[highlighted]:bg-slate-700"
                        >
                          <Select.ItemText>
                            <div className="flex items-center gap-2">
                              <Shield className="w-3 h-3" />
                              Read Only
                            </div>
                          </Select.ItemText>
                          <Select.ItemIndicator className="absolute right-2">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </Select.ItemIndicator>
                        </Select.Item>
                        <Select.Item 
                          value="WRITE" 
                          className="relative flex items-center px-3 py-2 text-sm rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer select-none outline-none data-[highlighted]:bg-slate-100 dark:data-[highlighted]:bg-slate-700"
                        >
                          <Select.ItemText>
                            <div className="flex items-center gap-2">
                              <ShieldCheck className="w-3 h-3" />
                              Read + Write
                            </div>
                          </Select.ItemText>
                          <Select.ItemIndicator className="absolute right-2">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </Select.ItemIndicator>
                        </Select.Item>
                        <Select.Item 
                          value="ADMIN" 
                          className="relative flex items-center px-3 py-2 text-sm rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer select-none outline-none data-[highlighted]:bg-slate-100 dark:data-[highlighted]:bg-slate-700"
                        >
                          <Select.ItemText>
                            <div className="flex items-center gap-2">
                              <Crown className="w-3 h-3" />
                              Administrator
                            </div>
                          </Select.ItemText>
                          <Select.ItemIndicator className="absolute right-2">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </Select.ItemIndicator>
                        </Select.Item>
                      </Select.Viewport>
                    </Select.Content>
                  </Select.Portal>
                </Select.Root>
              </div>

              <div className="flex justify-end gap-3">
                <Dialog.Close asChild>
                  <button className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300">
                    Cancel
                  </button>
                </Dialog.Close>
                <button
                  onClick={handleBulkRoleUpdate}
                  disabled={!bulkRole || bulkRole === 'all' || bulkUpdateMutation.isPending}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {bulkUpdateMutation.isPending ? 'Updating...' : 'Update Roles'}
                </button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Technician Details Dialog */}
      <Dialog.Root open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 w-full max-w-lg z-50 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <Dialog.Title className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                User Details
              </Dialog.Title>
              <Dialog.Close asChild>
                <button className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded">
                  <X className="w-4 h-4" />
                </button>
              </Dialog.Close>
            </div>
            
            {selectedTechnician && (
              <div className="space-y-4">
                {/* Profile Header */}
                <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-xl font-medium">
                      {selectedTechnician.displayName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">
                      {selectedTechnician.displayName}
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400">
                      {selectedTechnician.jobTitle || 'User'}
                    </p>
                    <div className={clsx(
                      "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium mt-1",
                      roleConfig[selectedTechnician.role as keyof typeof roleConfig]?.bg,
                      roleConfig[selectedTechnician.role as keyof typeof roleConfig]?.color
                    )}>
                      {roleConfig[selectedTechnician.role as keyof typeof roleConfig]?.icon && 
                        React.createElement(roleConfig[selectedTechnician.role as keyof typeof roleConfig].icon, { className: "w-3 h-3" })
                      }
                      {roleConfig[selectedTechnician.role as keyof typeof roleConfig]?.label}
                    </div>
                  </div>
                </div>

                {/* Contact Information */}
                <div className="space-y-3">
                  <h4 className="font-medium text-slate-900 dark:text-slate-100">Contact Information</h4>
                  
                  <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700">
                    <Mail className="w-4 h-4 text-slate-500" />
                    <div>
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Email</div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">{selectedTechnician.email}</div>
                    </div>
                  </div>

                  {selectedTechnician.department && (
                    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700">
                      <Building className="w-4 h-4 text-slate-500" />
                      <div>
                        <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Department</div>
                        <div className="text-sm text-slate-600 dark:text-slate-400">{selectedTechnician.department}</div>
                      </div>
                    </div>
                  )}

                  {selectedTechnician.officeLocation && (
                    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700">
                      <MapPin className="w-4 h-4 text-slate-500" />
                      <div>
                        <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Office Location</div>
                        <div className="text-sm text-slate-600 dark:text-slate-400">{selectedTechnician.officeLocation}</div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700">
                    <Calendar className="w-4 h-4 text-slate-500" />
                    <div>
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Last Login</div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">
                        {selectedTechnician.lastLoginAt 
                          ? new Date(selectedTechnician.lastLoginAt).toLocaleString()
                          : 'Never'
                        }
                      </div>
                    </div>
                  </div>
                </div>

                {/* Statistics */}
                <div className="space-y-3">
                  <h4 className="font-medium text-slate-900 dark:text-slate-100">Statistics</h4>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                      <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                        {selectedTechnician._count?.assignedAssets || 0}
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400">Assigned Assets</div>
                    </div>
                    <div className="text-center p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                      <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                        {selectedTechnician._count?.createdAssets || 0}
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400">Created Assets</div>
                    </div>
                    <div className="text-center p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                      <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                        {selectedTechnician._count?.activities || 0}
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400">Activities</div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    onClick={() => handleViewAssets(selectedTechnician)}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                  >
                    View Assets
                  </button>
                </div>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Activity Log Dialog */}
      <Dialog.Root open={activityDialogOpen} onOpenChange={setActivityDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 w-full max-w-4xl z-50 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <Dialog.Title className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Activity Log - {selectedTechnician?.displayName}
              </Dialog.Title>
              <Dialog.Close asChild>
                <button className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded">
                  <X className="w-4 h-4" />
                </button>
              </Dialog.Close>
            </div>
            
            {activitiesLoading ? (
              <div className="p-8 text-center">
                <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-purple-600 rounded-full animate-pulse mx-auto mb-4" />
                <p className="text-slate-600 dark:text-slate-400">Loading user activities...</p>
              </div>
            ) : activities && activities.length > 0 ? (
              <div className="space-y-3">
                {activities.map((activity: any) => (
                  <div key={activity.id} className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                    <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                      <Activity className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {activity.action}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {new Date(activity.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        {activity.entityType}: {activity.entityId}
                      </div>
                      {activity.changes && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono bg-slate-100 dark:bg-slate-800 p-2 rounded">
                          {activity.changes}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <Activity className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-600 dark:text-slate-400">No activities found for this user</p>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Update Role Dialog */}
      <Dialog.Root open={updateRoleDialogOpen} onOpenChange={setUpdateRoleDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 w-full max-w-md z-50">
            <Dialog.Title className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
              Update Role for {selectedTechnician?.displayName}
            </Dialog.Title>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  New Role
                </label>
                <Select.Root value={newRole} onValueChange={setNewRole}>
                  <Select.Trigger className="w-full flex items-center justify-between px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100">
                    <Select.Value placeholder="Select a role" />
                    <Select.Icon>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </Select.Icon>
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Content 
                      className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg overflow-hidden"
                      style={{ zIndex: 9999 }}
                      position="popper"
                      sideOffset={5}
                    >
                      <Select.Viewport className="p-1">
                        <Select.Item 
                          value="READ" 
                          className="relative flex items-center px-3 py-2 text-sm rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer select-none outline-none data-[highlighted]:bg-slate-100 dark:data-[highlighted]:bg-slate-700"
                        >
                          <Select.ItemText>
                            <div className="flex items-center gap-2">
                              <Shield className="w-3 h-3" />
                              Read Only
                            </div>
                          </Select.ItemText>
                          <Select.ItemIndicator className="absolute right-2">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </Select.ItemIndicator>
                        </Select.Item>
                        <Select.Item 
                          value="WRITE" 
                          className="relative flex items-center px-3 py-2 text-sm rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer select-none outline-none data-[highlighted]:bg-slate-100 dark:data-[highlighted]:bg-slate-700"
                        >
                          <Select.ItemText>
                            <div className="flex items-center gap-2">
                              <ShieldCheck className="w-3 h-3" />
                              Read + Write
                            </div>
                          </Select.ItemText>
                          <Select.ItemIndicator className="absolute right-2">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </Select.ItemIndicator>
                        </Select.Item>
                        <Select.Item 
                          value="ADMIN" 
                          className="relative flex items-center px-3 py-2 text-sm rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer select-none outline-none data-[highlighted]:bg-slate-100 dark:data-[highlighted]:bg-slate-700"
                        >
                          <Select.ItemText>
                            <div className="flex items-center gap-2">
                              <Crown className="w-3 h-3" />
                              Administrator
                            </div>
                          </Select.ItemText>
                          <Select.ItemIndicator className="absolute right-2">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </Select.ItemIndicator>
                        </Select.Item>
                      </Select.Viewport>
                    </Select.Content>
                  </Select.Portal>
                </Select.Root>
              </div>

              <div className="flex justify-end gap-3">
                <Dialog.Close asChild>
                  <button className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300">
                    Cancel
                  </button>
                </Dialog.Close>
                <button
                  onClick={handleConfirmRoleUpdate}
                  disabled={!newRole || newRole === selectedTechnician?.role}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updateRoleMutation.isPending ? 'Updating...' : 'Update Role'}
                </button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

             {/* Delete User Dialog */}
       <Dialog.Root open={deleteUserDialogOpen} onOpenChange={setDeleteUserDialogOpen}>
         <Dialog.Portal>
           <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
           <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 w-full max-w-md z-50">
             <Dialog.Title className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
               Delete User - {selectedTechnician?.displayName}
             </Dialog.Title>
             
             <div className="space-y-4">
               {deleteError ? (
                 <div className="space-y-4">
                   <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                     <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                     <div>
                       <h4 className="font-medium text-red-800 dark:text-red-200 mb-1">
                         Cannot Delete User
                       </h4>
                       <p className="text-sm text-red-700 dark:text-red-300">
                         {deleteError}
                       </p>
                     </div>
                   </div>
                   
                   <div className="space-y-3">
                     <p className="text-sm text-slate-600 dark:text-slate-400">
                       To delete this user, you need to first reassign their assets to another technician or unassign them.
                     </p>
                     
                     <div className="flex flex-col gap-2">
                       <button
                         onClick={() => {
                           setDeleteUserDialogOpen(false);
                           if (selectedTechnician) {
                             handleViewAssets(selectedTechnician);
                           }
                         }}
                         className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                       >
                         <Package className="w-4 h-4" />
                         View & Reassign Assets
                       </button>
                     </div>
                   </div>
                 </div>
               ) : (
                 <div className="space-y-4">
                   <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                     <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                     <div>
                       <h4 className="font-medium text-amber-800 dark:text-amber-200 mb-1">
                         Confirm Deletion
                       </h4>
                       <p className="text-sm text-amber-700 dark:text-amber-300">
                         Are you sure you want to delete this user? This action cannot be undone.
                       </p>
                     </div>
                   </div>
                   
                   <div className="bg-slate-50 dark:bg-slate-700 p-3 rounded-lg">
                     <div className="text-sm text-slate-600 dark:text-slate-400">
                       <strong>User:</strong> {selectedTechnician?.displayName}<br />
                       <strong>Email:</strong> {selectedTechnician?.email}<br />
                       <strong>Role:</strong> {selectedTechnician?.role}<br />
                       <strong>Assigned Assets:</strong> {selectedTechnician?._count?.assignedAssets || 0}
                     </div>
                   </div>
                 </div>
               )}
 
               <div className="flex justify-end gap-3">
                 <Dialog.Close asChild>
                   <button className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300">
                     Cancel
                   </button>
                 </Dialog.Close>
                 {!deleteError && (
                   <button
                     onClick={handleConfirmDeleteUser}
                     disabled={deleteUserMutation.isPending}
                     className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                   >
                     {deleteUserMutation.isPending ? (
                       <>
                         <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                         Deleting...
                       </>
                     ) : (
                       <>
                         <Trash2 className="w-4 h-4" />
                         Delete User
                       </>
                     )}
                   </button>
                 )}
               </div>
             </div>
           </Dialog.Content>
         </Dialog.Portal>
       </Dialog.Root>
    </div>
  );
};

export default Technicians; 