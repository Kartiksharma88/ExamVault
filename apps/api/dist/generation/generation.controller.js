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
exports.GenerationController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const auth_guard_1 = require("../auth/auth.guard");
const generation_service_1 = require("./generation.service");
let GenerationController = class GenerationController {
    generationService;
    constructor(generationService) {
        this.generationService = generationService;
    }
    async getOverview() {
        return this.generationService.getBankOverview();
    }
    async getBankOverview() {
        return this.generationService.getBankOverview();
    }
    async checkReadiness(blueprintVersionId) {
        return this.generationService.checkReadiness(blueprintVersionId);
    }
    async getRequests() {
        return this.generationService.getRequests();
    }
    async proposeRequest(body, req) {
        return this.generationService.proposeGenerationRequest({
            ...body,
            proposerId: req.userId,
        });
    }
    async proposeRequestAlias(body, req) {
        return this.generationService.proposeGenerationRequest({
            ...body,
            proposerId: req.userId,
        });
    }
    async approveRequest(requestId, body, req) {
        return this.generationService.approveGenerationRequest({
            requestId,
            approverId: req.userId,
            mfaCode: body.mfaCode,
            decision: body.decision,
            reason: body.reason,
        });
    }
    async approveRequestApproval(requestId, body, req) {
        return this.generationService.approveGenerationRequest({
            requestId,
            approverId: req.userId,
            mfaCode: body.mfaCode,
            decision: body.decision,
            reason: body.reason,
        });
    }
    async generatePaper(requestId, body, req) {
        return this.generationService.generatePaper(requestId, req.userId, body?.forceImmediate);
    }
    async getPapers() {
        return this.generationService.getPapers();
    }
    async getPaper(paperId) {
        return this.generationService.getPaper(paperId);
    }
    async cancelPaper(paperId, body, req) {
        return this.generationService.cancelPaper(paperId, req.userId, body.reason);
    }
};
exports.GenerationController = GenerationController;
__decorate([
    (0, common_1.Get)('overview'),
    (0, auth_guard_1.Roles)('ADMIN'),
    (0, swagger_1.ApiOperation)({ summary: 'Bank Overview (Counts ONLY: Eligible, Pending Reviewer, Pending Moderator, Pending Examiner)' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], GenerationController.prototype, "getOverview", null);
__decorate([
    (0, common_1.Get)('bank-overview'),
    (0, auth_guard_1.Roles)('ADMIN'),
    (0, swagger_1.ApiOperation)({ summary: 'Bank Overview (Counts ONLY: Eligible, Pending Reviewer, Pending Moderator, Pending Examiner)' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], GenerationController.prototype, "getBankOverview", null);
__decorate([
    (0, common_1.Get)('readiness'),
    (0, auth_guard_1.Roles)('ADMIN'),
    (0, swagger_1.ApiOperation)({ summary: 'Blueprint readiness check (Numbers only)' }),
    __param(0, (0, common_1.Query)('blueprintVersionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], GenerationController.prototype, "checkReadiness", null);
__decorate([
    (0, common_1.Get)('requests'),
    (0, auth_guard_1.Roles)('ADMIN'),
    (0, swagger_1.ApiOperation)({ summary: 'List all paper generation requests' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], GenerationController.prototype, "getRequests", null);
__decorate([
    (0, common_1.Post)('requests'),
    (0, auth_guard_1.Roles)('ADMIN'),
    (0, swagger_1.ApiOperation)({ summary: 'Propose paper generation request (Admin 1)' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], GenerationController.prototype, "proposeRequest", null);
__decorate([
    (0, common_1.Post)('request'),
    (0, auth_guard_1.Roles)('ADMIN'),
    (0, swagger_1.ApiOperation)({ summary: 'Propose paper generation request alias (Admin 1)' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], GenerationController.prototype, "proposeRequestAlias", null);
__decorate([
    (0, common_1.Post)('requests/:id/approve'),
    (0, auth_guard_1.Roles)('ADMIN'),
    (0, swagger_1.ApiOperation)({ summary: 'Approve or reject paper generation request (Admin 2)' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], GenerationController.prototype, "approveRequest", null);
__decorate([
    (0, common_1.Post)('requests/:id/approval'),
    (0, auth_guard_1.Roles)('ADMIN'),
    (0, swagger_1.ApiOperation)({ summary: 'Approve or reject paper generation request alias (Admin 2)' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], GenerationController.prototype, "approveRequestApproval", null);
__decorate([
    (0, common_1.Post)('requests/:id/generate'),
    (0, auth_guard_1.Roles)('ADMIN'),
    (0, swagger_1.ApiOperation)({ summary: 'Trigger paper generation within execution window' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], GenerationController.prototype, "generatePaper", null);
__decorate([
    (0, common_1.Get)('papers'),
    (0, auth_guard_1.Roles)('ADMIN', 'AUDITOR', 'CUSTODIAN'),
    (0, swagger_1.ApiOperation)({ summary: 'List paper generations' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], GenerationController.prototype, "getPapers", null);
__decorate([
    (0, common_1.Get)('papers/:id'),
    (0, auth_guard_1.Roles)('ADMIN', 'AUDITOR', 'CUSTODIAN'),
    (0, swagger_1.ApiOperation)({ summary: 'Get paper status and public manifest (Counts only, zero question content)' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], GenerationController.prototype, "getPaper", null);
__decorate([
    (0, common_1.Post)('papers/:id/cancel'),
    (0, auth_guard_1.Roles)('ADMIN'),
    (0, swagger_1.ApiOperation)({ summary: 'Cancel paper generation or release (Dual-admin)' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], GenerationController.prototype, "cancelPaper", null);
exports.GenerationController = GenerationController = __decorate([
    (0, swagger_1.ApiTags)('Paper Generation Console'),
    (0, common_1.Controller)('generation'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __metadata("design:paramtypes", [generation_service_1.GenerationService])
], GenerationController);
//# sourceMappingURL=generation.controller.js.map