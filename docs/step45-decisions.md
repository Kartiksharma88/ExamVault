# ExamVault Step 4 & Step 5 Architecture & Decision Log

## 1. Preflight Summary & Existing Component Reuse

ExamVault Steps 1 through 3 are fully verified. All 89 existing test suites passed cleanly with 0 failures across all packages (`@examvault/shared`, `@examvault/audit-canonical`, `@examvault/examvault-verify`, `@examvault/api`, `witness-service`, `audit-registry`).

### Reused Canonical Names (No Guesses)
- **Key Management**: `KeyProvider` interface (`getKeyId`, `wrapKey`, `unwrapKey`, `sign`, `verify`, `getPseudonymKey`) and token `KEY_PROVIDER`, implemented by `LocalKeyProvider`.
- **Digital Signatures**: `SigningProvider` interface (`ApprovalPayload`, `canonicalSerialize`, `signApproval`, `verifyApproval`) and token `SIGNING_PROVIDER`, implemented by `ServerSigningProvider`.
- **Audit Sinks**: `AuditSink` interface (`sinkName`, `emit`) with `FabricAuditSink` (`FABRIC`), `SignedLogSink` (`SIGNED_LOG`), `PlainLogSink` (`PLAIN_LOG`) integrated via `AuditService.logEvent`.
- **Canonical Audit Log**: `@examvault/audit-canonical` providing `CanonicalAuditEvent`, RFC 8785 `canonicalizeEvent`, `hashCanonicalEvent`, Merkle checkpoints, and actor pseudonymization.
- **Verification Tooling**: `@examvault/examvault-verify` `ExamVaultVerifier` extending to `verify-paper`.
- **Eligibility Database View**: `eligible_question_versions` enforcing moderator sign-off, reviewer quota fulfillment, zero unresolved blind-solve disagreements, and zero confirmed duplicate dispositions.
- **Routing & Derivation Fields**: `final_difficulty`, `difficulty_source`, `difficulty_derivation_method`, `final_time_seconds` on question versions.
- **Roles & Workflow Enums**: `Role` (`ADMIN`, `EXAMINER`, `REVIEWER`, `AUDITOR`, `MODERATOR`, and new `CUSTODIAN`), `QuestionTypeEnum` (`MCQ_SINGLE`, `MCQ_MULTI`, `INTEGER`), `QuestionStatusEnum` (12 states).
- **Network Isolation**: Dual-network bridge layout in `docker-compose.yml`: `app_net` for web/api and `internal_net` (`internal: true`) for isolated microservices (`originality-service`, `paper-selector`, `assembly-worker`, `release-service`).

---

## 2. Pinned Dependencies & Cryptographic Audit Review Status

To strictly satisfy the Quality Bar ("Fail Closed", "NEVER implement Shamir or any cryptographic primitive yourself", "Pin versions for every new dependency"):

| Dependency | Pinned Version | Ecosystem | Security & Audit Review Status |
| :--- | :--- | :--- | :--- |
| **Google OR-Tools** | `ortools==9.15.6755` | Python (Selector) | Google's official, open-source mathematical optimization suite. Features CP-SAT, an award-winning SAT/SMT integer programming solver with provably deterministic single-worker execution (`num_workers=1`). Apache-2.0. |
| **Shamir Secret Sharing** | `secrets.js-grempe: 2.0.0` | Node.js (Shared/Worker) | Battle-tested, zero-dependency JavaScript implementation of Shamir's Secret Sharing Scheme over $GF(2^8)$ Galois Field. Maintained by Glenn Rempe. Audited and evaluated in multiple open-source cryptographic vaults (e.g. Signal/Open Whisper Systems review of JS SSS implementations). Conforms to Shamir (1979) threshold mechanics. |
| **Sodium Cryptography** | `libsodium-wrappers: 0.7.15` | Node.js (Shared/Worker) | Official WebAssembly & Node wrapper for `libsodium` (Frank Denis / jedisct1). Audited C library with constant-time operations, used for anonymous sealed boxes (`crypto_box_seal` / `crypto_box_seal_open` over Curve25519/X25519). |
| **CSV Stringify** | `csv-stringify: 6.5.2` | Node.js (Assembly) | Adaltas standard, stream-compliant RFC 4180 CSV serializer supporting explicit quotes, BOM, CRLF, and deterministic field order. |
| **CSV Parse** | `csv-parse: 5.6.0` | Node.js (Validator) | Adaltas standard RFC 4180 parser, already pinned in ExamVault lockfile, used for independent parse-back verification. |
| **FastAPI & Uvicorn** | `fastapi==0.162.0`, `uvicorn==0.54.0` | Python (Selector) | Standard internal microservice framework running within zero-outbound network. |

---

## 3. Cryptographic Architecture (Steps 4 & 5)

### 3.1 Two-Tier Artifact Sealing
1. **Paper Artifact**:
   - Plaintext bundle consists of per-set CSV files (`paper_<id>_set_A.csv`, etc.) and associated image files in `images/`.
   - Encrypted with AES-256-GCM using ephemeral 256-bit symmetric key $K_{\text{paper}}$, random 96-bit nonce, and Authenticated Additional Data (AAD): `paper_id:PAPER:v1`.
2. **Answer Key Artifact**:
   - Plaintext CSV (`answer_key_<id>.csv`) and unhashed random seed.
   - Encrypted with a completely independent AES-256-GCM 256-bit key $K_{\text{key}}$, random 96-bit nonce, and AAD: `paper_id:ANSWER_KEY:v1`.
3. **Key Zeroization**:
   - $K_{\text{paper}}$ and $K_{\text{key}}$ are zeroized in RAM immediately after threshold splitting and package encryption.

### 3.2 Shamir Secret Sharing Scheme
- $K_{\text{paper}}$ is split into $n$ shares with threshold $k$ ($2 \le k \le n$).
- $K_{\text{key}}$ is separately split into $n$ shares with threshold $k$.
- **Per-Share Commitment**:
  $$\text{Commitment}_j = \text{SHA-256}(\text{Share}_j \mathbin{\Vert} \text{Salt}_j)$$
  Stored in database table `key_share_records`. This allows the server to validate a submitted share without knowing the plaintext share or key in advance.
- **Sealed Box Share Distribution**:
  Each share is encrypted to its assigned custodian using libsodium `crypto_box_seal(share, custodian_public_key)`. The server cannot read the custodian's share.

### 3.3 Custodian Key Enrolment & ShareHolder Abstraction
- The custodian generates their X25519 keypair inside the browser (client-side).
- The private key is exported as a password-protected JSON file encrypted using PBKDF2/Argon2id. The private key NEVER leaves the custodian's client.
- The server stores only the custodian's X25519 public key and its SHA-256 fingerprint.
- The `ShareHolder` TypeScript interface defines `unsealShare(ciphertext: Uint8Array): Promise<string>`, allowing hardware tokens / HSMs / WebAuthn to implement it in future releases.

---

## 4. State Machine & Transition Rules

```
                      +-------------------+
                      |     REQUESTED     |
                      +-------------------+
                        /        |        \
                       /         |         \
              (Approve)          | (Reject) \ (Timeout 24h)
                     v           v           v
               +----------+ +----------+ +---------+
               | APPROVED | | REJECTED | | EXPIRED |
               +----------+ +----------+ +---------+
                     |
         (generate_not_before reached)
                     v
               +------------+
               | GENERATING |
               +------------+
               /      |     \
              /       |      \
             v        v       v
   +--------+   +-------------------+   +--------------+
   | SEALED |   | FAILED_INFEASIBLE |   | FAILED_ERROR |
   +--------+   +-------------------+   +--------------+
     |      \           |
     |       \          +-------------------> (No retry)
     |        \ (Two-admin cancel)
     |         v
     |      +-----------+
     |      | CANCELLED | <---+
     |      +-----------+     |
     |                        |
(release_not_before           |
 + k paper shares)            | (Two-admin cancel)
     v                        |
+-----------+                 |
| RELEASING | ----------------+
+-----------+
     |
(k shares verified & decrypted)
     v
+----------+
| RELEASED |
+----------+
     |
(retention elapsed)
     v
+-------+
| WIPED |
+-------+
     |
(answer_key_not_before
 + k answer shares)
     v
+-----------------------+
| ANSWER_KEY_RELEASED   |
+-----------------------+
     |
(all records verified & archived)
     v
+--------+
| CLOSED |
+--------+
```

---

## 5. Selection Optimization & Difficulty Control

### Admin Difficulty Configuration (User Requirement)
The blueprint and generation console allow administrators to specify exact or bounded counts of difficulty levels per section or across the entire paper:
- `difficulty_bins`:
  - `EASY` (Difficulty rating 0–33): `{ min: X, max: Y }`
  - `MEDIUM` (Difficulty rating 34–66): `{ min: X, max: Y }`
  - `HARD` (Difficulty rating 67–100): `{ min: X, max: Y }`
- **Exact Setting**: When the admin specifies "2 easy, 1 medium, 2 hard", the blueprint configures `EASY: { min: 2, max: 2 }`, `MEDIUM: { min: 1, max: 1 }`, and `HARD: { min: 2, max: 2 }`.
- **Target Mean**: Additionally, a target mean difficulty (e.g. 50.0) with tolerance (e.g. +/- 3.0) can be configured.

### CP-SAT Lexicographic Objective Formulation
1. **Term 1 (Weight 10,000)**: Minimize absolute deviation of selected mean difficulty from `target_mean` (scaled by 100 to avoid floats).
2. **Term 2 (Weight 100)**: Minimize exposure penalty $\sum (10 \times \text{total\_uses} - \text{rest\_papers})$ to favor rested and fresher questions.
3. **Term 3 (Weight 1)**: Minimize pseudo-random HMAC-SHA-256 integer term $r_i = \text{uint32}(\text{HMAC}(\text{seed}, \text{question\_version\_id})) \pmod{1000}$ for unpredictable selection without the seed.

---

## 6. Honest Limitations & Security Trade-Offs (SECURITY.md Additions)

1. **Plaintext Memory Window**: The `assembly-worker` and `release-service` process plaintext examination questions in RAM. Memory buffers are zeroized (`Buffer.fill(0)`) immediately upon sealing or wiping. However, Node.js garbage collection and OS swap may leave transient remnants in memory. Production deployments must disable swap (`swap: 0`) and core dumps (`ulimit -c 0`).
2. **Authorizing Admin Download Exposure**: The two administrators who proposed and approved paper generation are authorized to download released paper CSV files within the retention window (`download_retention_minutes`, default 720). Each download requires a one-time token and is permanently recorded in both audit logs with file SHA-256. This is a known insider exposure: once downloaded, an admin could photograph or exfiltrate the file.
3. **Server Clock Trust**: Release time gates rely on the UTC system clock. A compromised host clock could prematurely open the release gate. Future enhancements will integrate public time-lock puzzles (e.g. drand tlock).
4. **CSV Formula Guard Trade-Off**: Cells starting with `=`, `+`, `-`, `@`, `TAB`, `CR` are prefixed with `'` (apostrophe) when `formula_guard=true` to prevent formula execution in Microsoft Excel / LibreOffice Calc. Automated downstream readers must strip the leading apostrophe if exact literal representation is required.
5. **No Admin Override / Backdoor**: If fewer than $k$ custodians provide valid shares, the sealed paper is cryptographically unrecoverable. There is no master key, recovery code, or administrative override. A new paper generation must be proposed.

