import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger.js';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error(`Error occurred: ${err.message}`, {
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ error: 'Unauthorized', message: err.message });
  }

  res.status(500).json({ error: 'Internal Server Error', message: err.message });
}; 