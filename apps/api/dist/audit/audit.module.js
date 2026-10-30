"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditModule = void 0;
const common_1 = require("@nestjs/common");
const audit_service_1 = require("./audit.service");
const audit_controller_1 = require("./audit.controller");
const crypto_module_1 = require("../crypto/crypto.module");
const audit_dispatcher_service_1 = require("./audit-dispatcher.service");
const signed_log_sink_1 = require("./sinks/signed-log.sink");
const fabric_sink_1 = require("./sinks/fabric.sink");
const plain_log_sink_1 = require("./sinks/plain-log.sink");
const fabric_gateway_service_1 = require("./fabric/fabric-gateway.service");
const audit_outbox_worker_1 = require("./outbox/audit-outbox.worker");
const audit_reconciliation_service_1 = require("./reconciliation/audit-reconciliation.service");
const audit_checkpoint_service_1 = require("./checkpoints/audit-checkpoint.service");
const storage_integrity_service_1 = require("./storage/storage-integrity.service");
let AuditModule = class AuditModule {
};
exports.AuditModule = AuditModule;
exports.AuditModule = AuditModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [crypto_module_1.CryptoModule],
        controllers: [audit_controller_1.AuditController],
        providers: [
            audit_service_1.AuditService,
            audit_dispatcher_service_1.AuditDispatcherService,
            signed_log_sink_1.SignedLogSink,
            fabric_sink_1.FabricSink,
            plain_log_sink_1.PlainLogSink,
            fabric_gateway_service_1.FabricGatewayService,
            audit_outbox_worker_1.AuditOutboxWorker,
            audit_reconciliation_service_1.AuditReconciliationService,
            audit_checkpoint_service_1.AuditCheckpointService,
            storage_integrity_service_1.StorageIntegrityService,
        ],
        exports: [
            audit_service_1.AuditService,
            audit_dispatcher_service_1.AuditDispatcherService,
            signed_log_sink_1.SignedLogSink,
            fabric_sink_1.FabricSink,
            plain_log_sink_1.PlainLogSink,
            fabric_gateway_service_1.FabricGatewayService,
            audit_outbox_worker_1.AuditOutboxWorker,
            audit_reconciliation_service_1.AuditReconciliationService,
            audit_checkpoint_service_1.AuditCheckpointService,
            storage_integrity_service_1.StorageIntegrityService,
        ],
    })
], AuditModule);
//# sourceMappingURL=audit.module.js.map