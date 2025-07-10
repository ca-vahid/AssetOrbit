import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticateJwt, requireRole } from '../middleware/auth';
import { graphService } from '../services/graphService';
import { matchLocations } from '../utils/locationMatcher';
import prisma from '../services/database';
import logger from '../utils/logger';
import { Prisma } from '../generated/prisma';
import { USER_ROLES, ASSET_TYPES } from '../constants/index';

// Configuration for batch processing
const BATCH_SIZE = 25;

// Store for progress tracking
const progressStore = new Map<string, {
  total: number;
  processed: number;
  successful: number;
  failed: number;
  skipped: number;
  currentItem?: string;
  errors: Array<{ index: number; error: string; data?: any }>;
  skippedItems: Array<{ index: number; reason: string; data?: any }>;
  // Enhanced statistics
  categorizedAssets: Array<{ assetTag: string; categoryName: string; ruleName: string }>;
  uniqueUsers: Set<string>;
  uniqueLocations: Set<string>;
  assetTypeBreakdown: Record<string, number>;
  statusBreakdown: Record<string, number>;
}>();

// Utility: convert various date strings (or Excel serial numbers) to ISO 8601 string accepted by Prisma
function toISO(value: string): string | null {
  if (!value) return null;

  // Excel serial number (positive integer)
  if (/^\d+$/.test(value)) {
    const serial = parseInt(value, 10);
    const excelEpoch = new Date(Date.UTC(1899, 11, 30)); // Excel epoch (1900-01-00)
    const iso = new Date(excelEpoch.getTime() + serial * 86400000).toISOString();
    return iso;
  }

  // Add missing colon in timezone offset, e.g. "-0700" -> "-07:00"
  const cleaned = value.replace(/([\+\-]\d{2})(\d{2})$/, '$1:$2');
  const date = new Date(cleaned);
  return isNaN(date.getTime()) ? null : date.toISOString();
}

// Generate a unique session ID for progress tracking
function generateSessionId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Utility: get nested value from object using dot notation
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

// Utility: match a value against a workload category rule
function matchRule(value: any, rule: any): boolean {
  if (value === null || value === undefined) return false;
  
  const stringValue = String(value).toLowerCase();
  const ruleValue = String(rule.value).toLowerCase();
  
  switch (rule.operator) {
    case '=':
      return stringValue === ruleValue;
    case '!=':
      return stringValue !== ruleValue;
    case '>=':
      return Number(value) >= Number(rule.value);
    case '<=':
      return Number(value) <= Number(rule.value);
    case '>':
      return Number(value) > Number(rule.value);
    case '<':
      return Number(value) < Number(rule.value);
    case 'includes':
      return stringValue.includes(ruleValue);
    case 'regex':
      try {
        return new RegExp(rule.value, 'i').test(String(value));
      } catch (e) {
        logger.warn(`Invalid regex in workload rule: ${rule.value}`, e);
        return false;
      }
    default:
      logger.warn(`Unknown operator in workload rule: ${rule.operator}`);
      return false;
  }
}

// Utility: detect workload category for asset based on rules
async function detectWorkloadCategory(assetData: any, rules: any[]): Promise<string | null> {
  for (const rule of rules) {
    if (!rule.isActive) continue;
    
    const fieldValue = getNestedValue(assetData, rule.sourceField);
    
    if (matchRule(fieldValue, rule)) {
      logger.info(`Workload category detected: ${rule.category.name} (rule: ${rule.description || rule.sourceField + ' ' + rule.operator + ' ' + rule.value})`);
      return rule.categoryId;
    }
  }
  
  return null;
}

// Utility: round storage size to common denominations
function roundToCommonStorageSize(gib: number): string {
  if (gib > 3800) return '4 TB';
  if (gib > 1800) return '2 TB';
  if (gib > 900) return '1 TB';
  if (gib > 450) return '512 GB';
  if (gib > 230) return '256 GB';
  if (gib > 110) return '128 GB';
  if (gib > 50) return '64 GB';
  return `${Math.round(gib)} GB`;
}

// Utility: simplify raw memory value in GiB to nearest common size label
function simplifyRam(value: string): string | null {
  if (!value) return null;
  const gib = parseFloat(value);
  if (isNaN(gib)) return null;

  if (gib > 120) return '128 GB';
  if (gib > 90) return '96 GB';
  if (gib > 60) return '64 GB';
  if (gib > 30) return '32 GB';
  if (gib > 14) return '16 GB';
  if (gib > 6)  return '8 GB';
  if (gib > 2)  return '4 GB';
  return `${Math.round(gib)} GB`;
}

// Utility: aggregate NinjaOne "Volumes" column into a single rounded storage size label
function aggregateVolumes(value: string): string | null {
  if (!value) return null;
  const volumeRegex = /Type: "(.*?)"(?:[^\(]*)\((\d+\.?\d*)\s*GiB\)/g;
  let totalGib = 0;
  let match: RegExpExecArray | null;

  while ((match = volumeRegex.exec(value)) !== null) {
    const type = match[1];
    const capacity = parseFloat(match[2]);
    // Skip removable disks – we only want local storage
    if (type.toLowerCase() !== 'removable disk') {
      totalGib += capacity;
    }
  }

  return totalGib > 0 ? roundToCommonStorageSize(totalGib) : null;
}

// Phone device name parser for extracting make, model, and storage
function parseDeviceName(deviceName: string): { make: string; model: string; storage?: string } {
  if (!deviceName) {
    return { make: 'Unknown', model: 'Unknown' };
  }

  // Strip common noise prefixes first
  let normalized = deviceName.trim().toUpperCase();
  if (normalized.startsWith('SWAP ')) {
    normalized = normalized.substring(5);
  }

  // Helper to extract storage token and remove it from the string
  const storageMatch = normalized.match(/(\d+)(?:GB|TB)/);
  const storage = storageMatch ? `${storageMatch[1]}GB` : undefined;
  if (storageMatch) {
    normalized = normalized.replace(storageMatch[0], '').trim();
  }

  // Apple iPhone patterns
  if (normalized.includes('IPHONE')) {
    const make = 'Apple';
    
    // Extract iPhone model (e.g., "IPHONE 14 PRO 128GB SPACE BLACK" -> "iPhone 14 Pro")
    const iphoneMatch = normalized.match(/IPHONE\s+(\d+(?:\s+(?:PRO|PLUS|MINI|MAX))*)/);
    if (iphoneMatch) {
      const modelPart = iphoneMatch[1];
      const model = `iPhone ${modelPart.split(' ').map(word => 
        word.charAt(0) + word.slice(1).toLowerCase()
      ).join(' ')}`;
      
      // Use storage extracted at the top level
      return { make, model, storage };
    }
    
    return { make, model: 'iPhone', storage };
  }
  
  // Apple iPad patterns
  if (normalized.includes('IPAD')) {
    const make = 'Apple';

    // Remove APPLE prefix if present
    normalized = normalized.replace(/^APPLE\s+/, '');

    // Example variants: "IPAD PRO 10.5", "IPAD 6TH GEN", "IPAD AIR2"
    let modelPart = normalized;

    // Remove color / misc tokens
    modelPart = modelPart.replace(/SPACE|SPC|GRAY|GRY|GREY|SILVER|SLV|ARTL|TL|ML|AL|TI|BLK|MID|ROSE|GOLD/g, '').trim();

    // Title-case
    const model = modelPart.split(' ').filter(Boolean).map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');

    return { make, model, storage };
  }

  // Apple Watch patterns
  if (normalized.includes('WATCH')) {
    const make = 'Apple';

    normalized = normalized.replace(/^APPLE\s+/, '');

    let modelPart = normalized;
    modelPart = modelPart.replace(/ULTRA|SERIES|S\d|SE|TI|AL|MID|GPS|CELL|ARTL|TL|ML/g, match => {
      // Keep main identifiers like ULTRA or S7
      return match;
    });

    // Remove color tokens
    modelPart = modelPart.replace(/SPACE|SPC|GRAY|GRY|GREY|BLACK|BLK|MID|BLUE|RED|PINK|ORANGE|YELLOW|WHITE|SILVER|STAINLESS/g, '').trim();

    const model = modelPart.split(' ').filter(Boolean).map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');

    return { make, model, storage };
  }

  // Samsung prefixes "SS" or explicit SAMSUNG GALAXY
  if (normalized.startsWith('SS ')) {
    normalized = 'SAMSUNG ' + normalized.substring(3);
  }

  // Samsung Galaxy patterns
  if (normalized.includes('SAMSUNG') && normalized.includes('GALAXY')) {
    const make = 'Samsung';
    
    // Extract Galaxy model (e.g., "SAMSUNG GALAXY S25 256GB NAVY ANDROID SMARTPHONE" -> "Galaxy S25")
    const galaxyMatch = normalized.match(/GALAXY\s+([A-Z]\d+(?:\s+(?:PLUS|ULTRA|FE))*)/);
    if (galaxyMatch) {
      const modelPart = galaxyMatch[1];
      const model = `Galaxy ${modelPart.split(' ').map(word => 
        word.charAt(0) + word.slice(1).toLowerCase()
      ).join(' ')}`;
      
      // Use storage extracted at the top level
      return { make, model, storage };
    }
    
    return { make, model: 'Galaxy', storage };
  }
  
  // Google Pixel patterns
  if (normalized.includes('PIXEL')) {
    const make = 'Google';
    
    const pixelMatch = normalized.match(/PIXEL\s+(\d+(?:\s+(?:PRO|XL|A))*)/);
    if (pixelMatch) {
      const modelPart = pixelMatch[1];
      const model = `Pixel ${modelPart.split(' ').map(word => 
        word.charAt(0) + word.slice(1).toLowerCase()
      ).join(' ')}`;
      
      // Use storage extracted at the top level
      return { make, model, storage };
    }
    
    return { make, model: 'Pixel', storage };
  }
  
  // Generic fallback - try to extract make from first word
  const words = normalized.split(' ');
  if (words.length > 0) {
    const make = words[0].charAt(0) + words[0].slice(1).toLowerCase();
    const model = deviceName.trim(); // Keep original casing for model
    
    // storage already extracted earlier
 
    const result = { make, model, storage };
    return result;
  }

  const fallbackResult = { make: 'Unknown', model: deviceName.trim() };
  return fallbackResult;
}

// Process a batch of assets in parallel
async function processAssetBatch(
  assetBatch: Array<{ asset: Record<string, string>; index: number }>,
  columnMappings: Array<{
    ninjaColumn: string;
    targetField: string;
    isRequired: boolean;
    processor?: string;
  }>,
  conflictResolution: 'skip' | 'overwrite',
  source: string,
  trackingId: string,
  req: any,
  resolvedUserMap: Record<string, { id: string; displayName: string; officeLocation?: string } | null> = {},
  resolvedLocationMap: Record<string, string | null> = {}
): Promise<Array<{
  success: boolean;
  index: number;
  result?: { id: string; assetTag: string };
  error?: string;
  skipped?: boolean;
  statistics?: {
    assetType: string;
    status: string;
    assignedUser?: string;
    location?: string;
    categorized?: { assetTag: string; categoryName: string; ruleName: string } | null;
  };
}>> {
  
  // Load workload category rules once for the entire batch
  const workloadCategoryRules = await prisma.workloadCategoryRule.findMany({
    where: { isActive: true },
    include: { category: true },
    orderBy: { priority: 'asc' }
  });
  
  // Process all assets in the batch concurrently
  const batchPromises = assetBatch.map(async ({ asset: csvRow, index }) => {
    try {
      // Transform CSV row to asset data using column mappings
      const assetData: any = {
        customFields: {}
      };

      // Define which fields are direct Asset model fields
      const directAssetFields = [
        'assetTag', 'assetType', 'status', 'condition', 'make', 'model', 'serialNumber',
        'assignedToId', 'assignedToAadId', 'departmentId', 'locationId', 'purchaseDate', 
        'purchasePrice', 'vendorId', 'warrantyStartDate', 'warrantyEndDate', 'warrantyNotes', 'notes'
      ];

      // Specific fields that must be stored as ISO DateTime strings
      const dateFields = ['purchaseDate', 'warrantyStartDate', 'warrantyEndDate'];

      // Normalize asset type (e.g. convert "WINDOWS_DESKTOP" -> "DESKTOP")
      const roleToAssetTypeMap: Record<string, string> = {
        'WINDOWS_DESKTOP': ASSET_TYPES.DESKTOP,
        'WINDOWS_LAPTOP': ASSET_TYPES.LAPTOP,
        'MAC_DESKTOP': ASSET_TYPES.DESKTOP,
        'MAC_LAPTOP': ASSET_TYPES.LAPTOP,
        'LINUX_DESKTOP': ASSET_TYPES.DESKTOP,
        'LINUX_LAPTOP': ASSET_TYPES.LAPTOP,
        'WINDOWS_SERVER': 'SERVER',
        'LINUX_SERVER': 'SERVER',
        'HYPER-V_SERVER': 'SERVER',
        'VMWARE_SERVER': 'SERVER',
        'SERVER': 'SERVER',
        'TABLET': ASSET_TYPES.TABLET,
        'MOBILE': ASSET_TYPES.OTHER,
        'NETWORK_DEVICE': ASSET_TYPES.OTHER,
        'PRINTER': ASSET_TYPES.OTHER
      };

      // Apply column mappings
      for (const mapping of columnMappings) {
        const csvValue = csvRow[mapping.ninjaColumn];
        
        console.log(`🔧 Processing mapping: ${mapping.ninjaColumn} → ${mapping.targetField}`);
        console.log(`   CSV value: "${csvValue}"`);
        console.log(`   Processor: ${mapping.processor}`);
        
        // Handle required field validation – allow graceful fallback for certain cases
        if (!csvValue && mapping.isRequired) {
          // Relax requirement for `model` so that phone imports without Device Name still proceed
          if (mapping.targetField === 'model') {
            // Skip the missing value – will fallback to "Unknown" later
          } else {
            throw new Error(`Required field ${mapping.targetField} is missing`);
          }
        }

        if (csvValue) {
          // Pre-process certain fields that require transformation
          let transformedValue: any = csvValue;

          switch (mapping.targetField) {
            // Only transform asset type when the source column is NinjaOne "Role"
            case 'assetType':
              if (mapping.ninjaColumn === 'Role') {
                const upper = String(csvValue).toUpperCase().trim();
                transformedValue = roleToAssetTypeMap[upper] || 'OTHER';
              } else if (mapping.ninjaColumn === 'BAN') {
                // Telus phone imports map BAN → assetType = PHONE (constant)
                console.log(`   → Setting assetType to PHONE for Telus import`);
                transformedValue = ASSET_TYPES.PHONE;
              }
              break;
            case 'ram':
              transformedValue = simplifyRam(csvValue);
              break;
            case 'storage':
              // For Telus imports, use the frontend processor if available
              if (mapping.processor) {
                console.log(`   Using frontend processor for storage`);
                // Note: Frontend processor is a string, not a function
                // We'll need to handle this differently
                transformedValue = csvValue; // Keep original value for now
              } else {
                transformedValue = aggregateVolumes(csvValue);
              }
              break;
            case 'lastOnline':
              transformedValue = toISO(csvValue);
              break;
            default:
              // For direct date fields handled later via dateFields array
              transformedValue = csvValue;
          }

          // Handle different field types
          if (mapping.targetField.startsWith('cf_')) {
            // Custom field
            const customFieldId = mapping.targetField.substring(3);
            assetData.customFields[customFieldId] = transformedValue;
          } else if (directAssetFields.includes(mapping.targetField)) {
            // Direct Asset model field
            let val: any = transformedValue;
            if (dateFields.includes(mapping.targetField)) {
              val = toISO(String(transformedValue));
              if (!val) {
                continue; // Skip invalid date but keep processing
              }
            }
            assetData[mapping.targetField] = val;
          } else {
            // Everything else goes into specifications
            if (!assetData.specifications) {
              assetData.specifications = {};
            }
            console.log(`   → Adding to specifications: ${mapping.targetField} = "${transformedValue}"`);
            assetData.specifications[mapping.targetField] = transformedValue;
          }
        }
      }

      // If this is a phone import and serialNumber is empty, fallback to specifications.imei
      if ((!assetData.serialNumber || !assetData.serialNumber.trim()) &&
          assetData.assetType === ASSET_TYPES.PHONE &&
          assetData.specifications?.imei) {
        assetData.serialNumber = String(assetData.specifications.imei).trim();
      }

      // Require serial number after fallback attempt
      if (!assetData.serialNumber || !String(assetData.serialNumber).trim()) {
        return { success: false, index, skipped: true, error: 'Missing serial number' };
      }

      // Generate asset tag if not provided or ensure uniqueness
      if (!assetData.assetTag) {
        const prefix = assetData.assetType === 'LAPTOP' ? 'LT' : 
                      assetData.assetType === 'DESKTOP' ? 'DT' : 
                      assetData.assetType === 'PHONE' ? 'PH' : 'AS';
        const timestamp = Date.now().toString().slice(-6);
        const randomSuffix = Math.random().toString(36).substr(2, 3).toUpperCase();
        assetData.assetTag = `${prefix}-${timestamp}-${randomSuffix}-${(index + 1).toString().padStart(3, '0')}`;
      } else {
        // If asset tag is provided but might conflict, add a suffix
        const existingTagAsset = await prisma.asset.findFirst({
          where: { assetTag: assetData.assetTag }
        });
        if (existingTagAsset && conflictResolution !== 'overwrite') {
          const timestamp = Date.now().toString().slice(-6);
          const randomSuffix = Math.random().toString(36).substr(2, 3).toUpperCase();
          assetData.assetTag = `${assetData.assetTag}-${timestamp}-${randomSuffix}`;
        }
      }

      // Ensure BGC prefix on asset tags that are purely numeric or missing prefix (except for phones)
      if (assetData.assetType !== ASSET_TYPES.PHONE) {
        if (assetData.assetTag && /^[0-9]+$/.test(assetData.assetTag.trim())) {
          assetData.assetTag = `BGC${assetData.assetTag.trim().toUpperCase()}`;
        } else if (assetData.assetTag && !assetData.assetTag.toUpperCase().startsWith('BGC') && /^[A-Z0-9]+$/.test(assetData.assetTag.trim())) {
          // Covers cases like "4315" or "bgc4315" (lowercase)
          assetData.assetTag = `BGC${assetData.assetTag.trim().replace(/^bgc/i, '').toUpperCase()}`;
        }
      }

      // Set default values and ensure required fields are present
      assetData.condition = assetData.condition || 'GOOD';
      assetData.assetType = assetData.assetType || 'LAPTOP';
      assetData.make = assetData.make || 'Unknown';
      assetData.model = assetData.model || 'Unknown';
      assetData.source = source;

      // Phone-specific processing
      console.log(`🔍 Asset type check: ${assetData.assetType} (PHONE = ${ASSET_TYPES.PHONE})`);
      if (assetData.assetType === ASSET_TYPES.PHONE) {
        console.log(`📱 Phone processing triggered for asset type: ${assetData.assetType}`);
        // Extract make and storage from device name if model is available
        if (assetData.model && assetData.model !== 'Unknown') {
          console.log(`📱 Processing device name: "${assetData.model}"`);
          const parsedDevice = parseDeviceName(assetData.model);
          console.log(`📱 Parsed device result:`, parsedDevice);
          
          // Only override make if it wasn't explicitly set or is 'Unknown'
          if (!assetData.make || assetData.make === 'Unknown') {
            assetData.make = parsedDevice.make;
          }
          
          // Update model to the cleaned version
          assetData.model = parsedDevice.model;
          
          // Add storage to specifications if extracted
          if (parsedDevice.storage) {
            if (!assetData.specifications) {
              assetData.specifications = {};
            }
            console.log(`📱 Phone processing: Adding storage "${parsedDevice.storage}" to specifications`);
            assetData.specifications.storage = parsedDevice.storage;
          } else {
            console.log(`📱 No storage extracted from device name`);
          }

          // Save full raw device descriptor into specifications.operatingSystem so it appears in the "Phone" field of the form
          if (!assetData.specifications) assetData.specifications = {};
          if (!assetData.specifications.operatingSystem) {
            assetData.specifications.operatingSystem = String(csvRow['Device Name'] || assetData.model);
          }
        } else {
          console.log(`📱 No device name to process (model: "${assetData.model}")`);
        }
        
        // Build phone-specific asset tag (always override generic tag)
        {
          let phoneAssetTag = 'PH-';
          
          // Try to get owner name from resolved user data
          if (assetData.assignedToAadId) {
            const normalizedUser = String(assetData.assignedToAadId).trim();
            const resolvedUser = resolvedUserMap[normalizedUser];
            
            if (resolvedUser && resolvedUser.displayName) {
              // Extract first and last name from display name
              const nameParts = resolvedUser.displayName.trim().split(' ');
              if (nameParts.length >= 2) {
                const firstName = nameParts[0];
                const lastName = nameParts[nameParts.length - 1]; // Take last word as last name
                phoneAssetTag += `${firstName} ${lastName}`;
              } else {
                // If only one name part, use it as is
                phoneAssetTag += resolvedUser.displayName.trim();
              }
            } else {
              // Fallback: try to extract name from the original assignedToAadId if it looks like a display name
              if (normalizedUser.includes(' ')) {
                const nameParts = normalizedUser.split(' ');
                if (nameParts.length >= 2) {
                  const firstName = nameParts[0];
                  const lastName = nameParts[nameParts.length - 1];
                  phoneAssetTag += `${firstName} ${lastName}`;
                } else {
                  phoneAssetTag += normalizedUser;
                }
              } else {
                // No user name available, use generic format
                const timestamp = Date.now().toString().slice(-6);
                const randomSuffix = Math.random().toString(36).substr(2, 3).toUpperCase();
                phoneAssetTag += `${timestamp}-${randomSuffix}`;
              }
            }
          } else {
            // No assigned user, use generic format
            const timestamp = Date.now().toString().slice(-6);
            const randomSuffix = Math.random().toString(36).substr(2, 3).toUpperCase();
            phoneAssetTag += `${timestamp}-${randomSuffix}`;
          }
          
          assetData.assetTag = phoneAssetTag;
        }

        // Ensure carrier information
        if (!assetData.specifications) assetData.specifications = {};
        assetData.specifications.carrier = assetData.specifications.carrier || 'Telus';

        // If serialNumber missing but IMEI present in specifications, copy it
        if (!assetData.serialNumber && assetData.specifications.imei) {
          assetData.serialNumber = String(assetData.specifications.imei);
        }
      }

      // --- USER ASSIGNMENT NORMALIZATION & RESOLUTION ---------------------
      if (assetData.assignedToAadId) {
        // 1) Trim surrounding whitespace
        let normalizedUser = String(assetData.assignedToAadId).trim();

        // 2) Drop DOMAIN\ prefix if present
        if (normalizedUser.includes('\\')) {
          normalizedUser = normalizedUser.split('\\').pop() as string;
        }

        // 3) Update assetData with the normalized value (still may be display name)
        assetData.assignedToAadId = normalizedUser;

        // 4) Check if it's a GUID – skip lookup if so
        const isGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalizedUser);

        if (!isGuid) {
          // 5) Attempt to resolve via provided user map (trimmed key)
          const resolvedUser = resolvedUserMap[normalizedUser];

          if (resolvedUser && resolvedUser.id) {
            assetData.assignedToAadId = resolvedUser.id;
            // Resolve office location → locationId if missing
            if (resolvedUser.officeLocation && !assetData.locationId) {
              const resolvedLocationId = resolvedLocationMap[resolvedUser.officeLocation];
              if (resolvedLocationId) {
                assetData.locationId = resolvedLocationId;
                logger.debug(`Resolved location from user office: ${resolvedUser.officeLocation} → ${resolvedLocationId}`);
              }
            }
          } else {
            logger.warn(`Failed to resolve user "${normalizedUser}" – keeping original assignment for manual review`);
          }
        }
      }
      // --------------------------------------------------------------------

      // Determine status AFTER normalization / resolution
      if (assetData.assignedToId || assetData.assignedToAadId) {
        assetData.status = 'ASSIGNED';
      } else {
        assetData.status = assetData.status || 'AVAILABLE';
      }

      // Detect workload category based on rules (only if not explicitly set)
      let detectedCategoryInfo = null;
      if (!assetData.workloadCategoryId && workloadCategoryRules.length > 0) {
        const detectedCategoryId = await detectWorkloadCategory(assetData, workloadCategoryRules);
        if (detectedCategoryId) {
          assetData.workloadCategoryId = detectedCategoryId;
          // Find the rule that matched for statistics
          const matchedRule = workloadCategoryRules.find(rule => {
            if (!rule.isActive) return false;
            const fieldValue = getNestedValue(assetData, rule.sourceField);
            return matchRule(fieldValue, rule);
          });
          if (matchedRule) {
            detectedCategoryInfo = {
              categoryName: matchedRule.category.name,
              ruleName: matchedRule.description || `${matchedRule.sourceField} ${matchedRule.operator} ${matchedRule.value}`
            };
          }
        }
      }

      // Handle conflict resolution for serial numbers AND asset tags
      let existingAsset = null;
      
      // Check for conflicts by serial number first
      if (assetData.serialNumber) {
        existingAsset = await prisma.asset.findFirst({
          where: { serialNumber: assetData.serialNumber }
        });
      }
      
      // If no serial number conflict, check for asset tag conflict
      if (!existingAsset && assetData.assetTag) {
        existingAsset = await prisma.asset.findFirst({
          where: { assetTag: assetData.assetTag }
        });
      }

      if (existingAsset) {
        if (conflictResolution === 'skip') {
          const conflictType = existingAsset.serialNumber === assetData.serialNumber ? 'serial number' : 'asset tag';
          return { success: false, index, skipped: true, error: `Duplicate ${conflictType}: ${existingAsset.serialNumber || existingAsset.assetTag}` };
        } else if (conflictResolution === 'overwrite') {
          // Separate custom fields and workload category from asset data
          const { customFields, workloadCategoryId, ...assetDataWithoutCustomFields } = assetData;

          // Remove null locationId to prevent foreign key constraint violations
          if (assetDataWithoutCustomFields.locationId === null || assetDataWithoutCustomFields.locationId === undefined) {
            delete assetDataWithoutCustomFields.locationId;
          }

          // Update existing asset
          const updatedAsset = await prisma.asset.update({
            where: { id: existingAsset.id },
            data: {
              ...assetDataWithoutCustomFields,
              specifications: assetData.specifications ? JSON.stringify(assetData.specifications) : undefined,
              updatedById: req.user?.userId
            }
          });

          // Update custom field values if any
          if (customFields && Object.keys(customFields).length > 0) {
            await prisma.customFieldValue.deleteMany({
              where: { assetId: updatedAsset.id }
            });

            for (const [fieldId, value] of Object.entries(customFields)) {
              if (value) {
                await prisma.customFieldValue.create({
                  data: {
                    assetId: updatedAsset.id,
                    fieldId: fieldId,
                    value: String(value)
                  }
                });
              }
            }
          }

          // Update workload category assignment if detected
          if (workloadCategoryId) {
            // Remove existing workload category assignments
            await prisma.assetWorkloadCategory.deleteMany({
              where: { assetId: updatedAsset.id }
            });
            
            // Add new workload category assignment
            await prisma.assetWorkloadCategory.create({
              data: {
                assetId: updatedAsset.id,
                categoryId: workloadCategoryId
              }
            });
          }

          // Log activity
          await prisma.activityLog.create({
            data: {
              entityType: 'asset',
              entityId: updatedAsset.id,
              action: 'UPDATE',
              changes: `Asset updated via bulk import (overwrite conflict)`,
              userId: req.user?.userId
            }
          });

          return { 
            success: true, 
            index, 
            result: { id: updatedAsset.id, assetTag: updatedAsset.assetTag },
            statistics: {
              assetType: assetData.assetType,
              status: assetData.status,
              assignedUser: assetData.assignedToAadId,
              location: assetData.locationId,
              categorized: detectedCategoryInfo ? {
                assetTag: updatedAsset.assetTag,
                categoryName: detectedCategoryInfo.categoryName,
                ruleName: detectedCategoryInfo.ruleName
              } : null
            }
          };
        }
      }

      // Separate custom fields and workload category from asset data
      const { customFields, workloadCategoryId, ...assetDataWithoutCustomFields } = assetData;

      // Remove null locationId to prevent foreign key constraint violations
      if (assetDataWithoutCustomFields.locationId === null || assetDataWithoutCustomFields.locationId === undefined) {
        delete assetDataWithoutCustomFields.locationId;
      }

      // Create new asset
      const newAsset = await prisma.asset.create({
        data: {
          ...assetDataWithoutCustomFields,
          specifications: assetData.specifications ? JSON.stringify(assetData.specifications) : undefined,
          createdById: req.user?.userId,
          updatedById: req.user?.userId
        }
      });

      // Create custom field values if any
      if (customFields && Object.keys(customFields).length > 0) {
        for (const [fieldId, value] of Object.entries(customFields)) {
          if (value) {
            await prisma.customFieldValue.create({
              data: {
                assetId: newAsset.id,
                fieldId: fieldId,
                value: String(value)
              }
            });
          }
        }
      }

      // Assign workload category if detected
      if (workloadCategoryId) {
        await prisma.assetWorkloadCategory.create({
          data: {
            assetId: newAsset.id,
            categoryId: workloadCategoryId
          }
        });
      }

      // Log activity
      await prisma.activityLog.create({
        data: {
          entityType: 'asset',
          entityId: newAsset.id,
          action: 'CREATE',
          changes: `Asset created via bulk import`,
          userId: req.user?.userId
        }
      });

      return { 
        success: true, 
        index, 
        result: { id: newAsset.id, assetTag: newAsset.assetTag },
        // Include statistics for tracking
        statistics: {
          assetType: assetData.assetType,
          status: assetData.status,
          assignedUser: assetData.assignedToAadId,
          location: assetData.locationId,
          categorized: detectedCategoryInfo ? {
            assetTag: newAsset.assetTag,
            categoryName: detectedCategoryInfo.categoryName,
            ruleName: detectedCategoryInfo.ruleName
          } : null
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { 
        success: false, 
        index, 
        error: errorMessage 
      };
    }
  });

  // Wait for all promises to settle and return results
  const batchResults = await Promise.allSettled(batchPromises);
  
  return batchResults.map((result, idx) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        success: false,
        index: assetBatch[idx].index,
        error: result.reason?.message || 'Unknown error'
      };
    }
  });
}

// Utility: normalize source identifier from frontend to canonical source label stored in DB
function normalizeImportSource(src: string | undefined): string {
  if (!src) return 'BULK_UPLOAD';
  const lower = src.toLowerCase();
  if (lower === 'ninjaone') return 'NINJAONE';
  if (lower === 'intune') return 'INTUNE';
  if (lower === 'bgc-template' || lower === 'custom-excel' || lower === 'invoice') return 'EXCEL';
  if (lower === 'telus') return 'TELUS';
  // Already in canonical form or unknown – default to upper-case for safety
  return src.toUpperCase();
}

const router = Router();

// ----------  PUBLIC SERVER-SENT EVENTS ENDPOINT (no auth) ----------
// Defined BEFORE router.use(authenticateJwt) so it is not protected.
router.get('/progress/:sessionId', (req: Request, res: Response) => {
  const sessionId = req.params.sessionId;

  // Basic CORS for dev; production sits on same origin
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const send = (payload: any) => {
    // Convert Sets to arrays for JSON serialization
    const serializable = {
      ...payload,
      uniqueUsers: payload.uniqueUsers ? Array.from(payload.uniqueUsers) : [],
      uniqueLocations: payload.uniqueLocations ? Array.from(payload.uniqueLocations) : []
    };
    res.write(`data: ${JSON.stringify(serializable)}\n\n`);
  };

  // Send initial snapshot if we have one
  const initial = progressStore.get(sessionId);
  if (initial) send(initial);

  const interval = setInterval(() => {
    const p = progressStore.get(sessionId);
    if (!p) {
      clearInterval(interval);
      return res.end();
    }
    send(p);

    // Auto-close a few seconds after done
    if (p.processed >= p.total) {
      clearInterval(interval);
      setTimeout(() => res.end(), 5000);
    }
  }, 1000);

  req.on('close', () => clearInterval(interval));
  // Also schedule cleanup when client disconnects
  req.on('close', () => {
    const done = progressStore.get(sessionId);
    if (done && done.processed >= done.total) {
      setTimeout(() => progressStore.delete(sessionId), 60000); // purge after 1 min
    }
  });
});

router.use(authenticateJwt);
// -------------------------------------------------------------------

// POST /api/import/resolve
router.post('/resolve', async (req: Request, res: Response) => {
  try {
    const { usernames = [], locations = [], serialNumbers = [] } = req.body as { 
      usernames: string[]; 
      locations: string[]; 
      serialNumbers: string[];
    };

    logger.info('Resolving import payload', { usernames: usernames.length, locations: locations.length, serialNumbers: serialNumbers.length });

    // Separate usernames from display names based on heuristics
    const usernameList: string[] = [];
    const displayNameList: string[] = [];
    
    usernames.forEach(user => {
      const trimmed = user.trim();
      if (!trimmed) return;
      
      // Heuristic: if contains space, likely a display name
      // If camelCase or no spaces, likely a username
      if (trimmed.includes(' ')) {
        displayNameList.push(trimmed);
      } else {
        usernameList.push(trimmed);
      }
    });

    logger.info('User resolution strategy', { 
      usernames: usernameList.length, 
      displayNames: displayNameList.length 
    });

    // Resolve both types
    const [usernameMap, displayNameMap] = await Promise.all([
      graphService.findUsersBySamAccount(usernameList),
      graphService.findUsersByDisplayName(displayNameList)
    ]);

    // Combine results
    const userMap = { ...usernameMap, ...displayNameMap };

    const locationMap = await matchLocations(Array.from(new Set(locations)));
    
    // Check for conflicts by serial number
    const conflicts: Record<string, { id: string; assetTag: string; serialNumber: string }> = {};
    if (serialNumbers.length > 0) {
      const existingAssets = await prisma.asset.findMany({
        where: {
          serialNumber: {
            in: Array.from(new Set(serialNumbers.filter(sn => sn && sn.trim())))
          }
        },
        select: {
          id: true,
          assetTag: true,
          serialNumber: true
        }
      });

      existingAssets.forEach((asset: { id: string; assetTag: string; serialNumber: string | null }) => {
        if (asset.serialNumber) {
          conflicts[asset.serialNumber] = {
            id: asset.id,
            assetTag: asset.assetTag,
            serialNumber: asset.serialNumber
          };
        }
      });
    }

    logger.info('Resolver completed', { 
      resolvedUsers: Object.keys(userMap).length, 
      resolvedLocations: Object.keys(locationMap).length, 
      conflicts: Object.keys(conflicts).length 
    });

    res.json({ userMap, locationMap, conflicts });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Failed to resolve usernames/locations/conflicts' });
  }
});

// POST /api/import/assets
router.post('/assets', requireRole([USER_ROLES.WRITE, USER_ROLES.ADMIN]), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    logger.info('Import request received', { 
      userId: user?.userId, 
      role: user?.role, 
      email: user?.dbUser?.email 
    });

    const { 
      assets, 
      columnMappings, 
      conflictResolution = 'overwrite',
      source: rawSource = 'BULK_UPLOAD',
      sessionId,
      resolvedUserMap = {},
      resolvedLocationMap = {}
    } = req.body as {
      assets: Record<string, string>[];
      columnMappings: Array<{
        ninjaColumn: string;
        targetField: string;
        isRequired: boolean;
        processor?: string;
      }>;
      conflictResolution: 'skip' | 'overwrite';
      source?: string;
      sessionId?: string;
      resolvedUserMap?: Record<string, { id: string; displayName: string; officeLocation?: string } | null>;
      resolvedLocationMap?: Record<string, string | null>;
    };

    if (!assets || !Array.isArray(assets) || assets.length === 0) {
      return res.status(400).json({ error: 'No assets provided for import' });
    }

    if (!columnMappings || !Array.isArray(columnMappings)) {
      return res.status(400).json({ error: 'Column mappings are required' });
    }

    // Initialize progress tracking with enhanced statistics
    const trackingId = sessionId || generateSessionId();
    progressStore.set(trackingId, {
      total: assets.length,
      processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      skippedItems: [],
      // Enhanced statistics
      categorizedAssets: [],
      uniqueUsers: new Set(),
      uniqueLocations: new Set(),
      assetTypeBreakdown: {},
      statusBreakdown: {}
    });

    const results = {
      total: assets.length,
      successful: 0,
      failed: 0,
      skipped: 0,
      errors: [] as Array<{ index: number; error: string; data?: any }>,
      skippedItems: [] as Array<{ index: number; reason: string; data?: any }>,
      created: [] as Array<{ id: string; assetTag: string }>,
      sessionId: trackingId,
      // Enhanced statistics
      statistics: {
        categorizedAssets: [] as Array<{ assetTag: string; categoryName: string; ruleName: string }>,
        uniqueUsers: [] as string[],
        uniqueLocations: [] as string[],
        assetTypeBreakdown: {} as Record<string, number>,
        statusBreakdown: {} as Record<string, number>
      }
    };

    logger.info(`Starting bulk import of ${assets.length} assets with session ${trackingId}`);

    // Normalize source label once and reuse for all batches
    const source = normalizeImportSource(rawSource);

    // Process assets in batches for better performance
    const batchCount = Math.ceil(assets.length / BATCH_SIZE);
    let processedCount = 0;
    
    for (let batchIndex = 0; batchIndex < batchCount; batchIndex++) {
      const startIndex = batchIndex * BATCH_SIZE;
      const endIndex = Math.min(startIndex + BATCH_SIZE, assets.length);
      const currentBatch = assets.slice(startIndex, endIndex).map((asset, idx) => ({
        asset,
        index: startIndex + idx
      }));

      logger.info(`Processing batch ${batchIndex + 1} of ${batchCount} (${currentBatch.length} assets)`);

      // Update progress with current batch info
      const currentProgress = progressStore.get(trackingId);
      if (currentProgress) {
        currentProgress.currentItem = `Processing batch ${batchIndex + 1}/${batchCount}`;
        progressStore.set(trackingId, currentProgress);
      }

      try {
        // Process the batch in parallel
        const batchResults = await processAssetBatch(
          currentBatch,
          columnMappings,
          conflictResolution,
          source,
          trackingId,
          req,
          resolvedUserMap,
          resolvedLocationMap
        );

        // Update results and progress for each completed asset
        for (const result of batchResults) {
          processedCount++;
          
          if (result.success) {
            results.successful++;
            if (result.result) {
              results.created.push(result.result);
            }
            
            // Collect statistics for successful imports
            if (result.statistics) {
              const stats = result.statistics;
              
              // Track asset type breakdown
              if (stats.assetType) {
                results.statistics.assetTypeBreakdown[stats.assetType] = 
                  (results.statistics.assetTypeBreakdown[stats.assetType] || 0) + 1;
              }
              
              // Track status breakdown
              if (stats.status) {
                results.statistics.statusBreakdown[stats.status] = 
                  (results.statistics.statusBreakdown[stats.status] || 0) + 1;
              }
              
              // Track unique users
              if (stats.assignedUser && !results.statistics.uniqueUsers.includes(stats.assignedUser)) {
                results.statistics.uniqueUsers.push(stats.assignedUser);
              }
              
              // Track unique locations
              if (stats.location && !results.statistics.uniqueLocations.includes(stats.location)) {
                results.statistics.uniqueLocations.push(stats.location);
              }
              
              // Track categorized assets
              if (stats.categorized) {
                results.statistics.categorizedAssets.push(stats.categorized);
              }
            }
          } else if (result.skipped) {
            results.skipped++;
            results.skippedItems.push({
              index: result.index,
              reason: result.error || 'Unknown reason',
              data: assets[result.index]
            });
          } else {
            results.failed++;
            if (result.error) {
              const errorDetails = {
                index: result.index,
                error: result.error,
                data: assets[result.index]
              };
              results.errors.push(errorDetails);
            }
          }

          // Update progress store
          const progress = progressStore.get(trackingId);
          if (progress) {
            progress.processed = processedCount;
            if (result.success) {
              progress.successful++;
              
              // Update progress statistics
              if (result.statistics) {
                const stats = result.statistics;
                
                // Track asset type breakdown
                if (stats.assetType) {
                  progress.assetTypeBreakdown[stats.assetType] = 
                    (progress.assetTypeBreakdown[stats.assetType] || 0) + 1;
                }
                
                // Track status breakdown
                if (stats.status) {
                  progress.statusBreakdown[stats.status] = 
                    (progress.statusBreakdown[stats.status] || 0) + 1;
                }
                
                // Track unique users
                if (stats.assignedUser) {
                  progress.uniqueUsers.add(stats.assignedUser);
                }
                
                // Track unique locations
                if (stats.location) {
                  progress.uniqueLocations.add(stats.location);
                }
                
                // Track categorized assets
                if (stats.categorized) {
                  progress.categorizedAssets.push(stats.categorized);
                }
              }
            } else if (result.skipped) {
              progress.skipped++;
              progress.skippedItems.push({
                index: result.index,
                reason: result.error || 'Unknown reason',
                data: assets[result.index]
              });
            } else {
              progress.failed++;
              if (result.error) {
                progress.errors.push({
                  index: result.index,
                  error: result.error,
                  data: assets[result.index]
                });
              }
            }
            progressStore.set(trackingId, progress);
          }
        }

        // Log batch completion
        const completionPercentage = Math.round((processedCount / assets.length) * 100);
        logger.info(`Completed batch ${batchIndex + 1}: ${processedCount}/${assets.length} (${completionPercentage}%)`);

      } catch (error) {
        // Handle batch-level errors
        logger.error(`Batch ${batchIndex + 1} failed:`, error);
        
        // Mark all assets in this batch as failed
        for (const { index, asset } of currentBatch) {
          processedCount++;
          results.failed++;
          const errorDetails = {
            index,
            error: error instanceof Error ? error.message : 'Batch processing failed',
            data: asset
          };
          results.errors.push(errorDetails);

          // Update progress store
          const progress = progressStore.get(trackingId);
          if (progress) {
            progress.processed = processedCount;
            progress.failed++;
            progress.errors.push(errorDetails);
            progressStore.set(trackingId, progress);
          }
        }
      }
    }

    // Final progress update
    const finalProgress = progressStore.get(trackingId);
    if (finalProgress) {
      finalProgress.processed = processedCount;
      finalProgress.currentItem = 'Import Complete';
      progressStore.set(trackingId, finalProgress);
    }

    logger.info(`Bulk import completed: ${results.successful} successful, ${results.failed} failed, ${results.skipped} skipped`);
    res.json(results);

  } catch (err: any) {
    logger.error('Bulk import error:', err);
    res.status(500).json({ error: 'Failed to import assets' });
  }
});

export default router; 