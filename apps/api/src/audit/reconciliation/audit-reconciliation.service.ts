import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FabricGatewayService } from '../fabric/fabric-gateway.service';

export interface ReconciliationReport {
  status: 'CLEAN' | 'DISCREPANCY_DETECTED';
  checkedAt: string;
  totalPostgresEvents: number;
  totalFabricAnchored: number;
  missingOnFabric: Array<{
    eventId: string;
    eventType: string;
    timestamp: string;
  }>;
  mismatchedHashes: Array<{
    eventId: string;
    postgresHash: string;
    fabricHash: string;
  }>;
}

@Injectable()
export class AuditReconciliationService {
  private readonly logger = new Logger(AuditReconciliationService.name);

  constructor(
    private prisma: PrismaService,
    private fabricGateway: FabricGatewayService,
  ) {}

  /**
   * Compares all Postgres audit events against Fabric ledger records
   */
  async runReconciliation(): Promise<ReconciliationReport> {
    const postgresEvents = await this.prisma.auditEvent.findMany({
      orderBy: { timestamp: 'asc' },
      select: {
        id: true,
        action: true,
        timestamp: true,
        payloadHash: true,
        entryHash: true,
      },
    });

    const missingOnFabric: Array<{
      eventId: string;
      eventType: string;
      timestamp: string;
    }> = [];

    const mismatchedHashes: Array<{
      eventId: string;
      postgresHash: string;
      fabricHash: string;
    }> = [];

    let totalFabricAnchored = 0;

    for (const event of postgresEvents) {
      const ledgerRecord = await this.fabricGateway.getEvent(event.id);
      if (!ledgerRecord) {
        missingOnFabric.push({
          eventId: event.id,
          eventType: event.action,
          timestamp: event.timestamp.toISOString(),
        });
      } else {
        totalFabricAnchored++;
        const expectedHash = event.payloadHash || event.entryHash;
        if (ledgerRecord.eventHash !== expectedHash) {
          mismatchedHashes.push({
            eventId: event.id,
            postgresHash: expectedHash,
            fabricHash: ledgerRecord.eventHash,
          });
        }
      }
    }

    const hasDiscrepancy = missingOnFabric.length > 0 || mismatchedHashes.length > 0;

    return {
      status: hasDiscrepancy ? 'DISCREPANCY_DETECTED' : 'CLEAN',
      checkedAt: new Date().toISOString(),
      totalPostgresEvents: postgresEvents.length,
      totalFabricAnchored,
      missingOnFabric,
      mismatchedHashes,
    };
  }
}
