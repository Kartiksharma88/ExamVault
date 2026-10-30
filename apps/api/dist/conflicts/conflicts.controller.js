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
exports.ConflictsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const auth_guard_1 = require("../auth/auth.guard");
const conflicts_service_1 = require("./conflicts.service");
const shared_1 = require("@examvault/shared");
let ConflictsController = class ConflictsController {
    conflictsService;
    constructor(conflictsService) {
        this.conflictsService = conflictsService;
    }
    async getMyConflicts(req) {
        const list = await this.conflictsService.listUserConflicts(req.userId);
        return { success: true, data: list };
    }
    async declareConflict(body, req) {
        const parsed = shared_1.ConflictDeclarationSchema.parse(body);
        const result = await this.conflictsService.declareConflict(parsed, req.userId);
        return { success: true, data: result };
    }
    async deleteConflict(id, req) {
        const result = await this.conflictsService.deleteConflict(id, req.userId);
        return { success: true, data: result };
    }
};
exports.ConflictsController = ConflictsController;
__decorate([
    (0, common_1.Get)(),
    (0, auth_guard_1.Roles)('EXAMINER', 'REVIEWER', 'MODERATOR'),
    (0, swagger_1.ApiOperation)({ summary: 'List current user conflict declarations' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ConflictsController.prototype, "getMyConflicts", null);
__decorate([
    (0, common_1.Post)(),
    (0, auth_guard_1.Roles)('EXAMINER', 'REVIEWER', 'MODERATOR'),
    (0, swagger_1.ApiOperation)({ summary: 'Declare a conflict of interest (institution, coaching centre, person)' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ConflictsController.prototype, "declareConflict", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, auth_guard_1.Roles)('EXAMINER', 'REVIEWER', 'MODERATOR'),
    (0, swagger_1.ApiOperation)({ summary: 'Delete a conflict of interest declaration' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ConflictsController.prototype, "deleteConflict", null);
exports.ConflictsController = ConflictsController = __decorate([
    (0, swagger_1.ApiTags)('Conflicts'),
    (0, common_1.Controller)('conflicts'),
    __metadata("design:paramtypes", [conflicts_service_1.ConflictsService])
], ConflictsController);
//# sourceMappingURL=conflicts.controller.js.map