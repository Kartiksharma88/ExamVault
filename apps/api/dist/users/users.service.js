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
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const auth_service_1 = require("../auth/auth.service");
const audit_service_1 = require("../audit/audit.service");
let UsersService = class UsersService {
    prisma;
    authService;
    audit;
    constructor(prisma, authService, audit) {
        this.prisma = prisma;
        this.authService = authService;
        this.audit = audit;
    }
    async create(data, actorId) {
        // Check for existing email
        const existing = await this.prisma.user.findUnique({ where: { email: data.email } });
        if (existing) {
            throw new common_1.ConflictException('Email already in use');
        }
        const passwordHash = await this.authService.hashPassword(data.password);
        const user = await this.prisma.user.create({
            data: {
                email: data.email,
                name: data.name,
                role: data.role,
                passwordHash,
                mustSetupMfa: true,
                ...(data.subjectIds && data.subjectIds.length > 0 && {
                    userSubjectExpertise: {
                        create: data.subjectIds.map((subjectId) => ({ subjectId })),
                    },
                }),
            },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                mfaEnabled: true,
                userSubjectExpertise: {
                    select: {
                        subjectId: true,
                        subject: { select: { id: true, name: true, code: true } },
                    },
                },
                createdAt: true,
                updatedAt: true,
            },
        });
        await this.audit.log({
            actorId,
            action: 'USER_CREATE',
            targetType: 'user',
            targetId: user.id,
            metadata: { role: data.role, email: data.email, subjectIds: data.subjectIds },
        });
        return user;
    }
    async findAll() {
        return this.prisma.user.findMany({
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                mfaEnabled: true,
                isActive: true,
                userSubjectExpertise: {
                    select: {
                        subjectId: true,
                        subject: { select: { id: true, name: true, code: true } },
                    },
                },
                createdAt: true,
                updatedAt: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async findById(id) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                mfaEnabled: true,
                isActive: true,
                userSubjectExpertise: {
                    select: {
                        subjectId: true,
                        subject: { select: { id: true, name: true, code: true } },
                    },
                },
                createdAt: true,
                updatedAt: true,
            },
        });
        if (!user)
            throw new common_1.NotFoundException('User not found');
        return user;
    }
    async assignSubjects(userId, subjectIds, actorId) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            throw new common_1.NotFoundException('User not found');
        await this.prisma.$transaction(async (tx) => {
            await tx.userSubjectExpertise.deleteMany({ where: { userId } });
            for (const sId of subjectIds) {
                await tx.userSubjectExpertise.create({
                    data: { userId, subjectId: sId },
                });
            }
        });
        await this.audit.log({
            actorId,
            action: 'USER_SUBJECTS_UPDATE',
            targetType: 'user',
            targetId: userId,
            metadata: { subjectIds },
        });
        return this.findById(userId);
    }
    async update(id, data, actorId) {
        const user = await this.prisma.user.findUnique({ where: { id } });
        if (!user)
            throw new common_1.NotFoundException('User not found');
        const updated = await this.prisma.user.update({
            where: { id },
            data: {
                ...(data.name && { name: data.name }),
                ...(data.role && { role: data.role }),
            },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                mfaEnabled: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        if (data.role && data.role !== user.role) {
            await this.audit.log({
                actorId,
                action: 'ROLE_CHANGE',
                targetType: 'user',
                targetId: id,
                metadata: { oldRole: user.role, newRole: data.role },
            });
        }
        await this.audit.log({
            actorId,
            action: 'USER_UPDATE',
            targetType: 'user',
            targetId: id,
            metadata: { fields: Object.keys(data) },
        });
        return updated;
    }
    async deactivate(id, actorId) {
        await this.prisma.user.update({
            where: { id },
            data: { isActive: false },
        });
        await this.audit.log({
            actorId,
            action: 'USER_DELETE',
            targetType: 'user',
            targetId: id,
        });
        return { success: true };
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        auth_service_1.AuthService,
        audit_service_1.AuditService])
], UsersService);
//# sourceMappingURL=users.service.js.map