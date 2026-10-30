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
exports.ReleaseController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const auth_guard_1 = require("../auth/auth.guard");
const release_service_1 = require("./release.service");
let ReleaseController = class ReleaseController {
    releaseService;
    constructor(releaseService) {
        this.releaseService = releaseService;
    }
    async submitShare(body, req) {
        return this.releaseService.submitShare({
            paperId: body.paperId,
            custodianId: req.userId,
            artifactType: body.artifactType,
            sharePlaintext: body.sharePlaintext,
        });
    }
    async submitShareForPaper(paperId, body, req) {
        return this.releaseService.submitShare({
            paperId,
            custodianId: req.userId,
            artifactType: body.artifactType,
            sharePlaintext: body.sharePlaintext,
        });
    }
    async issueDownloadToken(paperId, body, req) {
        return this.releaseService.issueDownloadToken(paperId, req.userId, body.fileType || 'PAPER_CSV');
    }
    async downloadPaper(paperId, token, fileName, res) {
        const file = await this.releaseService.getDownloadFile(paperId, token, fileName);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        return res.send(file.content);
    }
    async wipePaper(paperId) {
        return this.releaseService.wipePaper(paperId);
    }
};
exports.ReleaseController = ReleaseController;
__decorate([
    (0, common_1.Post)('submit-share'),
    (0, auth_guard_1.Roles)('CUSTODIAN'),
    (0, swagger_1.ApiOperation)({ summary: 'Custodian submits unsealed plaintext key share (Time-Gated)' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ReleaseController.prototype, "submitShare", null);
__decorate([
    (0, common_1.Post)('papers/:id/shares'),
    (0, auth_guard_1.Roles)('CUSTODIAN'),
    (0, swagger_1.ApiOperation)({ summary: 'Custodian submits unsealed plaintext key share for a paper' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], ReleaseController.prototype, "submitShareForPaper", null);
__decorate([
    (0, common_1.Post)('papers/:id/download-token'),
    (0, auth_guard_1.Roles)('ADMIN'),
    (0, swagger_1.ApiOperation)({ summary: 'Issue one-time download token (Authorizing Admins only, while RELEASED)' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], ReleaseController.prototype, "issueDownloadToken", null);
__decorate([
    (0, common_1.Get)('papers/:id/download'),
    (0, auth_guard_1.Roles)('ADMIN'),
    (0, swagger_1.ApiOperation)({ summary: 'Stream released paper files using one-time token' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('token')),
    __param(2, (0, common_1.Query)('fileName')),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object]),
    __metadata("design:returntype", Promise)
], ReleaseController.prototype, "downloadPaper", null);
__decorate([
    (0, common_1.Post)('papers/:id/wipe'),
    (0, auth_guard_1.Roles)('ADMIN'),
    (0, swagger_1.ApiOperation)({ summary: 'Manually trigger retention wiping of plaintext paper cache' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ReleaseController.prototype, "wipePaper", null);
exports.ReleaseController = ReleaseController = __decorate([
    (0, swagger_1.ApiTags)('Release & Custodian Portal (Step 5)'),
    (0, common_1.Controller)('release'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __metadata("design:paramtypes", [release_service_1.ReleaseService])
], ReleaseController);
//# sourceMappingURL=release.controller.js.map