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
exports.OriginalityController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const auth_guard_1 = require("../auth/auth.guard");
const originality_service_1 = require("./originality.service");
const shared_1 = require("@examvault/shared");
let OriginalityController = class OriginalityController {
    originalityService;
    constructor(originalityService) {
        this.originalityService = originalityService;
    }
    async getHealth() {
        const health = await this.originalityService.checkHealth();
        return { success: true, data: health };
    }
    async getReport(versionId, req) {
        const report = await this.originalityService.getReport(versionId, req.userRole, req.userId);
        return { success: true, data: report };
    }
    async dispositionDuplicate(versionId, body, req) {
        const parsed = shared_1.DuplicateDispositionSchema.parse(body);
        const result = await this.originalityService.dispositionDuplicate(versionId, parsed, req.userId);
        return { success: true, data: result };
    }
    async syncIndex() {
        const result = await this.originalityService.syncBankIndex();
        return { success: true, data: result };
    }
    async triggerScreen(versionId) {
        const result = await this.originalityService.screenQuestion(versionId);
        return { success: true, data: result };
    }
};
exports.OriginalityController = OriginalityController;
__decorate([
    (0, common_1.Get)('health'),
    (0, auth_guard_1.Roles)('ADMIN', 'MODERATOR', 'AUDITOR', 'REVIEWER', 'EXAMINER'),
    (0, swagger_1.ApiOperation)({ summary: 'Get originality service status and metrics' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], OriginalityController.prototype, "getHealth", null);
__decorate([
    (0, common_1.Get)('reports/:versionId'),
    (0, auth_guard_1.Roles)('ADMIN', 'MODERATOR', 'EXAMINER', 'REVIEWER', 'AUDITOR'),
    (0, swagger_1.ApiOperation)({ summary: 'Get originality report with role-based masking' }),
    __param(0, (0, common_1.Param)('versionId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], OriginalityController.prototype, "getReport", null);
__decorate([
    (0, common_1.Post)('disposition/:versionId'),
    (0, auth_guard_1.Roles)('MODERATOR'),
    (0, swagger_1.ApiOperation)({ summary: 'Moderator disposition of a duplicate flag' }),
    __param(0, (0, common_1.Param)('versionId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], OriginalityController.prototype, "dispositionDuplicate", null);
__decorate([
    (0, common_1.Post)('index/sync'),
    (0, auth_guard_1.Roles)('ADMIN'),
    (0, swagger_1.ApiOperation)({ summary: 'Trigger sync of memory-only question bank index (ADMIN only)' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], OriginalityController.prototype, "syncIndex", null);
__decorate([
    (0, common_1.Post)('screen/:versionId'),
    (0, auth_guard_1.Roles)('ADMIN', 'MODERATOR'),
    (0, swagger_1.ApiOperation)({ summary: 'Manually trigger question screening' }),
    __param(0, (0, common_1.Param)('versionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], OriginalityController.prototype, "triggerScreen", null);
exports.OriginalityController = OriginalityController = __decorate([
    (0, swagger_1.ApiTags)('Originality'),
    (0, common_1.Controller)('originality'),
    __metadata("design:paramtypes", [originality_service_1.OriginalityService])
], OriginalityController);
//# sourceMappingURL=originality.controller.js.map