import { Injectable, Inject } from '@nestjs/common';
import * as crypto from 'crypto';
import { KeyProvider, KEY_PROVIDER } from './key-provider.interface';

export interface EncryptedEnvelope {
  ciphertext: Buffer;
  nonce: Buffer;
  tag: Buffer;
  wrappedKey: Buffer;
  keyId: string;
}

export interface ContentCommitment {
  commitment: string; // hex-encoded SHA-256
  salt: string;       // hex-encoded random salt (stored inside encrypted payload)
}

/**
 * CryptoService — Envelope encryption for question content and answer keys.
 * 
 * Each piece of data gets:
 * 1. A random 256-bit data encryption key (DEK)
 * 2. The DEK encrypts the data with AES-256-GCM
 * 3. The DEK is wrapped (encrypted) by the master key via KeyProvider
 * 4. Associated data (question_id + version_no) is bound to the GCM authentication
 * 
 * Content commitment: SHA-256(salt + canonical JSON) proves content hasn't changed
 * without revealing the content.
 */
@Injectable()
export class CryptoService {
  constructor(
    @Inject(KEY_PROVIDER) private readonly keyProvider: KeyProvider,
  ) {}

  /**
   * Encrypt data using envelope encryption with AES-256-GCM
   * @param plaintext - The data to encrypt (JSON-serializable content)
   * @param associatedData - Additional authenticated data (question_id + version_no)
   */
  async encrypt(
    plaintext: string,
    associatedData: string,
  ): Promise<EncryptedEnvelope> {
    // Generate random data encryption key
    const dataKey = crypto.randomBytes(32); // 256-bit DEK
    const nonce = crypto.randomBytes(12);   // 96-bit nonce for GCM

    // Encrypt with AES-256-GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', dataKey, nonce);
    cipher.setAAD(Buffer.from(associatedData, 'utf-8'));
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf-8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    // Wrap the data key with the master key
    const wrappedKey = await this.keyProvider.wrapKey(dataKey);

    // Securely zero the plaintext data key from memory
    dataKey.fill(0);

    return {
      ciphertext: encrypted,
      nonce,
      tag,
      wrappedKey,
      keyId: this.keyProvider.getKeyId(),
    };
  }

  /**
   * Decrypt data using envelope encryption
   * @param envelope - The encrypted envelope
   * @param associatedData - Must match what was used during encryption
   */
  async decrypt(
    envelope: EncryptedEnvelope,
    associatedData: string,
  ): Promise<string> {
    // Unwrap the data key
    const dataKey = await this.keyProvider.unwrapKey(envelope.wrappedKey, envelope.keyId);

    try {
      // Decrypt with AES-256-GCM
      const decipher = crypto.createDecipheriv('aes-256-gcm', dataKey, envelope.nonce);
      decipher.setAuthTag(envelope.tag);
      decipher.setAAD(Buffer.from(associatedData, 'utf-8'));
      const decrypted = Buffer.concat([
        decipher.update(envelope.ciphertext),
        decipher.final(),
      ]);

      return decrypted.toString('utf-8');
    } finally {
      // Securely zero the data key
      dataKey.fill(0);
    }
  }

  /**
   * Compute content commitment: SHA-256(salt + canonical JSON)
   * The salt is random and should be stored inside the encrypted payload
   */
  computeCommitment(canonicalJson: string): ContentCommitment {
    const salt = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256');
    hash.update(salt);
    hash.update(canonicalJson);
    return {
      commitment: hash.digest('hex'),
      salt,
    };
  }

  /**
   * Verify a content commitment
   */
  verifyCommitment(
    canonicalJson: string,
    salt: string,
    expectedCommitment: string,
  ): boolean {
    const hash = crypto.createHash('sha256');
    hash.update(salt);
    hash.update(canonicalJson);
    return hash.digest('hex') === expectedCommitment;
  }

  /**
   * Compute hash for audit chain: SHA-256(prevHash + canonical event)
   */
  computeAuditHash(prevHash: string, canonicalEvent: string): string {
    const hash = crypto.createHash('sha256');
    hash.update(prevHash);
    hash.update(canonicalEvent);
    return hash.digest('hex');
  }

  /**
   * Sign data for audit log entries
   */
  async sign(data: Buffer): Promise<Buffer> {
    return this.keyProvider.sign(data);
  }

  /**
   * Verify audit log signature
   */
  async verify(data: Buffer, signature: Buffer): Promise<boolean> {
    return this.keyProvider.verify(data, signature);
  }

  /**
   * Generate an Ed25519 signing keypair for a user and wrap the private key with the master key
   */
  async generateUserSigningKey(): Promise<{
    publicKey: string;
    wrappedPrivateKey: Buffer;
    keyId: string;
  }> {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
    const privateKeyDer = privateKey.export({ format: 'der', type: 'pkcs8' });
    const publicKeyDer = publicKey.export({ format: 'der', type: 'spki' });

    const wrappedPrivateKey = await this.keyProvider.wrapKey(privateKeyDer);
    return {
      publicKey: publicKeyDer.toString('base64'),
      wrappedPrivateKey,
      keyId: this.keyProvider.getKeyId(),
    };
  }
}

