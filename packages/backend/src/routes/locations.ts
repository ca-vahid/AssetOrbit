import { Router } from 'express';
import type { Request, Response } from 'express';
import prisma from '../services/database';
import { authenticateJwt, requireRole } from '../middleware/auth';
import logger from '../utils/logger';
import { USER_ROLES } from '../constants';
import { syncLocationsFromAzureAD } from '../scripts/sync-locations';

const router = Router();

// All routes require authentication
router.use(authenticateJwt);

// GET /api/locations - Get all active locations
router.get('/', async (req: Request, res: Response) => {
  try {
    const { search, country, province } = req.query;

    const where: any = {
      isActive: true,
    };

    if (search) {
      where.OR = [
        { city: { contains: search as string } },
        { province: { contains: search as string } },
        { country: { contains: search as string } },
      ];
    }

    if (country) {
      where.country = country as string;
    }

    if (province) {
      where.province = province as string;
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
        { country: 'asc' },
        { province: 'asc' },
        { city: 'asc' },
      ],
    });

    res.json(locations);
  } catch (error) {
    logger.error('Error fetching locations:', error);
    res.status(500).json({ error: 'Failed to fetch locations' });
  }
});

// GET /api/locations/all - Get all locations including inactive (requires ADMIN)
router.get('/all', requireRole([USER_ROLES.ADMIN]), async (req: Request, res: Response) => {
  try {
    const { search, country, province, isActive } = req.query;

    const where: any = {};

    if (search) {
      where.OR = [
        { city: { contains: search as string } },
        { province: { contains: search as string } },
        { country: { contains: search as string } },
      ];
    }

    if (country) {
      where.country = country as string;
    }

    if (province) {
      where.province = province as string;
    }

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
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
        { country: 'asc' },
        { province: 'asc' },
        { city: 'asc' },
      ],
    });

    res.json(locations);
  } catch (error) {
    logger.error('Error fetching all locations:', error);
    res.status(500).json({ error: 'Failed to fetch locations' });
  }
});

// POST /api/locations - Create new location manually (requires ADMIN)
router.post('/', requireRole([USER_ROLES.ADMIN]), async (req: Request, res: Response) => {
  try {
    const { city, province, country = 'Canada' } = req.body;

    if (!city || !province) {
      return res.status(400).json({ error: 'City and province are required' });
    }

    // Check if location already exists
    const existing = await prisma.location.findFirst({
      where: {
        city,
        province,
        country,
      },
    });

    if (existing) {
      return res.status(400).json({ 
        error: 'Location already exists',
        existingLocation: existing,
      });
    }

    const location = await prisma.location.create({
      data: {
        city,
        province,
        country,
        source: 'MANUAL',
        isActive: true,
      },
    });

    logger.info(`Created manual location: ${city}, ${province}, ${country}`);
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
    const { city, province, country } = req.body;

    if (!city || !province || !country) {
      return res.status(400).json({ error: 'City, province, and country are required' });
    }

    // Check if another location with same city/province/country exists
    const existing = await prisma.location.findFirst({
      where: {
        city,
        province,
        country,
        id: { not: id },
      },
    });

    if (existing) {
      return res.status(400).json({ 
        error: 'Another location with the same city, province, and country already exists',
      });
    }

    const location = await prisma.location.update({
      where: { id },
      data: {
        city,
        province,
        country,
      },
    });

    logger.info(`Updated location: ${location.city}, ${location.province}, ${location.country}`);
    res.json(location);
  } catch (error) {
    logger.error('Error updating location:', error);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

// PATCH /api/locations/:id/toggle - Toggle location active status (requires ADMIN)
router.patch('/:id/toggle', requireRole([USER_ROLES.ADMIN]), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const location = await prisma.location.findUnique({
      where: { id },
    });

    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    const updatedLocation = await prisma.location.update({
      where: { id },
      data: {
        isActive: !location.isActive,
      },
    });

    logger.info(`Toggled location status: ${updatedLocation.city}, ${updatedLocation.province} - ${updatedLocation.isActive ? 'active' : 'inactive'}`);
    res.json(updatedLocation);
  } catch (error) {
    logger.error('Error toggling location status:', error);
    res.status(500).json({ error: 'Failed to toggle location status' });
  }
});

// POST /api/locations/sync - Sync locations from Azure AD (requires ADMIN)
router.post('/sync', requireRole([USER_ROLES.ADMIN]), async (req: Request, res: Response) => {
  try {
    logger.info('Starting Azure AD location sync via API...');
    
    await syncLocationsFromAzureAD();
    
    // Get updated count
    const totalLocations = await prisma.location.count();
    const activeLocations = await prisma.location.count({
      where: { isActive: true },
    });
    
    res.json({
      success: true,
      message: 'Locations synced successfully from Azure AD',
      totalLocations,
      activeLocations,
    });
  } catch (error) {
    logger.error('Error syncing locations from Azure AD:', error);
    res.status(500).json({ 
      error: 'Failed to sync locations from Azure AD',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/locations/provinces - Get distinct provinces for dropdowns
router.get('/provinces', async (req: Request, res: Response) => {
  try {
    const { country = 'Canada' } = req.query;

    const provinces = await prisma.location.findMany({
      where: {
        country: country as string,
        isActive: true,
      },
      select: {
        province: true,
      },
      distinct: ['province'],
      orderBy: {
        province: 'asc',
      },
    });

    const provinceList = provinces.map(p => p.province);
    res.json(provinceList);
  } catch (error) {
    logger.error('Error fetching provinces:', error);
    res.status(500).json({ error: 'Failed to fetch provinces' });
  }
});

// GET /api/locations/countries - Get distinct countries for dropdowns
router.get('/countries', async (req: Request, res: Response) => {
  try {
    const countries = await prisma.location.findMany({
      where: {
        isActive: true,
      },
      select: {
        country: true,
      },
      distinct: ['country'],
      orderBy: {
        country: 'asc',
      },
    });

    const countryList = countries.map(c => c.country);
    res.json(countryList);
  } catch (error) {
    logger.error('Error fetching countries:', error);
    res.status(500).json({ error: 'Failed to fetch countries' });
  }
});

export default router; 