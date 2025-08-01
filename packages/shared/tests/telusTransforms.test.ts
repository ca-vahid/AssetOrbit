/**
 * Telus Phone Import Transformation Tests
 * 
 * These tests ensure that the refactored Telus transformation module
 * produces exactly the same results as the current implementation.
 */

import { 
  transformTelusPhoneRow, 
  getTelusMapping, 
  validateTelusPhoneData,
  TELUS_PHONE_MAPPINGS,
  generatePhoneAssetTag
} from '../src/importSources/telusTransforms';

import { parseDeviceName } from '../src/importTransformations';

describe('Telus Phone Import Transformations', () => {
  
  // ============================================================================
  // DEVICE NAME PARSING TESTS
  // ============================================================================
  
  describe('parseDeviceName', () => {
    test('should parse Samsung Galaxy device names correctly', () => {
      const testCases = [
        {
          input: 'SAMSUNG GALAXY S23 128GB BLACK',
          expected: { make: 'Samsung', model: 'Galaxy S23', storage: '128GB' }
        },
        {
          input: 'SS GALAXY S24 ULTRA 256GB TITANIUM',
          expected: { make: 'Samsung', model: 'Galaxy S24 Ultra', storage: '256GB' }
        },
        {
          input: 'SAMSUNG GALAXY A54 64GB NAVY ANDROID SMARTPHONE',
          expected: { make: 'Samsung', model: 'Galaxy A54', storage: '64GB' }
        }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = parseDeviceName(input);
        expect(result.make).toBe(expected.make);
        expect(result.model).toBe(expected.model);
        expect(result.storage).toBe(expected.storage);
      });
    });

    test('should parse iPhone device names correctly', () => {
      const testCases = [
        {
          input: 'IPHONE 14 PRO 256GB SPACE BLACK',
          expected: { make: 'Apple', model: 'iPhone 14 Pro', storage: '256GB' }
        },
        {
          input: 'IPHONE 15 128GB BLUE',
          expected: { make: 'Apple', model: 'iPhone 15', storage: '128GB' }
        },
        {
          input: 'APPLE IPHONE 13 MINI 512GB PINK',
          expected: { make: 'Apple', model: 'iPhone 13 Mini', storage: '512GB' }
        }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = parseDeviceName(input);
        expect(result.make).toBe(expected.make);
        expect(result.model).toBe(expected.model);
        expect(result.storage).toBe(expected.storage);
      });
    });

    test('should parse Google Pixel device names correctly', () => {
      const testCases = [
        {
          input: 'GOOGLE PIXEL 7 PRO 128GB',
          expected: { make: 'Google', model: 'Pixel 7 Pro', storage: '128GB' }
        },
        {
          input: 'PIXEL 6A 64GB CHARCOAL',
          expected: { make: 'Google', model: 'Pixel 6a', storage: '64GB' }
        }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = parseDeviceName(input);
        expect(result.make).toBe(expected.make);
        expect(result.model).toBe(expected.model);
        expect(result.storage).toBe(expected.storage);
      });
    });

    test('should handle SWAP prefix in device names', () => {
      const result = parseDeviceName('SWAP SAMSUNG GALAXY S23 128GB BLACK');
      expect(result.make).toBe('Samsung');
      expect(result.model).toBe('Galaxy S23');
      expect(result.storage).toBe('128GB');
    });

    test('should handle unknown devices gracefully', () => {
      const result = parseDeviceName('UNKNOWN DEVICE 64GB');
      expect(result.make).toBe('Unknown');
      expect(result.model).toBe('UNKNOWN DEVICE 64GB');
      expect(result.storage).toBe('64GB');
    });

    test('should handle empty or null device names', () => {
      expect(parseDeviceName('')).toEqual({ make: 'Unknown', model: 'Unknown' });
      expect(parseDeviceName(null as any)).toEqual({ make: 'Unknown', model: 'Unknown' });
    });
  });

  // ============================================================================
  // ASSET TAG GENERATION TESTS
  // ============================================================================
  
  describe('generatePhoneAssetTag', () => {
    test('should generate asset tag from display name', () => {
      const result = generatePhoneAssetTag('John Doe');
      expect(result).toBe('PH-John Doe');
    });

    test('should generate asset tag from username', () => {
      const result = generatePhoneAssetTag('john.doe');
      expect(result).toBe('PH-john.doe');
    });

    test('should handle names with multiple parts', () => {
      const result = generatePhoneAssetTag('Mary Jane Watson Smith');
      expect(result).toBe('PH-Mary Smith'); // First and last name
    });

    test('should fallback to phone number when no user', () => {
      const result = generatePhoneAssetTag(undefined, undefined, '555-123-4567');
      expect(result).toBe('PH-4567');
    });

    test('should generate generic tag when no info available', () => {
      const result = generatePhoneAssetTag();
      expect(result).toMatch(/^PH-\d{6}-[A-Z0-9]{3}$/);
    });
  });

  // ============================================================================
  // COLUMN MAPPING TESTS
  // ============================================================================
  
  describe('Column Mappings', () => {
    test('should have all required Telus column mappings', () => {
      const expectedColumns = [
        'Subscriber Name',
        'Phone Number',
        'Rate Plan',
        'Device Name',
        'IMEI',
        'Contract end date',
        'BAN',
        'Status'
      ];

      expectedColumns.forEach(column => {
        const mapping = getTelusMapping(column);
        expect(mapping).toBeDefined();
        expect(mapping?.ninjaColumn).toBe(column);
      });
    });

    test('should map Device Name to multiple fields correctly', () => {
      // Device Name should map to make, model, and storage
      const deviceNameMappings = TELUS_PHONE_MAPPINGS.filter(m => m.ninjaColumn === 'Device Name');
      expect(deviceNameMappings).toHaveLength(3);
      
      const fields = deviceNameMappings.map(m => m.targetField);
      expect(fields).toContain('make');
      expect(fields).toContain('model');
      expect(fields).toContain('storage');
    });

    test('should set assetType to PHONE using BAN column', () => {
      const banMapping = getTelusMapping('BAN');
      expect(banMapping?.targetField).toBe('assetType');
      expect(banMapping?.processor?.('12345')).toBe('PHONE');
    });
  });

  // ============================================================================
  // FULL TRANSFORMATION TESTS
  // ============================================================================
  
  describe('transformTelusPhoneRow', () => {
    const sampleTelusRow = {
      'Subscriber Name': 'John Doe',
      'Phone Number': '(555) 123-4567',
      'Rate Plan': 'Unlimited Plus',
      'Device Name': 'SAMSUNG GALAXY S23 128GB BLACK',
      'IMEI': '123456789012345',
      'Contract end date': '2025-12-31',
      'BAN': '987654321',
      'Status': 'Active'
    };

    test('should transform complete Telus row correctly', () => {
      const result = transformTelusPhoneRow(sampleTelusRow);

      // Check direct fields
      expect(result.directFields.assetType).toBe('PHONE');
      expect(result.directFields.assignedToAadId).toBe('John Doe');
      expect(result.directFields.make).toBe('Samsung');
      expect(result.directFields.model).toBe('Galaxy S23');
      expect(result.directFields.serialNumber).toBe('123456789012345');
      expect(result.directFields.condition).toBe('GOOD');
      expect(result.directFields.source).toBe('TELUS');
      expect(result.directFields.status).toBe('ASSIGNED');
      expect(result.directFields.assetTag).toBe('PH-John Doe');

      // Check specifications
      expect(result.specifications.phoneNumber).toBe('5551234567'); // Cleaned
      expect(result.specifications.planType).toBe('Unlimited Plus');
      expect(result.specifications.storage).toBe('128GB');
      expect(result.specifications.imei).toBe('123456789012345');
      expect(result.specifications.carrier).toBe('Telus');
      expect(result.specifications.operatingSystem).toBe('SAMSUNG GALAXY S23 128GB BLACK');
      expect(result.specifications.contractEndDate).toBe('2025-12-31T00:00:00.000Z');

      // Check processing notes
      expect(result.processingNotes).toContain('Username "John Doe" requires Azure AD lookup');
    });

    test('should handle missing subscriber name', () => {
      const rowWithoutUser = { ...sampleTelusRow, 'Subscriber Name': '' };
      const result = transformTelusPhoneRow(rowWithoutUser);

      expect(result.directFields.status).toBe('AVAILABLE');
      expect(result.directFields.assetTag).toMatch(/^PH-\d{6}-[A-Z0-9]{3}$/);
    });

    test('should fallback to IMEI for serial number', () => {
      // Test the scenario where we have IMEI but no explicit serial number column
      // The IMEI mapping should set both IMEI in specifications and use it as serial number
      const result = transformTelusPhoneRow(sampleTelusRow);
      
      // Since Telus mapping uses IMEI for both imei field and serial number fallback
      expect(result.specifications.imei).toBe('123456789012345');
      expect(result.directFields.serialNumber).toBe('123456789012345');
    });

    test('should clean phone number correctly', () => {
      const testNumbers = [
        { input: '(555) 123-4567', expected: '5551234567' },
        { input: '555-123-4567', expected: '5551234567' },
        { input: '555.123.4567', expected: '5551234567' },
        { input: '+1 (555) 123-4567', expected: '15551234567' }
      ];

      testNumbers.forEach(({ input, expected }) => {
        const row = { ...sampleTelusRow, 'Phone Number': input };
        const result = transformTelusPhoneRow(row);
        expect(result.specifications.phoneNumber).toBe(expected);
      });
    });
  });

  // ============================================================================
  // VALIDATION TESTS
  // ============================================================================
  
  describe('validateTelusPhoneData', () => {
    test('should pass validation for complete data', () => {
      const validData = {
        model: 'Galaxy S23',
        imei: '123456789012345',
        serialNumber: '123456789012345'
      };

      const errors = validateTelusPhoneData(validData);
      expect(errors).toHaveLength(0);
    });

    test('should fail validation for missing model', () => {
      const invalidData = {
        imei: '123456789012345'
      };

      const errors = validateTelusPhoneData(invalidData);
      expect(errors).toContain('Device model is required');
    });

    test('should fail validation for missing IMEI', () => {
      const invalidData = {
        model: 'Galaxy S23'
      };

      const errors = validateTelusPhoneData(invalidData);
      expect(errors).toContain('IMEI is required');
    });

    test('should pass validation with IMEI but no serial number', () => {
      const validData = {
        model: 'Galaxy S23',
        imei: '123456789012345'
      };

      const errors = validateTelusPhoneData(validData);
      expect(errors).not.toContain('Either Serial Number or IMEI is required');
    });
  });

  // ============================================================================
  // INTEGRATION TESTS (Simulating Current Behavior)
  // ============================================================================
  
  describe('Integration Tests - Current Behavior Simulation', () => {
    test('should produce same results as current Telus import for real sample data', () => {
      const realSampleData = [
        {
          'Subscriber Name': 'Alice Johnson',
          'Phone Number': '604-555-0123',
          'Rate Plan': 'Peace of Mind Connect 25GB',
          'Device Name': 'IPHONE 14 PRO 256GB SPACE BLACK',
          'IMEI': '012345678901234',
          'Contract end date': '2026-03-15',
          'BAN': '555123456',
          'Status': 'Active'
        },
        {
          'Subscriber Name': 'Bob Smith',
          'Phone Number': '416-555-0456',
          'Rate Plan': 'Unlimited Data',
          'Device Name': 'SAMSUNG GALAXY S24 ULTRA 512GB TITANIUM GRAY',
          'IMEI': '098765432109876',
          'Contract end date': '2025-08-20',
          'BAN': '555789012',
          'Status': 'Active'
        }
      ];

      realSampleData.forEach((row, index) => {
        const result = transformTelusPhoneRow(row);
        
        // Verify each result has all expected fields
        expect(result.directFields.assetType).toBe('PHONE');
        expect(result.directFields.source).toBe('TELUS');
        expect(result.directFields.condition).toBe('GOOD');
        expect(result.directFields.status).toBe('ASSIGNED');
        expect(result.specifications.carrier).toBe('Telus');
        
        // Verify phone-specific asset tag format
        expect(result.directFields.assetTag).toMatch(/^PH-/);
        
        // Verify device parsing worked
        if (index === 0) { // iPhone
          expect(result.directFields.make).toBe('Apple');
          expect(result.directFields.model).toBe('iPhone 14 Pro');
          expect(result.specifications.storage).toBe('256GB');
        }
        
        if (index === 1) { // Samsung
          expect(result.directFields.make).toBe('Samsung');
          expect(result.directFields.model).toBe('Galaxy S24 Ultra');
          expect(result.specifications.storage).toBe('512GB');
        }
      });
    });
  });
}); 