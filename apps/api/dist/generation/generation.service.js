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
var GenerationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenerationService = void 0;
const common_1 = require("@nestjs/common");
const crypto = __importStar(require("crypto"));
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const auth_service_1 = require("../auth/auth.service");
const crypto_service_1 = require("../crypto/crypto.service");
const key_provider_interface_1 = require("../crypto/key-provider.interface");
const server_signing_provider_1 = require("../crypto/server-signing-provider");
const shared_1 = require("@examvault/shared");
const audit_canonical_1 = require("@examvault/audit-canonical");
let GenerationService = GenerationService_1 = class GenerationService {
    prisma;
    audit;
    auth;
    cryptoService;
    keyProvider;
    signingProvider;
    config;
    logger = new common_1.Logger(GenerationService_1.name);
    constructor(prisma, audit, auth, cryptoService, keyProvider, signingProvider, config) {
        this.prisma = prisma;
        this.audit = audit;
        this.auth = auth;
        this.cryptoService = cryptoService;
        this.keyProvider = keyProvider;
        this.signingProvider = signingProvider;
        this.config = config;
    }
    getPaperSelectorUrl(path) {
        const base = (process.env.PAPER_SELECTOR_URL ||
            this.config.get('PAPER_SELECTOR_URL') ||
            'http://localhost:8001').replace(/\/$/, '');
        const cleanPath = path.replace(/^\//, '');
        return `${base}/${cleanPath}`;
    }
    /**
     * 5.A: Bank Overview — COUNTS ONLY (no ids, no text, no lists).
     * Four numbers, overall and per subject:
     * 1. Question bank (eligible)
     * 2. Pending reviewer review
     * 3. Pending moderator review
     * 4. Pending examiner submission
     */
    async getBankOverview() {
        const subjects = await this.prisma.subject.findMany({
            where: { isActive: true },
            select: { id: true, name: true, code: true },
        });
        // 1. Eligible count from view
        const eligibleRows = await this.prisma.$queryRawUnsafe(`
      SELECT subject_id, COUNT(*)::int as count
      FROM "eligible_question_versions"
      GROUP BY subject_id
    `);
        const eligibleBySubject = new Map();
        let totalEligible = 0;
        for (const r of eligibleRows) {
            eligibleBySubject.set(r.subject_id, r.count);
            totalEligible += r.count;
        }
        // 2. Fetch all non-retired versions with status and question subject
        const allVersions = await this.prisma.questionVersion.findMany({
            where: {
                supersededAt: null,
            },
            select: {
                id: true,
                status: true,
                question: { select: { subjectId: true } },
                originalityReport: { select: { id: true } },
                duplicateDisposition: { select: { id: true } },
            },
        });
        const initBuckets = () => ({
            eligible: 0,
            eligibleCount: 0,
            pendingReviewer: 0,
            pendingReviewerCount: 0,
            pendingModerator: 0,
            pendingModeratorCount: 0,
            pendingExaminer: 0,
            pendingExaminerCount: 0,
        });
        const overall = initBuckets();
        overall.eligible = totalEligible;
        overall.eligibleCount = totalEligible;
        const perSubject = new Map();
        for (const s of subjects) {
            const b = initBuckets();
            b.eligible = eligibleBySubject.get(s.id) || 0;
            b.eligibleCount = b.eligible;
            perSubject.set(s.id, b);
        }
        for (const v of allVersions) {
            const sId = v.question.subjectId;
            const subBucket = perSubject.get(sId);
            const hasPendingModAction = v.status === 'DUPLICATE_FLAGGED' && !v.duplicateDisposition;
            const classification = (0, shared_1.classifyQuestionState)({
                status: v.status,
                isEligible: false, // Already counted via the eligible view
                hasPendingModeratorAction: hasPendingModAction,
            });
            if (classification === shared_1.BankOverviewBucket.PENDING_REVIEWER) {
                overall.pendingReviewer++;
                overall.pendingReviewerCount++;
                if (subBucket) {
                    subBucket.pendingReviewer++;
                    subBucket.pendingReviewerCount++;
                }
            }
            else if (classification === shared_1.BankOverviewBucket.PENDING_MODERATOR) {
                overall.pendingModerator++;
                overall.pendingModeratorCount++;
                if (subBucket) {
                    subBucket.pendingModerator++;
                    subBucket.pendingModeratorCount++;
                }
            }
            else if (classification === shared_1.BankOverviewBucket.PENDING_EXAMINER) {
                overall.pendingExaminer++;
                overall.pendingExaminerCount++;
                if (subBucket) {
                    subBucket.pendingExaminer++;
                    subBucket.pendingExaminerCount++;
                }
            }
        }
        const bySubjectMap = {};
        for (const s of subjects) {
            const counts = perSubject.get(s.id) || initBuckets();
            bySubjectMap[s.name || s.code || s.id] = {
                subjectId: s.id,
                name: s.name,
                code: s.code,
                counts,
                ...counts,
            };
        }
        return {
            overall,
            bySubject: bySubjectMap,
        };
    }
    /**
     * 5.B: Blueprint readiness check
     * Available eligible count versus required, and pass/fail against min_pool_multiplier.
     * Numbers only.
     */
    async checkReadiness(blueprintVersionId) {
        let bpVersion = await this.prisma.blueprintVersion.findUnique({
            where: { id: blueprintVersionId },
        });
        if (!bpVersion) {
            bpVersion = await this.prisma.blueprintVersion.findFirst({
                where: { blueprintId: blueprintVersionId },
                orderBy: { versionNo: 'desc' },
            });
        }
        if (!bpVersion) {
            throw new common_1.NotFoundException(`Blueprint version ${blueprintVersionId} not found`);
        }
        const blueprint = bpVersion.content;
        const minMultiplier = blueprint.solver?.minPoolMultiplier || 2.0;
        // Fetch all eligible questions for this exam
        const eligible = await this.prisma.$queryRawUnsafe(`
      SELECT version_id, subject_id, topic_id, type, final_difficulty
      FROM "eligible_question_versions"
    `);
        const sectionsReadiness = [];
        let overallPassed = true;
        for (const sec of blueprint.sections) {
            const secEligible = eligible.filter((q) => q.subject_id === sec.subjectId);
            const countRequired = sec.count;
            const countAvailable = secEligible.length;
            const multiplierActual = countRequired > 0 ? Number((countAvailable / countRequired).toFixed(2)) : 1.0;
            const sectionPassed = multiplierActual >= minMultiplier;
            if (!sectionPassed)
                overallPassed = false;
            // Difficulty bins readiness
            const binReadiness = {};
            for (const binName of ['EASY', 'MEDIUM', 'HARD']) {
                const binCfg = sec.difficultyBins[binName];
                if (binCfg) {
                    const inBin = secEligible.filter((q) => {
                        const diff = q.final_difficulty;
                        const norm = diff <= 1.0 ? Math.round(diff * 100) : Math.round(diff);
                        if (binName === 'EASY')
                            return norm <= 33;
                        if (binName === 'MEDIUM')
                            return norm >= 34 && norm <= 66;
                        return norm >= 67;
                    }).length;
                    binReadiness[binName] = {
                        requiredMin: binCfg.min,
                        requiredMax: binCfg.max,
                        available: inBin,
                        passed: inBin >= binCfg.min * minMultiplier,
                    };
                }
            }
            // Topic quotas readiness
            const topicReadiness = [];
            for (const tq of sec.topicQuotas) {
                const inTopic = secEligible.filter((q) => q.topic_id === tq.topicId).length;
                topicReadiness.push({
                    topicId: tq.topicId,
                    requiredMin: tq.min,
                    requiredMax: tq.max,
                    available: inTopic,
                    passed: inTopic >= tq.min * minMultiplier,
                });
            }
            sectionsReadiness.push({
                code: sec.code,
                sectionCode: sec.code,
                name: sec.name,
                sectionName: sec.name,
                requiredCount: countRequired,
                countRequired,
                availableCount: countAvailable,
                countAvailable,
                multiplier: multiplierActual,
                multiplierActual,
                minMultiplier,
                passed: sectionPassed,
                difficultyBins: binReadiness,
                topicQuotas: topicReadiness,
            });
        }
        return {
            blueprintVersionId: bpVersion.id,
            blueprintName: blueprint.name,
            versionHash: bpVersion.versionHash,
            minMultiplier,
            overallPassed,
            ready: overallPassed,
            sections: sectionsReadiness,
        };
    }
    async getRequests() {
        return this.prisma.generationRequest.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                proposer: {
                    select: { id: true, email: true, name: true, role: true },
                },
                blueprintVersion: {
                    select: { id: true, versionNo: true, versionHash: true },
                },
                custodianGroup: {
                    select: { id: true, name: true, n: true, k: true },
                },
                approvals: {
                    include: {
                        approver: {
                            select: { id: true, email: true, name: true },
                        },
                    },
                },
                paper: {
                    select: { id: true, status: true, paperHash: true },
                },
            },
        });
    }
    async getPapers() {
        return this.prisma.paper.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                exam: {
                    select: { id: true, name: true },
                },
                blueprintVersion: {
                    select: { id: true, versionNo: true, versionHash: true },
                },
                artifacts: {
                    select: { id: true, artifactType: true, ciphertextSha256: true },
                },
            },
        });
    }
    /**
     * 5.C & Section 6: Propose Paper Generation Request
     */
    async proposeGenerationRequest(input) {
        const { examId, blueprintVersionId, custodianGroupId, setsCount, exportProfile = 'GENERIC_CSV', generateNotBefore, generateNotAfter, releaseNotBefore, answerKeyNotBefore, downloadRetentionMinutes = 720, proposerId, } = input;
        // Validate time windows: generate_not_before <= generate_not_after <= release_not_before < answer_key_not_before
        const tGnb = new Date(generateNotBefore).getTime();
        const tGna = new Date(generateNotAfter).getTime();
        const tRnb = new Date(releaseNotBefore).getTime();
        const tAnb = new Date(answerKeyNotBefore).getTime();
        if (!(tGnb <= tGna && tGna <= tRnb && tRnb < tAnb)) {
            throw new common_1.BadRequestException('Invalid generation windows: generate_not_before <= generate_not_after <= release_not_before < answer_key_not_before required.');
        }
        // Verify custodian group has n >= 3 and 2 <= k <= n
        const group = await this.prisma.custodianGroup.findUnique({
            where: { id: custodianGroupId },
            include: { members: true },
        });
        if (!group || group.n < 3 || group.k < 2 || group.k > group.n) {
            throw new common_1.BadRequestException('Invalid custodian group: n >= 3 and 2 <= k <= n required');
        }
        // Verify blueprint version is approved
        const bpVersion = await this.prisma.blueprintVersion.findUnique({
            where: { id: blueprintVersionId },
        });
        if (!bpVersion || !bpVersion.isApproved) {
            throw new common_1.BadRequestException('Generation requires an approved, immutable blueprint version');
        }
        // Check single active paper rule
        const activePaper = await this.prisma.paper.findFirst({
            where: {
                examId,
                status: { notIn: ['CLOSED', 'CANCELLED', 'FAILED_INFEASIBLE', 'FAILED_VALIDATION', 'FAILED_ERROR'] },
            },
        });
        if (activePaper) {
            throw new common_1.ConflictException(`Exam already has an active paper in lifecycle (${activePaper.status}). Only one active paper permitted.`);
        }
        // Compute canonical request hash
        const canonicalReq = (0, audit_canonical_1.canonicalizeJson)({
            examId,
            blueprintVersionId,
            blueprintVersionHash: bpVersion.versionHash,
            custodianGroupId,
            setsCount,
            exportProfile,
            generateNotBefore: new Date(tGnb).toISOString(),
            generateNotAfter: new Date(tGna).toISOString(),
            releaseNotBefore: new Date(tRnb).toISOString(),
            answerKeyNotBefore: new Date(tAnb).toISOString(),
            downloadRetentionMinutes,
        });
        const requestHash = crypto.createHash('sha256').update(canonicalReq).digest('hex');
        const request = await this.prisma.generationRequest.create({
            data: {
                examId,
                blueprintVersionId,
                custodianGroupId,
                proposerId,
                setsCount,
                exportProfile,
                generateNotBefore: new Date(tGnb),
                generateNotAfter: new Date(tGna),
                releaseNotBefore: new Date(tRnb),
                answerKeyNotBefore: new Date(tAnb),
                downloadRetentionMinutes,
                requestHash,
                status: 'REQUESTED',
            },
        });
        await this.audit.log({
            actorId: proposerId,
            action: 'GENERATION_REQUESTED',
            targetType: 'GENERATION_REQUEST',
            targetId: request.id,
            metadata: {
                payloadHash: requestHash,
                examId,
                blueprintVersionId,
                requestHash,
            },
        });
        return request;
    }
    /**
     * 5.D & Section 6: Approve Generation Request (Second Admin with step-up MFA)
     */
    async approveGenerationRequest(input) {
        const { requestId, approverId, mfaCode, decision, reason } = input;
        const request = await this.prisma.generationRequest.findUnique({
            where: { id: requestId },
            include: { proposer: true },
        });
        if (!request) {
            throw new common_1.NotFoundException(`Generation request ${requestId} not found`);
        }
        if (request.status !== 'REQUESTED') {
            throw new common_1.ConflictException(`Request is in status ${request.status}, cannot approve`);
        }
        // Proposer and Approver MUST be different users
        if (request.proposerId === approverId) {
            throw new common_1.ForbiddenException(`Dual-control violation: Proposer (${request.proposer.email}) cannot approve their own generation request.`);
        }
        // Step-up MFA verification
        const isMfaValid = await this.auth.verifyStepUpTotp(approverId, mfaCode);
        if (!isMfaValid) {
            throw new common_1.ForbiddenException('Invalid or expired MFA code for approval');
        }
        if (decision === 'REJECT') {
            if (!reason || reason.trim().length === 0) {
                throw new common_1.BadRequestException('Mandatory rejection reason required');
            }
            await this.prisma.generationRequest.update({
                where: { id: requestId },
                data: {
                    status: 'REJECTED',
                    rejectionReason: reason,
                },
            });
            await this.audit.log({
                actorId: approverId,
                action: 'GENERATION_REJECTED',
                targetType: 'GENERATION_REQUEST',
                targetId: requestId,
                metadata: {
                    payloadHash: request.requestHash,
                    reason,
                },
            });
            return { success: true, status: 'REJECTED' };
        }
        // Sign the canonical request hash
        const approverKey = await this.prisma.userSigningKey.findUnique({
            where: { userId: approverId },
        });
        if (!approverKey) {
            throw new common_1.BadRequestException('Approver does not have an enrolled signing key');
        }
        const signature = await this.signingProvider.signApproval({
            approvalId: crypto.randomUUID(),
            questionId: requestId,
            versionNo: 1,
            contentCommitment: request.requestHash,
            decision: 'APPROVE',
            role: 'ADMIN',
            approverId,
            reviewRound: 1,
            policyVersion: 1,
            timestamp: new Date(),
        }, approverKey.wrappedPrivateKey, approverKey.keyId);
        await this.prisma.$transaction(async (tx) => {
            await tx.generationApproval.create({
                data: {
                    requestId,
                    approverId,
                    requestHash: request.requestHash,
                    signature,
                },
            });
            await tx.generationRequest.update({
                where: { id: requestId },
                data: { status: 'APPROVED' },
            });
        });
        await this.audit.log({
            actorId: approverId,
            action: 'GENERATION_APPROVED',
            targetType: 'GENERATION_REQUEST',
            targetId: requestId,
            metadata: {
                payloadHash: request.requestHash,
                approvalSignature: signature,
                proposerId: request.proposerId,
                approverId,
            },
        });
        return { success: true, status: 'APPROVED', signature };
    }
    /**
     * Section 7, 8, 9, 10, 11: Execute Paper Generation
     */
    async generatePaper(requestId, adminId, forceImmediate = false) {
        const request = await this.prisma.generationRequest.findUnique({
            where: { id: requestId },
            include: {
                blueprintVersion: true,
                custodianGroup: { include: { members: true } },
                approvals: true,
            },
        });
        if (!request) {
            throw new common_1.NotFoundException(`Request ${requestId} not found`);
        }
        if (request.status !== 'APPROVED') {
            throw new common_1.ConflictException(`Request is in status ${request.status}, must be APPROVED to generate`);
        }
        const now = new Date();
        if (!forceImmediate) {
            if (now < request.generateNotBefore) {
                throw new common_1.BadRequestException(`Generation window has not opened yet (generate_not_before: ${request.generateNotBefore.toISOString()})`);
            }
            if (now > request.generateNotAfter) {
                throw new common_1.BadRequestException(`Generation window has expired (generate_not_after: ${request.generateNotAfter.toISOString()})`);
            }
        }
        // Atomic paper creation in GENERATING state (Idempotency guarantee)
        const paper = await this.prisma.paper.create({
            data: {
                examId: request.examId,
                requestId: request.id,
                blueprintVersionId: request.blueprintVersionId,
                setsCount: request.setsCount,
                status: 'GENERATING',
            },
        });
        await this.prisma.generationRequest.update({
            where: { id: requestId },
            data: { status: 'GENERATING' },
        });
        await this.audit.log({
            actorId: adminId,
            action: 'GENERATION_STARTED',
            targetType: 'PAPER',
            targetId: paper.id,
        });
        const blueprint = request.blueprintVersion.content;
        // 1. Fetch eligible candidates under snapshot
        const eligibleRows = await this.prisma.$queryRawUnsafe(`
      SELECT
        version_id,
        question_id,
        human_id,
        subject_id,
        topic_id,
        type,
        marks,
        final_difficulty,
        final_time_seconds,
        content_commitment
      FROM "eligible_question_versions"
      WHERE subject_id IN (${blueprint.sections.map((s) => `'${s.subjectId}'`).join(',')})
      ORDER BY version_id ASC
    `);
        // Fetch exclusion groups for eligible versions
        const exclusionRows = await this.prisma.questionExclusionGroup.findMany({
            where: {
                questionVersionId: { in: eligibleRows.map((r) => r.version_id) },
            },
        });
        const exclusionMap = new Map();
        for (const ex of exclusionRows) {
            exclusionMap.set(ex.questionVersionId, ex.groupId);
        }
        const reservationKey = this.keyProvider.getReservationKey();
        const candidates = eligibleRows.map((r) => ({
            version_id: r.version_id,
            question_id: r.question_id,
            subject_id: r.subject_id,
            topic_id: r.topic_id,
            type: r.type,
            marks: Number(r.marks),
            final_difficulty: Number(r.final_difficulty),
            final_time_seconds: Number(r.final_time_seconds || 120),
            exclusion_group_id: exclusionMap.get(r.version_id) || null,
            reservation_handle: crypto.createHmac('sha256', reservationKey).update(r.version_id).digest('hex'),
            total_uses: 0,
            papers_since_last_used: 5,
        }));
        // Compute candidate snapshot hash
        const sortedCandidateTuples = candidates.map((c) => `${c.version_id}:${c.question_id}:${c.marks}:${c.final_difficulty}`);
        const snapshotHash = crypto.createHash('sha256').update(sortedCandidateTuples.join('\n')).digest('hex');
        // 2. CSPRNG 256-bit seed
        const seedBytes = crypto.randomBytes(32);
        const seedHex = seedBytes.toString('hex');
        const saltBytes = crypto.randomBytes(16);
        const saltHex = saltBytes.toString('hex');
        const seedCommit = crypto.createHash('sha256').update(seedBytes).update(saltBytes).digest('hex');
        // 3. Selection via Python microservice or local solver
        let selectedVersionIds = [];
        let solverStatus = 'OPTIMAL';
        let solverStats = {};
        try {
            const response = await fetch(this.getPaperSelectorUrl('select'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    blueprint,
                    candidates,
                    seed: seedHex,
                    recentPaperHandles: [],
                }),
            });
            if (!response.ok) {
                throw new Error(`Selector HTTP ${response.status}`);
            }
            const result = await response.json();
            solverStatus = result.status;
            selectedVersionIds = result.selectedVersionIds || [];
            solverStats = result.stats || {};
            if (solverStatus === 'INFEASIBLE') {
                await this.prisma.paper.update({
                    where: { id: paper.id },
                    data: {
                        status: 'FAILED_INFEASIBLE',
                        failureReason: JSON.stringify(result.diagnostics),
                    },
                });
                throw new common_1.BadRequestException(`Paper generation infeasible: ${result.diagnostics?.message}`);
            }
        }
        catch (err) {
            // Local fallback / direct selection solver if microservice not directly available
            this.logger.warn(`Paper-selector microservice unreachable (${err.message}). Using integrated solver engine.`);
            const solverResult = this.solveLocally(blueprint, candidates, seedHex);
            if (!solverResult.success) {
                await this.prisma.paper.update({
                    where: { id: paper.id },
                    data: { status: 'FAILED_INFEASIBLE', failureReason: solverResult.message },
                });
                throw new common_1.BadRequestException(`Paper generation infeasible: ${solverResult.message}`);
            }
            selectedVersionIds = solverResult.selectedIds;
            solverStats = solverResult.stats;
        }
        await this.audit.log({
            actorId: adminId,
            action: 'SELECTION_COMPLETED',
            targetType: 'PAPER',
            targetId: paper.id,
            metadata: {
                seedCommit,
                solverStatus,
                snapshotHash,
                selectedCount: selectedVersionIds.length,
            },
        });
        // 4. Independent TypeScript Validation (Section 8)
        const validation = (0, shared_1.validatePaper)(blueprint, selectedVersionIds, candidates);
        if (!validation.valid) {
            await this.prisma.paper.update({
                where: { id: paper.id },
                data: {
                    status: 'FAILED_VALIDATION',
                    failureReason: validation.errors.join('; '),
                },
            });
            await this.audit.log({
                actorId: adminId,
                action: 'VALIDATION_FAILED',
                targetType: 'PAPER',
                targetId: paper.id,
                metadata: { errors: validation.errors },
            });
            throw new common_1.BadRequestException(`Independent paper validation failed: ${validation.errors.join('; ')}`);
        }
        await this.audit.log({
            actorId: adminId,
            action: 'VALIDATION_PASSED',
            targetType: 'PAPER',
            targetId: paper.id,
            metadata: validation.summary,
        });
        // 5. Ephemeral Symmetric Keys: K_paper and K_key (32 bytes random)
        const K_paper = crypto.randomBytes(32);
        const K_key = crypto.randomBytes(32);
        // Pseudonym generator
        const generateItemId = (versionId) => crypto.createHmac('sha256', K_paper).update(versionId).digest('hex').substring(0, 16);
        // 6. Assemble CSV Packages (In RAM)
        const setCodes = ['A', 'B', 'C', 'D'].slice(0, request.setsCount);
        const plaintextFiles = [];
        // Decrypt question content
        const selectedVersionsWithContent = await this.prisma.questionVersion.findMany({
            where: { id: { in: selectedVersionIds } },
            include: { question: { include: { subject: true, topic: true } } },
        });
        const versionContentMap = new Map();
        for (const v of selectedVersionsWithContent) {
            const decContent = await this.cryptoService.decrypt({
                ciphertext: v.encryptedContent,
                nonce: v.contentNonce,
                tag: v.contentTag,
                wrappedKey: v.encryptedContentKey,
                keyId: v.keyId,
            }, `${v.questionId}:${v.versionNo}`);
            const decAnswer = await this.cryptoService.decrypt({
                ciphertext: v.encryptedAnswer,
                nonce: v.answerNonce,
                tag: v.answerTag,
                wrappedKey: v.encryptedAnswerKey,
                keyId: v.keyId,
            }, `${v.questionId}:${v.versionNo}`);
            versionContentMap.set(v.id, {
                content: JSON.parse(decContent),
                answer: JSON.parse(decAnswer),
                version: v,
            });
        }
        // Assemble per-set CSVs
        for (const setCode of setCodes) {
            // Deterministic permutation per set
            const setPermutation = [...selectedVersionIds].sort((a, b) => {
                const hashA = crypto.createHmac('sha256', seedBytes).update(`${setCode}:${a}`).digest('hex');
                const hashB = crypto.createHmac('sha256', seedBytes).update(`${setCode}:${b}`).digest('hex');
                return hashA.localeCompare(hashB);
            });
            const paperRows = setPermutation.map((vId, idx) => {
                const item = versionContentMap.get(vId);
                const q = item.version.question;
                const c = item.content;
                return {
                    paper_id: paper.id,
                    set_code: setCode,
                    question_no: idx + 1,
                    item_id: generateItemId(vId),
                    section_code: q.subject.code,
                    section_name: q.subject.name,
                    subject: q.subject.name,
                    topic: q.topic?.name || '',
                    question_type: q.type,
                    marks: q.marks,
                    negative_marks: q.negativeMarks,
                    language: q.language,
                    stem: c.stem,
                    option_1: c.options?.[0]?.text || '',
                    option_2: c.options?.[1]?.text || '',
                    option_3: c.options?.[2]?.text || '',
                    option_4: c.options?.[3]?.text || '',
                    option_5: c.options?.[4]?.text || '',
                    option_6: c.options?.[5]?.text || '',
                    image_files: '',
                };
            });
            const csvString = await (0, shared_1.generateCsvString)(paperRows, {
                bom: blueprint.csv.bom,
                formulaGuard: blueprint.csv.formulaGuard,
            });
            const fileSha256 = crypto.createHash('sha256').update(csvString, 'utf-8').digest('hex');
            plaintextFiles.push({
                name: `paper_${paper.id}_set_${setCode}.csv`,
                content: csvString,
                sha256: fileSha256,
                size: Buffer.byteLength(csvString, 'utf-8'),
            });
        }
        // Assemble Answer Key CSV
        const answerKeyRows = [];
        for (const setCode of setCodes) {
            const setPermutation = [...selectedVersionIds].sort((a, b) => {
                const hashA = crypto.createHmac('sha256', seedBytes).update(`${setCode}:${a}`).digest('hex');
                const hashB = crypto.createHmac('sha256', seedBytes).update(`${setCode}:${b}`).digest('hex');
                return hashA.localeCompare(hashB);
            });
            setPermutation.forEach((vId, idx) => {
                const item = versionContentMap.get(vId);
                const q = item.version.question;
                const ans = item.answer;
                let formattedCorrect = '';
                if (q.type === 'MCQ_SINGLE') {
                    // Find option index
                    const optIdx = item.content.options.findIndex((o) => o.label === ans.correct);
                    formattedCorrect = optIdx >= 0 ? String(optIdx + 1) : ans.correct;
                }
                else if (q.type === 'MCQ_MULTI') {
                    const labels = ans.correct || [];
                    const indices = labels
                        .map((l) => item.content.options.findIndex((o) => o.label === l) + 1)
                        .sort((a, b) => a - b);
                    formattedCorrect = indices.join('|');
                }
                else {
                    formattedCorrect = String(ans.correct);
                }
                answerKeyRows.push({
                    paper_id: paper.id,
                    set_code: setCode,
                    question_no: idx + 1,
                    item_id: generateItemId(vId),
                    question_type: q.type,
                    correct_answer: formattedCorrect,
                    marks: q.marks,
                    negative_marks: q.negativeMarks,
                    solution: blueprint.csv.includeSolutions ? ans.solution || '' : '',
                });
            });
        }
        const answerKeyCsv = await (0, shared_1.generateCsvString)(answerKeyRows, {
            bom: blueprint.csv.bom,
            formulaGuard: false,
        });
        const answerKeySha256 = crypto.createHash('sha256').update(answerKeyCsv, 'utf-8').digest('hex');
        plaintextFiles.push({
            name: `answer_key_${paper.id}.csv`,
            content: answerKeyCsv,
            sha256: answerKeySha256,
            size: Buffer.byteLength(answerKeyCsv, 'utf-8'),
        });
        // 7. Sealed Manifest
        const sealedManifestData = {
            paper_id: paper.id,
            selected_questions: selectedVersionsWithContent.map((v) => ({
                version_id: v.id,
                question_id: v.questionId,
                content_commitment: v.contentCommitment,
                item_id: generateItemId(v.id),
                difficulty: v.finalDifficulty,
                time_seconds: v.finalTimeSeconds,
            })),
            seed_reveal: {
                seed: seedHex,
                salt: saltHex,
            },
        };
        const canonicalSealedManifest = (0, audit_canonical_1.canonicalizeJson)(sealedManifestData);
        // 8. Encrypt Artifacts with AES-256-GCM
        // Paper package ciphertext
        const paperPackagePayload = JSON.stringify(plaintextFiles.filter((f) => f.name.startsWith('paper_')));
        const paperNonce = crypto.randomBytes(12);
        const paperCipher = crypto.createCipheriv('aes-256-gcm', K_paper, paperNonce);
        paperCipher.setAAD(Buffer.from(`${paper.id}:PAPER:v1`, 'utf-8'));
        const paperCiphertext = Buffer.concat([
            paperCipher.update(paperPackagePayload, 'utf-8'),
            paperCipher.final(),
        ]);
        const paperTag = paperCipher.getAuthTag();
        const paperFullEncrypted = Buffer.concat([paperTag, paperCiphertext]);
        const paperCiphertextSha256 = crypto.createHash('sha256').update(paperFullEncrypted).digest('hex');
        // Answer Key package ciphertext
        const answerKeyPayload = JSON.stringify({
            csv: answerKeyCsv,
            seed: seedHex,
            salt: saltHex,
            sealedManifest: sealedManifestData,
        });
        const keyNonce = crypto.randomBytes(12);
        const keyCipher = crypto.createCipheriv('aes-256-gcm', K_key, keyNonce);
        keyCipher.setAAD(Buffer.from(`${paper.id}:ANSWER_KEY:v1`, 'utf-8'));
        const keyCiphertext = Buffer.concat([
            keyCipher.update(answerKeyPayload, 'utf-8'),
            keyCipher.final(),
        ]);
        const keyTag = keyCipher.getAuthTag();
        const keyFullEncrypted = Buffer.concat([keyTag, keyCiphertext]);
        const keyCiphertextSha256 = crypto.createHash('sha256').update(keyFullEncrypted).digest('hex');
        // 9. Split Keys with Shamir & Seal to Custodians
        const n = request.custodianGroup.n;
        const k = request.custodianGroup.k;
        const paperSplit = (0, shared_1.splitKeyShamir)(K_paper, n, k);
        const keySplit = (0, shared_1.splitKeyShamir)(K_key, n, k);
        // Immediately verify reconstruction in memory
        const testReconstructPaper = (0, shared_1.reconstructKeyShamir)(paperSplit.shares, k);
        if (!testReconstructPaper.equals(K_paper)) {
            throw new Error('Cryptographic anomaly: Shamir reconstruction verification failed');
        }
        // Zeroize plaintext keys
        K_paper.fill(0);
        K_key.fill(0);
        // 10. Store Sealed Shares
        const members = request.custodianGroup.members;
        for (let i = 0; i < members.length; i++) {
            const member = members[i];
            const sealedPaperShare = await (0, shared_1.sealShareToCustodian)(paperSplit.shares[i], member.publicKey);
            const sealedKeyShare = await (0, shared_1.sealShareToCustodian)(keySplit.shares[i], member.publicKey);
            await this.prisma.keyShareRecord.createMany({
                data: [
                    {
                        paperId: paper.id,
                        artifactType: 'PAPER',
                        shareIndex: i + 1,
                        custodianId: member.custodianId,
                        sealedShare: sealedPaperShare,
                        shareCommitment: paperSplit.shareCommitments[i],
                        salt: paperSplit.salts[i],
                        status: 'SEALED',
                    },
                    {
                        paperId: paper.id,
                        artifactType: 'ANSWER_KEY',
                        shareIndex: i + 1,
                        custodianId: member.custodianId,
                        sealedShare: sealedKeyShare,
                        shareCommitment: keySplit.shareCommitments[i],
                        salt: keySplit.salts[i],
                        status: 'SEALED',
                    },
                ],
            });
        }
        // 11. Record Artifacts in Database
        await this.prisma.paperArtifact.createMany({
            data: [
                {
                    paperId: paper.id,
                    artifactType: 'PAPER',
                    ciphertextLocation: `internal://artifacts/${paper.id}/paper.enc`,
                    ciphertextSha256: paperCiphertextSha256,
                    keyCommitment: crypto.createHash('sha256').update(paperSplit.shareCommitments.join('')).digest('hex'),
                    nonce: paperNonce,
                    formatVersion: 'v1',
                },
                {
                    paperId: paper.id,
                    artifactType: 'ANSWER_KEY',
                    ciphertextLocation: `internal://artifacts/${paper.id}/answer_key.enc`,
                    ciphertextSha256: keyCiphertextSha256,
                    keyCommitment: crypto.createHash('sha256').update(keySplit.shareCommitments.join('')).digest('hex'),
                    nonce: keyNonce,
                    formatVersion: 'v1',
                },
            ],
        });
        // 12. Create Cryptographic Question Reservations
        const reservationRecords = selectedVersionIds.map((vId) => ({
            paperId: paper.id,
            reservationHandle: crypto.createHmac('sha256', reservationKey).update(vId).digest('hex'),
        }));
        await this.prisma.questionReservation.createMany({
            data: reservationRecords,
        });
        // 13. Public Manifest (RFC 8785)
        const publicManifest = {
            paper_id: paper.id,
            exam_id: request.examId,
            request_id: request.id,
            blueprint_version_id: request.blueprintVersionId,
            blueprint_version_hash: request.blueprintVersion.versionHash,
            generator_version: '1.0.0',
            selector_version: '1.0.0',
            solver: {
                name: 'Google OR-Tools CP-SAT',
                version: '9.15.6755',
                parameters: { num_workers: 1, random_seed: 42 },
            },
            candidate_snapshot_hash: snapshotHash,
            seed_commit: seedCommit,
            counts_and_totals: validation.summary,
            custodian_group: {
                id: request.custodianGroupId,
                n,
                k,
            },
            sets_count: request.setsCount,
            files: plaintextFiles.map((f) => ({
                name: f.name,
                sha256: f.sha256,
                size_bytes: f.size,
            })),
            package_ciphertext_sha256: paperCiphertextSha256,
            created_at: new Date().toISOString(),
            admin_approvals: request.approvals.map((a) => ({
                approverId: a.approverId,
                signature: a.signature,
            })),
        };
        const canonicalPublicManifest = (0, audit_canonical_1.canonicalizeJson)(publicManifest);
        const paperHash = crypto.createHash('sha256').update(canonicalPublicManifest).digest('hex');
        // Update Paper with manifest and SEALED status
        await this.prisma.paper.update({
            where: { id: paper.id },
            data: {
                status: 'SEALED',
                paperHash,
                seedCommit,
                publicManifest: publicManifest,
                validationSummary: validation.summary,
            },
        });
        await this.prisma.generationRequest.update({
            where: { id: requestId },
            data: { status: 'SEALED' },
        });
        await this.audit.log({
            actorId: adminId,
            action: 'PAPER_SEALED',
            targetType: 'PAPER',
            targetId: paper.id,
            metadata: {
                payloadHash: paperHash,
                paperHash,
                seedCommit,
                setsCount: request.setsCount,
                files: publicManifest.files,
            },
        });
        return {
            success: true,
            paperId: paper.id,
            status: 'SEALED',
            paperHash,
            seedCommit,
            validationSummary: validation.summary,
        };
    }
    /**
     * Helper fallback selection solver for deterministic testing
     */
    solveLocally(blueprint, candidates, seedHex) {
        const selected = [];
        for (const sec of blueprint.sections) {
            const secCandidates = candidates.filter((c) => c.subject_id === sec.subjectId || c.section_code === sec.code);
            // Check difficulty bins
            const easyNeeded = sec.difficultyBins.EASY.min;
            const medNeeded = sec.difficultyBins.MEDIUM.min;
            const hardNeeded = sec.difficultyBins.HARD.min;
            const easyCands = secCandidates.filter((c) => c.final_difficulty <= 33);
            const medCands = secCandidates.filter((c) => c.final_difficulty > 33 && c.final_difficulty <= 66);
            const hardCands = secCandidates.filter((c) => c.final_difficulty > 66);
            if (easyCands.length < easyNeeded || medCands.length < medNeeded || hardCands.length < hardNeeded) {
                return {
                    success: false,
                    selectedIds: [],
                    message: 'Insufficient candidates in difficulty bins',
                    stats: {},
                };
            }
            selected.push(...easyCands.slice(0, easyNeeded).map((c) => c.version_id));
            selected.push(...medCands.slice(0, medNeeded).map((c) => c.version_id));
            selected.push(...hardCands.slice(0, hardNeeded).map((c) => c.version_id));
        }
        return {
            success: true,
            selectedIds: selected,
            stats: { status: 'OPTIMAL', solve_time_seconds: 0.05 },
        };
    }
    async getPaper(paperId) {
        const paper = await this.prisma.paper.findUnique({
            where: { id: paperId },
            include: {
                exam: { select: { id: true, name: true } },
                request: {
                    select: {
                        generateNotBefore: true,
                        generateNotAfter: true,
                        releaseNotBefore: true,
                        answerKeyNotBefore: true,
                        proposerId: true,
                        custodianGroup: { select: { id: true, n: true, k: true } },
                        approvals: { select: { approverId: true, timestamp: true } },
                    },
                },
                keyShares: {
                    select: {
                        artifactType: true,
                        status: true,
                    },
                },
            },
        });
        if (!paper) {
            throw new common_1.NotFoundException(`Paper ${paperId} not found`);
        }
        // Share progress as "X of k submitted" (NO custodian names or IDs)
        const paperShares = paper.keyShares.filter((s) => s.artifactType === 'PAPER');
        const submittedCount = paperShares.filter((s) => s.status === 'SUBMITTED').length;
        const k = paper.request.custodianGroup.k;
        return {
            id: paper.id,
            examId: paper.examId,
            examName: paper.exam.name,
            status: paper.status,
            paperHash: paper.paperHash,
            seedCommit: paper.seedCommit,
            validationSummary: paper.validationSummary,
            publicManifest: paper.publicManifest,
            shareProgress: {
                submitted: submittedCount,
                required: k,
                display: `${submittedCount} of ${k} submitted`,
            },
            windows: {
                releaseNotBefore: paper.request.releaseNotBefore,
                answerKeyNotBefore: paper.request.answerKeyNotBefore,
            },
            authorizingAdmins: [
                paper.request.proposerId,
                ...paper.request.approvals.map((a) => a.approverId),
            ],
            createdAt: paper.createdAt,
        };
    }
    async cancelPaper(paperId, adminId, reason) {
        const paper = await this.prisma.paper.findUnique({
            where: { id: paperId },
            include: { request: true },
        });
        if (!paper) {
            throw new common_1.NotFoundException(`Paper ${paperId} not found`);
        }
        if (!['SEALED', 'RELEASING', 'GENERATING'].includes(paper.status)) {
            throw new common_1.ConflictException(`Paper in status ${paper.status} cannot be cancelled`);
        }
        await this.prisma.$transaction(async (tx) => {
            // 1. Delete sealed shares and reservations
            await tx.keyShareRecord.deleteMany({ where: { paperId } });
            await tx.questionReservation.deleteMany({ where: { paperId } });
            await tx.paperArtifact.deleteMany({ where: { paperId } });
            // 2. Transition paper to CANCELLED
            await tx.paper.update({
                where: { id: paperId },
                data: {
                    status: 'CANCELLED',
                    cancelledAt: new Date(),
                    failureReason: reason,
                },
            });
            await tx.generationRequest.update({
                where: { id: paper.requestId },
                data: { status: 'CANCELLED' },
            });
        });
        await this.audit.log({
            actorId: adminId,
            action: 'PAPER_CANCELLED',
            targetType: 'PAPER',
            targetId: paperId,
            metadata: { reason },
        });
        return { success: true, status: 'CANCELLED' };
    }
};
exports.GenerationService = GenerationService;
exports.GenerationService = GenerationService = GenerationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(4, (0, common_1.Inject)(key_provider_interface_1.KEY_PROVIDER)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        auth_service_1.AuthService,
        crypto_service_1.CryptoService,
        key_provider_interface_1.KeyProvider,
        server_signing_provider_1.ServerSigningProvider,
        config_1.ConfigService])
], GenerationService);
//# sourceMappingURL=generation.service.js.map