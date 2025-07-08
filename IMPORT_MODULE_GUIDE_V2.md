# Asset Import Module v2 - Developer Guide

## Overview

The Asset Import Module is a modular, extensible system for importing assets from various sources into the inventory system. It features a clean architecture with separated concerns, making it easy to add new import sources without modifying core logic.

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
packages/backend/src/routes/
└── import.ts                       # Generic import endpoint
    ├── POST /api/import/resolve    # Resolve users/locations/conflicts
    ├── POST /api/import/assets     # Process asset import
    └── GET  /api/import/progress/:id # SSE progress updates
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

## Adding a New Import Source

### Step 1: Define Column Mappings

Create a mapping function in `importSources.ts`:

```typescript
export const getBGCTemplateMappings = (): ColumnMapping[] => {
  return [
    {
      sourceColumn: 'Asset Tag',
      targetField: 'assetTag',
      targetType: 'direct',
      description: 'Unique asset identifier',
      required: true
    },
    {
      sourceColumn: 'Serial Number',
      targetField: 'serialNumber',
      targetType: 'direct',
      description: 'Device serial number',
      required: true
    },
    {
      sourceColumn: 'Assigned User',
      targetField: 'assignedToAadId',
      targetType: 'direct',
      processor: (value: string) => {
        // Extract username from BGC\username format
        return value.includes('\\') ? value.split('\\').pop() : value;
      },
      description: 'User assignment'
    },
    {
      sourceColumn: 'Location',
      targetField: 'locationId',
      targetType: 'direct',
      description: 'Asset location'
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
  description: 'Import from standardized BGC asset spreadsheet',
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

The import should now work! The system will:
- Show BGC option in source selection
- Parse Excel/CSV files
- Apply mappings automatically
- Resolve users/locations
- Import with progress tracking

## Import Processing Pipeline

### Frontend Processing

1. **File Parsing** (`useFileParser`)
   - CSV: Papa Parse
   - Excel: SheetJS
   - Returns: `{ headers, rows }`

2. **Filtering** (`importFilters.ts`)
   - Apply source-specific filters
   - Example: NinjaOne excludes offline > 30 days

3. **Column Mapping** (`StepMapping.tsx`)
   - Auto-apply source mappings
   - Allow manual override
   - Validate required fields

4. **Resolution** (`useResolveImport`)
   - Extract usernames, locations, serial numbers
   - Call `/api/import/resolve`
   - Get Azure AD data, location IDs, conflicts

5. **Import Execution** (`useImportAssets`)
   - Send to `/api/import/assets`
   - Track progress via SSE
   - Handle errors/retries

### Backend Processing

1. **Batch Processing**
   - Process in batches of 25
   - Parallel processing within batch
   - Progress updates per batch

2. **Data Transformation**
   - Apply column mappings
   - Run processors (date conversion, enum mapping)
   - Normalize data (RAM/storage rounding)

3. **Business Logic**
   - Asset tag generation
   - Conflict resolution (skip/overwrite)
   - Workload category detection
   - Status assignment (ASSIGNED if user present)

4. **User Assignment**
   - **v0.8+**: No automatic User record creation
   - Store username/GUID in `assignedToAadId` only
   - UI handles display with graceful fallbacks

## Key Features

### Real-time Progress Tracking

- Server-Sent Events (SSE) for live updates
- Statistics: successful, failed, skipped, categorized
- Asset type breakdown
- User assignment tracking
- Workload category detections

### Conflict Resolution

- Serial number and asset tag checking
- Skip or overwrite options
- Detailed conflict reporting

### Workload Category Detection

- Rule-based automatic categorization
- Runs after data transformation
- Configurable via database rules

### Error Handling

- Graceful error recovery
- Detailed error messages
- Partial import success
- Skip invalid records

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
```

## Best Practices

### When Adding Sources

1. **Start with sample data** - Understand the source format
2. **Map conservatively** - Only map fields you're confident about
3. **Add processors** - Transform data to expected format
4. **Test edge cases** - Empty fields, invalid dates, special characters
5. **Document mappings** - Clear descriptions help users

### Column Mapping Tips

- Use `processor` for data transformation
- Mark truly required fields as `required`
- Map to `specifications` for non-standard fields
- Validate data types match database schema

### Performance Considerations

- Large files parse client-side (no server memory)
- Batch processing prevents timeouts
- SSE provides real-time feedback
- 5-minute timeout for very large imports

## Common Patterns

### Date Processing

```typescript
processor: (value: string) => {
  if (!value) return null;
  // Handle Excel serial numbers
  if (/^\d+$/.test(value)) {
    const serial = parseInt(value, 10);
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    return new Date(excelEpoch.getTime() + serial * 86400000).toISOString();
  }
  return new Date(value).toISOString();
}
```

### Enum Mapping

```typescript
processor: (value: string) => {
  const statusMap: Record<string, string> = {
    'In Use': 'ASSIGNED',
    'Available': 'AVAILABLE',
    'Retired': 'RETIRED'
  };
  return statusMap[value] || 'AVAILABLE';
}
```

### Username Extraction

```typescript
processor: (value: string) => {
  // Handle DOMAIN\username format
  return value.includes('\\') ? value.split('\\').pop() : value;
}
```

## Troubleshooting

### Import Fails Immediately
- Check column mappings match actual headers
- Verify required fields are mapped
- Check date formats are parseable

### Progress Stuck
- Check browser console for SSE errors
- Verify `/api/import/progress` is accessible
- Check for proxy configuration issues

### Users Not Resolving
- Verify Azure AD credentials
- Check username format matches AD
- Ensure Graph API permissions

### Locations Not Matching
- Check location names in database
- Verify exact spelling/case
- Consider adding location aliases

## Future Enhancements

- **API Sources**: Direct integration (Intune, Jamf)
- **Scheduled Imports**: Automated recurring imports
- **Import Templates**: Save/reuse mappings
- **Rollback**: Undo recent imports
- **Webhooks**: Notify external systems

## Migration Notes

### From v1 to v2

The main changes from the original monolithic design:

1. **Modular Components**: Each wizard step is now isolated
2. **Registry-Driven**: No more hardcoded source logic
3. **Generic Hooks**: Reusable import logic
4. **Simplified State**: Wizard only manages navigation
5. **Better Types**: Full TypeScript coverage

### Breaking Changes

- None for end users
- Developers must use registry for new sources
- No more direct modifications to BulkUpload.tsx

## Quick Reference

### Add Source Checklist

- [ ] Create mapping function
- [ ] Add to IMPORT_SOURCES
- [ ] Add sample file
- [ ] Test with real data
- [ ] Document special cases
- [ ] Add to this guide

### File Structure for New Source

```
public/samples/
  └── your-source-template.xlsx
packages/frontend/src/utils/
  └── importSources.ts (add entry)
  └── yourSourceMappings.ts (optional separate file)
```

### Testing Commands

```bash
# Frontend dev
cd packages/frontend
npm run dev

# Backend dev  
cd packages/backend
npm run dev

# Full test
npm test
```

This modular architecture makes adding new import sources a straightforward, low-risk operation that doesn't require understanding the entire system. 