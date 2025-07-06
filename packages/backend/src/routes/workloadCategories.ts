import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticateJwt, requireRole } from '../middleware/auth';
import prisma from '../services/database';
import logger from '../utils/logger';
import { USER_ROLES } from '../constants/index';

const router = Router();

router.use(authenticateJwt);

// Valid operators for rules
const VALID_OPERATORS = ['=', '!=', '>=', '<=', '>', '<', 'includes', 'regex'];

// Valid source fields based on actual Asset model
const VALID_SOURCE_FIELDS = [
  // Direct Asset fields
  'assetType', 'status', 'condition', 'make', 'model', 'serialNumber', 'source',
  'assignedToId', 'assignedToAadId', 'purchasePrice',
  // Nested specification fields (stored in JSON)
  'specifications.processor', 'specifications.ram', 'specifications.storage', 
  'specifications.operatingSystem', 'specifications.graphics', 'specifications.osVersion',
  'specifications.batteryHealth', 'specifications.connectivity', 'specifications.imei',
  'specifications.carrier', 'specifications.phoneNumber', 'specifications.planType',
  'specifications.lastOnline', 'specifications.complianceState',
  // Relations (IDs)
  'departmentId', 'locationId', 'vendorId'
];

// Helper function to validate rule data
function validateRuleData(data: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.categoryId || typeof data.categoryId !== 'string') {
    errors.push('Category ID is required and must be a string');
  }

  if (!data.sourceField || typeof data.sourceField !== 'string') {
    errors.push('Source field is required and must be a string');
  } else if (!VALID_SOURCE_FIELDS.includes(data.sourceField)) {
    errors.push(`Invalid source field. Must be one of: ${VALID_SOURCE_FIELDS.join(', ')}`);
  }

  if (!data.operator || typeof data.operator !== 'string') {
    errors.push('Operator is required and must be a string');
  } else if (!VALID_OPERATORS.includes(data.operator)) {
    errors.push(`Invalid operator. Must be one of: ${VALID_OPERATORS.join(', ')}`);
  }

  if (data.value === undefined || data.value === null || data.value === '') {
    errors.push('Value is required and cannot be empty');
  }

  if (data.priority !== undefined && (typeof data.priority !== 'number' || data.priority < 1)) {
    errors.push('Priority must be a positive number (1 or greater)');
  }

  // Validate regex patterns
  if (data.operator === 'regex' && data.value) {
    try {
      new RegExp(data.value);
    } catch (e) {
      errors.push('Invalid regular expression pattern');
    }
  }

  // Validate numeric operators have numeric values
  if (['>=', '<=', '>', '<'].includes(data.operator) && data.value) {
    const numValue = Number(data.value);
    if (isNaN(numValue)) {
      errors.push('Numeric operators require numeric values');
    }
  }

  return { isValid: errors.length === 0, errors };
}

// Helper function to test a rule against sample data
function testRule(sourceField: string, operator: string, value: string, testData: any): { result: boolean; error?: string } {
  try {
    // Get nested value
    const fieldValue = sourceField.split('.').reduce((obj, key) => obj?.[key], testData);
    
    if (fieldValue === null || fieldValue === undefined) {
      return { result: false };
    }

    const stringValue = String(fieldValue).toLowerCase();
    const ruleValue = String(value).toLowerCase();
    
    switch (operator) {
      case '=':
        return { result: stringValue === ruleValue };
      case '!=':
        return { result: stringValue !== ruleValue };
      case '>=':
        return { result: Number(fieldValue) >= Number(value) };
      case '<=':
        return { result: Number(fieldValue) <= Number(value) };
      case '>':
        return { result: Number(fieldValue) > Number(value) };
      case '<':
        return { result: Number(fieldValue) < Number(value) };
      case 'includes':
        return { result: stringValue.includes(ruleValue) };
      case 'regex':
        return { result: new RegExp(value, 'i').test(String(fieldValue)) };
      default:
        return { result: false, error: 'Unknown operator' };
    }
  } catch (error) {
    return { result: false, error: error instanceof Error ? error.message : 'Test failed' };
  }
}

// GET /api/workload-categories - Get all workload categories
router.get('/', async (req: Request, res: Response) => {
  try {
    const categories = await prisma.workloadCategory.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: { assetLinks: true, rules: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    res.json(categories);
  } catch (error) {
    logger.error('Error fetching workload categories:', error);
    res.status(500).json({ error: 'Failed to fetch workload categories' });
  }
});

// POST /api/workload-categories - Create new workload category (Admin only)
router.post('/', requireRole([USER_ROLES.ADMIN]), async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Name is required and must be a non-empty string' });
    }

    if (name.trim().length > 100) {
      return res.status(400).json({ error: 'Name must be 100 characters or less' });
    }

    if (description && typeof description !== 'string') {
      return res.status(400).json({ error: 'Description must be a string' });
    }

    if (description && description.length > 500) {
      return res.status(400).json({ error: 'Description must be 500 characters or less' });
    }

    const category = await prisma.workloadCategory.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        entityType: 'workload_category',
        entityId: category.id,
        action: 'CREATE',
        changes: `Workload category "${name.trim()}" created`,
        userId: (req as any).user?.userId!,
      },
    });

    res.status(201).json(category);
  } catch (error) {
    logger.error('Error creating workload category:', error);
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return res.status(400).json({ error: 'A workload category with this name already exists' });
    }
    res.status(500).json({ error: 'Failed to create workload category' });
  }
});

// PUT /api/workload-categories/:id - Update workload category (Admin only)
router.put('/:id', requireRole([USER_ROLES.ADMIN]), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, isActive } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Name is required and must be a non-empty string' });
    }

    if (name.trim().length > 100) {
      return res.status(400).json({ error: 'Name must be 100 characters or less' });
    }

    if (description && typeof description !== 'string') {
      return res.status(400).json({ error: 'Description must be a string' });
    }

    if (description && description.length > 500) {
      return res.status(400).json({ error: 'Description must be 500 characters or less' });
    }

    const category = await prisma.workloadCategory.update({
      where: { id },
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        entityType: 'workload_category',
        entityId: category.id,
        action: 'UPDATE',
        changes: `Workload category "${name.trim()}" updated`,
        userId: (req as any).user?.userId!,
      },
    });

    res.json(category);
  } catch (error) {
    logger.error('Error updating workload category:', error);
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return res.status(400).json({ error: 'A workload category with this name already exists' });
    }
    if (error instanceof Error && error.message.includes('Record to update not found')) {
      return res.status(404).json({ error: 'Workload category not found' });
    }
    res.status(500).json({ error: 'Failed to update workload category' });
  }
});

// DELETE /api/workload-categories/:id - Soft delete workload category (Admin only)
router.delete('/:id', requireRole([USER_ROLES.ADMIN]), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if category exists
    const category = await prisma.workloadCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: { assetLinks: true, rules: true }
        }
      }
    });

    if (!category) {
      return res.status(404).json({ error: 'Workload category not found' });
    }

    // Check if category has assets assigned
    if (category._count.assetLinks > 0) {
      return res.status(400).json({ 
        error: `Cannot delete category with ${category._count.assetLinks} assigned assets. Please reassign assets first.` 
      });
    }

    // Soft delete the category and its rules
    await prisma.$transaction([
      prisma.workloadCategory.update({
        where: { id },
        data: { isActive: false },
      }),
      prisma.workloadCategoryRule.updateMany({
        where: { categoryId: id },
        data: { isActive: false },
      })
    ]);

    // Log activity
    await prisma.activityLog.create({
      data: {
        entityType: 'workload_category',
        entityId: id,
        action: 'DELETE',
        changes: `Workload category "${category.name}" soft deleted along with ${category._count.rules} rules`,
        userId: (req as any).user?.userId!,
      },
    });

    res.json({ message: 'Workload category deleted successfully' });
  } catch (error) {
    logger.error('Error deleting workload category:', error);
    res.status(500).json({ error: 'Failed to delete workload category' });
  }
});

// GET /api/workload-categories/rules - Get all workload category rules (Admin only)
router.get('/rules', requireRole([USER_ROLES.ADMIN]), async (req: Request, res: Response) => {
  try {
    const { categoryId, isActive } = req.query;
    
    const where: any = {};
    
    if (categoryId) {
      where.categoryId = categoryId as string;
    }
    
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const rules = await prisma.workloadCategoryRule.findMany({
      where,
      include: {
        category: {
          select: { id: true, name: true, description: true, isActive: true }
        }
      },
      orderBy: [
        { priority: 'asc' },
        { createdAt: 'desc' }
      ]
    });

    res.json(rules);
  } catch (error) {
    logger.error('Error fetching workload category rules:', error);
    res.status(500).json({ error: 'Failed to fetch workload category rules' });
  }
});

// POST /api/workload-categories/rules - Create new workload category rule (Admin only)
router.post('/rules', requireRole([USER_ROLES.ADMIN]), async (req: Request, res: Response) => {
  try {
    const { categoryId, priority, sourceField, operator, value, description, isActive } = req.body;

    // Validate input data
    const validation = validateRuleData({ categoryId, priority, sourceField, operator, value, description, isActive });
    if (!validation.isValid) {
      return res.status(400).json({ error: validation.errors.join('; ') });
    }

    // Check if category exists and is active
    const category = await prisma.workloadCategory.findUnique({
      where: { id: categoryId }
    });

    if (!category) {
      return res.status(400).json({ error: 'Category not found' });
    }

    if (!category.isActive) {
      return res.status(400).json({ error: 'Cannot create rules for inactive categories' });
    }

    // Check for duplicate priority within the same category
    const existingRule = await prisma.workloadCategoryRule.findFirst({
      where: {
        categoryId,
        priority: priority || 999,
        isActive: true
      }
    });

    if (existingRule) {
      return res.status(400).json({ 
        error: `A rule with priority ${priority || 999} already exists for this category. Please use a different priority.` 
      });
    }

    const rule = await prisma.workloadCategoryRule.create({
      data: {
        categoryId,
        priority: priority || 999,
        sourceField: sourceField.trim(),
        operator,
        value: String(value).trim(),
        description: description?.trim() || null,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
      include: {
        category: {
          select: { id: true, name: true, description: true }
        }
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        entityType: 'workload_category_rule',
        entityId: rule.id,
        action: 'CREATE',
        changes: `Workload category rule created: ${sourceField} ${operator} "${value}" (priority ${rule.priority})`,
        userId: (req as any).user?.userId!,
      },
    });

    res.status(201).json(rule);
  } catch (error) {
    logger.error('Error creating workload category rule:', error);
    res.status(500).json({ error: 'Failed to create workload category rule' });
  }
});

// PUT /api/workload-categories/rules/:id - Update workload category rule (Admin only)
router.put('/rules/:id', requireRole([USER_ROLES.ADMIN]), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { categoryId, priority, sourceField, operator, value, description, isActive } = req.body;

    // Validate input data
    const validation = validateRuleData({ categoryId, priority, sourceField, operator, value, description, isActive });
    if (!validation.isValid) {
      return res.status(400).json({ error: validation.errors.join('; ') });
    }

    // Check if rule exists
    const existingRule = await prisma.workloadCategoryRule.findUnique({
      where: { id }
    });

    if (!existingRule) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    // Check if category exists and is active
    const category = await prisma.workloadCategory.findUnique({
      where: { id: categoryId }
    });

    if (!category) {
      return res.status(400).json({ error: 'Category not found' });
    }

    if (!category.isActive) {
      return res.status(400).json({ error: 'Cannot update rules for inactive categories' });
    }

    // Check for duplicate priority within the same category (excluding current rule)
    const duplicateRule = await prisma.workloadCategoryRule.findFirst({
      where: {
        categoryId,
        priority: priority || 999,
        isActive: true,
        id: { not: id }
      }
    });

    if (duplicateRule) {
      return res.status(400).json({ 
        error: `A rule with priority ${priority || 999} already exists for this category. Please use a different priority.` 
      });
    }

    const rule = await prisma.workloadCategoryRule.update({
      where: { id },
      data: {
        categoryId,
        priority: priority || 999,
        sourceField: sourceField.trim(),
        operator,
        value: String(value).trim(),
        description: description?.trim() || null,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
      include: {
        category: {
          select: { id: true, name: true, description: true }
        }
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        entityType: 'workload_category_rule',
        entityId: rule.id,
        action: 'UPDATE',
        changes: `Workload category rule updated: ${sourceField} ${operator} "${value}" (priority ${rule.priority})`,
        userId: (req as any).user?.userId!,
      },
    });

    res.json(rule);
  } catch (error) {
    logger.error('Error updating workload category rule:', error);
    res.status(500).json({ error: 'Failed to update workload category rule' });
  }
});

// DELETE /api/workload-categories/rules/:id - Delete workload category rule (Admin only)
router.delete('/rules/:id', requireRole([USER_ROLES.ADMIN]), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if rule exists
    const rule = await prisma.workloadCategoryRule.findUnique({
      where: { id },
      include: {
        category: { select: { name: true } }
      }
    });

    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    await prisma.workloadCategoryRule.delete({
      where: { id }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        entityType: 'workload_category_rule',
        entityId: id,
        action: 'DELETE',
        changes: `Workload category rule deleted: ${rule.sourceField} ${rule.operator} "${rule.value}" (${rule.category.name})`,
        userId: (req as any).user?.userId!,
      },
    });

    res.json({ message: 'Workload category rule deleted successfully' });
  } catch (error) {
    logger.error('Error deleting workload category rule:', error);
    res.status(500).json({ error: 'Failed to delete workload category rule' });
  }
});

// POST /api/workload-categories/rules/test - Test a rule against sample data (Admin only)
router.post('/rules/test', requireRole([USER_ROLES.ADMIN]), async (req: Request, res: Response) => {
  try {
    const { sourceField, operator, value, testData } = req.body;

    if (!sourceField || !operator || value === undefined) {
      return res.status(400).json({ error: 'sourceField, operator, and value are required' });
    }

    if (!VALID_OPERATORS.includes(operator)) {
      return res.status(400).json({ error: `Invalid operator. Must be one of: ${VALID_OPERATORS.join(', ')}` });
    }

    const result = testRule(sourceField, operator, value, testData || {});
    
    res.json({
      result: result.result,
      error: result.error,
      explanation: `Testing "${sourceField}" ${operator} "${value}" against provided data`
    });
  } catch (error) {
    logger.error('Error testing rule:', error);
    res.status(500).json({ error: 'Failed to test rule' });
  }
});

// GET /api/workload-categories/rules/fields - Get valid source fields (Admin only)
router.get('/rules/fields', requireRole([USER_ROLES.ADMIN]), async (req: Request, res: Response) => {
  try {
    res.json({
      fields: VALID_SOURCE_FIELDS,
      operators: VALID_OPERATORS
    });
  } catch (error) {
    logger.error('Error fetching rule fields:', error);
    res.status(500).json({ error: 'Failed to fetch rule fields' });
  }
});

export default router; 