import { Module } from '@nestjs/common';
import { CorpusService } from './corpus.service';
import { CorpusController } from './corpus.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { OriginalityModule } from '../originality/originality.module';

@Module({
  imports: [PrismaModule, AuditModule, OriginalityModule],
  controllers: [CorpusController],
  providers: [CorpusService],
  exports: [CorpusService],
})
export class CorpusModule {}
