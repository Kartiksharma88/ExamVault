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
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const auth_guard_1 = require("../auth/auth.guard");
const stats_service_1 = require("./stats.service");
let StatsController = class StatsController {
    statsService;
    constructor(statsService) {
        this.statsService = statsService;
    }
    async getStatistics() {
        const stats = await this.statsService.getBankStatistics();
        return { success: true, data: stats };
    }
    async getBankStatistics() {
        const stats = await this.statsService.getBankStatistics();
        return { success: true, data: stats };
    }
};
exports.StatsController = StatsController;
__decorate([
    (0, common_1.Get)(),
    (0, auth_guard_1.SkipCsrf)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get question bank statistics (metadata only)' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], StatsController.prototype, "getStatistics", null);
__decorate([
    (0, common_1.Get)('bank'),
    (0, auth_guard_1.SkipCsrf)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get question bank statistics (metadata only)' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], StatsController.prototype, "getBankStatistics", null);
exports.StatsController = StatsController = __decorate([
    (0, swagger_1.ApiTags)('Statistics'),
    (0, common_1.Controller)('stats'),
    __metadata("design:paramtypes", [stats_service_1.StatsService])
], StatsController);
//# sourceMappingURL=stats.controller.js.map