"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var CorpusService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CorpusService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const originality_service_1 = require("../originality/originality.service");
let CorpusService = CorpusService_1 = class CorpusService {
    prisma;
    audit;
    originalityService;
    logger = new common_1.Logger(CorpusService_1.name);
    constructor(prisma, audit, originalityService) {
        this.prisma = prisma;
        this.audit = audit;
        this.originalityService = originalityService;
    }
    /**
     * Import archived past papers or permitted public sources
     */
    async importCorpus(input, adminId) {
        if (!input.documents || input.documents.length === 0) {
            throw new common_1.BadRequestException('At least one document is required for corpus import');
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
        }
        catch (err) {
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
};
exports.CorpusService = CorpusService;
exports.CorpusService = CorpusService = CorpusService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        originality_service_1.OriginalityService])
], CorpusService);
//# sourceMappingURL=corpus.service.js.map