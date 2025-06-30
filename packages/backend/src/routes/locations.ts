import { Router } from 'express';
import type { Request, Response } from 'express';
import prisma from '../services/database';
import { authenticateJwt, requireRole } from '../middleware/auth';
import logger from '../utils/logger';
import { USER_ROLES } from '../constants';

const router = Router();

// All routes require authentication
router.use(authenticateJwt);

// GET /api/locations - Get all locations
router.get('/', async (req: Request, res: Response) => {
  try {
    const { search, isActive = 'true' } = req.query;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search as string } },
        { building: { contains: search as string } },
        { room: { contains: search as string } },
        { city: { contains: search as string } },
      ];
    }

    if (isActive === 'true') {
      where.isActive = true;
    } else if (isActive === 'false') {
      where.isActive = false;
    }

    const locations = await prisma.location.findMany({
      where,
      include: {
        _count: {
          select: {
            assets: true,
          },
        },
      },
      orderBy: [
        { building: 'asc' },
        { name: 'asc' },
      ],
    });

    res.json(locations);
  } catch (error) {
    logger.error('Error fetching locations:', error);
    res.status(500).json({ error: 'Failed to fetch locations' });
  }
});

// POST /api/locations - Create new location (requires ADMIN)
router.post('/', requireRole([USER_ROLES.ADMIN]), async (req: Request, res: Response) => {
  try {
    const {
      name,
      building,
      floor,
      room,
      address,
      city,
      state,
      country,
      postalCode,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Location name is required' });
    }

    // Check if location already exists
    const existing = await prisma.location.findUnique({
      where: { name },
    });

    if (existing) {
      return res.status(400).json({ error: 'Location already exists' });
    }

    const location = await prisma.location.create({
      data: {
        name,
        building,
        floor,
        room,
        address,
        city,
        state,
        country,
        postalCode,
      },
    });

    res.status(201).json(location);
  } catch (error) {
    logger.error('Error creating location:', error);
    res.status(500).json({ error: 'Failed to create location' });
  }
});

// PUT /api/locations/:id - Update location (requires ADMIN)
router.put('/:id', requireRole([USER_ROLES.ADMIN]), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const location = await prisma.location.update({
      where: { id },
      data: updates,
    });

    res.json(location);
  } catch (error) {
    logger.error('Error updating location:', error);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

export default router; 