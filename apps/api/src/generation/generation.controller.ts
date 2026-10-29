import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthGuard, Roles } from '../auth/auth.guard';
import { GenerationService } from './generation.service';

@ApiTags('Paper Generation Console')
@Controller('generation')
@UseGuards(AuthGuard)
export class GenerationController {
  constructor(private readonly generationService: GenerationService) {}

  @Get('overview')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Bank Overview (Counts ONLY: Eligible, Pending Reviewer, Pending Moderator, Pending Examiner)' })
  async getOverview() {
    return this.generationService.getBankOverview();
  }

  @Get('bank-overview')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Bank Overview (Counts ONLY: Eligible, Pending Reviewer, Pending Moderator, Pending Examiner)' })
  async getBankOverview() {
    return this.generationService.getBankOverview();
  }

  @Get('readiness')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Blueprint readiness check (Numbers only)' })
  async checkReadiness(@Query('blueprintVersionId') blueprintVersionId: string) {
    return this.generationService.checkReadiness(blueprintVersionId);
  }

  @Get('requests')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'List all paper generation requests' })
  async getRequests() {
    return this.generationService.getRequests();
  }

  @Post('requests')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Propose paper generation request (Admin 1)' })
  async proposeRequest(@Body() body: any, @Req() req: Request) {
    return this.generationService.proposeGenerationRequest({
      ...body,
      proposerId: req.userId!,
    });
  }

  @Post('request')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Propose paper generation request alias (Admin 1)' })
  async proposeRequestAlias(@Body() body: any, @Req() req: Request) {
    return this.generationService.proposeGenerationRequest({
      ...body,
      proposerId: req.userId!,
    });
  }

  @Post('requests/:id/approve')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Approve or reject paper generation request (Admin 2)' })
  async approveRequest(
    @Param('id') requestId: string,
    @Body() body: { mfaCode: string; decision: 'APPROVE' | 'REJECT'; reason?: string },
    @Req() req: Request,
  ) {
    return this.generationService.approveGenerationRequest({
      requestId,
      approverId: req.userId!,
      mfaCode: body.mfaCode,
      decision: body.decision,
      reason: body.reason,
    });
  }

  @Post('requests/:id/approval')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Approve or reject paper generation request alias (Admin 2)' })
  async approveRequestApproval(
    @Param('id') requestId: string,
    @Body() body: { mfaCode: string; decision: 'APPROVE' | 'REJECT'; reason?: string },
    @Req() req: Request,
  ) {
    return this.generationService.approveGenerationRequest({
      requestId,
      approverId: req.userId!,
      mfaCode: body.mfaCode,
      decision: body.decision,
      reason: body.reason,
    });
  }

  @Post('requests/:id/generate')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Trigger paper generation within execution window' })
  async generatePaper(
    @Param('id') requestId: string,
    @Body() body: { forceImmediate?: boolean },
    @Req() req: Request,
  ) {
    return this.generationService.generatePaper(requestId, req.userId!, body?.forceImmediate);
  }

  @Get('papers')
  @Roles('ADMIN', 'AUDITOR', 'CUSTODIAN')
  @ApiOperation({ summary: 'List paper generations' })
  async getPapers() {
    return this.generationService.getPapers();
  }

  @Get('papers/:id')
  @Roles('ADMIN', 'AUDITOR', 'CUSTODIAN')
  @ApiOperation({ summary: 'Get paper status and public manifest (Counts only, zero question content)' })
  async getPaper(@Param('id') paperId: string) {
    return this.generationService.getPaper(paperId);
  }

  @Post('papers/:id/cancel')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Cancel paper generation or release (Dual-admin)' })
  async cancelPaper(
    @Param('id') paperId: string,
    @Body() body: { reason: string },
    @Req() req: Request,
  ) {
    return this.generationService.cancelPaper(paperId, req.userId!, body.reason);
  }
}

