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
exports.QuestionsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const auth_guard_1 = require("../auth/auth.guard");
const questions_service_1 = require("./questions.service");
let QuestionsController = class QuestionsController {
    questionsService;
    constructor(questionsService) {
        this.questionsService = questionsService;
    }
    async create(body, req) {
        const result = await this.questionsService.create(body, req.userId);
        return { success: true, data: result };
    }
    async update(id, body, req) {
        const result = await this.questionsService.update(id, body, req.userId);
        return { success: true, data: result };
    }
    async submit(id, req) {
        const result = await this.questionsService.submit(id, req.userId);
        return { success: true, data: result };
    }
    async withdraw(id, req) {
        const result = await this.questionsService.withdraw(id, req.userId);
        return { success: true, data: result };
    }
    async toggleWorkflowLock(id, body, req) {
        const result = await this.questionsService.toggleLock(id, body.isLocked, body.reason, req.userId);
        return { success: true, data: result };
    }
    async findAll(req, subjectId, status, type, page, limit) {
        const result = await this.questionsService.findAll(req.userId, req.userRole, {
            subjectId,
            status,
            type,
            page: page ? parseInt(page, 10) : 1,
            limit: limit ? parseInt(limit, 10) : 20,
        });
        return { success: true, data: result };
    }
    async getContent(id, req, version) {
        const result = await this.questionsService.getContent(id, req.userId, req.userRole, version ? parseInt(version, 10) : undefined);
        return { success: true, data: result };
    }
    async getVersionHistory(id, req) {
        const result = await this.questionsService.getVersionHistory(id, req.userId, req.userRole);
        return { success: true, data: result.versions };
    }
    async getFeedback(id, req) {
        const result = await this.questionsService.getAuthorFeedback(id, req.userId);
        return { success: true, data: result };
    }
    async createNewVersion(body, req) {
        const result = await this.questionsService.createNewVersion(body, req.userId);
        return { success: true, data: result };
    }
};
exports.QuestionsController = QuestionsController;
__decorate([
    (0, common_1.Post)(),
    (0, auth_guard_1.Roles)('EXAMINER'),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new question (EXAMINER only)' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], QuestionsController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, auth_guard_1.Roles)('EXAMINER'),
    (0, swagger_1.ApiOperation)({ summary: 'Update a question — creates new version if submitted (EXAMINER only)' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], QuestionsController.prototype, "update", null);
__decorate([
    (0, common_1.Patch)(':id/submit'),
    (0, auth_guard_1.Roles)('EXAMINER'),
    (0, swagger_1.ApiOperation)({ summary: 'Submit a question (EXAMINER only)' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], QuestionsController.prototype, "submit", null);
__decorate([
    (0, common_1.Patch)(':id/withdraw'),
    (0, auth_guard_1.Roles)('EXAMINER'),
    (0, swagger_1.ApiOperation)({ summary: 'Withdraw a submitted question (EXAMINER only)' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], QuestionsController.prototype, "withdraw", null);
__decorate([
    (0, common_1.Patch)(':id/workflow-lock'),
    (0, auth_guard_1.Roles)('ADMIN'),
    (0, swagger_1.ApiOperation)({ summary: 'Lock or unlock a question workflow (ADMIN only)' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], QuestionsController.prototype, "toggleWorkflowLock", null);
__decorate([
    (0, common_1.Get)(),
    (0, auth_guard_1.Roles)('EXAMINER', 'REVIEWER', 'MODERATOR', 'ADMIN', 'AUDITOR'),
    (0, swagger_1.ApiOperation)({ summary: 'List questions — metadata only, filtered by role' }),
    (0, swagger_1.ApiQuery)({ name: 'subjectId', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'status', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'type', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('subjectId')),
    __param(2, (0, common_1.Query)('status')),
    __param(3, (0, common_1.Query)('type')),
    __param(4, (0, common_1.Query)('page')),
    __param(5, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], QuestionsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id/content'),
    (0, auth_guard_1.Roles)('EXAMINER', 'REVIEWER', 'MODERATOR'),
    (0, swagger_1.ApiOperation)({ summary: 'Get decrypted question content — ADMIN and AUDITOR get 403' }),
    (0, swagger_1.ApiQuery)({ name: 'version', required: false, type: Number }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Query)('version')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], QuestionsController.prototype, "getContent", null);
__decorate([
    (0, common_1.Get)(':id/versions'),
    (0, auth_guard_1.Roles)('EXAMINER', 'REVIEWER', 'MODERATOR'),
    (0, swagger_1.ApiOperation)({ summary: 'Get version history for a question' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], QuestionsController.prototype, "getVersionHistory", null);
__decorate([
    (0, common_1.Get)(':id/feedback'),
    (0, auth_guard_1.Roles)('EXAMINER'),
    (0, swagger_1.ApiOperation)({ summary: 'Get anonymized reviewer feedback for an author' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], QuestionsController.prototype, "getFeedback", null);
__decorate([
    (0, common_1.Post)('new-version'),
    (0, auth_guard_1.Roles)('EXAMINER'),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new draft version from an approved or changes-requested question' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], QuestionsController.prototype, "createNewVersion", null);
exports.QuestionsController = QuestionsController = __decorate([
    (0, swagger_1.ApiTags)('Questions'),
    (0, common_1.Controller)('questions'),
    __metadata("design:paramtypes", [questions_service_1.QuestionsService])
], QuestionsController);
//# sourceMappingURL=questions.controller.js.map