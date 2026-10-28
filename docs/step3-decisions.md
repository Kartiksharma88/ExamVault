# ExamVault Step 3 Architecture & Version Decisions

## 1. Pinned Versions & Compatibility Matrix

To guarantee deterministic, production-grade operation and avoid version drift between the Fabric network, chaincode runtime, Node.js gateway client, and cryptographic tools, the following versions are pinned:

| Component | Pinned Version | Rationale & Compatibility |
| :--- | :--- | :--- |
| **Hyperledger Fabric Platform** | `2.5.11` (LTS) | Current Long-Term Support (LTS) release of Hyperledger Fabric. Features mature, battle-tested Raft consensus (`etcdraft`), stable channel lifecycle v2, stable gateway protocol, and extended maintenance support. |
| **Hyperledger Fabric CA** | `1.5.12` | Production CA release compatible with Fabric v2.5.x, supporting ECDSA (P-256) and TLS mutual authentication for multi-org PKI. |
| **Fabric Gateway Node.js SDK** | `@hyperledger/fabric-gateway: ^1.7.1` | Official recommended client SDK for Fabric 2.4+. Uses gRPC-over-TLS with peer gateway services, providing built-in endorsement, commit-status listening, and smart retry logic. |
| **Fabric Contract API** | `fabric-contract-api: ~2.5.8` | High-level TypeScript contract API matched directly to Fabric 2.5 LTS chaincode runtime. |
| **Fabric Shim** | `fabric-shim: ~2.5.8` | Core chaincode communication shim corresponding to Contract API 2.5.8. |
| **fabric-samples Reference** | `v2.5.11` | Reference test-network topology adapted for the 3-org (ExamBody, University, Auditor) setup. |
| **RFC 8785 Canonicalization** | `canonicalize: ^2.0.0` | Strict implementation of RFC 8785 (JSON Canonicalization Scheme - JCS) for deterministic serialization across client, chaincode, and verifier. |
| **Node.js Environment** | `>=20.0.0 LTS` | Matches workspace `package.json` engine requirements and modern LTS Node.js cryptographic primitives. |

### Ordering Service: Raft vs. SmartBFT
- **Default Topology**: Raft (`etcdraft`) Crash Fault Tolerant (CFT) ordering service with 3 orderer nodes (`orderer1`, `orderer2`, `orderer3`) across the system. Tolerates $F = 1$ crash failure out of $N = 3$ nodes ($2F + 1 \le N$).
- **SmartBFT (Fabric v3.x Extension)**: Byzantine Fault Tolerant ordering requires Fabric v3.0+ capability and $3F + 1 \le N$ nodes (e.g. 4 nodes minimum to tolerate 1 malicious/equivocating orderer).
- **Decision**: In Step 3, the network scripts provide Raft as the primary default with a modular configuration flag `ORDERING_CONSENSUS=raft|smartbft` documented for comparison.

---

## 2. Environment Capabilities & Preflight Check (Milestone 0)

1. **Pre-existing Tests**: Executed `pnpm test`. All 3 test suites passed (30/30 tests).
2. **Local Environment Detection**:
   - Host OS: Windows 10/11.
   - Node.js & pnpm: Operational.
   - Docker CLI & Docker Compose: Not found in host Windows PATH.
3. **Execution Strategy Under Constraints**:
   - As per Section 0.4 and 14.2 of the specification: all shared packages, canonical models, AuditSink abstractions, chaincode unit test suites (with mock stub `fabric-shim`), outbox services, Design B Merkle checkpoints, external witness service, storage integrity scanner, verifier CLI, UI components, and mock experiment harnesses are fully developed and validated locally.
   - Complete, reproducible Docker & bash scripts for the 3-organization Hyperledger Fabric network are placed in `/blockchain` with step-by-step instructions and milestone gates for container execution.

---

## 3. Privacy & DPDP Act Compliance Rationale

Under the Digital Personal Data Protection (DPDP) Act (India) and GDPR:
1. **Right to Erasure / Immutability Conflict**: Immutable distributed ledgers cannot delete records. Putting personally identifiable information (PII) such as examiner names, emails, question stems, or options directly on-chain creates a permanent privacy violation if data must subsequently be erased or corrected.
2. **Pseudonymization Scheme**:
   - All actors in ledger events are recorded as `actor_pseudonym = HMAC-SHA-256(userId, HMAC_KEY)`.
   - The `HMAC_KEY` is maintained by the `KeyProvider` and never disclosed on-chain.
   - Question stems, options, and answers never enter ledger payloads; only cryptographic SHA-256 commitments (`content_commitment` and `payload_hash`) are anchored.
3. **Limits of Pseudonymization**:
   - Pseudonymity is not full anonymity: an entity that correlates external metadata (such as exact timestamps of approvals and institutional shift schedules) might infer the actor's identity (linkage attacks).
   - However, without the HMAC key and question content key, zero question text or direct PII is exposed.

---

## 4. Endorsement Policy Rationale

The endorsement policy for channel `examvault` on chaincode `audit-registry` is:
```
OutOf(2, 'ExamBodyMSP.peer', 'UniversityMSP.peer', 'AuditorMSP.peer')
```
- **Why a 2-of-3 Majority Policy Matters**:
  If only a single organization (e.g. ExamBody) could endorse audit records, the blockchain would provide no more security than a centralized SQL database under ExamBody's administration.
  With a 2-of-3 endorsement requirement:
  - ExamBody alone cannot commit forged or backdated audit entries.
  - The transaction must be simulated and endorsed by at least one independent institution (either University or Auditor).
  - Even if one organization's peer is compromised, it cannot unilaterally tamper with the ledger state.
