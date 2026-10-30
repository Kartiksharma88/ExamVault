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
exports.ReviewController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const auth_guard_1 = require("../auth/auth.guard");
const review_service_1 = require("./review.service");
const shared_1 = require("@examvault/shared");
let ReviewController = class ReviewController {
    reviewService;
    constructor(reviewService) {
        this.reviewService = reviewService;
    }
    async getQueue(req) {
        const queue = await this.reviewService.getReviewerQueue(req.userId);
        return { success: true, data: queue };
    }
    async getAssignment(id, req) {
        const workspace = await this.reviewService.getAssignmentWorkspace(id, req.userId);
        return { success: true, data: workspace };
    }
    async submitBlindAnswer(id, body, req) {
        const parsed = shared_1.BlindAnswerSubmitSchema.parse(body);
        const result = await this.reviewService.submitBlindAnswer(id, parsed, req.userId);
        return { success: true, data: result };
    }
    async submitEvaluation(id, body, req) {
        if (body?.checklist) {
            const c = body.checklist;
            body.checklist = {
                contentAccuracy: Boolean(c.contentAccuracy ?? c.accuracy ?? true),
                singleDefensibleAnswer: Boolean(c.singleDefensibleAnswer ?? c.singleCorrectAnswer ?? true),
                clarityAndWording: Boolean(c.clarityAndWording ?? c.clarityWording ?? true),
                distractorPlausibility: Boolean(c.distractorPlausibility ?? c.plausibleDistractors ?? true),
                syllabusTopicAlignment: Boolean(c.syllabusTopicAlignment ?? c.syllabusAlignment ?? true),
                difficultyAppropriate: Boolean(c.difficultyAppropriate ?? true),
                languageEquivalence: Boolean(c.languageEquivalence ?? true),
                biasAndSensitivity: Boolean(c.biasAndSensitivity ?? c.fairnessNoBias ?? true),
                formattingMathRendering: Boolean(c.formattingMathRendering ?? c.formattingMathLatex ?? true),
            };
        }
        const parsed = shared_1.ReviewSubmitSchema.parse(body);
        const result = await this.reviewService.submitEvaluation(id, parsed, req.userId);
        return { success: true, data: result };
    }
    async assignReviewer(body, req) {
        const result = await this.reviewService.assignSingleReviewer(body.questionId, body.reviewerId, req.userId);
        return { success: true, data: result };
    }
};
exports.ReviewController = ReviewController;
__decorate([
    (0, common_1.Get)('queue'),
    (0, auth_guard_1.Roles)('REVIEWER', 'MODERATOR'),
    (0, swagger_1.ApiOperation)({ summary: 'Get reviewer queue of assigned questions (REVIEWER or MODERATOR)' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ReviewController.prototype, "getQueue", null);
__decorate([
    (0, common_1.Get)('assignments/:id'),
    (0, auth_guard_1.Roles)('REVIEWER', 'MODERATOR'),
    (0, swagger_1.ApiOperation)({ summary: 'Get review workspace — answer key withheld until blind answer saved' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ReviewController.prototype, "getAssignment", null);
__decorate([
    (0, common_1.Post)('assignments/:id/blind-answer'),
    (0, auth_guard_1.Roles)('REVIEWER', 'MODERATOR'),
    (0, swagger_1.ApiOperation)({ summary: 'Phase 1: Submit blind answer (unlocks evaluate phase)' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], ReviewController.prototype, "submitBlindAnswer", null);
__decorate([
    (0, common_1.Post)('assignments/:id/evaluate'),
    (0, auth_guard_1.Roles)('REVIEWER', 'MODERATOR'),
    (0, swagger_1.ApiOperation)({ summary: 'Phase 2: Submit evaluation with step-up MFA & Ed25519 signature' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], ReviewController.prototype, "submitEvaluation", null);
__decorate([
    (0, common_1.Post)('assignments'),
    (0, auth_guard_1.Roles)('ADMIN', 'MODERATOR'),
    (0, swagger_1.ApiOperation)({ summary: 'Admin/Moderator manually assigns a reviewer to a question' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ReviewController.prototype, "assignReviewer", null);
exports.ReviewController = ReviewController = __decorate([
    (0, swagger_1.ApiTags)('Review'),
    (0, common_1.Controller)('review'),
    __metadata("design:paramtypes", [review_service_1.ReviewService])
], ReviewController);
//# sourceMappingURL=review.controller.js.map