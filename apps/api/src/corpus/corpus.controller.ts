import { Controller, Get, Post, Body, Req } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { Roles } from '../auth/auth.guard';
import { CorpusService } from './corpus.service';
import { CorpusImportSchema } from '@examvault/shared';

@ApiTags('Corpus')
@Controller('corpus')
export class CorpusController {
  constructor(private corpusService: CorpusService) {}

  @Get('sources')
  @Roles('ADMIN', 'MODERATOR', 'AUDITOR')
  @ApiOperation({ summary: 'List all reference corpus sources' })
  async listSources() {
    const sources = await this.corpusService.listSources();
    return { success: true, data: sources };
  }

  @Post('import')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Import past papers or public corpus (ADMIN only)' })
  async importCorpus(@Body() body: any, @Req() req: Request) {
    const parsed = CorpusImportSchema.parse(body);
    const result = await this.corpusService.importCorpus(parsed, req.userId!);
    return { success: true, data: result };
  }
}
