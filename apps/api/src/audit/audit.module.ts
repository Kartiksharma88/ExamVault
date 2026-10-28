import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { CryptoModule } from '../crypto/crypto.module';
import { AuditDispatcherService } from './audit-dispatcher.service';
import { SignedLogSink } from './sinks/signed-log.sink';
import { FabricSink } from './sinks/fabric.sink';
import { PlainLogSink } from './sinks/plain-log.sink';
import { FabricGatewayService } from './fabric/fabric-gateway.service';

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
  ],
  exports: [
    AuditService,
    AuditDispatcherService,
    SignedLogSink,
    FabricSink,
    PlainLogSink,
    FabricGatewayService,
  ],
})
export class AuditModule {}
