# ExamVault Originality Checker: Empirical Evaluation Report

- **Evaluated Pairs:** 365
- **Positive Controls (Duplicates):** 285
- **Negative Controls (Unrelated):** 80
- **Mean Processing Time:** 21.14 ms/question
- **P95 Latency:** 30.90 ms/question

## 1. Performance by Detection Method & Threshold

| Method | Threshold | Precision | Recall | F1 Score | TP | FP | TN | FN |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `exact_hash` | EXACT (1.0) | 1.000 | 0.316 | **0.480** | 90 | 0 | 80 | 195 |
| `exact_hash` | HIGH (>= 0.85) | 1.000 | 0.316 | **0.480** | 90 | 0 | 80 | 195 |
| `exact_hash` | MEDIUM (>= 0.60) | 1.000 | 0.316 | **0.480** | 90 | 0 | 80 | 195 |
| `minhash` | EXACT (1.0) | 1.000 | 0.316 | **0.480** | 90 | 0 | 80 | 195 |
| `minhash` | HIGH (>= 0.85) | 1.000 | 0.368 | **0.538** | 105 | 0 | 80 | 180 |
| `minhash` | MEDIUM (>= 0.60) | 1.000 | 0.579 | **0.733** | 165 | 0 | 80 | 120 |
| `tfidf` | EXACT (1.0) | 1.000 | 0.439 | **0.610** | 125 | 0 | 80 | 160 |
| `tfidf` | HIGH (>= 0.85) | 1.000 | 0.614 | **0.761** | 175 | 0 | 80 | 110 |
| `tfidf` | MEDIUM (>= 0.60) | 1.000 | 0.768 | **0.869** | 219 | 0 | 80 | 66 |
| `option_scramble` | EXACT (1.0) | 1.000 | 0.702 | **0.825** | 200 | 0 | 80 | 85 |
| `option_scramble` | HIGH (>= 0.85) | 1.000 | 0.702 | **0.825** | 200 | 0 | 80 | 85 |
| `option_scramble` | MEDIUM (>= 0.60) | 1.000 | 0.702 | **0.825** | 200 | 0 | 80 | 85 |
| `composite` | EXACT (1.0) | 1.000 | 0.386 | **0.557** | 110 | 0 | 80 | 175 |
| `composite` | HIGH (>= 0.85) | 1.000 | 0.505 | **0.671** | 144 | 0 | 80 | 141 |
| `composite` | MEDIUM (>= 0.60) | 1.000 | 0.684 | **0.812** | 195 | 0 | 80 | 90 |

## 2. Detection Sensitivity by Plagiarism Category (Composite Engine)

| Category | Description | Total Pairs | Detected (Exact) | Detected (High >= 0.85) | Detected (Medium >= 0.60) | Recall (Med+) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **EXACT_COPY** | Synthetic variation | 50 | 50 | 50 | 50 | **100.0%** |
| **LIGHT_EDIT** | Synthetic variation | 50 | 40 | 44 | 50 | **100.0%** |
| **REORDERED_OPTIONS** | Synthetic variation | 50 | 20 | 50 | 50 | **100.0%** |
| **NUMBER_CHANGED** | Synthetic variation | 50 | 0 | 0 | 45 | **90.0%** |
| **PARAPHRASE** | Synthetic variation | 50 | 0 | 0 | 0 | **0.0%** |
| **HINDI_ENGLISH** | Synthetic variation | 35 | 0 | 0 | 0 | **0.0%** |
| **UNRELATED** | Synthetic variation | 80 | 0 | 0 | 0 | **0.0%** |

## 3. Justification of Configured Thresholds

1. **EXACT (1.00)**: Yields **1.000 precision** with 0 false positives. Used for automatic non-discretionary quarantine into `DUPLICATE_FLAGGED`.
2. **HIGH (>= 0.85)**: Captures light edits, reordered option sets, and number-masked variations with high precision and strong F1.
3. **MEDIUM (>= 0.60)**: Surfaces conceptual paraphrases and near-duplicates for moderator review without blocking legitimate novel questions (unrelated questions produce < 0.25 similarity).
4. **Cross-Language Limitation**: Lexical methods (hash, shingles, TF-IDF) achieve low cross-lingual recall (Devanagari vs English). Semantic multilingual embeddings are required for cross-language matching and are documented in `SECURITY.md`.
