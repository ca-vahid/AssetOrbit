import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import config from './config';
import type { Request, Response } from 'express';
import logger from './utils/logger';

import healthRouter from './routes/health';
import { initAuth, authenticateJwt } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';

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

app.use(express.json());
app.use(
  morgan('[:method] :url :status :res[content-length] - :response-time ms', {
    stream: {
      write: (message) => logger.info(message.trim()),
    },
  }),
);

initAuth(app);

app.use('/api/health', healthRouter);

// Protected route example
app.get('/api/protected', authenticateJwt, (req: Request, res: Response) => {
  logger.info('Protected route accessed', { user: (req as any).user?.name });
  res.json({ message: 'Secure data accessed', user: (req as any).user });
});

app.get('/', (_req: Request, res: Response) => {
  res.send('AssetOrbit API');
});

app.listen(port, () => {
  logger.info(`Backend running on http://localhost:${port}`);
});

// Error handling middleware (must be last)
app.use(errorHandler); 