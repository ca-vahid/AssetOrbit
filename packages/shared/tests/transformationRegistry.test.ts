/**
 * Transformation Registry Integration Tests
 * 
 * These tests ensure that the transformation registry correctly coordinates
 * all import source modules and provides a unified interface.
 */

import {
  getImportTransformer,
  transformImportRow,
  getImportMappings,
  validateImportData,
  transformImportData,
  getSupportedImportSources,
  isImportSourceSupported
} from '../src/importSources/transformationRegistry';

describe('Transformation Registry', () => {
  
  // ============================================================================
  // REGISTRY INTERFACE TESTS
  // ============================================================================
  
  describe('Registry Interface', () => {
    test('should return all supported import sources', () => {
      const sources = getSupportedImportSources();
      expect(sources).toContain('ninjaone');
      expect(sources).toContain('telus');
      expect(sources).toContain('bgc-template');
    });

    test('should validate supported import sources correctly', () => {
      expect(isImportSourceSupported('ninjaone')).toBe(true);
      expect(isImportSourceSupported('telus')).toBe(true);
      expect(isImportSourceSupported('unknown-source')).toBe(false);
    });

    test('should throw error for unsupported source', () => {
      expect(() => getImportTransformer('unknown-source' as any)).toThrow(
        'Unsupported import source: unknown-source'
      );
    });
  });

  // ============================================================================
  // NINJAONE TRANSFORMATION TESTS
  // ============================================================================
  
  describe('NinjaOne Transformations', () => {
    const sampleNinjaRow = {
      'Display Name': 'BGC001234',
      'Role': 'WINDOWS_LAPTOP',
      'Serial Number': 'SN123456789',
      'Manufacturer': 'Dell',
      'Model': 'Latitude 7420',
      'RAM': '15.8',
      'Volumes': 'Type: "Fixed hard disk media" (C:) (476.84 GiB)',
      'OS Name': 'Windows 11 Enterprise Edition',
      'OS Architecture': '64-bit',
      'OS Build Number': '22631',
      'Last LoggedIn User': 'BGC\\john.doe'
    };

    test('should transform NinjaOne row correctly', () => {
      const result = transformImportRow('ninjaone', sampleNinjaRow);
      
      expect(result.directFields.assetTag).toBe('BGC001234');
      expect(result.directFields.assetType).toBe('LAPTOP');
      expect(result.directFields.serialNumber).toBe('SN123456789');
      expect(result.directFields.make).toBe('Dell');
      expect(result.directFields.model).toBe('Latitude 7420');
      expect(result.specifications.ram).toBe('16 GB'); // Rounded from 15.8 GiB
      expect(result.specifications.operatingSystem).toBe('Windows 11 Enterprise Edition');
      expect(result.specifications.osArchitecture).toBe('64-bit');
      expect(result.specifications.osBuildNumber).toBe('22631');
      expect(result.directFields.assignedToAadId).toBe('john.doe');
      expect(result.directFields.status).toBe('ASSIGNED');
    });

    test('should get NinjaOne mappings correctly', () => {
      const mappings = getImportMappings('ninjaone');
      expect(mappings.length).toBeGreaterThan(0);
      
      // Find specific mapping by column name
      const assetTagMapping = mappings.find(m => m.ninjaColumn === 'Display Name');
      expect(assetTagMapping?.targetField).toBe('assetTag');
    });

    // Note: Filtering functionality is handled within individual transform modules
    // rather than as a separate registry function
  });

  // ============================================================================
  // TELUS TRANSFORMATION TESTS
  // ============================================================================
  
  describe('Telus Transformations', () => {
    const sampleTelusRow = {
      'Subscriber Name': 'Jane Smith',
      'Phone Number': '555-123-4567',
      'Device Name': 'IPHONE 15 PRO 256GB TITANIUM',
      'IMEI': '123456789012345',
      'BAN': '987654321'
    };

    test('should transform Telus row correctly', () => {
      const result = transformImportRow('telus', sampleTelusRow);
      
      expect(result.directFields.assetType).toBe('PHONE');
      expect(result.directFields.make).toBe('Apple');
      expect(result.directFields.model).toBe('iPhone 15 Pro');
      expect(result.directFields.assignedToAadId).toBe('Jane Smith');
      expect(result.directFields.assetTag).toBe('PH-Jane Smith');
      expect(result.directFields.source).toBe('TELUS');
      expect(result.specifications.storage).toBe('256GB');
      expect(result.specifications.phoneNumber).toBe('5551234567');
    });
  });

  // ============================================================================
  // BGC TEMPLATE TRANSFORMATION TESTS
  // ============================================================================
  
  describe('BGC Template Transformations', () => {
    const sampleBGCRow = {
      'Service Tag': 'ABCD123456',
      'Brand ': 'Lenovo', // Note trailing space
      'Model': 'ThinkPad X1',
      'Asset Tag': '001234',
      'Device Type': 'laptop',
      'Status': 'active',
      'Assigned User': 'alice.wilson'
    };

    test('should transform BGC template row correctly', () => {
      const result = transformImportRow('bgc-template', sampleBGCRow);
      
      expect(result.directFields.serialNumber).toBe('ABCD123456');
      expect(result.directFields.make).toBe('Lenovo');
      expect(result.directFields.model).toBe('ThinkPad X1');
      expect(result.directFields.assetTag).toBe('BGC001234'); // Auto-prefixed
      expect(result.directFields.assetType).toBe('LAPTOP');
      expect(result.directFields.status).toBe('AVAILABLE');
      expect(result.directFields.assignedToAadId).toBe('alice.wilson');
      expect(result.directFields.source).toBe('EXCEL');
    });

    test('should handle brand column with trailing space', () => {
      const result = transformImportRow('bgc-template', sampleBGCRow);
      expect(result.directFields.make).toBe('Lenovo');
    });
  });

  // ============================================================================
  // BATCH TRANSFORMATION TESTS
  // ============================================================================
  
  describe('Batch Transformations', () => {
    test('should transform multiple rows correctly', () => {
      const testRows = [
        {
          'Subscriber Name': 'User 1',
          'Device Name': 'IPHONE 14 128GB',
          'IMEI': '111111111111111',
          'BAN': '123'
        },
        {
          'Subscriber Name': 'User 2',
          'Device Name': 'SAMSUNG GALAXY S23 256GB',
          'IMEI': '222222222222222',
          'BAN': '456'
        }
      ];

      const results = transformImportData('telus', testRows);
      expect(results).toHaveLength(2);
      
      expect(results[0].directFields.make).toBe('Apple');
      expect(results[1].directFields.make).toBe('Samsung');
    });
  });

  // ============================================================================
  // VALIDATION TESTS
  // ============================================================================
  
  describe('Data Validation', () => {
    test('should validate NinjaOne data', () => {
      const validData = { 
        assetTag: 'BGC001234', 
        serialNumber: 'SN123456789', 
        assetType: 'LAPTOP' 
      };
      const result = validateImportData('ninjaone', validData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);

      const invalidData = { assetTag: '', serialNumber: '' };
      const invalidResult = validateImportData('ninjaone', invalidData);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors.length).toBeGreaterThan(0);
    });

    test('should validate Telus data', () => {
      const validData = { 
        model: 'iPhone 15', 
        imei: '123456789012345' 
      };
      const result = validateImportData('telus', validData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);

      const invalidData = { model: '', imei: '' };
      const invalidResult = validateImportData('telus', invalidData);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // REGISTRY METADATA TESTS
  // ============================================================================
  
  describe('Registry Metadata', () => {
    test('should list all supported import sources', () => {
      const sources = getSupportedImportSources();
      expect(sources).toContain('telus');
      expect(sources).toContain('ninjaone');
      expect(sources).toContain('bgc-template');
    });
    
    test('should identify supported sources correctly', () => {
      expect(isImportSourceSupported('telus')).toBe(true);
      expect(isImportSourceSupported('ninjaone')).toBe(true);
      expect(isImportSourceSupported('invalid-source')).toBe(false);
    });
  });

  // ============================================================================
  // ERROR HANDLING TESTS
  // ============================================================================
  
  describe('Error Handling', () => {
    test('should handle malformed data gracefully', () => {
      const malformedRow = {
        'Device Name': null,
        'IMEI': undefined,
        'Phone Number': ''
      };

      const result = transformImportRow('telus', malformedRow as any);
      expect(result.validationErrors.length).toBeGreaterThan(0);
    });

    test('should handle processor errors gracefully', () => {
      const rowWithBadDate = {
        'Contract end date': 'not-a-date',
        'Device Name': 'IPHONE 15 128GB',
        'IMEI': '123456789012345',
        'BAN': '123'
      };

      const result = transformImportRow('telus', rowWithBadDate);
      // Should not throw, but may have processing notes about date parsing
      expect(result).toBeDefined();
    });
  });
}); 