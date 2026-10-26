# ExamVault: Secure Examination Paper Generation Framework

> **Step 1: Examiner Portal and Question Bank**  
> A zero-trust cryptographic portal where examiners author, version, and submit examination questions into an envelope-encrypted question bank with an append-only, tamper-evident audit trail.

---

## Quickstart Setup in Under 10 Steps

Follow these steps to set up and run the entire ExamVault platform locally:

### 1. Prerequisites
Ensure you have installed:
- **Node.js**: v20+ LTS (`node -v`)
- **pnpm**: v9+ or v12+ (`npm install -g pnpm`)
- **Docker & Docker Compose**: (`docker compose version`)

### 2. Clone and Configure Environment
Copy the example environment file:
```bash
cp .env.example .env
```
*(Development defaults for `MASTER_KEY`, `AUDIT_SIGNING_KEY`, and database passwords are pre-populated for local evaluation)*.

### 3. Install Monorepo Dependencies
```bash
pnpm install
```

### 4. Start Infrastructure Services (Database, MinIO, Mail)
```bash
docker compose up -d postgres minio minio-init mailcatcher
```

### 5. Generate Prisma Client
```bash
pnpm db:generate
```

### 6. Apply Database Migrations
Runs raw SQL migrations with append-only PostgreSQL triggers:
```bash
pnpm db:migrate
```

### 7. Seed Synthetic Data
Seeds the initial administrator from environment variables, 4 sample users, a JEE Advanced syllabus (3 subjects, 29 topics), and 210+ encrypted questions with LaTeX formulas and Hindi Unicode:
```bash
pnpm db:seed
```

### 8. Run Automated Unit & Security Tests
Verify envelope encryption, key wrapping, authorization barriers, and tamper-evident audit chain verification:
```bash
pnpm test
```

### 9. Start the Development Servers
```bash
pnpm dev
```

### 10. Open the Application
- **Examiner Portal (Web)**: [http://localhost:5173](http://localhost:5173)
- **API Swagger Documentation**: [http://localhost:3001/api/docs](http://localhost:3001/api/docs)
- **MinIO Console**: [http://localhost:9001](http://localhost:9001) (`examvault_minio` / `examvault_minio_secret`)
- **MailCatcher UI**: [http://localhost:1080](http://localhost:1080)

*(Or start the entire stack including API and Web containers via `docker compose up -d`)*.

---

## Synthetic Test Accounts

All accounts require mandatory TOTP MFA enrollment at first login:

| Role | Email | Password | Allowed Capabilities |
|------|-------|----------|----------------------|
| **ADMIN** | `admin@examvault.local` | `Admin123!@#$` | Manage users, roles, syllabus tree. **403 Forbidden** on question content. |
| **EXAMINER** | `examiner1@examvault.local` | `Examiner123!@#$` | Author, edit, and submit own questions; CSV bulk import; LaTeX live preview. |
| **AUDITOR** | `auditor@examvault.local` | `Auditor123!@#$` | Read signed audit trail, verify cryptographic chain (`/audit/verify`). **403 Forbidden** on question content. |
| **REVIEWER** | `reviewer@examvault.local` | `Reviewer123!@#$` | Read submitted questions authored by others (Step 2 extension point). |

---

## Core Security & Architectural Guarantees

1. **Envelope Encryption (AES-256-GCM)**:
   - Every question version has its own random 256-bit data key.
   - The data key is wrapped by the master key via `KeyProvider` (`LocalKeyProvider` in dev, with documented interface for HashiCorp Vault / AWS KMS in production).
   - Additional Authenticated Data (AAD) binds the ciphertext to `question_id:version_no`.
   - Answer keys are encrypted in separate envelopes.
2. **Cryptographic Content Commitment**:
   - `content_commitment = SHA-256(salt + canonical_json(content))`.
   - The salt is stored *inside* the encrypted envelope to prevent offline dictionary attacks.
3. **Append-Only Tamper-Evident Audit Chain**:
   - PostgreSQL triggers block `UPDATE` and `DELETE` on `audit_events`.
   - Every event contains `prev_hash`, `entry_hash = SHA-256(prev_hash + canonical_event)`, and an Ed25519 digital signature.
   - `GET /audit/verify` walks the entire chain from genesis and reports any broken link or modified row.
4. **Content Isolation & Role Boundaries**:
   - `ADMIN` and `AUDITOR` receive **HTTP 403 Forbidden** on `/questions/:id/content`.
   - An examiner cannot read or edit questions authored by another examiner.
   - Submitted question versions are immutable; editing creates a new version (`v2`, `v3`).

---

## Deliverables & Documentation Index

- [SECURITY.md](file:///c:/Users/G.P.Tech.%20Solutions/Desktop/ExamVault/SECURITY.md) — Comprehensive threat model, adversary assumptions, envelope encryption details, and known limitations (e.g. text searchability).
- [ARCHITECTURE.md](file:///c:/Users/G.P.Tech.%20Solutions/Desktop/ExamVault/ARCHITECTURE.md) — Architecture diagrams, cryptographic data flows, and Step 2+ extension points.
- [openapi.json](file:///c:/Users/G.P.Tech.%20Solutions/Desktop/ExamVault/openapi.json) — Complete OpenAPI 3.0 specification.
- [apps/api/test/security.spec.ts](file:///c:/Users/G.P.Tech.%20Solutions/Desktop/ExamVault/apps/api/test/security.spec.ts) — Authorization & cryptographic tamper detection tests.
- [apps/api/src/crypto/crypto.service.spec.ts](file:///c:/Users/G.P.Tech.%20Solutions/Desktop/ExamVault/apps/api/src/crypto/crypto.service.spec.ts) — Crypto unit tests (AES-256-GCM round trip, wrong AAD rejection, tampered ciphertext detection).
- [apps/web/e2e/examiner-flow.spec.ts](file:///c:/Users/G.P.Tech.%20Solutions/Desktop/ExamVault/apps/web/e2e/examiner-flow.spec.ts) — Playwright end-to-end user journey test.
