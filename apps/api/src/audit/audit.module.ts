import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { CryptoModule } from '../crypto/crypto.module';
import { AuditDispatcherService } from './audit-dispatcher.service';
import { SignedLogSink } from './sinks/signed-log.sink';
import { FabricSink } from './sinks/fabric.sink';
import { PlainLogSink } from './sinks/plain-log.sink';
import { FabricGatewayService } from './fabric/fabric-gateway.service';
import { AuditOutboxWorker } from './outbox/audit-outbox.worker';
import { AuditReconciliationService } from './reconciliation/audit-reconciliation.service';
import { AuditCheckpointService } from './checkpoints/audit-checkpoint.service';

@Global()
@Module({
  imports: [CryptoModule],
  controllers: [AuditController],
  providers: [
    AuditService,
    AuditDispatcherService,
    SignedLogSink,
    FabricSink,
    PlainLogSink,
    FabricGatewayService,
    AuditOutboxWorker,
    AuditReconciliationService,
    AuditCheckpointService,
  ],
  exports: [
    AuditService,
    AuditDispatcherService,
    SignedLogSink,
    FabricSink,
    PlainLogSink,
    FabricGatewayService,
    AuditOutboxWorker,
    AuditReconciliationService,
    AuditCheckpointService,
  ],
})
export class AuditModule {}
