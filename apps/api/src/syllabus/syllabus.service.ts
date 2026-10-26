import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class SyllabusService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  // ── Exams ──
  async createExam(data: { name: string; description?: string }, actorId: string) {
    const exam = await this.prisma.exam.create({ data });
    await this.audit.log({
      actorId,
      action: 'SYLLABUS_CREATE',
      targetType: 'exam',
      targetId: exam.id,
      metadata: { name: data.name },
    });
    return exam;
  }

  async getExams() {
    return this.prisma.exam.findMany({
      where: { isActive: true },
      include: {
        subjects: {
          where: { isActive: true },
          include: {
            topics: {
              where: { isActive: true },
              include: {
                subtopics: { where: { isActive: true } },
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async updateExam(id: string, data: { name?: string; description?: string }, actorId: string) {
    const exam = await this.prisma.exam.update({ where: { id }, data });
    await this.audit.log({
      actorId,
      action: 'SYLLABUS_UPDATE',
      targetType: 'exam',
      targetId: id,
    });
    return exam;
  }

  async deleteExam(id: string, actorId: string) {
    await this.prisma.exam.update({ where: { id }, data: { isActive: false } });
    await this.audit.log({
      actorId,
      action: 'SYLLABUS_DELETE',
      targetType: 'exam',
      targetId: id,
    });
  }

  // ── Subjects ──
  async createSubject(data: { examId: string; name: string; code: string }, actorId: string) {
    const subject = await this.prisma.subject.create({ data });
    await this.audit.log({
      actorId,
      action: 'SYLLABUS_CREATE',
      targetType: 'subject',
      targetId: subject.id,
      metadata: { name: data.name, code: data.code },
    });
    return subject;
  }

  async getSubjects(examId: string) {
    return this.prisma.subject.findMany({
      where: { examId, isActive: true },
      include: {
        topics: {
          where: { isActive: true },
          include: {
            subtopics: { where: { isActive: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async updateSubject(id: string, data: { name?: string; code?: string }, actorId: string) {
    const subject = await this.prisma.subject.update({ where: { id }, data });
    await this.audit.log({
      actorId,
      action: 'SYLLABUS_UPDATE',
      targetType: 'subject',
      targetId: id,
    });
    return subject;
  }

  // ── Topics ──
  async createTopic(data: { subjectId: string; name: string }, actorId: string) {
    const topic = await this.prisma.topic.create({ data });
    await this.audit.log({
      actorId,
      action: 'SYLLABUS_CREATE',
      targetType: 'topic',
      targetId: topic.id,
      metadata: { name: data.name },
    });
    return topic;
  }

  async getTopics(subjectId: string) {
    return this.prisma.topic.findMany({
      where: { subjectId, isActive: true },
      include: { subtopics: { where: { isActive: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async updateTopic(id: string, data: { name?: string }, actorId: string) {
    const topic = await this.prisma.topic.update({ where: { id }, data });
    await this.audit.log({
      actorId,
      action: 'SYLLABUS_UPDATE',
      targetType: 'topic',
      targetId: id,
    });
    return topic;
  }

  // ── Subtopics ──
  async createSubtopic(data: { topicId: string; name: string }, actorId: string) {
    const subtopic = await this.prisma.subtopic.create({ data });
    await this.audit.log({
      actorId,
      action: 'SYLLABUS_CREATE',
      targetType: 'subtopic',
      targetId: subtopic.id,
      metadata: { name: data.name },
    });
    return subtopic;
  }

  async getSubtopics(topicId: string) {
    return this.prisma.subtopic.findMany({
      where: { topicId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async updateSubtopic(id: string, data: { name?: string }, actorId: string) {
    const subtopic = await this.prisma.subtopic.update({ where: { id }, data });
    await this.audit.log({
      actorId,
      action: 'SYLLABUS_UPDATE',
      targetType: 'subtopic',
      targetId: id,
    });
    return subtopic;
  }

  // ── Helpers ──
  async getSubjectByCode(code: string) {
    const subject = await this.prisma.subject.findFirst({
      where: { code, isActive: true },
    });
    if (!subject) throw new NotFoundException(`Subject with code ${code} not found`);
    return subject;
  }

  async getTopicByName(subjectId: string, name: string) {
    return this.prisma.topic.findFirst({
      where: { subjectId, name, isActive: true },
    });
  }
}
