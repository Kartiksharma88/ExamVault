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
export interface KeyProvider {
  /** Unique identifier for the current master key */
  getKeyId(): string;

  /** Wrap (encrypt) a data key using the master key */
  wrapKey(dataKey: Buffer): Promise<Buffer>;

  /** Unwrap (decrypt) a data key using the master key */
  unwrapKey(wrappedKey: Buffer, keyId: string): Promise<Buffer>;

  /** Sign data with Ed25519 for audit log integrity */
  sign(data: Buffer): Promise<Buffer>;

  /** Verify an Ed25519 signature */
  verify(data: Buffer, signature: Buffer): Promise<boolean>;
}

export const KEY_PROVIDER = 'KEY_PROVIDER';
