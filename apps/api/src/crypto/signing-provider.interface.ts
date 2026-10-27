export interface ApprovalPayload {
  approvalId: string;
  questionId: string;
  versionNo: number;
  contentCommitment: string;
  decision: string;
  role: string;
  approverId: string;
  reviewRound: number;
  policyVersion: number;
  timestamp: Date;
}

/**
 * SigningProvider Interface
 *
 * Abstraction for cryptographic signing of review and moderation approvals.
 * Implementations:
 * - ServerSigningProvider: Unwraps user's Ed25519 key wrapped with Master Key upon TOTP step-up.
 *
 * Extension points for future steps:
 * - WebAuthnSigningProvider: Signs approvals using client-side WebAuthn / FIDO2 hardware keys.
 * - HsmSigningProvider: Signs approvals using PKCS#11 hardware security module tokens.
 */
export interface SigningProvider {
  /**
   * Produce canonical deterministic serialization of approval fields
   */
  canonicalSerialize(payload: ApprovalPayload): Buffer;

  /**
   * Sign approval payload with user's private key
   */
  signApproval(
    payload: ApprovalPayload,
    wrappedPrivateKey: Buffer,
    keyId: string,
  ): Promise<string>;

  /**
   * Verify an approval signature against the canonical payload and user public key
   */
  verifyApproval(
    payload: ApprovalPayload,
    signatureBase64: string,
    publicKeyBase64: string,
  ): Promise<boolean>;
}

export const SIGNING_PROVIDER = 'SIGNING_PROVIDER';
