import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Request } from 'express';
import { Roles } from '../auth/auth.guard';
import { PoliciesService } from './policies.service';
import { ProposePolicySchema, ApprovePolicySchema } from '@examvault/shared';

@ApiTags('Policies')
@Controller('policies')
export class PoliciesController {
  constructor(private policiesService: PoliciesService) {}

  @Get()
  @Roles('ADMIN', 'MODERATOR', 'AUDITOR')
  @ApiOperation({ summary: 'List all approval policies (ADMIN/MODERATOR/AUDITOR)' })
  async listPolicies() {
    const policies = await this.policiesService.listPolicies();
    return { success: true, data: policies };
  }

  @Get('active')
  @Roles('ADMIN', 'MODERATOR', 'REVIEWER', 'EXAMINER', 'AUDITOR')
  @ApiOperation({ summary: 'Get active policy for a subject or scope' })
  @ApiQuery({ name: 'subjectId', required: false })
  @ApiQuery({ name: 'examId', required: false })
  @ApiQuery({ name: 'questionType', required: false })
  async getActivePolicy(
    @Query('subjectId') subjectId?: string,
    @Query('examId') examId?: string,
    @Query('questionType') questionType?: string,
  ) {
    const policy = await this.policiesService.getActivePolicy(subjectId, examId, questionType);
    return { success: true, data: policy };
  }

  @Post('propose')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Propose a new approval policy (ADMIN only)' })
  async proposePolicy(@Body() body: any, @Req() req: Request) {
    const parsed = ProposePolicySchema.parse(body);
    const result = await this.policiesService.proposePolicy(parsed, req.userId!);
    return { success: true, data: result };
  }

  @Post('approve')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Approve a proposed policy (Two-Person rule: ADMIN must differ from proposer)' })
  async approvePolicy(@Body() body: any, @Req() req: Request) {
    const parsed = ApprovePolicySchema.parse(body);
    const result = await this.policiesService.approvePolicy(parsed, req.userId!);
    return { success: true, data: result };
  }
}
