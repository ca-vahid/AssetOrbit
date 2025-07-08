import axios from 'axios';
import { PublicClientApplication } from '@azure/msal-browser';
import { acquireTokenSafely, getIsAuthenticating } from '../auth/msal';
import type { CustomField, Activity } from '@ats/shared';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

// Create axios instance
export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Track requests that are being retried to prevent infinite loops
const retryingRequests = new Set<string>();

// Add auth interceptor
export const setupAuthInterceptor = (msalInstance: PublicClientApplication) => {
  // Request interceptor to add auth token
  api.interceptors.request.use(
    async (config) => {
      const accounts = msalInstance.getAllAccounts();
      if (accounts.length > 0 && !getIsAuthenticating()) {
        try {
          const apiScope = `api://${import.meta.env.VITE_AZURE_AD_CLIENT_ID}/access_as_user`;
          const result = await acquireTokenSafely([apiScope]);
          config.headers.Authorization = `Bearer ${result.accessToken}`;
        } catch (error) {
          console.warn('Failed to acquire token for request:', error);
          // Don't fail the request, let the backend handle missing auth
        }
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Response interceptor for error handling
  api.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;
      
      // Check if it's a 401 error and we haven't already retried this request
      if (
        error.response?.status === 401 && 
        !originalRequest._retry && 
        !getIsAuthenticating()
      ) {
        const requestKey = `${originalRequest.method}-${originalRequest.url}`;
        
        // Prevent multiple retries of the same request
        if (retryingRequests.has(requestKey)) {
          return Promise.reject(error);
        }
        
        retryingRequests.add(requestKey);
        originalRequest._retry = true;
        
        try {
          const accounts = msalInstance.getAllAccounts();
          if (accounts.length > 0) {
            const apiScope = `api://${import.meta.env.VITE_AZURE_AD_CLIENT_ID}/access_as_user`;
            const result = await acquireTokenSafely([apiScope]);
            
            // Update the authorization header and retry the request
            originalRequest.headers.Authorization = `Bearer ${result.accessToken}`;
            retryingRequests.delete(requestKey);
            return api(originalRequest);
          }
                 } catch (tokenError: any) {
           console.error('Failed to refresh token:', tokenError);
           retryingRequests.delete(requestKey);
           
           // Only redirect if it's an interaction required error
           if (tokenError.name === 'InteractionRequiredAuthError') {
             // Clear any stale state and redirect to login
             window.location.href = '/'; // Let the app handle re-authentication
           }
          
          return Promise.reject(error);
        }
        
        retryingRequests.delete(requestKey);
      }
      
      return Promise.reject(error);
    }
  );
};

// API types
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface Asset {
  id: string;
  assetTag: string;
  assetType: string;
  status: string;
  condition: string;
  source?: string;
  make: string;
  model: string;
  serialNumber?: string;
  specifications?: any;
  assignedTo?: {
    id: string;
    displayName: string;
    email: string;
    department?: string;
  };
  assignedToAadId?: string;
  assignedToStaff?: {
    id: string;
    displayName: string;
    mail?: string;
    jobTitle?: string;
    department?: string;
    officeLocation?: string;
  };
  department?: {
    id: string;
    name: string;
  };
  location?: {
    id: string;
    city: string;
    province: string;
    country: string;
  };
  vendor?: {
    id: string;
    name: string;
  };
  purchaseDate?: string;
  purchasePrice?: string;
  warrantyEndDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    tickets: number;
    attachments: number;
  };
  customFields?: Record<string, string>;
  workloadCategories?: WorkloadCategory[];
}

export interface User {
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
  _count?: {
    assignedAssets: number;
  };
}

export interface Department {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  _count?: {
    assets: number;
  };
}

export interface Location {
  id: string;
  city: string;
  province: string;
  country: string;
  source: 'AZURE_AD' | 'MANUAL';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    assets: number;
  };
}

export interface Vendor {
  id: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  website?: string;
  _count?: {
    assets: number;
  };
}

export interface StaffMember {
  id: string;
  displayName: string;
  mail?: string;
  jobTitle?: string;
  department?: string;
  officeLocation?: string;
}

export interface WorkloadCategory {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  _count?: {
    assetLinks: number;
    rules?: number;
  };
}

export interface WorkloadCategoryRule {
  id: string;
  categoryId: string;
  category: {
    id: string;
    name: string;
    description?: string;
  };
  priority: number;
  sourceField: string;
  operator: string;
  value: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AssetFieldMeta {
  key: string;
  label: string;
  required: boolean;
}

// API endpoints
export const assetsApi = {
  getAll: (params?: any) => api.get<PaginatedResponse<Asset>>('/assets', { params }).then(res => res.data),
  getById: (id: string) => api.get<Asset>(`/assets/${id}`).then(res => res.data),
  getStats: () => api.get<{ total: number; assetTypes: Record<string, number>; statuses: Record<string, number> }>('/assets/stats').then(res => res.data),
  create: (data: any) => api.post<Asset>('/assets', data).then(res => res.data),
  update: (id: string, data: any) => api.put<Asset>(`/assets/${id}`, data).then(res => res.data),
  patch: (id: string, data: any) => api.patch<Asset>(`/assets/${id}`, data).then(res => res.data),
  delete: (id: string) => api.delete(`/assets/${id}`).then(res => res.data),
  bulkUpdate: (assetIds: string[], updates: any) => 
    api.post('/assets/bulk', { operation: 'update', assetIds, updates }).then(res => res.data),
  // NEW: Bulk delete assets in a single request
  bulkDelete: (assetIds: string[]) =>
    api.post('/assets/bulk', { operation: 'delete', assetIds }).then(res => res.data),
  export: (format: 'csv' | 'excel', params?: any) => 
    api.get('/assets/export', {
      params: { format, ...params },
      responseType: 'blob',
    }).then(res => res.data),
};

export const usersApi = {
  getAll: (params?: any) => api.get<User[]>('/users', { params }).then(res => res.data),
  getMe: () => api.get<User>('/users/me').then(res => res.data),
  updateRole: (id: string, role: string) => api.put<User>(`/users/${id}/role`, { role }).then(res => res.data),
  getTechnicians: (params?: any) => api.get<User[]>('/users/technicians', { params }).then(res => res.data),
  getStaffWithAssets: (params?: any) => api.get<{ data: { azureAdId: string; assetCount: number }[]; pagination: any }>('/users/staff-with-assets', { params }).then(res => res.data),
  bulkUpdateRoles: (userIds: string[], role: string) => api.put('/users/bulk-role-update', { userIds, role }).then(res => res.data),
  deleteUser: (id: string) => api.delete(`/users/${id}`).then(res => res.data),
};

export const departmentsApi = {
  getAll: (params?: any) => api.get<Department[]>('/departments', { params }).then(res => res.data),
  create: (data: any) => api.post<Department>('/departments', data).then(res => res.data),
  update: (id: string, data: any) => api.put<Department>(`/departments/${id}`, data).then(res => res.data),
};

export const locationsApi = {
  getLocations: (params?: any) => api.get<Location[]>('/locations', { params }).then(res => res.data),
  getAllLocations: (params?: any) => api.get<Location[]>('/locations/all', { params }).then(res => res.data),
  getCountries: () => api.get<string[]>('/locations/countries').then(res => res.data),
  getProvinces: (country?: string) => api.get<string[]>('/locations/provinces', { params: { country } }).then(res => res.data),
  createLocation: (data: any) => api.post<Location>('/locations', data).then(res => res.data),
  updateLocation: (id: string, data: any) => api.put<Location>(`/locations/${id}`, data).then(res => res.data),
  toggleLocation: (id: string) => api.patch<Location>(`/locations/${id}/toggle`).then(res => res.data),
  syncFromAzureAD: () => api.post('/locations/sync').then(res => res.data),
};

export const vendorsApi = {
  getAll: (params?: any) => api.get<Vendor[]>('/vendors', { params }).then(res => res.data),
  getById: (id: string) => api.get<Vendor>(`/vendors/${id}`).then(res => res.data),
  create: (data: any) => api.post<Vendor>('/vendors', data).then(res => res.data),
  update: (id: string, data: any) => api.put<Vendor>(`/vendors/${id}`, data).then(res => res.data),
};

export const customFieldsApi = {
  getAll: () => api.get<CustomField[]>('/custom-fields').then(res => res.data),
  create: (data: any) => api.post<CustomField>('/custom-fields', data).then(res => res.data),
  update: (id: string, data: any) => api.put<CustomField>(`/custom-fields/${id}`, data).then(res => res.data),
  delete: (id: string) => api.delete(`/custom-fields/${id}`).then(res => res.data),
};

export const activitiesApi = {
  getByEntity: (entityType: string, entityId: string) => 
    api.get<Activity[]>(`/activities/${entityType}/${entityId}`).then(res => res.data),
};

export const staffApi = {
  search: (query: string, limit?: number) => api.get('/staff/search', { params: { q: query, limit } }).then(res => res.data),
  getById: (aadId: string) => api.get(`/staff/${aadId}`).then(res => res.data),
  getFromGroup: (groupId: string, limit?: number) => api.get(`/staff/group/${groupId}`, { params: { limit } }).then(res => res.data),
  clearCache: () => api.post('/staff/clear-cache').then(res => res.data),
  getProfilePhoto: (aadId: string) => api.get(`/staff/${aadId}/photo`, { responseType: 'blob' }).then(res => res.data),
  getProfilePhotoMetadata: (aadId: string) => api.get(`/staff/${aadId}/photo/metadata`).then(res => res.data),
  clearPhotoCache: () => api.post('/staff/clear-photo-cache').then(res => res.data),
};

export const categoriesApi = {
  getAll: (params?: any) => api.get<WorkloadCategory[]>('/workload-categories', { params }).then(res => res.data),
  create: (data: any) => api.post<WorkloadCategory>('/workload-categories', data).then(res => res.data),
  update: (id: string, data: any) => api.put<WorkloadCategory>(`/workload-categories/${id}`, data).then(res => res.data),
  delete: (id: string) => api.delete(`/workload-categories/${id}`).then(res => res.data),
}; 

export const workloadRulesApi = {
  getAll: (params?: any) => api.get<WorkloadCategoryRule[]>('/workload-categories/rules', { params }).then(res => res.data),
  create: (data: any) => api.post<WorkloadCategoryRule>('/workload-categories/rules', data).then(res => res.data),
  update: (id: string, data: any) => api.put<WorkloadCategoryRule>(`/workload-categories/rules/${id}`, data).then(res => res.data),
  delete: (id: string) => api.delete(`/workload-categories/rules/${id}`).then(res => res.data),
  test: (data: { sourceField: string; operator: string; value: string; testData?: any }) => 
    api.post<{ result: boolean; error?: string; explanation: string }>('/workload-categories/rules/test', data).then(res => res.data),
  getValidFields: () => 
    api.get<{ fields: string[]; operators: string[] }>('/workload-categories/rules/fields').then(res => res.data),
};

export const assetFieldsApi = {
  getAll: () => api.get<AssetFieldMeta[]>('/assets/fields').then(res => res.data),
}; 