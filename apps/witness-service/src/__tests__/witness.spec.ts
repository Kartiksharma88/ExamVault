import request from 'supertest';
import { createWitnessApp } from '../index';
import { WitnessService } from '../witness.service';

describe('External Witness Service', () => {
  let witnessService: WitnessService;
  let app: any;

  const validRoot = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

  beforeEach(() => {
    witnessService = new WitnessService();
    const { createWitnessApp } = require('../index');
    app = createWitnessApp(witnessService);
  });

  it('responds with healthy status on /health', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('HEALTHY');
  });

  it('accepts and countersigns a valid checkpoint submission', async () => {
    const submission = {
      rootHash: validRoot,
      rangeStart: 0,
      rangeEnd: 50,
      eventCount: 50,
      treeSize: 50,
      authorSignature: 'exambody-ed25519-sig',
      timestamp: new Date().toISOString(),
    };

    const res = await request(app).post('/checkpoints').send(submission);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.witnessSignature).toBeDefined();
    expect(res.body.data.witnessPublicKey).toBeDefined();
  });

  it('detects a conflicting checkpoint (history rewrite attack) and raises 409 conflict alert', async () => {
    const originalSubmission = {
      rootHash: validRoot,
      rangeStart: 0,
      rangeEnd: 50,
      eventCount: 50,
      treeSize: 50,
      authorSignature: 'exambody-ed25519-sig-1',
      timestamp: new Date().toISOString(),
    };

    await request(app).post('/checkpoints').send(originalSubmission);

    // Attacker modifies a past event in DB and re-signs with legitimate key
    const conflictingSubmission = {
      rootHash: '1111111111111111111111111111111111111111111111111111111111111111',
      rangeStart: 0,
      rangeEnd: 50,
      eventCount: 50,
      treeSize: 50,
      authorSignature: 'exambody-ed25519-sig-2',
      timestamp: new Date().toISOString(),
    };

    const res = await request(app).post('/checkpoints').send(conflictingSubmission);
    expect(res.status).toBe(409);
    expect(res.body.alertRaised).toBe(true);
    expect(res.body.error).toContain('CRITICAL INTEGRITY ALERT');

    // Confirm alert recorded in /alerts endpoint
    const alertsRes = await request(app).get('/alerts');
    expect(alertsRes.status).toBe(200);
    expect(alertsRes.body.data).toHaveLength(1);
    expect(alertsRes.body.data[0].alertType).toBe('CONFLICTING_CHECKPOINT_DETECTED');
  });

  it('accepts identical duplicate submission as idempotent retry', async () => {
    const submission = {
      rootHash: validRoot,
      rangeStart: 0,
      rangeEnd: 50,
      eventCount: 50,
      treeSize: 50,
      authorSignature: 'sig',
      timestamp: new Date().toISOString(),
    };

    const res1 = await request(app).post('/checkpoints').send(submission);
    const res2 = await request(app).post('/checkpoints').send(submission);

    expect(res1.body.data.witnessSignature).toBe(res2.body.data.witnessSignature);
  });
});
