import { Router } from 'express';
import type { Request, Response } from 'express';
import prisma from '../services/database';
import { authenticateJwt, requireRole } from '../middleware/auth';
import logger from '../utils/logger';
import { USER_ROLES } from '../constants';
import crypto from 'crypto';

const router = Router();

// All routes require authentication
router.use(authenticateJwt);

// GET /api/users - Get all users (for dropdowns and user management)
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      search,
      role,
      department,
      isActive = 'true',
      limit = '100',
    } = req.query;

    // Build where clause
    const where: any = {};

    if (search) {
      const searchStr = search as string;
      where.OR = [
        { displayName: { contains: searchStr } },
        { email: { contains: searchStr } },
        { department: { contains: searchStr } },
      ];
    }

    if (role) {
      where.role = role;
    }

    if (department) {
      where.department = department;
    }

    if (isActive === 'true') {
      where.isActive = true;
    } else if (isActive === 'false') {
      where.isActive = false;
    }

    const users = await prisma.user.findMany({
      where,
      take: parseInt(limit as string),
      select: {
        id: true,
        azureAdId: true,
        email: true,
        displayName: true,
        givenName: true,
        surname: true,
        jobTitle: true,
        department: true,
        officeLocation: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        _count: {
          select: {
            assignedAssets: true,
          },
        },
      },
      orderBy: [
        { isActive: 'desc' },
        { displayName: 'asc' },
      ],
    });

    res.json(users);
  } catch (error) {
    logger.error(`Error fetching users: ${error instanceof Error ? error.message : error}`);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /api/users/me - Get current user info
router.get('/me', async (req: Request, res: Response) => {
  try {
    const token = (req as any).user as any;

    // Temporary debug logging
    console.log('=== /ME TOKEN DEBUG ===');
    console.log('oid:', token.oid);
    console.log('preferred_username:', token.preferred_username);
    console.log('email:', token.email);
    console.log('upn:', token.upn);
    console.log('unique_name:', token.unique_name);
    console.log('name:', token.name);
    console.log('========================');

    const azureAdId = token.oid as string | undefined;
    const email = token.preferred_username || token.upn || token.unique_name || token.email;

    if (!azureAdId && !email) {
      return res.status(400).json({ error: 'Invalid token payload' });
    }

    // Try to find user by Azure AD object id
    let user = azureAdId
      ? await prisma.user.findUnique({ where: { azureAdId } })
      : null;

    // Fallback lookup by email
    if (!user && email) {
      user = await prisma.user.findUnique({ where: { email } });
    }

    // Auto-provision user if not found
    if (!user) {
      user = await prisma.user.create({
        data: {
          azureAdId: azureAdId ?? crypto.randomUUID(),
          email: email ?? `${azureAdId}@example.com`,
          displayName: token.name ?? email ?? 'Unknown User',
          givenName: token.given_name ?? undefined,
          surname: token.family_name ?? undefined,
          role: USER_ROLES.READ,
          department: token.department ?? undefined,
          officeLocation: token.office_location ?? undefined,
        },
      });
    }

    // Return with counts
    const userWithCounts = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        _count: {
          select: {
            assignedAssets: true,
            createdAssets: true,
            activities: true,
          },
        },
      },
    });

    res.json(userWithCounts);
  } catch (error) {
    logger.error(`Error fetching current user: ${error instanceof Error ? error.message : error}`);
    res.status(500).json({ error: 'Failed to fetch user info' });
  }
});

// GET /api/users/debug-token - Debug token contents
router.get('/debug-token', async (req: Request, res: Response) => {
  try {
    const token = (req as any).user as any;
    
    console.log('=== TOKEN DEBUG ===');
    console.log('Full token:', JSON.stringify(token, null, 2));
    console.log('oid (Azure AD ID):', token.oid);
    console.log('preferred_username:', token.preferred_username);
    console.log('email:', token.email);
    console.log('upn:', token.upn);
    console.log('unique_name:', token.unique_name);
    console.log('name:', token.name);
    console.log('===================');
    
    res.json({
      azureAdId: token.oid,
      possibleEmails: {
        preferred_username: token.preferred_username,
        email: token.email,
        upn: token.upn,
        unique_name: token.unique_name,
      },
      displayName: token.name,
      fullToken: token,
    });
  } catch (error) {
    logger.error('Error in debug-token:', error);
    res.status(500).json({ error: 'Debug failed' });
  }
});

// PUT /api/users/:id/role - Update user role (requires ADMIN)
router.put('/:id/role', requireRole([USER_ROLES.ADMIN]), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!role || !Object.values(USER_ROLES).includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
      },
    });

    res.json(updatedUser);
  } catch (error) {
    logger.error('Error updating user role:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

export default router; 