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
exports.StatsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let StatsService = class StatsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    /**
     * Get question bank statistics — metadata only, no content
     */
    async getBankStatistics() {
        const [totalQuestions, byStatus, bySubject, byType, byDifficulty,] = await Promise.all([
            this.prisma.question.count(),
            // By status (from latest version)
            this.prisma.$queryRaw `
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
            this.prisma.$queryRaw `
        SELECT q.subject_id, s.name, COUNT(*)::bigint as count
        FROM questions q
        JOIN subjects s ON q.subject_id = s.id
        GROUP BY q.subject_id, s.name
        ORDER BY count DESC
      `,
            // By type
            this.prisma.$queryRaw `
        SELECT type, COUNT(*)::bigint as count
        FROM questions
        GROUP BY type
      `,
            // By difficulty bucket
            this.prisma.$queryRaw `
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
            }, {}),
            bySubject: bySubject.map((r) => ({
                subjectId: r.subject_id,
                subjectName: r.name,
                count: Number(r.count),
            })),
            byType: byType.reduce((acc, r) => {
                acc[r.type] = Number(r.count);
                return acc;
            }, {}),
            byDifficultyBucket: byDifficulty.map((r) => ({
                bucket: r.bucket,
                count: Number(r.count),
            })),
        };
    }
};
exports.StatsService = StatsService;
exports.StatsService = StatsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], StatsService);
//# sourceMappingURL=stats.service.js.map