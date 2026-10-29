import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthGuard, Roles } from '../auth/auth.guard';
import { BlueprintsService } from './blueprints.service';
import { GenerationService } from '../generation/generation.service';

@ApiTags('Blueprints (Dual-Admin Control)')
@Controller('blueprints')
@UseGuards(AuthGuard)
export class BlueprintsController {
  constructor(
    private readonly blueprintsService: BlueprintsService,
    private readonly generationService: GenerationService,
  ) {}

  @Get(':id/readiness')
  @Roles('ADMIN', 'AUDITOR')
  @ApiOperation({ summary: 'Blueprint readiness check (Numbers only)' })
  async checkReadiness(@Param('id') blueprintId: string) {
    return this.generationService.checkReadiness(blueprintId);
  }

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Propose a new blueprint or version (Admin 1)' })
  async proposeBlueprint(@Body() body: any, @Req() req: Request) {
    return this.blueprintsService.proposeBlueprint({
      ...body,
      proposerId: req.userId!,
    });
  }

  @Post(':id/approve')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Approve blueprint version with step-up MFA (Admin 2)' })
  async approveBlueprint(
    @Param('id') blueprintId: string,
    @Body() body: { versionNo: number; mfaCode: string },
    @Req() req: Request,
  ) {
    return this.blueprintsService.approveBlueprint({
      blueprintId,
      versionNo: body.versionNo,
      approverId: req.userId!,
      mfaCode: body.mfaCode,
    });
  }

  @Get()
  @Roles('ADMIN', 'AUDITOR')
  @ApiOperation({ summary: 'List all blueprints' })
  async listBlueprints(@Query('examId') examId?: string) {
    return this.blueprintsService.listBlueprints(examId);
  }

  @Get(':id/versions')
  @Roles('ADMIN', 'AUDITOR')
  @ApiOperation({ summary: 'List versions of a blueprint' })
  async getVersions(@Param('id') blueprintId: string) {
    return this.blueprintsService.getBlueprintVersions(blueprintId);
  }

  @Get(':id/versions/:versionNo')
  @Roles('ADMIN', 'AUDITOR')
  @ApiOperation({ summary: 'Get specific blueprint version' })
  async getVersion(
    @Param('id') blueprintId: string,
    @Param('versionNo', ParseIntPipe) versionNo: number,
  ) {
    return this.blueprintsService.getBlueprintVersion(blueprintId, versionNo);
  }
}

