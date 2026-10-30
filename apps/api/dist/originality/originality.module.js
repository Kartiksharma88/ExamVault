"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OriginalityModule = void 0;
const common_1 = require("@nestjs/common");
const originality_service_1 = require("./originality.service");
const originality_controller_1 = require("./originality.controller");
const screening_queue_1 = require("./screening.queue");
const prisma_module_1 = require("../prisma/prisma.module");
const crypto_module_1 = require("../crypto/crypto.module");
const audit_module_1 = require("../audit/audit.module");
const policies_module_1 = require("../policies/policies.module");
const review_module_1 = require("../review/review.module");
let OriginalityModule = class OriginalityModule {
};
exports.OriginalityModule = OriginalityModule;
exports.OriginalityModule = OriginalityModule = __decorate([
    (0, common_1.Module)({
        imports: [
            prisma_module_1.PrismaModule,
            crypto_module_1.CryptoModule,
            audit_module_1.AuditModule,
            policies_module_1.PoliciesModule,
            (0, common_1.forwardRef)(() => review_module_1.ReviewModule),
        ],
        controllers: [originality_controller_1.OriginalityController],
        providers: [originality_service_1.OriginalityService, screening_queue_1.ScreeningQueue],
        exports: [originality_service_1.OriginalityService, screening_queue_1.ScreeningQueue],
    })
], OriginalityModule);
//# sourceMappingURL=originality.module.js.map