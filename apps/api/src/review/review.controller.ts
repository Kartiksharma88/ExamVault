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
import { ReviewService } from './review.service';
import { BlindAnswerSubmitSchema, ReviewSubmitSchema } from '@examvault/shared';

@ApiTags('Review')
@Controller('review')
export class ReviewController {
  constructor(private reviewService: ReviewService) {}

  @Get('queue')
  @Roles('REVIEWER')
  @ApiOperation({ summary: 'Get reviewer queue of assigned questions (REVIEWER only)' })
  async getQueue(@Req() req: Request) {
    const queue = await this.reviewService.getReviewerQueue(req.userId!);
    return { success: true, data: queue };
  }

  @Get('assignments/:id')
  @Roles('REVIEWER')
  @ApiOperation({ summary: 'Get review workspace — answer key withheld until blind answer saved' })
  async getAssignment(@Param('id') id: string, @Req() req: Request) {
    const workspace = await this.reviewService.getAssignmentWorkspace(id, req.userId!);
    return { success: true, data: workspace };
  }

  @Post('assignments/:id/blind-answer')
  @Roles('REVIEWER')
  @ApiOperation({ summary: 'Phase 1: Submit blind answer (unlocks evaluate phase)' })
  async submitBlindAnswer(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: Request,
  ) {
    const parsed = BlindAnswerSubmitSchema.parse(body);
    const result = await this.reviewService.submitBlindAnswer(id, parsed, req.userId!);
    return { success: true, data: result };
  }

  @Post('assignments/:id/evaluate')
  @Roles('REVIEWER')
  @ApiOperation({ summary: 'Phase 2: Submit evaluation with step-up MFA & Ed25519 signature' })
  async submitEvaluation(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: Request,
  ) {
    if (body?.checklist) {
      const c = body.checklist;
      body.checklist = {
        contentAccuracy: Boolean(c.contentAccuracy ?? c.accuracy ?? true),
        singleDefensibleAnswer: Boolean(c.singleDefensibleAnswer ?? c.singleCorrectAnswer ?? true),
        clarityAndWording: Boolean(c.clarityAndWording ?? c.clarityWording ?? true),
        distractorPlausibility: Boolean(c.distractorPlausibility ?? c.plausibleDistractors ?? true),
        syllabusTopicAlignment: Boolean(c.syllabusTopicAlignment ?? c.syllabusAlignment ?? true),
        difficultyAppropriate: Boolean(c.difficultyAppropriate ?? true),
        languageEquivalence: Boolean(c.languageEquivalence ?? true),
        biasAndSensitivity: Boolean(c.biasAndSensitivity ?? c.fairnessNoBias ?? true),
        formattingMathRendering: Boolean(c.formattingMathRendering ?? c.formattingMathLatex ?? true),
      };
    }
    const parsed = ReviewSubmitSchema.parse(body);
    const result = await this.reviewService.submitEvaluation(id, parsed, req.userId!);
    return { success: true, data: result };
  }
}
