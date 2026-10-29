import * as crypto from 'crypto';
import {
  splitKeyShamir,
  reconstructKeyShamir,
  verifyShareCommitment,
  sealShareToCustodian,
  unsealShareFromCustodian,
  generateCustodianKeyPair,
} from '../crypto.vault';

describe('Shamir Secret Sharing & Custodian Sealed Box (Section 11 & Acceptance Criteria)', () => {
  const secretKey = crypto.randomBytes(32);
  const n = 5;
  const k = 3;

  it('splits 256-bit key into n shares with threshold k, each with a valid commitment', () => {
    const splitResult = splitKeyShamir(secretKey, n, k);
    expect(splitResult.shares.length).toBe(n);
    expect(splitResult.shareCommitments.length).toBe(n);

    // Each share must validate against its commitment
    for (let i = 0; i < n; i++) {
      const isValid = verifyShareCommitment(
        splitResult.shares[i],
        splitResult.salts[i],
        splitResult.shareCommitments[i],
      );
      expect(isValid).toBe(true);
    }
  });

  it('reconstructs the exact 256-bit key from any k distinct shares (all k-subsets)', () => {
    const splitResult = splitKeyShamir(secretKey, n, k);
    const shares = splitResult.shares;

    // Test combinations of 3 shares out of 5: (0,1,2), (0,2,4), (1,3,4), etc.
    const subsets = [
      [shares[0], shares[1], shares[2]],
      [shares[0], shares[2], shares[4]],
      [shares[1], shares[3], shares[4]],
      [shares[2], shares[3], shares[4]],
    ];

    for (const subset of subsets) {
      const recovered = reconstructKeyShamir(subset, k);
      expect(recovered.equals(secretKey)).toBe(true);
    }
  });

  it('fails reconstruction when given fewer than k shares (e.g. k-1 shares)', () => {
    const splitResult = splitKeyShamir(secretKey, n, k);
    const shares = splitResult.shares;

    // 2 shares when k=3
    const twoShares = [shares[0], shares[1]];
    expect(() => reconstructKeyShamir(twoShares, k)).toThrow();
  });

  it('rejects tampered shares during commitment verification', () => {
    const splitResult = splitKeyShamir(secretKey, n, k);
    const tamperedShare = splitResult.shares[0].slice(0, -2) + 'ff';

    const isValid = verifyShareCommitment(
      tamperedShare,
      splitResult.salts[0],
      splitResult.shareCommitments[0],
    );
    expect(isValid).toBe(false);
  });

  it('seals and unseals share using custodian X25519 public/private keypair', async () => {
    const custodianKeys = await generateCustodianKeyPair();
    const splitResult = splitKeyShamir(secretKey, n, k);
    const shareToSeal = splitResult.shares[0];

    // Server seals share using custodian's enrolled public key
    const sealedCiphertext = await sealShareToCustodian(
      shareToSeal,
      custodianKeys.publicKeyHex,
    );

    // Custodian unseals share in browser using private key
    const unsealedShare = await unsealShareFromCustodian(
      sealedCiphertext,
      custodianKeys.publicKeyHex,
      custodianKeys.privateKeyHex,
    );

    expect(unsealedShare).toBe(shareToSeal);
  });
});

