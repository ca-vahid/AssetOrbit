# Asset Import Module v2 - Developer Guide

## Overview

The Asset Import Module is a modular, extensible system for importing assets from various sources into the inventory system. It features a clean architecture with separated concerns, making it easy to add new import sources without modifying core logic.

**Latest Version: v0.9** - Major improvements to user resolution, asset tag handling, and location matching.

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
  category: 'endpoints' | 'servers';
  acceptedFormats: string[];
  enabled: boolean;
  getMappings: () => ColumnMapping[];
  features?: {
    userResolution?: boolean;
    locationResolution?: boolean;
    conflictDetection?: boolean;
  };
  customProcessing?: {
    preFilter?: (data: any[]) => any[];
    transformRow?: (row: any) => any;
    customValidation?: (data: any[]) => ValidationResult;
  };
}
```

### 2. Column Mapping System

```typescript
interface ColumnMapping {
  sourceColumn: string;      // Column name in source file
  targetField: string;       // Database field or 'specifications.x'
  targetType: 'direct' | 'specifications' | 'custom';
  description: string;
  required?: boolean;
  processor?: (value: string) => any;
}
```

### 3. Import Flow

1. **Category Selection** → 2. **Source Selection** → 3. **File Upload & Parsing** → 4. **Column Mapping** → 5. **Resolution & Preview** → 6. **Import & Progress**

## v0.9 Major Improvements

### Enhanced User Resolution

The user resolution system now supports both username and display name lookups:

#### Username Resolution (existing)
- Corporate email format (firstname.lastname@domain.com)
- SAM account names (flastname, firstname.lastname)
- Fuzzy username matching with domain stripping

#### Display Name Resolution (NEW)
- Exact display name matching ("John Smith")
- Fuzzy display name matching with similarity scoring
- Parallel resolution using both methods for maximum coverage

#### Corporate Account Prioritization (NEW)
All resolution methods now prioritize corporate accounts:
- @bgcengineering.ca (primary)
- @cambioearth.com (secondary)
- Other domains deprioritized

#### Trailing Space Handling (FIXED)
- System now handles trailing spaces in user data
- Results stored with both original and trimmed keys
- Prevents lookup failures due to whitespace inconsistencies

### BGC Asset Tag Normalization

Enhanced asset tag processing for BGC imports:

```typescript
// Frontend processor
processor: (value: string) => {
  if (!value) return '';
  const trimmed = value.trim();
  // Handle numeric-only tags
  if (/^\d+$/.test(trimmed)) {
    return `BGC${trimmed.padStart(6, '0')}`;
  }
  // Handle tags missing BGC prefix
  if (!/^BGC/i.test(trimmed) && /^\d/.test(trimmed)) {
    return `BGC${trimmed}`;
  }
  return trimmed.toUpperCase();
}

// Backend safety net
if (asset.assetTag && /^\d+$/.test(asset.assetTag)) {
  asset.assetTag = `BGC${asset.assetTag.padStart(6, '0')}`;
}
```

### Improved Location Matching

Multi-strategy location matching with abbreviation support:

```typescript
// Location abbreviations
const locationAbbreviations: Record<string, string> = {
  'CAL': 'Calgary',
  'VAN': 'Vancouver', 
  'TOR': 'Toronto',
  'EDM': 'Edmonton',
  'MTL': 'Montreal',
  'OTT': 'Ottawa'
};

// Matching strategies
1. Exact match
2. Case-insensitive match
3. Abbreviation expansion
4. Fuzzy matching with similarity threshold
```

### Fixed Asset Status Logic

Asset status determination now occurs AFTER user resolution:

```typescript
// OLD (incorrect)
if (bgcAssetTag && assignedUser) {
  status = 'ASSIGNED';
} else if (bgcAssetTag) {
  status = 'AVAILABLE';
}

// NEW (correct)
// Status determined after user resolution
if (resolvedUser || (assignedUser && !userResolutionFailed)) {
  status = 'ASSIGNED';
} else {
  status = 'AVAILABLE';
}
```

### Enhanced GraphService Methods

New methods added to `graphService.ts`:

```typescript
// Find users by display name (exact match)
async findUsersByDisplayName(displayName: string): Promise<User[]>

// Find users by display name (fuzzy match)  
async findUsersByDisplayNameFuzzy(displayName: string): Promise<User[]>

// Corporate account prioritization
private prioritizeCorporateAccounts(users: User[]): User[]
```

## Adding a New Import Source

### Step 1: Define Column Mappings

Create a mapping function in `importSources.ts`:

```typescript
export const getBGCTemplateMappings = (): ColumnMapping[] => {
  return [
    {
      sourceColumn: 'BGC Asset Tag',
      targetField: 'assetTag',
      targetType: 'direct',
      description: 'BGC asset identifier',
      required: true,
      processor: (value: string) => {
        if (!value) return '';
        const trimmed = value.trim();
        // Handle numeric-only tags
        if (/^\d+$/.test(trimmed)) {
          return `BGC${trimmed.padStart(6, '0')}`;
        }
        // Handle tags missing BGC prefix
        if (!/^BGC/i.test(trimmed) && /^\d/.test(trimmed)) {
          return `BGC${trimmed}`;
        }
        return trimmed.toUpperCase();
      }
    },
    {
      sourceColumn: 'Asset Tag', // Alternative column name
      targetField: 'assetTag',
      targetType: 'direct',
      description: 'Asset identifier (will add BGC prefix if numeric)',
      processor: (value: string) => {
        if (!value) return '';
        const trimmed = value.trim();
        if (/^\d+$/.test(trimmed)) {
          return `BGC${trimmed.padStart(6, '0')}`;
        }
        return trimmed.toUpperCase();
      }
    },
    {
      sourceColumn: 'Owner',
      targetField: 'assignedToAadId',
      targetType: 'direct',
      processor: (value: string) => {
        if (!value) return null;
        // Handle DOMAIN\username format
        const normalized = value.trim();
        return normalized.includes('\\') ? normalized.split('\\').pop() : normalized;
      },
      description: 'User assignment (supports usernames and display names)'
    },
    {
      sourceColumn: 'Location',
      targetField: 'locationId',
      targetType: 'direct',
      description: 'Asset location (supports abbreviations like CAL, VAN)'
    },
    // ... more mappings
  ];
};
```

### Step 2: Register the Source

Add to `IMPORT_SOURCES` array:

```typescript
{
  id: 'bgc-template',
  title: 'BGC Excel Template',
  description: 'Import from standardized BGC asset spreadsheet with enhanced user resolution',
  icon: FileSpreadsheet,
  category: 'endpoints',
  acceptedFormats: ['CSV', 'XLSX'],
  enabled: true,
  sampleFile: '/samples/bgc-asset-template.xlsx',
  getMappings: getBGCTemplateMappings,
  features: {
    userResolution: true,
    locationResolution: true,
    conflictDetection: true
  }
}
```

### Step 3: Add Sample File

Place sample file in `public/samples/bgc-asset-template.xlsx`

### Step 4: Test

The import should now work with all v0.9 enhancements!

## Import Processing Pipeline

### Frontend Processing

1. **File Parsing** (`useFileParser`)
   - CSV: Papa Parse with header normalization
   - Excel: SheetJS with trimmed headers
   - Returns: `{ headers, rows }`

2. **Column Mapping** (`StepMapping.tsx`)
   - Auto-apply source mappings
   - Handle header variations (trailing spaces, case differences)
   - Allow manual override with debug logging

3. **Resolution** (`useResolveImport`)
   - Extract usernames, locations, serial numbers
   - Call `/api/import/resolve` with enhanced payload
   - Get Azure AD data, location IDs, conflicts

4. **Import Execution** (`useImportAssets`)
   - Send to `/api/import/assets`
   - Track progress via SSE with detailed statistics
   - Handle errors/retries

### Backend Processing

1. **User Resolution** (Enhanced in v0.9)
   ```typescript
   // Detect username vs display name
   const isDisplayName = value.includes(' ') && !value.includes('@');
   
   if (isDisplayName) {
     // Try display name resolution
     users = await graphService.findUsersByDisplayName(value);
     if (users.length === 0) {
       users = await graphService.findUsersByDisplayNameFuzzy(value);
     }
   } else {
     // Try username resolution
     users = await resolveUsernames([value]);
   }
   
   // Prioritize corporate accounts
   users = graphService.prioritizeCorporateAccounts(users);
   ```

2. **Asset Tag Processing**
   ```typescript
   // Handle numeric-only BGC tags
   if (asset.assetTag && /^\d+$/.test(asset.assetTag)) {
     asset.assetTag = `BGC${asset.assetTag.padStart(6, '0')}`;
   }
   
   // Add BGC prefix if missing
   if (asset.assetTag && !/^BGC/i.test(asset.assetTag) && /^\d/.test(asset.assetTag)) {
     asset.assetTag = `BGC${asset.assetTag}`;
   }
   ```

3. **Status Assignment** (Fixed in v0.9)
   ```typescript
   // Status determined AFTER user resolution
   if (resolvedUser || (assignedUser && !userResolutionFailed)) {
     transformedAsset.status = 'ASSIGNED';
   } else {
     transformedAsset.status = 'AVAILABLE';
   }
   ```

4. **Location Matching**
   ```typescript
   // Multi-strategy matching
   const strategies = [
     exactMatch,
     caseInsensitiveMatch, 
     abbreviationMatch,
     fuzzyMatch
   ];
   ```

## Key Features

### Real-time Progress Tracking

Enhanced SSE payload with detailed statistics:

```typescript
interface ProgressUpdate {
  processed: number;
  total: number;
  successful: number;
  failed: number;
  skipped: number;
  
  // New in v0.9
  userResolutionStats: {
    resolved: number;
    failed: number;
    displayNameResolved: number;
    usernameResolved: number;
  };
  
  locationResolutionStats: {
    resolved: number;
    failed: number;
    abbreviationMatched: number;
    fuzzyMatched: number;
  };
  
  assetTagStats: {
    bgcPrefixAdded: number;
    numericNormalized: number;
  };
}
```

### Enhanced Error Handling

- Graceful handling of trailing spaces
- Corporate account prioritization
- Detailed error messages for failed resolutions
- Partial import success tracking

### Workload Category Detection

- Rule-based automatic categorization
- Runs after data transformation
- Configurable via database rules

## Configuration

### Frontend Environment

```env
VITE_API_URL=http://localhost:4000/api
```

### Backend Environment

```env
BATCH_SIZE=25
AZURE_AD_TENANT_ID=xxx
AZURE_AD_CLIENT_ID=xxx
AZURE_AD_CLIENT_SECRET=xxx

# New in v0.9
USER_RESOLUTION_TIMEOUT=30000
LOCATION_FUZZY_THRESHOLD=0.7
```

## Best Practices

### User Resolution

1. **Support Both Formats**: Design mappings to handle both usernames and display names
2. **Normalize Input**: Always trim whitespace and handle domain prefixes
3. **Corporate Priority**: Ensure corporate accounts are prioritized
4. **Fallback Strategy**: Use parallel resolution for maximum coverage

### Asset Tag Handling

1. **Normalize Early**: Apply processors in column mapping
2. **Handle Variations**: Support both prefixed and numeric-only formats
3. **Backend Safety**: Add server-side validation as fallback
4. **Consistent Format**: Always return uppercase, padded tags

### Location Matching

1. **Multi-Strategy**: Use exact, case-insensitive, abbreviation, and fuzzy matching
2. **Abbreviation Support**: Maintain abbreviation dictionary for common locations
3. **Fuzzy Threshold**: Set appropriate similarity threshold (0.7 recommended)
4. **Graceful Fallback**: Handle unmatched locations gracefully

## Common Patterns

### Enhanced User Processing

```typescript
processor: (value: string) => {
  if (!value) return null;
  
  // Normalize: trim and remove domain prefix
  let normalized = value.trim();
  if (normalized.includes('\\')) {
    normalized = normalized.split('\\').pop() || normalized;
  }
  
  return normalized;
}
```

### BGC Asset Tag Processing

```typescript
processor: (value: string) => {
  if (!value) return '';
  
  const trimmed = value.trim();
  
  // Handle numeric-only tags
  if (/^\d+$/.test(trimmed)) {
    return `BGC${trimmed.padStart(6, '0')}`;
  }
  
  // Handle tags missing BGC prefix
  if (!/^BGC/i.test(trimmed) && /^\d/.test(trimmed)) {
    return `BGC${trimmed}`;
  }
  
  return trimmed.toUpperCase();
}
```

### Location Processing

```typescript
processor: (value: string) => {
  if (!value) return null;
  
  const trimmed = value.trim();
  
  // Check for abbreviations
  const locationAbbreviations: Record<string, string> = {
    'CAL': 'Calgary',
    'VAN': 'Vancouver',
    'TOR': 'Toronto'
  };
  
  return locationAbbreviations[trimmed.toUpperCase()] || trimmed;
}
```

## Troubleshooting

### User Resolution Issues

**Problem**: Low user resolution rates
**Solution**: 
- Check if data contains display names vs usernames
- Verify Azure AD permissions for display name queries
- Ensure corporate domain prioritization is working

**Problem**: Trailing space failures
**Solution**: 
- Verify input normalization in processors
- Check backend stores results with both trimmed and original keys

### Asset Tag Issues

**Problem**: Missing BGC prefixes
**Solution**:
- Add processor to handle numeric-only tags
- Implement backend safety net
- Support alternative column names ("Asset Tag" vs "BGC Asset Tag")

### Location Matching Issues

**Problem**: Location abbreviations not resolving
**Solution**:
- Update abbreviation dictionary
- Check fuzzy matching threshold
- Verify location names in database

## Future Enhancements

- **Machine Learning**: Improve fuzzy matching with ML models
- **Bulk User Creation**: Option to create missing users automatically
- **Location Aliases**: Database-stored location aliases
- **Import Analytics**: Detailed success/failure analytics
- **API Sources**: Direct integration (Intune, Jamf)
- **Scheduled Imports**: Automated recurring imports

## Migration Notes

### From v0.8 to v0.9

**Major Changes:**
1. **Enhanced User Resolution**: Now supports display names
2. **BGC Asset Tag Normalization**: Automatic prefix handling
3. **Location Abbreviations**: CAL→Calgary, VAN→Vancouver, etc.
4. **Fixed Status Logic**: Status determined after user resolution
5. **Corporate Account Priority**: @bgcengineering.ca prioritized

**Breaking Changes:**
- None for end users
- GraphService requires additional Azure AD permissions for display name queries

**Migration Steps:**
1. Update Azure AD app permissions
2. Test user resolution with display names
3. Verify BGC asset tag processing
4. Update location abbreviations as needed

## Quick Reference

### v0.9 Checklist for New Sources

- [ ] Support both username and display name formats
- [ ] Implement asset tag normalization if needed
- [ ] Add location abbreviation support
- [ ] Test with trailing spaces in data
- [ ] Verify corporate account prioritization
- [ ] Add comprehensive error handling
- [ ] Update sample files
- [ ] Document special cases

### Testing Commands

```bash
# Test user resolution
curl -X POST http://localhost:4000/api/import/resolve \
  -H "Content-Type: application/json" \
  -d '{"usernames": ["John Smith", "jane.doe"]}'

# Test BGC asset tag processing
# Input: "123456" → Output: "BGC123456"
# Input: "BGC123456" → Output: "BGC123456"

# Test location matching
# Input: "CAL" → Output: Calgary location ID
# Input: "calgary" → Output: Calgary location ID
```

This v0.9 architecture provides robust, extensible import capabilities with significantly improved user resolution, asset tag handling, and location matching. The modular design makes adding new sources straightforward while maintaining backward compatibility. 