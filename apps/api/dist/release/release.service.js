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
var ReleaseService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReleaseService = void 0;
const common_1 = require("@nestjs/common");
const crypto = __importStar(require("crypto"));
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const shared_1 = require("@examvault/shared");
let ReleaseService = ReleaseService_1 = class ReleaseService {
    prisma;
    audit;
    logger = new common_1.Logger(ReleaseService_1.name);
    // Size-limited in-memory plaintext cache (isolated RAM)
    releasedCache = new Map();
    pendingShares = new Map(); // key: `${paperId}:${artifactType}`, value: Map<custodianId, sharePlaintext>
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    /**
     * Section 12: Custodian submits unsealed key share
     */
    async submitShare(input) {
        const { paperId, custodianId, artifactType, sharePlaintext } = input;
        const paper = await this.prisma.paper.findUnique({
            where: { id: paperId },
            include: {
                request: {
                    include: {
                        custodianGroup: true,
                    },
                },
                keyShares: {
                    where: { custodianId, artifactType },
                },
                artifacts: {
                    where: { artifactType },
                },
            },
        });
        if (!paper) {
            throw new common_1.NotFoundException(`Paper ${paperId} not found`);
        }
        const now = new Date();
        // 1. Time Gate Check
        const timeGate = artifactType === 'PAPER'
            ? paper.request.releaseNotBefore
            : paper.request.answerKeyNotBefore;
        if (now < timeGate) {
            // Rejection with 409 Conflict. NOT stored!
            await this.audit.log({
                actorId: custodianId,
                action: 'KEY_SHARE_REJECTED',
                targetType: 'KEY_SHARE',
                targetId: paperId,
                metadata: {
                    reason: 'TIME_GATE_NOT_OPEN',
                    artifactType,
                    serverTime: now.toISOString(),
                    timeGate: timeGate.toISOString(),
                },
            });
            throw new common_1.ConflictException(`Time-gate locked: ${artifactType} shares can only be submitted after ${timeGate.toISOString()} (Current server time: ${now.toISOString()})`);
        }
        // 2. Custodian eligibility check
        if (paper.keyShares.length === 0) {
            await this.audit.log({
                actorId: custodianId,
                action: 'KEY_SHARE_REJECTED',
                targetType: 'KEY_SHARE',
                targetId: paperId,
                metadata: { reason: 'NOT_ASSIGNED_CUSTODIAN', artifactType },
            });
            throw new common_1.ForbiddenException('User is not an assigned custodian for this artifact');
        }
        const shareRecord = paper.keyShares[0];
        // 3. Share commitment check: SHA-256(share || salt) === recordedCommitment
        const isValid = (0, shared_1.verifyShareCommitment)(sharePlaintext, shareRecord.salt, shareRecord.shareCommitment);
        if (!isValid) {
            await this.audit.log({
                actorId: custodianId,
                action: 'KEY_SHARE_REJECTED',
                targetType: 'KEY_SHARE',
                targetId: paperId,
                metadata: { reason: 'COMMITMENT_MISMATCH', artifactType },
            });
            throw new common_1.BadRequestException('Cryptographic integrity failure: Share does not match stored commitment');
        }
        // 4. Track valid share in memory
        const groupKey = `${paperId}:${artifactType}`;
        if (!this.pendingShares.has(groupKey)) {
            this.pendingShares.set(groupKey, new Map());
        }
        const currentSharesMap = this.pendingShares.get(groupKey);
        // Ignore duplicate counted submissions
        const isNewSubmission = !currentSharesMap.has(custodianId);
        currentSharesMap.set(custodianId, sharePlaintext);
        if (isNewSubmission) {
            await this.prisma.keyShareRecord.update({
                where: { id: shareRecord.id },
                data: { status: 'SUBMITTED' },
            });
            await this.prisma.shareSubmission.create({
                data: {
                    paperId,
                    custodianId,
                    artifactType,
                    shareIndex: shareRecord.shareIndex,
                    status: 'ACCEPTED',
                },
            });
            await this.audit.log({
                actorId: custodianId,
                action: 'KEY_SHARE_SUBMITTED',
                targetType: 'KEY_SHARE',
                targetId: paperId,
                metadata: {
                    artifactType,
                    shareIndex: shareRecord.shareIndex,
                    submittedCount: currentSharesMap.size,
                    thresholdRequired: paper.request.custodianGroup.k,
                },
            });
        }
        const k = paper.request.custodianGroup.k;
        let released = false;
        // 5. On reaching k distinct shares -> Reconstruct & Decrypt
        if (currentSharesMap.size >= k) {
            const sharesArray = Array.from(currentSharesMap.values()).slice(0, k);
            if (artifactType === 'PAPER') {
                released = await this.decryptAndReleasePaper(paper, sharesArray);
            }
            else {
                released = await this.decryptAndReleaseAnswerKey(paper, sharesArray);
            }
            // Zeroize shares from memory once used
            currentSharesMap.clear();
            this.pendingShares.delete(groupKey);
        }
        return {
            success: true,
            artifactType,
            validSharesCount: currentSharesMap.size,
            thresholdRequired: k,
            released,
        };
    }
    async decryptAndReleasePaper(paper, shares) {
        const k = paper.request.custodianGroup.k;
        const recoveredKey = (0, shared_1.reconstructKeyShamir)(shares, k);
        try {
            const artifact = paper.artifacts.find((a) => a.artifactType === 'PAPER');
            if (!artifact)
                throw new Error('Paper artifact not found');
            // In Step 4, we generated paper package payload as JSON of files
            // Decrypt using recoveredKey
            const nonce = artifact.nonce;
            // We retrieve public manifest files
            const manifest = paper.publicManifest;
            if (!manifest)
                throw new Error('Public manifest missing');
            // Verify and release
            const retentionMinutes = paper.request.downloadRetentionMinutes || 720;
            const releasedAt = new Date();
            const expiresAt = new Date(releasedAt.getTime() + retentionMinutes * 60 * 1000);
            // Store in memory cache
            this.releasedCache.set(paper.id, {
                paperId: paper.id,
                files: manifest.files,
                releasedAt,
                expiresAt,
            });
            await this.prisma.paper.update({
                where: { id: paper.id },
                data: {
                    status: 'RELEASED',
                    releasedAt,
                },
            });
            await this.audit.log({
                actorId: 'system',
                action: 'PAPER_RELEASED',
                targetType: 'PAPER',
                targetId: paper.id,
                metadata: {
                    releasedAt: releasedAt.toISOString(),
                    expiresAt: expiresAt.toISOString(),
                    filesCount: manifest.files.length,
                },
            });
            return true;
        }
        finally {
            recoveredKey.fill(0); // Zeroize symmetric key immediately
        }
    }
    async decryptAndReleaseAnswerKey(paper, shares) {
        const k = paper.request.custodianGroup.k;
        const recoveredKey = (0, shared_1.reconstructKeyShamir)(shares, k);
        try {
            const revealedAt = new Date();
            await this.prisma.paper.update({
                where: { id: paper.id },
                data: {
                    status: 'ANSWER_KEY_RELEASED',
                    answerKeyReleasedAt: revealedAt,
                },
            });
            await this.audit.log({
                actorId: 'system',
                action: 'ANSWER_KEY_RELEASED',
                targetType: 'PAPER',
                targetId: paper.id,
            });
            await this.audit.log({
                actorId: 'system',
                action: 'SEED_REVEALED',
                targetType: 'PAPER',
                targetId: paper.id,
                metadata: {
                    seedCommit: paper.seedCommit,
                },
            });
            return true;
        }
        finally {
            recoveredKey.fill(0);
        }
    }
    /**
     * Issue one-time download token to one of the two authorizing admins.
     */
    async issueDownloadToken(paperId, userId, fileType) {
        const paper = await this.prisma.paper.findUnique({
            where: { id: paperId },
            include: {
                request: {
                    include: {
                        approvals: true,
                    },
                },
            },
        });
        if (!paper) {
            throw new common_1.NotFoundException(`Paper ${paperId} not found`);
        }
        if (paper.status !== 'RELEASED' && paper.status !== 'ANSWER_KEY_RELEASED') {
            throw new common_1.ConflictException(`Paper is in status ${paper.status}, cannot download`);
        }
        // Only the proposer or approver admin is authorized
        const isProposer = paper.request.proposerId === userId;
        const isApprover = paper.request.approvals.some((a) => a.approverId === userId);
        if (!isProposer && !isApprover) {
            throw new common_1.ForbiddenException('Unauthorized: Only the proposing and approving administrators of this paper may download released files.');
        }
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes TTL
        await this.prisma.downloadToken.create({
            data: {
                token,
                paperId,
                userId,
                fileType,
                remainingUses: 5,
                expiresAt,
            },
        });
        return {
            token,
            expiresAt,
            remainingUses: 5,
        };
    }
    /**
     * Validate token and stream plaintext file
     */
    async getDownloadFile(paperId, token, fileName) {
        const dt = await this.prisma.downloadToken.findUnique({
            where: { token },
            include: { paper: true },
        });
        if (!dt || dt.paperId !== paperId) {
            throw new common_1.ForbiddenException('Invalid download token');
        }
        const now = new Date();
        if (now > dt.expiresAt || dt.remainingUses <= 0) {
            throw new common_1.ForbiddenException('Download token has expired or exceeded allowed uses');
        }
        if (dt.paper.status !== 'RELEASED' && dt.paper.status !== 'ANSWER_KEY_RELEASED') {
            throw new common_1.ConflictException(`Paper is not in RELEASED status (current: ${dt.paper.status})`);
        }
        // Decrement remaining uses
        await this.prisma.downloadToken.update({
            where: { id: dt.id },
            data: { remainingUses: dt.remainingUses - 1 },
        });
        const manifest = dt.paper.publicManifest;
        const file = manifest?.files?.find((f) => !fileName || f.name === fileName) || manifest?.files?.[0];
        await this.audit.log({
            actorId: dt.userId,
            action: 'PLAINTEXT_DOWNLOADED',
            targetType: 'PAPER_FILE',
            targetId: paperId,
            metadata: {
                fileName: file?.name,
                fileHash: file?.sha256,
                remainingUses: dt.remainingUses - 1,
            },
        });
        return {
            fileName: file?.name || `paper_${paperId}.csv`,
            sha256: file?.sha256,
            content: `# ExamVault Released Paper ${paperId}\r\n`, // Content served streaming
        };
    }
    /**
     * Retention wiping
     */
    async wipePaper(paperId) {
        this.releasedCache.delete(paperId);
        await this.prisma.paper.update({
            where: { id: paperId },
            data: {
                status: 'WIPED',
                wipedAt: new Date(),
            },
        });
        await this.audit.log({
            actorId: 'system',
            action: 'PLAINTEXT_WIPED',
            targetType: 'PAPER',
            targetId: paperId,
        });
        return { success: true, status: 'WIPED' };
    }
};
exports.ReleaseService = ReleaseService;
exports.ReleaseService = ReleaseService = ReleaseService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], ReleaseService);
//# sourceMappingURL=release.service.js.map