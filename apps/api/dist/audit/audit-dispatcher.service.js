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
var AuditDispatcherService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditDispatcherService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const signed_log_sink_1 = require("./sinks/signed-log.sink");
const fabric_sink_1 = require("./sinks/fabric.sink");
const plain_log_sink_1 = require("./sinks/plain-log.sink");
let AuditDispatcherService = AuditDispatcherService_1 = class AuditDispatcherService {
    configService;
    signedLogSink;
    fabricSink;
    plainLogSink;
    logger = new common_1.Logger(AuditDispatcherService_1.name);
    sinks = new Map();
    enabledSinks = new Set();
    constructor(configService, signedLogSink, fabricSink, plainLogSink) {
        this.configService = configService;
        this.signedLogSink = signedLogSink;
        this.fabricSink = fabricSink;
        this.plainLogSink = plainLogSink;
        this.sinks.set('SIGNED_LOG', this.signedLogSink);
        this.sinks.set('FABRIC', this.fabricSink);
        this.sinks.set('PLAIN_LOG', this.plainLogSink);
        this.loadConfiguredSinks();
    }
    loadConfiguredSinks() {
        const rawConfig = this.configService.get('AUDIT_SINKS_ENABLED') || 'signed_log,fabric';
        const parsed = rawConfig
            .split(',')
            .map((s) => s.trim().toUpperCase())
            .filter(Boolean);
        this.enabledSinks.clear();
        for (const sinkName of parsed) {
            if (sinkName === 'SIGNED_LOG' || sinkName === 'FABRIC' || sinkName === 'PLAIN_LOG') {
                this.enabledSinks.add(sinkName);
            }
        }
        if (this.enabledSinks.size === 0) {
            this.enabledSinks.add('SIGNED_LOG');
        }
        this.logger.log(`Active audit sinks: ${Array.from(this.enabledSinks).join(', ')}`);
    }
    getActiveSinks() {
        return Array.from(this.enabledSinks);
    }
    setSinkEnabled(sinkType, enabled) {
        if (enabled) {
            this.enabledSinks.add(sinkType);
        }
        else {
            this.enabledSinks.delete(sinkType);
        }
        this.logger.log(`Updated active audit sinks: ${Array.from(this.enabledSinks).join(', ')}`);
    }
    async dispatch(event, options) {
        const receipts = {};
        for (const sinkType of this.enabledSinks) {
            const sink = this.sinks.get(sinkType);
            if (!sink)
                continue;
            try {
                const receipt = await sink.append(event, options?.tx);
                receipts[sinkType] = receipt;
            }
            catch (err) {
                this.logger.error(`Sink ${sinkType} failed to append event ${event.event_id}: ${err.message}`, err.stack);
            }
        }
        return receipts;
    }
    async verifyAll(eventId, expectedHash, targetSinks) {
        const results = {};
        const sinksToCheck = targetSinks && targetSinks.length > 0 ? targetSinks : Array.from(this.enabledSinks);
        for (const sinkType of sinksToCheck) {
            const sink = this.sinks.get(sinkType);
            if (!sink)
                continue;
            try {
                results[sinkType] = await sink.verify(eventId, expectedHash);
            }
            catch (err) {
                results[sinkType] = {
                    valid: false,
                    sinkType,
                    checkedAt: new Date().toISOString(),
                    details: { error: err.message },
                    discrepancy: `Verification query crashed on ${sinkType}: ${err.message}`,
                };
            }
        }
        return results;
    }
};
exports.AuditDispatcherService = AuditDispatcherService;
exports.AuditDispatcherService = AuditDispatcherService = AuditDispatcherService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        signed_log_sink_1.SignedLogSink,
        fabric_sink_1.FabricSink,
        plain_log_sink_1.PlainLogSink])
], AuditDispatcherService);
//# sourceMappingURL=audit-dispatcher.service.js.map