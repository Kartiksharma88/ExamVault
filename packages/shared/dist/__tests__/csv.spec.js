"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const csv_utils_1 = require("../csv.utils");
describe('CSV Specification & Formula Guard (Section 10 & Acceptance Criteria)', () => {
    it('guards text cells starting with formula injection characters when formulaGuard is true', () => {
        expect((0, csv_utils_1.guardCsvCell)('=SUM(A1:A10)', true)).toBe("'=SUM(A1:A10)");
        expect((0, csv_utils_1.guardCsvCell)('+cmd|/c calc', true)).toBe("'+cmd|/c calc");
        expect((0, csv_utils_1.guardCsvCell)('-100', true)).toBe("'-100");
        expect((0, csv_utils_1.guardCsvCell)('@dangerous', true)).toBe("'@dangerous");
        expect((0, csv_utils_1.guardCsvCell)('\tIndented', true)).toBe("'\tIndented");
        expect((0, csv_utils_1.guardCsvCell)('\rCarriage', true)).toBe("'\rCarriage");
        // Normal text is not altered
        expect((0, csv_utils_1.guardCsvCell)('What is the momentum?', true)).toBe('What is the momentum?');
    });
    it('leaves cells unquoted/unprefixed when formulaGuard is false', () => {
        expect((0, csv_utils_1.guardCsvCell)('=SUM(A1:A10)', false)).toBe('=SUM(A1:A10)');
        expect((0, csv_utils_1.guardCsvCell)('+cmd|/c calc', false)).toBe('+cmd|/c calc');
    });
    it('preserves numeric cells without formula guard alteration', () => {
        expect((0, csv_utils_1.guardCsvCell)(123, true)).toBe(123);
        expect((0, csv_utils_1.guardCsvCell)(-45.5, true)).toBe(-45.5);
        expect((0, csv_utils_1.guardCsvCell)(0, true)).toBe(0);
    });
    it('correctly handles Hindi Devanagari, quotes, commas, newlines, and LaTeX in round-trip CSV', async () => {
        const paperRow = {
            paper_id: '11111111-1111-1111-1111-111111111111',
            set_code: 'A',
            question_no: 1,
            item_id: 'f3a8b2c1d4e56789',
            section_code: 'SEC-PHY',
            section_name: 'Physics (भौतिक विज्ञान)',
            subject: 'Physics',
            topic: 'Kinematics',
            question_type: 'MCQ_SINGLE',
            marks: 4,
            negative_marks: 1,
            language: 'BILINGUAL',
            stem: 'एक कण का वेग $v = 3t^2 + 2t$ है। A particle has velocity $v = 3t^2 + 2t$.\nFind displacement with "quotes" and, commas.',
            option_1: 'Option 1: $10\\text{ m}$',
            option_2: 'Option 2: $20\\text{ m}$',
            option_3: 'Option 3: $30\\text{ m}$',
            option_4: 'Option 4: $40\\text{ m}$',
            option_5: '',
            option_6: '',
            image_files: 'f3a8b2c1d4e56789_1.png|f3a8b2c1d4e56789_2.png',
        };
        const csvOutput = await (0, csv_utils_1.generateCsvString)([paperRow], {
            bom: true,
            formulaGuard: true,
        });
        // Check BOM
        expect(csvOutput.charCodeAt(0)).toBe(0xfeff);
        // Parse back
        const parsedRows = await (0, csv_utils_1.parseCsvString)(csvOutput);
        expect(parsedRows.length).toBe(1);
        const row = parsedRows[0];
        expect(row.paper_id).toBe(paperRow.paper_id);
        expect(row.set_code).toBe(paperRow.set_code);
        expect(Number(row.question_no)).toBe(1);
        expect(row.item_id).toBe(paperRow.item_id);
        expect(row.section_name).toBe(paperRow.section_name);
        expect(row.stem).toBe(paperRow.stem);
        expect(row.image_files).toBe(paperRow.image_files);
    });
    it('correctly maps MCQ_SINGLE, MCQ_MULTI, and INTEGER answers in answer_key CSV', async () => {
        const rows = [
            {
                paper_id: '11111111-1111-1111-1111-111111111111',
                set_code: 'A',
                question_no: 1,
                item_id: 'item1',
                question_type: 'MCQ_SINGLE',
                correct_answer: '2',
                marks: 4,
                negative_marks: 1,
                solution: 'Step 1: calculate derivative.',
            },
            {
                paper_id: '11111111-1111-1111-1111-111111111111',
                set_code: 'A',
                question_no: 2,
                item_id: 'item2',
                question_type: 'MCQ_MULTI',
                correct_answer: '1|3',
                marks: 4,
                negative_marks: 2,
                solution: '',
            },
            {
                paper_id: '11111111-1111-1111-1111-111111111111',
                set_code: 'A',
                question_no: 3,
                item_id: 'item3',
                question_type: 'INTEGER',
                correct_answer: '42',
                marks: 4,
                negative_marks: 0,
                solution: '',
            },
        ];
        const csvOutput = await (0, csv_utils_1.generateCsvString)(rows, {
            bom: true,
            formulaGuard: false,
        });
        const parsed = await (0, csv_utils_1.parseCsvString)(csvOutput);
        expect(parsed.length).toBe(3);
        expect(parsed[0].correct_answer).toBe('2');
        expect(parsed[1].correct_answer).toBe('1|3');
        expect(parsed[2].correct_answer).toBe('42');
    });
});
//# sourceMappingURL=csv.spec.js.map