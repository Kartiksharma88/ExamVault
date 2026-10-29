import * as crypto from 'crypto';
import _sodium from 'libsodium-wrappers';
const secrets = require('secrets.js-grempe');

export interface SplitResult {
  shares: string[];
  salts: string[];
  shareCommitments: string[];
}

/**
 * Splits a 256-bit symmetric key into n Shamir shares with threshold k.
 * Uses battle-tested secrets.js-grempe library over GF(2^8).
 * Each share is paired with a cryptographically random salt to produce
 * a commitment: SHA-256(share || salt).
 */
export function splitKeyShamir(
  key: Buffer,
  numShares: number,
  threshold: number,
): SplitResult {
  if (key.length !== 32) {
    throw new Error('Key must be exactly 32 bytes (256 bits)');
  }
  if (threshold < 2 || threshold > numShares) {
    throw new Error(`Invalid threshold ${threshold} for ${numShares} shares`);
  }

  const keyHex = key.toString('hex');
  const rawShares: string[] = secrets.share(keyHex, numShares, threshold);

  const salts: string[] = [];
  const shareCommitments: string[] = [];

  for (let i = 0; i < rawShares.length; i++) {
    const salt = crypto.randomBytes(16).toString('hex');
    const commitment = crypto
      .createHash('sha256')
      .update(rawShares[i] + salt)
      .digest('hex');

    salts.push(salt);
    shareCommitments.push(commitment);
  }

  return {
    shares: rawShares,
    salts,
    shareCommitments,
  };
}

/**
 * Reconstructs the 256-bit symmetric key from k shares.
 * Verifies that the key length is exactly 32 bytes.
 */
export function reconstructKeyShamir(shares: string[], threshold: number): Buffer {
  if (shares.length < threshold) {
    throw new Error(
      `Cannot reconstruct key: got ${shares.length} shares, required threshold is ${threshold}`,
    );
  }

  try {
    const recoveredHex = secrets.combine(shares.slice(0, threshold));
    if (!recoveredHex || recoveredHex.length !== 64) {
      throw new Error('Failed to reconstruct valid 256-bit key from shares');
    }
    return Buffer.from(recoveredHex, 'hex');
  } catch (err: any) {
    throw new Error(`Shamir key reconstruction failed: ${err.message}`);
  }
}

/**
 * Verifies that a submitted share matches its recorded commitment.
 */
export function verifyShareCommitment(
  share: string,
  salt: string,
  expectedCommitment: string,
): boolean {
  const computed = crypto
    .createHash('sha256')
    .update(share + salt)
    .digest('hex');
  return computed === expectedCommitment;
}

/**
 * Generates an X25519 keypair for custodian enrollment.
 */
export async function generateCustodianKeyPair(): Promise<{
  publicKeyHex: string;
  privateKeyHex: string;
  fingerprint: string;
}> {
  await _sodium.ready;
  const sodium = _sodium;
  const keyPair = sodium.crypto_box_keypair();
  const publicKeyHex = sodium.to_hex(keyPair.publicKey);
  const privateKeyHex = sodium.to_hex(keyPair.privateKey);
  const fingerprint = crypto
    .createHash('sha256')
    .update(Buffer.from(keyPair.publicKey))
    .digest('hex')
    .substring(0, 16);

  return {
    publicKeyHex,
    privateKeyHex,
    fingerprint,
  };
}

/**
 * Seals a share to a custodian using anonymous sealed box (X25519 + ChaCha20-Poly1305).
 * Only the custodian holding the corresponding private key can unseal it.
 */
export async function sealShareToCustodian(
  share: string,
  custodianPublicKeyHex: string,
): Promise<string> {
  await _sodium.ready;
  const sodium = _sodium;
  const pubKey = sodium.from_hex(custodianPublicKeyHex);
  const ciphertext = sodium.crypto_box_seal(share, pubKey);
  return sodium.to_hex(ciphertext);
}

/**
 * Unseals a share using the custodian's private key.
 */
export async function unsealShareFromCustodian(
  sealedCiphertextHex: string,
  custodianPublicKeyHex: string,
  custodianPrivateKeyHex: string,
): Promise<string> {
  await _sodium.ready;
  const sodium = _sodium;
  const ciphertext = sodium.from_hex(sealedCiphertextHex);
  const pubKey = sodium.from_hex(custodianPublicKeyHex);
  const privKey = sodium.from_hex(custodianPrivateKeyHex);
  const decrypted = sodium.crypto_box_seal_open(ciphertext, pubKey, privKey, 'text');
  return decrypted;
}

