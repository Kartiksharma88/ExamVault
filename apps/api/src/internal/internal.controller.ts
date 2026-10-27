import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { Public, SkipCsrf } from '../auth/auth.guard';

@ApiTags('Internal (Step 4 Generation Feed)')
@Controller('internal')
export class InternalController {
  constructor(private prisma: PrismaService) {}

  @Get('eligible-questions')
  @Public() // Internal network service-to-service endpoint (zero content exposed)
  @SkipCsrf()
  @ApiOperation({
    summary:
      'Step 4 Paper Generation Feed: Metadata-only list of verified, eligible questions (ZERO content)',
  })
  @ApiQuery({ name: 'subjectId', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getEligibleQuestions(
    @Query('subjectId') subjectId?: string,
    @Query('limit') limit?: string,
  ) {
    const take = limit ? Math.min(parseInt(limit, 10), 500) : 100;

    // Query database view eligible_question_versions
    let query = `
      SELECT
        version_id AS "versionId",
        question_id AS "questionId",
        human_id AS "humanId",
        version_no AS "versionNo",
        subject_id AS "subjectId",
        topic_id AS "topicId",
        type,
        difficulty,
        marks,
        negative_marks AS "negativeMarks",
        content_commitment AS "contentCommitment",
        approved_at AS "approvedAt"
      FROM "eligible_question_versions"
    `;

    const params: any[] = [];
    if (subjectId) {
      query += ` WHERE subject_id = $1::uuid`;
      params.push(subjectId);
    }
    query += ` ORDER BY approved_at DESC LIMIT ${take}`;

    const items: any[] = params.length > 0
      ? await this.prisma.$queryRawUnsafe(query, ...params)
      : await this.prisma.$queryRawUnsafe(query);

    return {
      success: true,
      count: items.length,
      data: items,
      guarantee: 'Zero content leaked: Only cryptographic commitments and generation metadata returned.',
    };
  }
}
