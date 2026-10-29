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
/**
 * Applies formula guard prefixing to string cells if required.
 * When formulaGuard is true: any string whose first character is =, +, -, @, TAB, or CR
 * receives a leading single quote (').
 * Numbers and boolean are never modified.
 */
export declare function guardCsvCell(value: any, formulaGuard: boolean): any;
export declare function formatCsvPaperRow(row: PaperCsvRow, formulaGuard: boolean): Record<string, any>;
export declare function formatCsvAnswerKeyRow(row: AnswerKeyCsvRow, formulaGuard: boolean): Record<string, any>;
export interface CsvOptions {
    bom?: boolean;
    formulaGuard?: boolean;
}
export declare function generateCsvString(rows: any[], options?: CsvOptions): Promise<string>;
export declare function parseCsvString<T = any>(csvText: string): Promise<T[]>;
//# sourceMappingURL=csv.utils.d.ts.map