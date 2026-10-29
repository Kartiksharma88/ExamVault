"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const crypto = __importStar(require("crypto"));
const crypto_vault_1 = require("../crypto.vault");
describe('Shamir Secret Sharing & Custodian Sealed Box (Section 11 & Acceptance Criteria)', () => {
    const secretKey = crypto.randomBytes(32);
    const n = 5;
    const k = 3;
    it('splits 256-bit key into n shares with threshold k, each with a valid commitment', () => {
        const splitResult = (0, crypto_vault_1.splitKeyShamir)(secretKey, n, k);
        expect(splitResult.shares.length).toBe(n);
        expect(splitResult.shareCommitments.length).toBe(n);
        // Each share must validate against its commitment
        for (let i = 0; i < n; i++) {
            const isValid = (0, crypto_vault_1.verifyShareCommitment)(splitResult.shares[i], splitResult.salts[i], splitResult.shareCommitments[i]);
            expect(isValid).toBe(true);
        }
    });
    it('reconstructs the exact 256-bit key from any k distinct shares (all k-subsets)', () => {
        const splitResult = (0, crypto_vault_1.splitKeyShamir)(secretKey, n, k);
        const shares = splitResult.shares;
        // Test combinations of 3 shares out of 5: (0,1,2), (0,2,4), (1,3,4), etc.
        const subsets = [
            [shares[0], shares[1], shares[2]],
            [shares[0], shares[2], shares[4]],
            [shares[1], shares[3], shares[4]],
            [shares[2], shares[3], shares[4]],
        ];
        for (const subset of subsets) {
            const recovered = (0, crypto_vault_1.reconstructKeyShamir)(subset, k);
            expect(recovered.equals(secretKey)).toBe(true);
        }
    });
    it('fails reconstruction when given fewer than k shares (e.g. k-1 shares)', () => {
        const splitResult = (0, crypto_vault_1.splitKeyShamir)(secretKey, n, k);
        const shares = splitResult.shares;
        // 2 shares when k=3
        const twoShares = [shares[0], shares[1]];
        expect(() => (0, crypto_vault_1.reconstructKeyShamir)(twoShares, k)).toThrow();
    });
    it('rejects tampered shares during commitment verification', () => {
        const splitResult = (0, crypto_vault_1.splitKeyShamir)(secretKey, n, k);
        const tamperedShare = splitResult.shares[0].slice(0, -2) + 'ff';
        const isValid = (0, crypto_vault_1.verifyShareCommitment)(tamperedShare, splitResult.salts[0], splitResult.shareCommitments[0]);
        expect(isValid).toBe(false);
    });
    it('seals and unseals share using custodian X25519 public/private keypair', async () => {
        const custodianKeys = await (0, crypto_vault_1.generateCustodianKeyPair)();
        const splitResult = (0, crypto_vault_1.splitKeyShamir)(secretKey, n, k);
        const shareToSeal = splitResult.shares[0];
        // Server seals share using custodian's enrolled public key
        const sealedCiphertext = await (0, crypto_vault_1.sealShareToCustodian)(shareToSeal, custodianKeys.publicKeyHex);
        // Custodian unseals share in browser using private key
        const unsealedShare = await (0, crypto_vault_1.unsealShareFromCustodian)(sealedCiphertext, custodianKeys.publicKeyHex, custodianKeys.privateKeyHex);
        expect(unsealedShare).toBe(shareToSeal);
    });
});
//# sourceMappingURL=shamir.spec.js.map