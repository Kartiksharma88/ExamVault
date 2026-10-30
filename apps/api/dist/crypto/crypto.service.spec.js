"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const crypto_service_1 = require("./crypto.service");
const local_key_provider_1 = require("./local-key-provider");
const key_provider_interface_1 = require("./key-provider.interface");
describe('CryptoService', () => {
    let service;
    let keyProvider;
    beforeAll(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                crypto_service_1.CryptoService,
                {
                    provide: key_provider_interface_1.KEY_PROVIDER,
                    useFactory: () => {
                        const configService = {
                            getOrThrow: (key) => {
                                if (key === 'MASTER_KEY')
                                    return '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
                                throw new Error(`Unknown key: ${key}`);
                            },
                            get: (key) => {
                                if (key === 'MASTER_KEY_ID')
                                    return 'test-key-001';
                                return undefined;
                            },
                        };
                        return new local_key_provider_1.LocalKeyProvider(configService);
                    },
                },
            ],
        }).compile();
        service = module.get(crypto_service_1.CryptoService);
    });
    describe('Encrypt/Decrypt round trip', () => {
        it('should encrypt and decrypt content correctly', async () => {
            const plaintext = JSON.stringify({
                type: 'MCQ_SINGLE',
                stem: 'What is $2 + 2$?',
                options: [
                    { label: 'A', text: '3' },
                    { label: 'B', text: '4' },
                    { label: 'C', text: '5' },
                ],
            });
            const associatedData = 'question-uuid:1';
            const envelope = await service.encrypt(plaintext, associatedData);
            const decrypted = await service.decrypt(envelope, associatedData);
            expect(decrypted).toBe(plaintext);
            expect(JSON.parse(decrypted).stem).toBe('What is $2 + 2$?');
        });
        it('should encrypt and decrypt Unicode/Devanagari content', async () => {
            const plaintext = JSON.stringify({
                stem: 'एक वस्तु का द्रव्यमान 2 kg है। बल ज्ञात कीजिए।',
                language: 'HI',
            });
            const associatedData = 'question-hindi:1';
            const envelope = await service.encrypt(plaintext, associatedData);
            const decrypted = await service.decrypt(envelope, associatedData);
            expect(decrypted).toBe(plaintext);
            expect(JSON.parse(decrypted).stem).toContain('द्रव्यमान');
        });
        it('should produce different ciphertext for the same plaintext', async () => {
            const plaintext = 'test content';
            const ad = 'q:1';
            const e1 = await service.encrypt(plaintext, ad);
            const e2 = await service.encrypt(plaintext, ad);
            // Different random keys and nonces should produce different ciphertext
            expect(e1.ciphertext.equals(e2.ciphertext)).toBe(false);
            expect(e1.nonce.equals(e2.nonce)).toBe(false);
        });
    });
    describe('Tampered ciphertext detection', () => {
        it('should reject tampered ciphertext', async () => {
            const plaintext = 'sensitive exam content';
            const ad = 'q:1';
            const envelope = await service.encrypt(plaintext, ad);
            // Tamper with ciphertext
            const tampered = {
                ...envelope,
                ciphertext: Buffer.concat([envelope.ciphertext, Buffer.from([0x00])]),
            };
            await expect(service.decrypt(tampered, ad)).rejects.toThrow();
        });
        it('should reject tampered auth tag', async () => {
            const plaintext = 'sensitive exam content';
            const ad = 'q:1';
            const envelope = await service.encrypt(plaintext, ad);
            // Tamper with tag
            const tamperedTag = Buffer.from(envelope.tag);
            tamperedTag[0] ^= 0xff;
            const tampered = { ...envelope, tag: tamperedTag };
            await expect(service.decrypt(tampered, ad)).rejects.toThrow();
        });
        it('should reject tampered nonce', async () => {
            const plaintext = 'sensitive exam content';
            const ad = 'q:1';
            const envelope = await service.encrypt(plaintext, ad);
            // Tamper with nonce
            const tamperedNonce = Buffer.from(envelope.nonce);
            tamperedNonce[0] ^= 0xff;
            const tampered = { ...envelope, nonce: tamperedNonce };
            await expect(service.decrypt(tampered, ad)).rejects.toThrow();
        });
    });
    describe('Wrong associated data rejection', () => {
        it('should reject decryption with wrong associated data', async () => {
            const plaintext = 'exam question content';
            const correctAd = 'question-123:1';
            const wrongAd = 'question-456:2';
            const envelope = await service.encrypt(plaintext, correctAd);
            await expect(service.decrypt(envelope, wrongAd)).rejects.toThrow();
        });
        it('should reject decryption with empty associated data when original had data', async () => {
            const plaintext = 'exam content';
            const ad = 'q:1';
            const envelope = await service.encrypt(plaintext, ad);
            await expect(service.decrypt(envelope, '')).rejects.toThrow();
        });
    });
    describe('Content commitment', () => {
        it('should compute and verify commitment', () => {
            const json = '{"stem":"What is 2+2?","type":"MCQ_SINGLE"}';
            const { commitment, salt } = service.computeCommitment(json);
            expect(commitment).toHaveLength(64); // SHA-256 hex
            expect(salt).toHaveLength(64); // 32 bytes hex
            const valid = service.verifyCommitment(json, salt, commitment);
            expect(valid).toBe(true);
        });
        it('should reject modified content', () => {
            const json = '{"stem":"What is 2+2?"}';
            const { commitment, salt } = service.computeCommitment(json);
            const modified = '{"stem":"What is 2+3?"}';
            const valid = service.verifyCommitment(modified, salt, commitment);
            expect(valid).toBe(false);
        });
        it('should reject wrong salt', () => {
            const json = '{"stem":"test"}';
            const { commitment } = service.computeCommitment(json);
            const valid = service.verifyCommitment(json, 'wrong-salt', commitment);
            expect(valid).toBe(false);
        });
    });
    describe('Audit hash chain', () => {
        it('should compute deterministic hashes', () => {
            const prevHash = '0'.repeat(64);
            const event = '{"action":"LOGIN"}';
            const h1 = service.computeAuditHash(prevHash, event);
            const h2 = service.computeAuditHash(prevHash, event);
            expect(h1).toBe(h2);
            expect(h1).toHaveLength(64);
        });
        it('should produce different hashes for different prev_hash', () => {
            const event = '{"action":"LOGIN"}';
            const h1 = service.computeAuditHash('a'.repeat(64), event);
            const h2 = service.computeAuditHash('b'.repeat(64), event);
            expect(h1).not.toBe(h2);
        });
    });
    describe('Ed25519 signing', () => {
        it('should sign and verify', async () => {
            const data = Buffer.from('test data to sign');
            const signature = await service.sign(data);
            const valid = await service.verify(data, signature);
            expect(valid).toBe(true);
        });
        it('should reject tampered data', async () => {
            const data = Buffer.from('original');
            const signature = await service.sign(data);
            const tampered = Buffer.from('tampered');
            const valid = await service.verify(tampered, signature);
            expect(valid).toBe(false);
        });
    });
});
//# sourceMappingURL=crypto.service.spec.js.map