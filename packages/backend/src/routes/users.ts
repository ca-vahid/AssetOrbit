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
        createdAt: true,
        _count: {
          select: {
            assignedAssets: true,
            createdAssets: true,
            activities: true,
          },
        },
      },
      orderBy: [
        { isActive: 'desc' },
        { role: 'desc' }, // ADMIN first, then WRITE, then READ
        { displayName: 'asc' },
      ],
    });

    res.json(users);
  } catch (error) {
    logger.error(`Error fetching users: ${error instanceof Error ? error.message : error}`);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /api/users/technicians - Get all technicians (IT users with roles)
router.get('/technicians', requireRole([USER_ROLES.ADMIN]), async (req: Request, res: Response) => {
  try {
    const {
      search,
      role,
      department,
      isActive = 'true',
      limit = '50',
    } = req.query;

    // Build where clause for technicians (users with system access)
    const where: any = {
      role: { in: [USER_ROLES.READ, USER_ROLES.WRITE, USER_ROLES.ADMIN] }
    };

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

    const technicians = await prisma.user.findMany({
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
        createdAt: true,
        _count: {
          select: {
            assignedAssets: true,
            createdAssets: true,
            activities: true,
          },
        },
      },
      orderBy: [
        { isActive: 'desc' },
        { role: 'desc' }, // ADMIN first, then WRITE, then READ
        { displayName: 'asc' },
      ],
    });

    res.json(technicians);
  } catch (error) {
    logger.error(`Error fetching technicians: ${error instanceof Error ? error.message : error}`);
    res.status(500).json({ error: 'Failed to fetch technicians' });
  }
});

// GET /api/users/staff-with-assets - Get staff members who have assigned assets
router.get('/staff-with-assets', requireRole([USER_ROLES.ADMIN]), async (req: Request, res: Response) => {
  try {
    const {
      search,
      department,
      limit = '50',
      page = '1',
    } = req.query;

    const limitNum = parseInt(limit as string);
    const pageNum = parseInt(page as string);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause for assets to find staff with assigned assets
    const assetWhere: any = {
      assignedToAadId: { not: null },
    };

    // Get distinct Azure AD IDs of staff who have assets assigned
    const assetsWithStaff = await prisma.asset.findMany({
      where: assetWhere,
      select: {
        assignedToAadId: true,
      },
      distinct: ['assignedToAadId'],
    });

    const staffAadIds = assetsWithStaff
      .map(asset => asset.assignedToAadId)
      .filter(Boolean) as string[];

    if (staffAadIds.length === 0) {
      return res.json({
        data: [],
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: 0,
          totalPages: 0,
        },
      });
    }

    // Get asset counts for each staff member
    const assetCounts = await prisma.asset.groupBy({
      by: ['assignedToAadId'],
      where: {
        assignedToAadId: { in: staffAadIds },
      },
      _count: {
        id: true,
      },
    });

    const assetCountMap = new Map(
      assetCounts.map(count => [count.assignedToAadId, count._count.id])
    );

    // If we have search or department filters, we need to get staff details to filter
    let filteredStaffAadIds = staffAadIds;
    
    if (search || department) {
      try {
        // Import graphService instance to get staff details
        const { graphService } = await import('../services/graphService');
        
        // Get staff details for all staff members to apply filters
        const staffDetailsPromises = staffAadIds.map(async (aadId) => {
          try {
            const staff = await graphService.getStaffMember(aadId);
            return { aadId, staff };
          } catch (error) {
            logger.warn(`Failed to get details for staff ${aadId}:`, error);
            return { aadId, staff: null };
          }
        });
        
        const staffDetailsResults = await Promise.all(staffDetailsPromises);
        
        // Apply filters
        filteredStaffAadIds = staffDetailsResults
          .filter(({ staff }) => {
            if (!staff) return true; // Keep if we can't get details
            
            let matchesSearch = true;
            let matchesDepartment = true;
            
            if (search) {
              const searchLower = (search as string).toLowerCase();
              matchesSearch = 
                staff.displayName?.toLowerCase().includes(searchLower) ||
                staff.mail?.toLowerCase().includes(searchLower) ||
                staff.jobTitle?.toLowerCase().includes(searchLower) ||
                staff.department?.toLowerCase().includes(searchLower) ||
                false;
            }
            
            if (department) {
              matchesDepartment = staff.department?.toLowerCase().includes((department as string).toLowerCase()) || false;
            }
            
            return matchesSearch && matchesDepartment;
          })
          .map(({ aadId }) => aadId);
      } catch (error) {
        logger.error('Error filtering staff with Graph API:', error);
        // If filtering fails, return original list
        filteredStaffAadIds = staffAadIds;
      }
    }

    // Apply pagination to filtered results
    const total = filteredStaffAadIds.length;
    const totalPages = Math.ceil(total / limitNum);
    const paginatedStaffAadIds = filteredStaffAadIds.slice(skip, skip + limitNum);

    // Return the Azure AD IDs with asset counts
    const staffWithAssets = paginatedStaffAadIds.map(aadId => ({
      azureAdId: aadId,
      assetCount: assetCountMap.get(aadId) || 0,
    }));

    res.json({
      data: staffWithAssets,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
      },
    });
  } catch (error) {
    logger.error(`Error fetching staff with assets: ${error instanceof Error ? error.message : error}`);
    res.status(500).json({ error: 'Failed to fetch staff with assets' });
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
          lastLoginAt: new Date(),
        },
      });
    } else {
      // Update last login time for existing users
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: new Date(),
          isActive: true, // Reactivate if previously soft-deleted
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
    const currentUser = (req as any).user;

    if (!role || !Object.values(USER_ROLES).includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Get the user being updated for audit log
    const userBeingUpdated = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, displayName: true, role: true },
    });

    if (!userBeingUpdated) {
      return res.status(404).json({ error: 'User not found' });
    }

    const oldRole = userBeingUpdated.role;

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

    // Log the role change activity
    await prisma.activityLog.create({
      data: {
        userId: currentUser.userId,
        action: 'ROLE_UPDATED',
        entityType: 'USER',
        entityId: id,
        changes: JSON.stringify({
          oldRole,
          newRole: role,
          updatedUser: {
            id: updatedUser.id,
            email: updatedUser.email,
            displayName: updatedUser.displayName,
          },
        }),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    logger.info(`User role updated: ${updatedUser.email} from ${oldRole} to ${role} by ${currentUser.email}`);

    res.json(updatedUser);
  } catch (error) {
    logger.error('Error updating user role:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// PUT /api/users/bulk-role-update - Bulk update user roles (requires ADMIN)
router.put('/bulk-role-update', requireRole([USER_ROLES.ADMIN]), async (req: Request, res: Response) => {
  try {
    const { userIds, role } = req.body;
    const currentUser = (req as any).user;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'userIds array is required' });
    }

    if (!role || !Object.values(USER_ROLES).includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Get the users being updated for audit log
    const usersBeingUpdated = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, displayName: true, role: true },
    });

    if (usersBeingUpdated.length === 0) {
      return res.status(404).json({ error: 'No users found' });
    }

    // Update all users
    const updateResult = await prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: { role },
    });

    // Log each role change
    const activityLogs = usersBeingUpdated.map(user => ({
      userId: currentUser.userId,
      action: 'ROLE_UPDATED_BULK',
      entityType: 'USER',
      entityId: user.id,
      changes: JSON.stringify({
        oldRole: user.role,
        newRole: role,
        updatedUser: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
        },
        bulkOperation: true,
      }),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }));

    await prisma.activityLog.createMany({
      data: activityLogs,
    });

    logger.info(`Bulk role update: ${updateResult.count} users updated to ${role} by ${currentUser.email}`);

    res.json({
      updated: updateResult.count,
      users: usersBeingUpdated.map(user => ({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        oldRole: user.role,
        newRole: role,
      })),
    });
  } catch (error) {
    logger.error('Error in bulk role update:', error);
    res.status(500).json({ error: 'Failed to update user roles' });
  }
});

// DELETE /api/users/:id - Delete user (requires ADMIN)
router.delete('/:id', requireRole([USER_ROLES.ADMIN]), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const currentUser = (req as any).user;

    // Get the user being deleted for audit log
    const userToDelete = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, displayName: true, role: true },
    });

    if (!userToDelete) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent deletion of the current user
    if (userToDelete.id === currentUser.userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Check if user has assigned assets
    const assignedAssetsCount = await prisma.asset.count({
      where: { assignedToId: id },
    });

    if (assignedAssetsCount > 0) {
      return res.status(400).json({ 
        error: `Cannot delete user with ${assignedAssetsCount} assigned assets. Please reassign assets first.` 
      });
    }

    // Soft delete by setting isActive to false instead of hard delete
    const deletedUser = await prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
      },
    });

    // Log the deletion activity
    await prisma.activityLog.create({
      data: {
        userId: currentUser.userId,
        action: 'USER_DELETED',
        entityType: 'USER',
        entityId: id,
        changes: JSON.stringify({
          deletedUser: {
            id: deletedUser.id,
            email: deletedUser.email,
            displayName: deletedUser.displayName,
            role: deletedUser.role,
          },
          deletedBy: currentUser.email,
        }),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    logger.info(`User deleted: ${deletedUser.email} by ${currentUser.email}`);

    res.json({ message: 'User deleted successfully', user: deletedUser });
  } catch (error) {
    logger.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router; 