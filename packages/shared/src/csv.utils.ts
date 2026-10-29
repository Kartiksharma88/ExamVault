import { stringify } from 'csv-stringify';
import { parse } from 'csv-parse';

export interface PaperCsvRow {
  paper_id: string;
  set_code: string;
  question_no: number;
  item_id: string;
  section_code: string;
  section_name: string;
  subject: string;
  topic: string;
  question_type: 'MCQ_SINGLE' | 'MCQ_MULTI' | 'INTEGER';
  marks: number;
  negative_marks: number;
  language: string;
  stem: string;
  option_1: string;
  option_2: string;
  option_3: string;
  option_4: string;
  option_5: string;
  option_6: string;
  image_files: string;
}

export interface AnswerKeyCsvRow {
  paper_id: string;
  set_code: string;
  question_no: number;
  item_id: string;
  question_type: string;
  correct_answer: string;
  marks: number;
  negative_marks: number;
  solution: string;
}

const FORMULA_INJECTION_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];

/**
 * Applies formula guard prefixing to string cells if required.
 * When formulaGuard is true: any string whose first character is =, +, -, @, TAB, or CR
 * receives a leading single quote (').
 * Numbers and boolean are never modified.
 */
export function guardCsvCell(value: any, formulaGuard: boolean): any {
  if (!formulaGuard || typeof value !== 'string' || value.length === 0) {
    return value;
  }
  const firstChar = value.charAt(0);
  if (FORMULA_INJECTION_PREFIXES.includes(firstChar)) {
    return `'${value}`;
  }
  return value;
}

export function formatCsvPaperRow(
  row: PaperCsvRow,
  formulaGuard: boolean,
): Record<string, any> {
  return {
    paper_id: row.paper_id,
    set_code: row.set_code,
    question_no: row.question_no,
    item_id: row.item_id,
    section_code: guardCsvCell(row.section_code, formulaGuard),
    section_name: guardCsvCell(row.section_name, formulaGuard),
    subject: guardCsvCell(row.subject, formulaGuard),
    topic: guardCsvCell(row.topic, formulaGuard),
    question_type: row.question_type,
    marks: row.marks,
    negative_marks: row.negative_marks,
    language: row.language,
    stem: guardCsvCell(row.stem, formulaGuard),
    option_1: guardCsvCell(row.option_1, formulaGuard),
    option_2: guardCsvCell(row.option_2, formulaGuard),
    option_3: guardCsvCell(row.option_3, formulaGuard),
    option_4: guardCsvCell(row.option_4, formulaGuard),
    option_5: guardCsvCell(row.option_5, formulaGuard),
    option_6: guardCsvCell(row.option_6, formulaGuard),
    image_files: guardCsvCell(row.image_files, formulaGuard),
  };
}

export function formatCsvAnswerKeyRow(
  row: AnswerKeyCsvRow,
  formulaGuard: boolean,
): Record<string, any> {
  return {
    paper_id: row.paper_id,
    set_code: row.set_code,
    question_no: row.question_no,
    item_id: row.item_id,
    question_type: row.question_type,
    correct_answer: guardCsvCell(row.correct_answer, formulaGuard),
    marks: row.marks,
    negative_marks: row.negative_marks,
    solution: guardCsvCell(row.solution, formulaGuard),
  };
}

export interface CsvOptions {
  bom?: boolean;
  formulaGuard?: boolean;
}

export async function generateCsvString(
  rows: any[],
  options: CsvOptions = {},
): Promise<string> {
  const { bom = true, formulaGuard = true } = options;

  const guardedRows = rows.map((r) => {
    if ('section_code' in r) {
      return formatCsvPaperRow(r as PaperCsvRow, formulaGuard);
    }
    if ('correct_answer' in r) {
      return formatCsvAnswerKeyRow(r as AnswerKeyCsvRow, formulaGuard);
    }
    return r;
  });

  return new Promise<string>((resolve, reject) => {
    stringify(
      guardedRows,
      {
        header: true,
        bom: bom,
        quoted: true,
        record_delimiter: '\r\n',
      },
      (err, output) => {
        if (err) return reject(err);
        resolve(output);
      },
    );
  });
}

export async function parseCsvString<T = any>(csvText: string): Promise<T[]> {
  return new Promise<T[]>((resolve, reject) => {
    parse(
      csvText,
      {
        columns: true,
        skip_empty_lines: true,
        bom: true,
      },
      (err, records) => {
        if (err) return reject(err);
        resolve(records as T[]);
      },
    );
  });
}

