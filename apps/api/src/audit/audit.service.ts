import { Injectable, Inject, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { KeyProvider, KEY_PROVIDER } from '../crypto/key-provider.interface';

export interface AuditLogEntry {
  actorId?: string;
  action: string;
  targetType: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * AuditService — Tamper-evident append-only audit log
 * 
 * Each entry contains:
 * - prev_hash: hash of the previous entry (or genesis hash for the first)
 * - entry_hash: SHA-256(prev_hash + canonical event JSON)
 * - signature: Ed25519 signature of entry_hash
 * 
 * The database triggers prevent UPDATE and DELETE on audit_events.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private static readonly GENESIS_HASH = '0'.repeat(64);

  constructor(
    private prisma: PrismaService,
    @Inject(KEY_PROVIDER) private keyProvider: KeyProvider,
  ) {}

  /**
   * Append an audit event to the chain
   * IMPORTANT: Never include plaintext content, answers, keys, or passwords in metadata
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      // Sanitize metadata — never log sensitive content
      const sanitizedMetadata = entry.metadata ? this.sanitizeMetadata(entry.metadata) : undefined;

      // Get the hash of the previous entry
      const lastEvent = await this.prisma.auditEvent.findFirst({
        orderBy: { timestamp: 'desc' },
        select: { entryHash: true },
      });
      const prevHash = lastEvent?.entryHash || AuditService.GENESIS_HASH;

      // Create canonical event JSON for hashing
      const timestamp = new Date();
      const canonicalEvent = JSON.stringify({
        timestamp: timestamp.toISOString(),
        actorId: entry.actorId || null,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId || null,
        metadata: sanitizedMetadata || null,
      });

      // Compute entry hash
      const entryHash = crypto
        .createHash('sha256')
        .update(prevHash)
        .update(canonicalEvent)
        .digest('hex');

      // Sign the entry hash
      const signature = await this.keyProvider.sign(Buffer.from(entryHash, 'hex'));

      await this.prisma.auditEvent.create({
        data: {
          timestamp,
          actorId: entry.actorId || null,
          action: entry.action,
          targetType: entry.targetType,
          targetId: entry.targetId || null,
          metadata: sanitizedMetadata as any,
          prevHash,
          entryHash,
          signature: signature.toString('base64'),
        },
      });
    } catch (error) {
      // Audit logging must never crash the application
      this.logger.error('Failed to write audit log entry', error);
    }
  }

  /**
   * Verify the entire audit chain
   * Returns the first broken entry if any
   */
  async verifyChain(): Promise<{
    valid: boolean;
    totalEntries: number;
    verifiedEntries: number;
    firstBrokenEntry?: {
      id: string;
      index: number;
      expectedHash: string;
      actualHash: string;
    };
  }> {
    const events = await this.prisma.auditEvent.findMany({
      orderBy: { timestamp: 'asc' },
    });

    let prevHash = AuditService.GENESIS_HASH;

    for (let i = 0; i < events.length; i++) {
      const event = events[i];

      // Reconstruct canonical event
      const canonicalEvent = JSON.stringify({
        timestamp: event.timestamp.toISOString(),
        actorId: event.actorId || null,
        action: event.action,
        targetType: event.targetType,
        targetId: event.targetId || null,
        metadata: event.metadata || null,
      });

      // Verify prev_hash link
      if (event.prevHash !== prevHash) {
        return {
          valid: false,
          totalEntries: events.length,
          verifiedEntries: i,
          firstBrokenEntry: {
            id: event.id,
            index: i,
            expectedHash: prevHash,
            actualHash: event.prevHash,
          },
        };
      }

      // Verify entry hash
      const expectedHash = crypto
        .createHash('sha256')
        .update(prevHash)
        .update(canonicalEvent)
        .digest('hex');

      if (event.entryHash !== expectedHash) {
        return {
          valid: false,
          totalEntries: events.length,
          verifiedEntries: i,
          firstBrokenEntry: {
            id: event.id,
            index: i,
            expectedHash,
            actualHash: event.entryHash,
          },
        };
      }

      // Verify signature
      let signatureValid = false;
      try {
        signatureValid = await this.keyProvider.verify(
          Buffer.from(event.entryHash, 'hex'),
          Buffer.from(event.signature, 'base64'),
        );
      } catch {
        signatureValid = false;
      }

      // In production, signature must always be strictly valid.
      // In development, past events signed by previous ephemeral keys are permitted if the SHA-256 hash chain is intact.
      if (!signatureValid && process.env.NODE_ENV === 'production') {
        return {
          valid: false,
          totalEntries: events.length,
          verifiedEntries: i,
          firstBrokenEntry: {
            id: event.id,
            index: i,
            expectedHash: 'VALID_HASH_INVALID_SIGNATURE',
            actualHash: event.entryHash,
          },
        };
      }

      prevHash = event.entryHash;
    }

    return {
      valid: true,
      totalEntries: events.length,
      verifiedEntries: events.length,
    };
  }

  /**
   * Query audit events with filters
   */
  async findAll(filters: {
    action?: string;
    actorId?: string;
    targetType?: string;
    targetId?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) {
    const where: any = {};
    if (filters.action) where.action = filters.action;
    if (filters.actorId) where.actorId = filters.actorId;
    if (filters.targetType) where.targetType = filters.targetType;
    if (filters.targetId) where.targetId = filters.targetId;
    if (filters.from || filters.to) {
      where.timestamp = {};
      if (filters.from) where.timestamp.gte = new Date(filters.from);
      if (filters.to) where.timestamp.lte = new Date(filters.to);
    }

    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.auditEvent.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit,
        include: {
          actor: {
            select: { email: true, name: true },
          },
        },
      }),
      this.prisma.auditEvent.count({ where }),
    ]);

    return {
      items: items.map((e) => ({
        id: e.id,
        timestamp: e.timestamp.toISOString(),
        actorId: e.actorId,
        actorEmail: e.actor?.email,
        actorName: e.actor?.name,
        action: e.action,
        targetType: e.targetType,
        targetId: e.targetId,
        metadata: e.metadata,
        entryHash: e.entryHash,
        prevHash: e.prevHash,
        signature: e.signature,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Sanitize metadata to prevent logging sensitive content
   */
  private sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
    const sensitiveKeys = ['password', 'secret', 'key', 'token', 'content', 'answer', 'plaintext', 'stem', 'options'];
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(metadata)) {
      if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk))) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }
}
