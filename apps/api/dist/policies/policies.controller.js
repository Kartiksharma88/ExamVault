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
exports.PoliciesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const auth_guard_1 = require("../auth/auth.guard");
const policies_service_1 = require("./policies.service");
const shared_1 = require("@examvault/shared");
let PoliciesController = class PoliciesController {
    policiesService;
    constructor(policiesService) {
        this.policiesService = policiesService;
    }
    async listPolicies() {
        const policies = await this.policiesService.listPolicies();
        return { success: true, data: policies };
    }
    async getActivePolicy(subjectId, examId, questionType) {
        const policy = await this.policiesService.getActivePolicy(subjectId, examId, questionType);
        return { success: true, data: policy };
    }
    async proposePolicy(body, req) {
        const parsed = shared_1.ProposePolicySchema.parse(body);
        const result = await this.policiesService.proposePolicy(parsed, req.userId);
        return { success: true, data: result };
    }
    async approvePolicy(body, req) {
        const parsed = shared_1.ApprovePolicySchema.parse(body);
        const result = await this.policiesService.approvePolicy(parsed, req.userId);
        return { success: true, data: result };
    }
};
exports.PoliciesController = PoliciesController;
__decorate([
    (0, common_1.Get)(),
    (0, auth_guard_1.Roles)('ADMIN', 'MODERATOR', 'AUDITOR'),
    (0, swagger_1.ApiOperation)({ summary: 'List all approval policies (ADMIN/MODERATOR/AUDITOR)' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PoliciesController.prototype, "listPolicies", null);
__decorate([
    (0, common_1.Get)('active'),
    (0, auth_guard_1.Roles)('ADMIN', 'MODERATOR', 'REVIEWER', 'EXAMINER', 'AUDITOR'),
    (0, swagger_1.ApiOperation)({ summary: 'Get active policy for a subject or scope' }),
    (0, swagger_1.ApiQuery)({ name: 'subjectId', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'examId', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'questionType', required: false }),
    __param(0, (0, common_1.Query)('subjectId')),
    __param(1, (0, common_1.Query)('examId')),
    __param(2, (0, common_1.Query)('questionType')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], PoliciesController.prototype, "getActivePolicy", null);
__decorate([
    (0, common_1.Post)('propose'),
    (0, auth_guard_1.Roles)('ADMIN'),
    (0, swagger_1.ApiOperation)({ summary: 'Propose a new approval policy (ADMIN only)' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], PoliciesController.prototype, "proposePolicy", null);
__decorate([
    (0, common_1.Post)('approve'),
    (0, auth_guard_1.Roles)('ADMIN'),
    (0, swagger_1.ApiOperation)({ summary: 'Approve a proposed policy (Two-Person rule: ADMIN must differ from proposer)' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], PoliciesController.prototype, "approvePolicy", null);
exports.PoliciesController = PoliciesController = __decorate([
    (0, swagger_1.ApiTags)('Policies'),
    (0, common_1.Controller)('policies'),
    __metadata("design:paramtypes", [policies_service_1.PoliciesService])
], PoliciesController);
//# sourceMappingURL=policies.controller.js.map