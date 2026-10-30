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
exports.CustodiansController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const auth_guard_1 = require("../auth/auth.guard");
const custodians_service_1 = require("./custodians.service");
let CustodiansController = class CustodiansController {
    custodiansService;
    constructor(custodiansService) {
        this.custodiansService = custodiansService;
    }
    async createGroup(body, req) {
        return this.custodiansService.createGroup({
            ...body,
            actorId: req.userId,
        });
    }
    async enrollKey(body, req) {
        return this.custodiansService.enrollKey({
            userId: req.userId,
            publicKey: body.publicKey,
            fingerprint: body.fingerprint,
        });
    }
    async enrollKeyAlias(body, req) {
        return this.custodiansService.enrollKey({
            userId: req.userId,
            publicKey: body.publicKey,
            fingerprint: body.fingerprint,
        });
    }
    async listGroups() {
        return this.custodiansService.listGroups();
    }
    async getAssignedPapers(req) {
        return this.custodiansService.getAssignedPapers(req.userId);
    }
    async getMyShares(req) {
        return this.custodiansService.getMyShares(req.userId);
    }
};
exports.CustodiansController = CustodiansController;
__decorate([
    (0, common_1.Post)('groups'),
    (0, auth_guard_1.Roles)('ADMIN'),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new custodian group (Admin)' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], CustodiansController.prototype, "createGroup", null);
__decorate([
    (0, common_1.Post)('enroll'),
    (0, auth_guard_1.Roles)('CUSTODIAN'),
    (0, swagger_1.ApiOperation)({ summary: 'Enroll custodian browser-generated public key' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], CustodiansController.prototype, "enrollKey", null);
__decorate([
    (0, common_1.Post)('enroll-key'),
    (0, auth_guard_1.Roles)('CUSTODIAN'),
    (0, swagger_1.ApiOperation)({ summary: 'Enroll custodian browser-generated public key (alias)' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], CustodiansController.prototype, "enrollKeyAlias", null);
__decorate([
    (0, common_1.Get)('groups'),
    (0, auth_guard_1.Roles)('ADMIN'),
    (0, swagger_1.ApiOperation)({ summary: 'List custodian groups' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CustodiansController.prototype, "listGroups", null);
__decorate([
    (0, common_1.Get)('assigned-papers'),
    (0, auth_guard_1.Roles)('CUSTODIAN'),
    (0, swagger_1.ApiOperation)({ summary: 'Get papers assigned to authenticated custodian' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CustodiansController.prototype, "getAssignedPapers", null);
__decorate([
    (0, common_1.Get)('me/shares'),
    (0, auth_guard_1.Roles)('CUSTODIAN'),
    (0, swagger_1.ApiOperation)({ summary: 'Get key share records assigned to authenticated custodian' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CustodiansController.prototype, "getMyShares", null);
exports.CustodiansController = CustodiansController = __decorate([
    (0, swagger_1.ApiTags)('Custodians & Key Distribution'),
    (0, common_1.Controller)('custodians'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __metadata("design:paramtypes", [custodians_service_1.CustodiansService])
], CustodiansController);
//# sourceMappingURL=custodians.controller.js.map