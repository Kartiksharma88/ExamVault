/**
 * Computes SHA-256 digest of input UTF-8 string or buffer, returning a lowercase hex string.
 */
export declare function sha256Hex(data: string | Buffer): string;
/**
 * Canonicalizes an object using RFC 8785 and computes its SHA-256 hex digest.
 */
export declare function hashCanonicalObject(data: unknown): string;
/**
 * Computes deterministic HMAC-SHA-256 pseudonym for an actor UUID using a secret key.
 * This guarantees actors can be grouped and audited without storing direct user IDs on-chain.
 */
export declare function computeActorPseudonym(userId: string | null | undefined, secretKey: Buffer | string): string | null;
//# sourceMappingURL=hash.d.ts.map