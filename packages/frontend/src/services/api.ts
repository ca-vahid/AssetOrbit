import axios from 'axios';
import { PublicClientApplication } from '@azure/msal-browser';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

// Create axios instance
export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth interceptor
export const setupAuthInterceptor = (msalInstance: PublicClientApplication) => {
  api.interceptors.request.use(
    async (config) => {
      const accounts = msalInstance.getAllAccounts();
      if (accounts.length > 0) {
        try {
          const apiScope = `api://${import.meta.env.VITE_AZURE_AD_CLIENT_ID}/access_as_user`;
          const result = await msalInstance.acquireTokenSilent({
            scopes: [apiScope],
            account: accounts[0],
          });
          config.headers.Authorization = `Bearer ${result.accessToken}`;
        } catch (error) {
          console.error('Failed to acquire token:', error);
        }
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Add response interceptor for error handling
  api.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        // Token expired or invalid, try to refresh
        msalInstance.acquireTokenRedirect({
          scopes: [`api://${import.meta.env.VITE_AZURE_AD_CLIENT_ID}/access_as_user`],
        });
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
  department?: {
    id: string;
    name: string;
  };
  location?: {
    id: string;
    name: string;
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
  name: string;
  building?: string;
  floor?: string;
  room?: string;
  city?: string;
  state?: string;
  country?: string;
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

// API endpoints
export const assetsApi = {
  getAll: (params?: any) => api.get<PaginatedResponse<Asset>>('/assets', { params }).then(res => res.data),
  getById: (id: string) => api.get<Asset>(`/assets/${id}`).then(res => res.data),
  create: (data: any) => api.post<Asset>('/assets', data).then(res => res.data),
  update: (id: string, data: any) => api.put<Asset>(`/assets/${id}`, data).then(res => res.data),
  patch: (id: string, data: any) => api.patch<Asset>(`/assets/${id}`, data).then(res => res.data),
  delete: (id: string) => api.delete(`/assets/${id}`).then(res => res.data),
  bulkUpdate: (assetIds: string[], updates: any) => 
    api.post('/assets/bulk', { operation: 'update', assetIds, updates }).then(res => res.data),
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
};

export const departmentsApi = {
  getAll: (params?: any) => api.get<Department[]>('/departments', { params }).then(res => res.data),
  create: (data: any) => api.post<Department>('/departments', data).then(res => res.data),
  update: (id: string, data: any) => api.put<Department>(`/departments/${id}`, data).then(res => res.data),
};

export const locationsApi = {
  getAll: (params?: any) => api.get<Location[]>('/locations', { params }).then(res => res.data),
  create: (data: any) => api.post<Location>('/locations', data).then(res => res.data),
  update: (id: string, data: any) => api.put<Location>(`/locations/${id}`, data).then(res => res.data),
};

export const vendorsApi = {
  getAll: (params?: any) => api.get<Vendor[]>('/vendors', { params }).then(res => res.data),
  getById: (id: string) => api.get<Vendor>(`/vendors/${id}`).then(res => res.data),
  create: (data: any) => api.post<Vendor>('/vendors', data).then(res => res.data),
  update: (id: string, data: any) => api.put<Vendor>(`/vendors/${id}`, data).then(res => res.data),
}; 