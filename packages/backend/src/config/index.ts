import dotenv from 'dotenv';

// Load environment variables from a .env file if present
dotenv.config();

/**
 * Centralised configuration object for the backend.
 * Extend this file as new environment variables are introduced.
 */
const config = {
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  databaseUrl: process.env.DATABASE_URL ?? '',
  azure: {
    clientId: process.env.AZURE_AD_CLIENT_ID ?? '',
    tenantId: process.env.AZURE_AD_TENANT_ID ?? '',
    clientSecret: process.env.AZURE_AD_CLIENT_SECRET ?? '',
  },
};

export default config; 