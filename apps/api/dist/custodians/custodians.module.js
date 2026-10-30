"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustodiansModule = void 0;
const common_1 = require("@nestjs/common");
const custodians_controller_1 = require("./custodians.controller");
const custodians_service_1 = require("./custodians.service");
const prisma_module_1 = require("../prisma/prisma.module");
const audit_module_1 = require("../audit/audit.module");
const auth_module_1 = require("../auth/auth.module");
let CustodiansModule = class CustodiansModule {
};
exports.CustodiansModule = CustodiansModule;
exports.CustodiansModule = CustodiansModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, audit_module_1.AuditModule, auth_module_1.AuthModule],
        controllers: [custodians_controller_1.CustodiansController],
        providers: [custodians_service_1.CustodiansService],
        exports: [custodians_service_1.CustodiansService],
    })
], CustodiansModule);
//# sourceMappingURL=custodians.module.js.map