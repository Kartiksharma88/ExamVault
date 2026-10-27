# ExamVault Security Architecture & Threat Model

## 1. Overview & Threat Model

ExamVault is a zero-trust examination question bank, review, and authoring framework designed to protect examination paper contents against insider threats, compromised database administrators, and external attackers.

### Adversary Models Addressed

| Adversary | Capabilities | ExamVault Mitigation |
|-----------|--------------|----------------------|
| **Compromised DBA / DB Leaker** | Direct SQL read/write access to PostgreSQL database | Question stems and answer keys are stored exclusively as AES-256-GCM ciphertexts. The master key is held external to the database. State transitions, approvals, and audit records are protected by PostgreSQL row-level triggers (`trg_question_versions_immutability`, `trg_approvals_append_only`, `trg_question_versions_state_machine`). Manual SQL manipulation breaks the cryptographic hash chain and fails view-level approval checks. |
| **Untrusted Cloud / S3 Admin** | Access to MinIO object storage buckets | All question diagram images and attachments are encrypted before upload. |
| **Malicious Examiner** | Legitimate credentials for authoring questions | Strict isolation via CASL guards: examiners can only read/edit their own questions. Once submitted, questions become immutable. Authoring a revision creates a new draft version (`v2`, `v3`) with mandatory change justification. |
| **Malicious Reviewer / Moderator** | Assigned review or moderation duties | Reviewers operate under double-blind isolation (cannot view author identity; author sees only "Reviewer A/B"). Reviewers must blind-solve before answer keys are unlocked. Authors can never review or moderate their own questions. The same user cannot act as both reviewer and moderator on the same version. |
| **Malicious Administrator** | Legitimate credentials for syllabus, policy, and user management | Rigid role boundaries: `ADMIN` and `AUDITOR` are strictly barred from content decryption endpoints (`/questions/:id/content`, `/review/assignments/:id`) returning HTTP 403 Forbidden. Approval policies require two distinct administrators (`proposerId !== approverId`). |
| **Compromised Microservice / Network Exfiltration** | Malicious injection or compromise of the originality service | The `originality-service` container is attached strictly to a Docker bridge network configured with `internal: true`, with zero outbound internet routing. The service cannot communicate with external search engines, public LLMs, or unauthorized hosts. |
| **Network Eavesdropper** | Man-in-the-middle on network traffic | Session cookies are configured as `httpOnly`, `Secure`, `SameSite=Strict`. API requests enforce TLS, Helmet CSP headers, and anti-CSRF token verification (`X-CSRF-Token`). Step-up TOTP MFA is required for all irreversible approval signatures. |

---

## 2. Cryptographic Architecture

### 2.1 Envelope Encryption
Question content, answer keys, blind answers, and peer review comments are protected using a two-tier envelope encryption architecture:

```
+-----------------------------------------------------------+
|                      Master Key                           |
|       (LocalKeyProvider / AWS KMS / HashiCorp Vault)      |
+-----------------------------------------------------------+
                              |
               Wraps data key | (AES-256-KW / GCM)
                              v
+-----------------------------------------------------------+
|                   Ephemeral Data Key                      |
|            (Random 256-bit key per version)               |
+-----------------------------------------------------------+
                              |
                     Encrypts | (AES-256-GCM with 96-bit nonce)
                              v
+-----------------------------------------------------------+
|      Ciphertext Payload + 128-bit Authentication Tag      |
|         Associated Data (AAD): questionId:versionNo       |
+-----------------------------------------------------------+
```

1. **Ephemeral Data Key**: A cryptographically secure random 256-bit key (`crypto.randomBytes(32)`) is generated for each question version.
2. **Dual Envelopes**: The question stem/options and the answer key are encrypted in separate envelopes using distinct data keys.
3. **Authenticated Additional Data (AAD)**: The string `question_id:version_no` is bound as AAD into AES-256-GCM. Any attempt to transplant a ciphertext from one question or version to another causes decryption authentication to fail.
4. **Key Wrapping & Provider Interface**: Data keys are wrapped by the master key through the extensible `KeyProvider` interface (`apps/api/src/crypto/key-provider.interface.ts`). The `LocalKeyProvider` serves development/testing, with clean extension points for AWS KMS, HashiCorp Vault, or hardware security modules (HSM).

### 2.2 Content Commitment Scheme
To ensure non-repudiation and cryptographic binding without revealing question text in plaintext:
$$\text{Commitment} = \text{SHA-256}(\text{Salt} \mathbin{\Vert} \text{CanonicalJSON}(\text{Content}))$$
- The 128-bit random salt is stored *inside* the encrypted payload, preventing offline dictionary or rainbow table attacks on low-entropy question stems.
- The resulting commitment hash is stored in the database metadata column `content_commitment`. Any change to question text alters this commitment and invalidates all existing signed approvals.

### 2.3 Ed25519 Signed Approval Records
Approvals are recorded in the append-only `approvals` table. Each approval signs a canonical pipe-delimited payload:
$$\text{Payload} = \text{approvalId} \mathbin{\Vert} \text{questionId} \mathbin{\Vert} \text{versionNo} \mathbin{\Vert} \text{contentCommitment} \mathbin{\Vert} \text{decision} \mathbin{\Vert} \text{role} \mathbin{\Vert} \text{approverId} \mathbin{\Vert} \text{round} \mathbin{\Vert} \text{policyVersion} \mathbin{\Vert} \text{timestamp}$$
- Signed using the approver's Ed25519 private key.
- Private keys are wrapped using the `KeyProvider` and stored in `user_signing_keys`.
- Signing requires a fresh step-up TOTP verification at the exact instant of approval.

---

## 3. Tamper-Evident Append-Only Audit Chain

The `audit_events` table maintains an immutable, forward-linked cryptographic log:

```
[Genesis]  -->  [Event 1]  -->  [Event 2]  -->  ...  -->  [Event N]
prev_hash:       prev_hash:      prev_hash:
  0x000...         entry_hash(1)   entry_hash(2)
                 entry_hash:     entry_hash:
                   SHA-256(...)    SHA-256(...)
                 signature:      signature:
                   Ed25519(...)    Ed25519(...)
```

1. **Hash Chain Calculation**:
   $$\text{EntryHash}_i = \text{SHA-256}(\text{EntryHash}_{i-1} \mathbin{\Vert} \text{CanonicalJSON}(\text{Event}_i))$$
2. **Ed25519 Digital Signatures**: Each entry hash is digitally signed using an Ed25519 private key.
3. **Database Trigger Enforcement**: PostgreSQL triggers (`block_audit_events_mutation`) intercept and reject any `UPDATE` or `DELETE` statements on `audit_events`.
4. **Independent Verification**: The `GET /audit/verify` endpoint walks the entire chain from genesis, recomputing hashes and validating Ed25519 signatures.

---

## 4. Honest Security Trade-Offs & Known Limitations

### 4.1 Server-Side Signing Trust Model
- **Current Architecture**: The application server holds user wrapped Ed25519 private keys and unwraps them transiently in memory to perform signatures after verifying a fresh step-up TOTP token.
- **Honest Limitation**: A compromised API server root process could forge approval signatures on a user's behalf without their knowledge.
- **Roadmap / Mitigation**: An abstract `SigningProvider` interface (`apps/api/src/crypto/signing-provider.interface.ts`) is established in Step 2. In Step 3+, server-side signing will be superseded by client-side WebAuthn (FIDO2 / YubiKey hardware tokens), where the private key never leaves the reviewer's physical security token.

### 4.2 Originality Index Privacy vs. Searchability Trade-Off
- **Trade-Off**: Traditional search engines store inverted indexes on disk, which would leak unreleased examination text if the server or backup is compromised.
- **ExamVault Solution**: The question bank index in `apps/originality-service` resides **exclusively in RAM** (`OriginalityEngine`).
- **Restart Cost**: When the `originality-service` container restarts, its in-memory bank index is wiped. It re-synchronizes at startup by streaming normalized tokens over an authenticated internal endpoint (`/internal/originality-feed`) from the main API. On large banks (100,000+ questions), cold-start ingestion introduces a 30–60 second warm-up latency.

### 4.3 Limits of Lexical Cross-Language (Hindi-English) Detection
- **Lexical Bounds**: Standard tokenization, character shingles, and TF-IDF can detect exact matches, light edits, scrambled options, and number changes within the same language script.
- **Cross-Language Limitation**: Lexical algorithms cannot detect a Hindi translation of an English question because Unicode code points (Latin vs. Devanagari) share zero n-gram shingles.
- **Semantic Architecture**: Cross-lingual detection requires multilingual semantic embeddings (e.g. `sentence-transformers` LaBSE / paraphrase-multilingual-mpnet-base-v2). To preserve zero-network isolation, semantic embedding models are configured behind a feature flag (`ENABLE_SEMANTIC_MODEL=false` by default). When enabled, the model weights must be pre-packaged into the local container filesystem without outbound runtime downloads.

### 4.4 Screening Resilience & Denial of Service
- If `originality-service` becomes unreachable or crashes, submitted question versions are **never silently approved or skipped**.
- Versions remain in `SCREENING` state with retry backoff.
- The administrator console displays a live health indicator and alerts moderators if background jobs accumulate.
