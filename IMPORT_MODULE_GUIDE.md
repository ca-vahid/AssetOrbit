# Asset Import Module - Developer Guide

## Overview

The Asset Import Module is a flexible, extensible system for importing assets from various sources into AssetOrbit. It supports multiple data sources, custom field mappings, data transformations, and source-specific processing features.

## Architecture

### Core Components

1. **Import Source Registry** (`packages/frontend/src/utils/importSources.ts`)
   - Central registry of all import sources
   - Source-specific configurations and capabilities
   - Pluggable mapping and transformation functions

2. **Column Mapping System** (`packages/frontend/src/utils/ninjaMapping.ts`)
   - Field-to-field mapping definitions
   - Data transformation processors
   - Validation rules

3. **Import Wizard** (`packages/frontend/src/pages/BulkUpload.tsx`)
   - Multi-step import process
   - Dynamic UI based on source capabilities
   - Preview and validation

4. **Backend Import API** (`packages/backend/src/routes/import.ts`)
   - Bulk import endpoint
   - Conflict resolution
   - Data validation and storage

5. **Progress Tracking System**
   - Real-time progress updates via Server-Sent Events (SSE)
   - Session-based progress tracking
   - Live statistics (successful/failed/skipped counts)

## Adding New Import Sources

### Step 1: Define Column Mappings

Create mapping functions for your new source in `packages/frontend/src/utils/importSources.ts`:

```typescript
// Example: Intune Mobile Devices
export const getIntuneMobileMappings = (): ColumnMapping[] => {
  return [
    {
      ninjaColumn: 'Device name',
      targetField: 'assetTag',
      targetType: 'direct',
      description: 'Device Name as Asset Tag',
      required: true
    },
    {
      ninjaColumn: 'Device type',
      targetField: 'assetType',
      targetType: 'direct',
      processor: (value: string) => {
        const typeMap: Record<string, string> = {
          'android': 'PHONE',
          'ios': 'PHONE',
          'ipad': 'TABLET',
          'windows': 'LAPTOP'
        };
        return typeMap[value.toLowerCase()] || 'OTHER';
      },
      description: 'Asset Type from Intune',
      required: true
    },
    {
      ninjaColumn: 'Primary user UPN',
      targetField: 'assignedToAadId',
      targetType: 'direct',
      processor: (value: string) => {
        // Extract username from UPN
        return value ? value.split('@')[0] : null;
      },
      description: 'Primary User from Intune'
    },
    {
      ninjaColumn: 'Compliance state',
      targetField: 'complianceState',
      targetType: 'specifications',
      processor: (value: string) => {
        return value.toLowerCase() === 'compliant' ? 'COMPLIANT' : 'NON_COMPLIANT';
      },
      description: 'Device Compliance Status'
    }
  ];
};
```

### Step 2: Register the Import Source

Add your source to the `IMPORT_SOURCES` registry:

```typescript
// In IMPORT_SOURCES.endpoints array
{
  id: 'intune-mobile',
  title: 'Microsoft Intune (Mobile)',
  description: 'Import mobile devices from Microsoft Intune',
  icon: Smartphone,
  iconColor: 'text-blue-600 dark:text-blue-400',
  iconBg: 'bg-blue-100 dark:bg-blue-900/30',
  acceptedFormats: ['CSV', 'XLSX'],
  sampleFile: '/samples/intune-mobile-export.csv',
  enabled: true,
  category: 'endpoints',
  features: [
    'Device compliance status',
    'Azure AD integration',
    'Mobile device management',
    'App deployment status'
  ],
  getMappings: () => getIntuneMobileMappings(),
  customProcessing: {
    userResolution: true,
    locationResolution: false,
    conflictDetection: true,
    customValidation: (data) => {
      // Custom validation for Intune mobile devices
      const errors: string[] = [];
      if (!data.some((row: any) => row['Device name'])) {
        errors.push('Device name is required for all devices');
      }
      return { isValid: errors.length === 0, errors };
    }
  }
}
```

### Step 3: Create Sample Files

Create sample CSV/Excel files in the `public/samples/` directory:

```csv
Device name,Device type,Manufacturer,Model,Serial number,Primary user UPN,OS,OS version,Compliance state,Last check-in
iPhone-001,ios,Apple,iPhone 14 Pro,ABC123456,jsmith@company.com,iOS,16.4.1,Compliant,2024-01-15T10:30:00Z
Android-002,android,Samsung,Galaxy S23,DEF789012,mjones@company.com,Android,13,Non-compliant,2024-01-14T15:45:00Z
```

## Source Categories

### Endpoints
- **NinjaOne Export**: Full RMM data with hardware specs
- **Microsoft Intune**: Device management and compliance
- **BGC Asset Template**: Standardized asset inventory
- **Custom Excel/CSV**: User-defined mappings
- **Invoice/PO Documents**: OCR-based extraction

### Servers
- **BGC Server Template**: Server inventory with rack locations
- **NinjaOne Servers**: Server monitoring data
- **VMware vCenter**: Virtual machine inventory
- **Hyper-V**: Microsoft virtualization platform

## Field Mapping Types

### Direct Fields
Map directly to asset table columns:
- `assetTag`, `assetType`, `status`, `condition`, `make`, `model`, `serialNumber`
- `assignedToId`, `assignedToAadId`, `departmentId`, `locationId`
- `purchaseDate`, `purchasePrice`, `vendorId`
- `warrantyStartDate`, `warrantyEndDate`, `warrantyNotes`, `notes`

### Specifications (JSON)
Store in the `specifications` JSON field:
- Hardware specs: `processor`, `ram`, `storage`, `operatingSystem`
- Network info: `ipAddresses`, `macAddresses`
- System info: `osVersion`, `lastOnline`, `complianceState`

### Custom Fields
Store in the `CustomFieldValue` table:
- User-defined fields from the Custom Fields admin page
- Flexible data types: text, number, boolean, date, multi-select
- Prefix with `cf_` in mappings (e.g., `cf_12345` for custom field ID 12345)

## Automatic Workload Category Detection

The import system includes intelligent workload category detection that automatically assigns appropriate categories to assets based on predefined rules during the import process.

### How It Works

1. **Rule-Based Detection**: The system evaluates assets against a set of configurable rules
2. **Priority-Based Evaluation**: Rules are processed in priority order (1 = highest priority)
3. **First Match Wins**: Processing stops when the first matching rule is found
4. **Field-Based Matching**: Rules can evaluate any asset field or nested specification

### Rule Configuration

Rules are stored in the `WorkloadCategoryRule` table with the following structure:

```typescript
interface WorkloadCategoryRule {
  id: string;
  categoryId: string;          // References WorkloadCategory
  priority: number;            // 1 = highest priority
  sourceField: string;         // Field path to evaluate
  operator: string;            // Comparison operator
  value: string;               // Value to compare against
  description?: string;        // Human-readable description
  isActive: boolean;           // Enable/disable rule
}
```

### Supported Operators

- `=` - Exact match (case-insensitive)
- `!=` - Not equal (case-insensitive)
- `>=` - Greater than or equal (numeric)
- `<=` - Less than or equal (numeric)
- `>` - Greater than (numeric)
- `<` - Less than (numeric)
- `includes` - Contains substring (case-insensitive)
- `regex` - Regular expression match (case-insensitive)

### Source Field Paths

Rules can evaluate any field in the asset data:

#### Direct Asset Fields
- `assetType`, `status`, `condition`, `make`, `model`, `serialNumber`
- `assignedToId`, `assignedToAadId`, `departmentId`, `locationId`
- `purchaseDate`, `purchasePrice`, `vendorId`

#### Nested Specifications
- `specifications.ram` - Memory amount
- `specifications.processor` - CPU model
- `specifications.storage` - Storage capacity
- `specifications.graphics` - Graphics card
- `specifications.os` - Operating system

#### Custom Fields
- `customFields.{fieldId}` - Custom field values

### Example Rules

#### Memory-Based Detection
```typescript
// Rule: 128GB+ RAM = Giant Memory
{
  categoryId: "giant-memory-category-id",
  priority: 2,
  sourceField: "specifications.ram",
  operator: "regex",
  value: "(12[8-9]|1[3-9][0-9]|[2-9][0-9][0-9])\\s*GB",
  description: "Assets with 128GB+ RAM for giant memory workloads"
}

// Rule: 64GB+ RAM = High Memory
{
  categoryId: "high-memory-category-id",
  priority: 3,
  sourceField: "specifications.ram",
  operator: "regex",
  value: "(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\\s*GB",
  description: "Assets with 64-127GB RAM for high memory workloads"
}
```

#### User-Based Detection
```typescript
// Rule: Specific user goes to Boardroom
{
  categoryId: "boardroom-category-id",
  priority: 1,
  sourceField: "assignedToAadId",
  operator: "=",
  value: "skypeduplicatecontacts",
  description: "Skype users assigned to Boardroom category"
}
```

#### Graphics-Based Detection
```typescript
// Rule: Dedicated GPU = CAD Workstation
{
  categoryId: "cad-category-id",
  priority: 4,
  sourceField: "specifications.graphics",
  operator: "regex",
  value: "(nvidia|quadro|rtx|gtx|amd radeon pro|firepro)",
  description: "Assets with dedicated graphics cards for CAD work"
}
```

#### Condition-Based Detection
```typescript
// Rule: Fair condition = Field Laptop
{
  categoryId: "field-laptop-category-id",
  priority: 5,
  sourceField: "condition",
  operator: "=",
  value: "FAIR",
  description: "Fair condition assets designated for field use"
}
```

### Implementation Details

#### Backend Processing
```typescript
// Load rules once per batch for efficiency
const workloadCategoryRules = await prisma.workloadCategoryRule.findMany({
  where: { isActive: true },
  include: { category: true },
  orderBy: { priority: 'asc' }
});

// Detect category for each asset
const detectedCategoryId = await detectWorkloadCategory(assetData, workloadCategoryRules);
if (detectedCategoryId) {
  assetData.workloadCategoryId = detectedCategoryId;
}
```

#### Rule Evaluation Engine
```typescript
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

function matchRule(value: any, rule: any): boolean {
  if (value === null || value === undefined) return false;
  
  const stringValue = String(value).toLowerCase();
  const ruleValue = String(rule.value).toLowerCase();
  
  switch (rule.operator) {
    case '=':
      return stringValue === ruleValue;
    case 'includes':
      return stringValue.includes(ruleValue);
    case 'regex':
      return new RegExp(rule.value, 'i').test(String(value));
    // ... other operators
  }
}
```

#### Database Assignment
```typescript
// Create workload category assignment
if (assetData.workloadCategoryId) {
  await prisma.assetWorkloadCategory.create({
    data: {
      assetId: newAsset.id,
      categoryId: assetData.workloadCategoryId
    }
  });
}
```

### Managing Rules

#### Creating New Rules
```sql
INSERT INTO WorkloadCategoryRule (
  id, categoryId, priority, sourceField, operator, value, description, isActive
) VALUES (
  'rule-id', 'category-id', 10, 'specifications.processor', 'includes', 'i9', 
  'High-performance processors for power users', 1
);
```

#### Rule Priority Guidelines
- **1-10**: Critical business rules (user assignments, compliance)
- **11-20**: Hardware-based rules (memory, CPU, GPU)
- **21-30**: Condition-based rules (age, condition, location)
- **31-40**: Fallback rules (default categories)

#### Best Practices
1. **Test Rules Thoroughly**: Use regex testers for complex patterns
2. **Document Rules**: Always include descriptive descriptions
3. **Monitor Performance**: Complex regex can slow down imports
4. **Review Regularly**: Update rules as business needs change
5. **Avoid Conflicts**: Ensure rule priorities prevent conflicts

### Troubleshooting

#### Common Issues
1. **Rule Not Matching**: Check field paths and case sensitivity
2. **Wrong Category**: Verify rule priority order
3. **Performance Issues**: Optimize regex patterns
4. **Multiple Matches**: Review priority assignments

#### Debug Logging
```typescript
logger.info(`Workload category detected: ${rule.category.name} (rule: ${rule.description})`);
```

#### Testing Rules
```typescript
// Test rule against sample data
const testAsset = {
  specifications: { ram: "64GB DDR4" },
  assignedToAadId: "testuser"
};

const matchedRule = workloadCategoryRules.find(rule => {
  const fieldValue = getNestedValue(testAsset, rule.sourceField);
  return matchRule(fieldValue, rule);
});
```

### Integration with Import Sources

Workload category detection works automatically with all import sources:

- **NinjaOne**: Detects based on hardware specs and assigned users
- **Intune**: Uses device compliance and user assignments
- **Excel/CSV**: Applies rules to any mapped fields
- **Custom Sources**: Configurable per source requirements

The detection runs after user resolution but before conflict resolution, ensuring accurate category assignment based on the final asset data.

## Data Processors

Processors transform raw data into the expected format:

```typescript
// Date processor
processor: (value: string) => {
  if (!value) return null;
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date.toISOString();
}

// Excel serial number processor
processor: (value: string) => {
  if (/^\d+$/.test(value)) {
    const serial = parseInt(value, 10);
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    return new Date(excelEpoch.getTime() + serial * 86400000).toISOString();
  }
  return new Date(value).toISOString();
}

// Storage size processor
processor: (value: string) => {
  const gib = parseFloat(value);
  if (isNaN(gib)) return null;
  
  if (gib > 900) return '1 TB';
  if (gib > 450) return '512 GB';
  if (gib > 230) return '256 GB';
  return `${Math.round(gib)} GB`;
}

// Enum mapping processor
processor: (value: string) => {
  const statusMap: Record<string, string> = {
    'active': 'AVAILABLE',
    'assigned': 'ASSIGNED',
    'retired': 'RETIRED'
  };
  return statusMap[value.toLowerCase()] || 'AVAILABLE';
}
```

## Processing Features

### User Handling Changes (v0.8)

**Background:**
The import system previously created User database records for every person assigned to an asset. This was problematic because:
- It gave system access to users who don't need it (only IT technicians should log in)
- Created placeholder users with fake emails and READ roles
- Cluttered the user management system with non-login users

**Solution Implemented:**
1. **Disabled automatic User creation** in `packages/backend/src/routes/import.ts`
2. **Updated frontend display logic** to handle missing User records gracefully
3. **Cleaned up existing placeholder users** (113 users removed, 122 assets updated)

**Migration Impact:**
- Existing assets with `assignedToId` references had those cleared
- `assignedToAadId` values were preserved for display
- UI now shows usernames directly when no User record exists
- No loss of assignment information

### User Resolution
**⚠️ Important: As of v0.8, automatic User record creation has been disabled.**

The import system handles user assignment in two phases:

1. **Azure AD Lookup**: Resolves usernames to Azure AD GUIDs for validation and enrichment
2. **Direct Storage**: Stores the username/ID directly in `assignedToAadId` without creating User database records

```typescript
customProcessing: {
  userResolution: true  // Enable Azure AD lookup for validation only
}
```

**Current Behavior:**
- Usernames are validated against Azure AD during import preview
- `assignedToAadId` field stores the username/ID directly
- No User database records are created during import
- UI displays usernames directly or enriches with Azure AD data when available
- Only IT technicians who actually log into the system will have User records

**Previous Behavior (Disabled):**
- ~~Import process automatically created User records for every assigned person~~
- ~~Created placeholder users with fake emails and READ role~~
- ~~Gave system access to users who don't need it~~

### Location Resolution
Map location names to database location IDs:
```typescript
customProcessing: {
  locationResolution: true  // Enable location mapping
}
```

### Conflict Detection
Check for existing assets with same serial numbers:
```typescript
customProcessing: {
  conflictDetection: true  // Enable conflict checking
}
```

### Custom Validation
Add source-specific validation rules:
```typescript
customProcessing: {
  customValidation: (data) => {
    const errors: string[] = [];
    
    // Check for required fields
    if (!data.every(row => row['Asset Tag'])) {
      errors.push('Asset Tag is required for all items');
    }
    
    // Check for valid asset types
    const validTypes = ['LAPTOP', 'DESKTOP', 'PHONE', 'TABLET'];
    const invalidTypes = data.filter(row => 
      !validTypes.includes(row['Asset Type']?.toUpperCase())
    );
    if (invalidTypes.length > 0) {
      errors.push(`Invalid asset types found: ${invalidTypes.length} items`);
    }
    
    return { isValid: errors.length === 0, errors };
  }
}
```

## Import Filters

Define filters to exclude unwanted data during import:

```typescript
// In packages/frontend/src/utils/importFilters.ts
export const IMPORT_FILTERS = {
  'ninjaone_endpoints': {
    name: 'NinjaOne Endpoints',
    description: 'Active devices only (exclude offline > 30 days)',
    filter: (item: Record<string, string>) => {
      const lastOnline = item['Last Online'];
      if (!lastOnline) return false;
      
      const lastOnlineDate = new Date(lastOnline);
      const daysSinceOnline = (Date.now() - lastOnlineDate.getTime()) / (1000 * 60 * 60 * 24);
      
      return daysSinceOnline <= 30;
    }
  },
  'intune-mobile_endpoints': {
    name: 'Intune Mobile Devices',
    description: 'Mobile phones and tablets only',
    filter: (item: Record<string, string>) => {
      const deviceType = item['Device type']?.toLowerCase();
      return ['android', 'ios', 'ipad'].includes(deviceType || '');
    }
  }
};
```

## Progress Tracking

### Real-time Progress Updates

The import system provides real-time progress updates via Server-Sent Events:

```typescript
// Frontend hook for progress tracking
const { progress } = useImportProgress(sessionId, (progress) => {
  console.log(`Progress: ${progress.processed}/${progress.total} (${progress.percentage}%)`);
  console.log(`Success: ${progress.successful}, Failed: ${progress.failed}, Skipped: ${progress.skipped}`);
});
```

### Backend Progress Implementation

```typescript
// Backend progress store
const progressStore = new Map<string, {
  total: number;
  processed: number;
  successful: number;
  failed: number;
  skipped: number;
  currentItem?: string;
  errors: Array<{ index: number; error: string; data?: any }>;
  skippedItems: Array<{ index: number; reason: string; data?: any }>; // Added in v0.8
}>();

// Update progress during import
const updateProgress = (sessionId: string, update: Partial<ProgressData>) => {
  const current = progressStore.get(sessionId) || {
    total: 0, processed: 0, successful: 0, failed: 0, skipped: 0, errors: [], skippedItems: []
  };
  progressStore.set(sessionId, { ...current, ...update });
};
```

### Backend Import Changes (v0.8)

The backend import logic has been updated to handle user assignment without creating User records:

```typescript
// OLD BEHAVIOR (Disabled)
// if (assetData.assignedToAadId && !assetData.assignedToId) {
//   let dbUser = await prisma.user.findFirst({ where: { azureAdId: assetData.assignedToAadId } });
//   if (!dbUser) {
//     dbUser = await prisma.user.create({
//       data: {
//         azureAdId: assetData.assignedToAadId,
//         email: `${assetData.assignedToAadId}@placeholder.local`,
//         displayName: `User ${assetData.assignedToAadId}`,
//         role: 'READ',
//         isActive: false
//       }
//     });
//   }
//   assetData.assignedToId = dbUser.id;
// }

// NEW BEHAVIOR (Current)
// Store username/ID directly in assignedToAadId field
// UI will display this value or enrich with Azure AD data when available
if (assetData.assignedToAadId) {
  // Just store the username/ID directly - no User record creation
  logger.info(`Asset assigned to: ${assetData.assignedToAadId} (no User record created)`);
}
```

**Key Changes:**
1. **Commented out User creation logic** in import processing
2. **Enhanced skipped items tracking** with detailed reasons
3. **Improved error handling** for missing serial numbers
4. **Updated progress tracking** to include `skippedItems` array

### Progress Endpoint

```typescript
// GET /api/import/progress/:sessionId
app.get('/api/import/progress/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  const interval = setInterval(() => {
    const progress = progressStore.get(sessionId);
    if (progress) {
      const percentage = progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0;
      res.write(`data: ${JSON.stringify({ ...progress, percentage })}\n\n`);
    }
  }, 1000);

  req.on('close', () => clearInterval(interval));
});
```

## Conflict Resolution

### Conflict Detection

The system checks for conflicts using both serial numbers and asset tags:

```typescript
// Check for existing asset by serial number first
let existingAsset = await prisma.asset.findFirst({
  where: { serialNumber: assetData.serialNumber }
});

// If no serial conflict, check asset tag
if (!existingAsset && assetData.assetTag) {
  existingAsset = await prisma.asset.findFirst({
    where: { assetTag: assetData.assetTag }
  });
}
```

### Resolution Strategies

1. **Skip**: Skip conflicting assets, continue with others
2. **Overwrite**: Update existing assets with new data

```typescript
if (existingAsset) {
  if (conflictResolution === 'skip') {
    return { success: false, index, skipped: true };
  } else if (conflictResolution === 'overwrite') {
    // Update existing asset
    const updatedAsset = await prisma.asset.update({
      where: { id: existingAsset.id },
      data: assetDataWithoutCustomFields
    });
    // Handle custom fields separately...
  }
}
```

## Error Handling

### Frontend Changes (v0.8)

The frontend has been updated to handle missing User records gracefully:

```typescript
// Asset List Display Logic
{asset.assignedToStaff ? (
  <div className="flex items-center gap-2">
    → {asset.assignedToStaff.displayName}
  </div>
) : asset.assignedTo ? (
  <div className="flex items-center gap-2">
    <span className="text-sm text-slate-800 dark:text-slate-200 truncate">
      {asset.assignedTo.displayName}
    </span>
  </div>
) : asset.assignedToAadId ? (
  <div className="flex items-center gap-2">
    <span className="text-sm text-slate-600 dark:text-slate-400 truncate">
      {asset.assignedToAadId}
    </span>
  </div>
) : null}

// Asset Detail Modal Display Logic
{asset.assignedToStaff ? (
  <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
    <div className="flex items-start gap-3">
      <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
        <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
      </div>
      <div>
        <div className="font-medium text-slate-900 dark:text-slate-100">
          {asset.assignedToStaff.displayName}
        </div>
        <div className="text-sm text-slate-600 dark:text-slate-400">
          {asset.assignedToStaff.mail}
        </div>
      </div>
    </div>
  </div>
) : asset.assignedTo ? (
  // Existing User record display
) : asset.assignedToAadId ? (
  <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
    <div className="flex items-start gap-3">
      <div className="p-2 bg-slate-100 dark:bg-slate-600 rounded-lg">
        <User className="w-4 h-4 text-slate-500 dark:text-slate-400" />
      </div>
      <div>
        <div className="font-medium text-slate-900 dark:text-slate-100">
          {asset.assignedToAadId}
        </div>
        <div className="text-sm text-slate-600 dark:text-slate-400">
          Assigned User (No login account)
        </div>
      </div>
    </div>
  </div>
) : null}
```

**Display Priority:**
1. **assignedToStaff** - Azure AD staff information (enriched data)
2. **assignedTo** - User database record (for IT technicians who log in)
3. **assignedToAadId** - Direct username/ID (for imported assignments)

### Frontend Error Display

```typescript
// Error parsing and user-friendly messages
const parseImportError = (error: any) => {
  if (error.response?.data?.error) {
    const errorMsg = error.response.data.error;
    
    // Handle specific error types
    if (errorMsg.includes('Unique constraint failed')) {
      return {
        title: 'Duplicate Asset Found',
        message: 'An asset with this serial number or asset tag already exists.',
        suggestions: [
          'Change conflict resolution to "Skip duplicates"',
          'Update existing assets by choosing "Overwrite"',
          'Review your data for duplicate entries'
        ]
      };
    }
    
    if (errorMsg.includes('Invalid asset type')) {
      return {
        title: 'Invalid Asset Type',
        message: 'One or more assets have invalid asset types.',
        suggestions: [
          'Valid types: LAPTOP, DESKTOP, PHONE, TABLET, SERVER, OTHER',
          'Check your column mapping for Asset Type',
          'Review source data for typos'
        ]
      };
    }
  }
  
  return {
    title: 'Import Error',
    message: 'An unexpected error occurred during import.',
    suggestions: [
      'Check your data format and try again',
      'Verify column mappings are correct',
      'Contact support if the problem persists'
    ]
  };
};
```

### Backend Error Handling

```typescript
// Batch processing with error isolation
const batchPromises = assetBatch.map(async ({ asset: csvRow, index }) => {
  try {
    // Process single asset...
    return { success: true, index, result: createdAsset };
  } catch (error) {
    logger.error('Asset processing error:', { error, index, data: csvRow });
    
    // Convert technical errors to user-friendly messages
    let errorMessage = 'Unknown error occurred';
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        errorMessage = 'Duplicate asset tag or serial number';
      } else if (error.code === 'P2003') {
        errorMessage = 'Invalid reference to user, department, or location';
      }
    }
    
    return { success: false, index, error: errorMessage };
  }
});
```

## Asset Tag Generation

### Automatic Tag Generation

When no asset tag is provided, the system generates unique tags:

```typescript
// Generate asset tag if not provided
if (!assetData.assetTag) {
  const prefix = assetData.assetType === 'LAPTOP' ? 'LT' : 
                assetData.assetType === 'DESKTOP' ? 'DT' : 'AS';
  const timestamp = Date.now().toString().slice(-6);
  const randomSuffix = Math.random().toString(36).substr(2, 3).toUpperCase();
  assetData.assetTag = `${prefix}-${timestamp}-${randomSuffix}-${(index + 1).toString().padStart(3, '0')}`;
}
```

### Conflict Avoidance

```typescript
// Ensure asset tag uniqueness
const existingTagAsset = await prisma.asset.findFirst({
  where: { assetTag: assetData.assetTag }
});

if (existingTagAsset && conflictResolution !== 'overwrite') {
  const timestamp = Date.now().toString().slice(-6);
  const randomSuffix = Math.random().toString(36).substr(2, 3).toUpperCase();
  assetData.assetTag = `${assetData.assetTag}-${timestamp}-${randomSuffix}`;
}
```

## Serial Number Validation

### Skip Invalid Serial Numbers

Assets without valid serial numbers are skipped rather than failed:

```typescript
// Skip assets without serial numbers
if (!assetData.serialNumber || !assetData.serialNumber.trim()) {
  return { success: false, index, skipped: true };
}
```

### Serial Number Normalization

```typescript
// Clean and normalize serial numbers
const normalizeSerialNumber = (serial: string): string => {
  return serial.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
};
```

## Batch Processing

### Parallel Processing

Assets are processed in batches with configurable batch size:

```typescript
const BATCH_SIZE = 25;

// Process assets in batches
for (let i = 0; i < itemsToImport.length; i += BATCH_SIZE) {
  const batch = itemsToImport.slice(i, i + BATCH_SIZE);
  const batchWithIndex = batch.map((asset, batchIndex) => ({
    asset,
    index: i + batchIndex
  }));
  
  const batchResults = await processAssetBatch(
    batchWithIndex,
    columnMappings,
    conflictResolution,
    source,
    sessionId,
    req
  );
  
  // Update progress
  updateProgress(sessionId, {
    processed: Math.min(i + BATCH_SIZE, itemsToImport.length),
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success && !r.skipped).length,
    skipped: results.filter(r => r.skipped).length
  });
}
```

## Examples

### Example 1: NinjaOne Server Import

```typescript
// Add to IMPORT_SOURCES.servers
{
  id: 'ninjaone-servers',
  title: 'NinjaOne Servers',
  description: 'Import servers from NinjaOne RMM',
  category: 'servers',
  getMappings: () => getNinjaServerMappings(),
  customProcessing: {
    userResolution: false,
    locationResolution: true,
    conflictDetection: true
  }
}

// Define server-specific mappings
export const getNinjaServerMappings = (): ColumnMapping[] => [
  {
    ninjaColumn: 'Display Name',
    targetField: 'assetTag',
    targetType: 'direct',
    description: 'Server Name',
    required: true
  },
  {
    ninjaColumn: 'Role',
    targetField: 'assetType',
    targetType: 'direct',
    processor: (value: string) => {
      const serverRoles = {
        'WINDOWS_SERVER': 'SERVER',
        'LINUX_SERVER': 'SERVER',
        'HYPER-V_SERVER': 'SERVER'
      };
      return serverRoles[value] || 'SERVER';
    },
    description: 'Server Type'
  }
];
```

### Example 2: Custom Excel Template

```typescript
{
  id: 'custom-excel',
  title: 'Custom Excel/CSV',
  description: 'Import from any Excel or CSV with custom mapping',
  category: 'endpoints',
  getMappings: () => [], // Dynamic mapping in UI
  customProcessing: {
    userResolution: false,
    locationResolution: false,
    conflictDetection: true,
    customValidation: (data) => {
      // Allow any data structure, validate in UI
      return { isValid: true, errors: [] };
    }
  }
}
```

### Example 3: Complete Import Workflow

```typescript
// 1. User uploads file
const file = new File([csvContent], 'assets.csv', { type: 'text/csv' });

// 2. Parse CSV data
const parsedData = Papa.parse(file, {
  header: true,
  skipEmptyLines: true
});

// 3. Apply column mappings
const mappings = await getMappingsForSource('ninjaone', 'endpoints');

// 4. Resolve users and locations
const { userMap, locationMap, conflicts } = await resolveImport({
  usernames: extractUsernames(parsedData.data),
  locations: extractLocations(parsedData.data),
  serialNumbers: extractSerialNumbers(parsedData.data)
});

// 5. Start import with progress tracking
const sessionId = generateSessionId();
const importResults = await importAssets({
  sessionId,
  items: parsedData.data,
  mappings,
  conflictResolution: 'overwrite',
  source: 'ninjaone'
});

// 6. Monitor progress
useImportProgress(sessionId, (progress) => {
  updateProgressBar(progress.percentage);
  updateStats(progress.successful, progress.failed, progress.skipped);
});
```

## Testing New Import Sources

1. **Create sample data file** in `public/samples/`
2. **Test column mapping** in the import wizard
3. **Verify data transformation** in the preview step
4. **Test conflict resolution** with existing assets
5. **Validate imported data** in the asset list
6. **Test progress tracking** with large datasets
7. **Verify error handling** with invalid data

## Best Practices

### Mapping Design
- Use descriptive field names that match the source system
- Include data validation in processors
- Handle edge cases (null, empty, invalid data)
- Provide clear error messages
- Test with various data formats and edge cases

### Performance
- Keep processors lightweight and efficient
- Batch Azure AD lookups for user resolution (validation only)
- Use efficient data structures for large imports
- Consider memory usage for large files
- Process assets in parallel within batches

### User Experience
- Provide clear descriptions for each mapping
- Include helpful sample files
- Show progress during import with meaningful statistics
- Display user-friendly error messages
- Allow users to copy error details for troubleshooting

### Data Quality
- Validate data types and formats
- Check for required fields
- Handle duplicate detection intelligently
- Provide data transformation feedback
- Skip invalid records rather than failing entire import

### Error Handling
- Isolate errors to individual records
- Provide specific error messages for common issues
- Allow partial imports to succeed
- Log detailed errors for debugging
- Offer suggestions for resolving issues

### User Assignment Best Practices (v0.8+)

**Do:**
- Store usernames/IDs directly in `assignedToAadId` field
- Use Azure AD lookup for validation and enrichment only
- Let UI handle display logic with fallbacks
- Only create User records for people who actually log into the system

**Don't:**
- Create User database records for every assigned person
- Give system access to users who don't need it
- Use placeholder emails or fake user data
- Assume all assigned users need login capabilities

**Migration Considerations:**
- Existing imports will continue to work without User records
- UI gracefully handles missing User records
- Assignment information is preserved in `assignedToAadId`
- Only affects display, not functionality

## Troubleshooting

### Common Issues

1. **Mapping not found**: Check that the source ID exists in `IMPORT_SOURCES`
2. **Processor errors**: Add try-catch blocks and null checks in processors
3. **User resolution fails**: Verify Azure AD permissions and user format (Note: v0.8+ only validates, doesn't create User records)
4. **Import timeout**: Consider splitting large files or optimizing processors
5. **Progress not updating**: Check SSE endpoint accessibility and session ID
6. **Conflict resolution not working**: Verify serial number and asset tag uniqueness logic

### Debug Tools

- **Browser console**: Frontend mapping and processing issues
- **Backend logs**: Import processing errors and performance metrics
- **Network tab**: API request/response debugging and SSE connection
- **Preview table**: Data transformation verification
- **Progress endpoint**: Real-time import status monitoring

### Performance Optimization

- **Batch size tuning**: Adjust `BATCH_SIZE` based on system resources
- **Database indexing**: Ensure proper indexes on `serialNumber` and `assetTag`
- **Memory management**: Monitor memory usage during large imports
- **Connection pooling**: Optimize database connection handling
- **Caching**: Cache frequently accessed data like users and locations

## API Reference

### Import Endpoints

```typescript
// Resolve users, locations, and check conflicts
POST /api/import/resolve
{
  usernames: string[];
  locations: string[];
  serialNumbers: string[];
}

// Import assets with progress tracking
POST /api/import/assets
{
  sessionId: string;
  items: Record<string, string>[];
  mappings: ColumnMapping[];
  conflictResolution: 'skip' | 'overwrite';
  source: string;
}

// Get real-time progress (SSE)
GET /api/import/progress/:sessionId
```

### Response Types

```typescript
interface ImportProgress {
  total: number;
  processed: number;
  successful: number;
  failed: number;
  skipped: number;
  percentage: number;
  currentItem?: string;
  errors: Array<{
    index: number;
    error: string;
    data?: any;
  }>;
  skippedItems: Array<{  // Added in v0.8
    index: number;
    reason: string;
    data?: any;
  }>;
}

interface ImportResult {
  total: number;
  successful: number;
  failed: number;
  skipped: number;
  errors: Array<{
    index: number;
    error: string;
    data?: any;
  }>;
  skippedItems: Array<{  // Added in v0.8
    index: number;
    reason: string;
    data?: any;
  }>;
  created: Array<{
    id: string;
    assetTag: string;
  }>;
}
```

## Configuration

### Environment Variables

```bash
# Backend configuration
BATCH_SIZE=25                    # Assets per batch
PROGRESS_UPDATE_INTERVAL=1000    # Progress update interval (ms)
MAX_IMPORT_SIZE=10000           # Maximum items per import
IMPORT_TIMEOUT=300000           # Import timeout (ms)

# Azure AD configuration
AZURE_AD_TENANT_ID=your-tenant-id
AZURE_AD_CLIENT_ID=your-client-id
AZURE_AD_CLIENT_SECRET=your-client-secret
```

### Frontend Configuration

```typescript
// Import configuration
export const IMPORT_CONFIG = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  supportedFormats: ['CSV', 'XLSX', 'PDF'],
  progressUpdateInterval: 1000,   // 1 second
  maxRetries: 3,
  batchSize: 25
};
```

## Future Enhancements

### Planned Features
- **API-based imports**: Direct integration with source systems
- **Scheduled imports**: Automated recurring imports
- **Delta imports**: Only import changed data since last sync
- **Advanced mapping UI**: Drag-and-drop field mapping interface
- **Import templates**: Save and reuse mapping configurations
- **Audit trail**: Track import history and changes
- **Data validation rules**: Custom validation rules per source
- **Import rollback**: Ability to undo imports
- **Multi-file imports**: Process multiple files in one session
- **Import queuing**: Queue large imports for background processing

### Technical Improvements
- **Streaming imports**: Process files without loading entirely into memory
- **Parallel batch processing**: Process multiple batches simultaneously
- **Import caching**: Cache processed data for retry scenarios
- **Advanced error recovery**: Automatic retry with backoff
- **Import analytics**: Detailed metrics and reporting
- **Performance monitoring**: Real-time performance tracking
- **Resource management**: Dynamic resource allocation based on import size

### Integration Enhancements
- **Webhook notifications**: Notify external systems of import completion
- **GraphQL support**: GraphQL API for import operations
- **Real-time collaboration**: Multiple users monitoring same import
- **Mobile support**: Mobile-optimized import interface
- **Offline imports**: Process imports without internet connectivity
- **Cloud storage integration**: Import directly from cloud storage services

This comprehensive guide provides everything needed to understand, extend, and maintain the Asset Import Module. The system is designed to be flexible and extensible, allowing for easy addition of new import sources and processing capabilities.

## Changelog

### v0.8 (Current) - User Management Overhaul
**Date:** January 2025

**Major Changes:**
- **🚫 Disabled automatic User record creation** during asset imports
- **🧹 Cleaned up 113 placeholder users** created by previous imports
- **📱 Updated frontend display logic** to handle missing User records gracefully
- **📊 Enhanced skipped items tracking** with detailed reasons and data
- **🔄 Improved import results UI** with clickable failed/skipped sections

**Breaking Changes:**
- User records are no longer created automatically during imports
- `assignedToAadId` now stores usernames directly without corresponding User records
- Only IT technicians who actually log into the system will have User records

**Migration Impact:**
- Existing assets with placeholder user assignments continue to work
- UI gracefully displays usernames when no User record exists
- No loss of assignment information or functionality

**Files Modified:**
- `packages/backend/src/routes/import.ts` - Disabled user creation logic
- `packages/frontend/src/pages/AssetList.tsx` - Updated display logic
- `packages/frontend/src/components/AssetDetailModal.tsx` - Updated display logic
- `packages/frontend/src/pages/BulkUpload.tsx` - Enhanced import results UI

**Rationale:**
The previous approach of creating User records for every assigned person was problematic because:
- It gave system access to users who don't need it (only IT technicians should log in)
- Created placeholder users with fake emails and READ roles
- Cluttered the user management system with non-login users
- Violated the principle of least privilege

The new approach stores assignment information directly while maintaining clean user management for actual system users. 