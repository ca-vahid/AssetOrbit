import { Router } from 'express';
import type { Request, Response } from 'express';
import prisma from '../services/database.js';
import { authenticateJwt, requireRole } from '../middleware/auth.js';
import logger from '../utils/logger.js';
import { USER_ROLES } from '../constants/index.js';

const router = Router();

// All routes require authentication
router.use(authenticateJwt);

// GET /api/vendors - Get all vendors
router.get('/', async (req: Request, res: Response) => {
  try {
    const { search, isActive = 'true' } = req.query;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search as string } },
        { contactName: { contains: search as string } },
        { email: { contains: search as string } },
      ];
    }

    if (isActive === 'true') {
      where.isActive = true;
    } else if (isActive === 'false') {
      where.isActive = false;
    }

    const vendors = await prisma.vendor.findMany({
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

    res.json(vendors);
  } catch (error) {
    logger.error('Error fetching vendors:', error);
    res.status(500).json({ error: 'Failed to fetch vendors' });
  }
});

// POST /api/vendors - Create new vendor (requires WRITE)
router.post('/', requireRole([USER_ROLES.WRITE, USER_ROLES.ADMIN]), async (req: Request, res: Response) => {
  try {
    const {
      name,
      contactName,
      email,
      phone,
      website,
      address,
      notes,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Vendor name is required' });
    }

    // Check if vendor already exists
    const existing = await prisma.vendor.findUnique({
      where: { name },
    });

    if (existing) {
      return res.status(400).json({ error: 'Vendor already exists' });
    }

    const vendor = await prisma.vendor.create({
      data: {
        name,
        contactName,
        email,
        phone,
        website,
        address,
        notes,
      },
    });

    res.status(201).json(vendor);
  } catch (error) {
    logger.error('Error creating vendor:', error);
    res.status(500).json({ error: 'Failed to create vendor' });
  }
});

// PUT /api/vendors/:id - Update vendor (requires WRITE)
router.put('/:id', requireRole([USER_ROLES.WRITE, USER_ROLES.ADMIN]), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const vendor = await prisma.vendor.update({
      where: { id },
      data: updates,
    });

    res.json(vendor);
  } catch (error) {
    logger.error('Error updating vendor:', error);
    res.status(500).json({ error: 'Failed to update vendor' });
  }
});

// GET /api/vendors/:id - Get single vendor
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const vendor = await prisma.vendor.findUnique({
      where: { id },
      include: {
        assets: {
          select: {
            id: true,
            assetTag: true,
            make: true,
            model: true,
            purchaseDate: true,
            purchasePrice: true,
          },
          orderBy: { purchaseDate: 'desc' },
        },
      },
    });

    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    res.json(vendor);
  } catch (error) {
    logger.error('Error fetching vendor:', error);
    res.status(500).json({ error: 'Failed to fetch vendor' });
  }
});

export default router; 