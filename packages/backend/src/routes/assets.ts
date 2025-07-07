import { Router } from 'express';
import type { Request, Response } from 'express';
import prisma from '../services/database';
import { authenticateJwt, requireRole } from '../middleware/auth';
import logger from '../utils/logger';
import { 
  isValidAssetType, 
  isValidAssetStatus, 
  isValidAssetCondition,
  ACTIVITY_ACTIONS,
  ENTITY_TYPES,
  USER_ROLES
} from '../constants/index.js';
import { Prisma } from '../generated/prisma';
import { graphService } from '../services/graphService';

const router = Router();

// All routes require authentication
router.use(authenticateJwt);

// Helper function to log activity
async function logActivity(
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  assetId?: string,
  changes?: any
) {
  try {
    await prisma.activityLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        assetId,
        changes: changes ? JSON.stringify(changes) : null,
      },
    });
  } catch (error) {
    logger.error('Failed to log activity:', error);
  }
}

// Helper function to extract user ID from request
function getUserId(user: any): string {
  const userId = user.userId || user.dbUser?.id;
  if (!userId) {
    throw new Error('User ID not found');
  }
  return userId;
}

// Helper function to enrich assets with staff information from Azure AD
async function enrichAssetsWithStaffInfo(assets: any[]): Promise<any[]> {
  const enrichedAssets = await Promise.all(
    assets.map(async (asset) => {
      if (asset.assignedToAadId) {
        try {
          // Check if assignedToAadId is a GUID or a username
          const isGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(asset.assignedToAadId);
          
          if (isGuid) {
            // It's a GUID - call getStaffMember directly
            const staffMember = await graphService.getStaffMember(asset.assignedToAadId);
            return {
              ...asset,
              assignedToStaff: staffMember,
            };
          } else {
            // It's a username - resolve it first using findUsersBySamAccount
            const userMap = await graphService.findUsersBySamAccount([asset.assignedToAadId]);
            const resolvedUser = userMap[asset.assignedToAadId];
            
            if (resolvedUser && resolvedUser.id) {
              // Now get the full staff member info using the resolved GUID
              const staffMember = await graphService.getStaffMember(resolvedUser.id);
              return {
                ...asset,
                assignedToStaff: staffMember,
              };
            } else {
              // Could not resolve username to GUID
              logger.warn(`Could not resolve username "${asset.assignedToAadId}" to Azure AD GUID`);
              return {
                ...asset,
                assignedToStaff: null,
              };
            }
          }
        } catch (error) {
          logger.warn(`Failed to get staff info for ${asset.assignedToAadId}:`, error);
          return {
            ...asset,
            assignedToStaff: null,
          };
        }
      }
      return asset;
    })
  );
  return enrichedAssets;
}

// Add canonical asset field metadata (for import mapping)
const CANONICAL_ASSET_FIELDS = [
  { key: 'assetTag', label: 'Asset Tag', required: true },
  { key: 'assetType', label: 'Asset Type', required: true },
  { key: 'status', label: 'Status', required: false },
  { key: 'condition', label: 'Condition', required: false },
  { key: 'make', label: 'Make', required: true },
  { key: 'model', label: 'Model', required: true },
  { key: 'serialNumber', label: 'Serial Number', required: false },
  { key: 'purchaseDate', label: 'Purchase Date', required: false },
  { key: 'purchasePrice', label: 'Purchase Price', required: false },
  { key: 'vendorId', label: 'Vendor', required: false },
  { key: 'warrantyStartDate', label: 'Warranty Start Date', required: false },
  { key: 'warrantyEndDate', label: 'Warranty End Date', required: false },
  { key: 'assignedToAadId', label: 'Assigned User (AAD)', required: false },
  { key: 'departmentId', label: 'Department', required: false },
  { key: 'locationId', label: 'Location', required: false },
  { key: 'notes', label: 'Notes', required: false },
  { key: 'ram', label: 'Memory (RAM)', required: false },
  { key: 'processor', label: 'Processor', required: false },
  { key: 'storage', label: 'Storage', required: false },
  { key: 'operatingSystem', label: 'Operating System', required: false },
];

// GET /api/assets/fields - canonical list of direct asset fields
router.get('/fields', (_req: Request, res: Response) => {
  res.json(CANONICAL_ASSET_FIELDS);
});

// GET /api/assets - Get all assets with pagination, filtering, and sorting
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      page = '1',
      limit = '50',
      search,
      status,
      condition,
      assetType,
      departmentId,
      locationId,
      assignedToId,
      assignedToAadId,
      assignedTo, // Generic parameter that can be either ID or AAD ID
      workloadCategoryId, // Filter by workload category
      dateFrom,
      dateTo,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: Prisma.AssetWhereInput = {};

    // Search functionality
    if (search) {
      const searchStr = search as string;
      where.OR = [
        { assetTag: { contains: searchStr } },
        { make: { contains: searchStr } },
        { model: { contains: searchStr } },
        { serialNumber: { contains: searchStr } },
        { notes: { contains: searchStr } },
        // Search within custom field values
        {
          customFieldValues: {
            some: {
              value: {
                contains: searchStr,
              },
            },
          },
        },
      ];
    }

    // Filters
    if (status && isValidAssetStatus(status as string)) {
      where.status = status as string;
    }
    if (condition && isValidAssetCondition(condition as string)) {
      where.condition = condition as string;
    }
    if (assetType && isValidAssetType(assetType as string)) {
      where.assetType = assetType as string;
    }
    if (departmentId) {
      where.departmentId = departmentId as string;
    }
    if (locationId) {
      where.locationId = locationId as string;
    }
    
    // Handle assignment filters - support both legacy and new parameters
    if (assignedToId) {
      where.assignedToId = assignedToId as string;
    }
    if (assignedToAadId) {
      where.assignedToAadId = assignedToAadId as string;
    }
    // Generic assignedTo parameter - try to detect if it's a UUID (AAD ID) or internal ID
    if (assignedTo) {
      const assignedToStr = assignedTo as string;
      // Check if it looks like a UUID (Azure AD ID format)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(assignedToStr)) {
        where.assignedToAadId = assignedToStr;
      } else {
        where.assignedToId = assignedToStr;
      }
    }

    // Date range filters
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom as string);
      }
      if (dateTo) {
        where.createdAt.lte = new Date(dateTo as string);
      }
    }

    // Workload category filter
    if (workloadCategoryId) {
      where.workloadCategories = {
        some: {
          categoryId: workloadCategoryId as string,
        },
      };
    }

    // Custom field exact match filters: cf_<fieldId>=value
    const cfFilters: Prisma.AssetWhereInput[] = [];
    Object.entries(req.query).forEach(([key, val]) => {
      if (key.startsWith('cf_') && val) {
        const fieldId = key.slice(3);
        cfFilters.push({
          customFieldValues: {
            some: {
              fieldId,
              value: String(val),
            },
          },
        });
      }
    });
    if (cfFilters.length) {
      if (!where.AND) {
        // @ts-ignore
        where.AND = [];
      }
      // @ts-ignore push into where.AND array
      (where.AND as any[]).push(...cfFilters);
    }

    // Build orderBy
    const orderBy: any = {};
    orderBy[sortBy as string] = sortOrder;

    // Execute queries
    const [assets, totalCount] = await Promise.all([
      prisma.asset.findMany({
        where,
        skip,
        take: limitNum,
        orderBy,
        include: {
          assignedTo: {
            select: {
              id: true,
              displayName: true,
              email: true,
              department: true,
            },
          },
          department: true,
          location: true,
          vendor: true,
          customFieldValues: {
            include: {
              field: true,
            },
          },
          tickets: {
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
          _count: {
            select: {
              tickets: true,
              attachments: true,
            },
          },
          // @ts-ignore workloadCategories relation
          workloadCategories: {
            include: {
              category: true,
            },
          },
        },
      }),
      prisma.asset.count({ where }),
    ]);

    // Parse specifications JSON
    const assetsWithParsedSpecs = assets.map((asset) => ({
      ...asset,
      specifications: asset.specifications ? JSON.parse(asset.specifications) : null,
      customFields: (asset as any).customFieldValues?.reduce((obj: any, cfv: any) => {
        obj[cfv.fieldId] = cfv.value;
        return obj;
      }, {}) || {},
    }));

    // Enrich with staff information from Azure AD
    const enrichedAssets = await enrichAssetsWithStaffInfo(assetsWithParsedSpecs);

    res.json({
      data: enrichedAssets,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitNum),
      },
    });
  } catch (error) {
    logger.error(`Error fetching assets: ${error instanceof Error ? error.message : error}`);
    res.status(500).json({ error: 'Failed to fetch assets' });
  }
});

// GET /api/assets/stats - Get asset statistics (counts by type and status)
router.get('/stats', async (req: Request, res: Response) => {
  try {
    // Get asset type counts
    const assetTypeCounts = await prisma.asset.groupBy({
      by: ['assetType'],
      _count: {
        id: true,
      },
    });

    // Get status counts
    const statusCounts = await prisma.asset.groupBy({
      by: ['status'],
      _count: {
        id: true,
      },
    });

    // Get total count
    const totalCount = await prisma.asset.count();

    // Format the response
    const assetTypeStats = assetTypeCounts.reduce((acc, item) => {
      acc[item.assetType] = item._count.id;
      return acc;
    }, {} as Record<string, number>);

    const statusStats = statusCounts.reduce((acc, item) => {
      acc[item.status] = item._count.id;
      return acc;
    }, {} as Record<string, number>);

    res.json({
      total: totalCount,
      assetTypes: assetTypeStats,
      statuses: statusStats,
    });
  } catch (error) {
    logger.error(`Error fetching asset statistics: ${error instanceof Error ? error.message : error}`);
    res.status(500).json({ error: 'Failed to fetch asset statistics' });
  }
});

// GET /api/assets/:id - Get single asset by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const asset = await prisma.asset.findUnique({
      where: { id },
      include: {
        assignedTo: true,
        department: true,
        location: true,
        vendor: true,
        customFieldValues: {
          include: {
            field: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
        updatedBy: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
        tickets: {
          orderBy: { createdAt: 'desc' },
        },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            user: {
              select: {
                displayName: true,
                email: true,
              },
            },
          },
        },
        attachments: {
          orderBy: { uploadedAt: 'desc' },
        },
        // @ts-ignore workloadCategories relation
        workloadCategories: {
          include: {
            category: true,
          },
        },
      },
    });

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    // Build customFields object from value rows
    const customFields = (asset as any).customFieldValues.reduce((obj: any, cfv: any) => {
      obj[cfv.fieldId] = cfv.value;
      return obj;
    }, {} as Record<string, any>);

    let assetWithParsedData: any = {
      ...asset,
      specifications: asset.specifications ? JSON.parse(asset.specifications) : null,
      customFields,
      // @ts-ignore workloadCategories relation
      workloadCategories: (asset as any).workloadCategories.map((link: any) => link.category),
      activities: (asset as any).activities.map((activity: any) => ({
        ...activity,
        changes: activity.changes ? JSON.parse(activity.changes) : null,
      })),
    };

    // Enrich with staff information if assigned to Azure AD user
    if (asset.assignedToAadId) {
      try {
        // Check if assignedToAadId is a GUID or a username
        const isGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(asset.assignedToAadId);
        
        if (isGuid) {
          // It's a GUID - call getStaffMember directly
          const staffMember = await graphService.getStaffMember(asset.assignedToAadId);
          assetWithParsedData.assignedToStaff = staffMember;
        } else {
          // It's a username - resolve it first using findUsersBySamAccount
          const userMap = await graphService.findUsersBySamAccount([asset.assignedToAadId]);
          const resolvedUser = userMap[asset.assignedToAadId];
          
          if (resolvedUser && resolvedUser.id) {
            // Now get the full staff member info using the resolved GUID
            const staffMember = await graphService.getStaffMember(resolvedUser.id);
            assetWithParsedData.assignedToStaff = staffMember;
          } else {
            // Could not resolve username to GUID
            logger.warn(`Could not resolve username "${asset.assignedToAadId}" to Azure AD GUID`);
            assetWithParsedData.assignedToStaff = null;
          }
        }
      } catch (error) {
        logger.warn(`Failed to get staff info for ${asset.assignedToAadId}:`, error);
        assetWithParsedData.assignedToStaff = null;
      }
    }

    res.json(assetWithParsedData);
  } catch (error) {
    logger.error('Error fetching asset:', error);
    res.status(500).json({ error: 'Failed to fetch asset' });
  }
});

// POST /api/assets - Create new asset (requires WRITE role)
router.post('/', requireRole([USER_ROLES.WRITE, USER_ROLES.ADMIN]), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    
    // Debug logging
    logger.info({
      user: {
        userId: user.userId,
        dbUser: user.dbUser ? { id: user.dbUser.id, email: user.dbUser.email } : null,
        oid: user.oid,
      },
    }, 'User object');
    logger.info({ requestBody: req.body }, 'Request body');
    
    let userId: string;
    try {
      userId = getUserId(user);
      logger.info('Extracted userId:', userId);
    } catch (error) {
      logger.error('Failed to extract userId:', error);
      return res.status(401).json({ error: 'User ID not found' });
    }
    
    const {
      assetTag,
      assetType,
      status,
      condition,
      make,
      model,
      serialNumber,
      specifications,
      assignedToId,
      assignedToAadId,
      departmentId,
      locationId,
      purchaseDate,
      purchasePrice,
      vendorId,
      warrantyStartDate,
      warrantyEndDate,
      warrantyNotes,
      notes,
      customFields,
      categoryIds,
    } = req.body;

    // Validate required fields
    if (!assetTag || !assetType || !make || !model) {
      return res.status(400).json({ 
        error: 'Missing required fields: assetTag, assetType, make, model' 
      });
    }

    // Validate enums
    if (!isValidAssetType(assetType)) {
      return res.status(400).json({ error: 'Invalid asset type' });
    }
    if (status && !isValidAssetStatus(status)) {
      return res.status(400).json({ error: 'Invalid asset status' });
    }
    if (condition && !isValidAssetCondition(condition)) {
      return res.status(400).json({ error: 'Invalid asset condition' });
    }

    // Check if asset tag already exists
    const existingAsset = await prisma.asset.findUnique({
      where: { assetTag },
    });

    if (existingAsset) {
      return res.status(400).json({ error: 'Asset tag already exists' });
    }

    // Check if serial number already exists
    if (serialNumber) {
      const existingSerial = await prisma.asset.findFirst({
        where: { serialNumber },
      });
      if (existingSerial) {
        return res.status(400).json({ error: 'Serial number already exists' });
      }
    }

    // Validate custom field IDs and filter out empty values - IMPROVED FILTERING
    logger.info({ customFieldsRaw: customFields }, 'Raw customFields');
    
    const nonEmptyCustomFields = Object.fromEntries(
      Object.entries(customFields || {}).filter(([_, value]) => {
        // More strict filtering - exclude empty strings, null, undefined, and whitespace-only strings
        return value !== '' && value != null && value !== undefined && 
               (typeof value !== 'string' || value.trim() !== '');
      })
    );
    
    logger.info({ customFieldsFiltered: nonEmptyCustomFields }, 'Filtered customFields');
    
    const nonEmptyCustomFieldIds = Object.keys(nonEmptyCustomFields);
    
    if (nonEmptyCustomFieldIds.length) {
      const existingDefs = await prisma.customField.findMany({
        where: { id: { in: nonEmptyCustomFieldIds }, isActive: true },
        select: { id: true },
      });
      const existingIds = new Set(existingDefs.map((d) => d.id));
      const missingIds = nonEmptyCustomFieldIds.filter((id) => !existingIds.has(id));
      if (missingIds.length) {
        return res.status(400).json({ error: `Invalid custom field IDs: ${missingIds.join(', ')}` });
      }
    }

    const customFieldData = Object.entries(nonEmptyCustomFields).map(([fieldId, value]: [string, any]) => ({
      fieldId,
      value: typeof value === 'object' ? JSON.stringify(value) : String(value),
    }));
    
    logger.info({ customFieldData }, 'Custom field data to create');

    // Create asset
    const asset = await prisma.asset.create({
      data: {
        assetTag,
        assetType,
        status: status || 'AVAILABLE',
        condition: condition || 'GOOD',
        source: 'MANUAL',
        make,
        model,
        serialNumber,
        specifications: specifications ? JSON.stringify(specifications) : null,
        assignedToId,
        assignedToAadId,
        departmentId,
        locationId,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        purchasePrice: purchasePrice ? new Prisma.Decimal(purchasePrice) : null,
        vendorId,
        warrantyStartDate: warrantyStartDate ? new Date(warrantyStartDate) : null,
        warrantyEndDate: warrantyEndDate ? new Date(warrantyEndDate) : null,
        warrantyNotes,
        notes,
        createdById: userId,
        customFieldValues: {
          create: customFieldData,
        },
        workloadCategories: categoryIds && Array.isArray(categoryIds) && categoryIds.length > 0
          ? {
              createMany: {
                data: categoryIds.map((cid: string) => ({ categoryId: cid })),
              },
            }
          : undefined,
      },
      include: {
        assignedTo: true,
        department: true,
        location: true,
        vendor: true,
        // @ts-ignore include workloadCategories relation
        workloadCategories: {
          include: {
            category: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
      },
    });

    // Log activity
    await logActivity(
      userId,
      ACTIVITY_ACTIONS.CREATE,
      ENTITY_TYPES.ASSET,
      asset.id,
      asset.id,
      { action: 'Asset created' }
    );

    // Parse specifications & custom field values for response
    const assetWithParsedSpecs = {
      ...asset,
      specifications: asset.specifications ? JSON.parse(asset.specifications) : null,
      customFields: (asset as any).customFieldValues?.reduce((obj: any, cfv: any) => {
        obj[cfv.fieldId] = cfv.value;
        return obj;
      }, {}) || {},
      // @ts-ignore workloadCategories will be generated
      workloadCategories: (asset as any).workloadCategories.map((link: any) => link.category),
    };

    res.status(201).json(assetWithParsedSpecs);
  } catch (error) {
    logger.error({ err: error }, 'Error creating asset');
    
    // Log more specific error details
    if (error instanceof Error) {
      logger.error({ name: error.name, message: error.message, stack: error.stack }, 'Error details');
    } else {
      logger.error('Non-Error object thrown:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    }
    
    // Log Prisma-specific errors
    if (error && typeof error === 'object' && 'code' in error) {
      logger.error({ prismaCode: (error as any).code }, 'Prisma error code');
      if ((error as any).meta) {
        logger.error('Prisma error meta:', JSON.stringify((error as any).meta, null, 2));
      }
      if ((error as any).clientVersion) {
        logger.error('Prisma client version:', (error as any).clientVersion);
      }
    }
    
    res.status(500).json({ error: 'Failed to create asset' });
  }
});

// PUT /api/assets/:id - Update asset (requires WRITE role)
router.put('/:id', requireRole([USER_ROLES.WRITE, USER_ROLES.ADMIN]), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = getUserId(user);
    const { id } = req.params;
    const updates = req.body;

    // Find existing asset
    const existingAsset = await prisma.asset.findUnique({
      where: { id },
    });

    if (!existingAsset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    // Fetch previous custom field values for change tracking
    const prevCustomFieldValues = await prisma.customFieldValue.findMany({
      where: { assetId: id },
    });

    // Validate enums if provided
    if (updates.assetType && !isValidAssetType(updates.assetType)) {
      return res.status(400).json({ error: 'Invalid asset type' });
    }
    if (updates.status && !isValidAssetStatus(updates.status)) {
      return res.status(400).json({ error: 'Invalid asset status' });
    }
    if (updates.condition && !isValidAssetCondition(updates.condition)) {
      return res.status(400).json({ error: 'Invalid asset condition' });
    }

    // Check unique constraints
    if (updates.assetTag && updates.assetTag !== existingAsset.assetTag) {
      const duplicateTag = await prisma.asset.findUnique({
        where: { assetTag: updates.assetTag },
      });
      if (duplicateTag) {
        return res.status(400).json({ error: 'Asset tag already exists' });
      }
    }

    if (updates.serialNumber && updates.serialNumber !== existingAsset.serialNumber) {
      const duplicateSerial = await prisma.asset.findFirst({
        where: { serialNumber: updates.serialNumber },
      });
      if (duplicateSerial) {
        return res.status(400).json({ error: 'Serial number already exists' });
      }
    }

    // Extract customFields from updates if present and filter out empty values
    const customFieldsUpdates = updates.customFields || {};
    const nonEmptyCustomFieldsUpdates = Object.fromEntries(
      Object.entries(customFieldsUpdates).filter(([_, value]) => value !== '' && value != null)
    );
    delete updates.customFields;

    // Extract categoryIds from updates if present
    const categoryIds = updates.categoryIds;
    delete updates.categoryIds;

    const updateCustomFieldIds = Object.keys(nonEmptyCustomFieldsUpdates);
    if (updateCustomFieldIds.length) {
      const defs = await prisma.customField.findMany({
        where: { id: { in: updateCustomFieldIds }, isActive: true },
        select: { id: true },
      });
      const existingSet = new Set(defs.map((d) => d.id));
      const missing = updateCustomFieldIds.filter((id) => !existingSet.has(id));
      if (missing.length) {
        return res.status(400).json({ error: `Invalid custom field IDs: ${missing.join(', ')}` });
      }
    }

    // Prepare update data
    const updateData: any = {
      ...updates,
      updatedById: userId,
    };

    // Handle special fields
    if (updates.specifications) {
      updateData.specifications = JSON.stringify(updates.specifications);
    }
    if (updates.purchaseDate) {
      updateData.purchaseDate = new Date(updates.purchaseDate);
    }
    if (updates.purchasePrice !== undefined) {
      updateData.purchasePrice = updates.purchasePrice ? new Prisma.Decimal(updates.purchasePrice) : null;
    }
    if (updates.warrantyStartDate) {
      updateData.warrantyStartDate = new Date(updates.warrantyStartDate);
    }
    if (updates.warrantyEndDate) {
      updateData.warrantyEndDate = new Date(updates.warrantyEndDate);
    }

    // Update asset
    const updateAssetPromise = prisma.asset.update({
      where: { id },
      data: updateData,
      include: {
        assignedTo: true,
        department: true,
        location: true,
        vendor: true,
        customFieldValues: {
          include: { field: true },
        },
        // @ts-ignore workloadCategories relation
        workloadCategories: {
          include: {
            category: true,
          },
        },
        updatedBy: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
      },
    });

    // Prepare upserts for custom field values
    const upsertPromises = Object.entries(nonEmptyCustomFieldsUpdates).map(([fieldId, value]: [string, any]) => {
      const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      return prisma.customFieldValue.upsert({
        where: {
          assetId_fieldId: {
            assetId: id,
            fieldId,
          },
        },
        update: {
          value: stringValue,
        },
        create: {
          assetId: id,
          fieldId,
          value: stringValue,
        },
      });
    });

    // Handle workload category updates if provided
    const categoryPromises = [];
    if (categoryIds !== undefined && Array.isArray(categoryIds)) {
      // Delete existing category links
      categoryPromises.push(
        prisma.assetWorkloadCategory.deleteMany({
          where: { assetId: id },
        })
      );
      
      // Create new category links
      if (categoryIds.length > 0) {
        categoryPromises.push(
          prisma.assetWorkloadCategory.createMany({
            data: categoryIds.map((categoryId: string) => ({
              assetId: id,
              categoryId,
            })),
          })
        );
      }
    }

    const [updatedAsset] = await prisma.$transaction([
      updateAssetPromise,
      ...upsertPromises,
      ...categoryPromises,
    ]);

    // Build changes object for activity log
    const changes: any = {};
    Object.keys(updates).forEach((key) => {
      if ((existingAsset as any)[key] !== updates[key]) {
        changes[key] = {
          from: (existingAsset as any)[key],
          to: updates[key],
        };
      }
    });

    // Custom field changes
    const prevCFMap = prevCustomFieldValues.reduce((obj: any, cfv: any) => {
      obj[cfv.fieldId] = cfv.value;
      return obj;
    }, {} as Record<string, any>);

    let customFieldChangeCount = 0;
    Object.entries(customFieldsUpdates).forEach(([fieldId, newVal]) => {
      const prevVal = prevCFMap[fieldId];
      if (prevVal !== newVal) {
        changes[`customField:${fieldId}`] = { from: prevVal, to: newVal };
        customFieldChangeCount += 1;
      }
    });

    if (customFieldChangeCount > 0) {
      changes.description = `${customFieldChangeCount} custom field(s) updated`;
    }

    // Log activity
    await logActivity(
      userId,
      ACTIVITY_ACTIONS.UPDATE,
      ENTITY_TYPES.ASSET,
      id,
      id,
      changes
    );

    // Parse specifications & custom field values for response
    const assetWithParsedSpecs = {
      ...updatedAsset,
      specifications: updatedAsset.specifications ? JSON.parse(updatedAsset.specifications) : null,
      customFields: updatedAsset.customFieldValues.reduce((obj: any, cfv: any) => {
        obj[cfv.fieldId] = cfv.value;
        return obj;
      }, {}),
      // @ts-ignore workloadCategories relation
      workloadCategories: (updatedAsset as any).workloadCategories?.map((link: any) => link.category) || [],
    };

    res.json(assetWithParsedSpecs);
  } catch (error) {
    logger.error('Error updating asset:', error);
    res.status(500).json({ error: 'Failed to update asset' });
  }
});

// PATCH /api/assets/:id - Partial update (requires WRITE role)
router.patch('/:id', requireRole([USER_ROLES.WRITE, USER_ROLES.ADMIN]), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = getUserId(user);
    const { id } = req.params;
    const updates = req.body;

    // Find existing asset
    const existingAsset = await prisma.asset.findUnique({
      where: { id },
    });

    if (!existingAsset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    // Fetch previous custom field values for change tracking
    const prevCustomFieldValues = await prisma.customFieldValue.findMany({
      where: { assetId: id },
    });

    // Validate enums if provided
    if (updates.assetType && !isValidAssetType(updates.assetType)) {
      return res.status(400).json({ error: 'Invalid asset type' });
    }
    if (updates.status && !isValidAssetStatus(updates.status)) {
      return res.status(400).json({ error: 'Invalid asset status' });
    }
    if (updates.condition && !isValidAssetCondition(updates.condition)) {
      return res.status(400).json({ error: 'Invalid asset condition' });
    }

    // Check unique constraints
    if (updates.assetTag && updates.assetTag !== existingAsset.assetTag) {
      const duplicateTag = await prisma.asset.findUnique({
        where: { assetTag: updates.assetTag },
      });
      if (duplicateTag) {
        return res.status(400).json({ error: 'Asset tag already exists' });
      }
    }

    if (updates.serialNumber && updates.serialNumber !== existingAsset.serialNumber) {
      const duplicateSerial = await prisma.asset.findFirst({
        where: { serialNumber: updates.serialNumber },
      });
      if (duplicateSerial) {
        return res.status(400).json({ error: 'Serial number already exists' });
      }
    }

    // Extract customFields from updates if present and filter out empty values
    const customFieldsUpdates = updates.customFields || {};
    const nonEmptyCustomFieldsUpdates = Object.fromEntries(
      Object.entries(customFieldsUpdates).filter(([_, value]) => value !== '' && value != null)
    );
    delete updates.customFields;

    const updateCustomFieldIds = Object.keys(nonEmptyCustomFieldsUpdates);
    if (updateCustomFieldIds.length) {
      const defs = await prisma.customField.findMany({
        where: { id: { in: updateCustomFieldIds }, isActive: true },
        select: { id: true },
      });
      const existingSet = new Set(defs.map((d) => d.id));
      const missing = updateCustomFieldIds.filter((id) => !existingSet.has(id));
      if (missing.length) {
        return res.status(400).json({ error: `Invalid custom field IDs: ${missing.join(', ')}` });
      }
    }

    // Prepare update data
    const updateData: any = {
      ...updates,
      updatedById: userId,
    };

    // Handle special fields
    if (updates.specifications) {
      updateData.specifications = JSON.stringify(updates.specifications);
    }
    if (updates.purchaseDate) {
      updateData.purchaseDate = new Date(updates.purchaseDate);
    }
    if (updates.purchasePrice !== undefined) {
      updateData.purchasePrice = updates.purchasePrice ? new Prisma.Decimal(updates.purchasePrice) : null;
    }
    if (updates.warrantyStartDate) {
      updateData.warrantyStartDate = new Date(updates.warrantyStartDate);
    }
    if (updates.warrantyEndDate) {
      updateData.warrantyEndDate = new Date(updates.warrantyEndDate);
    }

    // Update asset
    const updateAssetPromise = prisma.asset.update({
      where: { id },
      data: updateData,
      include: {
        assignedTo: true,
        department: true,
        location: true,
        vendor: true,
        customFieldValues: {
          include: { field: true },
        },
        // @ts-ignore workloadCategories relation
        workloadCategories: {
          include: {
            category: true,
          },
        },
        updatedBy: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
      },
    });

    // Prepare upserts for custom field values
    const upsertPromises = Object.entries(nonEmptyCustomFieldsUpdates).map(([fieldId, value]: [string, any]) => {
      const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      return prisma.customFieldValue.upsert({
        where: {
          assetId_fieldId: {
            assetId: id,
            fieldId,
          },
        },
        update: {
          value: stringValue,
        },
        create: {
          assetId: id,
          fieldId,
          value: stringValue,
        },
      });
    });

    const [updatedAsset] = await prisma.$transaction([
      updateAssetPromise,
      ...upsertPromises,
    ]);

    // Build changes object for activity log
    const changes: any = {};
    Object.keys(updates).forEach((key) => {
      if ((existingAsset as any)[key] !== updates[key]) {
        changes[key] = {
          from: (existingAsset as any)[key],
          to: updates[key],
        };
      }
    });

    // Custom field changes
    const prevCFMap = prevCustomFieldValues.reduce((obj: any, cfv: any) => {
      obj[cfv.fieldId] = cfv.value;
      return obj;
    }, {} as Record<string, any>);

    let customFieldChangeCount = 0;
    Object.entries(customFieldsUpdates).forEach(([fieldId, newVal]) => {
      const prevVal = prevCFMap[fieldId];
      if (prevVal !== newVal) {
        changes[`customField:${fieldId}`] = { from: prevVal, to: newVal };
        customFieldChangeCount += 1;
      }
    });

    if (customFieldChangeCount > 0) {
      changes.description = `${customFieldChangeCount} custom field(s) updated`;
    }

    // Log activity
    await logActivity(
      userId,
      ACTIVITY_ACTIONS.UPDATE,
      ENTITY_TYPES.ASSET,
      id,
      id,
      changes
    );

    // Parse specifications & custom field values for response
    const assetWithParsedSpecs = {
      ...updatedAsset,
      specifications: updatedAsset.specifications ? JSON.parse(updatedAsset.specifications) : null,
      customFields: updatedAsset.customFieldValues.reduce((obj: any, cfv: any) => {
        obj[cfv.fieldId] = cfv.value;
        return obj;
      }, {}),
    };

    res.json(assetWithParsedSpecs);
  } catch (error) {
    logger.error('Error updating asset:', error);
    res.status(500).json({ error: 'Failed to update asset' });
  }
});

// DELETE /api/assets/:id - Delete asset (requires ADMIN role)
router.delete('/:id', requireRole([USER_ROLES.ADMIN]), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = getUserId(user);
    const { id } = req.params;

    // Check if asset exists
    const asset = await prisma.asset.findUnique({
      where: { id },
    });

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    // --- NEW: Log activity BEFORE deleting the asset to avoid FK constraint errors ---
    await logActivity(
      userId,
      ACTIVITY_ACTIONS.DELETE,
      ENTITY_TYPES.ASSET,
      id,
      id,
      { assetTag: asset.assetTag, deletedAt: new Date() }
    );

    // Delete asset (cascades to related records). After deletion, the FK on ActivityLog will
    // automatically set `assetId` to NULL (because of onDelete: SetNull), so the previously
    // inserted log record remains valid.
    await prisma.asset.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting asset:', error);
    res.status(500).json({ error: 'Failed to delete asset' });
  }
});

// POST /api/assets/bulk - Bulk operations (requires WRITE role)
router.post('/bulk', requireRole([USER_ROLES.WRITE, USER_ROLES.ADMIN]), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = getUserId(user);
    const { operation, assetIds, updates } = req.body;

    if (!operation || !assetIds || !Array.isArray(assetIds) || assetIds.length === 0) {
      return res.status(400).json({ 
        error: 'Invalid bulk operation. Required: operation, assetIds array' 
      });
    }

    switch (operation) {
      case 'update':
        if (!updates || Object.keys(updates).length === 0) {
          return res.status(400).json({ error: 'No updates provided' });
        }

        // Validate updates
        if (updates.status && !isValidAssetStatus(updates.status)) {
          return res.status(400).json({ error: 'Invalid asset status' });
        }
        if (updates.condition && !isValidAssetCondition(updates.condition)) {
          return res.status(400).json({ error: 'Invalid asset condition' });
        }

        // Prepare update data
        const bulkUpdateData: any = {
          ...updates,
          updatedById: userId,
        };

        // Execute bulk update
        const updateResult = await prisma.asset.updateMany({
          where: { id: { in: assetIds } },
          data: bulkUpdateData,
        });

        // Log activity for each asset
        await Promise.all(
          assetIds.map((assetId) =>
            logActivity(
              userId,
              ACTIVITY_ACTIONS.BULK_UPDATE,
              ENTITY_TYPES.ASSET,
              assetId,
              assetId,
              { operation: 'bulk_update', updates }
            )
          )
        );

        res.json({
          operation: 'update',
          affected: updateResult.count,
          assetIds,
        });
        break;

      case 'delete':
        if ((req as any).user.role !== USER_ROLES.ADMIN) {
          return res.status(403).json({ error: 'Only admins can bulk delete assets' });
        }

        const deleteResult = await prisma.asset.deleteMany({
          where: { id: { in: assetIds } },
        });

        // Log activity
        await logActivity(
          userId,
          ACTIVITY_ACTIONS.DELETE,
          ENTITY_TYPES.ASSET,
          'bulk',
          undefined,
          { operation: 'bulk_delete', assetIds, count: deleteResult.count }
        );

        res.json({
          operation: 'delete',
          affected: deleteResult.count,
          assetIds,
        });
        break;

      default:
        res.status(400).json({ error: 'Invalid operation. Supported: update, delete' });
    }
  } catch (error) {
    logger.error('Error in bulk operation:', error);
    res.status(500).json({ error: 'Failed to perform bulk operation' });
  }
});

// GET /api/assets/export - Export assets to CSV or Excel
router.get('/export', async (req: Request, res: Response) => {
  try {
    const { format = 'csv', ...filters } = req.query;
    const user = (req as any).user;
    const userId = getUserId(user);

    // Build where clause using same logic as the main GET route
    const where: Prisma.AssetWhereInput = {};

    if (filters.search) {
      const searchStr = filters.search as string;
      where.OR = [
        { assetTag: { contains: searchStr } },
        { make: { contains: searchStr } },
        { model: { contains: searchStr } },
        { serialNumber: { contains: searchStr } },
        { notes: { contains: searchStr } },
        // Search within custom field values
        {
          customFieldValues: {
            some: {
              value: {
                contains: searchStr,
              },
            },
          },
        },
      ];
    }

    if (filters.status && isValidAssetStatus(filters.status as string)) {
      where.status = filters.status as string;
    }
    if (filters.condition && isValidAssetCondition(filters.condition as string)) {
      where.condition = filters.condition as string;
    }
    if (filters.assetType && isValidAssetType(filters.assetType as string)) {
      where.assetType = filters.assetType as string;
    }
    if (filters.departmentId) {
      where.departmentId = filters.departmentId as string;
    }
    if (filters.locationId) {
      where.locationId = filters.locationId as string;
    }
    if (filters.assignedToId) {
      where.assignedToId = filters.assignedToId as string;
    }

    // Fetch all matching assets
    const assets = await prisma.asset.findMany({
      where,
      include: {
        assignedTo: {
          select: {
            displayName: true,
            email: true,
          },
        },
        department: true,
        location: true,
        vendor: true,
      },
      orderBy: { assetTag: 'asc' },
    });

    // Log export activity
    await logActivity(
      userId,
      ACTIVITY_ACTIONS.EXPORT,
      ENTITY_TYPES.ASSET,
      'export',
      undefined,
      {
        format,
        count: assets.length,
        filters: where,
      }
    );

    if (format === 'excel') {
      // Import ExcelJS dynamically
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Assets');

      // Define columns
      worksheet.columns = [
        { header: 'Asset Tag', key: 'assetTag', width: 15 },
        { header: 'Type', key: 'assetType', width: 12 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Condition', key: 'condition', width: 12 },
        { header: 'Make', key: 'make', width: 15 },
        { header: 'Model', key: 'model', width: 20 },
        { header: 'Serial Number', key: 'serialNumber', width: 20 },
        { header: 'Assigned To', key: 'assignedTo', width: 25 },
        { header: 'Department', key: 'department', width: 20 },
        { header: 'Location', key: 'location', width: 20 },
        { header: 'Vendor', key: 'vendor', width: 20 },
        { header: 'Purchase Date', key: 'purchaseDate', width: 15 },
        { header: 'Purchase Price', key: 'purchasePrice', width: 15 },
        { header: 'Warranty End', key: 'warrantyEndDate', width: 15 },
        { header: 'Notes', key: 'notes', width: 30 },
      ];

      // Add rows
      assets.forEach((asset) => {
        worksheet.addRow({
          assetTag: asset.assetTag,
          assetType: asset.assetType,
          status: asset.status,
          condition: asset.condition,
          make: asset.make,
          model: asset.model,
          serialNumber: asset.serialNumber || '',
          assignedTo: asset.assignedTo ? `${asset.assignedTo.displayName} (${asset.assignedTo.email})` : '',
          department: asset.department?.name || '',
          location: asset.location ? `${asset.location.city}, ${asset.location.province}` : '',
          vendor: asset.vendor?.name || '',
          purchaseDate: asset.purchaseDate ? asset.purchaseDate.toISOString().split('T')[0] : '',
          purchasePrice: asset.purchasePrice ? asset.purchasePrice.toString() : '',
          warrantyEndDate: asset.warrantyEndDate ? asset.warrantyEndDate.toISOString().split('T')[0] : '',
          notes: asset.notes || '',
        });
      });

      // Style the header row
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };

      // Set response headers
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=assets_export_${new Date().toISOString().split('T')[0]}.xlsx`);

      // Write to response
      await workbook.xlsx.write(res);
      res.end();
    } else {
      // CSV Export
      const csvWriter = await import('csv-writer');
      const createCsvStringifier = csvWriter.createObjectCsvStringifier;

      const csvStringifier = createCsvStringifier({
        header: [
          { id: 'assetTag', title: 'Asset Tag' },
          { id: 'assetType', title: 'Type' },
          { id: 'status', title: 'Status' },
          { id: 'condition', title: 'Condition' },
          { id: 'make', title: 'Make' },
          { id: 'model', title: 'Model' },
          { id: 'serialNumber', title: 'Serial Number' },
          { id: 'assignedTo', title: 'Assigned To' },
          { id: 'department', title: 'Department' },
          { id: 'location', title: 'Location' },
          { id: 'vendor', title: 'Vendor' },
          { id: 'purchaseDate', title: 'Purchase Date' },
          { id: 'purchasePrice', title: 'Purchase Price' },
          { id: 'warrantyEndDate', title: 'Warranty End' },
          { id: 'notes', title: 'Notes' },
        ],
      });

      const records = assets.map((asset) => ({
        assetTag: asset.assetTag,
        assetType: asset.assetType,
        status: asset.status,
        condition: asset.condition,
        make: asset.make,
        model: asset.model,
        serialNumber: asset.serialNumber || '',
        assignedTo: asset.assignedTo ? `${asset.assignedTo.displayName} (${asset.assignedTo.email})` : '',
        department: asset.department?.name || '',
        location: asset.location ? `${asset.location.city}, ${asset.location.province}` : '',
        vendor: asset.vendor?.name || '',
        purchaseDate: asset.purchaseDate ? asset.purchaseDate.toISOString().split('T')[0] : '',
        purchasePrice: asset.purchasePrice ? asset.purchasePrice.toString() : '',
        warrantyEndDate: asset.warrantyEndDate ? asset.warrantyEndDate.toISOString().split('T')[0] : '',
        notes: asset.notes || '',
      }));

      const csvOutput = csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);

      // Set response headers
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=assets_export_${new Date().toISOString().split('T')[0]}.csv`);

      res.send(csvOutput);
    }
  } catch (error) {
    logger.error('Error exporting assets:', error);
    res.status(500).json({ error: 'Failed to export assets' });
  }
});

export default router; 