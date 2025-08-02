import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import config from './config/index';
import type { Request, Response } from 'express';
import logger from './utils/logger';
import { connectDatabase } from './services/database';

import healthRouter from './routes/health';
import assetsRouter from './routes/assets';
import usersRouter from './routes/users';
import departmentsRouter from './routes/departments';
import locationsRouter from './routes/locations';
import vendorsRouter from './routes/vendors';
import customFieldsRouter from './routes/customFields';
import activitiesRouter from './routes/activities';
import staffRouter from './routes/staff';
import workloadCategoriesRouter from './routes/workloadCategories';
import importRouter from './routes/import';
import { initAuth, authenticateJwt } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';

const app = express();
const port = config.port;

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // non-browser clients
      cb(null, config.corsOrigins.includes(origin));
    },
    credentials: true,
  }),
);

// Security headers
app.use(helmet());

// Increase payload limit for bulk imports
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(
  morgan('[:method] :url :status :res[content-length] - :response-time ms', {
    stream: {
      write: (message) => logger.info(message.trim()),
    },
  }),
);

initAuth(app);

// API Routes
app.use('/api/health', healthRouter);
app.use('/api/assets', assetsRouter);
app.use('/api/users', usersRouter);
app.use('/api/departments', departmentsRouter);
app.use('/api/locations', locationsRouter);
app.use('/api/vendors', vendorsRouter);
app.use('/api/custom-fields', customFieldsRouter);
app.use('/api/activities', activitiesRouter);
app.use('/api/staff', staffRouter);
app.use('/api/workload-categories', workloadCategoriesRouter);
app.use('/api/import', importRouter);

// Protected route example
app.get('/api/protected', authenticateJwt, (req: Request, res: Response) => {
  logger.info('Protected route accessed', { user: (req as any).user?.name });
  res.json({ message: 'Secure data accessed', user: (req as any).user });
});

app.get('/', (_req: Request, res: Response) => {
  res.send('AssetOrbit API');
});

// Error handling middleware (must be before server startup)
app.use(errorHandler);

// Start server with database connection
async function startServer() {
  try {
    logger.info('Starting AssetOrbit backend server...');
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`Port: ${port}`);
    logger.info(`CORS Origins: ${config.corsOrigins.join(', ')}`);
    
    // Connect to database first
    await connectDatabase();
    
    // Start Express server
    const server = app.listen(port, '0.0.0.0', () => {
      logger.info(`Backend running on http://0.0.0.0:${port}`);
    });

    // Handle server errors
    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${port} is already in use`);
      } else {
        logger.error('Server error:', error);
      }
      process.exit(1);
    });

  } catch (error: any) {
    logger.error('Failed to start server:');
    logger.error('Error:', error);
    
    if (error.message) {
      logger.error('Error message:', error.message);
    }
    
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

startServer(); 