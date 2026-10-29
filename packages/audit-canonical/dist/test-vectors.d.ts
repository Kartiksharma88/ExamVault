import { CanonicalAuditEvent } from './event-model.js';
export interface CanonicalTestVector {
    description: string;
    input: unknown;
    expectedCanonical: string;
    expectedSha256: string;
}
export declare const RFC8785_TEST_VECTORS: CanonicalTestVector[];
export declare const CANONICAL_EVENT_TEST_VECTOR: {
    event: CanonicalAuditEvent;
    expectedCanonical: string;
    expectedSha256: string;
};
//# sourceMappingURL=test-vectors.d.ts.map