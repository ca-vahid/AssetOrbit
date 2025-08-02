// User Roles
export const USER_ROLES = {
  READ: 'READ',
  WRITE: 'WRITE',
  ADMIN: 'ADMIN',
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

// Asset Types
export const ASSET_TYPES = {
  LAPTOP: 'LAPTOP',
  DESKTOP: 'DESKTOP',
  TABLET: 'TABLET',
  PHONE: 'PHONE',
  SERVER: 'SERVER',
  OTHER: 'OTHER',
} as const;

export type AssetType = typeof ASSET_TYPES[keyof typeof ASSET_TYPES];

// Asset Statuses
export const ASSET_STATUSES = {
  AVAILABLE: 'AVAILABLE',
  ASSIGNED: 'ASSIGNED',
  SPARE: 'SPARE',
  MAINTENANCE: 'MAINTENANCE',
  RETIRED: 'RETIRED',
  DISPOSED: 'DISPOSED',
} as const;

export type AssetStatus = typeof ASSET_STATUSES[keyof typeof ASSET_STATUSES];

// Asset Conditions
export const ASSET_CONDITIONS = {
  NEW: 'NEW',
  GOOD: 'GOOD',
  FAIR: 'FAIR',
  POOR: 'POOR',
} as const;

export type AssetCondition = typeof ASSET_CONDITIONS[keyof typeof ASSET_CONDITIONS];

// Custom Field Types
export const CUSTOM_FIELD_TYPES = {
  STRING: 'STRING',
  NUMBER: 'NUMBER',
  SINGLE_SELECT: 'SINGLE_SELECT',
  MULTI_SELECT: 'MULTI_SELECT',
  DATE: 'DATE',
  BOOLEAN: 'BOOLEAN',
} as const;

export type CustomFieldType = typeof CUSTOM_FIELD_TYPES[keyof typeof CUSTOM_FIELD_TYPES];

export const isValidCustomFieldType = (type: string): type is CustomFieldType => {
  return Object.values(CUSTOM_FIELD_TYPES).includes(type as CustomFieldType);
};

// Activity Log Actions
export const ACTIVITY_ACTIONS = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  ASSIGN: 'ASSIGN',
  UNASSIGN: 'UNASSIGN',
  STATUS_CHANGE: 'STATUS_CHANGE',
  BULK_UPDATE: 'BULK_UPDATE',
  EXPORT: 'EXPORT',
  IMPORT: 'IMPORT',
} as const;

export type ActivityAction = typeof ACTIVITY_ACTIONS[keyof typeof ACTIVITY_ACTIONS];

// Entity Types for Activity Log
export const ENTITY_TYPES = {
  ASSET: 'ASSET',
  USER: 'USER',
  DEPARTMENT: 'DEPARTMENT',
  LOCATION: 'LOCATION',
  VENDOR: 'VENDOR',
  CUSTOM_FIELD: 'CUSTOM_FIELD',
} as const;

export type EntityType = typeof ENTITY_TYPES[keyof typeof ENTITY_TYPES];

// Validation functions
export const isValidUserRole = (role: string): role is UserRole => {
  return Object.values(USER_ROLES).includes(role as UserRole);
};

export const isValidAssetType = (type: string): type is AssetType => {
  return Object.values(ASSET_TYPES).includes(type as AssetType);
};

export const isValidAssetStatus = (status: string): status is AssetStatus => {
  return Object.values(ASSET_STATUSES).includes(status as AssetStatus);
};

export const isValidAssetCondition = (condition: string): condition is AssetCondition => {
  return Object.values(ASSET_CONDITIONS).includes(condition as AssetCondition);
}; 