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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InternalController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const prisma_service_1 = require("../prisma/prisma.service");
const auth_guard_1 = require("../auth/auth.guard");
let InternalController = class InternalController {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getEligibleQuestions(subjectId, limit) {
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
        const params = [];
        if (subjectId) {
            query += ` WHERE subject_id = $1::uuid`;
            params.push(subjectId);
        }
        query += ` ORDER BY approved_at DESC LIMIT ${take}`;
        const items = params.length > 0
            ? await this.prisma.$queryRawUnsafe(query, ...params)
            : await this.prisma.$queryRawUnsafe(query);
        return {
            success: true,
            count: items.length,
            data: items,
            guarantee: 'Zero content leaked: Only cryptographic commitments and generation metadata returned.',
        };
    }
};
exports.InternalController = InternalController;
__decorate([
    (0, common_1.Get)('eligible-questions'),
    (0, auth_guard_1.Public)() // Internal network service-to-service endpoint (zero content exposed)
    ,
    (0, auth_guard_1.SkipCsrf)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Step 4 Paper Generation Feed: Metadata-only list of verified, eligible questions (ZERO content)',
    }),
    (0, swagger_1.ApiQuery)({ name: 'subjectId', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    __param(0, (0, common_1.Query)('subjectId')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], InternalController.prototype, "getEligibleQuestions", null);
exports.InternalController = InternalController = __decorate([
    (0, swagger_1.ApiTags)('Internal (Step 4 Generation Feed)'),
    (0, common_1.Controller)('internal'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], InternalController);
//# sourceMappingURL=internal.controller.js.map