"use strict";
/**
 * RFC 8785: JSON Canonicalization Scheme (JCS)
 * Standardized serialization to ensure deterministic byte-for-byte representation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.canonicalizeJson = canonicalizeJson;
function canonicalizeJson(input) {
    if (input === null) {
        return 'null';
    }
    if (typeof input === 'boolean') {
        return input ? 'true' : 'false';
    }
    if (typeof input === 'number') {
        if (!Number.isFinite(input)) {
            throw new TypeError('RFC 8785 does not permit NaN or Infinity');
        }
        // Handle -0 -> 0 per RFC 8785
        if (Object.is(input, -0)) {
            return '0';
        }
        return JSON.stringify(input);
    }
    if (typeof input === 'string') {
        return JSON.stringify(input);
    }
    if (typeof input === 'bigint') {
        throw new TypeError('BigInt is not supported in standard JSON/RFC 8785');
    }
    if (Array.isArray(input)) {
        const elements = [];
        for (let i = 0; i < input.length; i++) {
            const val = input[i];
            if (val === undefined || typeof val === 'symbol' || typeof val === 'function') {
                elements.push('null');
            }
            else {
                elements.push(canonicalizeJson(val));
            }
        }
        return `[${elements.join(',')}]`;
    }
    if (typeof input === 'object') {
        // If object has a toJSON method (like Date), call it first
        if ('toJSON' in input && typeof input.toJSON === 'function') {
            return canonicalizeJson(input.toJSON());
        }
        const keys = Object.keys(input).sort();
        const members = [];
        for (const key of keys) {
            const val = input[key];
            // Skip undefined, functions, and symbols in objects (standard JSON.stringify behavior)
            if (val === undefined || typeof val === 'function' || typeof val === 'symbol') {
                continue;
            }
            const canonicalKey = JSON.stringify(key);
            const canonicalValue = canonicalizeJson(val);
            members.push(`${canonicalKey}:${canonicalValue}`);
        }
        return `{${members.join(',')}}`;
    }
    // Undefined or unsupported primitives at top-level
    return '';
}
//# sourceMappingURL=canonicalize.js.map