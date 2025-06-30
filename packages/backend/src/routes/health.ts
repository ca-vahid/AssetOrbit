import { Router, type Request, type Response } from 'express';
import logger from '../utils/logger';

const router = Router();

/**
 * GET /api/health
 * Health check endpoint
 */
router.get('/', (_req: Request, res: Response) => {
  logger.debug('Health check invoked');
  res.status(200).json({ status: 'ok' });
});

export default router; 