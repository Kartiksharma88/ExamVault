import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Role } from '@prisma/client';

@Injectable()
export class CustodiansService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  /**
   * Create a new custodian group (n >= 3, 2 <= k <= n).
   */
  async createGroup(input: {
    name: string;
    description?: string;
    n: number;
    k: number;
    custodianIds: string[];
    actorId: string;
  }) {
    const { name, description, n, k, custodianIds, actorId } = input;

    if (n < 3) {
      throw new BadRequestException(`Custodian group must have n >= 3 (got ${n})`);
    }
    if (k < 2 || k > n) {
      throw new BadRequestException(`Threshold k must satisfy 2 <= k <= n (got k=${k}, n=${n})`);
    }
    if (custodianIds.length !== n) {
      throw new BadRequestException(`Exactly ${n} custodian IDs must be provided (got ${custodianIds.length})`);
    }

    // Verify all custodian users have Role CUSTODIAN
    const custodians = await this.prisma.user.findMany({
      where: {
        id: { in: custodianIds },
        role: Role.CUSTODIAN,
      },
    });

    if (custodians.length !== n) {
      throw new BadRequestException(`All ${n} members must be registered users with role CUSTODIAN`);
    }

    // Check that ADMIN role cannot be in custodian group
    const adminCheck = await this.prisma.user.findFirst({
      where: {
        id: { in: custodianIds },
        role: Role.ADMIN,
      },
    });
    if (adminCheck) {
      throw new ForbiddenException('Separation of duties violation: ADMIN cannot hold CUSTODIAN role');
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
  async enrollKey(input: {
    userId: string;
    publicKey: string;
    fingerprint: string;
  }) {
    const { userId, publicKey, fingerprint } = input;

    // Check user has CUSTODIAN role
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user || user.role !== Role.CUSTODIAN) {
      throw new ForbiddenException('Only users with role CUSTODIAN may enroll keys');
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
  async getMyShares(custodianId: string) {
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
  async getAssignedPapers(custodianId: string) {
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
    const paperMap = new Map<string, any>();
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
}
