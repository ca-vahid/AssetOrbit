import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticateJwt } from '../middleware/auth.js';
import { graphService } from '../services/graphService.js';
import logger from '../utils/logger.js';

const router = Router();

// All routes require authentication
router.use(authenticateJwt);

// GET /api/staff/search?q=query - Search staff members by name or email
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { q: query, limit = '10' } = req.query;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    if (query.length < 2) {
      return res.status(400).json({ error: 'Query must be at least 2 characters long' });
    }

    const limitNum = parseInt(limit as string);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
      return res.status(400).json({ error: 'Limit must be between 1 and 50' });
    }

    const staffMembers = await graphService.searchStaff(query, limitNum);
    
    res.json({
      data: staffMembers,
      query,
      count: staffMembers.length,
    });
  } catch (error) {
    logger.error('Error searching staff:', error);
    res.status(500).json({ error: 'Failed to search staff members' });
  }
});

// GET /api/staff/:aadId - Get specific staff member by Azure AD ID
router.get('/:aadId', async (req: Request, res: Response) => {
  try {
    const { aadId } = req.params;

    if (!aadId) {
      return res.status(400).json({ error: 'Azure AD ID is required' });
    }

    const staffMember = await graphService.getStaffMember(aadId);
    
    if (!staffMember) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    res.json(staffMember);
  } catch (error) {
    logger.error('Error getting staff member:', error);
    res.status(500).json({ error: 'Failed to get staff member' });
  }
});

// GET /api/staff/group/:groupId - Get all staff members from a specific Azure AD group
router.get('/group/:groupId', async (req: Request, res: Response) => {
  try {
    const { groupId } = req.params;
    const { limit = '100' } = req.query;

    if (!groupId) {
      return res.status(400).json({ error: 'Group ID is required' });
    }

    const limitNum = parseInt(limit as string);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 500) {
      return res.status(400).json({ error: 'Limit must be between 1 and 500' });
    }

    const staffMembers = await graphService.getStaffFromGroup(groupId, limitNum);
    
    res.json({
      data: staffMembers,
      groupId,
      count: staffMembers.length,
    });
  } catch (error) {
    logger.error('Error getting staff from group:', error);
    res.status(500).json({ error: 'Failed to get staff from group' });
  }
});

// POST /api/staff/clear-cache - Clear the staff cache (admin only)
router.post('/clear-cache', async (req: Request, res: Response) => {
  try {
    graphService.clearCache();
    res.json({ message: 'Staff cache cleared successfully' });
  } catch (error) {
    logger.error('Error clearing staff cache:', error);
    res.status(500).json({ error: 'Failed to clear staff cache' });
  }
});

// GET /api/staff/:aadId/photo - Get profile photo for a staff member
router.get('/:aadId/photo', async (req: Request, res: Response) => {
  try {
    const { aadId } = req.params;

    if (!aadId) {
      return res.status(400).json({ error: 'Azure AD ID is required' });
    }

    const photoBuffer = await graphService.getProfilePhoto(aadId);
    
    if (!photoBuffer) {
      // Don't log this as an error - it's normal for users to not have photos
      logger.debug(`No profile photo available for user: ${aadId}`);
      return res.status(404).json({ error: 'Profile photo not found' });
    }

    // Set appropriate headers for image response
    res.set({
      'Content-Type': 'image/jpeg',
      'Content-Length': photoBuffer.length.toString(),
      'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
      'ETag': `"${aadId}-photo"`, // Simple ETag for caching
    });

    res.send(photoBuffer);
  } catch (error) {
    logger.error('Error in profile photo endpoint:', {
      aadId: req.params.aadId,
      error: error instanceof Error ? error.message : error,
    });
    res.status(500).json({ error: 'Failed to get profile photo' });
  }
});

// GET /api/staff/:aadId/photo/metadata - Get profile photo metadata
router.get('/:aadId/photo/metadata', async (req: Request, res: Response) => {
  try {
    const { aadId } = req.params;

    if (!aadId) {
      return res.status(400).json({ error: 'Azure AD ID is required' });
    }

    const metadata = await graphService.getProfilePhotoMetadata(aadId);
    
    if (!metadata) {
      return res.status(404).json({ error: 'Profile photo metadata not found' });
    }

    res.json(metadata);
  } catch (error) {
    logger.error('Error getting profile photo metadata:', error);
    res.status(500).json({ error: 'Failed to get profile photo metadata' });
  }
});

// POST /api/staff/clear-photo-cache - Clear the photo cache (admin only)
router.post('/clear-photo-cache', async (req: Request, res: Response) => {
  try {
    graphService.clearPhotoCache();
    res.json({ message: 'Photo cache cleared successfully' });
  } catch (error) {
    logger.error('Error clearing photo cache:', error);
    res.status(500).json({ error: 'Failed to clear photo cache' });
  }
});

// GET /api/staff/:aadId/photo/test - Test photo permissions for a user (debug endpoint)
router.get('/:aadId/photo/test', async (req: Request, res: Response) => {
  try {
    const { aadId } = req.params;

    if (!aadId) {
      return res.status(400).json({ error: 'Azure AD ID is required' });
    }

    const result = await graphService.testPhotoPermissions(aadId);
    
    res.json({
      aadId,
      hasPermission: result.hasPermission,
      error: result.error,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error testing photo permissions:', error);
    res.status(500).json({ error: 'Failed to test photo permissions' });
  }
});

// GET /api/staff/debug/permissions - Check what Graph API permissions we have
router.get('/debug/permissions', async (req: Request, res: Response) => {
  try {
    const result = await graphService.checkPermissions();
    
    res.json({
      scopes: result.scopes,
      error: result.error,
      timestamp: new Date().toISOString(),
      environment: {
        clientId: process.env.AZURE_AD_CLIENT_ID ? 'Set' : 'Not set',
        tenantId: process.env.AZURE_AD_TENANT_ID ? 'Set' : 'Not set',
        clientSecret: process.env.AZURE_AD_CLIENT_SECRET ? 'Set' : 'Not set',
      },
    });
  } catch (error) {
    logger.error('Error checking permissions:', error);
    res.status(500).json({ error: 'Failed to check permissions' });
  }
});

export default router; 