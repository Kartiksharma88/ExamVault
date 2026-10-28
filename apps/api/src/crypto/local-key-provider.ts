import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { KeyProvider } from './key-provider.interface';

/**
 * LocalKeyProvider — Development-only key provider
 * 
 * Reads a 256-bit master key from the MASTER_KEY environment variable (hex encoded).
 * Uses AES-256-GCM to wrap/unwrap data encryption keys.
 * Uses Ed25519 for audit log signing.
 * 
 * ⚠️ WARNING: This provider stores the master key in process memory.
 * In production, use VaultKeyProvider or KmsKeyProvider instead.
 */
@Injectable()
export class LocalKeyProvider implements KeyProvider {
  private readonly masterKey: Buffer;
  private readonly keyId: string;
  private readonly signingKey: crypto.KeyObject;
  private readonly verifyKey: crypto.KeyObject;

  constructor(private configService: ConfigService) {
    // Load master key
    const masterKeyHex = this.configService.getOrThrow<string>('MASTER_KEY');
    if (!/^[0-9a-f]{64}$/i.test(masterKeyHex)) {
      throw new Error('MASTER_KEY must be a 64-character hex string (256 bits)');
    }
    this.masterKey = Buffer.from(masterKeyHex, 'hex');
    this.keyId = this.configService.get<string>('MASTER_KEY_ID') || 'local-dev-key-001';

    // Load or generate Ed25519 signing keys
    const privateKeyB64 = this.configService.get<string>('AUDIT_SIGNING_PRIVATE_KEY');
    if (privateKeyB64 && privateKeyB64 !== 'replace-with-base64-ed25519-private-key') {
      const privateKeyDer = Buffer.from(privateKeyB64, 'base64');
      this.signingKey = crypto.createPrivateKey({
        key: privateKeyDer,
        format: 'der',
        type: 'pkcs8',
      });
      this.verifyKey = crypto.createPublicKey(this.signingKey);
    } else {
      // Generate ephemeral keys for development
      const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
      this.signingKey = privateKey;
      this.verifyKey = publicKey;
      console.warn(
        '[LocalKeyProvider] Generated ephemeral Ed25519 keys. Set AUDIT_SIGNING_PRIVATE_KEY in production.',
      );
    }
  }

  getKeyId(): string {
    return this.keyId;
  }

  async wrapKey(dataKey: Buffer): Promise<Buffer> {
    const nonce = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.masterKey, nonce);
    const encrypted = Buffer.concat([cipher.update(dataKey), cipher.final()]);
    const tag = cipher.getAuthTag();
    // Format: [12 bytes nonce][16 bytes tag][encrypted data]
    return Buffer.concat([nonce, tag, encrypted]);
  }

  async unwrapKey(wrappedKey: Buffer, keyId: string): Promise<Buffer> {
    if (keyId !== this.keyId) {
      throw new Error(`Unknown key ID: ${keyId}. Key rotation may be required.`);
    }
    const nonce = wrappedKey.subarray(0, 12);
    const tag = wrappedKey.subarray(12, 28);
    const encrypted = wrappedKey.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.masterKey, nonce);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  }

  async sign(data: Buffer): Promise<Buffer> {
    return Buffer.from(crypto.sign(null, data, this.signingKey));
  }

  async verify(data: Buffer, signature: Buffer): Promise<boolean> {
    return crypto.verify(null, data, this.verifyKey, signature);
  }

  getPseudonymKey(): Buffer {
    // Derive a dedicated 256-bit pseudonymization key from master key using HMAC-SHA-256
    return crypto.createHmac('sha256', this.masterKey).update('examvault-pseudonym-salt-v1').digest();
  }
}
