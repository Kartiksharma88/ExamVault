"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KEY_PROVIDER = exports.KeyProvider = void 0;
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
class KeyProvider {
}
exports.KeyProvider = KeyProvider;
exports.KEY_PROVIDER = 'KEY_PROVIDER';
//# sourceMappingURL=key-provider.interface.js.map