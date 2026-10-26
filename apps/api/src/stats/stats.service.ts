import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StatsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get question bank statistics — metadata only, no content
   */
  async getBankStatistics() {
    const [
      totalQuestions,
      byStatus,
      bySubject,
      byType,
      byDifficulty,
    ] = await Promise.all([
      this.prisma.question.count(),

      // By status (from latest version)
      this.prisma.$queryRaw<{ status: string; count: bigint }[]>`
        SELECT qv.status, COUNT(*)::bigint as count
        FROM question_versions qv
        INNER JOIN (
          SELECT question_id, MAX(version_no) as max_version
          FROM question_versions
          GROUP BY question_id
        ) latest ON qv.question_id = latest.question_id AND qv.version_no = latest.max_version
        GROUP BY qv.status
      `,

      // By subject
      this.prisma.$queryRaw<{ subject_id: string; name: string; count: bigint }[]>`
        SELECT q.subject_id, s.name, COUNT(*)::bigint as count
        FROM questions q
        JOIN subjects s ON q.subject_id = s.id
        GROUP BY q.subject_id, s.name
        ORDER BY count DESC
      `,

      // By type
      this.prisma.$queryRaw<{ type: string; count: bigint }[]>`
        SELECT type, COUNT(*)::bigint as count
        FROM questions
        GROUP BY type
      `,

      // By difficulty bucket
      this.prisma.$queryRaw<{ bucket: string; count: bigint }[]>`
        SELECT
          CASE
            WHEN difficulty < 0.2 THEN 'Very Easy (0-0.2)'
            WHEN difficulty < 0.4 THEN 'Easy (0.2-0.4)'
            WHEN difficulty < 0.6 THEN 'Medium (0.4-0.6)'
            WHEN difficulty < 0.8 THEN 'Hard (0.6-0.8)'
            ELSE 'Very Hard (0.8-1.0)'
          END as bucket,
          COUNT(*)::bigint as count
        FROM questions
        GROUP BY bucket
        ORDER BY bucket
      `,
    ]);

    return {
      totalQuestions,
      byStatus: byStatus.reduce((acc, r) => {
        acc[r.status] = Number(r.count);
        return acc;
      }, {} as Record<string, number>),
      bySubject: bySubject.map((r) => ({
        subjectId: r.subject_id,
        subjectName: r.name,
        count: Number(r.count),
      })),
      byType: byType.reduce((acc, r) => {
        acc[r.type] = Number(r.count);
        return acc;
      }, {} as Record<string, number>),
      byDifficultyBucket: byDifficulty.map((r) => ({
        bucket: r.bucket,
        count: Number(r.count),
      })),
    };
  }
}
