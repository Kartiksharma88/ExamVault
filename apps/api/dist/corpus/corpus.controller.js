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
exports.CorpusController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const auth_guard_1 = require("../auth/auth.guard");
const corpus_service_1 = require("./corpus.service");
const shared_1 = require("@examvault/shared");
let CorpusController = class CorpusController {
    corpusService;
    constructor(corpusService) {
        this.corpusService = corpusService;
    }
    async listSources() {
        const sources = await this.corpusService.listSources();
        return { success: true, data: sources };
    }
    async importCorpus(body, req) {
        const parsed = shared_1.CorpusImportSchema.parse(body);
        const result = await this.corpusService.importCorpus(parsed, req.userId);
        return { success: true, data: result };
    }
};
exports.CorpusController = CorpusController;
__decorate([
    (0, common_1.Get)('sources'),
    (0, auth_guard_1.Roles)('ADMIN', 'MODERATOR', 'AUDITOR'),
    (0, swagger_1.ApiOperation)({ summary: 'List all reference corpus sources' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CorpusController.prototype, "listSources", null);
__decorate([
    (0, common_1.Post)('import'),
    (0, auth_guard_1.Roles)('ADMIN'),
    (0, swagger_1.ApiOperation)({ summary: 'Import past papers or public corpus (ADMIN only)' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], CorpusController.prototype, "importCorpus", null);
exports.CorpusController = CorpusController = __decorate([
    (0, swagger_1.ApiTags)('Corpus'),
    (0, common_1.Controller)('corpus'),
    __metadata("design:paramtypes", [corpus_service_1.CorpusService])
], CorpusController);
//# sourceMappingURL=corpus.controller.js.map