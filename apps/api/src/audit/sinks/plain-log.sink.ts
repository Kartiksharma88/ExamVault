import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CanonicalAuditEvent } from '@examvault/audit-canonical';
import { AuditSink, AuditReceipt, AuditVerifyResult, SinkType } from './audit-sink.interface';

@Injectable()
export class PlainLogSink implements AuditSink {
  public readonly sinkType: SinkType = 'PLAIN_LOG';

  constructor(private prisma: PrismaService) {}

  async append(event: CanonicalAuditEvent, tx?: any): Promise<AuditReceipt> {
    const client = tx || this.prisma;
    const created = await client.plainAuditLog.create({
      data: {
        id: event.event_id,
        timestamp: new Date(event.timestamp),
        eventType: event.event_type,
        subjectType: event.subject_type,
        subjectId: event.subject_id,
        payload: event as any,
      },
    });

    return {
      sinkType: 'PLAIN_LOG',
      receiptId: created.id,
      timestamp: created.timestamp.toISOString(),
    };
  }

  async verify(eventId: string): Promise<AuditVerifyResult> {
    const record = await this.prisma.plainAuditLog.findUnique({
      where: { id: eventId },
    });

    if (!record) {
      return {
        valid: false,
        sinkType: 'PLAIN_LOG',
        checkedAt: new Date().toISOString(),
        details: {},
        discrepancy: `Plain log record ${eventId} not found`,
      };
    }

    return {
      valid: true,
      sinkType: 'PLAIN_LOG',
      checkedAt: new Date().toISOString(),
      details: {
        note: 'Baseline unchained, unsigned log — cannot detect database tampering',
      },
    };
  }
}
