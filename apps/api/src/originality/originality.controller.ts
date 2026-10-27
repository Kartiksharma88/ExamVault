import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { Roles } from '../auth/auth.guard';
import { OriginalityService } from './originality.service';
import { DuplicateDispositionSchema } from '@examvault/shared';

@ApiTags('Originality')
@Controller('originality')
export class OriginalityController {
  constructor(private originalityService: OriginalityService) {}

  @Get('health')
  @Roles('ADMIN', 'MODERATOR', 'AUDITOR', 'REVIEWER', 'EXAMINER')
  @ApiOperation({ summary: 'Get originality service status and metrics' })
  async getHealth() {
    const health = await this.originalityService.checkHealth();
    return { success: true, data: health };
  }

  @Get('reports/:versionId')
  @Roles('ADMIN', 'MODERATOR', 'EXAMINER', 'REVIEWER', 'AUDITOR')
  @ApiOperation({ summary: 'Get originality report with role-based masking' })
  async getReport(@Param('versionId') versionId: string, @Req() req: Request) {
    const report = await this.originalityService.getReport(
      versionId,
      req.userRole!,
      req.userId!,
    );
    return { success: true, data: report };
  }

  @Post('disposition/:versionId')
  @Roles('MODERATOR')
  @ApiOperation({ summary: 'Moderator disposition of a duplicate flag' })
  async dispositionDuplicate(
    @Param('versionId') versionId: string,
    @Body() body: any,
    @Req() req: Request,
  ) {
    const parsed = DuplicateDispositionSchema.parse(body);
    const result = await this.originalityService.dispositionDuplicate(
      versionId,
      parsed,
      req.userId!,
    );
    return { success: true, data: result };
  }

  @Post('index/sync')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Trigger sync of memory-only question bank index (ADMIN only)' })
  async syncIndex() {
    const result = await this.originalityService.syncBankIndex();
    return { success: true, data: result };
  }

  @Post('screen/:versionId')
  @Roles('ADMIN', 'MODERATOR')
  @ApiOperation({ summary: 'Manually trigger question screening' })
  async triggerScreen(@Param('versionId') versionId: string) {
    const result = await this.originalityService.screenQuestion(versionId);
    return { success: true, data: result };
  }
}
