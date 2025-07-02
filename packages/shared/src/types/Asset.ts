export interface Asset {
  id: string;
  assetType: 'laptop' | 'desktop' | 'tablet' | 'other';
  make: string;
  model: string;
  serialNumber: string;
  assetTag?: string;
  processor?: string;
  ram?: string;
  storage?: string;
  operatingSystem?: string;
  status: 'available' | 'assigned' | 'spare' | 'retired';
  condition: 'new' | 'good' | 'fair' | 'poor';
  assignedTo?: string;
  department?: string; // legacy
  workloadCategories?: string[]; // IDs of workload categories
  location?: string;
  purchaseDate?: string; // ISO string
  purchasePrice?: number;
  vendor?: string;
  warrantyExpiration?: string; // ISO string
  notes?: string;
  tickets?: string[];
  createdAt?: string;
  updatedAt?: string;
} 