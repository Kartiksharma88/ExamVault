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
exports.ModerationController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const auth_guard_1 = require("../auth/auth.guard");
const moderation_service_1 = require("./moderation.service");
const shared_1 = require("@examvault/shared");
function parseOrBadRequest(schema, data) {
    try {
        return schema.parse(data);
    }
    catch (err) {
        if (err.name === 'ZodError' && Array.isArray(err.errors)) {
            const msg = err.errors.map((e) => `${e.path.join('.') || 'payload'}: ${e.message}`).join('; ');
            throw new common_1.BadRequestException(`Validation error: ${msg}`);
        }
        throw new common_1.BadRequestException(err.message || 'Invalid request payload');
    }
}
let ModerationController = class ModerationController {
    moderationService;
    constructor(moderationService) {
        this.moderationService = moderationService;
    }
    async getQueue(req) {
        const queue = await this.moderationService.getModeratorQueue(req.userId);
        return { success: true, data: queue };
    }
    async getDuplicates() {
        const queue = await this.moderationService.getModeratorQueue();
        return { success: true, data: queue.duplicateFlags };
    }
    async resolveDisagreement(reviewId, resolutionNote, decision, req) {
        const result = await this.moderationService.resolveDisagreement(reviewId, resolutionNote || 'Resolved by moderator', req.userId, decision || 'LET_STAND');
        return { success: true, data: result };
    }
    async submitDecision(versionId, body, req) {
        const parsed = parseOrBadRequest(shared_1.ModeratorDecisionSchema, body);
        const result = await this.moderationService.submitDecision(versionId, parsed, req.userId);
        return { success: true, data: result };
    }
    async reassignReviewer(body, req) {
        const parsed = parseOrBadRequest(shared_1.ReassignReviewerSchema, body);
        const result = await this.moderationService.reassignReviewer(parsed, req.userId);
        return { success: true, data: result };
    }
    async retireQuestion(versionId, body, req) {
        const parsed = parseOrBadRequest(shared_1.RetireQuestionSchema, body);
        const result = await this.moderationService.retireQuestion(versionId, parsed, req.userId);
        return { success: true, data: result };
    }
    async resolveDifficultyConflict(versionId, body, req) {
        const parsed = parseOrBadRequest(shared_1.ResolveDifficultyConflictSchema, body);
        const result = await this.moderationService.resolveDifficultyConflict(versionId, parsed, req.userId);
        return { success: true, data: result };
    }
};
exports.ModerationController = ModerationController;
__decorate([
    (0, common_1.Get)('queue'),
    (0, auth_guard_1.Roles)('MODERATOR', 'ADMIN'),
    (0, swagger_1.ApiOperation)({ summary: 'Get unified moderator console queues' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ModerationController.prototype, "getQueue", null);
__decorate([
    (0, common_1.Get)('duplicates'),
    (0, auth_guard_1.Roles)('MODERATOR', 'ADMIN'),
    (0, swagger_1.ApiOperation)({ summary: 'Get duplicate flagged question versions' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ModerationController.prototype, "getDuplicates", null);
__decorate([
    (0, common_1.Post)('disagreement/:reviewId/resolve'),
    (0, auth_guard_1.Roles)('MODERATOR'),
    (0, swagger_1.ApiOperation)({ summary: 'Resolve a blind-solve answer key disagreement' }),
    __param(0, (0, common_1.Param)('reviewId')),
    __param(1, (0, common_1.Body)('resolutionNote')),
    __param(2, (0, common_1.Body)('decision')),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object]),
    __metadata("design:returntype", Promise)
], ModerationController.prototype, "resolveDisagreement", null);
__decorate([
    (0, common_1.Post)('decision/:versionId'),
    (0, auth_guard_1.Roles)('MODERATOR'),
    (0, swagger_1.ApiOperation)({ summary: 'Submit moderator decision with step-up MFA & Ed25519 signature' }),
    __param(0, (0, common_1.Param)('versionId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], ModerationController.prototype, "submitDecision", null);
__decorate([
    (0, common_1.Post)('reassign'),
    (0, auth_guard_1.Roles)('MODERATOR'),
    (0, swagger_1.ApiOperation)({ summary: 'Reassign an overdue assignment to a new reviewer' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ModerationController.prototype, "reassignReviewer", null);
__decorate([
    (0, common_1.Post)('retire/:versionId'),
    (0, auth_guard_1.Roles)('MODERATOR'),
    (0, swagger_1.ApiOperation)({ summary: 'Retire an approved question version' }),
    __param(0, (0, common_1.Param)('versionId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], ModerationController.prototype, "retireQuestion", null);
__decorate([
    (0, common_1.Post)('difficulty-conflict/:versionId/resolve'),
    (0, auth_guard_1.Roles)('MODERATOR'),
    (0, swagger_1.ApiOperation)({ summary: 'Resolve a reviewer difficulty rating conflict' }),
    __param(0, (0, common_1.Param)('versionId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], ModerationController.prototype, "resolveDifficultyConflict", null);
exports.ModerationController = ModerationController = __decorate([
    (0, swagger_1.ApiTags)('Moderation'),
    (0, common_1.Controller)('moderation'),
    __metadata("design:paramtypes", [moderation_service_1.ModerationService])
], ModerationController);
//# sourceMappingURL=moderation.controller.js.map