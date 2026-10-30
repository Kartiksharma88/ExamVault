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
exports.ImportService = void 0;
const common_1 = require("@nestjs/common");
const sync_1 = require("csv-parse/sync");
const prisma_service_1 = require("../prisma/prisma.service");
const questions_service_1 = require("../questions/questions.service");
const syllabus_service_1 = require("../syllabus/syllabus.service");
const audit_service_1 = require("../audit/audit.service");
let ImportService = class ImportService {
    prisma;
    questionsService;
    syllabusService;
    audit;
    constructor(prisma, questionsService, syllabusService, audit) {
        this.prisma = prisma;
        this.questionsService = questionsService;
        this.syllabusService = syllabusService;
        this.audit = audit;
    }
    /**
     * Get CSV template for bulk import
     */
    getTemplate() {
        const headers = [
            'type',
            'stem',
            'optionA',
            'optionB',
            'optionC',
            'optionD',
            'correctAnswer',
            'solution',
            'subjectCode',
            'topicName',
            'difficulty',
            'cognitiveLevel',
            'marks',
            'negativeMarks',
            'estimatedTimeSeconds',
            'language',
        ];
        const exampleRow = [
            'MCQ_SINGLE',
            'What is the SI unit of force?',
            'Newton',
            'Joule',
            'Watt',
            'Pascal',
            'A',
            'Force = mass × acceleration. The SI unit is Newton (N).',
            'PHY',
            'Mechanics',
            '0.3',
            'REMEMBER',
            '4',
            '1',
            '60',
            'EN',
        ];
        return headers.join(',') + '\n' + exampleRow.join(',') + '\n';
    }
    /**
     * Import questions from CSV — all-or-nothing
     */
    async importCsv(csvContent, userId) {
        await this.audit.log({
            actorId: userId,
            action: 'IMPORT_START',
            targetType: 'import',
            metadata: { size: csvContent.length },
        });
        let rows;
        try {
            rows = (0, sync_1.parse)(csvContent, {
                columns: true,
                skip_empty_lines: true,
                trim: true,
            });
        }
        catch (e) {
            throw new common_1.BadRequestException('Invalid CSV format');
        }
        if (rows.length === 0) {
            throw new common_1.BadRequestException('CSV file is empty');
        }
        // Validate all rows first
        const errors = [];
        const validTypes = ['MCQ_SINGLE', 'MCQ_MULTI', 'INTEGER'];
        const validLevels = ['REMEMBER', 'UNDERSTAND', 'APPLY', 'ANALYZE', 'EVALUATE', 'CREATE'];
        const validLanguages = ['EN', 'HI', 'BILINGUAL'];
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowNum = i + 2; // 1-indexed + header
            if (!validTypes.includes(row.type)) {
                errors.push({ row: rowNum, field: 'type', message: `Invalid type: ${row.type}` });
            }
            if (!row.stem || row.stem.trim().length === 0) {
                errors.push({ row: rowNum, field: 'stem', message: 'Stem is required' });
            }
            if (['MCQ_SINGLE', 'MCQ_MULTI'].includes(row.type)) {
                if (!row.optionA)
                    errors.push({ row: rowNum, field: 'optionA', message: 'Option A is required for MCQ' });
                if (!row.optionB)
                    errors.push({ row: rowNum, field: 'optionB', message: 'Option B is required for MCQ' });
            }
            if (!row.correctAnswer) {
                errors.push({ row: rowNum, field: 'correctAnswer', message: 'Correct answer is required' });
            }
            if (!row.subjectCode) {
                errors.push({ row: rowNum, field: 'subjectCode', message: 'Subject code is required' });
            }
            const diff = parseFloat(row.difficulty);
            if (isNaN(diff) || diff < 0 || diff > 1) {
                errors.push({ row: rowNum, field: 'difficulty', message: 'Difficulty must be 0-1' });
            }
            if (!validLevels.includes(row.cognitiveLevel)) {
                errors.push({ row: rowNum, field: 'cognitiveLevel', message: `Invalid level: ${row.cognitiveLevel}` });
            }
            const marks = parseFloat(row.marks);
            if (isNaN(marks) || marks <= 0) {
                errors.push({ row: rowNum, field: 'marks', message: 'Marks must be positive' });
            }
            const time = parseInt(row.estimatedTimeSeconds, 10);
            if (isNaN(time) || time <= 0) {
                errors.push({ row: rowNum, field: 'estimatedTimeSeconds', message: 'Time must be a positive integer' });
            }
            if (row.language && !validLanguages.includes(row.language)) {
                errors.push({ row: rowNum, field: 'language', message: `Invalid language: ${row.language}` });
            }
        }
        // All-or-nothing: if any errors, return them all
        if (errors.length > 0) {
            await this.audit.log({
                actorId: userId,
                action: 'IMPORT_FAILURE',
                targetType: 'import',
                metadata: { totalRows: rows.length, errorCount: errors.length },
            });
            return {
                success: false,
                totalRows: rows.length,
                importedCount: 0,
                errors,
            };
        }
        // Import all rows in a transaction
        let importedCount = 0;
        try {
            for (const row of rows) {
                const subject = await this.syllabusService.getSubjectByCode(row.subjectCode);
                let topicId;
                if (row.topicName) {
                    const topic = await this.syllabusService.getTopicByName(subject.id, row.topicName);
                    topicId = topic?.id;
                }
                // Build options array for MCQ types
                let options;
                if (['MCQ_SINGLE', 'MCQ_MULTI'].includes(row.type)) {
                    options = [];
                    if (row.optionA)
                        options.push({ label: 'A', text: row.optionA });
                    if (row.optionB)
                        options.push({ label: 'B', text: row.optionB });
                    if (row.optionC)
                        options.push({ label: 'C', text: row.optionC });
                    if (row.optionD)
                        options.push({ label: 'D', text: row.optionD });
                }
                // Build answer key
                let answerKey;
                if (row.type === 'MCQ_SINGLE') {
                    answerKey = { type: 'MCQ_SINGLE', correct: row.correctAnswer };
                }
                else if (row.type === 'MCQ_MULTI') {
                    answerKey = {
                        type: 'MCQ_MULTI',
                        correct: row.correctAnswer.split(',').map((s) => s.trim()),
                    };
                }
                else {
                    answerKey = {
                        type: 'INTEGER',
                        correct: parseInt(row.correctAnswer, 10),
                        tolerance: 0,
                    };
                }
                await this.questionsService.create({
                    content: {
                        type: row.type,
                        stem: row.stem,
                        options,
                        solution: row.solution,
                        language: row.language || 'EN',
                    },
                    answerKey,
                    metadata: {
                        subjectId: subject.id,
                        topicId,
                        type: row.type,
                        difficulty: parseFloat(row.difficulty),
                        cognitiveLevel: row.cognitiveLevel,
                        marks: parseFloat(row.marks),
                        negativeMarks: parseFloat(row.negativeMarks || '0'),
                        estimatedTimeSeconds: parseInt(row.estimatedTimeSeconds, 10),
                        language: row.language || 'EN',
                    },
                }, userId);
                importedCount++;
            }
        }
        catch (error) {
            await this.audit.log({
                actorId: userId,
                action: 'IMPORT_FAILURE',
                targetType: 'import',
                metadata: { totalRows: rows.length, importedCount, error: error.message },
            });
            throw new common_1.BadRequestException(`Import failed at row ${importedCount + 2}: ${error.message}`);
        }
        await this.audit.log({
            actorId: userId,
            action: 'IMPORT_SUCCESS',
            targetType: 'import',
            metadata: { totalRows: rows.length, importedCount },
        });
        return {
            success: true,
            totalRows: rows.length,
            importedCount,
            errors: [],
        };
    }
};
exports.ImportService = ImportService;
exports.ImportService = ImportService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        questions_service_1.QuestionsService,
        syllabus_service_1.SyllabusService,
        audit_service_1.AuditService])
], ImportService);
//# sourceMappingURL=import.service.js.map