# Azure Ultimate Deployment Guide for Node.js TypeScript Applications

## Table of Contents
1. [Quick Reference](#quick-reference)
2. [Critical Configuration Requirements](#critical-configuration-requirements)
3. [Common Deployment Errors & Solutions](#common-deployment-errors--solutions)
4. [Step-by-Step Setup](#step-by-step-setup)
5. [GitHub Actions Workflow](#github-actions-workflow)
6. [Environment Configuration](#environment-configuration)
7. [Module System Best Practices](#module-system-best-practices)
8. [Troubleshooting Checklist](#troubleshooting-checklist)
9. [Production Monitoring](#production-monitoring)

---

## Quick Reference

### ⚡ **The Golden Rules**
1. **Always use CommonJS** for Azure App Service deployment (`"type": "commonjs"`)
2. **Never use ES modules** in production deployment package
3. **Bind server to `'0.0.0.0'`** not `'localhost'`
4. **Use external build** with GitHub Actions (not Oryx)
5. **Include Prisma generated client** in deployment package

### 🚨 **Most Common Errors**
| Error Pattern | Root Cause | Quick Fix |
|---------------|------------|-----------|
| `exports is not defined in ES module scope` | Package.json has `"type": "module"` | Change to `"type": "commonjs"` |
| `ERR_UNSUPPORTED_DIR_IMPORT` | ES modules with missing extensions | Switch to CommonJS |
| `Cannot find module '@ats/shared-transformations'` | Shared package not properly installed | Use `npm pack` + `npm install` |
| `Container didn't respond to HTTP pings` | Server binding to localhost | Bind to `'0.0.0.0'` |

---

## Critical Configuration Requirements

### 1. Package.json Configuration
```json
{
  "name": "@ats/backend",
  "version": "0.95.0",
  "type": "commonjs",  // ⚠️ CRITICAL: Must be commonjs for Azure
  "main": "dist/server.js",
  "scripts": {
    "start": "node dist/server.js",  // ⚠️ Points to compiled JS
    "build": "tsc -p tsconfig.json"
  }
}
```

### 2. TypeScript Configuration
```json
{
  "compilerOptions": {
    "module": "CommonJS",        // ⚠️ CRITICAL: Must output CommonJS
    "target": "ES2020",
    "moduleResolution": "node",
    "outDir": "dist",
    "rootDir": "src"
  }
}
```

### 3. Server Binding Configuration
```typescript
// ❌ WRONG - doesn't work in Azure containers
const server = app.listen(port, () => {
  logger.info(`Backend running on http://localhost:${port}`);
});

// ✅ CORRECT - works in Azure containers
const server = app.listen(port, '0.0.0.0', () => {
  logger.info(`Backend running on http://0.0.0.0:${port}`);
});
```

### 4. Import Statements for CommonJS
```typescript
// ✅ CORRECT - CommonJS imports (no .js extensions)
import config from './config/index';
import logger from './utils/logger';
import { PrismaClient } from '../generated/prisma';

// ❌ WRONG - ES module imports (don't use in CommonJS)
import config from './config/index.js';
import logger from './utils/logger.js';
```

---

## Common Deployment Errors & Solutions

### Error 1: ES Module Scope Error
```
ReferenceError: exports is not defined in ES module scope
This file is being treated as an ES module because it has a '.js' file extension and '/home/site/wwwroot/package.json' contains "type": "module".
```

**Root Cause**: Package.json has `"type": "module"` but TypeScript is outputting CommonJS code.

**Solution**:
```json
{
  "type": "commonjs"  // Change from "module" to "commonjs"
}
```

### Error 2: Directory Import Error
```
Error [ERR_UNSUPPORTED_DIR_IMPORT]: Directory import '/home/site/wwwroot/generated/prisma' is not supported resolving ES modules
```

**Root Cause**: ES modules require explicit file extensions for all imports.

**Solution**: Switch to CommonJS (recommended) or add `.js` extensions to ALL relative imports.

### Error 3: Shared Package Not Found
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@ats/shared-transformations'
```

**Root Cause**: Shared package wasn't properly packaged during deployment.

**Solution**: Use proper npm packaging in GitHub Actions:
```yaml
# Build shared package first
- name: Build shared transformations package
  working-directory: ./packages/shared
  run: |
    npm ci --ignore-scripts
    npm run build
    npm pack

# Install shared package in backend
- name: Install shared package
  working-directory: ./packages/backend/deploy
  run: |
    npm install ../../shared/ats-shared-transformations-1.0.0.tgz --ignore-scripts
```

### Error 4: Container Network Binding
```
ERROR - Container didn't respond to HTTP pings on port: 4000. Failing site start.
```

**Root Cause**: Server binding to `localhost` which doesn't work in containers.

**Solution**: Always bind to `'0.0.0.0'`:
```typescript
const server = app.listen(port, '0.0.0.0', () => {
  logger.info(`Backend running on port ${port}`);
});
```

---

## Step-by-Step Setup

### 1. Project Configuration

#### Backend Package Structure
```
packages/backend/
├── src/
│   ├── server.ts              # Entry point
│   ├── routes/                # API endpoints
│   ├── services/              # Business logic
│   ├── middleware/            # Express middleware
│   ├── utils/                 # Utilities
│   └── generated/             # Prisma client (generated)
├── dist/                      # Compiled output (created by build)
├── package.json               # type: "commonjs"
├── tsconfig.json              # module: "CommonJS"
└── tsconfig.prod.json         # Production build config
```

#### Production TypeScript Config (`tsconfig.prod.json`)
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

### 2. Prisma Configuration
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

### 3. Azure App Service Environment Variables
```bash
# Database
DATABASE_URL=sqlserver://username:password@server:1433;database=dbname;encrypt=true;trustServerCertificate=false

# Azure AD Authentication
AZURE_AD_CLIENT_ID=your_client_id
AZURE_AD_CLIENT_SECRET=your_client_secret
AZURE_AD_TENANT_ID=your_tenant_id

# CORS Configuration
CORS_ORIGIN=https://your-frontend-domain.com

# Runtime
NODE_ENV=production
PORT=4000  # Azure will override to 8080 internally
```

---

## GitHub Actions Workflow

### Complete Workflow Example
```yaml
name: Build and deploy Node.js app to Azure Web App - assetorbit-api

on:
  push:
    branches: [main]
    paths:
      - 'packages/backend/**'
      - 'packages/shared/**'
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

      # Build shared package first
      - name: Build shared transformations package
        working-directory: ./packages/shared
        run: |
          npm ci --ignore-scripts || npm install --ignore-scripts
          npm run build
          npm pack

      # Build backend
      - name: Build backend and prepare deployment
        working-directory: ./packages/backend
        run: |
          # Install dependencies
          npm ci --ignore-scripts || npm install --ignore-scripts
          
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
            pkg.type = 'commonjs';  // Ensure CommonJS
            fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
          "
          
          # Install production dependencies
          npm install --omit=dev --ignore-scripts
          
          # Install shared package
          npm install ../../shared/ats-shared-transformations-1.0.0.tgz --ignore-scripts
          
          # Generate Prisma client for runtime
          npx prisma generate
          
          # Cleanup
          rm -f package-lock.json

      - name: Zip artifact for deployment
        run: |
          cd packages/backend/deploy
          zip -r ../../../deploy.zip .

      - name: Upload artifact
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
      - name: Download artifact
        uses: actions/download-artifact@v4
        with:
          name: node-app

      - name: Unzip artifact for deployment
        run: unzip deploy.zip

      - name: Login to Azure
        uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZUREAPPSERVICE_CLIENTID_xxx }}
          tenant-id: ${{ secrets.AZUREAPPSERVICE_TENANTID_xxx }}
          subscription-id: ${{ secrets.AZUREAPPSERVICE_SUBSCRIPTIONID_xxx }}

      - name: Deploy to Azure Web App
        uses: azure/webapps-deploy@v3
        with:
          app-name: 'assetorbit-api'
          slot-name: 'Production'
          package: .
          clean: true
```

---

## Module System Best Practices

### ✅ **DO: CommonJS for Production**
```typescript
// Package.json
{
  "type": "commonjs",
  "main": "dist/server.js"
}

// TypeScript config
{
  "compilerOptions": {
    "module": "CommonJS"
  }
}

// Import statements (no .js extensions)
import express from 'express';
import config from './config/index';
import { PrismaClient } from '../generated/prisma';
```

### ❌ **DON'T: ES Modules for Production**
```typescript
// Package.json (avoid for Azure)
{
  "type": "module",
  "main": "dist/server.js"
}

// TypeScript config (avoid for Azure)
{
  "compilerOptions": {
    "module": "ES2022"
  }
}

// Import statements (problematic with third-party packages)
import express from 'express';
import config from './config/index.js';
import { PrismaClient } from '../generated/prisma/index.js';
```

### **Why CommonJS is Better for Azure**
1. **Third-party compatibility**: Packages like `@microsoft/microsoft-graph-client` work better
2. **Azure runtime optimization**: App Service is optimized for CommonJS
3. **Simpler imports**: No need for `.js` extensions
4. **Fewer deployment issues**: Less prone to module resolution errors
5. **Proven pattern**: Documented in Azure deployment guides

---

## Troubleshooting Checklist

### Pre-Deployment Checklist
- [ ] **Package.json**: `"type": "commonjs"`
- [ ] **TypeScript config**: `"module": "CommonJS"`
- [ ] **Server binding**: Uses `'0.0.0.0'` not `'localhost'`
- [ ] **Import statements**: No `.js` extensions for relative imports
- [ ] **Prisma client**: Generated and included in deployment
- [ ] **Shared packages**: Properly packaged with `npm pack`
- [ ] **Environment variables**: All required vars configured in Azure
- [ ] **Build process**: Uses production TypeScript config

### Common Debug Commands
```bash
# Check Azure logs
az webapp log tail --name your-app-name --resource-group your-rg

# SSH into container
az webapp ssh --name your-app-name --resource-group your-rg

# Check environment variables
az webapp config appsettings list --name your-app-name --resource-group your-rg

# Test local build
cd packages/backend
npm run build
node dist/server.js
```

### Log Analysis Patterns
```bash
# ES Module errors (fix: use CommonJS)
"exports is not defined in ES module scope"
"ERR_UNSUPPORTED_DIR_IMPORT"

# Network binding errors (fix: bind to 0.0.0.0)
"Container didn't respond to HTTP pings"
"EADDRNOTAVAIL"

# Module resolution errors (fix: check imports)
"Cannot find module"
"MODULE_NOT_FOUND"

# Database connection errors (fix: check connection string)
"the URL must start with the protocol 'sqlserver://'"
"Login timeout expired"
```

---

## Production Monitoring

### Health Check Endpoint
```typescript
// Add to your Express app
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    nodeVersion: process.version,
    environment: process.env.NODE_ENV
  });
});
```

### Application Insights Configuration
```typescript
// Add to server.ts
if (process.env.NODE_ENV === 'production') {
  const appInsights = require('applicationinsights');
  appInsights.setup()
    .setAutoDependencyCorrelation(true)
    .setAutoCollectRequests(true)
    .setAutoCollectPerformance(true)
    .setAutoCollectExceptions(true)
    .setAutoCollectDependencies(true)
    .start();
}
```

### Performance Monitoring
- **Memory usage**: Monitor for memory leaks
- **Response times**: Track API performance
- **Error rates**: Monitor application exceptions
- **Database connections**: Track Prisma connection pool
- **Container restarts**: Watch for deployment issues

---

## Key Success Factors

### 1. **Module System Consistency**
- Always use CommonJS for Azure deployment
- Never mix ES modules and CommonJS in production
- Test locally with the same module system as production

### 2. **Proper Dependency Management**
- Build shared packages before consumers
- Use `npm pack` for internal package distribution
- Include all generated files in deployment

### 3. **Container Compatibility**
- Bind to `0.0.0.0` for network access
- Use environment variables for configuration
- Handle graceful shutdowns

### 4. **Monitoring and Debugging**
- Enable comprehensive logging
- Use Application Insights for production monitoring
- Implement health checks for container management

---

## Conclusion

This guide provides a battle-tested approach to deploying Node.js TypeScript applications with Prisma to Azure App Service. The key to success is:

1. **Stick to CommonJS** for production deployments
2. **Follow the external build pattern** with GitHub Actions
3. **Properly package shared dependencies**
4. **Use container-compatible networking**
5. **Monitor and debug systematically**

By following these patterns, you can avoid the most common deployment pitfalls and achieve reliable, production-ready deployments.

---

**Last Updated**: August 2025  
**Tested With**: Node.js 20.x, TypeScript 5.x, Prisma 5.x, Azure App Service Linux