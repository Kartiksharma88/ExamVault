import {
  canonicalizeJson,
  sha256Hex,
  hashCanonicalObject,
  computeActorPseudonym,
  createCanonicalEvent,
  validateCanonicalEvent,
  computeCanonicalEventHash,
  RFC8785_TEST_VECTORS,
  CANONICAL_EVENT_TEST_VECTOR,
  EventClassifier,
} from '../index';

describe('RFC 8785 JSON Canonicalization Scheme (JCS)', () => {
  it('correctly canonicalizes and hashes all RFC 8785 test vectors', () => {
    for (const vector of RFC8785_TEST_VECTORS) {
      const canonical = canonicalizeJson(vector.input);
      expect(canonical).toBe(vector.expectedCanonical);

      const hash = sha256Hex(Buffer.from(canonical, 'utf-8'));
      expect(hash).toBe(vector.expectedSha256);
    }
  });

  it('handles negative zero -0 as 0', () => {
    expect(canonicalizeJson({ a: -0, b: 0 })).toBe('{"a":0,"b":0}');
  });

  it('omits undefined, function, and symbol values in objects', () => {
    const input = {
      keep: 'yes',
      omitUndefined: undefined,
      omitFn: () => {},
      omitSymbol: Symbol('test'),
    };
    expect(canonicalizeJson(input)).toBe('{"keep":"yes"}');
  });

  it('replaces undefined with null in arrays', () => {
    const input = [1, undefined, 2];
    expect(canonicalizeJson(input)).toBe('[1,null,2]');
  });

  it('rejects non-finite numbers', () => {
    expect(() => canonicalizeJson({ val: NaN })).toThrow(TypeError);
    expect(() => canonicalizeJson({ val: Infinity })).toThrow(TypeError);
    expect(() => canonicalizeJson({ val: -Infinity })).toThrow(TypeError);
  });
});

describe('CanonicalAuditEvent and Test Vectors', () => {
  it('matches the canonical event test vector exactly byte-for-byte and hash-for-hash', () => {
    const canonical = canonicalizeJson(CANONICAL_EVENT_TEST_VECTOR.event);
    expect(canonical).toBe(CANONICAL_EVENT_TEST_VECTOR.expectedCanonical);

    const hash = computeCanonicalEventHash(CANONICAL_EVENT_TEST_VECTOR.event);
    expect(hash).toBe(CANONICAL_EVENT_TEST_VECTOR.expectedSha256);
  });

  it('constructs a valid canonical event and enforces schema rules', () => {
    const event = createCanonicalEvent({
      eventId: '11111111-2222-4333-8444-555555555555',
      eventType: 'QUESTION_VERSION_COMMITTED',
      actorId: 'user-uuid-1234',
      pseudonymSecretKey: 'test-secret-key-for-pseudonym',
      subjectType: 'QUESTION_VERSION',
      subjectId: 'question-uuid-5678',
      versionNo: 2,
      payload: { stem: 'Synthetic Question', options: ['A', 'B'] },
      metadata: { ip: '127.0.0.1' },
      contentCommitment: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    });

    const validation = validateCanonicalEvent(event);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
    expect(event.actor_pseudonym).toHaveLength(64);
    expect(event.payload_hash).toHaveLength(64);
    expect(event.metadata_hash).toHaveLength(64);
  });

  it('rejects invalid canonical events with detailed error descriptions', () => {
    const invalidEvent = {
      schema_version: '0.9.0', // invalid schema version
      event_id: 'not-a-uuid',
      event_type: '',
      timestamp: 'invalid-date',
      actor_pseudonym: 'too-short',
      subject_type: '',
      subject_id: '',
      version_no: -5,
      payload_hash: 'not-hex',
      content_commitment: 'bad',
      approval_signature: null,
      prev_event_hash: 'bad',
      metadata_hash: 'bad',
    };

    const validation = validateCanonicalEvent(invalidEvent);
    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(5);
  });

  it('actor pseudonymization is deterministic with the same key and one-way', () => {
    const key = 'secret-hmac-key';
    const user1 = '44444444-4444-4444-4444-444444444444';
    const user2 = '55555555-5555-5555-5555-555555555555';

    const p1a = computeActorPseudonym(user1, key);
    const p1b = computeActorPseudonym(user1, key);
    const p2 = computeActorPseudonym(user2, key);

    expect(p1a).toBe(p1b);
    expect(p1a).not.toBe(p2);
    expect(p1a).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('EventClassifier', () => {
  it('correctly classifies standard CRITICAL and BULK events', () => {
    const classifier = new EventClassifier();
    expect(classifier.classify('QUESTION_VERSION_COMMITTED')).toBe('CRITICAL');
    expect(classifier.classify('APPROVAL_SIGNED')).toBe('CRITICAL');
    expect(classifier.classify('POLICY_APPROVED')).toBe('CRITICAL');
    expect(classifier.classify('USER_ROLE_CHANGED')).toBe('CRITICAL');
    expect(classifier.classify('PAPER_GENERATED')).toBe('CRITICAL');

    expect(classifier.classify('CONTENT_READ')).toBe('BULK');
    expect(classifier.classify('USER_LOGIN')).toBe('BULK');
    expect(classifier.classify('STORAGE_SCAN_COMPLETED')).toBe('BULK');
  });

  it('allows dynamic reconfiguration of event classes', () => {
    const classifier = new EventClassifier();
    expect(classifier.classify('CONTENT_READ')).toBe('BULK');

    classifier.setEventClass('CONTENT_READ', 'CRITICAL');
    expect(classifier.classify('CONTENT_READ')).toBe('CRITICAL');
  });
});

describe('RFC 6962 MerkleTree and Inclusion Proofs', () => {
  it('builds a Merkle tree and generates valid inclusion proofs for all leaves', () => {
    const { MerkleTree } = require('../merkle');
    const leaves = ['leaf-0', 'leaf-1', 'leaf-2', 'leaf-3', 'leaf-4', 'leaf-5', 'leaf-6'];
    const tree = new MerkleTree(leaves);
    const root = tree.getRoot();

    expect(root).toMatch(/^[0-9a-f]{64}$/);
    expect(tree.getTreeSize()).toBe(7);

    for (let i = 0; i < leaves.length; i++) {
      const proof = tree.getProof(i);
      expect(proof.leafIndex).toBe(i);
      expect(proof.treeSize).toBe(7);

      const isValid = MerkleTree.verifyInclusionProof(proof, root);
      expect(isValid).toBe(true);

      // Verify tampered proof fails
      const tamperedProof = {
        ...proof,
        leafHash: '0000000000000000000000000000000000000000000000000000000000000000',
      };
      expect(MerkleTree.verifyInclusionProof(tamperedProof, root)).toBe(false);
    }
  });
});

