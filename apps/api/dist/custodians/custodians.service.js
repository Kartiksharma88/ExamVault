"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustodiansService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const client_1 = require("@prisma/client");
let CustodiansService = class CustodiansService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    /**
     * Create a new custodian group (n >= 3, 2 <= k <= n).
     */
    async createGroup(input) {
        const { name, description, n, k, custodianIds, actorId } = input;
        if (n < 3) {
            throw new common_1.BadRequestException(`Custodian group must have n >= 3 (got ${n})`);
        }
        if (k < 2 || k > n) {
            throw new common_1.BadRequestException(`Threshold k must satisfy 2 <= k <= n (got k=${k}, n=${n})`);
        }
        if (custodianIds.length !== n) {
            throw new common_1.BadRequestException(`Exactly ${n} custodian IDs must be provided (got ${custodianIds.length})`);
        }
        // Verify all custodian users have Role CUSTODIAN
        const custodians = await this.prisma.user.findMany({
            where: {
                id: { in: custodianIds },
                role: client_1.Role.CUSTODIAN,
            },
        });
        if (custodians.length !== n) {
            throw new common_1.BadRequestException(`All ${n} members must be registered users with role CUSTODIAN`);
        }
        // Check that ADMIN role cannot be in custodian group
        const adminCheck = await this.prisma.user.findFirst({
            where: {
                id: { in: custodianIds },
                role: client_1.Role.ADMIN,
            },
        });
        if (adminCheck) {
            throw new common_1.ForbiddenException('Separation of duties violation: ADMIN cannot hold CUSTODIAN role');
        }
        const group = await this.prisma.custodianGroup.create({
            data: {
                name,
                description,
                n,
                k,
                members: {
                    create: custodianIds.map((cId) => ({
                        custodianId: cId,
                        publicKey: 'ENROLLMENT_PENDING',
                        fingerprint: 'PENDING',
                    })),
                },
            },
            include: { members: true },
        });
        await this.audit.log({
            actorId,
            action: 'CUSTODIAN_GROUP_CHANGED',
            targetType: 'CUSTODIAN_GROUP',
            targetId: group.id,
            metadata: {
                name,
                n,
                k,
                custodianIds,
            },
        });
        return group;
    }
    /**
     * Custodian enrolls their browser-generated X25519 public key.
     */
    async enrollKey(input) {
        const { userId, publicKey, fingerprint } = input;
        // Check user has CUSTODIAN role
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });
        if (!user || user.role !== client_1.Role.CUSTODIAN) {
            throw new common_1.ForbiddenException('Only users with role CUSTODIAN may enroll keys');
        }
        // Update all pending group memberships for this custodian
        const updated = await this.prisma.custodianGroupMember.updateMany({
            where: { custodianId: userId },
            data: {
                publicKey,
                fingerprint,
                enrolledAt: new Date(),
            },
        });
        await this.audit.log({
            actorId: userId,
            action: 'CUSTODIAN_ENROLLED',
            targetType: 'USER',
            targetId: userId,
            metadata: {
                fingerprint,
                membershipsUpdated: updated.count,
            },
        });
        return {
            success: true,
            userId,
            fingerprint,
            membershipsUpdated: updated.count,
        };
    }
    async listGroups() {
        return this.prisma.custodianGroup.findMany({
            include: {
                members: {
                    include: {
                        custodian: {
                            select: { id: true, name: true, email: true },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    /**
     * Custodian sees individual key share records assigned to them.
     */
    async getMyShares(custodianId) {
        return this.prisma.keyShareRecord.findMany({
            where: { custodianId },
            include: {
                paper: {
                    include: {
                        exam: { select: { id: true, name: true } },
                        request: {
                            select: {
                                releaseNotBefore: true,
                                answerKeyNotBefore: true,
                            },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    /**
     * Custodian sees papers where they hold a share.
     * Zero question content is ever exposed.
     */
    async getAssignedPapers(custodianId) {
        const shareRecords = await this.prisma.keyShareRecord.findMany({
            where: { custodianId },
            include: {
                paper: {
                    include: {
                        exam: { select: { id: true, name: true } },
                        request: {
                            select: {
                                generateNotBefore: true,
                                generateNotAfter: true,
                                releaseNotBefore: true,
                                answerKeyNotBefore: true,
                            },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        // Group by paper
        const paperMap = new Map();
        for (const rec of shareRecords) {
            if (!paperMap.has(rec.paperId)) {
                paperMap.set(rec.paperId, {
                    paperId: rec.paperId,
                    examName: rec.paper.exam.name,
                    status: rec.paper.status,
                    releaseNotBefore: rec.paper.request.releaseNotBefore,
                    answerKeyNotBefore: rec.paper.request.answerKeyNotBefore,
                    artifacts: [],
                });
            }
            paperMap.get(rec.paperId).artifacts.push({
                artifactType: rec.artifactType,
                shareIndex: rec.shareIndex,
                sealedShare: rec.sealedShare,
                commitment: rec.shareCommitment,
                status: rec.status,
            });
        }
        return Array.from(paperMap.values());
    }
};
exports.CustodiansService = CustodiansService;
exports.CustodiansService = CustodiansService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], CustodiansService);
//# sourceMappingURL=custodians.service.js.map