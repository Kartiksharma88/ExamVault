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
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
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
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CryptoService = void 0;
const common_1 = require("@nestjs/common");
const crypto = __importStar(require("crypto"));
const key_provider_interface_1 = require("./key-provider.interface");
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
let CryptoService = class CryptoService {
    keyProvider;
    constructor(keyProvider) {
        this.keyProvider = keyProvider;
    }
    /**
     * Encrypt data using envelope encryption with AES-256-GCM
     * @param plaintext - The data to encrypt (JSON-serializable content)
     * @param associatedData - Additional authenticated data (question_id + version_no)
     */
    async encrypt(plaintext, associatedData) {
        // Generate random data encryption key
        const dataKey = crypto.randomBytes(32); // 256-bit DEK
        const nonce = crypto.randomBytes(12); // 96-bit nonce for GCM
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
    async decrypt(envelope, associatedData) {
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
        }
        finally {
            // Securely zero the data key
            dataKey.fill(0);
        }
    }
    /**
     * Compute content commitment: SHA-256(salt + canonical JSON)
     * The salt is random and should be stored inside the encrypted payload
     */
    computeCommitment(canonicalJson) {
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
    verifyCommitment(canonicalJson, salt, expectedCommitment) {
        const hash = crypto.createHash('sha256');
        hash.update(salt);
        hash.update(canonicalJson);
        return hash.digest('hex') === expectedCommitment;
    }
    /**
     * Compute hash for audit chain: SHA-256(prevHash + canonical event)
     */
    computeAuditHash(prevHash, canonicalEvent) {
        const hash = crypto.createHash('sha256');
        hash.update(prevHash);
        hash.update(canonicalEvent);
        return hash.digest('hex');
    }
    /**
     * Sign data for audit log entries
     */
    async sign(data) {
        return this.keyProvider.sign(data);
    }
    /**
     * Verify audit log signature
     */
    async verify(data, signature) {
        return this.keyProvider.verify(data, signature);
    }
    /**
     * Generate an Ed25519 signing keypair for a user and wrap the private key with the master key
     */
    async generateUserSigningKey() {
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
};
exports.CryptoService = CryptoService;
exports.CryptoService = CryptoService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(key_provider_interface_1.KEY_PROVIDER)),
    __metadata("design:paramtypes", [key_provider_interface_1.KeyProvider])
], CryptoService);
//# sourceMappingURL=crypto.service.js.map