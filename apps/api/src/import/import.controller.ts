import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Res,
  Header,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Roles } from '../auth/auth.guard';
import { ImportService } from './import.service';

@ApiTags('Import')
@Controller('import')
@Roles('EXAMINER')
export class ImportController {
  constructor(private importService: ImportService) {}

  @Get('template')
  @ApiOperation({ summary: 'Download CSV import template' })
  async getTemplate(@Res() res: Response) {
    const template = this.importService.getTemplate();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=examvault-import-template.csv');
    res.send(template);
  }

  @Post()
  @ApiOperation({ summary: 'Import questions from CSV (EXAMINER only)' })
  async importCsv(
    @Body() body: { csv: string },
    @Req() req: Request,
  ) {
    const result = await this.importService.importCsv(body.csv, req.userId!);
    return { success: true, data: result };
  }
}
