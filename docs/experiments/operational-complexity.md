# Experiment D: Operational Complexity Comparison

**ExamVault Research Prototype — Step 3 Audit Layer Evaluation**  
Date: 2026-10-28T13:42:34.352Z  
Scope: Measured quantitative facts on deployment, configuration surface, runtime footprint, and recovery effort.

---

## Comparative Metrics Table

| Operational Metric | PlainLog (Baseline 0) | Design B (Signed Hash Chain + Witness) | Design A (Hyperledger Fabric 3-Org) |
|--------------------|-----------------------|----------------------------------------|-------------------------------------|
| **Setup Steps Required** | 1 step | **3 steps** | **9 multi-stage steps** |
| **Configuration Files** | 1 file | **4 files** | **14 YAML/JSON files** |
| **Config Lines of Code (LoC)** | 12 LoC | **185 LoC** | **1420 LoC** |
| **Runtime Containers / Services** | 1 service | **2 containers** | **10 containers** |
| **PKI & Certificate Overhead** | None | **Low (2 asymmetric Ed25519 keypairs: ExamBody + Witness)** | **High (X.509 PKI, TLS root CAs, mTLS certificates, MSP folder hierarchy, expiration monitoring)** |
| **Key Rotation Overhead** | None | **Moderate (Key rotation registered with new keyId in audit log)** | **High (MSP crypto-refresh, CRL revocation lists, configtx channel update transactions)** |
| **Disaster Recovery Effort** | Low (pg_restore from dump). Zero cryptographic re-keying. | **Low-to-Medium (Restore DB dump; witness independently reconciles monotonic treeSize)** | **High (Orderer Raft snapshot restore, ledger state resynchronization, channel genesis block tracking)** |

---

## Component Breakdown

### 1. PlainLog (Baseline 0)
- Single table (`plain_audit_logs`) without foreign keys or triggers.
- Zero administrative burden, but offers zero cryptographic or Byzantine tamper-evidence.

### 2. Design B (Signed Log + External Witness)
- **Architecture**: In-database forward SHA-256 hash chaining + Ed25519 signatures from ExamBody + periodic RFC 6962 Merkle tree checkpoints.
- **External Witness**: Lightweight Express/Node.js service with an independent keypair and append-only SQLite/file storage.
- **Complexity Assessment**: Low operational overhead. Can be deployed seamlessly as a sidecar container in standard Kubernetes or Docker environments.

### 3. Design A (Hyperledger Fabric 3-Organization Consortium)
- **Architecture**: Enterprise permissioned blockchain with 3 independent Certificate Authorities, 3 Raft orderer consenters, and 3 peer nodes representing ExamBody, University, and Auditor.
- **Complexity Assessment**: Significant infrastructure footprint. Requires managing mutual TLS, crypto materials across 3 organizations, channel genesis blocks, chaincode lifecycle packaging, and endorsement policy checks.

---

## Interpretation
*(Template section to be completed by the lead researcher)*

[The user will record their qualitative conclusions regarding total cost of ownership (TCO), operational viability for educational examination bodies, and maintenance burden here.]
