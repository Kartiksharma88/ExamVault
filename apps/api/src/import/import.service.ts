import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { PrismaService } from '../prisma/prisma.service';
import { QuestionsService } from '../questions/questions.service';
import { SyllabusService } from '../syllabus/syllabus.service';
import { AuditService } from '../audit/audit.service';

interface CsvRow {
  type: string;
  stem: string;
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  correctAnswer: string;
  solution?: string;
  subjectCode: string;
  topicName?: string;
  difficulty: string;
  cognitiveLevel: string;
  marks: string;
  negativeMarks?: string;
  estimatedTimeSeconds: string;
  language?: string;
}

@Injectable()
export class ImportService {
  constructor(
    private prisma: PrismaService,
    private questionsService: QuestionsService,
    private syllabusService: SyllabusService,
    private audit: AuditService,
  ) {}

  /**
   * Get CSV template for bulk import
   */
  getTemplate(): string {
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
  async importCsv(
    csvContent: string,
    userId: string,
  ): Promise<{
    success: boolean;
    totalRows: number;
    importedCount: number;
    errors: { row: number; field: string; message: string }[];
  }> {
    await this.audit.log({
      actorId: userId,
      action: 'IMPORT_START',
      targetType: 'import',
      metadata: { size: csvContent.length },
    });

    let rows: CsvRow[];
    try {
      rows = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } catch (e) {
      throw new BadRequestException('Invalid CSV format');
    }

    if (rows.length === 0) {
      throw new BadRequestException('CSV file is empty');
    }

    // Validate all rows first
    const errors: { row: number; field: string; message: string }[] = [];
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
        if (!row.optionA) errors.push({ row: rowNum, field: 'optionA', message: 'Option A is required for MCQ' });
        if (!row.optionB) errors.push({ row: rowNum, field: 'optionB', message: 'Option B is required for MCQ' });
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
        let topicId: string | undefined;
        if (row.topicName) {
          const topic = await this.syllabusService.getTopicByName(subject.id, row.topicName);
          topicId = topic?.id;
        }

        // Build options array for MCQ types
        let options: { label: string; text: string }[] | undefined;
        if (['MCQ_SINGLE', 'MCQ_MULTI'].includes(row.type)) {
          options = [];
          if (row.optionA) options.push({ label: 'A', text: row.optionA });
          if (row.optionB) options.push({ label: 'B', text: row.optionB });
          if (row.optionC) options.push({ label: 'C', text: row.optionC });
          if (row.optionD) options.push({ label: 'D', text: row.optionD });
        }

        // Build answer key
        let answerKey: any;
        if (row.type === 'MCQ_SINGLE') {
          answerKey = { type: 'MCQ_SINGLE', correct: row.correctAnswer };
        } else if (row.type === 'MCQ_MULTI') {
          answerKey = {
            type: 'MCQ_MULTI',
            correct: row.correctAnswer.split(',').map((s: string) => s.trim()),
          };
        } else {
          answerKey = {
            type: 'INTEGER',
            correct: parseInt(row.correctAnswer, 10),
            tolerance: 0,
          };
        }

        await this.questionsService.create(
          {
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
          },
          userId,
        );
        importedCount++;
      }
    } catch (error) {
      await this.audit.log({
        actorId: userId,
        action: 'IMPORT_FAILURE',
        targetType: 'import',
        metadata: { totalRows: rows.length, importedCount, error: (error as Error).message },
      });
      throw new BadRequestException(
        `Import failed at row ${importedCount + 2}: ${(error as Error).message}`,
      );
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
}
