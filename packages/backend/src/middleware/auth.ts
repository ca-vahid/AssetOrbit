import passport from 'passport';
import { BearerStrategy, ITokenPayload } from 'passport-azure-ad';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { Request, Response, NextFunction } from 'express';
import prisma from '../services/database.js';

const strategy = new BearerStrategy(
  {
    identityMetadata: `https://login.microsoftonline.com/${config.azure.tenantId}/v2.0/.well-known/openid-configuration`,
    clientID: config.azure.clientId,
    audience: config.azure.audience,
    validateIssuer: false,
    loggingLevel: 'warn',
  },
  async (token: ITokenPayload, done: (err: any, user?: any) => void) => {
    try {
      // Look up user in database to get their role
      const azureAdId = token.oid;
      const email = token.preferred_username || (token as any).upn || (token as any).unique_name || (token as any).email;
      
      let dbUser = null;
      
      // Try to find user by Azure AD ID first
      if (azureAdId) {
        dbUser = await prisma.user.findUnique({ where: { azureAdId } });
      }
      
      // Fallback to email lookup
      if (!dbUser && email) {
        dbUser = await prisma.user.findUnique({ where: { email } });
      }
      
      // Auto-provision user if not found
      if (!dbUser) {
        dbUser = await prisma.user.create({
          data: {
            azureAdId: azureAdId || `temp-${Date.now()}`,
            email: email || `${azureAdId}@example.com`,
            displayName: token.name || email || 'Unknown User',
            givenName: (token as any).given_name,
            surname: (token as any).family_name,
            role: 'READ', // Default role
            department: (token as any).department,
            officeLocation: (token as any).office_location,
          },
        });
      }
      
      // Attach both token and database user info to request
      const userWithRole = {
        ...token,
        dbUser,
        role: dbUser.role,
        userId: dbUser.id,
      };
      
    logger.info('JWT token validated successfully', {
      oid: token.oid,
      name: token.name,
        email: email,
        role: dbUser.role,
        userId: dbUser.id,
      });
      
      return done(null, userWithRole);
    } catch (error) {
      logger.error('Error during token validation:', error);
      return done(error, null);
    }
  },
);

passport.use(strategy);

// The BearerStrategy from passport-azure-ad registers with the name "oauth-bearer"
export const authenticateJwt = passport.authenticate('oauth-bearer', { session: false });

// Role-based authorization middleware
export const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
};

export function initAuth(app: import('express').Express) {
  app.use(passport.initialize());

  passport.serializeUser((user: any, done: (err: any, id?: any) => void) => done(null, user));
  passport.deserializeUser((obj: any, done: (err: any, user?: any) => void) => done(null, obj));

  logger.info('Azure AD JWT authentication initialized', {
    tenantId: config.azure.tenantId,
    clientId: config.azure.clientId,
    audience: config.azure.audience,
  });
} 