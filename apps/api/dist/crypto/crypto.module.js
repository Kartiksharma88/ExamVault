"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CryptoModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const crypto_service_1 = require("./crypto.service");
const local_key_provider_1 = require("./local-key-provider");
const key_provider_interface_1 = require("./key-provider.interface");
const server_signing_provider_1 = require("./server-signing-provider");
const signing_provider_interface_1 = require("./signing-provider.interface");
let CryptoModule = class CryptoModule {
};
exports.CryptoModule = CryptoModule;
exports.CryptoModule = CryptoModule = __decorate([
    (0, common_1.Module)({
        imports: [config_1.ConfigModule],
        providers: [
            {
                provide: key_provider_interface_1.KEY_PROVIDER,
                useClass: local_key_provider_1.LocalKeyProvider,
            },
            {
                provide: signing_provider_interface_1.SIGNING_PROVIDER,
                useClass: server_signing_provider_1.ServerSigningProvider,
            },
            server_signing_provider_1.ServerSigningProvider,
            crypto_service_1.CryptoService,
        ],
        exports: [crypto_service_1.CryptoService, key_provider_interface_1.KEY_PROVIDER, signing_provider_interface_1.SIGNING_PROVIDER, server_signing_provider_1.ServerSigningProvider],
    })
], CryptoModule);
//# sourceMappingURL=crypto.module.js.map