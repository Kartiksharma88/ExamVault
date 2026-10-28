import * as crypto from 'crypto';
import { ExamVaultVerifier, AuditDataset } from '../verifier';
import { CanonicalAuditEvent, canonicalizeJson } from '@examvault/audit-canonical';

describe('ExamVaultVerifier', () => {
  let verifier: ExamVaultVerifier;

  beforeEach(() => {
    verifier = new ExamVaultVerifier();
  });

  function createSampleCleanDataset(): AuditDataset {
    let prevHash = '0'.repeat(64);
    const events: AuditDataset['events'] = [];

    for (let i = 0; i < 3; i++) {
      const eventId = `00000000-0000-4000-8000-00000000000${i}`;
      const canonicalObj: CanonicalAuditEvent = {
        schema_version: '1.0.0',
        event_id: eventId,
        event_type: 'QUESTION_VERSION_COMMITTED',
        timestamp: new Date(1700000000000 + i * 1000).toISOString(),
        actor_pseudonym: `pseudonym_${i}`,
        subject_type: 'question',
        subject_id: `q_${i}`,
        version_no: 1,
        payload_hash: `hash_${i}`,
        content_commitment: `commitment_${i}`,
        approval_signature: null,
        prev_event_hash: prevHash,
        metadata_hash: '',
      };

      const canonicalJson = canonicalizeJson(canonicalObj);
      const entryHash = crypto
        .createHash('sha256')
        .update(prevHash)
        .update(canonicalJson)
        .digest('hex');

      events.push({
        id: eventId,
        timestamp: canonicalObj.timestamp,
        action: canonicalObj.event_type,
        targetType: canonicalObj.subject_type,
        targetId: canonicalObj.subject_id,
        versionNo: canonicalObj.version_no,
        actorPseudonym: canonicalObj.actor_pseudonym,
        prevHash,
        entryHash,
        signature: 'synthetic_sig_base64',
        payloadHash: canonicalObj.payload_hash,
        contentCommitment: canonicalObj.content_commitment,
        approvalSignature: null,
        metadataHash: '',
        schemaVersion: '1.0.0',
      });

      prevHash = entryHash;
    }

    const fabricRecords = events.map((e) => ({
      eventId: e.id,
      eventHash: e.payloadHash || e.entryHash,
      txId: `tx_${e.id}`,
      blockNo: 10,
      endorsements: ['ExamBodyMSP', 'UniversityMSP'], // 2 of 3 quorum satisfied
    }));

    const approvals = [
      {
        id: 'app-1',
        questionId: 'q_0',
        versionNo: 1,
        contentCommitment: 'commitment_0',
        storedVersionCommitment: 'commitment_0',
        signature: 'sig',
        publicKey: 'pubkey',
      },
    ];

    const storageScans = [
      {
        id: 'scan-1',
        scannedAt: new Date().toISOString(),
        corruptedObjects: 0,
      },
    ];

    return {
      events,
      fabricRecords,
      approvals,
      storageScans,
      checkpoints: [],
      witnessRecords: [],
    };
  }

  it('passes all verification checks on a clean, untampered dataset', () => {
    const dataset = createSampleCleanDataset();
    const report = verifier.verify(dataset);

    expect(report.overallValid).toBe(true);
    expect(report.firstInconsistency).toBeUndefined();
    expect(report.checks.every((c) => c.passed)).toBe(true);
  });

  it('detects a modified field in a past event (tamper scenario 1)', () => {
    const dataset = createSampleCleanDataset();
    // Tamper with action of event 0
    dataset.events[0].action = 'UNAUTHORIZED_TAMPERED_ACTION';

    const report = verifier.verify(dataset);
    expect(report.overallValid).toBe(false);
    expect(report.firstInconsistency?.checkName).toBe('Hash Chain Continuity');
    expect(report.firstInconsistency?.design).toBe('Design B (Signed Log)');
  });

  it('detects a deleted middle event in the hash chain (tamper scenario 2)', () => {
    const dataset = createSampleCleanDataset();
    // Delete event at index 1
    dataset.events.splice(1, 1);

    const report = verifier.verify(dataset);
    expect(report.overallValid).toBe(false);
    expect(report.firstInconsistency?.checkName).toBe('Hash Chain Continuity');
    expect(report.firstInconsistency?.reason).toContain('Broken chain link');
  });

  it('detects reordered events (tamper scenario 3)', () => {
    const dataset = createSampleCleanDataset();
    // Swap events 0 and 1
    const tmp = dataset.events[0];
    dataset.events[0] = dataset.events[1];
    dataset.events[1] = tmp;

    const report = verifier.verify(dataset);
    expect(report.overallValid).toBe(false);
    expect(report.firstInconsistency?.checkName).toBe('Hash Chain Continuity');
  });

  it('detects a missing CRITICAL event on Fabric ledger (tamper scenario 8)', () => {
    const dataset = createSampleCleanDataset();
    // Drop the fabric record for event 1
    dataset.fabricRecords = dataset.fabricRecords?.filter((r) => r.eventId !== dataset.events[1].id);

    const report = verifier.verify(dataset);
    expect(report.overallValid).toBe(false);
    expect(report.firstInconsistency?.checkName).toBe('Fabric Ledger Anchoring');
    expect(report.firstInconsistency?.design).toBe('Design A (Fabric)');
    expect(report.firstInconsistency?.entityId).toBe(dataset.events[1].id);
  });

  it('detects endorsement policy quorum violation when only 1 org endorses', () => {
    const dataset = createSampleCleanDataset();
    // Reduce endorsements on event 0 to only ExamBodyMSP (1 of 3, fails 2-of-3 majority)
    dataset.fabricRecords![0].endorsements = ['ExamBodyMSP'];

    const report = verifier.verify(dataset);
    expect(report.overallValid).toBe(false);
    expect(report.firstInconsistency?.checkName).toBe('Fabric Ledger Anchoring');
    expect(report.firstInconsistency?.reason).toContain('2-of-3 majority endorsement policy');
  });

  it('detects an approval content commitment mismatch', () => {
    const dataset = createSampleCleanDataset();
    // Tamper with approval content commitment
    dataset.approvals![0].storedVersionCommitment = 'different_tampered_commitment';

    const report = verifier.verify(dataset);
    expect(report.overallValid).toBe(false);
    expect(report.firstInconsistency?.checkName).toBe('Digital Approvals Binding');
  });

  it('detects a compromised storage ciphertext object (tamper scenario 7)', () => {
    const dataset = createSampleCleanDataset();
    dataset.storageScans![0].corruptedObjects = 1;

    const report = verifier.verify(dataset);
    expect(report.overallValid).toBe(false);
    expect(report.firstInconsistency?.checkName).toBe('Storage Ciphertext Integrity');
    expect(report.firstInconsistency?.design).toBe('Storage Integrity');
  });

  it('detects a contradictory checkpoint from external witness (tamper scenario 6)', () => {
    const dataset = createSampleCleanDataset();
    dataset.witnessRecords = [
      {
        rootHash: 'root_hash_a',
        treeSize: 10,
        witnessSignature: 'sig_a',
        timestamp: new Date().toISOString(),
      },
      {
        rootHash: 'conflicting_root_hash_b', // Contradictory root for same treeSize
        treeSize: 10,
        witnessSignature: 'sig_b',
        timestamp: new Date().toISOString(),
      },
    ];

    const report = verifier.verify(dataset);
    expect(report.overallValid).toBe(false);
    expect(report.firstInconsistency?.checkName).toBe('Witness Consistency');
    expect(report.firstInconsistency?.design).toBe('External Witness');
  });
});
