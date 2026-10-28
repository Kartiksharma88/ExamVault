import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CanonicalAuditEvent } from '@examvault/audit-canonical';
import { AuditSink, AuditReceipt, AuditVerifyResult, SinkType } from './sinks/audit-sink.interface';
import { SignedLogSink } from './sinks/signed-log.sink';
import { FabricSink } from './sinks/fabric.sink';
import { PlainLogSink } from './sinks/plain-log.sink';

@Injectable()
export class AuditDispatcherService {
  private readonly logger = new Logger(AuditDispatcherService.name);
  private readonly sinks: Map<SinkType, AuditSink> = new Map();
  private enabledSinks: Set<SinkType> = new Set();

  constructor(
    private configService: ConfigService,
    private signedLogSink: SignedLogSink,
    private fabricSink: FabricSink,
    private plainLogSink: PlainLogSink,
  ) {
    this.sinks.set('SIGNED_LOG', this.signedLogSink);
    this.sinks.set('FABRIC', this.fabricSink);
    this.sinks.set('PLAIN_LOG', this.plainLogSink);

    this.loadConfiguredSinks();
  }

  private loadConfiguredSinks(): void {
    const rawConfig = this.configService.get<string>('AUDIT_SINKS_ENABLED') || 'signed_log,fabric';
    const parsed = rawConfig
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);

    this.enabledSinks.clear();
    for (const sinkName of parsed) {
      if (sinkName === 'SIGNED_LOG' || sinkName === 'FABRIC' || sinkName === 'PLAIN_LOG') {
        this.enabledSinks.add(sinkName as SinkType);
      }
    }

    if (this.enabledSinks.size === 0) {
      this.enabledSinks.add('SIGNED_LOG');
    }

    this.logger.log(`Active audit sinks: ${Array.from(this.enabledSinks).join(', ')}`);
  }

  public getActiveSinks(): SinkType[] {
    return Array.from(this.enabledSinks);
  }

  public setSinkEnabled(sinkType: SinkType, enabled: boolean): void {
    if (enabled) {
      this.enabledSinks.add(sinkType);
    } else {
      this.enabledSinks.delete(sinkType);
    }
    this.logger.log(`Updated active audit sinks: ${Array.from(this.enabledSinks).join(', ')}`);
  }

  async dispatch(
    event: CanonicalAuditEvent,
    options?: { tx?: any },
  ): Promise<Partial<Record<SinkType, AuditReceipt>>> {
    const receipts: Partial<Record<SinkType, AuditReceipt>> = {};

    for (const sinkType of this.enabledSinks) {
      const sink = this.sinks.get(sinkType);
      if (!sink) continue;

      try {
        const receipt = await sink.append(event, options?.tx);
        receipts[sinkType] = receipt;
      } catch (err: any) {
        this.logger.error(`Sink ${sinkType} failed to append event ${event.event_id}: ${err.message}`, err.stack);
      }
    }

    return receipts;
  }

  async verifyAll(
    eventId: string,
    expectedHash?: string,
    targetSinks?: SinkType[],
  ): Promise<Partial<Record<SinkType, AuditVerifyResult>>> {
    const results: Partial<Record<SinkType, AuditVerifyResult>> = {};
    const sinksToCheck = targetSinks && targetSinks.length > 0 ? targetSinks : Array.from(this.enabledSinks);

    for (const sinkType of sinksToCheck) {
      const sink = this.sinks.get(sinkType);
      if (!sink) continue;

      try {
        results[sinkType] = await sink.verify(eventId, expectedHash);
      } catch (err: any) {
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
}
