# ExamVault Security Architecture & Threat Model

## 1. Overview & Threat Model

ExamVault is a zero-trust examination question bank and authoring system designed to protect examination paper contents against insider threats, compromised database administrators, and external attackers.

### Adversary Models Addressed

| Adversary | Capabilities | ExamVault Mitigation |
|-----------|--------------|----------------------|
| **Compromised DBA / DB Leaker** | Direct SQL read/write access to PostgreSQL database | Question stems and answer keys are stored exclusively as AES-256-GCM ciphertexts. The master key is held external to the database. Modifying or deleting audit entries is blocked by PostgreSQL row-level triggers, and any tampering breaks the cryptographic hash chain. |
| **Untrusted Cloud / S3 Admin** | Access to MinIO object storage buckets | All question diagram images and attachments are encrypted before upload. |
| **Malicious Examiner** | Legitimate credentials for authoring questions | Strict isolation via CASL guards: examiners can only read/edit their own questions. Once submitted, questions become immutable. Editing a submitted question automatically creates a new version. |
| **Malicious Administrator** | Legitimate credentials for syllabus and user management | Rigid role boundaries: ADMIN and AUDITOR are barred from content decryption endpoints (`/questions/:id/content`) returning HTTP 403 Forbidden. |
| **Network Eavesdropper** | Man-in-the-middle on network traffic | Session cookies are configured as `httpOnly`, `Secure`, `SameSite=Strict`. API requests enforce TLS, Helmet CSP headers, and anti-CSRF token verification (`X-CSRF-Token`). |

---

## 2. Cryptographic Architecture

### 2.1 Envelope Encryption
Question content and answer keys are protected using a two-tier envelope encryption architecture:

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
- The resulting commitment hash is stored in the database metadata column `content_commitment` and can be publicly verified once the question is released in later phases.

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
3. **Database Trigger Enforcement**:
   PostgreSQL triggers (`block_audit_events_mutation`) intercept and reject any `UPDATE` or `DELETE` statements on `audit_events`.
4. **Independent Verification**:
   The `GET /audit/verify` endpoint walks the entire chain from genesis, recomputing hashes and validating Ed25519 signatures. If any record has been modified, it Pinpoints the exact index and ID of the compromised entry.

---

## 4. Known Security Limitations & Trade-Offs

1. **No Full-Text Search on Question Content**:
   Because question content and formulas are encrypted at rest with non-deterministic AES-256-GCM and individual nonces, PostgreSQL full-text search (`tsvector`) is intentionally impossible without leaking plaintext to the database engine. Search is performed exclusively over unencrypted metadata (Human ID, Subject, Topic, Difficulty, Bloom level, and Question Type).
2. **Development Key Provider**:
   The default `LocalKeyProvider` reads the master key from environment variables (`MASTER_KEY`). For production deployment, configure the `VaultKeyProvider` or `KmsKeyProvider` extension point.
3. **Session Idle Timeout**:
   Sessions are enforced with an idle timeout of 15 minutes and absolute expiration of 1 hour. Re-authentication with TOTP MFA is required upon expiration.
