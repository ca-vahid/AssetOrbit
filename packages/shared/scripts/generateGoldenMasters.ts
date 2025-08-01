#!/usr/bin/env node

/**
 * Generate Golden Master Test Data
 * 
 * This script generates golden master test data by processing real Telus phone data
 * through our refactored transformation modules and saving the expected outputs.
 * 
 * Usage:
 *   npm run generate-golden-masters
 *   
 * Or with custom CSV data:
 *   npm run generate-golden-masters -- --csv path/to/telus-data.csv
 */

import * as fs from 'fs';
import * as path from 'path';
import { transformTelusPhoneRow } from '../src/importSources/telusTransforms';

// Sample test data representing real Telus scenarios
const SAMPLE_TELUS_DATA = [
  {
    id: 'samsung-s23-assigned',
    description: 'Samsung Galaxy S23 with assigned user',
    data: {
      'Subscriber Name': 'John Doe',
      'Phone Number': '(555) 123-4567',
      'Rate Plan': 'Unlimited Plus',
      'Device Name': 'SAMSUNG GALAXY S23 128GB BLACK',
      'IMEI': '123456789012345',
      'Contract end date': '2025-12-31',
      'BAN': '987654321',
      'Status': 'Active'
    }
  },
  {
    id: 'iphone-14-pro-assigned',
    description: 'iPhone 14 Pro with assigned user',
    data: {
      'Subscriber Name': 'Jane Smith',
      'Phone Number': '(555) 987-6543',
      'Rate Plan': 'Business Plan',
      'Device Name': 'IPHONE 14 PRO 256GB SPACE BLACK',
      'IMEI': '987654321098765',
      'Contract end date': '2024-06-15',
      'BAN': '123456789',
      'Status': 'Active'
    }
  },
  {
    id: 'pixel-6a-assigned',
    description: 'Google Pixel 6a with assigned user',
    data: {
      'Subscriber Name': 'Bob Wilson',
      'Phone Number': '555.321.9876',
      'Rate Plan': 'Standard Plan',
      'Device Name': 'PIXEL 6A 128GB CHARCOAL',
      'IMEI': '456789123456789',
      'Contract end date': '2024-03-20',
      'BAN': '555666777',
      'Status': 'Active'
    }
  },
  {
    id: 'samsung-a54-unassigned',
    description: 'Unassigned Samsung Galaxy A54 (spare)',
    data: {
      'Subscriber Name': '',
      'Phone Number': '(555) 000-0000',
      'Rate Plan': 'Data Only',
      'Device Name': 'SAMSUNG GALAXY A54 64GB WHITE',
      'IMEI': '789123456789123',
      'Contract end date': '2025-01-15',
      'BAN': '888999000',
      'Status': 'Suspended'
    }
  }
];

interface GoldenMasterRecord {
  id: string;
  description: string;
  inputData: Record<string, string>;
  expectedOutput: {
    // Direct fields
    assetTag?: string;
    serialNumber?: string;
    model?: string;
    make?: string;
    assetType?: string;
    condition?: string;
    status?: string;
    source?: string;
    assignedToAadId?: string;
    
    // Specifications
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
  };
  metadata: {
    generatedAt: string;
    version: string;
    transformationModule: string;
  };
}

function generateGoldenMaster(id: string, description: string, inputData: Record<string, string>): GoldenMasterRecord {
  // Process through our refactored transformation
  const result = transformTelusPhoneRow(inputData);
  
  return {
    id,
    description,
    inputData,
    expectedOutput: {
      // Direct fields
      assetTag: result.directFields.assetTag,
      serialNumber: result.directFields.serialNumber,
      model: result.directFields.model,
      make: result.directFields.make,
      assetType: result.directFields.assetType,
      condition: result.directFields.condition,
      status: result.directFields.status,
      source: result.directFields.source,
      assignedToAadId: result.directFields.assignedToAadId,
      
      // Specifications
      specifications: result.specifications
    },
    metadata: {
      generatedAt: new Date().toISOString(),
      version: '1.0.0',
      transformationModule: 'telusTransforms'
    }
  };
}

function parseCsvFile(filePath: string): Array<Record<string, string>> {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').filter(line => line.trim());
  
  if (lines.length < 2) {
    throw new Error('CSV must have at least a header row and one data row');
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
  
  return dataRows;
}

function main() {
  const args = process.argv.slice(2);
  const csvPath = args.find(arg => arg.startsWith('--csv'))?.split('=')[1];
  
  const outputDir = path.join(__dirname, '..', 'tests', 'golden-masters');
  
  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  console.log('🚀 Generating Golden Master Test Data...\n');
  
  if (csvPath && fs.existsSync(csvPath)) {
    console.log(`📊 Processing custom CSV data from: ${csvPath}`);
    
    try {
      const csvData = parseCsvFile(csvPath);
      
      csvData.forEach((row, index) => {
        const id = `custom-row-${index + 1}`;
        const description = `Custom Telus data row ${index + 1}`;
        
        const goldenMaster = generateGoldenMaster(id, description, row);
        const outputPath = path.join(outputDir, `${id}.json`);
        
        fs.writeFileSync(outputPath, JSON.stringify(goldenMaster, null, 2));
        console.log(`✅ Generated: ${id}.json`);
      });
      
      console.log(`\n📈 Processed ${csvData.length} rows from custom CSV`);
    } catch (error) {
      console.error('❌ Error processing CSV:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  } else {
    console.log('📝 Processing sample test data...');
    
    SAMPLE_TELUS_DATA.forEach(testCase => {
      const goldenMaster = generateGoldenMaster(
        testCase.id,
        testCase.description,
        testCase.data
      );
      
      const outputPath = path.join(outputDir, `${testCase.id}.json`);
      fs.writeFileSync(outputPath, JSON.stringify(goldenMaster, null, 2));
      
      console.log(`✅ Generated: ${testCase.id}.json`);
      console.log(`   Description: ${testCase.description}`);
      console.log(`   Asset Tag: ${goldenMaster.expectedOutput.assetTag}`);
      console.log(`   Device: ${goldenMaster.expectedOutput.make} ${goldenMaster.expectedOutput.model}`);
      console.log(`   Storage: ${goldenMaster.expectedOutput.specifications.storage || 'N/A'}`);
      console.log(`   IMEI: ${goldenMaster.expectedOutput.specifications.imei}`);
      console.log('');
    });
  }
  
  console.log('🎯 Golden Master generation complete!');
  console.log(`📁 Files saved to: ${outputDir}`);
  console.log('\n📖 Usage:');
  console.log('  1. Review the generated JSON files');
  console.log('  2. Run tests with: npm test');
  console.log('  3. Any differences will be flagged during testing');
  console.log('\n💡 To use your own CSV data:');
  console.log('  npm run generate-golden-masters -- --csv=path/to/your-telus-data.csv');
}

if (require.main === module) {
  main();
} 