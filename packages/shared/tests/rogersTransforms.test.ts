/**
 * Rogers Phone Import Transformation Tests
 */

// Jest is automatically available in the test environment
import { 
  transformRogersPhoneRow, 
  ROGERS_PHONE_MAPPINGS, 
  validateRogersPhoneData,
  parseRogersDeviceName
} from '../src/importSources/rogersTransforms';

describe('Rogers Phone Transformations', () => {
  
  describe('transformRogersPhoneRow', () => {
    it('should transform a complete Rogers phone row', () => {
      const mockRow = {
        'Account Number': '648594265',
        'Subscriber Number': '2049230039',
        'Usernames': 'FLIN FLON',
        'Commit Start Date': '2021-03-01',
        'Commit End Date': '2024-03-01',
        '# of Months Remaining': '10',
        'Early Cancellation Fee': '$451.39',
        'HUP Eligible (y/n)': 'Y',
        ' Applicable Pre-HUP ': '$284.72',
        'Available HUP Date(s)': '',
        'Price Plan Description': '$49.40 5GB Pooled Voice & Data (3-year)',
        'Status': 'Active',
        'IMEI': '358284140425941',
        'SIM Card': '89302720554000514090',
        'Device Description': 'S21 Grey - 128GB'
      };

      const result = transformRogersPhoneRow(mockRow);

      // Check direct fields
      expect(result.directFields.assetType).toBe('PHONE');
      expect(result.directFields.source).toBe('ROGERS');
      expect(result.directFields.condition).toBe('GOOD');
      expect(result.directFields.assignedToAadId).toBe('FLIN FLON');
      expect(result.directFields.serialNumber).toBe('358284140425941');
      expect(result.directFields.make).toBe('Samsung');
      expect(result.directFields.model).toBe('Galaxy S21');
      expect(result.directFields.status).toBe('ASSIGNED');
      expect(result.directFields.assetTag).toBe('PH-FLIN FLON');

      // Check specifications
      expect(result.specifications.carrier).toBe('Rogers');
      expect(result.specifications.phoneNumber).toBe('2049230039');
      expect(result.specifications.planType).toBe('$49.40 5GB Pooled Voice & Data (3-year)');
      expect(result.specifications.imei).toBe('358284140425941');
      expect(result.specifications.simCard).toBe('89302720554000514090');
      expect(result.specifications.storage).toBe('128GB');
      expect(result.specifications.hupEligible).toBe(true);
      expect(result.specifications.contractStartDate).toContain('2021-03-01');
      expect(result.specifications.contractEndDate).toContain('2024-03-01');
      expect(result.specifications.operatingSystem).toBe('S21 Grey - 128GB');
    });

    it('should handle minimal Rogers phone data', () => {
      const mockRow = {
        'Account Number': '648594265',
        'IMEI': '358284140425941',
        'Device Description': 'iPhone 14 Pro 256GB'
      };

      const result = transformRogersPhoneRow(mockRow);

      expect(result.directFields.assetType).toBe('PHONE');
      expect(result.directFields.source).toBe('ROGERS');
      expect(result.directFields.serialNumber).toBe('358284140425941');
      expect(result.directFields.make).toBe('Apple');
      expect(result.directFields.model).toBe('iPhone 14 Pro');
      expect(result.directFields.status).toBe('AVAILABLE'); // No user assigned
      expect(result.specifications.storage).toBe('256GB');
    });

    it('should handle HUP eligibility correctly', () => {
      const testCases = [
        { input: 'Y', expected: true },
        { input: 'yes', expected: true },
        { input: 'N', expected: false },
        { input: 'no', expected: false },
        { input: '', expected: null }
      ];

      testCases.forEach(({ input, expected }) => {
        const mockRow = {
          'Account Number': '648594265',
          'IMEI': '123456789',
          'Device Description': 'Test Device',
          'HUP Eligible (y/n)': input
        };

        const result = transformRogersPhoneRow(mockRow);
        expect(result.specifications.hupEligible).toBe(expected);
      });
    });
  });

  describe('validateRogersPhoneData', () => {
    it('should validate complete data successfully', () => {
      const data = {
        model: 'iPhone 14',
        imei: '123456789012345'
      };

      const errors = validateRogersPhoneData(data);
      expect(errors).toHaveLength(0);
    });

    it('should require model', () => {
      const data = {
        imei: '123456789012345'
      };

      const errors = validateRogersPhoneData(data);
      expect(errors).toContain('Device model is required');
    });

    it('should require IMEI', () => {
      const data = {
        model: 'iPhone 14'
      };

      const errors = validateRogersPhoneData(data);
      expect(errors).toContain('IMEI is required');
    });
  });

  describe('parseRogersDeviceName', () => {
    it('should parse iPhone correctly', () => {
      const result = parseRogersDeviceName('iPhone 14 Pro 256GB Space Black');
      expect(result.make).toBe('Apple');
      expect(result.model).toBe('iPhone 14 Pro');
      expect(result.storage).toBe('256GB');
    });

    it('should parse Samsung device correctly', () => {
      const result = parseRogersDeviceName('S21 Grey - 128GB');
      expect(result.make).toBe('Samsung');
      expect(result.model).toBe('Galaxy S21');
      expect(result.storage).toBe('128GB');
    });

    it('should handle unknown device', () => {
      const result = parseRogersDeviceName('Unknown Device Model');
      expect(result.make).toBe('Unknown');
      expect(result.model).toBe('Unknown Device Model');
    });
  });

  describe('ROGERS_PHONE_MAPPINGS', () => {
    it('should have required mappings', () => {
      const requiredColumns = [
        'Usernames',
        'Subscriber Number',
        'Device Description',
        'IMEI',
        'Account Number'
      ];

      requiredColumns.forEach(column => {
        const mapping = ROGERS_PHONE_MAPPINGS.find(m => m.ninjaColumn === column);
        expect(mapping).toBeDefined();
      });
    });

    it('should ignore specified columns', () => {
      const ignoredColumns = [
        'Status',
        '# of Months Remaining',
        'Early Cancellation Fee',
        ' Applicable Pre-HUP ',
        'Available HUP Date(s)'
      ];

      ignoredColumns.forEach(column => {
        const mapping = ROGERS_PHONE_MAPPINGS.find(m => m.ninjaColumn === column);
        expect(mapping?.targetType).toBe('ignore');
      });
    });
  });
});