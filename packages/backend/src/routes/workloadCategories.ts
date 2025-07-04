import { Router } from 'express';
import type { Request, Response } from 'express';
import prisma from '../services/database.js';
import { authenticateJwt, requireRole } from '../middleware/auth.js';
import logger from '../utils/logger.js';
import { USER_ROLES } from '../constants/index.js';

const router = Router();

// All routes require authentication
router.use(authenticateJwt);

// GET /api/workload-categories - Get all categories
router.get('/', async (req: Request, res: Response) => {
  try {
    const { search, isActive = 'true' } = req.query;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search as string } },
        { description: { contains: search as string } },
      ];
    }

    if (isActive === 'true') {
      where.isActive = true;
    } else if (isActive === 'false') {
      where.isActive = false;
    }

    const categories = await prisma.workloadCategory.findMany({
      where,
      include: {
        _count: {
          select: {
            assetLinks: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json(categories);
  } catch (error) {
    logger.error('Error fetching workload categories:', error);
    res.status(500).json({ error: 'Failed to fetch workload categories' });
  }
});

// POST /api/workload-categories - Create new category (requires ADMIN)
router.post('/', requireRole([USER_ROLES.ADMIN]), async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    // Check if category already exists
    const existing = await prisma.workloadCategory.findUnique({
      where: { name },
    });

    if (existing) {
      return res.status(400).json({ error: 'Category already exists' });
    }

    const category = await prisma.workloadCategory.create({
      data: {
        name,
        description,
      },
    });

    res.status(201).json(category);
  } catch (error) {
    logger.error('Error creating workload category:', error);
    res.status(500).json({ error: 'Failed to create workload category' });
  }
});

// PUT /api/workload-categories/:id - Update category (requires ADMIN)
router.put('/:id', requireRole([USER_ROLES.ADMIN]), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, isActive } = req.body;

    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (isActive !== undefined) updates.isActive = isActive;

    const category = await prisma.workloadCategory.update({
      where: { id },
      data: updates,
    });

    res.json(category);
  } catch (error) {
    logger.error('Error updating workload category:', error);
    res.status(500).json({ error: 'Failed to update workload category' });
  }
});

export default router; 