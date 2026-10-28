import * as crypto from 'crypto';
import { canonicalizeJson } from './canonicalize.js';

/**
 * Computes SHA-256 digest of input UTF-8 string or buffer, returning a lowercase hex string.
 */
export function sha256Hex(data: string | Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Canonicalizes an object using RFC 8785 and computes its SHA-256 hex digest.
 */
export function hashCanonicalObject(data: unknown): string {
  const canonical = canonicalizeJson(data);
  return sha256Hex(Buffer.from(canonical, 'utf-8'));
}

/**
 * Computes deterministic HMAC-SHA-256 pseudonym for an actor UUID using a secret key.
 * This guarantees actors can be grouped and audited without storing direct user IDs on-chain.
 */
export function computeActorPseudonym(userId: string | null | undefined, secretKey: Buffer | string): string | null {
  if (!userId) {
    return null;
  }
  const keyBuffer = typeof secretKey === 'string' ? Buffer.from(secretKey, 'utf-8') : secretKey;
  return crypto.createHmac('sha256', keyBuffer).update(userId).digest('hex');
}
