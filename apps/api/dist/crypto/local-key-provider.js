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
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalKeyProvider = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const crypto = __importStar(require("crypto"));
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
let LocalKeyProvider = class LocalKeyProvider {
    configService;
    masterKey;
    keyId;
    signingKey;
    verifyKey;
    constructor(configService) {
        this.configService = configService;
        // Load master key
        const masterKeyHex = this.configService.get('MASTER_KEY') ||
            '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
        if (!/^[0-9a-f]{64}$/i.test(masterKeyHex)) {
            // Never throw during construction — a missing/invalid MASTER_KEY must not
            // crash the whole API on boot. Fall back to the default dev key so the app
            // stays up (encryption will use a deterministic dev key instead).
            console.warn('[LocalKeyProvider] MASTER_KEY is missing or invalid; falling back to default dev key.');
            this.masterKey = Buffer.from('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex');
        }
        else {
            this.masterKey = Buffer.from(masterKeyHex, 'hex');
        }
        this.keyId = this.configService.get('MASTER_KEY_ID') || 'local-dev-key-001';
        // Load or generate Ed25519 signing keys
        const privateKeyB64 = this.configService.get('AUDIT_SIGNING_PRIVATE_KEY');
        let loadedSigningKey = null;
        if (privateKeyB64 && privateKeyB64 !== 'replace-with-base64-ed25519-private-key') {
            try {
                const privateKeyDer = Buffer.from(privateKeyB64, 'base64');
                loadedSigningKey = crypto.createPrivateKey({
                    key: privateKeyDer,
                    format: 'der',
                    type: 'pkcs8',
                });
                this.verifyKey = crypto.createPublicKey(loadedSigningKey);
                this.signingKey = loadedSigningKey;
            }
            catch (err) {
                console.warn('[LocalKeyProvider] Failed to load AUDIT_SIGNING_PRIVATE_KEY, using ephemeral:', err.message);
            }
        }
        if (!loadedSigningKey) {
            // Generate ephemeral keys for development or fallback
            const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
            this.signingKey = privateKey;
            this.verifyKey = publicKey;
            console.warn('[LocalKeyProvider] Generated ephemeral Ed25519 keys.');
        }
    }
    getKeyId() {
        return this.keyId;
    }
    async wrapKey(dataKey) {
        const nonce = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', this.masterKey, nonce);
        const encrypted = Buffer.concat([cipher.update(dataKey), cipher.final()]);
        const tag = cipher.getAuthTag();
        // Format: [12 bytes nonce][16 bytes tag][encrypted data]
        return Buffer.concat([nonce, tag, encrypted]);
    }
    async unwrapKey(wrappedKey, keyId) {
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
    async sign(data) {
        return Buffer.from(crypto.sign(null, data, this.signingKey));
    }
    async verify(data, signature) {
        return crypto.verify(null, data, this.verifyKey, signature);
    }
    getPseudonymKey() {
        // Derive a dedicated 256-bit pseudonymization key from master key using HMAC-SHA-256
        return crypto.createHmac('sha256', this.masterKey).update('examvault-pseudonym-salt-v1').digest();
    }
    getReservationKey() {
        // Derive a dedicated 256-bit key for reservation handles from master key using HMAC-SHA-256
        return crypto.createHmac('sha256', this.masterKey).update('examvault-reservation-salt-v1').digest();
    }
};
exports.LocalKeyProvider = LocalKeyProvider;
exports.LocalKeyProvider = LocalKeyProvider = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], LocalKeyProvider);
//# sourceMappingURL=local-key-provider.js.map