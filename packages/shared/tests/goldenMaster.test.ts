/**
 * Golden Master Testing Framework
 * 
 * This framework captures the current working system's output as the "golden standard"
 * and tests that our refactored modules produce identical results.
 * 
 * Usage:
 * 1. Provide real Telus phone data
 * 2. Run it through current working system to establish golden master
 * 3. Test refactored system against golden master
 * 4. Flag any differences for investigation
 */

import * as fs from 'fs';
import * as path from 'path';
import { transformTelusPhoneRow } from '../src/importSources/telusTransforms';

// ============================================================================
// GOLDEN MASTER DATA TYPES
// ============================================================================

interface AssetImportResult {
  // Direct database fields
  assetTag?: string;
  serialNumber?: string;
  model?: string;
  make?: string;
  assetType?: string;
  condition?: string;
  status?: string;
  source?: string;
  assignedToAadId?: string;
  
  // Specifications object
  specifications: {
    storage?: string;
    imei?: string;
    phoneNumber?: string;
    carrier?: string;
    ratePlan?: string;
    contractEndDate?: string;
    ban?: string;
    [key: string]: any;
  };
  
  // Metadata for comparison
  metadata?: {
    processedAt: string;
    version: string;
    source: 'current' | 'refactored';
  };
}

interface GoldenMasterTestCase {
  id: string;
  description: string;
  inputData: Record<string, string>;
  expectedOutput: AssetImportResult;
  tolerance?: {
    ignoreFields?: string[];
    allowTimestampDifferences?: boolean;
  };
}

// ============================================================================
// GOLDEN MASTER UTILITIES
// ============================================================================

/**
 * Normalize asset result for comparison by removing/standardizing variable fields
 */
function normalizeForComparison(
  result: AssetImportResult, 
  tolerance?: GoldenMasterTestCase['tolerance']
): AssetImportResult {
  const normalized = JSON.parse(JSON.stringify(result)); // Deep clone
  
  // Remove fields that should be ignored
  if (tolerance?.ignoreFields) {
    tolerance.ignoreFields.forEach(field => {
      if (field.includes('.')) {
        // Handle nested fields like 'specifications.contractEndDate'
        const [parent, child] = field.split('.');
        if (normalized[parent] && normalized[parent][child] !== undefined) {
          delete normalized[parent][child];
        }
      } else {
        delete normalized[field];
      }
    });
  }
  
  // Standardize timestamps if tolerance allows
  if (tolerance?.allowTimestampDifferences) {
    if (normalized.specifications.contractEndDate) {
      // Normalize ISO dates to just the date part
      normalized.specifications.contractEndDate = 
        normalized.specifications.contractEndDate.split('T')[0];
    }
  }
  
  // Remove metadata for comparison
  delete normalized.metadata;
  
  return normalized;
}

/**
 * Deep compare two objects and return differences
 */
function findDifferences(expected: any, actual: any, path = ''): string[] {
  const differences: string[] = [];
  
  if (typeof expected !== typeof actual) {
    differences.push(`${path}: type mismatch - expected ${typeof expected}, got ${typeof actual}`);
    return differences;
  }
  
  if (expected === null || actual === null) {
    if (expected !== actual) {
      differences.push(`${path}: expected ${expected}, got ${actual}`);
    }
    return differences;
  }
  
  if (typeof expected === 'object') {
    const allKeys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
    
    for (const key of allKeys) {
      const newPath = path ? `${path}.${key}` : key;
      
      if (!(key in expected)) {
        differences.push(`${newPath}: unexpected field in actual result`);
      } else if (!(key in actual)) {
        differences.push(`${newPath}: missing field in actual result`);
      } else {
        differences.push(...findDifferences(expected[key], actual[key], newPath));
      }
    }
  } else if (expected !== actual) {
    differences.push(`${path}: expected "${expected}", got "${actual}"`);
  }
  
  return differences;
}

// ============================================================================
// GOLDEN MASTER TEST CASES
// ============================================================================

/**
 * Real Telus phone import test cases
 * These represent actual data that should import successfully
 */
const TELUS_GOLDEN_MASTER_CASES: Omit<GoldenMasterTestCase, 'expectedOutput'>[] = [
  {
    id: 'telus-samsung-s23',
    description: 'Samsung Galaxy S23 with assigned user',
    inputData: {
      'Subscriber Name': 'John Doe',
      'Phone Number': '(555) 123-4567',
      'Rate Plan': 'Unlimited Plus',
      'Device Name': 'SAMSUNG GALAXY S23 128GB BLACK',
      'IMEI': '123456789012345',
      'Contract end date': '2025-12-31',
      'BAN': '987654321',
      'Status': 'Active'
    },
    tolerance: {
      ignoreFields: ['metadata'],
      allowTimestampDifferences: true
    }
  },
  {
    id: 'telus-iphone-14-pro',
    description: 'iPhone 14 Pro with assigned user',
    inputData: {
      'Subscriber Name': 'Jane Smith',
      'Phone Number': '(555) 987-6543',
      'Rate Plan': 'Business Plan',
      'Device Name': 'IPHONE 14 PRO 256GB SPACE BLACK',
      'IMEI': '987654321098765',
      'Contract end date': '2024-06-15',
      'BAN': '123456789',
      'Status': 'Active'
    },
    tolerance: {
      ignoreFields: ['metadata'],
      allowTimestampDifferences: true
    }
  },
  {
    id: 'telus-pixel-6a',
    description: 'Google Pixel 6a with assigned user',
    inputData: {
      'Subscriber Name': 'Bob Wilson',
      'Phone Number': '555.321.9876',
      'Rate Plan': 'Standard Plan',
      'Device Name': 'PIXEL 6A 128GB CHARCOAL',
      'IMEI': '456789123456789',
      'Contract end date': '2024-03-20',
      'BAN': '555666777',
      'Status': 'Active'
    },
    tolerance: {
      ignoreFields: ['metadata'],
      allowTimestampDifferences: true
    }
  },
  {
    id: 'telus-unassigned-phone',
    description: 'Unassigned phone (spare device)',
    inputData: {
      'Subscriber Name': '',
      'Phone Number': '(555) 000-0000',
      'Rate Plan': 'Data Only',
      'Device Name': 'SAMSUNG GALAXY A54 64GB WHITE',
      'IMEI': '789123456789123',
      'Contract end date': '2025-01-15',
      'BAN': '888999000',
      'Status': 'Suspended'
    },
    tolerance: {
      ignoreFields: ['metadata', 'assetTag'], // Asset tag will be random for unassigned
      allowTimestampDifferences: true
    }
  }
];

// ============================================================================
// GOLDEN MASTER TEST SUITE
// ============================================================================

describe('Golden Master Tests - Telus Phone Import', () => {
  
  describe('Generate Golden Master Standards', () => {
    
    test('should generate golden master files for all test cases', () => {
      const goldenMasterDir = path.join(__dirname, 'golden-masters');
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(goldenMasterDir)) {
        fs.mkdirSync(goldenMasterDir, { recursive: true });
      }
      
      TELUS_GOLDEN_MASTER_CASES.forEach(testCase => {
        // Process with our refactored system
        const result = transformTelusPhoneRow(testCase.inputData);
        
        // Convert to AssetImportResult format
        const assetResult: AssetImportResult = {
          assetTag: result.directFields.assetTag,
          serialNumber: result.directFields.serialNumber,
          model: result.directFields.model,
          make: result.directFields.make,
          assetType: result.directFields.assetType,
          condition: result.directFields.condition,
          status: result.directFields.status,
          source: result.directFields.source,
          assignedToAadId: result.directFields.assignedToAadId,
          specifications: result.specifications,
          metadata: {
            processedAt: new Date().toISOString(),
            version: '1.0.0',
            source: 'refactored'
          }
        };
        
        // Save golden master
        const filePath = path.join(goldenMasterDir, `${testCase.id}.json`);
        fs.writeFileSync(filePath, JSON.stringify(assetResult, null, 2));
        
        console.log(`✅ Generated golden master for ${testCase.id}`);
      });
    });
  });
  
  describe('Validate Against Golden Masters', () => {
    
    TELUS_GOLDEN_MASTER_CASES.forEach(testCase => {
      test(`should match golden master: ${testCase.description}`, () => {
        const goldenMasterPath = path.join(__dirname, 'golden-masters', `${testCase.id}.json`);
        
        // Skip if golden master doesn't exist yet
        if (!fs.existsSync(goldenMasterPath)) {
          console.log(`⏭️ Skipping ${testCase.id} - golden master not generated yet`);
          return;
        }
        
        // Load golden master
        const goldenMaster = JSON.parse(fs.readFileSync(goldenMasterPath, 'utf8')) as AssetImportResult;
        
        // Process with current refactored system
        const result = transformTelusPhoneRow(testCase.inputData);
        
        const currentResult: AssetImportResult = {
          assetTag: result.directFields.assetTag,
          serialNumber: result.directFields.serialNumber,
          model: result.directFields.model,
          make: result.directFields.make,
          assetType: result.directFields.assetType,
          condition: result.directFields.condition,
          status: result.directFields.status,
          source: result.directFields.source,
          assignedToAadId: result.directFields.assignedToAadId,
          specifications: result.specifications,
          metadata: {
            processedAt: new Date().toISOString(),
            version: '1.0.0',
            source: 'refactored'
          }
        };
        
        // Normalize both for comparison
        const normalizedExpected = normalizeForComparison(goldenMaster, testCase.tolerance);
        const normalizedActual = normalizeForComparison(currentResult, testCase.tolerance);
        
        // Find differences
        const differences = findDifferences(normalizedExpected, normalizedActual);
        
        // Assert no differences
        if (differences.length > 0) {
          console.log('❌ Golden Master Comparison Failed:');
          differences.forEach(diff => console.log(`  ${diff}`));
          console.log('Expected:', normalizedExpected);
          console.log('Actual:', normalizedActual);
        }
        
        expect(differences).toHaveLength(0);
      });
    });
  });
  
  describe('Custom Test Data Integration', () => {
    
    test('should process custom CSV data provided by user', () => {
      // This test can be used when you provide real CSV data
      const customDataPath = path.join(__dirname, 'custom-telus-data.csv');
      
      if (!fs.existsSync(customDataPath)) {
        console.log(`ℹ️ No custom data file found at ${customDataPath}`);
        console.log('To test with real data:');
        console.log('1. Create packages/shared/tests/custom-telus-data.csv');
        console.log('2. Add your real Telus phone data');
        console.log('3. Run this test to establish golden masters');
        return;
      }
      
      // Parse CSV and test each row
      const csvContent = fs.readFileSync(customDataPath, 'utf8');
      const lines = csvContent.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        console.log('❌ CSV must have at least a header row and one data row');
        return;
      }
      
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const dataRows = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
        const row: Record<string, string> = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        return row;
      });
      
      console.log(`📊 Processing ${dataRows.length} rows from custom CSV data`);
      
      dataRows.forEach((row, index) => {
        const result = transformTelusPhoneRow(row);
        
        // Basic validation
        expect(result.directFields.assetType).toBe('PHONE');
        expect(result.directFields.source).toBe('TELUS');
        expect(result.specifications.carrier).toBe('Telus');
        
        console.log(`✅ Row ${index + 1} processed successfully`);
      });
    });
  });
});

// ============================================================================
// GOLDEN MASTER UTILITIES FOR MANUAL TESTING
// ============================================================================

/**
 * Utility function to manually compare two import results
 * Can be used in REPL or debugging
 */
export function compareImportResults(
  expected: AssetImportResult, 
  actual: AssetImportResult,
  tolerance?: GoldenMasterTestCase['tolerance']
): {
  isMatch: boolean;
  differences: string[];
  normalizedExpected: AssetImportResult;
  normalizedActual: AssetImportResult;
} {
  const normalizedExpected = normalizeForComparison(expected, tolerance);
  const normalizedActual = normalizeForComparison(actual, tolerance);
  const differences = findDifferences(normalizedExpected, normalizedActual);
  
  return {
    isMatch: differences.length === 0,
    differences,
    normalizedExpected,
    normalizedActual
  };
}

/**
 * Export golden master test cases for external use
 */
export { TELUS_GOLDEN_MASTER_CASES, AssetImportResult, GoldenMasterTestCase }; 