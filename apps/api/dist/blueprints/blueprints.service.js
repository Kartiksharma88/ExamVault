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
exports.BlueprintsService = void 0;
const common_1 = require("@nestjs/common");
const crypto = __importStar(require("crypto"));
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const auth_service_1 = require("../auth/auth.service");
const server_signing_provider_1 = require("../crypto/server-signing-provider");
const shared_1 = require("@examvault/shared");
const audit_canonical_1 = require("@examvault/audit-canonical");
let BlueprintsService = class BlueprintsService {
    prisma;
    audit;
    auth;
    signingProvider;
    constructor(prisma, audit, auth, signingProvider) {
        this.prisma = prisma;
        this.audit = audit;
        this.auth = auth;
        this.signingProvider = signingProvider;
    }
    /**
     * Propose a new blueprint or a new version of an existing blueprint.
     */
    async proposeBlueprint(input) {
        // 1. Validate structure with Zod schema
        const parseResult = shared_1.BlueprintSchema.safeParse(input.content);
        if (!parseResult.success) {
            throw new common_1.BadRequestException(`Invalid blueprint schema: ${parseResult.error.issues.map((i) => i.message).join('; ')}`);
        }
        const blueprintData = parseResult.data;
        // 2. Validate consistency (counts, marks, bin bounds)
        const consistencyErrors = (0, shared_1.validateBlueprintConsistency)(blueprintData);
        if (consistencyErrors.length > 0) {
            throw new common_1.BadRequestException(`Blueprint consistency error: ${consistencyErrors.join('; ')}`);
        }
        // 3. Verify exam, subjects, and topics exist in database
        const exam = await this.prisma.exam.findUnique({
            where: { id: input.examId },
            include: { subjects: { include: { topics: true } } },
        });
        if (!exam) {
            throw new common_1.NotFoundException(`Exam ${input.examId} not found`);
        }
        const validSubjectIds = new Set(exam.subjects.map((s) => s.id));
        const validTopicIds = new Set(exam.subjects.flatMap((s) => s.topics.map((t) => t.id)));
        for (const sec of blueprintData.sections) {
            if (!validSubjectIds.has(sec.subjectId)) {
                throw new common_1.BadRequestException(`Section ${sec.code} references nonexistent subject ${sec.subjectId}`);
            }
            for (const tq of sec.topicQuotas) {
                if (!validTopicIds.has(tq.topicId)) {
                    throw new common_1.BadRequestException(`Section ${sec.code} references nonexistent topic ${tq.topicId}`);
                }
            }
        }
        // 4. Compute canonical RFC 8785 version hash
        const canonicalContentStr = (0, audit_canonical_1.canonicalizeJson)(blueprintData);
        const versionHash = crypto.createHash('sha256').update(canonicalContentStr).digest('hex');
        let blueprintId = input.blueprintId;
        let versionNo = 1;
        if (!blueprintId) {
            const blueprint = await this.prisma.examBlueprint.create({
                data: {
                    examId: input.examId,
                    name: input.name,
                    description: input.description,
                    createdById: input.proposerId,
                },
            });
            blueprintId = blueprint.id;
        }
        else {
            const lastVersion = await this.prisma.blueprintVersion.findFirst({
                where: { blueprintId },
                orderBy: { versionNo: 'desc' },
            });
            if (lastVersion) {
                versionNo = lastVersion.versionNo + 1;
            }
        }
        const version = await this.prisma.blueprintVersion.create({
            data: {
                blueprintId,
                versionNo,
                content: blueprintData,
                versionHash,
                isApproved: false,
                proposerId: input.proposerId,
            },
        });
        await this.audit.log({
            actorId: input.proposerId,
            action: 'BLUEPRINT_PROPOSED',
            targetType: 'BLUEPRINT_VERSION',
            targetId: version.id,
            metadata: {
                payloadHash: versionHash,
                blueprintId,
                versionNo,
                name: input.name,
                examId: input.examId,
            },
        });
        return {
            success: true,
            blueprintId,
            versionId: version.id,
            versionNo,
            versionHash,
            status: 'PROPOSED',
        };
    }
    /**
     * Approve a blueprint version (Dual-admin: approverId must differ from proposerId).
     */
    async approveBlueprint(input) {
        const version = await this.prisma.blueprintVersion.findUnique({
            where: {
                blueprintId_versionNo: {
                    blueprintId: input.blueprintId,
                    versionNo: input.versionNo,
                },
            },
            include: { proposer: true, blueprint: true },
        });
        if (!version) {
            throw new common_1.NotFoundException(`Blueprint version not found`);
        }
        if (version.isApproved) {
            throw new common_1.ConflictException(`Blueprint version ${input.versionNo} is already approved and immutable`);
        }
        if (version.proposerId === input.approverId) {
            throw new common_1.ForbiddenException(`Dual-control violation: Proposer (${version.proposer.email}) cannot approve their own blueprint. A different administrator must approve.`);
        }
        // Step-up MFA verification
        const isMfaValid = await this.auth.verifyStepUpTotp(input.approverId, input.mfaCode);
        if (!isMfaValid) {
            throw new common_1.ForbiddenException('Invalid or expired MFA code for approval');
        }
        // Sign canonical version hash
        const approverKey = await this.prisma.userSigningKey.findUnique({
            where: { userId: input.approverId },
        });
        if (!approverKey) {
            throw new common_1.BadRequestException('Approver does not have an enrolled signing key');
        }
        const approvalSignature = await this.signingProvider.signApproval({
            approvalId: crypto.randomUUID(),
            questionId: input.blueprintId,
            versionNo: input.versionNo,
            contentCommitment: version.versionHash,
            decision: 'APPROVE',
            role: 'ADMIN',
            approverId: input.approverId,
            reviewRound: 1,
            policyVersion: 1,
            timestamp: new Date(),
        }, approverKey.wrappedPrivateKey, approverKey.keyId);
        const approvedAt = new Date();
        await this.prisma.blueprintVersion.update({
            where: { id: version.id },
            data: {
                isApproved: true,
                approverId: input.approverId,
                approvalSignature,
                approvedAt,
            },
        });
        await this.audit.log({
            actorId: input.approverId,
            action: 'BLUEPRINT_APPROVED',
            targetType: 'BLUEPRINT_VERSION',
            targetId: version.id,
            metadata: {
                payloadHash: version.versionHash,
                approvalSignature,
                blueprintId: input.blueprintId,
                versionNo: input.versionNo,
                proposerId: version.proposerId,
                approverId: input.approverId,
            },
        });
        return {
            success: true,
            blueprintId: input.blueprintId,
            versionId: version.id,
            versionNo: input.versionNo,
            status: 'APPROVED',
            versionHash: version.versionHash,
            approvedAt,
        };
    }
    async getBlueprintVersions(blueprintId) {
        const versions = await this.prisma.blueprintVersion.findMany({
            where: { blueprintId },
            include: { proposer: { select: { id: true, name: true, email: true } }, approver: { select: { id: true, name: true, email: true } } },
            orderBy: { versionNo: 'desc' },
        });
        return versions;
    }
    async getBlueprintVersion(blueprintId, versionNo) {
        const version = await this.prisma.blueprintVersion.findUnique({
            where: {
                blueprintId_versionNo: {
                    blueprintId,
                    versionNo,
                },
            },
            include: { proposer: true, approver: true, blueprint: true },
        });
        if (!version) {
            throw new common_1.NotFoundException(`Blueprint version not found`);
        }
        return version;
    }
    async listBlueprints(examId) {
        const where = {};
        if (examId)
            where.examId = examId;
        return this.prisma.examBlueprint.findMany({
            where,
            include: {
                versions: {
                    orderBy: { versionNo: 'desc' },
                    take: 1,
                },
                exam: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }
};
exports.BlueprintsService = BlueprintsService;
exports.BlueprintsService = BlueprintsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        auth_service_1.AuthService,
        server_signing_provider_1.ServerSigningProvider])
], BlueprintsService);
//# sourceMappingURL=blueprints.service.js.map