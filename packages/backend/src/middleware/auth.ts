import passport from 'passport';
import { BearerStrategy, ITokenPayload } from 'passport-azure-ad';
import config from '../config';
import logger from '../utils/logger';

const strategy = new BearerStrategy(
  {
    identityMetadata: `https://login.microsoftonline.com/${config.azure.tenantId}/v2.0/.well-known/openid-configuration`,
    clientID: config.azure.clientId,
    audience: config.azure.audience,
    validateIssuer: false,
    loggingLevel: 'warn',
  },
  (token: ITokenPayload, done: (err: any, user?: any) => void) => {
    // You can perform additional checks or user look-up here
    logger.info('JWT token validated successfully', {
      oid: token.oid,
      name: token.name,
      email: token.preferred_username,
      audience: token.aud,
      scope: token.scp,
    });
    return done(null, token);
  },
);

passport.use(strategy);

export const authenticateJwt = passport.authenticate('oauth-bearer', { session: false });

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