import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
    private audit: AuditService,
  ) {}

  async create(
    data: { email: string; name: string; role: string; password: string; subjectIds?: string[] },
    actorId: string,
  ) {
    // Check for existing email
    const existing = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await this.authService.hashPassword(data.password);

    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        role: data.role as any,
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

  async findById(id: string) {
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
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async assignSubjects(userId: string, subjectIds: string[], actorId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

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

  async update(
    id: string,
    data: { name?: string; role?: string },
    actorId: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.role && { role: data.role as any }),
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

  async deactivate(id: string, actorId: string) {
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
}
