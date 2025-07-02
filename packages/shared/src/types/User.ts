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
  role: 'READ' | 'WRITE' | 'ADMIN';
  isActive: boolean;
  lastLoginAt?: string;
  createdAt?: string;
  updatedAt?: string;
  _count?: {
    assignedAssets: number;
    createdAssets?: number;
    activities?: number;
  };
}

export interface StaffMember {
  id: string;
  displayName: string;
  mail?: string;
  jobTitle?: string;
  department?: string;
  officeLocation?: string;
  mobilePhone?: string;
  businessPhones?: string[];
}

export interface StaffWithAssets {
  azureAdId: string;
  assetCount: number;
} 