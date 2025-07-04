import { PrismaClient } from '../generated/prisma';
import logger from '../utils/logger';

// Create a single instance of PrismaClient
const prisma = new PrismaClient({
  log: [
    {
      emit: 'event',
      level: 'query',
    },
    {
      emit: 'event',
      level: 'error',
    },
    {
      emit: 'event',
      level: 'info',
    },
    {
      emit: 'event',
      level: 'warn',
    },
  ],
});

// Log database events
prisma.$on('query', (e: any) => {
  if (process.env.NODE_ENV === 'development') {
    logger.debug('Query: ' + e.query);
    logger.debug('Duration: ' + e.duration + 'ms');
  }
});

prisma.$on('error', (e: any) => {
  logger.error(`Database error: ${e}`);
});

// Connect to database
export async function connectDatabase() {
  try {
    logger.info('Attempting to connect to database...');
    logger.info(`Database URL configured: ${process.env.DATABASE_URL ? 'Yes' : 'No'}`);
    if (process.env.DATABASE_URL) {
      logger.debug(`DATABASE_URL length: ${process.env.DATABASE_URL.length}`);
    }
    
    await prisma.$connect();
    logger.info('Database connected successfully');
    
    // Test the connection with a simple query
    await prisma.$queryRaw`SELECT 1 as test`;
    logger.info('Database connection test successful');
  } catch (error: any) {
    logger.error(`Failed to connect to database: ${error?.message || error}`);
    logger.error(`Error code: ${error?.code ?? 'n/a'}`);
    
    // Provide helpful error messages for common issues
    if (error.message?.includes('Login failed')) {
      logger.error('Database authentication failed. Check your username and password.');
    } else if (error.message?.includes('Cannot open server')) {
      logger.error('Cannot reach database server. Check your server name and network connection.');
    } else if (error.message?.includes('Cannot open database')) {
      logger.error('Database name is incorrect or database does not exist.');
    } else if (error.message?.includes('SSL')) {
      logger.error('SSL/TLS connection issue. Check your encrypt and trustServerCertificate settings.');
    }
    
    throw error;
  }
}

// Disconnect from database
export async function disconnectDatabase() {
  try {
    await prisma.$disconnect();
    logger.info('Database disconnected successfully');
  } catch (error) {
    logger.error('Failed to disconnect from database:', error);
    throw error;
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  await disconnectDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await disconnectDatabase();
  process.exit(0);
});

export default prisma; 