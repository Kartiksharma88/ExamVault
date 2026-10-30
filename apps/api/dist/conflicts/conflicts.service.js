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
exports.ConflictsService = void 0;
const common_1 = require("@nestjs/common");
const crypto = __importStar(require("crypto"));
const prisma_service_1 = require("../prisma/prisma.service");
const crypto_service_1 = require("../crypto/crypto.service");
const audit_service_1 = require("../audit/audit.service");
let ConflictsService = class ConflictsService {
    prisma;
    crypto;
    audit;
    constructor(prisma, crypto, audit) {
        this.prisma = prisma;
        this.crypto = crypto;
        this.audit = audit;
    }
    async listUserConflicts(userId) {
        const list = await this.prisma.conflictDeclaration.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
        const decrypted = [];
        for (const item of list) {
            try {
                const text = await this.crypto.decrypt({
                    ciphertext: item.encryptedDescription,
                    nonce: item.descriptionNonce,
                    tag: item.descriptionTag,
                    wrappedKey: item.wrappedKey,
                    keyId: item.keyId,
                }, `conflict:${item.id}`);
                decrypted.push({
                    id: item.id,
                    conflictType: item.conflictType,
                    description: text,
                    createdAt: item.createdAt,
                });
            }
            catch {
                decrypted.push({
                    id: item.id,
                    conflictType: item.conflictType,
                    description: '[Encrypted Entry]',
                    createdAt: item.createdAt,
                });
            }
        }
        return decrypted;
    }
    async declareConflict(input, userId) {
        const id = crypto.randomUUID();
        const normalized = input.description.trim().toLowerCase().replace(/\s+/g, ' ');
        const conflictHash = crypto.createHash('sha256').update(normalized).digest('hex');
        const enc = await this.crypto.encrypt(input.description, `conflict:${id}`);
        const created = await this.prisma.conflictDeclaration.create({
            data: {
                id,
                userId,
                conflictType: input.conflictType,
                encryptedDescription: enc.ciphertext,
                descriptionNonce: enc.nonce,
                descriptionTag: enc.tag,
                wrappedKey: enc.wrappedKey,
                keyId: enc.keyId,
                conflictHash,
            },
        });
        await this.audit.log({
            actorId: userId,
            action: 'CONFLICT_UPDATE',
            targetType: 'conflict_declaration',
            targetId: id,
            metadata: { conflictType: input.conflictType, conflictHash },
        });
        return { id: created.id, conflictType: created.conflictType, success: true };
    }
    async deleteConflict(id, userId) {
        const item = await this.prisma.conflictDeclaration.findUnique({
            where: { id },
        });
        if (!item || item.userId !== userId) {
            throw new common_1.NotFoundException('Conflict declaration not found');
        }
        await this.prisma.conflictDeclaration.delete({ where: { id } });
        await this.audit.log({
            actorId: userId,
            action: 'CONFLICT_UPDATE',
            targetType: 'conflict_declaration',
            targetId: id,
            metadata: { action: 'deleted' },
        });
        return { success: true };
    }
};
exports.ConflictsService = ConflictsService;
exports.ConflictsService = ConflictsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        crypto_service_1.CryptoService,
        audit_service_1.AuditService])
], ConflictsService);
//# sourceMappingURL=conflicts.service.js.map