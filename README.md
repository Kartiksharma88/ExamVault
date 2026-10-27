# ExamVault: Secure Examination Paper Generation Framework

> **Step 1 & Step 2: Question Bank, Review, Originality Check, and Approval Workflow**  
> A zero-trust cryptographic portal where examiners author, screen, peer-review, and moderate examination questions with tamper-evident audit logs, server-enforced blind solving, automated copy checking, and Ed25519 digital approval signatures.

---

## Quickstart Setup

Follow these steps to set up and run the entire ExamVault platform locally:

### 1. Prerequisites
- **Node.js**: v20+ LTS (`node -v`)
- **pnpm**: v9+ or v12+ (`npm install -g pnpm`)
- **Python**: 3.10+ (`python --version`) with `virtualenv` or Docker
- **Docker & Docker Compose**: (`docker compose version`)

### 2. Configure Environment
Copy the example environment file:
```bash
cp .env.example .env
```
*(Development defaults for `MASTER_KEY`, `AUDIT_SIGNING_KEY`, database credentials, and internal service tokens are pre-populated for local evaluation)*.

### 3. Install Monorepo Dependencies
```bash
pnpm install
```

### 4. Apply Database Migrations & Triggers
Applies Step 1 and Step 2 migrations (state machine transition tables, trigger-enforced immutability, append-only approvals, and eligibility views):
```bash
pnpm db:migrate
```

### 5. Seed Synthetic Step 2 Data
Populates the database with:
- 2 Administrators (dual-control approval policy workflow)
- 3 Examiners
- 2 Moderators
- 6 Reviewers with wrapped Ed25519 signing keys and subject tags in Physics, Chemistry, and Mathematics
- 1 Auditor
- Active dual-admin approval policies
- Synthetic past-paper corpus documents
- 210 questions spanning every workflow state (`DRAFT`, `SUBMITTED`, `SCREENING`, `DUPLICATE_FLAGGED`, `READY_FOR_REVIEW`, `UNDER_REVIEW`, `CHANGES_REQUESTED`, `MODERATION`, `APPROVED`, `RETIRED`)

```bash
pnpm db:seed
```

### 6. Run Automated Unit & Acceptance Tests
Executes unit tests, separation-of-duties tests, blind solve barriers, Ed25519 canonical signature verification, and trigger immutability tests:
```bash
pnpm test
```

### 7. Run Originality Service & Evaluation Harness
The originality service checks submitted questions against in-memory bank questions and imported past paper corpora using MinHash LSH, TF-IDF cosine similarity, LaTeX/Devanagari normalization, and option scrambling detection.

To run the automated evaluation harness (evaluating 365+ synthetic question pairs across 7 categories and outputting the Markdown report & CSV):
```bash
cd apps/originality-service
pip install -r requirements.txt
python evaluation_harness.py
```
*(Results are written to `apps/originality-service/originality_evaluation_report.md` and `.csv`)*.

To verify outbound network isolation and log confidentiality:
```bash
python test_isolation.py
```

### 8. Start Development Servers
```bash
pnpm dev
```

### 9. Open Application
- **Web Application**: [http://localhost:5173](http://localhost:5173)
- **API Swagger Documentation**: [http://localhost:3001/api/docs](http://localhost:3001/api/docs)
- **MinIO Console**: [http://localhost:9001](http://localhost:9001) (`examvault_minio` / `examvault_minio_secret`)
- **MailCatcher UI**: [http://localhost:1080](http://localhost:1080)

---

## Synthetic Test Accounts

All accounts require mandatory TOTP MFA enrollment at first login:

| Role | Email | Password | Allowed Capabilities |
|------|-------|----------|----------------------|
| **ADMIN (1)** | `admin@examvault.local` | `Admin123!@#$` | Manage users, syllabus, propose approval policies, import reference corpora. **403 Forbidden** on question content. |
| **ADMIN (2)** | `admin2@examvault.local` | `Admin123!@#$` | Dual-control policy approver (`proposerId !== approverId`). **403 Forbidden** on question content. |
| **MODERATOR (1)** | `moderator1@examvault.local` | `Moderator123!@#$` | 5-tab console: duplicate flags, disagreements, ready for approval, overdue, staffing warnings; final sign-off. |
| **MODERATOR (2)** | `moderator2@examvault.local` | `Moderator123!@#$` | Independent moderator for reassignments and retirements. |
| **REVIEWER (1–6)** | `reviewer1@examvault.local` ... `reviewer6@examvault.local` | `Reviewer123!@#$` | Two-step workspace: blind solve then evaluate; Ed25519 digital signing with step-up MFA. |
| **EXAMINER (1–3)** | `examiner1@examvault.local` ... `examiner3@examvault.local` | `Examiner123!@#$` | Author questions, view double-blind feedback timelines, create revisions with change justification. |
| **AUDITOR** | `auditor@examvault.local` | `Auditor123!@#$` | Verify cryptographic audit chain and approval signatures (`/audit/approvals/verify`). **403 Forbidden** on question content. |

---

## Step 2 Key Features & Architecture

### 1. State Machine & Trigger Immutability
- 12 Workflow States: `DRAFT`, `SUBMITTED`, `SCREENING`, `DUPLICATE_FLAGGED`, `READY_FOR_REVIEW`, `UNDER_REVIEW`, `CHANGES_REQUESTED`, `MODERATION`, `APPROVED`, `REJECTED`, `WITHDRAWN`, `RETIRED`.
- PostgreSQL triggers reject illegal state transitions and direct SQL modifications on submitted question content.

### 2. Dual-Admin Policy Control
- Policies define required reviewer quotas, blind solve mandates, and similarity thresholds.
- Enforces strict dual-control: the proposing administrator cannot approve their own policy (`proposerId !== approverId`).

### 3. Server-Enforced Blind Solve Barrier
- In the `SOLVE` phase, the server withholds the answer key and author solution.
- Only after the reviewer submits their blind answer, time, and difficulty rating is the `EVALUATE` phase unlocked.
- Answer mismatches automatically raise a `DISAGREEMENT` flag, alerting moderators and blocking approval counting.

### 4. Originality Microservice & Confidentiality
- Python FastAPI service in `apps/originality-service`.
- Connected to Docker network with `internal: true` (zero outbound internet access).
- In-memory index for unreleased bank questions (never stored on disk).
- Normalization pipeline handles LaTeX math expressions, Devanagari script, and number masking.

### 5. Ed25519 Signed Approval Records & Atomic Supersession
- Reviews and moderator decisions create append-only signed records in `approvals`.
- Step-up TOTP verification is required at the instant of approval.
- When a revision is approved, the parent version is atomically transitioned to `RETIRED` (`SUPERSEDED`) in the same database transaction.

### 6. Step 4 Paper Generation Eligibility View
- View `eligible_question_versions` verifies valid reviewer and moderator approval counts against the applicable policy.
- Internal-only endpoint `GET /internal/eligible-questions` exposes metadata with zero content leak.

---

## Deliverables & Documentation Index

- [ARCHITECTURE.md](file:///c:/Users/G.P.Tech.%20Solutions/Desktop/ExamVault/ARCHITECTURE.md) — State machine diagram, screening pipeline sequence, blind review flow, and design justifications.
- [SECURITY.md](file:///c:/Users/G.P.Tech.%20Solutions/Desktop/ExamVault/SECURITY.md) — Threat model, server-side signing trust roadmap, originality index privacy trade-offs, and restart costs.
- [apps/originality-service/originality_evaluation_report.md](file:///c:/Users/G.P.Tech.%20Solutions/Desktop/ExamVault/apps/originality-service/originality_evaluation_report.md) — Originality evaluation harness report across 365+ labeled test pairs.
- [openapi.json](file:///c:/Users/G.P.Tech.%20Solutions/Desktop/ExamVault/openapi.json) — Complete OpenAPI 3.0 specification covering all Step 1 and Step 2 endpoints.
- [apps/api/test/step2-workflow.spec.ts](file:///c:/Users/G.P.Tech.%20Solutions/Desktop/ExamVault/apps/api/test/step2-workflow.spec.ts) — Acceptance tests for separation of duties, blind solve, dual-admin policy, and approval signatures.
- [scripts/verify-step2-db.js](file:///c:/Users/G.P.Tech.%20Solutions/Desktop/ExamVault/scripts/verify-step2-db.js) — Verification script for database triggers and eligibility views.
