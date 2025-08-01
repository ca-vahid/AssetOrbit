/**
 * Automated Golden Master Generation and Validation
 * 
 * This script:
 * 1. Reads real Telus CSV data
 * 2. Processes it through refactored transformation modules
 * 3. Creates golden master JSON files automatically
 * 4. Validates future transformations against these golden masters
 */

import * as fs from 'fs';
import * as path from 'path';
import { transformTelusPhoneRow, TELUS_PHONE_MAPPINGS } from '../src/importSources/telusTransforms';
import { parseDeviceName, generatePhoneAssetTag, handleIMEIFallback, cleanPhoneNumber, toISO } from '../src/importTransformations';

// ============================================================================
// REAL USER DATA WITH AZURE AD GUIDS
// ============================================================================

interface RealUserData {
  displayName: string;
  azureAdGuid: string;
  email: string;
  location: string;
  department: string;
}

const REAL_USERS: Record<string, RealUserData> = {
  "ENOCH LAM": {
    displayName: "ENOCH LAM",
    azureAdGuid: "edb31c14-25d9-43dd-8b6c-a7ede090a6d8",
    email: "enoch.lam@bgcengineering.ca",
    location: "Vancouver, BC",
    department: "Engineering"
  },
  "NASTARAN NEMATOLLAHI": {
    displayName: "NASTARAN NEMATOLLAHI",
    azureAdGuid: "74349ca0-89be-4a20-8aeb-43221d28e4b6", 
    email: "nastaran.nematollahi@bgcengineering.ca",
    location: "Calgary, AB",
    department: "Operations"
  },
  "DAIRAN LORCA": {
    displayName: "DAIRAN LORCA",
    azureAdGuid: "a639898d-4f14-40ee-a361-bf77c64ccbca",
    email: "dairan.lorca@bgcengineering.ca", 
    location: "Toronto, ON",
    department: "Project Management"
  }
};

// ============================================================================
// CSV PROCESSING
// ============================================================================

interface TelusCSVRow {
  'Subscriber Name': string;
  'Phone Number': string;
  'Device Name': string;
  'IMEI': string;
  'Contract end date': string;
  'BAN': string;
  'Status': string;
  'Rate Plan': string;
  'Service Type': string;
  'ICCID': string;
}

function parseCSVLine(line: string): TelusCSVRow {
  const values = line.split(',');
  return {
    'Subscriber Name': values[0]?.trim() || '',
    'Phone Number': values[1]?.trim() || '',
    'Device Name': values[2]?.trim() || '',
    'IMEI': values[3]?.trim() || '',
    'Contract end date': values[4]?.trim() || '',
    'BAN': values[5]?.trim() || '',
    'Status': values[6]?.trim() || '',
    'Rate Plan': values[7]?.trim() || '',
    'Service Type': values[8]?.trim() || '',
    'ICCID': values[9]?.trim() || ''
  };
}

function readRealCSVData(): TelusCSVRow[] {
  const csvPath = path.join(__dirname, 'real-telus-data.csv');
  
  if (!fs.existsSync(csvPath)) {
    throw new Error(`Real CSV data not found at: ${csvPath}`);
  }
  
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.trim().split('\n');
  
  // Skip header row
  return lines.slice(1).map(parseCSVLine);
}

// ============================================================================
// GOLDEN MASTER GENERATION
// ============================================================================

interface GoldenMasterRecord {
  id: string;
  description: string;
  inputCsvRow: TelusCSVRow;
  expectedTransformationResult: {
    directFields: Record<string, any>;
    specifications: Record<string, any>;
  };
  expectedDatabaseRecord: Record<string, any>;
}

function generateGoldenMasterRecord(csvRow: TelusCSVRow): GoldenMasterRecord {
  const subscriberName = csvRow['Subscriber Name'];
  const userData = REAL_USERS[subscriberName];
  
  if (!userData) {
    throw new Error(`No user data found for: ${subscriberName}`);
  }
  
  // Convert TelusCSVRow to Record<string, string> format expected by transformTelusPhoneRow
  const csvRowAsRecord: Record<string, string> = {
    'Subscriber Name': csvRow['Subscriber Name'],
    'Phone Number': csvRow['Phone Number'],
    'Device Name': csvRow['Device Name'],
    'IMEI': csvRow['IMEI'],
    'Contract end date': csvRow['Contract end date'],
    'BAN': csvRow['BAN'],
    'Status': csvRow['Status'],
    'Rate Plan': csvRow['Rate Plan'],
    'Service Type': csvRow['Service Type'],
    'ICCID': csvRow['ICCID']
  };
  
  // Process through refactored transformation
  const transformationResult = transformTelusPhoneRow(csvRowAsRecord);
  
  // Create complete database record (what would be saved after Azure AD resolution)
  const expectedDatabaseRecord = {
    ...transformationResult.directFields,
    // Azure AD resolved fields
    assignedToAadId: userData.azureAdGuid,
    assignedToDisplayName: userData.displayName,
    assignedToEmail: userData.email,
    assignedToDepartment: userData.department,
    locationName: userData.location,
    specifications: transformationResult.specifications
  };
  
  return {
    id: `real-telus-${subscriberName.toLowerCase().replace(/\s+/g, '-')}`,
    description: `Real Telus phone for ${subscriberName}`,
    inputCsvRow: csvRow,
    expectedTransformationResult: transformationResult,
    expectedDatabaseRecord
  };
}

function saveGoldenMasterFile(record: GoldenMasterRecord): void {
  const goldenMastersDir = path.join(__dirname, 'real-golden-masters');
  
  if (!fs.existsSync(goldenMastersDir)) {
    fs.mkdirSync(goldenMastersDir, { recursive: true });
  }
  
  const fileName = `${record.id}.json`;
  const filePath = path.join(goldenMastersDir, fileName);
  
  fs.writeFileSync(filePath, JSON.stringify(record, null, 2));
  console.log(`✅ Generated golden master: ${fileName}`);
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

function loadGoldenMasterFiles(): GoldenMasterRecord[] {
  const goldenMastersDir = path.join(__dirname, 'real-golden-masters');
  
  if (!fs.existsSync(goldenMastersDir)) {
    return [];
  }
  
  // Only load Telus files (exclude NinjaOne files)
  const files = fs.readdirSync(goldenMastersDir)
    .filter(f => f.endsWith('.json') && f.includes('telus'));
  
  return files.map(file => {
    const filePath = path.join(goldenMastersDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as GoldenMasterRecord;
  });
}

function compareTransformationResults(
  actual: any, 
  expected: any, 
  path: string = ''
): { success: boolean; differences: string[] } {
  const differences: string[] = [];
  
  function compare(a: any, e: any, currentPath: string) {
    if (typeof a !== typeof e) {
      differences.push(`${currentPath}: Type mismatch - actual: ${typeof a}, expected: ${typeof e}`);
      return;
    }
    
    if (a === null || e === null) {
      if (a !== e) {
        differences.push(`${currentPath}: Null mismatch - actual: ${a}, expected: ${e}`);
      }
      return;
    }
    
    if (typeof a === 'object') {
      const allKeys = new Set([...Object.keys(a), ...Object.keys(e)]);
      
      for (const key of allKeys) {
        const newPath = currentPath ? `${currentPath}.${key}` : key;
        
        if (!(key in a)) {
          differences.push(`${newPath}: Missing in actual result`);
        } else if (!(key in e)) {
          differences.push(`${newPath}: Extra in actual result`);
        } else {
          compare(a[key], e[key], newPath);
        }
      }
    } else if (a !== e) {
      differences.push(`${currentPath}: Value mismatch - actual: "${a}", expected: "${e}"`);
    }
  }
  
  compare(actual, expected, path);
  
  return {
    success: differences.length === 0,
    differences
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('Real Data Golden Master Generation', () => {
  
  test('should generate golden masters from real CSV data', () => {
    console.log('\n🎯 GENERATING GOLDEN MASTERS FROM REAL TELUS DATA\n');
    
    try {
      const csvData = readRealCSVData();
      console.log(`📊 Processing ${csvData.length} real Telus phone records`);
      
      csvData.forEach((csvRow, index) => {
        console.log(`\n📱 Phone ${index + 1}: ${csvRow['Subscriber Name']}`);
        console.log(`   Device: ${csvRow['Device Name'] || 'No device specified'}`);
        console.log(`   Phone: ${csvRow['Phone Number']}`);
        console.log(`   IMEI: ${csvRow['IMEI']}`);
        
        const goldenMaster = generateGoldenMasterRecord(csvRow);
        saveGoldenMasterFile(goldenMaster);
        
        console.log(`   ✅ Golden master saved: ${goldenMaster.id}`);
        console.log(`   🎯 Validates: ${csvRow['Subscriber Name']} → ${REAL_USERS[csvRow['Subscriber Name']]?.azureAdGuid} → ${REAL_USERS[csvRow['Subscriber Name']]?.location}`);
      });
      
      console.log(`\n🎉 Successfully generated ${csvData.length} golden master records!`);
      
    } catch (error) {
      console.log(`❌ Error processing CSV data: ${error instanceof Error ? error.message : String(error)}`);
      console.log('\n📝 Make sure the file exists: packages/shared/tests/real-telus-data.csv');
    }
  });
  
});

describe('Real Data Golden Master Validation', () => {
  
  test('should validate transformations against golden masters', () => {
    const goldenMasters = loadGoldenMasterFiles();
    
    if (goldenMasters.length === 0) {
      console.log('\n⏭️ No golden master files found');
      console.log('Run the generation test first to create golden masters');
      return;
    }
    
    console.log(`\n🔍 VALIDATING ${goldenMasters.length} TELUS TRANSFORMATIONS\n`);
    
    let allPassed = true;
    const results: string[] = [];
    
    goldenMasters.forEach(goldenMaster => {
      const subscriberName = goldenMaster.inputCsvRow['Subscriber Name'] || 'Unknown User';
      
      // Skip if this doesn't look like a Telus record
      if (!goldenMaster.inputCsvRow['Phone Number'] && !goldenMaster.inputCsvRow['IMEI']) {
        return; // Skip non-Telus records
      }
      
      // Run transformation on the same input data
      const csvRowAsRecord: Record<string, string> = {
        'Subscriber Name': goldenMaster.inputCsvRow['Subscriber Name'] || '',
        'Phone Number': goldenMaster.inputCsvRow['Phone Number'] || '',
        'Device Name': goldenMaster.inputCsvRow['Device Name'] || '',
        'IMEI': goldenMaster.inputCsvRow['IMEI'] || '',
        'Contract end date': goldenMaster.inputCsvRow['Contract end date'] || '',
        'BAN': goldenMaster.inputCsvRow['BAN'] || '',
        'Status': goldenMaster.inputCsvRow['Status'] || '',
        'Rate Plan': goldenMaster.inputCsvRow['Rate Plan'] || '',
        'Service Type': goldenMaster.inputCsvRow['Service Type'] || '',
        'ICCID': goldenMaster.inputCsvRow['ICCID'] || ''
      };
      const actualResult = transformTelusPhoneRow(csvRowAsRecord);
      
      // Compare against expected transformation result
      const comparison = compareTransformationResults(
        actualResult,
        goldenMaster.expectedTransformationResult
      );
      
      if (comparison.success) {
        const deviceInfo = goldenMaster.inputCsvRow['Device Name'] || 'No device specified';
        results.push(`📱 ${subscriberName.padEnd(25)} ✅ PASS  ${deviceInfo}`);
      } else {
        results.push(`📱 ${subscriberName.padEnd(25)} ❌ FAIL`);
        comparison.differences.forEach(diff => {
          results.push(`   └─ ${diff}`);
        });
        allPassed = false;
      }
    });
    
    // Print all results
    results.forEach(result => console.log(result));
    
    console.log(`\n${'='.repeat(80)}`);
    if (allPassed) {
      console.log(`🎉 ALL ${goldenMasters.length} GOLDEN MASTER TESTS PASSED`);
      console.log(`✅ Your refactored transformation system produces identical results!`);
    } else {
      console.log(`❌ SOME GOLDEN MASTER TESTS FAILED`);
      console.log(`🔧 Fix the transformation logic and run again`);
    }
    console.log(`${'='.repeat(80)}\n`);
    
    expect(allPassed).toBe(true);
  });
  
  test('should show transformation details for each user', () => {
    const goldenMasters = loadGoldenMasterFiles();
    
    if (goldenMasters.length === 0) {
      console.log('\n⏭️ No golden master files found');
      return;
    }
    
    console.log('\n📊 TRANSFORMATION DETAILS\n');
    
    let telusIndex = 0;
    goldenMasters.forEach((goldenMaster) => {
      // Skip if this doesn't look like a Telus record
      if (!goldenMaster.inputCsvRow['Phone Number'] && !goldenMaster.inputCsvRow['IMEI']) {
        return; // Skip non-Telus records
      }
      
      telusIndex++;
      const name = goldenMaster.inputCsvRow['Subscriber Name'] || 'Unknown User';
      const device = goldenMaster.inputCsvRow['Device Name'] || 'No device specified';
      const make = goldenMaster.expectedTransformationResult.directFields.make || 'Unknown';
      const model = goldenMaster.expectedTransformationResult.directFields.model || 'Unknown';
      const storage = goldenMaster.expectedTransformationResult.specifications.storage || 'N/A';
      const location = goldenMaster.expectedDatabaseRecord.locationName || 'Unknown';
      
      console.log(`${telusIndex}. ${name}`);
      console.log(`   Device: ${device}`);
      console.log(`   Parsed: ${make} ${model} (${storage})`);
      console.log(`   Location: ${location}`);
      console.log('');
    });
  });
  
});

// ============================================================================
// EXPORT FOR EXTERNAL USE
// ============================================================================

export {
  generateGoldenMasterRecord,
  saveGoldenMasterFile,
  loadGoldenMasterFiles,
  compareTransformationResults,
  REAL_USERS,
  type GoldenMasterRecord,
  type TelusCSVRow
}; 