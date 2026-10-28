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
| **ADMIN (1)** | `admin@examvault.local` | `Admin@ExamVault2024!` | Manage users, syllabus, propose approval policies, import reference corpora. **403 Forbidden** on question content. |
| **ADMIN (2)** | `admin2@examvault.local` | `Admin@ExamVault2024!` | Dual-control policy approver (`proposerId !== approverId`). **403 Forbidden** on question content. |
| **MODERATOR (1)** | `moderator1@examvault.local` | `Examiner@2024!pass` | 5-tab console: duplicate flags, disagreements, ready for approval, overdue, staffing warnings; final sign-off. |
| **MODERATOR (2)** | `moderator2@examvault.local` | `Examiner@2024!pass` | Independent moderator for reassignments and retirements. |
| **REVIEWER (1–6)** | `reviewer1@examvault.local` ... `reviewer6@examvault.local` | `Examiner@2024!pass` | Two-step workspace: blind solve then evaluate; Ed25519 digital signing with step-up MFA. |
| **EXAMINER (1–3)** | `examiner1@examvault.local` ... `examiner3@examvault.local` | `Examiner@2024!pass` | Author questions, view double-blind feedback timelines, create revisions with change justification. |
| **AUDITOR** | `auditor@examvault.local` | `Examiner@2024!pass` | Verify cryptographic audit chain and approval signatures (`/audit/approvals/verify`). **403 Forbidden** on question content. |

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

## Step 3: Encrypted Storage and Audit Registration

Step 3 implements a dual tamper-evident audit layer comparing **Design A (Hyperledger Fabric)** against **Design B (Hardened Signed Hash Chain + External Witness)**, with write-time ciphertext integrity binding, a transactional outbox, an independent verifier CLI, and experimental evaluations.

### Pinned Versions
| Component | Pinned Version | Justification |
|-----------|----------------|---------------|
| **Hyperledger Fabric** | `2.5.11 LTS` | Current stable Long Term Support release; production standard for permissioned consortium networks. |
| **Fabric CA** | `1.5.12` | Current compatible release for Fabric 2.5 MSP management and identity enrollment. |
| **Fabric Gateway SDK** | `@hyperledger/fabric-gateway: ^1.7.1` | Modern gRPC Gateway client SDK for Node.js. |
| **Fabric Contract API** | `fabric-contract-api: ~2.5.8` | Pinned TypeScript chaincode smart contract API for Fabric 2.5 LTS. |
| **Fabric Shim** | `fabric-shim: ~2.5.8` | Pinned runtime interface for chaincode stub interactions. |
| **RFC 8785 Canonicalization** | `canonicalize: ^2.0.0` | Exact byte-for-byte JSON Canonicalization Scheme (JCS) RFC 8785 standard. |

See [docs/step3-decisions.md](file:///c:/Users/G.P.Tech.%20Solutions/Desktop/ExamVault/docs/step3-decisions.md) for full version rationale.

---

### Step 3 Setup & Operations

#### 1. Running the External Witness Service (Design B)
The Witness service is an independent append-only service that countersigns Merkle tree checkpoints and detects history rewrite/fork attacks:
```bash
# Start the witness service on port 3005
cd apps/witness-service
pnpm build
pnpm start
```
Health check: `curl http://localhost:3005/health`

#### 2. Running Hyperledger Fabric Network (Design A)
The Fabric network consists of 3 organizations (`ExamBodyMSP`, `UniversityMSP`, `AuditorMSP`) with 4 CAs, 3 Raft orderer consenters, and 3 peer nodes enforcing a **majority 2-of-3 endorsement policy**:

On Linux / macOS / WSL2 (Docker required):
```bash
cd blockchain/scripts
chmod +x network.sh
./network.sh up              # Starts 3 CAs, generates crypto, launches orderers & peers, creates channel
./network.sh deployChaincode # Deploys audit-registry chaincode with 2-of-3 endorsement policy
./network.sh status          # Checks network and peer status
./network.sh down            # Stops containers and tears down network
```

On Windows PowerShell:
```powershell
cd blockchain\scripts
.\network.ps1 up
.\network.ps1 deployChaincode
```
*(All generated cryptographic materials and MSP certificates are gitignored)*.

#### 3. Running the Independent Verifier CLI (`examvault-verify`)
The standalone verifier CLI operates with zero business logic dependencies, verifying hash chains, Merkle inclusion proofs, Fabric ledger existence, 2-of-3 endorsement sets, witness consistency, and storage ciphertext hashes:

```bash
# Run against an exported JSON dataset (offline mode)
cd packages/examvault-verify
pnpm build
node dist/cli.js --export /path/to/dataset-export.json

# Output as JSON
node dist/cli.js --export /path/to/dataset-export.json --json
```

#### 4. Running Step 3 Experiments (A to D)
Every experiment can be executed with a single command, generating both Markdown and CSV reports:

```bash
# Experiment A: Tamper Detection Matrix (9 scenarios across 4 designs)
pnpm experiment:tamper

# Experiment B: Performance & Storage Growth Benchmarks (latency p50/p95/p99, throughput, Merkle overhead)
pnpm experiment:perf

# Experiment C: Failure Injection (peer down, orderer down, quorum loss, witness down, postgres restart)
pnpm experiment:failure

# Experiment D: Operational Complexity Comparison (setup steps, config lines, container count)
pnpm experiment:ops

# Run all 4 experiments sequentially
pnpm experiment:all
```

Generated reports are located in `docs/experiments/`:
- [docs/experiments/tamper-matrix.md](file:///c:/Users/G.P.Tech.%20Solutions/Desktop/ExamVault/docs/experiments/tamper-matrix.md) and `.csv`
- [docs/experiments/performance-report.md](file:///c:/Users/G.P.Tech.%20Solutions/Desktop/ExamVault/docs/experiments/performance-report.md) and `.csv`
- [docs/experiments/failure-injection.md](file:///c:/Users/G.P.Tech.%20Solutions/Desktop/ExamVault/docs/experiments/failure-injection.md)
- [docs/experiments/operational-complexity.md](file:///c:/Users/G.P.Tech.%20Solutions/Desktop/ExamVault/docs/experiments/operational-complexity.md) and `.csv`

---

## Deliverables & Documentation Index

- [docs/step3-decisions.md](file:///c:/Users/G.P.Tech.%20Solutions/Desktop/ExamVault/docs/step3-decisions.md) — Architectural decisions, pinned version selections, consensus choice (Raft vs SmartBFT), and fault tolerance analysis.
- [docs/step3-architecture.md](file:///c:/Users/G.P.Tech.%20Solutions/Desktop/ExamVault/docs/step3-architecture.md) — Detailed event model specification, dual-sink dispatcher architecture, Merkle tree checkpointing, and sequence diagrams.
- [SECURITY.md](file:///c:/Users/G.P.Tech.%20Solutions/Desktop/ExamVault/SECURITY.md) — Comprehensive threat model, simulated organizational independence note, India's DPDP Act compliance, actor pseudonymization limits, and the honest scope of tamper-evidence.
- [docs/experiments/](file:///c:/Users/G.P.Tech.%20Solutions/Desktop/ExamVault/docs/experiments/) — Markdown and CSV reports for Experiments A, B, C, and D.
- [packages/audit-canonical/](file:///c:/Users/G.P.Tech.%20Solutions/Desktop/ExamVault/packages/audit-canonical/) — RFC 8785 JSON Canonicalization, SHA-256 forward chaining, RFC 6962 Merkle tree, and shared test vectors.
- [packages/examvault-verify/](file:///c:/Users/G.P.Tech.%20Solutions/Desktop/ExamVault/packages/examvault-verify/) — Independent zero-business-logic auditor verification CLI.
- [blockchain/](file:///c:/Users/G.P.Tech.%20Solutions/Desktop/ExamVault/blockchain/) — Hyperledger Fabric 2.5 3-organization network scripts, compose topologies, and `audit-registry` TypeScript chaincode.
- [apps/witness-service/](file:///c:/Users/G.P.Tech.%20Solutions/Desktop/ExamVault/apps/witness-service/) — Standalone append-only External Witness service.
- [ARCHITECTURE.md](file:///c:/Users/G.P.Tech.%20Solutions/Desktop/ExamVault/ARCHITECTURE.md) — System state machine diagram, screening pipeline sequence, and blind review flow.
- [openapi.json](file:///c:/Users/G.P.Tech.%20Solutions/Desktop/ExamVault/openapi.json) — Complete OpenAPI 3.0 specification covering Step 1, 2, and 3 audit endpoints.
