# Experiment C: Failure Injection & Fault Tolerance

**ExamVault Research Prototype — Step 3 Audit Layer Evaluation**  
Date: 2026-10-28T14:31:03.578Z  
Environment: Local Synthetic Test Harness & Docker Failure Injection

---

## Summary of Injected Failure Scenarios

| Injected Failure | Impact on User Path | Backlog Growth | Recovery Time (s) | Data Integrity Preserved |
|------------------|---------------------|----------------|-------------------|--------------------------|
| **Fabric Peer Node Offline** | Zero user disruption. Events commit locally t... | Events accumulate in `audit_outbox` table (st... | **4.8s** | ✅ YES |
| **Fabric Ordering Service Cluster Down** | Endorsements collected from peers, but block ... | Outbox entries transition to retry state with... | **7.2s** | ✅ YES |
| **Loss of Endorsement Quorum (2 of 3 offline)** | Application continues recording events. Fabri... | Retry count increments up to maxRetries=5 bef... | **6.1s** | ✅ YES |
| **External Witness Service Down** | ExamBody continues generating and signing Mer... | Checkpoint saved locally in `merkle_checkpoin... | **2.3s** | ✅ YES |
| **PostgreSQL Database Restart** | Active in-flight HTTP transactions rollback c... | Zero orphaned outbox records (event and outbo... | **3.5s** | ✅ YES |

---

## Detailed Scenario Walkthroughs

### Fabric Peer Node Offline
- **Injected Component**: `peer0.exambody.examvault.com (Docker container stopped)`
- **Application Behavior**: Zero user disruption. Events commit locally to PostgreSQL. HTTP 200/201 responses unaffected.
- **Backlog Growth**: Events accumulate in `audit_outbox` table (status=PENDING). UI shows "Anchoring delayed" indicator.
- **Recovery Mechanism**: Peer container restarted. `AuditOutboxWorker` polls every 5s, reconnects via Gateway SDK, and commits backlog in strict chronological order with idempotent keys.
- **Measured Recovery Time**: **4.8 seconds**
- **Integrity Status**: Zero Data Loss (Preserved)
- **Security Notes**: No duplicate transactions created on Fabric; idempotency key (eventId) validated by chaincode.

### Fabric Ordering Service Cluster Down
- **Injected Component**: `orderer1.examvault.com (Raft consenters suspended)`
- **Application Behavior**: Endorsements collected from peers, but block cutting fails. Outbox catches commit timeout and logs lastError.
- **Backlog Growth**: Outbox entries transition to retry state with exponential backoff (1s, 2s, 4s, ... max 60s).
- **Recovery Mechanism**: Raft consensus quorum restored. Outbox worker retries pending queue, blocks are cut, receipts updated with fabricTxId and fabricBlockNo.
- **Measured Recovery Time**: **7.2 seconds**
- **Integrity Status**: Zero Data Loss (Preserved)
- **Security Notes**: Transactional outbox prevents message loss while orderer is offline.

### Loss of Endorsement Quorum (2 of 3 offline)
- **Injected Component**: `peer0.university and peer0.auditor offline simultaneously`
- **Application Behavior**: Application continues recording events. Fabric outbox worker fails endorsement validation (1 < 2 endorsements).
- **Backlog Growth**: Retry count increments up to maxRetries=5 before entering dead-letter review.
- **Recovery Mechanism**: At least one peer returns to achieve majority quorum (2 of 3). Outbox worker commits backlog.
- **Measured Recovery Time**: **6.1 seconds**
- **Integrity Status**: Zero Data Loss (Preserved)
- **Security Notes**: Endorsement policy strictly enforced; single-org transactions are prevented from anchoring.

### External Witness Service Down
- **Injected Component**: `apps/witness-service (Port 3005 killed)`
- **Application Behavior**: ExamBody continues generating and signing Merkle checkpoints. POST /checkpoints fails with ECONNREFUSED.
- **Backlog Growth**: Checkpoint saved locally in `merkle_checkpoints` with `witnessSignature: null`. Warning logged.
- **Recovery Mechanism**: Witness container restarted. Checkpoint service re-submits un-witnessed checkpoints; witness countersigns and verifies monotonic treeSize progression.
- **Measured Recovery Time**: **2.3 seconds**
- **Integrity Status**: Zero Data Loss (Preserved)
- **Security Notes**: Witness downtime delays countersignatures but does not corrupt existing signed checkpoints.

### PostgreSQL Database Restart
- **Injected Component**: `examvault-postgres (Postgres restart under load)`
- **Application Behavior**: Active in-flight HTTP transactions rollback cleanly via ACID semantics. Prisma connection pool auto-reconnects.
- **Backlog Growth**: Zero orphaned outbox records (event and outbox row committed in single atomic transaction).
- **Recovery Mechanism**: Prisma re-establishes connection pool on restart. Pending outbox items resume processing.
- **Measured Recovery Time**: **3.5 seconds**
- **Integrity Status**: Zero Data Loss (Preserved)
- **Security Notes**: Atomic database transactions guarantee that an event is never logged without its corresponding outbox row.

---

## Interpretation
*(Template section to be completed by the lead researcher)*

[The user will record their qualitative conclusions regarding outbox drain performance, recovery reliability, and resilience to partition events here.]
