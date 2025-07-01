import { Router } from 'express';
import type { Request, Response } from 'express';
import prisma from '../services/database';
import { authenticateJwt, requireRole } from '../middleware/auth';
import logger from '../utils/logger';
import { CUSTOM_FIELD_TYPES, isValidCustomFieldType, USER_ROLES, ACTIVITY_ACTIONS, ENTITY_TYPES } from '../constants';

const router = Router();

// All routes require authentication
router.use(authenticateJwt);

// Helper: log activity (reuse simple inline for now)
async function logActivity(userId: string, action: string, entityId: string, changes?: any) {
  try {
    let changesStr: string | null = null;
    if (changes) {
      try {
        changesStr = JSON.stringify(changes);
        // Truncate to 3900 chars to stay within NVARCHAR(4000) limit
        if (changesStr.length > 3900) {
          changesStr = changesStr.slice(0, 3900);
        }
      } catch (jsonErr) {
        changesStr = null;
      }
    }

    await prisma.activityLog.create({
      data: {
        userId,
        action,
        entityType: ENTITY_TYPES.CUSTOM_FIELD,
        entityId,
        changes: changesStr,
      },
    });
  } catch (err: any) {
    logger.error('Failed to log activity:', err?.message || err);
  }
}

// GET /api/custom-fields - list definitions (optionally includeInactive)
router.get('/', async (req: Request, res: Response) => {
  try {
    const { includeInactive = 'false' } = req.query;

    const where: any = {};
    if (includeInactive !== 'true') {
      where.isActive = true;
    }

    const fields = await prisma.customField.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });

    // Parse options JSON strings back to arrays
    const fieldsWithParsedOptions = fields.map(field => ({
      ...field,
      options: field.options ? JSON.parse(field.options) : null,
    }));

    res.json(fieldsWithParsedOptions);
  } catch (error) {
    logger.error('Error fetching custom fields:', error);
    res.status(500).json({ error: 'Failed to fetch custom fields' });
  }
});

// POST /api/custom-fields - create definition (ADMIN only)
router.post('/', requireRole([USER_ROLES.ADMIN]), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId || (req as any).user?.dbUser?.id;
    const { name, fieldType, isRequired = false, options = null } = req.body;

    if (!name || !fieldType) {
      return res.status(400).json({ error: 'name and fieldType are required' });
    }

    if (!isValidCustomFieldType(fieldType)) {
      return res.status(400).json({ error: 'Invalid custom field type' });
    }

    // Check duplicate
    const existing = await prisma.customField.findUnique({ where: { name } });
    if (existing) {
      return res.status(400).json({ error: 'Custom field with this name already exists' });
    }

    const field = await prisma.customField.create({
      data: {
        name,
        fieldType,
        isRequired,
        options: options ? JSON.stringify(options) : null,
      },
    });

    await logActivity(userId, ACTIVITY_ACTIONS.CREATE, field.id, { action: 'CustomField created' });
    
    // Return with parsed options
    const fieldWithParsedOptions = {
      ...field,
      options: field.options ? JSON.parse(field.options) : null,
    };
    
    res.status(201).json(fieldWithParsedOptions);
  } catch (error) {
    logger.error('Error creating custom field:', error);
    res.status(500).json({ error: 'Failed to create custom field' });
  }
});

// PUT /api/custom-fields/:id - update definition (ADMIN only)
router.put('/:id', requireRole([USER_ROLES.ADMIN]), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId || (req as any).user?.dbUser?.id;
    const { id } = req.params;
    const updates = req.body;

    if (updates.fieldType && !isValidCustomFieldType(updates.fieldType)) {
      return res.status(400).json({ error: 'Invalid custom field type' });
    }

    if (updates.options) {
      updates.options = JSON.stringify(updates.options);
    }

    const field = await prisma.customField.update({
      where: { id },
      data: updates,
    });

    await logActivity(userId, ACTIVITY_ACTIONS.UPDATE, id, updates);
    
    // Return with parsed options
    const fieldWithParsedOptions = {
      ...field,
      options: field.options ? JSON.parse(field.options) : null,
    };
    
    res.json(fieldWithParsedOptions);
  } catch (error) {
    logger.error('Error updating custom field:', error);
    res.status(500).json({ error: 'Failed to update custom field' });
  }
});

export default router; 