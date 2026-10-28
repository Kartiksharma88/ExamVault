# Experiment B: Performance Benchmarks & Storage Growth

**ExamVault Research Prototype — Step 3 Audit Layer Evaluation**  
Date: 2026-10-28T13:41:49.873Z  
Repetitions: 5 repetitions with warm-up runs  
Hardware: Intel(R) Core(TM) i7-5600U CPU @ 2.60GHz (4 cores, 7.9 GB RAM)  
OS: Windows_NT 10.0.19045 (x64)  

---

## 1. Critical Event End-to-End Latency & Throughput

For individual critical security events (e.g. `QUESTION_VERSION_COMMITTED`, `APPROVAL_SIGNED`), measuring canonical preparation, SHA-256 forward-chaining, and digital signature generation.

| Concurrency | Mean (ms) | p50 (ms) | p95 (ms) | p99 (ms) | Throughput (ops/sec) |
|-------------|-----------|----------|----------|----------|----------------------|
| 10 | 6 ms | 0.05 ms | 0.13 ms | 297.23 ms | **166.6** ops/s |
| 50 | 0.09 ms | 0.07 ms | 0.15 ms | 0.55 ms | **10,627.9** ops/s |
| 100 | 0.07 ms | 0.04 ms | 0.09 ms | 0.24 ms | **14,339** ops/s |

*Note on Design A (Fabric)*: In async outbox mode, the application user path is not blocked on Fabric block commit latency (~500ms - 2000ms block cutting time). The client receives immediate HTTP 201 response while the background outbox worker asynchronously commits to Fabric.

---

## 2. Bulk Event Batching (RFC 6962 Merkle Tree Overhead)

Bulk events (e.g. content reads, user logins) are grouped into batches of size $N$ and anchored via Merkle root checkpoints.

| Batch Size ($N$) | Total Tree Generation (ms) | Overhead Per Event (μs) |
|------------------|----------------------------|-------------------------|
| 10 | 1.8 ms | **179.9 μs/event** |
| 50 | 1.28 ms | **25.7 μs/event** |
| 100 | 2.62 ms | **26.2 μs/event** |
| 500 | 16.57 ms | **33.1 μs/event** |
| 1000 | 27.78 ms | **27.8 μs/event** |

---

## 3. Storage Growth per 100,000 Audit Events

Comparison of disk and database footprint per 100k events across both designs:

| Component | Storage Footprint (MB / 100k events) | Description |
|-----------|--------------------------------------|-------------|
| **PostgreSQL Audit Log** | **55.3 MB** | Primary signed audit events table + indexes |
| **Design B (Signed Log + Witness)** | **55.3 MB** | PostgreSQL log + 0.21 MB witness append-only store |
| **Design A (Hyperledger Fabric)** | **233.7 MB** | PostgreSQL + transactional outbox + Fabric block storage & World State |
| **External Witness Ledger** | **0.21 MB** | 1,000 checkpoint roots (batch size = 100) |

---

## 4. Independent Verifier Scalability (Log Size vs Verification Time)

Measuring full end-to-end verification of cryptographic hash chains across various log volumes.

| Log Size (Events) | Total Verification Time (ms) | Verification Speed (events/sec) |
|-------------------|-----------------------------|---------------------------------|
| 100 | 3.2 ms | **31,268.6 events/s** |
| 500 | 16 ms | **31,293.4 events/s** |
| 1,000 | 21.8 ms | **45,857.7 events/s** |
| 2,500 | 59.6 ms | **41,964.8 events/s** |
| 5,000 | 99.4 ms | **50,324.6 events/s** |

---

## Interpretation
*(Template section to be completed by the lead researcher)*

[The user will record their analysis regarding architectural tradeoffs between throughput, storage overhead, and verification latency here.]
