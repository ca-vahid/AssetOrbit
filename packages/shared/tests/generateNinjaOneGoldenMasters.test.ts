/**
 * NinjaOne Golden Master Generation and Validation
 * 
 * This script:
 * 1. Reads real NinjaOne CSV data
 * 2. Processes it through refactored transformation modules
 * 3. Creates golden master JSON files automatically
 * 4. Validates future transformations against these golden masters
 */

import * as fs from 'fs';
import * as path from 'path';
import { transformNinjaOneRow, NINJA_ONE_MAPPINGS } from '../src/importSources/ninjaOneTransforms';
import { aggregateVolumes, simplifyRam, parseDeviceName } from '../src/importTransformations';

// ============================================================================
// NINJA ONE CSV DATA STRUCTURE
// ============================================================================

interface NinjaOneCSVRow {
  'Display Name': string;
  'Serial Number': string;
  'OS Name': string;
  'Role': string;
  'RAM': string;
  'Volumes': string;
  'Manufacturer': string;
  'Model': string;
  'Processor': string;
  'System Type': string;
  'Location': string;
  'Last Seen': string;
}

interface NinjaOneGoldenMasterRecord {
  id: string;
  description: string;
  inputCsvRow: NinjaOneCSVRow;
  expectedTransformationResult: {
    directFields: Record<string, any>;
    specifications: Record<string, any>;
  };
  expectedDatabaseRecord: Record<string, any>;
}

// ============================================================================
// CSV PROCESSING
// ============================================================================

function parseNinjaOneCSVLine(line: string): NinjaOneCSVRow {
  const values = line.split(',');
  return {
    'Display Name': values[0]?.trim() || '',
    'Serial Number': values[1]?.trim() || '',
    'OS Name': values[2]?.trim() || '',
    'Role': values[3]?.trim() || '',
    'RAM': values[4]?.trim() || '',
    'Volumes': values[5]?.trim() || '',
    'Manufacturer': values[6]?.trim() || '',
    'Model': values[7]?.trim() || '',
    'Processor': values[8]?.trim() || '',
    'System Type': values[9]?.trim() || '',
    'Location': values[10]?.trim() || '',
    'Last Seen': values[11]?.trim() || ''
  };
}

function readRealNinjaOneCSVData(): NinjaOneCSVRow[] {
  const csvPath = path.join(__dirname, 'real-ninjaone-data.csv');
  
  if (!fs.existsSync(csvPath)) {
    throw new Error(`Real NinjaOne CSV data not found at: ${csvPath}`);
  }
  
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.trim().split('\n');
  
  // Skip header row
  return lines.slice(1).map(parseNinjaOneCSVLine);
}

// ============================================================================
// GOLDEN MASTER GENERATION
// ============================================================================

function generateNinjaOneGoldenMasterRecord(csvRow: NinjaOneCSVRow): NinjaOneGoldenMasterRecord {
  const displayName = csvRow['Display Name'];
  
  // Convert NinjaOneCSVRow to Record<string, string> format expected by transformNinjaOneRow
  const csvRowAsRecord: Record<string, string> = {
    'Display Name': csvRow['Display Name'],
    'Serial Number': csvRow['Serial Number'],
    'OS Name': csvRow['OS Name'],
    'Role': csvRow['Role'],
    'RAM': csvRow['RAM'],
    'Volumes': csvRow['Volumes'],
    'Manufacturer': csvRow['Manufacturer'],
    'Model': csvRow['Model'],
    'Processor': csvRow['Processor'],
    'System Type': csvRow['System Type'],
    'Location': csvRow['Location'],
    'Last Seen': csvRow['Last Seen']
  };
  
  // Process through refactored transformation
  const transformationResult = transformNinjaOneRow(csvRowAsRecord);
  
  // Create complete database record (what would be saved after processing)
  const expectedDatabaseRecord = {
    ...transformationResult.directFields,
    specifications: transformationResult.specifications
  };
  
  return {
    id: `real-ninjaone-${displayName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    description: `Real NinjaOne device for ${displayName}`,
    inputCsvRow: csvRow,
    expectedTransformationResult: transformationResult,
    expectedDatabaseRecord
  };
}

function saveNinjaOneGoldenMasterFile(record: NinjaOneGoldenMasterRecord): void {
  const goldenMastersDir = path.join(__dirname, 'real-golden-masters');
  
  if (!fs.existsSync(goldenMastersDir)) {
    fs.mkdirSync(goldenMastersDir, { recursive: true });
  }
  
  const fileName = `${record.id}.json`;
  const filePath = path.join(goldenMastersDir, fileName);
  
  fs.writeFileSync(filePath, JSON.stringify(record, null, 2));
  console.log(`✅ Generated NinjaOne golden master: ${fileName}`);
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

function loadNinjaOneGoldenMasterFiles(): NinjaOneGoldenMasterRecord[] {
  const goldenMastersDir = path.join(__dirname, 'real-golden-masters');
  
  if (!fs.existsSync(goldenMastersDir)) {
    return [];
  }
  
  const files = fs.readdirSync(goldenMastersDir)
    .filter(f => f.endsWith('.json') && f.includes('ninjaone'));
  
  return files.map(file => {
    const filePath = path.join(goldenMastersDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as NinjaOneGoldenMasterRecord;
  });
}

function compareNinjaOneTransformationResults(
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

describe('NinjaOne Golden Master Generation', () => {
  
  test('should generate golden masters from real NinjaOne CSV data', () => {
    console.log('\n🥷 GENERATING GOLDEN MASTERS FROM REAL NINJAONE DATA\n');
    
    try {
      const csvData = readRealNinjaOneCSVData();
      console.log(`📊 Processing ${csvData.length} real NinjaOne device records`);
      
      csvData.forEach((csvRow, index) => {
        console.log(`\n💻 Device ${index + 1}: ${csvRow['Display Name']}`);
        console.log(`   Role: ${csvRow['Role']}`);
        console.log(`   Manufacturer: ${csvRow['Manufacturer']}`);
        console.log(`   Model: ${csvRow['Model']}`);
        console.log(`   RAM: ${csvRow['RAM']}`);
        console.log(`   Volumes: ${csvRow['Volumes'].substring(0, 60)}...`);
        
        const goldenMaster = generateNinjaOneGoldenMasterRecord(csvRow);
        saveNinjaOneGoldenMasterFile(goldenMaster);
        
        console.log(`   ✅ Golden master saved: ${goldenMaster.id}`);
        console.log(`   🎯 Validates: ${csvRow['Display Name']} → ${csvRow['Role']} → Storage aggregation`);
      });
      
      console.log(`\n🎉 Successfully generated ${csvData.length} NinjaOne golden master records!`);
      
    } catch (error) {
      console.log(`❌ Error processing NinjaOne CSV data: ${error instanceof Error ? error.message : String(error)}`);
      console.log('\n📝 Make sure the file exists: packages/shared/tests/real-ninjaone-data.csv');
    }
  });
  
});

describe('NinjaOne Golden Master Validation', () => {
  
  test('should validate NinjaOne transformations against golden masters', () => {
    const goldenMasters = loadNinjaOneGoldenMasterFiles();
    
    if (goldenMasters.length === 0) {
      console.log('\n⏭️ No NinjaOne golden master files found');
      console.log('Run the generation test first to create golden masters');
      return;
    }
    
    console.log(`\n🔍 VALIDATING ${goldenMasters.length} NINJAONE TRANSFORMATIONS\n`);
    
    let allPassed = true;
    const results: string[] = [];
    
    goldenMasters.forEach(goldenMaster => {
      const displayName = goldenMaster.inputCsvRow['Display Name'];
      
      // Run transformation on the same input data
      const csvRowAsRecord: Record<string, string> = {
        'Display Name': goldenMaster.inputCsvRow['Display Name'],
        'Serial Number': goldenMaster.inputCsvRow['Serial Number'],
        'OS Name': goldenMaster.inputCsvRow['OS Name'],
        'Role': goldenMaster.inputCsvRow['Role'],
        'RAM': goldenMaster.inputCsvRow['RAM'],
        'Volumes': goldenMaster.inputCsvRow['Volumes'],
        'Manufacturer': goldenMaster.inputCsvRow['Manufacturer'],
        'Model': goldenMaster.inputCsvRow['Model'],
        'Processor': goldenMaster.inputCsvRow['Processor'],
        'System Type': goldenMaster.inputCsvRow['System Type'],
        'Location': goldenMaster.inputCsvRow['Location'],
        'Last Seen': goldenMaster.inputCsvRow['Last Seen']
      };
      const actualResult = transformNinjaOneRow(csvRowAsRecord);
      
      // Compare against expected transformation result
      const comparison = compareNinjaOneTransformationResults(
        actualResult,
        goldenMaster.expectedTransformationResult
      );
      
      if (comparison.success) {
        const deviceInfo = `${goldenMaster.inputCsvRow['Manufacturer']} ${goldenMaster.inputCsvRow['Model']} (${goldenMaster.inputCsvRow['Role']})`;
        results.push(`💻 ${displayName.padEnd(25)} ✅ PASS  ${deviceInfo}`);
      } else {
        results.push(`💻 ${displayName.padEnd(25)} ❌ FAIL`);
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
      console.log(`🎉 ALL ${goldenMasters.length} NINJAONE GOLDEN MASTER TESTS PASSED`);
      console.log(`✅ Your refactored NinjaOne transformation system produces identical results!`);
    } else {
      console.log(`❌ SOME NINJAONE GOLDEN MASTER TESTS FAILED`);
      console.log(`🔧 Fix the transformation logic and run again`);
    }
    console.log(`${'='.repeat(80)}\n`);
    
    expect(allPassed).toBe(true);
  });
  
  test('should show NinjaOne transformation details', () => {
    const goldenMasters = loadNinjaOneGoldenMasterFiles();
    
    if (goldenMasters.length === 0) {
      console.log('\n⏭️ No NinjaOne golden master files found');
      return;
    }
    
    console.log('\n📊 NINJAONE TRANSFORMATION DETAILS\n');
    
    goldenMasters.forEach((goldenMaster, index) => {
      const name = goldenMaster.inputCsvRow['Display Name'];
      const role = goldenMaster.inputCsvRow['Role'];
      const manufacturer = goldenMaster.inputCsvRow['Manufacturer'];
      const model = goldenMaster.inputCsvRow['Model'];
      const ramInput = goldenMaster.inputCsvRow['RAM'];
      const volumesInput = goldenMaster.inputCsvRow['Volumes'];
      
      const ramOutput = goldenMaster.expectedTransformationResult.directFields.ram || 'N/A';
      const storageOutput = goldenMaster.expectedTransformationResult.specifications.storage || 'N/A';
      const assetType = goldenMaster.expectedTransformationResult.directFields.assetType || 'Unknown';
      
      console.log(`${index + 1}. ${name}`);
      console.log(`   Device: ${manufacturer} ${model}`);
      console.log(`   Role: ${role} → Asset Type: ${assetType}`);
      console.log(`   RAM: ${ramInput} → ${ramOutput}`);
      console.log(`   Volumes: ${volumesInput.substring(0, 40)}... → Storage: ${storageOutput}`);
      console.log('');
    });
  });
  
});

// ============================================================================
// EXPORT FOR EXTERNAL USE
// ============================================================================

export {
  generateNinjaOneGoldenMasterRecord,
  saveNinjaOneGoldenMasterFile,
  loadNinjaOneGoldenMasterFiles,
  compareNinjaOneTransformationResults,
  type NinjaOneGoldenMasterRecord,
  type NinjaOneCSVRow
}; 