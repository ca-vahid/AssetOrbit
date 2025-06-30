# AssetOrbit Monorepo

This repository contains the source code for **AssetOrbit** described in the accompanying PRD, TECH, and TODO documents. The project is organized as an **npm workspaces** monorepo with three packages:

| Package | Path | Description |
|---------|------|-------------|
| **Backend** | `packages/backend` | Node.js + TypeScript API powered by Express |
| **Frontend** | `packages/frontend` | React + TypeScript single-page application built with Vite & Tailwind CSS |
| **Shared** | `packages/shared` | Reusable TypeScript types, constants, and utilities shared between front-end and back-end |

## Prerequisites

- Node.js 18+
- npm 9+

## Getting Started

Install all workspace dependencies:

```bash
npm install
```

### Development

Run the backend and frontend in parallel (default ports `4000` and `5173`):

```bash
npm run dev
```

### Building

```bash
npm run build
```

### Linting & Formatting

```bash
npm run lint   # ESLint
npm run format # Prettier
```

### Husky Git Hooks

After the first install, Husky hooks are set up automatically via the `prepare` script. Pre-commit hooks will run ESLint and Prettier on staged files to ensure code quality.

## Environment Variables

Copy `.env.example` files to `.env` inside each package and adjust values. For **local overrides** use `.env.local` – values in this file take precedence over `.env` and should **never** be committed.

### Azure SQL connection string (Prisma)
Prisma expects a JDBC-style SQL Server URL, **not** the ADO.NET string shown in the Azure Portal. Example:

```
DATABASE_URL="sqlserver://assetorbit-sqlsrv.database.windows.net:1433;database=AssetOrbitDB;user=bgcadmin;password={P@55w0rd with spaces; and symbols};encrypt=true;trustServerCertificate=false"
```

Guidelines:
1. Start with `sqlserver://`.
2. Separate options with semicolons `;`.
3. Wrap the **entire password in curly braces `{}`** if it contains special characters (`: ; @ / = [ ] { } ( ) space`).
4. Keep the whole URL on one line and inside quotes.
5. `encrypt=true` and `trustServerCertificate=false` are required for Azure SQL.

The backend automatically loads both `.env` and `.env.local` via `dotenv`, with `.env.local` overriding, so you can keep production values in `.env` and local secrets in `.env.local`.

## Folder Structure (simplified)

```
packages/
  backend/
    src/
      routes/
    ...
  frontend/
    src/
      components/
      pages/
    ...
  shared/
    src/
      types/
```

## References

- See `PRD.md` for product requirements
- See `TECH.md` for detailed technical specifications
- See `TODO.md` for the implementation roadmap

## Authentication

The app uses Azure Active Directory (v2.0) tokens.
- Front-end obtains tokens via MSAL (popup flow)
- Back-end validates JWTs with `passport-azure-ad` BearerStrategy
- Protected API sample: `GET /api/protected`

## Deployment Options

| Pattern | Summary |
|---------|---------|
| **Single App Service** | Build frontend, copy `packages/frontend/dist` into `packages/backend/public`, deploy the backend folder. SPA & API share the same host. |
| **Static Web App + App Service** | Deploy React build to Azure Static Web Apps (global CDN) and Express API to a separate App Service. Add the Static Web Apps URL to `CORS_ORIGIN` on the API. |

A sample GitHub Action for the single-app pattern lives in `.github/workflows/azure-webapp.yml` (create and add a publish-profile secret named `AZUREAPPSERVICE_PUBLISHPROFILE`). 