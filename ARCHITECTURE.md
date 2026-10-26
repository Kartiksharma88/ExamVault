# ExamVault Architecture Document

## 1. System Overview

ExamVault is a research prototype implementing Step 1 (Examiner Portal and Question Bank) of an end-to-end secure examination generation framework.

```mermaid
graph TB
    subgraph "Frontend — apps/web (React 18 + Vite + Tailwind)"
        LOGIN[Login & TOTP MFA Flow]
        DASH[Examiner Bank Dashboard]
        EDITOR[LaTeX/KaTeX Question Editor]
        ADMIN_UI[Users & Syllabus Management]
        AUDIT_UI[Audit Chain Integrity Inspector]
        IMPORT_UI[All-Or-Nothing CSV Importer]
        STATS_UI[Zero-Leak Bank Analytics]
    end

    subgraph "Backend — apps/api (NestJS 10 REST API)"
        AUTH_MOD[Auth Module: Argon2id + TOTP + Session Cookies]
        SYLLABUS_MOD[Syllabus Module: Exam > Subject > Topic > Subtopic]
        QUESTIONS_MOD[Questions Module: Envelope Encryption & Versioning]
        CRYPTO_MOD[Crypto Module: AES-256-GCM + Ed25519 Signatures]
        AUDIT_MOD[Audit Module: Append-Only Hash Chain + /audit/verify]
        IMPORT_MOD[CSV Bulk Import Engine]
        STATS_MOD[Metadata Aggregator]
    end

    subgraph "Storage & Infrastructure"
        POSTGRES[(PostgreSQL 16: Encrypted Relational Store + Triggers)]
        MINIO[(MinIO S3: Encrypted Diagram Attachments)]
        KEY_PROV[KeyProvider: LocalKeyProvider / Vault / KMS]
    end

    LOGIN --> AUTH_MOD
    DASH --> QUESTIONS_MOD
    EDITOR --> QUESTIONS_MOD
    ADMIN_UI --> SYLLABUS_MOD
    ADMIN_UI --> AUTH_MOD
    AUDIT_UI --> AUDIT_MOD
    IMPORT_UI --> IMPORT_MOD
    STATS_UI --> STATS_MOD

    AUTH_MOD --> POSTGRES
    QUESTIONS_MOD --> CRYPTO_MOD
    CRYPTO_MOD --> KEY_PROV
    QUESTIONS_MOD --> POSTGRES
    QUESTIONS_MOD --> MINIO
    AUDIT_MOD --> POSTGRES
    AUDIT_MOD --> CRYPTO_MOD
```

---

## 2. Encryption & Decryption Data Flow

```mermaid
sequenceDiagram
    autonumber
    actor Examiner
    participant Web as Examiner Portal
    participant API as QuestionsService
    participant Crypto as CryptoService
    participant KeyProv as KeyProvider (Master Key)
    participant DB as PostgreSQL Store

    Examiner->>Web: Input stem, LaTeX formula, options, correct answer
    Web->>API: POST /questions { content, answerKey, metadata }
    API->>API: Sanitize Markdown (strip raw HTML)
    API->>Crypto: computeCommitment(content)
    Crypto-->>API: commitment = SHA-256(salt + canonicalJSON(content))
    API->>Crypto: encrypt(contentWithSalt, AAD = questionId:versionNo)
    Crypto->>Crypto: Generate random 256-bit Data Key (K_data) & 96-bit Nonce
    Crypto->>Crypto: Encrypt payload with AES-256-GCM -> (Ciphertext, Tag)
    Crypto->>KeyProv: wrapKey(K_data)
    KeyProv-->>Crypto: Wrapped Data Key (K_wrapped)
    Crypto-->>API: ContentEnvelope { Ciphertext, Nonce, Tag, K_wrapped, keyId }
    API->>Crypto: encrypt(answerKey, AAD = questionId:versionNo)
    Crypto-->>API: AnswerEnvelope { Ciphertext, Nonce, Tag, K_wrapped, keyId }
    API->>DB: INSERT question_versions (ciphertext ONLY, no plaintext stored)
    API->>DB: INSERT audit_events (action: QUESTION_CREATE, signed)
    DB-->>API: Success (EV-PHY-000123)
    API-->>Web: { id, humanId, versionNo: 1, status: DRAFT }
```

---

## 3. Tamper-Evident Audit Chain Flow

```mermaid
sequenceDiagram
    autonumber
    actor Actor as Examiner / Admin / System
    participant API as AuditService
    participant DB as PostgreSQL (audit_events)
    participant Crypto as CryptoService

    Note over API,DB: Logged on logins, MFA, questions, content reads, failures
    API->>DB: SELECT entry_hash FROM audit_events ORDER BY timestamp DESC LIMIT 1
    DB-->>API: prev_hash (or GENESIS if first entry)
    API->>Crypto: entryHash = SHA-256(prev_hash + canonicalJSON(event))
    API->>Crypto: signature = Ed25519.sign(entryHash)
    API->>DB: INSERT INTO audit_events (prev_hash, entry_hash, signature, metadata)
    Note over DB: Postgres Trigger: block_audit_events_mutation<br/>Blocks any UPDATE or DELETE queries

    Note over Actor,DB: Chain Verification: GET /audit/verify
    Actor->>API: GET /audit/verify
    API->>DB: SELECT * FROM audit_events ORDER BY timestamp ASC
    loop For each event in chain
        API->>Crypto: Recompute SHA-256(prev_hash + canonicalJSON)
        API->>Crypto: Verify Ed25519 signature
        alt Hash or Signature mismatch
            API-->>Actor: { valid: false, firstBrokenEntry: { id, index, expected, actual } }
        end
    end
    API-->>Actor: { valid: true, totalEntries: N, verifiedEntries: N }
```

---

## 4. Extension Points for Future Steps

This codebase strictly implements Step 1 while providing clean interfaces for subsequent phases:

1. **Review Workflow (Step 2)**:
   - Question statuses `UNDER_REVIEW`, `APPROVED`, `REJECTED`, `RETIRED` are declared in `QuestionStatusEnum`.
   - `REVIEWER` role exists in auth with CASL permission stubs.
2. **Paper Generation (Step 3)**:
   - Audit action `PAPER_GENERATE` is declared in enum.
   - Bank statistics queries provide blueprint for blueprint-based stratified random selection.
3. **Threshold Key Release (Step 4)**:
   - `KeyProvider` interface allows swapping `LocalKeyProvider` with a Shamir's Secret Sharing (m-of-n) or threshold decryption engine.
4. **Blockchain Audit Anchor (Step 5)**:
   - The head `entry_hash` of the audit log can be periodically anchored into an Ethereum or Hyperledger block.
