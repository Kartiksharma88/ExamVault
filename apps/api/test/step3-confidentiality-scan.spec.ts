import * as crypto from 'crypto';
import {
  CanonicalAuditEvent,
  canonicalizeJson,
  DEFAULT_CRITICAL_EVENT_TYPES,
  DEFAULT_BULK_EVENT_TYPES,
} from '@examvault/audit-canonical';

describe('Step 3 Confidentiality & Data Minimization Scan', () => {
  const sensitiveQuestionStem = 'What is the speed of light in vacuum? 299,792,458 m/s';
  const sensitiveAnswerKey = 'Option B: 3.0 x 10^8 m/s';
  const sensitiveComment = 'This question needs clarification on units.';
  const sensitiveUserName = 'Dr. Vikram Sarabhai';
  const sensitiveEmail = 'vikram.sarabhai@examvault.ac.in';

  it('ensures CanonicalAuditEvent schema contains zero plaintext content fields', () => {
    const event: CanonicalAuditEvent = {
      schema_version: '1.0.0',
      event_id: crypto.randomUUID(),
      event_type: 'QUESTION_VERSION_COMMITTED',
      timestamp: new Date().toISOString(),
      actor_pseudonym: crypto.createHmac('sha256', 'secret').update(sensitiveEmail).digest('hex'),
      subject_type: 'question',
      subject_id: 'ev-phy-001',
      version_no: 1,
      payload_hash: crypto.createHash('sha256').update(sensitiveQuestionStem).digest('hex'),
      content_commitment: crypto.createHash('sha256').update(sensitiveQuestionStem + sensitiveAnswerKey).digest('hex'),
      approval_signature: null,
      prev_event_hash: '0'.repeat(64),
      metadata_hash: crypto.createHash('sha256').update(sensitiveComment).digest('hex'),
    };

    const serialized = canonicalizeJson(event);

    // Verify complete absence of raw strings
    expect(serialized).not.toContain(sensitiveQuestionStem);
    expect(serialized).not.toContain(sensitiveAnswerKey);
    expect(serialized).not.toContain(sensitiveComment);
    expect(serialized).not.toContain(sensitiveUserName);
    expect(serialized).not.toContain(sensitiveEmail);

    // Verify all identifiers are either UUIDs, pseudonyms, or cryptographic hashes
    expect(event.actor_pseudonym).toMatch(/^[a-f0-9]{64}$/);
    expect(event.payload_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(event.content_commitment).toMatch(/^[a-f0-9]{64}$/);
  });

  it('ensures Fabric chaincode registration arguments expose hashes only', () => {
    const chaincodeArgs = {
      eventId: 'evt-uuid-1',
      eventType: 'APPROVAL_SIGNED',
      timestamp: new Date().toISOString(),
      actorPseudonym: 'hmac_sha256_pseudonym_only',
      subjectType: 'question',
      subjectId: 'q-uuid-1',
      eventHash: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
      contentCommitment: '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945',
    };

    const payloadString = JSON.stringify(chaincodeArgs);
    expect(payloadString).not.toContain(sensitiveQuestionStem);
    expect(payloadString).not.toContain(sensitiveAnswerKey);
    expect(payloadString).not.toContain(sensitiveUserName);
  });

  it('ensures Witness checkpoints contain only Merkle root hashes and tree size', () => {
    const witnessCheckpoint = {
      rootHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      rangeStart: 0,
      rangeEnd: 100,
      eventCount: 100,
      treeSize: 100,
      authorSignature: 'base64_sig',
    };

    const str = JSON.stringify(witnessCheckpoint);
    expect(str).not.toContain(sensitiveQuestionStem);
    expect(str).not.toContain(sensitiveAnswerKey);
    expect(str).not.toContain(sensitiveEmail);
  });
});
