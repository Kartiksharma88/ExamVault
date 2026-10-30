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
exports.SyllabusController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const auth_guard_1 = require("../auth/auth.guard");
const syllabus_service_1 = require("./syllabus.service");
let SyllabusController = class SyllabusController {
    syllabusService;
    constructor(syllabusService) {
        this.syllabusService = syllabusService;
    }
    // ── Exams ──
    async createExam(body, req) {
        const exam = await this.syllabusService.createExam(body, req.userId);
        return { success: true, data: exam };
    }
    async getExams() {
        const exams = await this.syllabusService.getExams();
        return { success: true, data: exams };
    }
    async updateExam(id, body, req) {
        const exam = await this.syllabusService.updateExam(id, body, req.userId);
        return { success: true, data: exam };
    }
    async deleteExam(id, req) {
        await this.syllabusService.deleteExam(id, req.userId);
        return { success: true };
    }
    // ── Subjects ──
    async createSubject(body, req) {
        const subject = await this.syllabusService.createSubject(body, req.userId);
        return { success: true, data: subject };
    }
    async getSubjects(examId) {
        const subjects = await this.syllabusService.getSubjects(examId);
        return { success: true, data: subjects };
    }
    async updateSubject(id, body, req) {
        const subject = await this.syllabusService.updateSubject(id, body, req.userId);
        return { success: true, data: subject };
    }
    // ── Topics ──
    async createTopic(body, req) {
        const topic = await this.syllabusService.createTopic(body, req.userId);
        return { success: true, data: topic };
    }
    async getTopics(subjectId) {
        const topics = await this.syllabusService.getTopics(subjectId);
        return { success: true, data: topics };
    }
    async updateTopic(id, body, req) {
        const topic = await this.syllabusService.updateTopic(id, body, req.userId);
        return { success: true, data: topic };
    }
    // ── Subtopics ──
    async createSubtopic(body, req) {
        const subtopic = await this.syllabusService.createSubtopic(body, req.userId);
        return { success: true, data: subtopic };
    }
    async getSubtopics(topicId) {
        const subtopics = await this.syllabusService.getSubtopics(topicId);
        return { success: true, data: subtopics };
    }
    async updateSubtopic(id, body, req) {
        const subtopic = await this.syllabusService.updateSubtopic(id, body, req.userId);
        return { success: true, data: subtopic };
    }
};
exports.SyllabusController = SyllabusController;
__decorate([
    (0, common_1.Post)('exams'),
    (0, auth_guard_1.Roles)('ADMIN'),
    (0, swagger_1.ApiOperation)({ summary: 'Create exam (ADMIN only)' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SyllabusController.prototype, "createExam", null);
__decorate([
    (0, common_1.Get)('exams'),
    (0, swagger_1.ApiOperation)({ summary: 'List all exams with full syllabus tree' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SyllabusController.prototype, "getExams", null);
__decorate([
    (0, common_1.Patch)('exams/:id'),
    (0, auth_guard_1.Roles)('ADMIN'),
    (0, swagger_1.ApiOperation)({ summary: 'Update exam (ADMIN only)' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], SyllabusController.prototype, "updateExam", null);
__decorate([
    (0, common_1.Delete)('exams/:id'),
    (0, auth_guard_1.Roles)('ADMIN'),
    (0, swagger_1.ApiOperation)({ summary: 'Soft-delete exam (ADMIN only)' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], SyllabusController.prototype, "deleteExam", null);
__decorate([
    (0, common_1.Post)('subjects'),
    (0, auth_guard_1.Roles)('ADMIN'),
    (0, swagger_1.ApiOperation)({ summary: 'Create subject (ADMIN only)' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SyllabusController.prototype, "createSubject", null);
__decorate([
    (0, common_1.Get)('subjects'),
    (0, swagger_1.ApiOperation)({ summary: 'List subjects for an exam' }),
    __param(0, (0, common_1.Query)('examId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SyllabusController.prototype, "getSubjects", null);
__decorate([
    (0, common_1.Patch)('subjects/:id'),
    (0, auth_guard_1.Roles)('ADMIN'),
    (0, swagger_1.ApiOperation)({ summary: 'Update subject (ADMIN only)' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], SyllabusController.prototype, "updateSubject", null);
__decorate([
    (0, common_1.Post)('topics'),
    (0, auth_guard_1.Roles)('ADMIN'),
    (0, swagger_1.ApiOperation)({ summary: 'Create topic (ADMIN only)' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SyllabusController.prototype, "createTopic", null);
__decorate([
    (0, common_1.Get)('topics'),
    (0, swagger_1.ApiOperation)({ summary: 'List topics for a subject' }),
    __param(0, (0, common_1.Query)('subjectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SyllabusController.prototype, "getTopics", null);
__decorate([
    (0, common_1.Patch)('topics/:id'),
    (0, auth_guard_1.Roles)('ADMIN'),
    (0, swagger_1.ApiOperation)({ summary: 'Update topic (ADMIN only)' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], SyllabusController.prototype, "updateTopic", null);
__decorate([
    (0, common_1.Post)('subtopics'),
    (0, auth_guard_1.Roles)('ADMIN'),
    (0, swagger_1.ApiOperation)({ summary: 'Create subtopic (ADMIN only)' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SyllabusController.prototype, "createSubtopic", null);
__decorate([
    (0, common_1.Get)('subtopics'),
    (0, swagger_1.ApiOperation)({ summary: 'List subtopics for a topic' }),
    __param(0, (0, common_1.Query)('topicId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SyllabusController.prototype, "getSubtopics", null);
__decorate([
    (0, common_1.Patch)('subtopics/:id'),
    (0, auth_guard_1.Roles)('ADMIN'),
    (0, swagger_1.ApiOperation)({ summary: 'Update subtopic (ADMIN only)' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], SyllabusController.prototype, "updateSubtopic", null);
exports.SyllabusController = SyllabusController = __decorate([
    (0, swagger_1.ApiTags)('Syllabus'),
    (0, common_1.Controller)('syllabus'),
    __metadata("design:paramtypes", [syllabus_service_1.SyllabusService])
], SyllabusController);
//# sourceMappingURL=syllabus.controller.js.map