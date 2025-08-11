export enum AssetType {
  LAPTOP = 'LAPTOP',
  DESKTOP = 'DESKTOP',
  TABLET = 'TABLET',
  PHONE = 'PHONE',
  SERVER = 'SERVER',
  OTHER = 'OTHER'
}

export enum AssetStatus {
  AVAILABLE = 'AVAILABLE',
  ASSIGNED = 'ASSIGNED',
  SPARE = 'SPARE',
  MAINTENANCE = 'MAINTENANCE',
  RETIRED = 'RETIRED',
  DISPOSED = 'DISPOSED'
}

export enum AssetCondition {
  NEW = 'NEW',
  GOOD = 'GOOD',
  FAIR = 'FAIR',
  POOR = 'POOR'
}

export enum AssetSource {
  MANUAL = 'MANUAL',
  NINJAONE = 'NINJAONE', 
  INTUNE = 'INTUNE',
  EXCEL = 'EXCEL',
  BULK_UPLOAD = 'BULK_UPLOAD',
  API = 'API',
  TELUS = 'TELUS',
  ROGERS = 'ROGERS',
  INVOICE = 'INVOICE'
}

export interface Asset {
  id: string;
  assetTag: string;
  assetType: AssetType;
  status: AssetStatus;
  condition: AssetCondition;
  source: AssetSource;
  make: string;
  model: string;
  serialNumber: string;
  processor?: string;
  ram?: string;
  storage?: string;
  operatingSystem?: string;
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