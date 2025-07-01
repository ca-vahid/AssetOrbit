import { Router } from 'express';
import type { Request, Response } from 'express';
import prisma from '../services/database';
import { authenticateJwt } from '../middleware/auth';
import logger from '../utils/logger';

const router = Router();

// All routes require authentication
router.use(authenticateJwt);

// GET /api/activities/:entityType/:entityId - Get activities for a specific entity
router.get('/:entityType/:entityId', async (req: Request, res: Response) => {
  try {
    const { entityType, entityId } = req.params;
    const { limit = '50' } = req.query;

    const activities = await prisma.activityLog.findMany({
      where: {
        entityType,
        entityId,
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
    });

    // Parse changes JSON and create meaningful details
    const activitiesWithParsedChanges = activities.map((activity) => ({
      ...activity,
      details: activity.changes ? (() => {
        try {
          const parsed = JSON.parse(activity.changes);
          
          // If there's a description, use it
          if (parsed.description) return parsed.description;
          
          // If there's an action, use it
          if (parsed.action) return parsed.action;
          
          // If there's an operation, use it
          if (parsed.operation) return `${parsed.operation} operation`;
          
          // Try to build a description from changes
          const changeKeys = Object.keys(parsed).filter(key => 
            key !== 'description' && key !== 'action' && key !== 'operation' && 
            typeof parsed[key] === 'object' && parsed[key].from !== undefined
          );
          
          if (changeKeys.length > 0) {
            const descriptions = changeKeys.map(key => {
              const change = parsed[key];
              switch (key) {
                case 'assignedToId':
                  if (change.to && !change.from) return 'Asset assigned';
                  if (!change.to && change.from) return 'Asset unassigned';
                  if (change.to !== change.from) return 'Asset reassigned';
                  break;
                case 'status':
                  return `Status: ${change.from} → ${change.to}`;
                case 'condition':
                  return `Condition: ${change.from} → ${change.to}`;
                default:
                  return `${key} updated`;
              }
              return null;
            }).filter(Boolean);
            
            if (descriptions.length > 0) {
              return descriptions.join(', ');
            }
          }
          
          // Fallback to the raw changes
          return activity.changes;
        } catch {
          return activity.changes;
        }
      })() : null,
    }));

    res.json(activitiesWithParsedChanges);
  } catch (error) {
    logger.error('Error fetching activities:', error);
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

export default router; 