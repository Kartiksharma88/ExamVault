import { CanonicalAuditEvent } from '@examvault/audit-canonical';

export type SinkType = 'SIGNED_LOG' | 'FABRIC' | 'PLAIN_LOG';

export interface AuditReceipt {
  sinkType: SinkType;
  receiptId: string;
  timestamp: string;
  blockNumber?: number;
  transactionId?: string;
  witnessSignature?: string;
  details?: Record<string, unknown>;
}

export interface AuditVerifyResult {
  valid: boolean;
  sinkType: SinkType;
  checkedAt: string;
  details: Record<string, unknown>;
  discrepancy?: string;
}

export interface AuditSink {
  readonly sinkType: SinkType;
  append(event: CanonicalAuditEvent, tx?: any): Promise<AuditReceipt>;
  verify(eventId: string, expectedHash?: string): Promise<AuditVerifyResult>;
}
