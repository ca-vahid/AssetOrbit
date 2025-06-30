import { Router } from 'express';
import type { Request, Response } from 'express';
import prisma from '../services/database';
import { authenticateJwt, requireRole } from '../middleware/auth';
import logger from '../utils/logger';
import { USER_ROLES } from '../constants';

const router = Router();

// All routes require authentication
router.use(authenticateJwt);

// GET /api/departments - Get all departments
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

    const departments = await prisma.department.findMany({
      where,
      include: {
        _count: {
          select: {
            assets: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json(departments);
  } catch (error) {
    logger.error('Error fetching departments:', error);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

// POST /api/departments - Create new department (requires ADMIN)
router.post('/', requireRole([USER_ROLES.ADMIN]), async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Department name is required' });
    }

    // Check if department already exists
    const existing = await prisma.department.findUnique({
      where: { name },
    });

    if (existing) {
      return res.status(400).json({ error: 'Department already exists' });
    }

    const department = await prisma.department.create({
      data: {
        name,
        description,
      },
    });

    res.status(201).json(department);
  } catch (error) {
    logger.error('Error creating department:', error);
    res.status(500).json({ error: 'Failed to create department' });
  }
});

// PUT /api/departments/:id - Update department (requires ADMIN)
router.put('/:id', requireRole([USER_ROLES.ADMIN]), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, isActive } = req.body;

    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (isActive !== undefined) updates.isActive = isActive;

    const department = await prisma.department.update({
      where: { id },
      data: updates,
    });

    res.json(department);
  } catch (error) {
    logger.error('Error updating department:', error);
    res.status(500).json({ error: 'Failed to update department' });
  }
});

export default router; 