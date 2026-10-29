import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import { ServerSigningProvider } from '../crypto/server-signing-provider';
import {
  BlueprintSchema,
  validateBlueprintConsistency,
  Blueprint,
} from '@examvault/shared';
import { canonicalizeJson } from '@examvault/audit-canonical';

@Injectable()
export class BlueprintsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private auth: AuthService,
    private signingProvider: ServerSigningProvider,
  ) {}

  /**
   * Propose a new blueprint or a new version of an existing blueprint.
   */
  async proposeBlueprint(input: {
    examId: string;
    name: string;
    description?: string;
    blueprintId?: string;
    content: any;
    proposerId: string;
  }) {
    // 1. Validate structure with Zod schema
    const parseResult = BlueprintSchema.safeParse(input.content);
    if (!parseResult.success) {
      throw new BadRequestException(
        `Invalid blueprint schema: ${parseResult.error.issues.map((i: any) => i.message).join('; ')}`,
      );
    }
    const blueprintData = parseResult.data;

    // 2. Validate consistency (counts, marks, bin bounds)
    const consistencyErrors = validateBlueprintConsistency(blueprintData);
    if (consistencyErrors.length > 0) {
      throw new BadRequestException(`Blueprint consistency error: ${consistencyErrors.join('; ')}`);
    }

    // 3. Verify exam, subjects, and topics exist in database
    const exam = await this.prisma.exam.findUnique({
      where: { id: input.examId },
      include: { subjects: { include: { topics: true } } },
    });
    if (!exam) {
      throw new NotFoundException(`Exam ${input.examId} not found`);
    }

    const validSubjectIds = new Set(exam.subjects.map((s) => s.id));
    const validTopicIds = new Set(exam.subjects.flatMap((s) => s.topics.map((t) => t.id)));

    for (const sec of blueprintData.sections) {
      if (!validSubjectIds.has(sec.subjectId)) {
        throw new BadRequestException(`Section ${sec.code} references nonexistent subject ${sec.subjectId}`);
      }
      for (const tq of sec.topicQuotas) {
        if (!validTopicIds.has(tq.topicId)) {
          throw new BadRequestException(`Section ${sec.code} references nonexistent topic ${tq.topicId}`);
        }
      }
    }

    // 4. Compute canonical RFC 8785 version hash
    const canonicalContentStr = canonicalizeJson(blueprintData);
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
    } else {
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
        content: blueprintData as any,
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
  async approveBlueprint(input: {
    blueprintId: string;
    versionNo: number;
    approverId: string;
    mfaCode: string;
  }) {
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
      throw new NotFoundException(`Blueprint version not found`);
    }

    if (version.isApproved) {
      throw new ConflictException(`Blueprint version ${input.versionNo} is already approved and immutable`);
    }

    if (version.proposerId === input.approverId) {
      throw new ForbiddenException(
        `Dual-control violation: Proposer (${version.proposer.email}) cannot approve their own blueprint. A different administrator must approve.`,
      );
    }

    // Step-up MFA verification
    const isMfaValid = await this.auth.verifyStepUpTotp(input.approverId, input.mfaCode);
    if (!isMfaValid) {
      throw new ForbiddenException('Invalid or expired MFA code for approval');
    }

    // Sign canonical version hash
    const approverKey = await this.prisma.userSigningKey.findUnique({
      where: { userId: input.approverId },
    });
    if (!approverKey) {
      throw new BadRequestException('Approver does not have an enrolled signing key');
    }

    const approvalSignature = await this.signingProvider.signApproval(
      {
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
      },
      approverKey.wrappedPrivateKey,
      approverKey.keyId,
    );

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

  async getBlueprintVersions(blueprintId: string) {
    const versions = await this.prisma.blueprintVersion.findMany({
      where: { blueprintId },
      include: { proposer: { select: { id: true, name: true, email: true } }, approver: { select: { id: true, name: true, email: true } } },
      orderBy: { versionNo: 'desc' },
    });
    return versions;
  }

  async getBlueprintVersion(blueprintId: string, versionNo: number) {
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
      throw new NotFoundException(`Blueprint version not found`);
    }
    return version;
  }

  async listBlueprints(examId?: string) {
    const where: any = {};
    if (examId) where.examId = examId;
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
}
