import dotenv from 'dotenv';

// Load environment variables from a .env file
dotenv.config();
// Override with .env.local if present (for local development)
dotenv.config({ path: '.env.local', override: true });

/**
 * Centralised configuration object for the backend.
 * Extend this file as new environment variables are introduced.
 */
const config = {
  port: Number(process.env.PORT ?? 8080),
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(','),
  databaseUrl: process.env.DATABASE_URL ?? '',
  azure: {
    clientId: process.env.AZURE_AD_CLIENT_ID ?? '',
    tenantId: process.env.AZURE_AD_TENANT_ID ?? '',
    clientSecret: process.env.AZURE_AD_CLIENT_SECRET ?? '',
    audience: process.env.AZURE_AD_AUDIENCE ?? `api://${process.env.AZURE_AD_CLIENT_ID}`,
  },
};

export default config; 