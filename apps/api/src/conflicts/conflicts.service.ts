import { Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../crypto/crypto.service';
import { AuditService } from '../audit/audit.service';
import { ConflictDeclarationInput } from '@examvault/shared';

@Injectable()
export class ConflictsService {
  constructor(
    private prisma: PrismaService,
    private crypto: CryptoService,
    private audit: AuditService,
  ) {}

  async listUserConflicts(userId: string) {
    const list = await this.prisma.conflictDeclaration.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const decrypted = [];
    for (const item of list) {
      try {
        const text = await this.crypto.decrypt(
          {
            ciphertext: item.encryptedDescription,
            nonce: item.descriptionNonce,
            tag: item.descriptionTag,
            wrappedKey: item.wrappedKey,
            keyId: item.keyId,
          },
          `conflict:${item.id}`,
        );
        decrypted.push({
          id: item.id,
          conflictType: item.conflictType,
          description: text,
          createdAt: item.createdAt,
        });
      } catch {
        decrypted.push({
          id: item.id,
          conflictType: item.conflictType,
          description: '[Encrypted Entry]',
          createdAt: item.createdAt,
        });
      }
    }

    return decrypted;
  }

  async declareConflict(input: ConflictDeclarationInput, userId: string) {
    const id = crypto.randomUUID();
    const normalized = input.description.trim().toLowerCase().replace(/\s+/g, ' ');
    const conflictHash = crypto.createHash('sha256').update(normalized).digest('hex');

    const enc = await this.crypto.encrypt(input.description, `conflict:${id}`);

    const created = await this.prisma.conflictDeclaration.create({
      data: {
        id,
        userId,
        conflictType: input.conflictType,
        encryptedDescription: enc.ciphertext,
        descriptionNonce: enc.nonce,
        descriptionTag: enc.tag,
        wrappedKey: enc.wrappedKey,
        keyId: enc.keyId,
        conflictHash,
      },
    });

    await this.audit.log({
      actorId: userId,
      action: 'CONFLICT_UPDATE',
      targetType: 'conflict_declaration',
      targetId: id,
      metadata: { conflictType: input.conflictType, conflictHash },
    });

    return { id: created.id, conflictType: created.conflictType, success: true };
  }

  async deleteConflict(id: string, userId: string) {
    const item = await this.prisma.conflictDeclaration.findUnique({
      where: { id },
    });
    if (!item || item.userId !== userId) {
      throw new NotFoundException('Conflict declaration not found');
    }

    await this.prisma.conflictDeclaration.delete({ where: { id } });

    await this.audit.log({
      actorId: userId,
      action: 'CONFLICT_UPDATE',
      targetType: 'conflict_declaration',
      targetId: id,
      metadata: { action: 'deleted' },
    });

    return { success: true };
  }
}
