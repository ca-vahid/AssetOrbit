# Adding a New Import Source - Complete Guide

> **Complete step-by-step guide for adding a new import source to the Asset Management System**  
> Created: 2025-01-03  
> Based on: Rogers Phone Import Implementation

---

## Overview

This guide documents the complete process for adding a new import source (like Rogers, Bell, Verizon, etc.) to the asset management system. It covers all required code changes, common pitfalls, and testing procedures.

The system uses a **shared transformation architecture** where all import logic lives in `@ats/shared-transformations` package and is consumed by both frontend and backend to ensure consistency.

---

## Prerequisites

- Understanding of the [Refactored Import Architecture](./REFACTORED_IMPORT_ARCHITECTURE.md)
- Node.js development environment set up
- Access to sample data from the new import source

---

## Step-by-Step Implementation

### 1. Create Transformation Module

**Location**: `packages/shared/src/importSources/[sourceName]Transforms.ts`

```typescript
/**
 * [Source Name] Import Transformation Module
 * 
 * Contains all transformation logic specific to [Source Name] imports.
 */

import {
  toISO,
  parseDeviceName,
  applyColumnMappings,
  handleIMEIFallback,
  type ColumnMapping,
  type TransformationResult
} from '../importTransformations';

// ============================================================================
// COLUMN MAPPINGS
// ============================================================================

export const [SOURCE_NAME]_MAPPINGS: ColumnMapping[] = [
  {
    ninjaColumn: 'Source Column Name',
    targetField: 'targetField',
    targetType: 'direct', // or 'specifications' or 'ignore'
    description: 'Field description',
    processor: (value: string) => {
      // Optional transformation logic
      return value?.trim() || null;
    },
    required: true // if field is required
  },
  // ... more mappings
];

// ============================================================================
// TRANSFORMATION ENGINE
// ============================================================================

export function transform[SourceName]Row(row: Record<string, string>): TransformationResult {
  const result = applyColumnMappings(row, [SOURCE_NAME]_MAPPINGS);
  
  // Post-processing for source-specific business logic
  result.directFields.source = '[SOURCE_NAME]';
  
  // Add any source-specific logic here
  
  return result;
}

export function get[SourceName]Mapping(columnName: string): ColumnMapping | undefined {
  return [SOURCE_NAME]_MAPPINGS.find(mapping => mapping.ninjaColumn === columnName);
}

export function validate[SourceName]Data(data: Record<string, any>): string[] {
  const errors: string[] = [];
  
  // Add validation logic
  if (!data.requiredField) {
    errors.push('Required field is missing');
  }
  
  return errors;
}
```

### 2. Register in Transformation Registry

**Location**: `packages/shared/src/importSources/transformationRegistry.ts`

#### 2.1 Add Import Statement
```typescript
import { transform[SourceName]Row, [SOURCE_NAME]_MAPPINGS, validate[SourceName]Data } from './[sourceName]Transforms';
```

#### 2.2 Update ImportSourceType
```typescript
export type ImportSourceType = 'telus' | 'rogers' | '[sourcename]' | 'ninjaone' | 'ninjaone-servers' | 'bgc-template';
```

#### 2.3 Add to Registry
```typescript
export const IMPORT_TRANSFORMATION_REGISTRY: Record<ImportSourceType, ImportSourceTransformer> = {
  // ... existing sources
  '[sourcename]': {
    transformRow: transform[SourceName]Row,
    getMappings: () => [SOURCE_NAME]_MAPPINGS,
    validateData: (data: any) => {
      const errors = validate[SourceName]Data(data);
      return { isValid: errors.length === 0, errors };
    },
  },
  // ... rest of registry
};
```

### 3. Export from Shared Package

**Location**: `packages/shared/src/index.ts`

```typescript
export { 
  transform[SourceName]Row, 
  get[SourceName]Mapping, 
  validate[SourceName]Data,
  [SOURCE_NAME]_MAPPINGS,
  // any other exports
} from './importSources/[sourceName]Transforms';
```

### 4. Update Frontend Import Sources

**Location**: `packages/frontend/src/utils/importSources.ts`

#### 4.1 Add to UploadSource Type
```typescript
export type UploadSource =
  | 'ninjaone'
  | 'bgc-template'
  | 'telus'
  | 'rogers'
  | '[sourcename]'  // Add this line
  | 'bell'
  // ... etc
```

#### 4.2 Add Source Configuration
```typescript
export const IMPORT_SOURCES: Record<UploadCategory, ImportSourceConfig[]> = {
  // ... existing categories
  phones: [
    // ... existing sources
    {
      id: '[sourcename]',
      title: '[Source Display Name]',
      description: 'Description of the import source',
      icon: Building2, // Choose appropriate icon
      iconColor: 'text-blue-600 dark:text-blue-400',
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      acceptedFormats: ['CSV', 'XLSX', 'XLSM'], // Add XLSM if needed
      sampleFile: null, // or path to sample file
      enabled: true,
      category: 'phones', // or appropriate category
      features: ['Feature 1', 'Feature 2'],
      getMappings: () => getImportMappings('[sourcename]'),
      requiredOverrides: ['assetTag', 'make', 'assetType'], // if applicable
      customProcessing: {
        userResolution: true,
        locationResolution: false,
        conflictDetection: true,
      },
    },
  ]
};
```

#### 4.3 Add File Type Support (if needed)
```typescript
// In getAcceptedFileTypes function
case 'XLSM':
  accept['application/vnd.ms-excel.sheet.macroEnabled.12'] = ['.xlsm'];
  break;
```

### 5. Update Frontend File Parser

**Location**: `packages/frontend/src/hooks/useFileParser.ts`

#### 5.1 Add File Extension Support
```typescript
const isXLSX = file.type.includes('spreadsheet') || file.name.endsWith('.xlsx') || file.name.endsWith('.xlsm');
```

#### 5.2 Add Header Detection Keywords
```typescript
const headerKeywords = [
  'Subscriber Name', 'Phone Number', 'Device Name', // Telus
  'Account Number', 'Subscriber Number', 'Usernames', 'Device Description', // Rogers
  'New Source Column 1', 'New Source Column 2' // Add your source's unique columns
];
```

### 6. Update Frontend Source Selection

**Location**: `packages/frontend/src/components/import-wizard/steps/StepSelectSource.tsx`

```typescript
// Update file input accept mapping
input.accept = selectedSourceConfig.acceptedFormats.map(f => {
  if (f === 'CSV') return '.csv';
  if (f === 'XLSX') return '.xlsx';
  if (f === 'XLSM') return '.xlsm';
  if (f === '[NEWFORMAT]') return '.[newformat]'; // Add new formats
  return f.toLowerCase();
}).join(',');
```

### 7. Update Frontend Data Preview

**Location**: `packages/frontend/src/components/DataPreviewTable.tsx`

#### 7.1 Add Source Detection
```typescript
// First check if we have an explicit selectedSource
if (selectedSource === 'telus') {
  importSourceType = 'telus';
} else if (selectedSource === 'rogers') {
  importSourceType = 'rogers';
} else if (selectedSource === '[sourcename]') {
  importSourceType = '[sourcename]';
} else if (selectedSource === 'bgc-template') {
  importSourceType = 'bgc-template';
} else {
  // Fallback detection logic
}
```

#### 7.2 Add Fallback Detection
```typescript
// Fallback to detection logic for unknown sources
const hasTelusColumns = columnMappings.some(m => m.ninjaColumn === 'Phone Number' || m.ninjaColumn === 'Subscriber Name');
const hasRogersColumns = columnMappings.some(m => m.ninjaColumn === 'Subscriber Number' || m.ninjaColumn === 'Device Description');
const has[SourceName]Columns = columnMappings.some(m => m.ninjaColumn === 'Unique Column 1' || m.ninjaColumn === 'Unique Column 2');

if (hasTelusColumns) {
  importSourceType = 'telus';
} else if (hasRogersColumns) {
  importSourceType = 'rogers';
} else if (has[SourceName]Columns) {
  importSourceType = '[sourcename]';
} else if (hasNinjaColumns) {
  // ... existing logic
}
```

### 8. Update Backend Import Route

**Location**: `packages/backend/src/routes/import.ts`

#### 8.1 Add Source Type Detection
```typescript
// Determine source type for shared transformation modules
let sourceType: ImportSourceType;
if (source === 'TELUS') {
  sourceType = 'telus';
} else if (source === 'ROGERS') {
  sourceType = 'rogers';
} else if (source === '[SOURCE_NAME_UPPERCASE]') {
  sourceType = '[sourcename]';
} else if (source === 'NINJAONE') {
  // ... existing logic
}
```

#### 8.2 Add to Fallback Detection
```typescript
// Fallback: try to determine from column mappings
const hasTelusColumns = columnMappings.some(m => m.ninjaColumn === 'Phone Number' || m.ninjaColumn === 'Subscriber Name');
const hasRogersColumns = columnMappings.some(m => m.ninjaColumn === 'Subscriber Number' || m.ninjaColumn === 'Device Description');
const has[SourceName]Columns = columnMappings.some(m => m.ninjaColumn === 'Unique Column 1' || m.ninjaColumn === 'Unique Column 2');

if (hasTelusColumns) {
  sourceType = 'telus';
} else if (hasRogersColumns) {
  sourceType = 'rogers';
} else if (has[SourceName]Columns) {
  sourceType = '[sourcename]';
} else if (hasNinjaColumns) {
  // ... existing logic
}
```

#### 8.3 ⚠️ **CRITICAL**: Add to Source Normalization Function
```typescript
function normalizeImportSource(src: string | undefined): string {
  if (!src) return 'BULK_UPLOAD';
  const lower = src.toLowerCase();
  if (lower === 'ninjaone') return 'NINJAONE';
  if (lower === 'intune') return 'INTUNE';
  if (lower === 'bgc-template' || lower === 'custom-excel' || lower === 'invoice') return 'EXCEL';
  if (lower === 'telus') return 'TELUS';
  if (lower === 'rogers') return 'ROGERS';
  if (lower === '[sourcename]') return '[SOURCE_NAME_UPPERCASE]'; // ⚠️ ADD THIS LINE
  // Already in canonical form or unknown – default to upper-case for safety
  return src.toUpperCase();
}
```

### 9. Update Source Badge Component

**Location**: `packages/frontend/src/components/SourceBadge.tsx`

#### 9.1 Add to SOURCE_CONFIG
```typescript
const SOURCE_CONFIG = {
  // ... existing sources
  [SOURCE_NAME_UPPERCASE]: {
    label: '[Source Display Name]',
    color: 'bg-[color]-100 dark:bg-[color]-900/30 text-[color]-700 dark:text-[color]-300',
    logo: '/logos/[sourcename].png',
  },
} as const;
```

**Example:**
```typescript
ROGERS: {
  label: 'Rogers',
  color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  logo: '/logos/rogers.png',
},
```

### 10. Update AssetSource Enum

**Location**: `packages/shared/src/types/Asset.ts`

```typescript
export enum AssetSource {
  MANUAL = 'MANUAL',
  NINJAONE = 'NINJAONE', 
  INTUNE = 'INTUNE',
  EXCEL = 'EXCEL',
  BULK_UPLOAD = 'BULK_UPLOAD',
  API = 'API',
  TELUS = 'TELUS',
  ROGERS = 'ROGERS',
  [SOURCE_NAME_UPPERCASE] = '[SOURCE_NAME_UPPERCASE]'  // Add this line
}
```

### 11. Add Logo/Assets

**Location**: `packages/frontend/public/logos/[sourcename].png`

- Add the source's logo as `[sourcename].png` (lowercase)
- Follow the naming convention of existing logos

### 12. Create Tests

**Location**: `packages/shared/tests/[sourceName]Transforms.test.ts`

```typescript
// Jest is automatically available in the test environment
import { 
  transform[SourceName]Row, 
  [SOURCE_NAME]_MAPPINGS, 
  validate[SourceName]Data
} from '../src/importSources/[sourceName]Transforms';

describe('[Source Name] Transformations', () => {
  
  describe('transform[SourceName]Row', () => {
    it('should transform a complete [source name] row', () => {
      const mockRow = {
        'Source Column 1': 'value1',
        'Source Column 2': 'value2',
        // ... test data
      };

      const result = transform[SourceName]Row(mockRow);

      // Check direct fields
      expect(result.directFields.source).toBe('[SOURCE_NAME]');
      // ... more assertions
      
      // Check specifications
      // ... assertions for specifications
    });

    it('should handle minimal data', () => {
      // Test with minimal required data
    });
  });

  describe('validate[SourceName]Data', () => {
    it('should validate complete data successfully', () => {
      const data = {
        requiredField: 'value'
      };

      const errors = validate[SourceName]Data(data);
      expect(errors).toHaveLength(0);
    });

    it('should require necessary fields', () => {
      const data = {};

      const errors = validate[SourceName]Data(data);
      expect(errors).toContain('Required field message');
    });
  });
});
```

### 13. Build and Test

#### 13.1 Build Shared Package
```bash
cd packages/shared
npm run build
```

#### 13.2 Build Backend
```bash
cd packages/backend
npm run build
```

#### 13.3 Build Frontend
```bash
cd packages/frontend
npm run build
```

#### 13.4 Run Tests
```bash
cd packages/shared
npm test -- [sourceName]Transforms.test.ts
```

#### 13.5 Start Development Environment
```bash
# From project root
npm run dev
```

---

## Common Issues and Solutions

### Issue 1: "Unsupported import source: [sourcename]"

**Cause**: Missing entry in `normalizeImportSource` function in backend
**Solution**: Add mapping in `packages/backend/src/routes/import.ts`

### Issue 2: File type not accepted

**Cause**: Missing file extension in `StepSelectSource.tsx`
**Solution**: Update `input.accept` mapping to include new file types

### Issue 3: Column mapping shows "Required field not mapped"

**Cause**: Missing mappings or incorrect `targetType` in column mappings
**Solution**: Verify column mappings and ensure required fields are properly mapped

### Issue 4: Preview shows wrong transformation

**Cause**: Source not handled in `DataPreviewTable.tsx`
**Solution**: Add explicit source handling and fallback detection

### Issue 5: Frontend not recognizing new source

**Cause**: Shared package not rebuilt or frontend using cached version
**Solution**: 
1. Rebuild shared package: `cd packages/shared && npm run build`
2. Restart development server: `npm run dev`

### Issue 6: TypeScript errors about ImportSourceType

**Cause**: Type definition not updated in transformation registry
**Solution**: Add new source to `ImportSourceType` union type

### Issue 7: Source badge shows "Manual Entry" instead of source name

**Cause**: Missing entries in `SourceBadge.tsx` and `AssetSource` enum
**Solution**: 
1. Add source to `SOURCE_CONFIG` in `packages/frontend/src/components/SourceBadge.tsx`
2. Add source to `AssetSource` enum in `packages/shared/src/types/Asset.ts`
3. Rebuild shared package and restart dev server

**Example Fix:**
```typescript
// In SourceBadge.tsx
ROGERS: {
  label: 'Rogers',
  color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  logo: '/logos/rogers.png',
},

// In Asset.ts
export enum AssetSource {
  // ... existing sources
  ROGERS = 'ROGERS'
}
```

---

## Testing Checklist

### Manual Testing
- [ ] Source appears in UI source selection
- [ ] File upload accepts expected file types
- [ ] Header detection works with sample data
- [ ] Column mapping auto-populates correctly
- [ ] Preview shows correct transformations
- [ ] Import completes successfully
- [ ] Data appears correctly in database
- [ ] Source badge displays correct label and logo (not "Manual Entry")
- [ ] Source badge tooltip shows correct source name

### Automated Testing
- [ ] Unit tests pass for transformation functions
- [ ] Registry tests include new source
- [ ] Integration tests pass
- [ ] Build completes without errors

---

## Files Modified Checklist

### Shared Package (`packages/shared/`)
- [ ] `src/importSources/[sourceName]Transforms.ts` (created)
- [ ] `src/importSources/transformationRegistry.ts` (updated)
- [ ] `src/index.ts` (updated)
- [ ] `src/types/Asset.ts` (updated)
- [ ] `tests/[sourceName]Transforms.test.ts` (created)

### Frontend (`packages/frontend/`)
- [ ] `src/utils/importSources.ts` (updated)
- [ ] `src/hooks/useFileParser.ts` (updated)
- [ ] `src/components/import-wizard/steps/StepSelectSource.tsx` (updated)
- [ ] `src/components/DataPreviewTable.tsx` (updated)
- [ ] `src/components/SourceBadge.tsx` (updated)
- [ ] `public/logos/[sourcename].png` (added)

### Backend (`packages/backend/`)
- [ ] `src/routes/import.ts` (updated)

---

## Best Practices

1. **Always follow naming conventions**: Use lowercase for source identifiers, PascalCase for function names
2. **Test with real data**: Use actual export files from the source system
3. **Handle edge cases**: Empty fields, missing data, malformed data
4. **Document column mappings**: Include clear descriptions for each mapping
5. **Use processors wisely**: Transform data consistently (dates to ISO, phone numbers cleaned, etc.)
6. **Validate thoroughly**: Add comprehensive validation for required fields
7. **Build incrementally**: Test each step before moving to the next

---

## Architecture Notes

The system uses a **shared transformation architecture** where:
- All transformation logic lives in `@ats/shared-transformations`
- Frontend and backend consume the exact same transformation code
- No duplication of business logic between frontend/backend
- Type safety ensures consistency across all consumers

This architecture ensures that preview data in the frontend exactly matches what gets imported in the backend.

---

**End of Guide**

For questions or issues not covered in this guide, refer to the [Refactored Import Architecture](./REFACTORED_IMPORT_ARCHITECTURE.md) document or review the Rogers implementation as a reference example.