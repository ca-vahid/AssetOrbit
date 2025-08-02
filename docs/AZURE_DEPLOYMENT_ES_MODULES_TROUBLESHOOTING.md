# Azure Deployment ES Modules Troubleshooting Guide

> **Quick Reference**: Essential fixes for Azure App Service deployment failures with ES modules and shared packages

## Overview

This guide addresses common deployment failures when deploying Node.js applications with ES modules (`"type": "module"`) and shared packages to Azure App Service. The issues typically manifest as container startup failures with module resolution errors.

## Common Error Patterns

### 1. Shared Package Not Found
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@ats/shared-transformations' imported from /home/site/wwwroot/routes/import.js
```

### 2. Internal Module Resolution Failures
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/node_modules/@ats/shared-transformations/dist/importTransformations' imported from /node_modules/@ats/shared-transformations/dist/index.js
```

### 3. Container Network Binding Issues
```
ERROR - Container didn't respond to HTTP pings on port: 4000. Failing site start.
```

### 4. TypeScript Compilation Errors
```
error TS2835: Relative import paths need explicit file extensions in ECMAScript imports when '--moduleResolution' is 'node16' or 'nodenext'.
```

## Root Causes & Solutions

### 1. ✅ Shared Package Export Configuration

**Problem**: Shared packages don't have proper `exports` field for ES modules.

**Solution**: Update `packages/shared/package.json`:
```json
{
  "name": "@ats/shared-transformations",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.js"
    }
  },
  "files": [
    "dist",
    "src"
  ]
}
```

### 2. ✅ GitHub Actions Build Order

**Problem**: Shared package isn't built before consumers try to use it.

**Solution**: Update workflows to build shared package first:
```yaml
- name: Build shared transformations package
  working-directory: ./packages/shared
  run: |
    npm ci --ignore-scripts || npm install --ignore-scripts
    npm run build
```

### 3. ✅ Proper Shared Package Installation

**Problem**: Manual copying to `node_modules` doesn't work with Azure's packaging system.

**Solution**: Use `npm pack` and `npm install` for proper installation:
```yaml
# Pack the built shared package and install it properly
cd ../shared
npm pack
cd ../backend/deploy

# Install the packed shared package (npm pack creates ats-shared-transformations-1.0.0.tgz)
npm install ../../shared/ats-shared-transformations-1.0.0.tgz --ignore-scripts
```

### 4. ✅ Server Network Binding

**Problem**: Server binds to `localhost` which doesn't work in Azure containers.

**Solution**: Bind to `0.0.0.0` in server code:
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

### 5. ✅ ES Module Import Extensions

**Problem**: Node.js ES modules require explicit `.js` extensions for all relative imports.

**Solution**: Add `.js` extensions to ALL relative imports in ALL files:

**Backend imports** (`packages/backend/src/server.ts`):
```typescript
// ❌ WRONG
import config from './config';
import logger from './utils/logger';

// ✅ CORRECT
import config from './config/index.js';
import logger from './utils/logger.js';
```

**Shared package exports** (`packages/shared/src/index.ts`):
```typescript
// ❌ WRONG
export * from './importTransformations';
export * from './importSources/transformationRegistry';

// ✅ CORRECT
export * from './importTransformations.js';
export * from './importSources/transformationRegistry.js';
```

**Shared package internal imports** (`packages/shared/src/importSources/transformationRegistry.ts`):
```typescript
// ❌ WRONG
import { transformNinjaOneRow } from './ninjaOneTransforms';
import type { ColumnMapping } from '../importTransformations';

// ✅ CORRECT
import { transformNinjaOneRow } from './ninjaOneTransforms.js';
import type { ColumnMapping } from '../importTransformations.js';
```

## Complete Deployment Checklist

### Pre-Deployment Verification

- [ ] **Shared Package Configuration**
  - [ ] `package.json` has proper `exports` field
  - [ ] `"type": "module"` is set
  - [ ] `files` array includes `dist` and `src`

- [ ] **ES Module Imports**
  - [ ] All backend relative imports have `.js` extensions
  - [ ] All shared package exports have `.js` extensions  
  - [ ] All shared package internal imports have `.js` extensions

- [ ] **Server Configuration**
  - [ ] Server binds to `'0.0.0.0'` not `'localhost'`
  - [ ] Port configuration uses `process.env.PORT || 4000`

- [ ] **GitHub Actions Workflow**
  - [ ] Shared package builds before backend
  - [ ] Uses `npm pack` and `npm install` for shared package
  - [ ] Triggers on changes to both `packages/backend/**` and `packages/shared/**`

### Local Testing Commands

```bash
# Test backend build
cd packages/backend
npx tsc -p tsconfig.prod.json

# Test shared package build  
cd packages/shared
npm run build

# Test shared package packing
npm pack
```

### Debugging Container Failures

1. **Check Azure logs** for the exact error message
2. **Look for timestamps** - ensure you're seeing logs from the latest deployment
3. **Common patterns**:
   - Module not found = missing `.js` extensions or package installation issue
   - Container exit = server binding or startup error
   - Timeout on port = wrong binding address

## Quick Fix Reference

| Error Type | Quick Fix |
|------------|-----------|
| `Cannot find package '@ats/shared-transformations'` | Fix GitHub Actions to use `npm pack` + `npm install` |
| `Cannot find module '...importTransformations'` | Add `.js` extensions to shared package imports |
| `Container didn't respond to HTTP pings` | Change server binding to `'0.0.0.0'` |
| `Relative import paths need explicit file extensions` | Add `.js` to all relative imports |

## Prevention Strategy

1. **Always use `.js` extensions** for relative imports in ES modules
2. **Test deployments incrementally** - shared package first, then consumers
3. **Use proper npm packaging** instead of manual file copying
4. **Bind servers to `0.0.0.0`** for container compatibility
5. **Update workflows** when adding new packages or dependencies

---

**Last Updated**: August 2025  
**Applies To**: Azure App Service, Node.js 20.x, ES Modules, TypeScript monorepos