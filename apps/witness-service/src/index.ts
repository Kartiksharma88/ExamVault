import express, { Request, Response } from 'express';
import { WitnessService } from './witness.service';

export const witnessService = new WitnessService();

export function createWitnessApp(service = witnessService): express.Express {
  const app: express.Express = express();
  app.use(express.json());

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'HEALTHY', service: 'ExamVault External Witness', time: new Date().toISOString() });
  });

  app.get('/public-key', (_req: Request, res: Response) => {
    res.json({ success: true, publicKeyDer: service.getPublicKeyDer() });
  });

  app.post('/checkpoints', (req: Request, res: Response) => {
    try {
      const receipt = service.receiveCheckpoint(req.body);
      res.status(201).json({ success: true, data: receipt });
    } catch (err: any) {
      if (err.message.includes('CRITICAL INTEGRITY ALERT')) {
        res.status(409).json({ success: false, error: err.message, alertRaised: true });
      } else {
        res.status(400).json({ success: false, error: err.message });
      }
    }
  });

  app.get('/checkpoints', (_req: Request, res: Response) => {
    res.json({ success: true, data: service.getCheckpoints() });
  });

  app.get('/checkpoints/latest', (_req: Request, res: Response) => {
    res.json({ success: true, data: service.getLatestCheckpoint() });
  });

  app.get('/alerts', (_req: Request, res: Response) => {
    res.json({ success: true, data: service.getAlerts() });
  });

  return app;
}

if (require.main === module) {
  const port = process.env.PORT || 3005;
  const app = createWitnessApp();
  app.listen(port, () => {
    console.log(`ExamVault External Witness Service listening on port ${port}`);
  });
}
