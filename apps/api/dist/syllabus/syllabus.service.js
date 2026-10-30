"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyllabusService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
let SyllabusService = class SyllabusService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    // ── Exams ──
    async createExam(data, actorId) {
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
    async updateExam(id, data, actorId) {
        const exam = await this.prisma.exam.update({ where: { id }, data });
        await this.audit.log({
            actorId,
            action: 'SYLLABUS_UPDATE',
            targetType: 'exam',
            targetId: id,
        });
        return exam;
    }
    async deleteExam(id, actorId) {
        await this.prisma.exam.update({ where: { id }, data: { isActive: false } });
        await this.audit.log({
            actorId,
            action: 'SYLLABUS_DELETE',
            targetType: 'exam',
            targetId: id,
        });
    }
    // ── Subjects ──
    async createSubject(data, actorId) {
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
    async getSubjects(examId) {
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
    async updateSubject(id, data, actorId) {
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
    async createTopic(data, actorId) {
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
    async getTopics(subjectId) {
        return this.prisma.topic.findMany({
            where: { subjectId, isActive: true },
            include: { subtopics: { where: { isActive: true } } },
            orderBy: { name: 'asc' },
        });
    }
    async updateTopic(id, data, actorId) {
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
    async createSubtopic(data, actorId) {
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
    async getSubtopics(topicId) {
        return this.prisma.subtopic.findMany({
            where: { topicId, isActive: true },
            orderBy: { name: 'asc' },
        });
    }
    async updateSubtopic(id, data, actorId) {
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
    async getSubjectByCode(code) {
        const subject = await this.prisma.subject.findFirst({
            where: { code, isActive: true },
        });
        if (!subject)
            throw new common_1.NotFoundException(`Subject with code ${code} not found`);
        return subject;
    }
    async getTopicByName(subjectId, name) {
        return this.prisma.topic.findFirst({
            where: { subjectId, name, isActive: true },
        });
    }
};
exports.SyllabusService = SyllabusService;
exports.SyllabusService = SyllabusService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], SyllabusService);
//# sourceMappingURL=syllabus.service.js.map