import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Request } from 'express';
import { Roles } from '../auth/auth.guard';
import { QuestionsService } from './questions.service';

@ApiTags('Questions')
@Controller('questions')
export class QuestionsController {
  constructor(private questionsService: QuestionsService) {}

  @Post()
  @Roles('EXAMINER')
  @ApiOperation({ summary: 'Create a new question (EXAMINER only)' })
  async create(@Body() body: any, @Req() req: Request) {
    const result = await this.questionsService.create(body, req.userId!);
    return { success: true, data: result };
  }

  @Put(':id')
  @Roles('EXAMINER')
  @ApiOperation({ summary: 'Update a question — creates new version if submitted (EXAMINER only)' })
  async update(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: Request,
  ) {
    const result = await this.questionsService.update(id, body, req.userId!);
    return { success: true, data: result };
  }

  @Patch(':id/submit')
  @Roles('EXAMINER')
  @ApiOperation({ summary: 'Submit a question (EXAMINER only)' })
  async submit(@Param('id') id: string, @Req() req: Request) {
    const result = await this.questionsService.submit(id, req.userId!);
    return { success: true, data: result };
  }

  @Patch(':id/withdraw')
  @Roles('EXAMINER')
  @ApiOperation({ summary: 'Withdraw a submitted question (EXAMINER only)' })
  async withdraw(@Param('id') id: string, @Req() req: Request) {
    const result = await this.questionsService.withdraw(id, req.userId!);
    return { success: true, data: result };
  }

  @Get()
  @Roles('EXAMINER', 'REVIEWER', 'MODERATOR', 'ADMIN', 'AUDITOR')
  @ApiOperation({ summary: 'List questions — metadata only, filtered by role' })
  @ApiQuery({ name: 'subjectId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAll(
    @Req() req: Request,
    @Query('subjectId') subjectId?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.questionsService.findAll(
      req.userId!,
      req.userRole!,
      {
        subjectId,
        status,
        type,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20,
      },
    );
    return { success: true, data: result };
  }

  @Get(':id/content')
  @Roles('EXAMINER', 'REVIEWER', 'MODERATOR')
  @ApiOperation({ summary: 'Get decrypted question content — ADMIN and AUDITOR get 403' })
  @ApiQuery({ name: 'version', required: false, type: Number })
  async getContent(
    @Param('id') id: string,
    @Req() req: Request,
    @Query('version') version?: string,
  ) {
    const result = await this.questionsService.getContent(
      id,
      req.userId!,
      req.userRole!,
      version ? parseInt(version, 10) : undefined,
    );
    return { success: true, data: result };
  }

  @Get(':id/versions')
  @Roles('EXAMINER', 'REVIEWER', 'MODERATOR')
  @ApiOperation({ summary: 'Get version history for a question' })
  async getVersionHistory(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const result = await this.questionsService.getVersionHistory(
      id,
      req.userId!,
      req.userRole!,
    );
    return { success: true, data: result };
  }

  @Get(':id/feedback')
  @Roles('EXAMINER')
  @ApiOperation({ summary: 'Get anonymized reviewer feedback for an author' })
  async getFeedback(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const result = await this.questionsService.getAuthorFeedback(
      id,
      req.userId!,
    );
    return { success: true, data: result };
  }

  @Post('new-version')
  @Roles('EXAMINER')
  @ApiOperation({ summary: 'Create a new draft version from an approved or changes-requested question' })
  async createNewVersion(
    @Body() body: any,
    @Req() req: Request,
  ) {
    const result = await this.questionsService.createNewVersion(
      body,
      req.userId!,
    );
    return { success: true, data: result };
  }
}

