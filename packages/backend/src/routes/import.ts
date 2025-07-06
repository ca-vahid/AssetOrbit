import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticateJwt, requireRole } from '../middleware/auth';
import { graphService } from '../services/graphService';
import { matchLocations } from '../utils/locationMatcher';
import prisma from '../services/database';
import logger from '../utils/logger';
import { Prisma } from '../generated/prisma';
import { USER_ROLES } from '../constants/index';

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
  req: any
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

      // Apply column mappings
      for (const mapping of columnMappings) {
        const csvValue = csvRow[mapping.ninjaColumn];
        if (!csvValue && mapping.isRequired) {
          throw new Error(`Required field ${mapping.targetField} is missing`);
        }

        if (csvValue) {
          // Handle different field types
          if (mapping.targetField.startsWith('cf_')) {
            // Custom field
            const customFieldId = mapping.targetField.substring(3);
            assetData.customFields[customFieldId] = csvValue;
          } else if (directAssetFields.includes(mapping.targetField)) {
            // Direct Asset model field
            let val: any = csvValue;
            if (dateFields.includes(mapping.targetField)) {
              val = toISO(csvValue);
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
            assetData.specifications[mapping.targetField] = csvValue;
          }
        }
      }

      // Require serial number
      if (!assetData.serialNumber || !assetData.serialNumber.trim()) {
        return { success: false, index, skipped: true, error: 'Missing serial number' };
      }

      // Generate asset tag if not provided or ensure uniqueness
      if (!assetData.assetTag) {
        const prefix = assetData.assetType === 'LAPTOP' ? 'LT' : 
                      assetData.assetType === 'DESKTOP' ? 'DT' : 'AS';
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

      // Set default values and ensure required fields are present
      assetData.status = assetData.status || 'AVAILABLE';
      assetData.condition = assetData.condition || 'GOOD';
      assetData.assetType = assetData.assetType || 'LAPTOP';
      assetData.make = assetData.make || 'Unknown';
      assetData.model = assetData.model || 'Unknown';
      assetData.source = source;

      // Auto-set status to ASSIGNED when user specified
      if (assetData.assignedToId || assetData.assignedToAadId) {
        assetData.status = 'ASSIGNED';
      }

      // Resolve assignedToAadId to local User row so UI can display name
      if (assetData.assignedToAadId && !assetData.assignedToId) {
        // Check if it's already a GUID or if it's a username that needs resolution
        const isGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(assetData.assignedToAadId);
        
        if (!isGuid) {
          // It's a username - extract clean username and try to resolve to GUID
          const cleanUsername = assetData.assignedToAadId.includes('\\') 
            ? assetData.assignedToAadId.split('\\').pop() 
            : assetData.assignedToAadId;
            
          try {
            const userMap = await graphService.findUsersBySamAccount([cleanUsername || '']);
            const resolvedUser = userMap[cleanUsername || ''];
            
            if (resolvedUser && resolvedUser.id) {
              // Replace with GUID for consistent statistics
              const originalUsername = assetData.assignedToAadId;
              assetData.assignedToAadId = resolvedUser.id;
              logger.info(`✅ Resolved username "${originalUsername}" to GUID: ${resolvedUser.id}`);
            } else {
              // Keep the full original username (including domain if present)
              logger.info(`👤 Preserving full username (no Azure AD resolution): "${assetData.assignedToAadId}"`);
            }
          } catch (error) {
            logger.error(`Failed to resolve username "${assetData.assignedToAadId}":`, error);
            // Keep the original username on error
          }
        } else {
          logger.info(`✅ Already a GUID: ${assetData.assignedToAadId}`);
        }
        
        // Remove the automatic user creation logic (keep disabled)
        // The assignedToAadId field now contains either GUIDs or full usernames
        delete assetData.assignedToId;
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

    console.log('Resolving import payload', { usernames, locations, serialNumbers });

    const userMap = await graphService.findUsersBySamAccount(Array.from(new Set(usernames)));
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

    console.log('Resolver results', { userMap, locationMap, conflicts });

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
      source = 'BULK_UPLOAD',
      sessionId
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
          req
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
              logger.info({ 
                assetType: stats.assetType, 
                status: stats.status, 
                assignedUser: stats.assignedUser, 
                location: stats.location,
                categorized: stats.categorized 
              }, 'Processing statistics for asset');
              
              // Track asset type breakdown
              if (stats.assetType) {
                results.statistics.assetTypeBreakdown[stats.assetType] = 
                  (results.statistics.assetTypeBreakdown[stats.assetType] || 0) + 1;
                logger.info(results.statistics.assetTypeBreakdown, 'Updated asset type breakdown');
              }
              
              // Track status breakdown
              if (stats.status) {
                results.statistics.statusBreakdown[stats.status] = 
                  (results.statistics.statusBreakdown[stats.status] || 0) + 1;
                logger.info(results.statistics.statusBreakdown, 'Updated status breakdown');
              }
              
              // Track unique users
              if (stats.assignedUser && !results.statistics.uniqueUsers.includes(stats.assignedUser)) {
                results.statistics.uniqueUsers.push(stats.assignedUser);
                logger.info({ user: stats.assignedUser, totalUsers: results.statistics.uniqueUsers.length }, 'Added unique user');
              }
              
              // Track unique locations
              if (stats.location && !results.statistics.uniqueLocations.includes(stats.location)) {
                results.statistics.uniqueLocations.push(stats.location);
                logger.info({ location: stats.location, totalLocations: results.statistics.uniqueLocations.length }, 'Added unique location');
              }
              
              // Track categorized assets
              if (stats.categorized) {
                results.statistics.categorizedAssets.push(stats.categorized);
                logger.info(stats.categorized, 'Added categorized asset');
              }
            } else {
              logger.warn('No statistics returned for successful asset at index:', result.index);
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
    logger.info(results.statistics, 'Final statistics');
    res.json(results);

  } catch (err: any) {
    logger.error('Bulk import error:', err);
    res.status(500).json({ error: 'Failed to import assets' });
  }
});

export default router; 