import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import config from './config';
import type { Request, Response } from 'express';

import healthRouter from './routes/health';

const app = express();
const port = config.port;

app.use(
  cors({
    origin: config.corsOrigin,
  }),
);
app.use(express.json());
app.use(morgan('dev'));

app.use('/api/health', healthRouter);

app.get('/', (_req: Request, res: Response) => {
  res.send('AssetOrbit API');
});

app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
}); 