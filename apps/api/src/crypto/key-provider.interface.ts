/**
 * KeyProvider Interface
 * 
 * Abstraction for key management. Implementations:
 * - LocalKeyProvider: reads master key from environment variable (dev only)
 * 
 * TODO: Future implementations for production:
 * - VaultKeyProvider: HashiCorp Vault Transit secrets engine
 * - KmsKeyProvider: AWS KMS / GCP Cloud KMS / Azure Key Vault
 * - HsmKeyProvider: Hardware Security Module (PKCS#11)
 * 
 * The interface supports:
 * - Wrapping/unwrapping data encryption keys (envelope encryption)
 * - Ed25519 signing for audit log entries
 * - Key rotation via key_id tracking
 */
export abstract class KeyProvider {
  /** Unique identifier for the current master key */
  abstract getKeyId(): string;

  /** Wrap (encrypt) a data key using the master key */
  abstract wrapKey(dataKey: Buffer): Promise<Buffer>;

  /** Unwrap (decrypt) a data key using the master key */
  abstract unwrapKey(wrappedKey: Buffer, keyId: string): Promise<Buffer>;

  /** Sign data with Ed25519 for audit log integrity */
  abstract sign(data: Buffer): Promise<Buffer>;

  /** Verify an Ed25519 signature */
  abstract verify(data: Buffer, signature: Buffer): Promise<boolean>;

  /** Secret key for actor pseudonymization (HMAC-SHA-256) */
  abstract getPseudonymKey(): Buffer;

  /** Secret key for unreleased question reservation handles (HMAC-SHA-256) */
  abstract getReservationKey(): Buffer;
}

export const KEY_PROVIDER = 'KEY_PROVIDER';
