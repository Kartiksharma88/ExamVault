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
exports.ServerSigningProvider = void 0;
const common_1 = require("@nestjs/common");
const crypto = __importStar(require("crypto"));
const key_provider_interface_1 = require("./key-provider.interface");
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
let ServerSigningProvider = class ServerSigningProvider {
    keyProvider;
    constructor(keyProvider) {
        this.keyProvider = keyProvider;
    }
    canonicalSerialize(payload) {
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
    async signApproval(payload, wrappedPrivateKey, keyId) {
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
    async verifyApproval(payload, signatureBase64, publicKeyBase64) {
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
        }
        catch (err) {
            return false;
        }
    }
};
exports.ServerSigningProvider = ServerSigningProvider;
exports.ServerSigningProvider = ServerSigningProvider = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(key_provider_interface_1.KEY_PROVIDER)),
    __metadata("design:paramtypes", [key_provider_interface_1.KeyProvider])
], ServerSigningProvider);
//# sourceMappingURL=server-signing-provider.js.map