import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import config from './config/index.js';
import type { Request, Response } from 'express';
import logger from './utils/logger.js';
import { connectDatabase } from './services/database.js';

import healthRouter from './routes/health.js';
import assetsRouter from './routes/assets.js';
import usersRouter from './routes/users.js';
import departmentsRouter from './routes/departments.js';
import locationsRouter from './routes/locations.js';
import vendorsRouter from './routes/vendors.js';
import customFieldsRouter from './routes/customFields.js';
import activitiesRouter from './routes/activities.js';
import staffRouter from './routes/staff.js';
import workloadCategoriesRouter from './routes/workloadCategories.js';
import importRouter from './routes/import.js';
import { initAuth, authenticateJwt } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';

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
    const server = app.listen(port, () => {
      logger.info(`Backend running on http://localhost:${port}`);
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