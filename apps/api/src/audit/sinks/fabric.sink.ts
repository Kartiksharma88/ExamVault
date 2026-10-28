import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CanonicalAuditEvent } from '@examvault/audit-canonical';
import { AuditSink, AuditReceipt, AuditVerifyResult, SinkType } from './audit-sink.interface';
import { FabricGatewayService } from '../fabric/fabric-gateway.service';

@Injectable()
export class FabricSink implements AuditSink {
  public readonly sinkType: SinkType = 'FABRIC';
  private readonly logger = new Logger(FabricSink.name);

  constructor(
    private prisma: PrismaService,
    @Optional() private fabricGateway?: FabricGatewayService,
  ) {}

  async append(event: CanonicalAuditEvent, tx?: any): Promise<AuditReceipt> {
    const client = tx || this.prisma;

    const outbox = await client.auditOutbox.create({
      data: {
        eventId: event.event_id,
        sinkType: 'FABRIC',
        status: 'PENDING',
        payload: event as any,
        retryCount: 0,
      },
    });

    return {
      sinkType: 'FABRIC',
      receiptId: outbox.id,
      timestamp: new Date().toISOString(),
      details: {
        outboxId: outbox.id,
        status: 'QUEUED_FOR_ANCHORING',
      },
    };
  }

  async verify(eventId: string, expectedHash?: string): Promise<AuditVerifyResult> {
    if (!this.fabricGateway || !this.fabricGateway.isConnected()) {
      const outbox = await this.prisma.auditOutbox.findFirst({
        where: { eventId, sinkType: 'FABRIC' },
      });

      return {
        valid: outbox?.status === 'COMMITTED',
        sinkType: 'FABRIC',
        checkedAt: new Date().toISOString(),
        details: {
          outboxStatus: outbox?.status || 'NOT_FOUND',
          fabricTxId: outbox?.fabricTxId,
          fabricBlockNo: outbox?.fabricBlockNo ? outbox.fabricBlockNo.toString() : null,
          gatewayConnected: false,
          note: 'Fabric peer gateway disconnected or simulated. Verifying against recorded outbox commit status.',
        },
        discrepancy:
          outbox?.status === 'COMMITTED'
            ? undefined
            : `Event ${eventId} is ${outbox?.status || 'missing from outbox'} on Fabric`,
      };
    }

    try {
      const ledgerRecord = await this.fabricGateway.getEvent(eventId);
      if (!ledgerRecord) {
        return {
          valid: false,
          sinkType: 'FABRIC',
          checkedAt: new Date().toISOString(),
          details: { gatewayConnected: true },
          discrepancy: `Event ${eventId} not found on Fabric ledger`,
        };
      }

      if (expectedHash && ledgerRecord.eventHash !== expectedHash) {
        return {
          valid: false,
          sinkType: 'FABRIC',
          checkedAt: new Date().toISOString(),
          details: {
            storedLedgerHash: ledgerRecord.eventHash,
            expectedHash,
            txId: ledgerRecord.txId,
          },
          discrepancy: `Ledger hash mismatch: expected ${expectedHash}, found ${ledgerRecord.eventHash}`,
        };
      }

      return {
        valid: true,
        sinkType: 'FABRIC',
        checkedAt: new Date().toISOString(),
        details: {
          ledgerRecord,
          txId: ledgerRecord.txId,
          blockNumber: ledgerRecord.blockNumber,
          registeredByMSP: ledgerRecord.registeredByMSP,
          endorsements: ledgerRecord.endorsements,
        },
      };
    } catch (err: any) {
      return {
        valid: false,
        sinkType: 'FABRIC',
        checkedAt: new Date().toISOString(),
        details: { error: err.message },
        discrepancy: `Fabric verification query failed: ${err.message}`,
      };
    }
  }
}
