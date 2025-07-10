# Asset Import Module v2 - Developer Guide

## Overview

The Asset Import Module is a modular, extensible system for importing assets from various sources into the inventory system. It features a clean architecture with separated concerns, making it easy to add new import sources without modifying core logic.

**Latest Version: v0.10.1** - Fixed storage capacity extraction for phone imports.

## Architecture

### Frontend Architecture

```
packages/frontend/src/
├── pages/
│   └── BulkUpload.tsx              # Main wizard orchestrator (549 lines)
├── components/import-wizard/
│   ├── ImportWizard.tsx            # Generic wizard shell (future use)
│   └── steps/
│       ├── StepSelectCategory.tsx  # Step 1: Asset category selection
│       ├── StepSelectSource.tsx    # Step 2: Import source selection
│       ├── StepMapping.tsx         # Step 3: Column mapping
│       ├── StepConfirm.tsx         # Step 4: Review & confirm
│       └── StepProgress.tsx        # Step 5: Progress & results
├── hooks/
│   ├── useImportAssets.ts          # Import API mutation & SSE progress
│   ├── useFileParser.ts            # File parsing (CSV, XLSX)
│   ├── useImportPreview.ts         # Preview & filtering logic
│   ├── useImportExecutor.ts        # Import execution wrapper
│   └── useResolveImport.ts         # User/location resolution
└── utils/
    ├── importSources.ts            # Source registry & configurations
    ├── importFilters.ts            # Source-specific filters
    └── ninjaMapping.ts             # Column mapping utilities
```

### Backend Architecture

```
packages/backend/src/
├── routes/
│   └── import.ts                   # Generic import endpoint
│       ├── POST /api/import/resolve    # Resolve users/locations/conflicts
│       ├── POST /api/import/assets     # Process asset import
│       └── GET  /api/import/progress/:id # SSE progress updates
├── services/
│   └── graphService.ts             # Enhanced Azure AD integration
└── utils/
    └── locationMatcher.ts          # Multi-strategy location matching
```

## Core Concepts

### 1. Source Registry

All import sources are defined in `importSources.ts`:

```typescript
interface ImportSourceConfig {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType;
  category: 'endpoints' | 'servers' | 'phones';
  acceptedFormats: string[];
  enabled: boolean;
  getMappings: () => ColumnMapping[];
  features?: {
    userResolution?: boolean;
    locationResolution?: boolean;
    conflictDetection?: boolean;
  };
}
```

### 2. Column Mapping System

```typescript
interface ColumnMapping {
  ninjaColumn: string;      // Column name in source file
  targetField: string;       // Database field or 'specifications.x'
  targetType: 'direct' | 'specifications' | 'custom' | 'ignore';
  description: string;
  required?: boolean;
  processor?: (value: string) => any;
}
```

### 3. Import Flow

1. **Category Selection** → 2. **Source Selection** → 3. **File Upload & Parsing** → 4. **Column Mapping** → 5. **Resolution & Preview** → 6. **Import & Progress**

## v0.10.1 Major Fix: Storage Capacity Extraction

### The Problem
Phone imports were not saving storage capacity to the database, even though the device names contained storage information like "SAMSUNG GALAXY S23 128GB".

### Root Cause
The `parseDeviceName` function in `packages/backend/src/routes/import.ts` had a bug where device-specific storage extraction was overriding the top-level storage extraction:

```typescript
// ❌ BUGGY CODE (before fix)
function parseDeviceName(deviceName: string) {
  // Top-level extraction
  const storageMatch = normalized.match(/(\d+)(?:GB|TB)/);
  const storage = storageMatch ? `${storageMatch[1]}GB` : undefined;
  
  // Samsung Galaxy patterns
  if (normalized.includes('SAMSUNG') && normalized.includes('GALAXY')) {
    // ... model extraction ...
    
    // ❌ BUG: This was overriding the top-level extraction
    const storageMatch = normalized.match(/(\d+(?:GB|TB))/);
    const storage = storageMatch ? storageMatch[1] : undefined;
    
    return { make, model, storage }; // ← Wrong storage value
  }
}
```

### The Fix
**Remove duplicate storage extraction** in device-specific sections and use the top-level extraction:

```typescript
// ✅ FIXED CODE (after fix)
function parseDeviceName(deviceName: string) {
  // Top-level extraction (works correctly)
  const storageMatch = normalized.match(/(\d+)(?:GB|TB)/);
  const storage = storageMatch ? `${storageMatch[1]}GB` : undefined;
  
  // Samsung Galaxy patterns
  if (normalized.includes('SAMSUNG') && normalized.includes('GALAXY')) {
    // ... model extraction ...
    
    // ✅ FIX: Use storage extracted at the top level
    return { make, model, storage }; // ← Correct storage value
  }
}
```

### Files Changed
- `packages/backend/src/routes/import.ts` - Fixed `parseDeviceName` function for Samsung, iPhone, and Pixel patterns

### Result
✅ Storage capacity is now correctly extracted and saved to `specifications.storage`  
✅ Phone assets display storage capacity in the UI  
✅ Manual updates through the UI continue to work as before  

## Enhanced Features (v0.9)

### Enhanced User Resolution
- **Username Resolution**: Corporate email format, SAM account names, fuzzy matching
- **Display Name Resolution**: Exact and fuzzy display name matching  
- **Corporate Account Prioritization**: @bgcengineering.ca prioritized over other domains
- **Trailing Space Handling**: Automatic trimming and normalization

### BGC Asset Tag Normalization
```typescript
// Automatic BGC prefix handling
processor: (value: string) => {
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    return `BGC${trimmed.padStart(6, '0')}`;
  }
  return trimmed.toUpperCase();
}
```

### Location Matching
```typescript
const locationAbbreviations: Record<string, string> = {
  'CAL': 'Calgary',
  'VAN': 'Vancouver', 
  'TOR': 'Toronto',
  'EDM': 'Edmonton',
  'MTL': 'Montreal',
  'OTT': 'Ottawa'
};
```

### Phone Asset Processing
- **Asset Tag Generation**: `PH-First Last` format for assigned users
- **Device Name Parsing**: Automatic make/model/storage extraction
- **Carrier Information**: Auto-set to provider (e.g., "Telus")
- **IMEI Handling**: Fallback to IMEI if serial number missing

## Adding a New Import Source

### Step 1: Define Column Mappings

```typescript
export const getNewProviderMappings = (): ColumnMapping[] => {
  return [
    {
      ninjaColumn: 'Device Model',
      targetField: 'model',
      targetType: 'direct',
      description: 'Device model',
      required: true,
    },
    {
      ninjaColumn: 'Phone Number',
      targetField: 'phoneNumber',
      targetType: 'specifications',
      description: 'Phone number',
      processor: (value: string) => value.replace(/[^\d]/g, ''),
    },
    // Set asset type for phone imports
    {
      ninjaColumn: 'Account Number', // Use any column
      targetField: 'assetType',
      targetType: 'direct',
      required: true,
      processor: () => 'PHONE', // Always return PHONE
    },
  ];
};
```

### Step 2: Register the Source

```typescript
{
  id: 'new-provider',
  title: 'New Provider',
  description: 'Import from new cellular provider',
  icon: Building2,
  category: 'phones',
  acceptedFormats: ['CSV', 'XLSX'],
  enabled: true,
  getMappings: getNewProviderMappings,
  features: {
    userResolution: true,
    locationResolution: false,
    conflictDetection: true
  }
}
```

### Step 3: Test
The import should work automatically with phone-specific processing!

## Import Processing Pipeline

### Backend Phone Processing (Automatic)
When `assetType === 'PHONE'`, the backend automatically:

1. **Extracts device info** using `parseDeviceName()`
2. **Generates asset tags** in `PH-First Last` format  
3. **Sets carrier information** (defaults to provider name)
4. **Handles IMEI/serial number** fallback
5. **Saves storage to specifications** ✅ (Fixed in v0.10.1)

### Key Processing Order
```typescript
// 1. Column mappings applied first
assetData.model = "SAMSUNG GALAXY S23 128GB BLACK";

// 2. Phone processing extracts details
const parsed = parseDeviceName(assetData.model);
// → { make: 'Samsung', model: 'Galaxy S23', storage: '128GB' }

// 3. Storage saved to specifications
assetData.specifications.storage = parsed.storage; // ✅ "128GB"
```

## Troubleshooting

### Storage Not Appearing
**Problem**: Storage capacity not saved during import  
**Solution**: ✅ Fixed in v0.10.1 - `parseDeviceName` function bug resolved

### User Resolution Issues
**Problem**: Low user resolution rates  
**Solution**: Check if data contains display names vs usernames, verify Azure AD permissions

### Asset Tag Issues  
**Problem**: Missing BGC prefixes  
**Solution**: Add processor to handle numeric-only tags, implement backend safety net

## Configuration

### Backend Environment
```env
BATCH_SIZE=25
AZURE_AD_TENANT_ID=xxx
AZURE_AD_CLIENT_ID=xxx
AZURE_AD_CLIENT_SECRET=xxx
USER_RESOLUTION_TIMEOUT=30000
LOCATION_FUZZY_THRESHOLD=0.7
```

## Migration Notes

### From v0.10 to v0.10.1
**Major Fix**: Storage capacity extraction for phone imports
**Breaking Changes**: None
**Migration Steps**: No action required - automatic fix

## Quick Reference

### v0.10.1 Checklist for New Phone Sources
- [ ] Map device name column to `model` field
- [ ] Map any column to `assetType` with `() => 'PHONE'` processor  
- [ ] Map IMEI to `specifications.imei`
- [ ] Test storage extraction from device names
- [ ] Verify asset tags use `PH-First Last` format

### Testing Storage Extraction
```bash
# Test device name: "SAMSUNG GALAXY S23 128GB BLACK"
# Expected result: { make: 'Samsung', model: 'Galaxy S23', storage: '128GB' }

# Test device name: "IPHONE 14 PRO 256GB SPACE BLACK" 
# Expected result: { make: 'Apple', model: 'iPhone 14 Pro', storage: '256GB' }
```

The v0.10.1 architecture provides robust phone import capabilities with **fixed storage capacity extraction**. The simple bug fix in the `parseDeviceName` function resolved the storage issue completely. 