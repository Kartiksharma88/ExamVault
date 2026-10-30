"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModerationModule = void 0;
const common_1 = require("@nestjs/common");
const moderation_service_1 = require("./moderation.service");
const moderation_controller_1 = require("./moderation.controller");
const prisma_module_1 = require("../prisma/prisma.module");
const crypto_module_1 = require("../crypto/crypto.module");
const audit_module_1 = require("../audit/audit.module");
const auth_module_1 = require("../auth/auth.module");
const server_signing_provider_1 = require("../crypto/server-signing-provider");
let ModerationModule = class ModerationModule {
};
exports.ModerationModule = ModerationModule;
exports.ModerationModule = ModerationModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, crypto_module_1.CryptoModule, audit_module_1.AuditModule, auth_module_1.AuthModule],
        controllers: [moderation_controller_1.ModerationController],
        providers: [moderation_service_1.ModerationService, server_signing_provider_1.ServerSigningProvider],
        exports: [moderation_service_1.ModerationService],
    })
], ModerationModule);
//# sourceMappingURL=moderation.module.js.map