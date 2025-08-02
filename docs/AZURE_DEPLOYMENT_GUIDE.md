# Azure App Service Deployment Guide: Node.js Backend with TypeScript and Prisma

## Table of Contents
1. [Overview](#overview)
2. [Initial Challenges](#initial-challenges)
3. [Solution Architecture](#solution-architecture)
4. [Step-by-Step Implementation](#step-by-step-implementation)
5. [Final Working Configuration](#final-working-configuration)
6. [Key Lessons Learned](#key-lessons-learned)
7. [Best Practices](#best-practices)
8. [Frontend Deployment Strategy](#frontend-deployment-strategy)
9. [Troubleshooting Guide](#troubleshooting-guide)

## Overview

This document details the complete process of deploying a Node.js TypeScript backend application with Prisma ORM to Azure App Service using GitHub Actions. The application is part of a monorepo structure with separate frontend and backend packages.

### Project Structure
```
INVv1/
├── packages/
│   ├── backend/          # Node.js TypeScript API
│   ├── frontend/         # React TypeScript SPA
│   └── shared/           # Shared types and utilities
├── .github/workflows/    # CI/CD pipelines
└── ...
```

### Technology Stack
- **Runtime**: Node.js 20.x
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: Azure SQL Server
- **ORM**: Prisma
- **Authentication**: Azure AD (passport-azure-ad)
- **Deployment**: Azure App Service Linux
- **CI/CD**: GitHub Actions

## Initial Challenges

### 1. Module Resolution Errors
**Problem**: `Cannot find module 'express'` and other dependencies
**Root Cause**: Azure's Oryx build system expected `node_modules.tar.gz` but GitHub Actions was deploying without proper dependency packaging

### 2. Husky Git Hooks in CI
**Problem**: `sh: 1: husky: not found` during npm install
**Root Cause**: Husky prepare script running in CI environment where git hooks aren't needed

### 3. TypeScript Compilation Failures
**Problem**: Multiple TypeScript errors including missing Prisma types and implicit 'any' types
**Root Cause**: 
- Prisma client not generated before compilation
- Using strict TypeScript config for production build
- Scripts directory included in build

### 4. Missing Package Lock File
**Problem**: `npm ci` failing due to missing `package-lock.json`
**Root Cause**: Backend directory didn't have a lock file, but workflow tried to use `npm ci`

### 5. Incorrect File Structure in Deployment
**Problem**: `Cannot find module '/home/site/wwwroot/dist/server.js'`
**Root Cause**: Copying `dist/*` flattened the structure, but package.json still referenced `dist/server.js`

### 6. Missing Prisma Generated Client
**Problem**: `Cannot find module '../generated/prisma'`
**Root Cause**: Generated Prisma client not included in deployment package

### 7. Database Connection String Format
**Problem**: `the URL must start with the protocol 'sqlserver://'`
**Root Cause**: DATABASE_URL have quotes "" in it. This was resolved by removing the quotes.

## Solution Architecture

### Deployment Strategy
We chose **External Build** approach using GitHub Actions instead of Azure's Oryx builder:

1. **Build Phase** (GitHub Actions):
   - Install dependencies
   - Generate Prisma client
   - Compile TypeScript
   - Create deployment package

2. **Deploy Phase** (Azure App Service):
   - Extract deployment package
   - Start application with pre-built assets

### Key Design Decisions

1. **Use Production TypeScript Config**: `tsconfig.prod.json` with relaxed settings
2. **Include Generated Files**: Copy Prisma client and compiled JS to deployment
3. **Modify Package.json**: Update start script and module type for deployment
4. **Skip Scripts**: Use `--ignore-scripts` to avoid development dependencies

## Step-by-Step Implementation

### 1. GitHub Actions Workflow Setup

```yaml
name: Build and deploy Node.js app to Azure Web App - assetorbit-api

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Set up Node.js version
        uses: actions/setup-node@v3
        with:
          node-version: '20.x'
      
      - name: npm install, build, and prepare deployment
        working-directory: ./packages/backend
        run: |
          # Install all dependencies (including dev)
          npm ci --ignore-scripts
          
          # Generate Prisma client
          npx prisma generate
          
          # Build TypeScript with production config
          npx tsc -p tsconfig.prod.json
          
          # Create deployment structure
          mkdir -p deploy
          cp -r dist/* deploy/
          cp -r src/generated deploy/
          cp package.json deploy/
          cp -r prisma deploy/
          
          # Update package.json for deployment
          cd deploy
          node -e "
            const fs = require('fs');
            const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
            pkg.scripts.start = 'node server.js';
            pkg.type = 'commonjs';
            fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
          "
          
          # Install production dependencies
          npm install --omit=dev --ignore-scripts
          
          # Generate Prisma client for runtime
          npx prisma generate
          
          # Cleanup
          rm -f package-lock.json

      - name: Zip artifact for deployment
        run: |
          cd packages/backend/deploy
          zip -r ../../../deploy.zip .

      - name: Upload artifact for deployment job
        uses: actions/upload-artifact@v4
        with:
          name: node-app
          path: deploy.zip

  deploy:
    runs-on: ubuntu-latest
    needs: build
    permissions:
      id-token: write
    steps:
      - name: Download artifact from build job
        uses: actions/download-artifact@v4
        with:
          name: node-app

      - name: Unzip artifact for deployment
        run: unzip deploy.zip

      - name: Login to Azure
        uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZUREAPPSERVICE_CLIENTID_* }}
          tenant-id: ${{ secrets.AZUREAPPSERVICE_TENANTID_* }}
          subscription-id: ${{ secrets.AZUREAPPSERVICE_SUBSCRIPTIONID_* }}

      - name: Deploy to Azure Web App
        uses: azure/webapps-deploy@v3
        with:
          app-name: 'assetorbit-api'
          slot-name: 'Production'
          package: .
          clean: true
```

### 2. TypeScript Configuration

**tsconfig.prod.json** (Production build config):
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noImplicitAny": false,
    "skipLibCheck": true,
    "strict": false
  },
  "exclude": ["src/scripts/**/*"]
}
```

### 3. Azure App Service Configuration

**Required Environment Variables**:
```
DATABASE_URL=sqlserver://username:password@server:1433;database=dbname;encrypt=true;trustServerCertificate=false
AZURE_AD_CLIENT_ID=your_client_id
AZURE_AD_CLIENT_SECRET=your_client_secret
AZURE_AD_TENANT_ID=your_tenant_id
CORS_ORIGIN=https://your-frontend-domain.com
PORT=8080
```

### 4. Prisma Configuration

**schema.prisma**:
```prisma
generator client {
  provider = "prisma-client-js"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "sqlserver"
  url      = env("DATABASE_URL")
}
```

## Final Working Configuration

### Deployment Package Structure
```
deploy/
├── server.js                 # Main entry point
├── routes/                   # API routes
├── services/                 # Business logic
├── middleware/               # Express middleware
├── utils/                    # Utilities
├── generated/                # Prisma client
│   └── prisma/
├── prisma/                   # Schema and migrations
│   ├── schema.prisma
│   └── migrations/
├── package.json              # Modified for production
└── node_modules/             # Production dependencies
```

### Modified package.json in Deployment
```json
{
  "scripts": {
    "start": "node server.js"
  },
  "type": "commonjs",
  "dependencies": {
    // Only production dependencies
  }
}
```

## Key Lessons Learned

### 1. Azure App Service Deployment Methods
- **Oryx Builder**: Builds on Azure, expects specific file structure
- **External Build**: Pre-built deployment, more control but requires careful packaging
- **RunFromPackage**: Read-only deployment, good for static content

### 2. Node.js Module Systems
- TypeScript compiles to CommonJS by default
- `"type": "module"` in package.json affects how Node.js interprets files
- Deployment environment needs to match compiled output format

### 3. Prisma in Production
- Prisma client must be generated in both build and deployment environments
- Generated client location affects import paths
- Database connection strings must include authentication

### 4. GitHub Actions Best Practices
- Use `--ignore-scripts` to skip development-only scripts
- Separate build and deploy jobs for better organization
- Use artifacts to pass build outputs between jobs
- Store sensitive data in GitHub Secrets

### 5. TypeScript Configuration Strategies
- Development config can be strict for better DX
- Production config should be more permissive for successful builds
- Exclude unnecessary directories (scripts, tests) from production builds

### 6. Monorepo Deployment Considerations
- Each package needs independent build/deploy pipeline
- Shared dependencies should be managed carefully
- Working directory specification is crucial in CI/CD

## Best Practices

### 1. Environment Configuration
```bash
# Use specific environment variables for different stages
NODE_ENV=production
DATABASE_URL=sqlserver://...
AZURE_AD_CLIENT_ID=...
CORS_ORIGIN=https://yourdomain.com
```

### 2. Security
- Store sensitive data in Azure Key Vault or GitHub Secrets
- Use managed identity when possible
- Enable HTTPS and proper CORS configuration
- Validate environment variables at startup

### 3. Monitoring and Logging
- Enable Application Insights
- Use structured logging (JSON format)
- Monitor application startup and health endpoints
- Set up alerts for failures

### 4. Performance
- Use production dependencies only
- Enable compression middleware
- Implement proper caching strategies
- Monitor memory and CPU usage

## Frontend Deployment Strategy

### Overview
The React/Vite single-page application is deployed via **Azure Static Web Apps** (SWA).

Key points:
- Static Web App resource named `assetorbit`
- Independent workflow `main_assetorbit-frontend.yml`
- Pre-built assets are uploaded; Oryx build is skipped
- Environment variables are provided through GitHub Secrets

### GitHub Actions Workflow (`.github/workflows/main_assetorbit-frontend.yml`)
```yaml
name: Build & Deploy Front-end to Azure Static Web Apps – assetorbit

on:
  push:
    branches: [main]
    paths:
      - 'packages/frontend/**'
  workflow_dispatch:

jobs:
  build_and_deploy:
    runs-on: ubuntu-latest
    env:
      VITE_API_BASE_URL: ${{ secrets.VITE_API_BASE_URL }}
      VITE_AZURE_AD_CLIENT_ID: ${{ secrets.VITE_AZURE_AD_CLIENT_ID }}
      VITE_AZURE_AD_TENANT_ID: ${{ secrets.VITE_AZURE_AD_TENANT_ID }}
    steps:
      - uses: actions/checkout@v4

      - name: Use Node 20
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies & build Vite
        working-directory: packages/frontend
        run: |
          npm ci --ignore-scripts
          npm run build

      - name: Deploy to Azure Static Web Apps
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN_GRAY_DESERT_0213D731E }}
          action: upload
          app_location: packages/frontend/dist
          skip_app_build: true
```

### Environment Variables
| Variable | Source | Description |
| -------- | ------ | ----------- |
| `VITE_API_BASE_URL` | GitHub Secret | Base URL of backend API |
| `VITE_AZURE_AD_CLIENT_ID` | GitHub Secret | Azure AD application (SPA) client ID |
| `VITE_AZURE_AD_TENANT_ID` | GitHub Secret | Azure AD tenant ID |

These are supplied at build time and validated at runtime in `src/auth/msal.ts`.

### Additional Notes
1. The portal-generated SWA workflow was removed to prevent duplicate, Oryx-based builds.
2. `skip_app_build: true` ensures the action uploads the already-built `dist` folder without running Oryx.
3. CORS was configured on the backend App Service to include the SWA domain.

## Troubleshooting Guide

### Common Issues and Solutions

1. **Module Not Found Errors**
   - Check deployment package structure
   - Verify all dependencies are included
   - Ensure import paths are correct

2. **TypeScript Compilation Errors**
   - Use production TypeScript config
   - Generate Prisma client before build
   - Exclude problematic directories

3. **Database Connection Issues**
   - Verify connection string format
   - Check firewall rules
   - Ensure credentials are correct

4. **Authentication Failures**
   - Verify Azure AD configuration
   - Check environment variables
   - Validate redirect URIs

5. **Performance Issues**
   - Monitor Application Insights
   - Check for memory leaks
   - Optimize database queries

### Debugging Commands
```bash
# Check application logs
az webapp log tail --name assetorbit-api --resource-group your-rg

# SSH into container
az webapp ssh --name assetorbit-api --resource-group your-rg

# Check environment variables
az webapp config appsettings list --name assetorbit-api --resource-group your-rg
```

## Conclusion

This deployment process successfully addressed all major challenges in deploying a TypeScript Node.js application with Prisma to Azure App Service. The key to success was understanding the differences between build environments and properly packaging all required dependencies and generated files.

The final solution provides:
- ✅ Reliable CI/CD pipeline
- ✅ Proper dependency management
- ✅ TypeScript compilation
- ✅ Prisma ORM integration
- ✅ Azure AD authentication
- ✅ Production-ready configuration

This documentation serves as a blueprint for future deployments and can be adapted for similar Node.js applications or the frontend deployment strategy. 