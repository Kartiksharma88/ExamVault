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
import { ModerationService } from './moderation.service';
import {
  ModeratorDecisionSchema,
  ReassignReviewerSchema,
  RetireQuestionSchema,
} from '@examvault/shared';

@ApiTags('Moderation')
@Controller('moderation')
export class ModerationController {
  constructor(private moderationService: ModerationService) {}

  @Get('queue')
  @Roles('MODERATOR', 'ADMIN')
  @ApiOperation({ summary: 'Get unified moderator console queues' })
  async getQueue() {
    const queue = await this.moderationService.getModeratorQueue();
    return { success: true, data: queue };
  }

  @Post('disagreement/:reviewId/resolve')
  @Roles('MODERATOR')
  @ApiOperation({ summary: 'Resolve a blind-solve answer key disagreement' })
  async resolveDisagreement(
    @Param('reviewId') reviewId: string,
    @Body('resolutionNote') resolutionNote: string,
    @Req() req: Request,
  ) {
    const result = await this.moderationService.resolveDisagreement(
      reviewId,
      resolutionNote || 'Resolved by moderator',
      req.userId!,
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
    const parsed = ModeratorDecisionSchema.parse(body);
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
    const parsed = ReassignReviewerSchema.parse(body);
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
    const parsed = RetireQuestionSchema.parse(body);
    const result = await this.moderationService.retireQuestion(
      versionId,
      parsed,
      req.userId!,
    );
    return { success: true, data: result };
  }
}
