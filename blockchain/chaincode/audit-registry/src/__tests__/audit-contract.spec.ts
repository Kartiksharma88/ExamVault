import { AuditRegistryContract } from '../audit-contract';
import { CANONICAL_EVENT_TEST_VECTOR } from '@examvault/audit-canonical';

class MockStub {
  private state = new Map<string, Buffer>();
  private events = new Map<string, Buffer>();
  private txId = 'test-tx-123456';

  getTxID() {
    return this.txId;
  }

  getTxTimestamp() {
    return {
      seconds: { low: Math.floor(Date.now() / 1000) },
      nanos: 0,
    };
  }

  async getState(key: string): Promise<Buffer> {
    return this.state.get(key) || Buffer.alloc(0);
  }

  async putState(key: string, value: Buffer): Promise<void> {
    this.state.set(key, value);
  }

  setEvent(name: string, payload: Buffer): void {
    this.events.set(name, payload);
  }

  getEmittedEvent(name: string): Buffer | undefined {
    return this.events.get(name);
  }

  async getStateByRange(startKey: string, endKey: string) {
    const entries: Array<{ key: string; value: Buffer }> = [];
    for (const [k, v] of this.state.entries()) {
      if (k.startsWith('CHK_')) {
        entries.push({ key: k, value: v });
      }
    }
    let idx = 0;
    return {
      next: async () => {
        if (idx < entries.length) {
          const item = entries[idx++];
          return { value: item, done: false };
        }
        return { done: true, value: undefined };
      },
      close: async () => {},
    };
  }
}

class MockClientIdentity {
  constructor(private mspId: string) {}
  getMSPID() {
    return this.mspId;
  }
}

function createMockContext(mspId = 'ExamBodyMSP') {
  const stub = new MockStub();
  const clientIdentity = new MockClientIdentity(mspId);
  return {
    stub,
    clientIdentity,
  } as any;
}

describe('AuditRegistryContract Unit Tests with Mock Stub', () => {
  let contract: AuditRegistryContract;

  beforeEach(() => {
    contract = new AuditRegistryContract();
  });

  describe('Access Control by MSP', () => {
    it('allows ExamBodyMSP to register an event', async () => {
      const ctx = createMockContext('ExamBodyMSP');
      const eventJson = JSON.stringify(CANONICAL_EVENT_TEST_VECTOR.event);

      const result = await contract.RegisterEvent(ctx, eventJson);
      expect(result).toBeDefined();

      const parsed = JSON.parse(result);
      expect(parsed.eventId).toBe(CANONICAL_EVENT_TEST_VECTOR.event.event_id);
      expect(parsed.registeredByMSP).toBe('ExamBodyMSP');
      expect(ctx.stub.getEmittedEvent('EventRegistered')).toBeDefined();
    });

    it('rejects RegisterEvent when called by AuditorMSP or UniversityMSP', async () => {
      const ctxAuditor = createMockContext('AuditorMSP');
      const eventJson = JSON.stringify(CANONICAL_EVENT_TEST_VECTOR.event);

      await expect(contract.RegisterEvent(ctxAuditor, eventJson)).rejects.toThrow(
        /Unauthorized: only ExamBodyMSP is authorized/,
      );

      const ctxUniv = createMockContext('UniversityMSP');
      await expect(contract.RegisterEvent(ctxUniv, eventJson)).rejects.toThrow(
        /Unauthorized: only ExamBodyMSP is authorized/,
      );
    });
  });

  describe('Idempotency & Conflict Detection', () => {
    it('accepts identical duplicate registration as idempotent', async () => {
      const ctx = createMockContext('ExamBodyMSP');
      const eventJson = JSON.stringify(CANONICAL_EVENT_TEST_VECTOR.event);

      const firstResult = await contract.RegisterEvent(ctx, eventJson);
      const secondResult = await contract.RegisterEvent(ctx, eventJson);

      expect(JSON.parse(firstResult).txId).toBe(JSON.parse(secondResult).txId);
    });

    it('rejects duplicate event_id with conflicting hash', async () => {
      const ctx = createMockContext('ExamBodyMSP');
      const original = CANONICAL_EVENT_TEST_VECTOR.event;
      const eventJson = JSON.stringify(original);

      await contract.RegisterEvent(ctx, eventJson);

      const conflictingEvent = {
        ...original,
        payload_hash: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
      };

      await expect(contract.RegisterEvent(ctx, JSON.stringify(conflictingEvent))).rejects.toThrow(
        /conflict: event_id .* already registered with different hash/,
      );
    });

    it('rejects malformed event payload or invalid schema', async () => {
      const ctx = createMockContext('ExamBodyMSP');
      const invalidJson = JSON.stringify({ notAnEvent: true });

      await expect(contract.RegisterEvent(ctx, invalidJson)).rejects.toThrow(
        /RegisterEvent rejected: schema validation failure/,
      );
    });
  });

  describe('Checkpoints & Counter-Attestation', () => {
    const validRoot = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

    it('registers a Merkle checkpoint from ExamBodyMSP', async () => {
      const ctx = createMockContext('ExamBodyMSP');
      const res = await contract.RegisterCheckpoint(ctx, validRoot, 0, 100, 100);

      const parsed = JSON.parse(res);
      expect(parsed.merkleRoot).toBe(validRoot);
      expect(parsed.rangeStart).toBe(0);
      expect(parsed.rangeEnd).toBe(100);
      expect(ctx.stub.getEmittedEvent('CheckpointRegistered')).toBeDefined();
    });

    it('allows UniversityMSP and AuditorMSP to attest a checkpoint', async () => {
      const ctx = createMockContext('ExamBodyMSP');
      await contract.RegisterCheckpoint(ctx, validRoot, 0, 100, 100);

      // Auditor attestation
      const ctxAuditor = { ...ctx, clientIdentity: new MockClientIdentity('AuditorMSP') };
      const attested1 = await contract.AttestCheckpoint(ctxAuditor, 0, 100, 'sig-auditor-123');
      const parsed1 = JSON.parse(attested1);
      expect(parsed1.attestations).toHaveLength(1);
      expect(parsed1.attestations[0].mspId).toBe('AuditorMSP');

      // University attestation
      const ctxUniv = { ...ctx, clientIdentity: new MockClientIdentity('UniversityMSP') };
      const attested2 = await contract.AttestCheckpoint(ctxUniv, 0, 100, 'sig-univ-456');
      const parsed2 = JSON.parse(attested2);
      expect(parsed2.attestations).toHaveLength(2);
      expect(parsed2.attestations[1].mspId).toBe('UniversityMSP');
    });

    it('prevents duplicate attestation from the same organization', async () => {
      const ctx = createMockContext('ExamBodyMSP');
      await contract.RegisterCheckpoint(ctx, validRoot, 0, 100, 100);

      const ctxAuditor = { ...ctx, clientIdentity: new MockClientIdentity('AuditorMSP') };
      await contract.AttestCheckpoint(ctxAuditor, 0, 100, 'sig-auditor-123');

      await expect(contract.AttestCheckpoint(ctxAuditor, 0, 100, 'sig-auditor-second')).rejects.toThrow(
        /Organization AuditorMSP has already attested checkpoint/,
      );
    });
  });

  describe('Verification & Querying', () => {
    it('verifies recorded event with matching expected hash', async () => {
      const ctx = createMockContext('ExamBodyMSP');
      const eventJson = JSON.stringify(CANONICAL_EVENT_TEST_VECTOR.event);
      await contract.RegisterEvent(ctx, eventJson);

      const verifyRes = await contract.VerifyEvent(
        ctx,
        CANONICAL_EVENT_TEST_VECTOR.event.event_id,
        CANONICAL_EVENT_TEST_VECTOR.event.payload_hash,
      );
      const parsed = JSON.parse(verifyRes);
      expect(parsed.valid).toBe(true);
      expect(parsed.storedHash).toBe(CANONICAL_EVENT_TEST_VECTOR.event.payload_hash);
    });

    it('detects mismatch during VerifyEvent when hash does not match', async () => {
      const ctx = createMockContext('ExamBodyMSP');
      const eventJson = JSON.stringify(CANONICAL_EVENT_TEST_VECTOR.event);
      await contract.RegisterEvent(ctx, eventJson);

      const verifyRes = await contract.VerifyEvent(
        ctx,
        CANONICAL_EVENT_TEST_VECTOR.event.event_id,
        '0000000000000000000000000000000000000000000000000000000000000000',
      );
      const parsed = JSON.parse(verifyRes);
      expect(parsed.valid).toBe(false);
    });

    it('confirms contract has no update or delete functions', () => {
      const proto = Object.getPrototypeOf(contract);
      const methods = Object.getOwnPropertyNames(proto);

      expect(methods).not.toContain('UpdateEvent');
      expect(methods).not.toContain('DeleteEvent');
      expect(methods).not.toContain('UpdateCheckpoint');
      expect(methods).not.toContain('DeleteCheckpoint');
    });
  });
});
