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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.splitKeyShamir = splitKeyShamir;
exports.reconstructKeyShamir = reconstructKeyShamir;
exports.verifyShareCommitment = verifyShareCommitment;
exports.generateCustodianKeyPair = generateCustodianKeyPair;
exports.sealShareToCustodian = sealShareToCustodian;
exports.unsealShareFromCustodian = unsealShareFromCustodian;
const crypto = __importStar(require("crypto"));
const libsodium_wrappers_1 = __importDefault(require("libsodium-wrappers"));
const secrets = require('secrets.js-grempe');
/**
 * Splits a 256-bit symmetric key into n Shamir shares with threshold k.
 * Uses battle-tested secrets.js-grempe library over GF(2^8).
 * Each share is paired with a cryptographically random salt to produce
 * a commitment: SHA-256(share || salt).
 */
function splitKeyShamir(key, numShares, threshold) {
    if (key.length !== 32) {
        throw new Error('Key must be exactly 32 bytes (256 bits)');
    }
    if (threshold < 2 || threshold > numShares) {
        throw new Error(`Invalid threshold ${threshold} for ${numShares} shares`);
    }
    const keyHex = key.toString('hex');
    const rawShares = secrets.share(keyHex, numShares, threshold);
    const salts = [];
    const shareCommitments = [];
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
function reconstructKeyShamir(shares, threshold) {
    if (shares.length < threshold) {
        throw new Error(`Cannot reconstruct key: got ${shares.length} shares, required threshold is ${threshold}`);
    }
    try {
        const recoveredHex = secrets.combine(shares.slice(0, threshold));
        if (!recoveredHex || recoveredHex.length !== 64) {
            throw new Error('Failed to reconstruct valid 256-bit key from shares');
        }
        return Buffer.from(recoveredHex, 'hex');
    }
    catch (err) {
        throw new Error(`Shamir key reconstruction failed: ${err.message}`);
    }
}
/**
 * Verifies that a submitted share matches its recorded commitment.
 */
function verifyShareCommitment(share, salt, expectedCommitment) {
    const computed = crypto
        .createHash('sha256')
        .update(share + salt)
        .digest('hex');
    return computed === expectedCommitment;
}
/**
 * Generates an X25519 keypair for custodian enrollment.
 */
async function generateCustodianKeyPair() {
    await libsodium_wrappers_1.default.ready;
    const sodium = libsodium_wrappers_1.default;
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
async function sealShareToCustodian(share, custodianPublicKeyHex) {
    await libsodium_wrappers_1.default.ready;
    const sodium = libsodium_wrappers_1.default;
    const pubKey = sodium.from_hex(custodianPublicKeyHex);
    const ciphertext = sodium.crypto_box_seal(share, pubKey);
    return sodium.to_hex(ciphertext);
}
/**
 * Unseals a share using the custodian's private key.
 */
async function unsealShareFromCustodian(sealedCiphertextHex, custodianPublicKeyHex, custodianPrivateKeyHex) {
    await libsodium_wrappers_1.default.ready;
    const sodium = libsodium_wrappers_1.default;
    const ciphertext = sodium.from_hex(sealedCiphertextHex);
    const pubKey = sodium.from_hex(custodianPublicKeyHex);
    const privKey = sodium.from_hex(custodianPrivateKeyHex);
    const decrypted = sodium.crypto_box_seal_open(ciphertext, pubKey, privKey, 'text');
    return decrypted;
}
//# sourceMappingURL=crypto.vault.js.map