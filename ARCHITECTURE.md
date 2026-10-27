# ExamVault Architecture Document

## 1. System Overview

ExamVault is a secure examination paper generation framework prototype. Step 1 (Examiner Portal and Question Bank) and Step 2 (Review, Originality Check, and Approval Workflow) are fully implemented.

```mermaid
graph TB
    subgraph "Frontend — apps/web (React 18 + Vite + Theme Tokens)"
        LOGIN[Login & Step-Up TOTP MFA]
        DASH[Examiner Bank Dashboard]
        EDITOR[LaTeX/KaTeX Question Editor]
        REV_WORKSPACE[Reviewer Workspace: Solve -> Evaluate]
        MOD_CONSOLE[Moderator Console: 5 Tabs & Dispositions]
        ADMIN_POLICIES[Dual-Admin Policies & Corpus Import]
        AUDIT_UI[Audit Chain & Approval Verifier]
        FEEDBACK_MODAL[Author Feedback & Revision Editor]
    end

    subgraph "Backend — apps/api (NestJS 10 REST API)"
        AUTH_MOD[Auth Module: Argon2id + TOTP + Wrapped Ed25519 Keys]
        QUESTIONS_MOD[Questions Module: Envelope Encryption & Revisions]
        REVIEW_MOD[Review Module: Blind Solve Barrier & Random Assignment]
        MODERATION_MOD[Moderation Module: Disagreements & Supersession]
        POLICIES_MOD[Policies Module: Scoped Dual-Admin Approval Rules]
        ORIGINALITY_QUEUE[Screening Worker: PgBoss Background Queue]
        CRYPTO_MOD[Crypto Module: AES-256-GCM + ServerSigningProvider]
        AUDIT_MOD[Audit Module: Append-Only Hash Chain + Ed25519]
        INTERNAL_MOD[Internal Module: Step 4 Eligibility Feed]
    end

    subgraph "Originality Microservice — apps/originality-service (FastAPI)"
        DETECTOR[OriginalityEngine: MinHash LSH + TF-IDF Cosine + Scramble Detection]
        NORMALIZER[Devanagari/LaTeX Normalizer & Number Masking]
        RAM_INDEX[(In-Memory RAM Question Index — Never on Disk)]
    end

    subgraph "Storage & Infrastructure"
        POSTGRES[(PostgreSQL 16: Encrypted Relational Store + Triggers + Views)]
        MINIO[(MinIO S3: Encrypted Diagram Attachments)]
        KEY_PROV[KeyProvider: LocalKeyProvider / Vault / KMS]
    end

    LOGIN --> AUTH_MOD
    DASH --> QUESTIONS_MOD
    EDITOR --> QUESTIONS_MOD
    REV_WORKSPACE --> REVIEW_MOD
    MOD_CONSOLE --> MODERATION_MOD
    ADMIN_POLICIES --> POLICIES_MOD
    AUDIT_UI --> AUDIT_MOD
    FEEDBACK_MODAL --> QUESTIONS_MOD

    QUESTIONS_MOD --> ORIGINALITY_QUEUE
    ORIGINALITY_QUEUE --> DETECTOR
    DETECTOR --> RAM_INDEX
    DETECTOR --> NORMALIZER

    REVIEW_MOD --> CRYPTO_MOD
    MODERATION_MOD --> CRYPTO_MOD
    MODERATION_MOD --> POSTGRES
    INTERNAL_MOD --> POSTGRES
    AUTH_MOD --> POSTGRES
    AUDIT_MOD --> POSTGRES
```

---

## 2. Question Version State Machine

All transitions are strictly enforced in both NestJS application services and PostgreSQL triggers (`trg_question_versions_state_machine` + `question_state_transitions` table). Direct SQL attempts or unauthorized API calls attempting illegal jumps are aborted immediately.

```mermaid
stateDiagram-v2
    [*] --> DRAFT: Author creates question

    DRAFT --> SUBMITTED: Author submits
    SUBMITTED --> SCREENING: System auto-enqueues

    SCREENING --> READY_FOR_REVIEW: Originality check passes (score < medium)
    SCREENING --> DUPLICATE_FLAGGED: Originality score >= threshold

    DUPLICATE_FLAGGED --> READY_FOR_REVIEW: Moderator disposition (NOT_DUPLICATE / SIMILAR_ALLOWED)
    DUPLICATE_FLAGGED --> REJECTED: Moderator disposition (CONFIRMED_DUPLICATE)

    READY_FOR_REVIEW --> UNDER_REVIEW: Cryptographic random assignment of reviewers
    SUBMITTED --> WITHDRAWN: Author withdraws before review starts
    READY_FOR_REVIEW --> WITHDRAWN: Author withdraws before review starts

    UNDER_REVIEW --> CHANGES_REQUESTED: Reviewer requests changes
    UNDER_REVIEW --> REJECTED: Rejection policy met
    UNDER_REVIEW --> MODERATION: Required reviewer approvals received

    MODERATION --> APPROVED: Moderator approval + step-up signature
    MODERATION --> CHANGES_REQUESTED: Moderator requests changes
    MODERATION --> REJECTED: Moderator rejects

    CHANGES_REQUESTED --> DRAFT: Author initiates revision (new version created)
    APPROVED --> RETIRED: Moderator retires question (reason e.g. SUPERSEDED)

    REJECTED --> [*]
    WITHDRAWN --> [*]
    RETIRED --> [*]
```

### Transition Matrix Summary

| Current State | Target State | Trigger / Actor | Condition / Guard |
|---------------|--------------|-----------------|-------------------|
| `DRAFT` | `SUBMITTED` | Author | Content and answer key encrypted; commitment saved |
| `SUBMITTED` | `SCREENING` | System | Auto-enqueued to PgBoss job queue |
| `SCREENING` | `READY_FOR_REVIEW` | System | Originality risk level NONE or LOW |
| `SCREENING` | `DUPLICATE_FLAGGED` | System | Originality risk level MEDIUM, HIGH, or EXACT |
| `DUPLICATE_FLAGGED` | `READY_FOR_REVIEW` | Moderator | Written justification stored encrypted; author cannot moderate |
| `DUPLICATE_FLAGGED` | `REJECTED` | Moderator | Written justification; marked `CONFIRMED_DUPLICATE` |
| `READY_FOR_REVIEW` | `UNDER_REVIEW` | System | Required reviewers assigned via Node crypto RNG respecting COIs |
| `UNDER_REVIEW` | `CHANGES_REQUESTED` | Reviewer | Reviewer decision `REQUEST_CHANGES` with encrypted comments |
| `UNDER_REVIEW` | `REJECTED` | Reviewer | Policy-defined rejection rule |
| `UNDER_REVIEW` | `MODERATION` | System | All required reviewer approvals present; no unresolved disagreements |
| `MODERATION` | `APPROVED` | Moderator | Step-up TOTP MFA + Ed25519 signature; atomic parent supersession |
| `MODERATION` | `CHANGES_REQUESTED` | Moderator | Returns feedback to author; new revision needed |
| `MODERATION` | `REJECTED` | Moderator | Rejection with signed rationale |
| `CHANGES_REQUESTED` | `DRAFT` | Author | Creates new version (`v = currentVersion + 1`); parent preserved |
| `APPROVED` | `RETIRED` | Moderator | Mandatory retirement reason (`SUPERSEDED`, `OUTDATED`, `FLAWED`) |
| `SUBMITTED` / `READY_FOR_REVIEW` | `WITHDRAWN` | Author | Permitted only before reviewers start blind solving |

---

## 3. Screening & Originality Verification Sequence

The originality microservice is isolated in a Docker bridge network with `internal: true` (zero outbound internet routing).

```mermaid
sequenceDiagram
    autonumber
    actor Examiner
    participant API as QuestionsService
    participant Queue as PgBoss Worker (ScreeningQueue)
    participant Orig as Originality Microservice (FastAPI)
    participant DB as PostgreSQL

    Examiner->>API: POST /questions/submit
    API->>DB: UPDATE question_versions SET status = 'SUBMITTED'
    API->>Queue: enqueue({ versionId, stem, options, ... })
    API-->>Examiner: Status SUBMITTED

    Note over Queue: Asynchronous background worker
    Queue->>DB: UPDATE question_versions SET status = 'SCREENING'
    Queue->>Orig: POST /check (mTLS / internal token)
    Note over Orig: 1. Normalize LaTeX, Devanagari, punctuation<br/>2. Exact hash lookup<br/>3. MinHash LSH shingle similarity<br/>4. TF-IDF cosine similarity<br/>5. Option scramble check
    Orig-->>Queue: OriginalityReport { riskLevel, highestScore, matches }
    Queue->>DB: INSERT originality_reports & originality_matches
    alt Risk is EXACT, HIGH, or MEDIUM
        Queue->>DB: UPDATE question_versions SET status = 'DUPLICATE_FLAGGED'
        Queue->>DB: INSERT audit_events (DUPLICATE_FLAGGED)
    else Risk is NONE or LOW
        Queue->>DB: UPDATE question_versions SET status = 'READY_FOR_REVIEW'
        Queue->>Queue: Trigger ReviewService.assignReviewers(versionId)
    end
```

---

## 4. Two-Step Blind Peer Review Sequence

The blind solve barrier is strictly enforced on the server. The answer key and author solution are never decrypted or returned to the reviewer until the blind answer has been persisted.

```mermaid
sequenceDiagram
    autonumber
    actor Reviewer
    participant Web as Reviewer Workspace
    participant API as ReviewService
    participant Crypto as CryptoService
    participant DB as PostgreSQL

    Reviewer->>Web: Open Review Workspace
    Web->>API: GET /review/assignments/:id
    API->>DB: Fetch assignment & questionVersion
    Note over API: Check phase: SOLVE
    API->>Crypto: Decrypt stem & options (AAD = questionId:versionNo)
    Note over API: Server-Enforced Barrier:<br/>answerKey and solution are OMITTED
    API-->>Web: { phase: 'SOLVE', content: { stem, options }, answerKey: null }

    Note over Reviewer,Web: Phase 1: Reviewer blind-solves the question
    Reviewer->>Web: Submit answer, time taken, difficulty rating
    Web->>API: POST /review/assignments/:id/blind-answer
    API->>Crypto: Decrypt actual answer key
    API->>API: Check match: reviewerAnswer === actualKey
    API->>Crypto: Encrypt blind answer (AES-256-GCM envelope)
    API->>DB: UPDATE reviews SET phase = 'EVALUATE', blind_matches_key = isMatch
    alt Mismatch detected
        API->>DB: Set disagreement_flag = true
        API->>DB: INSERT audit_events (DISAGREEMENT_RAISED)
    end
    API-->>Web: { success: true, phase: 'EVALUATE', blindMatchesKey, disagreementFlag }

    Note over Reviewer,Web: Phase 2: Evaluate checklist & final decision
    Reviewer->>Web: Complete 9-point checklist, comments, decision
    Web->>API: POST /review/assignments/:id/evaluate { checklist, decision, totpToken }
    API->>API: Verify fresh step-up TOTP
    API->>Crypto: Sign canonical approval payload with reviewer's Ed25519 key
    API->>DB: INSERT approvals (append-only trigger protected)
    API->>DB: INSERT audit_events (REVIEW_DECISION, signed)
    API-->>Web: { success: true, decision: 'APPROVE' }
```

---

## 5. Architectural Choices & Justifications

### 5.1 Why PgBoss for Job Queueing?
- **Zero Additional Infrastructure**: PgBoss runs on PostgreSQL using `SKIP LOCKED` queries, avoiding Redis, RabbitMQ, or additional network attack surfaces.
- **Transactional Enqueue Semantics**: Question state transitions and screening job enqueues share the same database instance, preventing phantom jobs.
- **Failure Resilience**: If the originality service is offline, jobs retry with exponential backoff; questions remain safely in `SCREENING` without slipping through to review.

### 5.2 Why Memory-Only Index for the Question Bank?
- Unreleased examination questions must never be written to plaintext disk caches or unencrypted search engines.
- The in-memory index is populated at startup via an authenticated streaming feed from the main API and rebuilt in RAM.

### 5.3 Server-Enforced Blind Barrier
- Many web applications attempt to hide answer keys by hiding UI elements. ExamVault enforces the barrier in `ReviewService.getAssignmentWorkspace`: the decryption of `encrypted_answer` is not even invoked while `review.phase === 'SOLVE'`.
