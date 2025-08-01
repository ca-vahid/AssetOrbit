const fs = require('fs');
const path = require('path');

// Import the compiled modules
const { transformTelusPhoneRow } = require('../dist/importSources/telusTransforms');

// Sample test data
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
  }
];

console.log('🚀 Generating Golden Master Test Data...\n');

const outputDir = path.join(__dirname, '..', 'tests', 'golden-masters');

// Create output directory
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

SAMPLE_TELUS_DATA.forEach(testCase => {
  console.log(`📝 Processing: ${testCase.description}`);
  
  // Process through our refactored transformation
  const result = transformTelusPhoneRow(testCase.data);
  
  const goldenMaster = {
    id: testCase.id,
    description: testCase.description,
    inputData: testCase.data,
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
  
  const outputPath = path.join(outputDir, `${testCase.id}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(goldenMaster, null, 2));
  
  console.log(`✅ Generated: ${testCase.id}.json`);
  console.log(`   Asset Tag: ${goldenMaster.expectedOutput.assetTag}`);
  console.log(`   Device: ${goldenMaster.expectedOutput.make} ${goldenMaster.expectedOutput.model}`);
  console.log(`   Storage: ${goldenMaster.expectedOutput.specifications.storage || 'N/A'}`);
  console.log(`   IMEI: ${goldenMaster.expectedOutput.specifications.imei}`);
  console.log(`   Phone: ${goldenMaster.expectedOutput.specifications.phoneNumber}`);
  console.log('');
});

console.log('🎯 Golden Master generation complete!');
console.log(`📁 Files saved to: ${outputDir}`);
console.log('\n📖 Next steps:');
console.log('  1. Review the generated JSON files');
console.log('  2. Run tests with: npm test');
console.log('  3. Any differences will be flagged during testing'); 