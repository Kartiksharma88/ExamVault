import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { OriginalityService } from '../originality/originality.service';
import { CorpusImportInput } from '@examvault/shared';

@Injectable()
export class CorpusService {
  private readonly logger = new Logger(CorpusService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private originalityService: OriginalityService,
  ) {}

  /**
   * Import archived past papers or permitted public sources
   */
  async importCorpus(input: CorpusImportInput, adminId: string) {
    if (!input.documents || input.documents.length === 0) {
      throw new BadRequestException('At least one document is required for corpus import');
    }

    const source = await this.prisma.corpusSource.create({
      data: {
        name: input.name,
        type: input.sourceType,
        licenseNote: input.licenseNote || null,
        importedById: adminId,
      },
    });

    const docs = [];
    for (const d of input.documents) {
      // Basic normalization
      const normalized = d.content.toLowerCase().replace(/\s+/g, ' ').trim();
      const doc = await this.prisma.corpusDocument.create({
        data: {
          sourceId: source.id,
          title: d.title,
          identifier: d.identifier,
          plaintextContent: d.content,
          normalizedContent: normalized,
        },
      });
      docs.push(doc);
    }

    await this.audit.log({
      actorId: adminId,
      action: 'IMPORT_SUCCESS',
      targetType: 'corpus_source',
      targetId: source.id,
      metadata: {
        name: input.name,
        sourceType: input.sourceType,
        documentCount: docs.length,
      },
    });

    // Sync to originality service in-memory index
    try {
      await this.originalityService.syncBankIndex();
    } catch (err: any) {
      this.logger.warn(`Corpus imported but immediate index sync deferred: ${err.message}`);
    }

    return {
      success: true,
      sourceId: source.id,
      importedCount: docs.length,
    };
  }

  async listSources() {
    return this.prisma.corpusSource.findMany({
      include: {
        importedBy: { select: { id: true, name: true, email: true } },
        _count: { select: { documents: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
