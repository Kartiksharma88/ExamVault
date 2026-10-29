# ExamVault Step 4 & Step 5 Technical Architecture

## 1. System Components & Service Isolation

```
+---------------------------------------------------------------------------------------------------+
|                                        Browser / Web Client                                       |
|  - Admin Console (Readiness & Generation)           - Custodian Portal (WebCrypto unsealing)      |
+---------------------------------------------------------------------------------------------------+
                                                  | TLS
                                                  v
+---------------------------------------------------------------------------------------------------+
|                                 ExamVault Main API (NestJS)                                       |
|  - Dual-Admin Proposal & Signed Approval            - CASL Permission Gates                       |
|  - Readiness & Metadata Counting Engine             - AuditSink Anchoring (Fabric + Signed Log)   |
+---------------------------------------------------------------------------------------------------+
         |                                        |                                        |
         | (Metadata only)                        | (Encrypted envelopes)                  | (Tokens &
         v                                        v                                        |  Audit)
+-----------------------+              +-----------------------+                           v
|    paper-selector     |              |    assembly-worker    |                +--------------------+
| (FastAPI + CP-SAT)    |              | (Node.js Sandbox RAM) |                |  release-service   |
| internal_net (no net) |              | internal_net (no net) |                | (Node.js tmpfs)    |
| - Feasibility & Solv  |              | - Zeroizes keys       |                | - k-of-n Reconst.  |
| - Lexicographic CP    |              | - Builds RFC 4180 CSV |                | - Time-Gated       |
+-----------------------+              +-----------------------+                +--------------------+
```

---

## 2. Database Schema (Prisma & PostgreSQL)

The schema introduces 11 relational tables, append-only triggers, exclusion groups, and updates the `eligible_question_versions` view.

### 2.1 Schema Tables
1. **`exam_blueprints`**: Master entity for blueprints (exam_id, name, created_by).
2. **`blueprint_versions`**: Immutable versioned blueprints containing sections, topic quotas, difficulty bins (`EASY`, `MEDIUM`, `HARD`), duration, marks, overlap rules, solver parameters, and CSV options. Immutable once approved (`is_approved = true`).
3. **`custodian_groups`**: Group descriptor (name, $n$, $k$).
4. **`custodian_group_members`**: Custodian enrollment records storing custodian user ID, X25519 public key, and public key fingerprint.
5. **`generation_requests`**: Generation proposal (blueprint_version_id, custodian_group_id, proposer_id, windows: `generate_not_before/after`, `release_not_before`, `answer_key_not_before`, export profile, status).
6. **`generation_approvals`**: Signed approvals by a distinct second administrator (`approver_id !== proposer_id`), append-only with immutable triggers.
7. **`papers`**: Core paper record (paper_id, exam_id, request_id, blueprint_version_id, sets_count, status, paper_hash, public_manifest, plaintext_retention_minutes).
8. **`paper_artifacts`**: Artifact storage entries (`PAPER` or `ANSWER_KEY`, ciphertext_url, ciphertext_sha256, key_commitment, nonce, format_version).
9. **`key_share_records`**: Sealed shares per custodian (`custodian_id`, `artifact_type`, `share_index`, `sealed_share` X25519 ciphertext, `share_commitment` SHA-256(share || salt), `status`).
10. **`share_submissions`**: Audit log of submitted shares (`custodian_id`, `artifact_type`, `submitted_at`, `status`). Never stores plaintext shares.
11. **`question_reservations`**: Cryptographic handles `HMAC-SHA256(reservation_key, question_version_id)` bound to an active paper to maintain exposure rules without leaking selected IDs.
12. **`download_tokens`**: One-time scoped download tokens for the two authorizing admins.
13. **`question_exclusion_groups`**: Mapping of question versions to exclusion groups derived from template families or moderator `SIMILAR_ALLOWED` dispositions.

---

## 3. CSV File Specification (RFC 4180)

All CSV files are encoded in UTF-8 with optional Byte Order Mark (`\uFEFF`), CRLF (`\r\n`) line endings, double-quoted cells, and escaped inner quotes (`""`).

### 3.1 Paper File (`paper_<paper_id>_set_<set_code>.csv`)
Columns:
1. `paper_id` (UUID)
2. `set_code` (A, B, C, D)
3. `question_no` (1-indexed, contiguous per set)
4. `item_id` (16-hex pseudonym: first 16 chars of `HMAC-SHA256(K_paper, question_version_id)`)
5. `section_code`
6. `section_name`
7. `subject`
8. `topic`
9. `question_type` (`MCQ_SINGLE`, `MCQ_MULTI`, `INTEGER`)
10. `marks` (number)
11. `negative_marks` (number)
12. `language` (`EN`, `HI`, `BILINGUAL`)
13. `stem` (Raw Markdown + LaTeX)
14. `option_1` (empty for INTEGER)
15. `option_2` (empty for INTEGER)
16. `option_3` (empty for INTEGER)
17. `option_4` (empty for INTEGER)
18. `option_5` (empty if unused or INTEGER)
19. `option_6` (empty if unused or INTEGER)
20. `image_files` (pipe-separated list, e.g. `item_id_1.png|item_id_2.png`)

### 3.2 Answer Key File (`answer_key_<paper_id>.csv`)
Columns:
1. `paper_id`
2. `set_code`
3. `question_no`
4. `item_id`
5. `question_type`
6. `correct_answer` (MCQ_SINGLE: option number `1`..`6`; MCQ_MULTI: ascending pipe-separated `1|3`; INTEGER: string `42`)
7. `marks`
8. `negative_marks`
9. `solution` (included if `include_solutions = true`, else empty)

### 3.3 Formula Guard
When `blueprint.csv.formula_guard = true`, any text field beginning with `=`, `+`, `-`, `@`, `\t`, or `\r` is prepended with `'` (apostrophe). Numeric fields are never altered.

---

## 4. API Endpoints

### Blueprints & Custodians (Admin dual-control)
- `POST /blueprints`: Propose new blueprint.
- `POST /blueprints/:id/approve`: Approve blueprint version (second admin with step-up MFA).
- `GET /blueprints/:id/versions`: List immutable blueprint versions.
- `POST /custodians/groups`: Propose custodian group ($n \ge 3$, $2 \le k \le n$).
- `POST /custodians/enroll`: Custodian enrolls their browser-generated X25519 public key.

### Paper Generation Console
- `GET /generation/bank-overview`: 4 exhaustive counts (Eligible, Pending Reviewer, Pending Moderator, Pending Examiner).
- `GET /generation/readiness?blueprintVersionId=:id`: Numbers-only feasibility check against pool multiplier.
- `POST /generation/requests`: Propose paper generation.
- `POST /generation/requests/:id/approve`: Approve paper generation (signed second-admin step-up MFA).
- `POST /generation/requests/:id/generate`: Trigger generation within execution window.
- `GET /papers/:id`: Paper status, public manifest, share progress ("X of k submitted").
- `POST /papers/:id/cancel`: Two-admin paper cancellation.

### Release & Delivery
- `GET /custodian/assigned-papers`: Papers where the authenticated custodian holds a share.
- `POST /release/submit-share`: Submit unsealed plaintext share (checked against commitment and time gate).
- `POST /papers/:id/download-token`: Issue one-time download token to authorized admin.
- `GET /papers/:id/download?token=:token`: Stream decrypted paper package.
- `GET /papers/:id/answer-key?token=:token`: Stream decrypted answer key & revealed seed (after exam end).

### Auditor Verification
- CLI `verify-paper <paper_id>`: End-to-end cryptographic and constraint verification.

