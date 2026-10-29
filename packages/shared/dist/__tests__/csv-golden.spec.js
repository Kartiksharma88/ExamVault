"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const csv_utils_1 = require("../csv.utils");
describe('CSV Golden File Tests (Section 10)', () => {
    const goldensDir = path.join(__dirname, 'goldens');
    beforeAll(() => {
        if (!fs.existsSync(goldensDir)) {
            fs.mkdirSync(goldensDir, { recursive: true });
        }
    });
    const fixedQuestions = [
        {
            itemId: 'synth-item-001',
            sectionCode: 'SEC-PHY',
            sectionName: 'Physics (भौतिक विज्ञान)',
            subject: 'Physics',
            topic: 'Mechanics',
            type: 'MCQ_SINGLE',
            marks: 4,
            negMarks: 1,
            language: 'BILINGUAL',
            stem: 'A block of mass $m = 2\\text{ kg}$ is on an inclined plane with $\\theta = 30^\\circ$. What is the normal force?',
            opts: ['17.0 N', '9.8 N', '19.6 N', '4.9 N'],
            images: 'diag1.png',
            answer: '1',
            solution: 'Normal force $N = mg \\cos(30^\\circ) = 2 \\times 9.8 \\times 0.866 \\approx 17.0\\text{ N}$.',
        },
        {
            itemId: 'synth-item-002',
            sectionCode: 'SEC-CHE',
            sectionName: 'Chemistry (रसायन विज्ञान)',
            subject: 'Chemistry',
            topic: 'Stoichiometry',
            type: 'MCQ_SINGLE',
            marks: 4,
            negMarks: 1,
            language: 'EN',
            stem: 'Calculate the molarity of +0.5 moles of NaCl dissolved in 1.0 L of water.',
            opts: ['0.5 M', '1.0 M', '2.0 M', '0.25 M'],
            images: '',
            answer: '1',
            solution: 'Molarity = moles / volume = 0.5 / 1.0 = 0.5 M.',
        },
        {
            itemId: 'synth-item-003',
            sectionCode: 'SEC-MAT',
            sectionName: 'Mathematics (गणित)',
            subject: 'Mathematics',
            topic: 'Differential Calculus',
            type: 'MCQ_SINGLE',
            marks: 4,
            negMarks: 1,
            language: 'EN',
            stem: '=SUM(derivative of $\\sin(x) + \\cos(x)$) at $x = 0$ is:',
            opts: ['+1', '0', '-1', '2'],
            images: '',
            answer: '1',
            solution: 'Derivative is $\\cos(x) - \\sin(x)$. At $x = 0$, $\\cos(0) - \\sin(0) = 1 - 0 = 1$.',
        },
    ];
    const setPermutations = {
        A: [0, 1, 2],
        B: [1, 2, 0],
        C: [2, 0, 1],
        D: [2, 1, 0],
    };
    it('generates and verifies byte-identical golden CSV files across sets A, B, C, D', async () => {
        const paperId = '00000000-0000-0000-0000-000000000099';
        for (const [setCode, perm] of Object.entries(setPermutations)) {
            const paperRows = perm.map((qIdx, orderIdx) => {
                const q = fixedQuestions[qIdx];
                return {
                    paper_id: paperId,
                    set_code: setCode,
                    question_no: orderIdx + 1,
                    item_id: q.itemId,
                    section_code: q.sectionCode,
                    section_name: q.sectionName,
                    subject: q.subject,
                    topic: q.topic,
                    question_type: q.type,
                    marks: q.marks,
                    negative_marks: q.negMarks,
                    language: q.language,
                    stem: q.stem,
                    option_1: q.opts[0],
                    option_2: q.opts[1],
                    option_3: q.opts[2],
                    option_4: q.opts[3],
                    option_5: '',
                    option_6: '',
                    image_files: q.images,
                };
            });
            const paperCsv = await (0, csv_utils_1.generateCsvString)(paperRows, { bom: true, formulaGuard: true });
            const goldenPaperPath = path.join(goldensDir, `golden_paper_set_${setCode}.csv`);
            if (!fs.existsSync(goldenPaperPath)) {
                fs.writeFileSync(goldenPaperPath, paperCsv, 'utf-8');
            }
            const expectedPaperCsv = fs.readFileSync(goldenPaperPath, 'utf-8');
            expect(paperCsv).toBe(expectedPaperCsv);
            // Byte identical check
            expect(Buffer.from(paperCsv)).toEqual(Buffer.from(expectedPaperCsv));
            // Assert BOM and CRLF
            expect(paperCsv.charCodeAt(0)).toBe(0xfeff);
            expect(paperCsv.includes('\r\n')).toBe(true);
            // Verify answer key CSV
            const answerRows = perm.map((qIdx, orderIdx) => {
                const q = fixedQuestions[qIdx];
                return {
                    paper_id: paperId,
                    set_code: setCode,
                    question_no: orderIdx + 1,
                    item_id: q.itemId,
                    question_type: q.type,
                    correct_answer: q.answer,
                    marks: q.marks,
                    negative_marks: q.negMarks,
                    solution: q.solution,
                };
            });
            const answerCsv = await (0, csv_utils_1.generateCsvString)(answerRows, { bom: true, formulaGuard: true });
            const goldenAnswerPath = path.join(goldensDir, `golden_answer_key_set_${setCode}.csv`);
            if (!fs.existsSync(goldenAnswerPath)) {
                fs.writeFileSync(goldenAnswerPath, answerCsv, 'utf-8');
            }
            const expectedAnswerCsv = fs.readFileSync(goldenAnswerPath, 'utf-8');
            expect(answerCsv).toBe(expectedAnswerCsv);
            expect(Buffer.from(answerCsv)).toEqual(Buffer.from(expectedAnswerCsv));
        }
    });
    it('guarantees formula guard escaping in golden CSV for dangerous formula prefixes', async () => {
        const goldenA = fs.readFileSync(path.join(goldensDir, 'golden_paper_set_A.csv'), 'utf-8');
        // Stem starting with =SUM must have '=SUM
        expect(goldenA).toContain("'=SUM(derivative");
        // Options starting with +1 and -1 must have '+1 and '-1
        expect(goldenA).toContain("'+1");
        expect(goldenA).toContain("'-1");
    });
});
//# sourceMappingURL=csv-golden.spec.js.map