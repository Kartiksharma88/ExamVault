"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.guardCsvCell = guardCsvCell;
exports.formatCsvPaperRow = formatCsvPaperRow;
exports.formatCsvAnswerKeyRow = formatCsvAnswerKeyRow;
exports.generateCsvString = generateCsvString;
exports.parseCsvString = parseCsvString;
const csv_stringify_1 = require("csv-stringify");
const csv_parse_1 = require("csv-parse");
const FORMULA_INJECTION_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];
/**
 * Applies formula guard prefixing to string cells if required.
 * When formulaGuard is true: any string whose first character is =, +, -, @, TAB, or CR
 * receives a leading single quote (').
 * Numbers and boolean are never modified.
 */
function guardCsvCell(value, formulaGuard) {
    if (!formulaGuard || typeof value !== 'string' || value.length === 0) {
        return value;
    }
    const firstChar = value.charAt(0);
    if (FORMULA_INJECTION_PREFIXES.includes(firstChar)) {
        return `'${value}`;
    }
    return value;
}
function formatCsvPaperRow(row, formulaGuard) {
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
function formatCsvAnswerKeyRow(row, formulaGuard) {
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
async function generateCsvString(rows, options = {}) {
    const { bom = true, formulaGuard = true } = options;
    const guardedRows = rows.map((r) => {
        if ('section_code' in r) {
            return formatCsvPaperRow(r, formulaGuard);
        }
        if ('correct_answer' in r) {
            return formatCsvAnswerKeyRow(r, formulaGuard);
        }
        return r;
    });
    return new Promise((resolve, reject) => {
        (0, csv_stringify_1.stringify)(guardedRows, {
            header: true,
            bom: bom,
            quoted: true,
            record_delimiter: '\r\n',
        }, (err, output) => {
            if (err)
                return reject(err);
            resolve(output);
        });
    });
}
async function parseCsvString(csvText) {
    return new Promise((resolve, reject) => {
        (0, csv_parse_1.parse)(csvText, {
            columns: true,
            skip_empty_lines: true,
            bom: true,
        }, (err, records) => {
            if (err)
                return reject(err);
            resolve(records);
        });
    });
}
//# sourceMappingURL=csv.utils.js.map