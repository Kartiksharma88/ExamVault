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
exports.sha256Hex = sha256Hex;
exports.hashCanonicalObject = hashCanonicalObject;
exports.computeActorPseudonym = computeActorPseudonym;
const crypto = __importStar(require("crypto"));
const canonicalize_js_1 = require("./canonicalize.js");
/**
 * Computes SHA-256 digest of input UTF-8 string or buffer, returning a lowercase hex string.
 */
function sha256Hex(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
}
/**
 * Canonicalizes an object using RFC 8785 and computes its SHA-256 hex digest.
 */
function hashCanonicalObject(data) {
    const canonical = (0, canonicalize_js_1.canonicalizeJson)(data);
    return sha256Hex(Buffer.from(canonical, 'utf-8'));
}
/**
 * Computes deterministic HMAC-SHA-256 pseudonym for an actor UUID using a secret key.
 * This guarantees actors can be grouped and audited without storing direct user IDs on-chain.
 */
function computeActorPseudonym(userId, secretKey) {
    if (!userId) {
        return null;
    }
    const keyBuffer = typeof secretKey === 'string' ? Buffer.from(secretKey, 'utf-8') : secretKey;
    return crypto.createHmac('sha256', keyBuffer).update(userId).digest('hex');
}
//# sourceMappingURL=hash.js.map