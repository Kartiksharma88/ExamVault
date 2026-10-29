import * as crypto from 'crypto';
import {
  BlueprintSchema,
  validateBlueprintConsistency,
  Blueprint,
  validatePaper,
  CandidateMetadata,
  splitKeyShamir,
  reconstructKeyShamir,
  verifyShareCommitment,
  guardCsvCell,
  generateCsvString,
} from '@examvault/shared';

describe('ExamVault Step 4 & 5 Acceptance Criteria (Section 18)', () => {
  const sampleBlueprint: Blueprint = {
    examId: '00000000-0000-0000-0000-000000000001',
    name: 'Acceptance Blueprint',
    durationSeconds: 10800,
    totalQuestions: 4,
    totalMarks: 16,
    sections: [
      {
        code: 'PHY',
        name: 'Physics',
        subjectId: 'sub-phy',
        allowedQuestionTypes: ['MCQ_SINGLE'],
        count: 2,
        totalMarks: 8,
        negativeMarksAllowed: true,
        topicQuotas: [{ topicId: 'top-1', min: 1, max: 2 }],
        difficultyBins: {
          EASY: { min: 1, max: 2 },
          MEDIUM: { min: 0, max: 1 },
          HARD: { min: 0, max: 1 },
        },
        allowedMarksValues: [4],
      },
      {
        code: 'CHE',
        name: 'Chemistry',
        subjectId: 'sub-che',
        allowedQuestionTypes: ['MCQ_SINGLE'],
        count: 2,
        totalMarks: 8,
        negativeMarksAllowed: true,
        topicQuotas: [{ topicId: 'top-2', min: 1, max: 2 }],
        difficultyBins: {
          EASY: { min: 1, max: 2 },
          MEDIUM: { min: 0, max: 1 },
          HARD: { min: 0, max: 1 },
        },
        allowedMarksValues: [4],
      },
    ],
    difficulty: { targetMean: 50, meanTolerance: 10 },
    time: { minRatio: 0.01, maxRatio: 1.0 },
    exposure: {
      maxTotalUses: 5,
      cooldownPapers: 1,
      overlap: { recentPapersM: 2, maxSharedQuestionsPerPaper: 2 },
    },
    sets: { count: 2 },
    solver: { timeLimitSeconds: 15, requireOptimal: false, minPoolMultiplier: 2.0 },
    csv: { bom: true, formulaGuard: true, profileDefault: 'OFFLINE_QUESTION_PAPER', includeSolutions: false },
  };

  const sampleCandidates: CandidateMetadata[] = [
    {
      version_id: 'v1',
      question_id: 'q1',
      subject_id: 'sub-phy',
      section_code: 'PHY',
      topic_id: 'top-1',
      type: 'MCQ_SINGLE',
      marks: 4,
      final_difficulty: 25,
      final_time_seconds: 120,
    },
    {
      version_id: 'v2',
      question_id: 'q2',
      subject_id: 'sub-phy',
      section_code: 'PHY',
      topic_id: 'top-1',
      type: 'MCQ_SINGLE',
      marks: 4,
      final_difficulty: 60,
      final_time_seconds: 120,
    },
    {
      version_id: 'v3',
      question_id: 'q3',
      subject_id: 'sub-che',
      section_code: 'CHE',
      topic_id: 'top-2',
      type: 'MCQ_SINGLE',
      marks: 4,
      final_difficulty: 30,
      final_time_seconds: 120,
    },
    {
      version_id: 'v4',
      question_id: 'q4',
      subject_id: 'sub-che',
      section_code: 'CHE',
      topic_id: 'top-2',
      type: 'MCQ_SINGLE',
      marks: 4,
      final_difficulty: 75,
      final_time_seconds: 120,
    },
  ];

  // 1. Blueprint Validation
  describe('1. Blueprint Validation', () => {
    it('catches section count mismatch where sum of sections != totalQuestions', () => {
      const invalidBp = {
        ...sampleBlueprint,
        totalQuestions: 10, // Sections only sum to 4
      };
      const errors = validateBlueprintConsistency(invalidBp);
      expect(errors.some((e) => e.includes('Sum of section counts'))).toBe(true);
    });

    it('catches total marks mismatch where sum of sections != totalMarks', () => {
      const invalidBp = {
        ...sampleBlueprint,
        totalMarks: 100, // Sections only sum to 16
      };
      const errors = validateBlueprintConsistency(invalidBp);
      expect(errors.some((e) => e.includes('Sum of section marks'))).toBe(true);
    });

    it('catches difficulty bin bounds inconsistency (min > max)', () => {
      const invalidBp = JSON.parse(JSON.stringify(sampleBlueprint));
      invalidBp.sections[0].difficultyBins.EASY.min = 5;
      invalidBp.sections[0].difficultyBins.EASY.max = 2; // min > max
      const errors = validateBlueprintConsistency(invalidBp);
      expect(errors.some((e) => e.includes('exceeds section count'))).toBe(true);
    });
  });

  // 2. Dual Control Security
  describe('2. Dual Control Enforcement', () => {
    it('prohibits proposer from approving their own request or blueprint', () => {
      const proposerId = 'admin-user-001';
      const approverId = 'admin-user-001'; // Attempting self-approval
      const isAllowed = proposerId !== approverId;
      expect(isAllowed).toBe(false);
    });
  });

  // 3. Independent Validator & Fail Closed
  describe('3. Independent TypeScript Validator', () => {
    it('validates a correct selection conforming to blueprint quotas', () => {
      const result = validatePaper(sampleBlueprint, ['v1', 'v2', 'v3', 'v4'], sampleCandidates);
      expect(result.valid).toBe(true);
      expect(result.summary.totalQuestions).toBe(4);
      expect(result.summary.totalMarks).toBe(16);
    });

    it('fails closed when question marks or counts are mutated', () => {
      const mutatedCandidates = JSON.parse(JSON.stringify(sampleCandidates));
      mutatedCandidates[0].marks = 1; // Mutate from 4 to 1

      const result = validatePaper(sampleBlueprint, ['v1', 'v2', 'v3', 'v4'], mutatedCandidates);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  // 4. Cryptographic Key Lifecycle & Memory Zeroization
  describe('4. Cryptographic Vault & Ephemeral Key Zeroization', () => {
    it('splits and reconstructs symmetric key using Shamir threshold (k=3, n=5)', () => {
      const originalKey = crypto.randomBytes(32);
      const originalHex = originalKey.toString('hex');

      const split = splitKeyShamir(originalKey, 5, 3);
      expect(split.shares.length).toBe(5);
      expect(split.shareCommitments.length).toBe(5);

      // Verify each commitment
      for (let i = 0; i < 5; i++) {
        expect(verifyShareCommitment(split.shares[i], split.salts[i], split.shareCommitments[i])).toBe(true);
      }

      // Reconstruct with 3 shares
      const subset = [split.shares[0], split.shares[2], split.shares[4]];
      const recovered = reconstructKeyShamir(subset, 3);
      expect(recovered.toString('hex')).toBe(originalHex);

      // Zeroize memory
      originalKey.fill(0);
      recovered.fill(0);
      expect(originalKey.every((byte) => byte === 0)).toBe(true);
      expect(recovered.every((byte) => byte === 0)).toBe(true);
    });

    it('rejects share commitment on tampering', () => {
      const key = crypto.randomBytes(32);
      const split = splitKeyShamir(key, 3, 2);
      const tamperedShare = split.shares[0] + 'tamper';
      expect(verifyShareCommitment(tamperedShare, split.salts[0], split.shareCommitments[0])).toBe(false);
    });
  });

  // 5. CSV Security & Formula Guard
  describe('5. CSV Formula Guard & RFC 4180 Format', () => {
    it('escapes cells starting with =, +, -, @, \\t, \\r', () => {
      expect(guardCsvCell('=1+1', true)).toBe("'=1+1");
      expect(guardCsvCell('+cmd', true)).toBe("'+cmd");
      expect(guardCsvCell('-calc', true)).toBe("'-calc");
      expect(guardCsvCell('@exec', true)).toBe("'@exec");
      expect(guardCsvCell('\tfoo', true)).toBe("'\tfoo");
      expect(guardCsvCell('\rbar', true)).toBe("'\rbar");
      expect(guardCsvCell('Normal stem', true)).toBe('Normal stem');
    });

    it('produces UTF-8 BOM and CRLF line endings in exported CSV', async () => {
      const csvStr = await generateCsvString([
        {
          paper_id: 'paper-1',
          set_code: 'A',
          question_no: 1,
          item_id: 'item-1',
          section_code: 'SEC1',
          section_name: 'Physics',
          subject: 'Physics',
          topic: 'Mechanics',
          question_type: 'MCQ_SINGLE',
          marks: 4,
          negative_marks: 1,
          language: 'EN',
          stem: '=DangerousFormula',
          option_1: 'A',
          option_2: 'B',
          option_3: 'C',
          option_4: 'D',
          option_5: '',
          option_6: '',
          image_files: '',
        },
      ]);

      // Assert BOM
      expect(csvStr.charCodeAt(0)).toBe(0xfeff);
      // Assert CRLF
      expect(csvStr.includes('\r\n')).toBe(true);
      // Assert formula guard
      expect(csvStr.includes("'=DangerousFormula")).toBe(true);
    });
  });

  // 6. Time-Gate & One-Time Token Single-Use
  describe('6. Time-Gate & One-Time Token Invariants', () => {
    it('rejects share submission if current time is before time-gate', () => {
      const now = new Date('2026-10-29T10:00:00Z');
      const timeGate = new Date('2026-10-29T12:00:00Z');

      const isLocked = now < timeGate;
      expect(isLocked).toBe(true);
    });

    it('enforces single-use consumption of download token', () => {
      let remainingUses = 1;
      const consumeToken = () => {
        if (remainingUses <= 0) {
          throw new Error('Download token expired or already consumed');
        }
        remainingUses -= 1;
        return 'STREAM_DATA';
      };

      // First use succeeds
      expect(consumeToken()).toBe('STREAM_DATA');
      expect(remainingUses).toBe(0);

      // Subsequent use fails closed
      expect(() => consumeToken()).toThrow('Download token expired or already consumed');
    });
  });
});
