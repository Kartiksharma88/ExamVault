import { Injectable, Inject } from '@nestjs/common';
import * as crypto from 'crypto';
import { KeyProvider, KEY_PROVIDER } from './key-provider.interface';
import { SigningProvider, ApprovalPayload } from './signing-provider.interface';

/**
 * ServerSigningProvider
 *
 * Implements Ed25519 digital signing of approval records on the server.
 *
 * ⚠️ TRUST ASSUMPTION & KNOWN LIMITATION:
 * In this research prototype design, the server performs the signing after TOTP
 * step-up authentication using the user's envelope-wrapped private key.
 * Therefore, a fully compromised server root process could theoretically forge signatures
 * without user physical consent.
 *
 * To eliminate server trust in production environments, replace this implementation
 * with WebAuthnSigningProvider (FIDO2 WebAuthn with PRF extension or client-side secp256r1/ed25519)
 * or a smartcard PKCS#11 hardware token.
 */
@Injectable()
export class ServerSigningProvider implements SigningProvider {
  constructor(@Inject(KEY_PROVIDER) private keyProvider: KeyProvider) {}

  canonicalSerialize(payload: ApprovalPayload): Buffer {
    // Canonical serialization format:
    // approvalId | questionId | versionNo | contentCommitment | decision | role | approverId | reviewRound | policyVersion | timestamp
    const canonicalString = [
      payload.approvalId,
      payload.questionId,
      String(payload.versionNo),
      payload.contentCommitment,
      payload.decision,
      payload.role,
      payload.approverId,
      String(payload.reviewRound),
      String(payload.policyVersion),
      payload.timestamp.toISOString(),
    ].join('|');

    return Buffer.from(canonicalString, 'utf-8');
  }

  async signApproval(
    payload: ApprovalPayload,
    wrappedPrivateKey: Buffer,
    keyId: string,
  ): Promise<string> {
    // 1. Unwrap user's Ed25519 private key using Master Key via KeyProvider
    const privateKeyDer = await this.keyProvider.unwrapKey(wrappedPrivateKey, keyId);

    const privateKey = crypto.createPrivateKey({
      key: privateKeyDer,
      format: 'der',
      type: 'pkcs8',
    });

    // 2. Canonical serialization
    const canonicalData = this.canonicalSerialize(payload);

    // 3. Ed25519 Sign
    const signature = crypto.sign(null, canonicalData, privateKey);
    return signature.toString('base64');
  }

  async verifyApproval(
    payload: ApprovalPayload,
    signatureBase64: string,
    publicKeyBase64: string,
  ): Promise<boolean> {
    try {
      const publicKeyDer = Buffer.from(publicKeyBase64, 'base64');
      const publicKey = crypto.createPublicKey({
        key: publicKeyDer,
        format: 'der',
        type: 'spki',
      });

      const canonicalData = this.canonicalSerialize(payload);
      const signature = Buffer.from(signatureBase64, 'base64');

      return crypto.verify(null, canonicalData, publicKey, signature);
    } catch (err) {
      return false;
    }
  }
}
