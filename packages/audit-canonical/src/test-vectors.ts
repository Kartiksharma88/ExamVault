import { CanonicalAuditEvent } from './event-model.js';

export interface CanonicalTestVector {
  description: string;
  input: unknown;
  expectedCanonical: string;
  expectedSha256: string;
}

export const RFC8785_TEST_VECTORS: CanonicalTestVector[] = [
  {
    description: 'Lexicographical key sorting with nested structures',
    input: {
      z: 1,
      a: 2,
      m: {
        b: 3,
        a: 4,
      },
    },
    expectedCanonical: '{"a":2,"m":{"a":4,"b":3},"z":1}',
    expectedSha256: 'e45c30b44d3d323ad520c1705dc1debea784800c25887d83cc182f4895836442',
  },
  {
    description: 'Array of mixed types with nulls and booleans',
    input: [true, false, null, 'hello', 42],
    expectedCanonical: '[true,false,null,"hello",42]',
    expectedSha256: '0d4e9c7f268faa0d05860157d8ddb85c4d18b26878869b52943aa83c8ec5793d',
  },
  {
    description: 'Whitespace and control characters inside string literals',
    input: {
      text: "line 1\nline 2\twith tab and \"quotes\"",
    },
    expectedCanonical: '{"text":"line 1\\nline 2\\twith tab and \\"quotes\\""}',
    expectedSha256: '983411253ff69fe535652309a80830ee5030ab102fb781150f2c642199b0f50e',
  },
  {
    description: 'Number zero variations: -0 must serialize as 0',
    input: { zero: -0 },
    expectedCanonical: '{"zero":0}',
    expectedSha256: '33b50e61094f0d59aabcdd47c698ea5d9d120c188b8a49f6451ebc736e28ba45',
  },
];

export const CANONICAL_EVENT_TEST_VECTOR: {
  event: CanonicalAuditEvent;
  expectedCanonical: string;
  expectedSha256: string;
} = {
  event: {
    schema_version: '1.0.0',
    event_id: 'a0000000-0000-4000-8000-000000000001',
    event_type: 'QUESTION_VERSION_COMMITTED',
    timestamp: '2026-10-28T12:00:00.000Z',
    actor_pseudonym: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    subject_type: 'QUESTION_VERSION',
    subject_id: 'b0000000-0000-4000-8000-000000000002',
    version_no: 1,
    payload_hash: '8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4',
    content_commitment: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    approval_signature: null,
    prev_event_hash: '0000000000000000000000000000000000000000000000000000000000000000',
    metadata_hash: 'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb',
  },
  expectedCanonical:
    '{"actor_pseudonym":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855","approval_signature":null,"content_commitment":"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad","event_id":"a0000000-0000-4000-8000-000000000001","event_type":"QUESTION_VERSION_COMMITTED","metadata_hash":"ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb","payload_hash":"8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4","prev_event_hash":"0000000000000000000000000000000000000000000000000000000000000000","schema_version":"1.0.0","subject_id":"b0000000-0000-4000-8000-000000000002","subject_type":"QUESTION_VERSION","timestamp":"2026-10-28T12:00:00.000Z","version_no":1}',
  expectedSha256: '2faca86dfcb8e6137e9a246faa38ac3b5e13b00568bd7cd0d2bc344af5152d5c',
};
