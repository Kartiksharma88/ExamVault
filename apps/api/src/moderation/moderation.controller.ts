import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { Roles } from '../auth/auth.guard';
import { ModerationService } from './moderation.service';
import {
  ModeratorDecisionSchema,
  ReassignReviewerSchema,
  RetireQuestionSchema,
  ResolveDifficultyConflictSchema,
} from '@examvault/shared';

function parseOrBadRequest<T>(schema: { parse: (val: any) => T }, data: any): T {
  try {
    return schema.parse(data);
  } catch (err: any) {
    if (err.name === 'ZodError' && Array.isArray(err.errors)) {
      const msg = err.errors.map((e: any) => `${e.path.join('.') || 'payload'}: ${e.message}`).join('; ');
      throw new BadRequestException(`Validation error: ${msg}`);
    }
    throw new BadRequestException(err.message || 'Invalid request payload');
  }
}

@ApiTags('Moderation')
@Controller('moderation')
export class ModerationController {
  constructor(private moderationService: ModerationService) {}

  @Get('queue')
  @Roles('MODERATOR', 'ADMIN')
  @ApiOperation({ summary: 'Get unified moderator console queues' })
  async getQueue(@Req() req: Request) {
    const queue = await this.moderationService.getModeratorQueue(req.userId);
    return { success: true, data: queue };
  }

  @Get('duplicates')
  @Roles('MODERATOR', 'ADMIN')
  @ApiOperation({ summary: 'Get duplicate flagged question versions' })
  async getDuplicates() {
    const queue = await this.moderationService.getModeratorQueue();
    return { success: true, data: queue.duplicateFlags };
  }

  @Post('disagreement/:reviewId/resolve')
  @Roles('MODERATOR')
  @ApiOperation({ summary: 'Resolve a blind-solve answer key disagreement' })
  async resolveDisagreement(
    @Param('reviewId') reviewId: string,
    @Body('resolutionNote') resolutionNote: string,
    @Body('decision') decision: 'REQUEST_CHANGES' | 'REJECT' | 'LET_STAND',
    @Req() req: Request,
  ) {
    const result = await this.moderationService.resolveDisagreement(
      reviewId,
      resolutionNote || 'Resolved by moderator',
      req.userId!,
      decision || 'LET_STAND',
    );
    return { success: true, data: result };
  }

  @Post('decision/:versionId')
  @Roles('MODERATOR')
  @ApiOperation({ summary: 'Submit moderator decision with step-up MFA & Ed25519 signature' })
  async submitDecision(
    @Param('versionId') versionId: string,
    @Body() body: any,
    @Req() req: Request,
  ) {
    const parsed = parseOrBadRequest(ModeratorDecisionSchema, body);
    const result = await this.moderationService.submitDecision(
      versionId,
      parsed,
      req.userId!,
    );
    return { success: true, data: result };
  }

  @Post('reassign')
  @Roles('MODERATOR')
  @ApiOperation({ summary: 'Reassign an overdue assignment to a new reviewer' })
  async reassignReviewer(@Body() body: any, @Req() req: Request) {
    const parsed = parseOrBadRequest(ReassignReviewerSchema, body);
    const result = await this.moderationService.reassignReviewer(
      parsed,
      req.userId!,
    );
    return { success: true, data: result };
  }

  @Post('retire/:versionId')
  @Roles('MODERATOR')
  @ApiOperation({ summary: 'Retire an approved question version' })
  async retireQuestion(
    @Param('versionId') versionId: string,
    @Body() body: any,
    @Req() req: Request,
  ) {
    const parsed = parseOrBadRequest(RetireQuestionSchema, body);
    const result = await this.moderationService.retireQuestion(
      versionId,
      parsed,
      req.userId!,
    );
    return { success: true, data: result };
  }

  @Post('difficulty-conflict/:versionId/resolve')
  @Roles('MODERATOR')
  @ApiOperation({ summary: 'Resolve a reviewer difficulty rating conflict' })
  async resolveDifficultyConflict(
    @Param('versionId') versionId: string,
    @Body() body: any,
    @Req() req: Request,
  ) {
    const parsed = parseOrBadRequest(ResolveDifficultyConflictSchema, body);
    const result = await this.moderationService.resolveDifficultyConflict(
      versionId,
      parsed,
      req.userId!,
    );
    return { success: true, data: result };
  }
}
