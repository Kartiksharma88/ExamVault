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
export declare function splitKeyShamir(key: Buffer, numShares: number, threshold: number): SplitResult;
/**
 * Reconstructs the 256-bit symmetric key from k shares.
 * Verifies that the key length is exactly 32 bytes.
 */
export declare function reconstructKeyShamir(shares: string[], threshold: number): Buffer;
/**
 * Verifies that a submitted share matches its recorded commitment.
 */
export declare function verifyShareCommitment(share: string, salt: string, expectedCommitment: string): boolean;
/**
 * Generates an X25519 keypair for custodian enrollment.
 */
export declare function generateCustodianKeyPair(): Promise<{
    publicKeyHex: string;
    privateKeyHex: string;
    fingerprint: string;
}>;
/**
 * Seals a share to a custodian using anonymous sealed box (X25519 + ChaCha20-Poly1305).
 * Only the custodian holding the corresponding private key can unseal it.
 */
export declare function sealShareToCustodian(share: string, custodianPublicKeyHex: string): Promise<string>;
/**
 * Unseals a share using the custodian's private key.
 */
export declare function unsealShareFromCustodian(sealedCiphertextHex: string, custodianPublicKeyHex: string, custodianPrivateKeyHex: string): Promise<string>;
//# sourceMappingURL=crypto.vault.d.ts.map