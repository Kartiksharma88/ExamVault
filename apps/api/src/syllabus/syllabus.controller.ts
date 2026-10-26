import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { Roles } from '../auth/auth.guard';
import { SyllabusService } from './syllabus.service';

@ApiTags('Syllabus')
@Controller('syllabus')
export class SyllabusController {
  constructor(private syllabusService: SyllabusService) {}

  // ── Exams ──
  @Post('exams')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create exam (ADMIN only)' })
  async createExam(
    @Body() body: { name: string; description?: string },
    @Req() req: Request,
  ) {
    const exam = await this.syllabusService.createExam(body, req.userId!);
    return { success: true, data: exam };
  }

  @Get('exams')
  @ApiOperation({ summary: 'List all exams with full syllabus tree' })
  async getExams() {
    const exams = await this.syllabusService.getExams();
    return { success: true, data: exams };
  }

  @Patch('exams/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update exam (ADMIN only)' })
  async updateExam(
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string },
    @Req() req: Request,
  ) {
    const exam = await this.syllabusService.updateExam(id, body, req.userId!);
    return { success: true, data: exam };
  }

  @Delete('exams/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Soft-delete exam (ADMIN only)' })
  async deleteExam(@Param('id') id: string, @Req() req: Request) {
    await this.syllabusService.deleteExam(id, req.userId!);
    return { success: true };
  }

  // ── Subjects ──
  @Post('subjects')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create subject (ADMIN only)' })
  async createSubject(
    @Body() body: { examId: string; name: string; code: string },
    @Req() req: Request,
  ) {
    const subject = await this.syllabusService.createSubject(body, req.userId!);
    return { success: true, data: subject };
  }

  @Get('subjects')
  @ApiOperation({ summary: 'List subjects for an exam' })
  async getSubjects(@Query('examId') examId: string) {
    const subjects = await this.syllabusService.getSubjects(examId);
    return { success: true, data: subjects };
  }

  @Patch('subjects/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update subject (ADMIN only)' })
  async updateSubject(
    @Param('id') id: string,
    @Body() body: { name?: string; code?: string },
    @Req() req: Request,
  ) {
    const subject = await this.syllabusService.updateSubject(id, body, req.userId!);
    return { success: true, data: subject };
  }

  // ── Topics ──
  @Post('topics')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create topic (ADMIN only)' })
  async createTopic(
    @Body() body: { subjectId: string; name: string },
    @Req() req: Request,
  ) {
    const topic = await this.syllabusService.createTopic(body, req.userId!);
    return { success: true, data: topic };
  }

  @Get('topics')
  @ApiOperation({ summary: 'List topics for a subject' })
  async getTopics(@Query('subjectId') subjectId: string) {
    const topics = await this.syllabusService.getTopics(subjectId);
    return { success: true, data: topics };
  }

  @Patch('topics/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update topic (ADMIN only)' })
  async updateTopic(
    @Param('id') id: string,
    @Body() body: { name?: string },
    @Req() req: Request,
  ) {
    const topic = await this.syllabusService.updateTopic(id, body, req.userId!);
    return { success: true, data: topic };
  }

  // ── Subtopics ──
  @Post('subtopics')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create subtopic (ADMIN only)' })
  async createSubtopic(
    @Body() body: { topicId: string; name: string },
    @Req() req: Request,
  ) {
    const subtopic = await this.syllabusService.createSubtopic(body, req.userId!);
    return { success: true, data: subtopic };
  }

  @Get('subtopics')
  @ApiOperation({ summary: 'List subtopics for a topic' })
  async getSubtopics(@Query('topicId') topicId: string) {
    const subtopics = await this.syllabusService.getSubtopics(topicId);
    return { success: true, data: subtopics };
  }

  @Patch('subtopics/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update subtopic (ADMIN only)' })
  async updateSubtopic(
    @Param('id') id: string,
    @Body() body: { name?: string },
    @Req() req: Request,
  ) {
    const subtopic = await this.syllabusService.updateSubtopic(id, body, req.userId!);
    return { success: true, data: subtopic };
  }
}
