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
exports.BlueprintsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const auth_guard_1 = require("../auth/auth.guard");
const blueprints_service_1 = require("./blueprints.service");
const generation_service_1 = require("../generation/generation.service");
let BlueprintsController = class BlueprintsController {
    blueprintsService;
    generationService;
    constructor(blueprintsService, generationService) {
        this.blueprintsService = blueprintsService;
        this.generationService = generationService;
    }
    async checkReadiness(blueprintId) {
        return this.generationService.checkReadiness(blueprintId);
    }
    async proposeBlueprint(body, req) {
        return this.blueprintsService.proposeBlueprint({
            ...body,
            proposerId: req.userId,
        });
    }
    async approveBlueprint(blueprintId, body, req) {
        return this.blueprintsService.approveBlueprint({
            blueprintId,
            versionNo: body.versionNo,
            approverId: req.userId,
            mfaCode: body.mfaCode,
        });
    }
    async listBlueprints(examId) {
        return this.blueprintsService.listBlueprints(examId);
    }
    async getVersions(blueprintId) {
        return this.blueprintsService.getBlueprintVersions(blueprintId);
    }
    async getVersion(blueprintId, versionNo) {
        return this.blueprintsService.getBlueprintVersion(blueprintId, versionNo);
    }
};
exports.BlueprintsController = BlueprintsController;
__decorate([
    (0, common_1.Get)(':id/readiness'),
    (0, auth_guard_1.Roles)('ADMIN', 'AUDITOR'),
    (0, swagger_1.ApiOperation)({ summary: 'Blueprint readiness check (Numbers only)' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], BlueprintsController.prototype, "checkReadiness", null);
__decorate([
    (0, common_1.Post)(),
    (0, auth_guard_1.Roles)('ADMIN'),
    (0, swagger_1.ApiOperation)({ summary: 'Propose a new blueprint or version (Admin 1)' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], BlueprintsController.prototype, "proposeBlueprint", null);
__decorate([
    (0, common_1.Post)(':id/approve'),
    (0, auth_guard_1.Roles)('ADMIN'),
    (0, swagger_1.ApiOperation)({ summary: 'Approve blueprint version with step-up MFA (Admin 2)' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], BlueprintsController.prototype, "approveBlueprint", null);
__decorate([
    (0, common_1.Get)(),
    (0, auth_guard_1.Roles)('ADMIN', 'AUDITOR'),
    (0, swagger_1.ApiOperation)({ summary: 'List all blueprints' }),
    __param(0, (0, common_1.Query)('examId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], BlueprintsController.prototype, "listBlueprints", null);
__decorate([
    (0, common_1.Get)(':id/versions'),
    (0, auth_guard_1.Roles)('ADMIN', 'AUDITOR'),
    (0, swagger_1.ApiOperation)({ summary: 'List versions of a blueprint' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], BlueprintsController.prototype, "getVersions", null);
__decorate([
    (0, common_1.Get)(':id/versions/:versionNo'),
    (0, auth_guard_1.Roles)('ADMIN', 'AUDITOR'),
    (0, swagger_1.ApiOperation)({ summary: 'Get specific blueprint version' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('versionNo', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number]),
    __metadata("design:returntype", Promise)
], BlueprintsController.prototype, "getVersion", null);
exports.BlueprintsController = BlueprintsController = __decorate([
    (0, swagger_1.ApiTags)('Blueprints (Dual-Admin Control)'),
    (0, common_1.Controller)('blueprints'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __metadata("design:paramtypes", [blueprints_service_1.BlueprintsService,
        generation_service_1.GenerationService])
], BlueprintsController);
//# sourceMappingURL=blueprints.controller.js.map