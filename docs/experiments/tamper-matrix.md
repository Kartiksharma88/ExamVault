# Experiment A: Tamper Detection Matrix

**ExamVault Research Prototype — Step 3 Audit Layer Evaluation**  
Date: 2026-10-28T14:31:01.197Z  
Environment: Local Synthetic Test Harness (Disposable local environment)

## Summary Table

| # | Scenario | PlainLog (Baseline 0) | Design B (No Witness) | Design B (With Witness) | Design A (Fabric) |
|---|----------|------------------------|------------------------|-------------------------|-------------------|
| 1 | **Modify field in past event row** | ❌ NO | ✅ YES | ✅ YES | ✅ YES |
| 2 | **Delete a middle event** | ❌ NO | ✅ YES | ✅ YES | ✅ YES |
| 3 | **Reorder events** | ❌ NO | ✅ YES | ✅ YES | ✅ YES |
| 4 | **Truncate the tail of the log** | ❌ NO | ❌ NO | ✅ YES | ✅ YES |
| 5 | **Rewrite entire chain with legitimate signing key** | ❌ NO | ❌ NO | ✅ YES | ✅ YES |
| 6 | **Rewrite chain plus compromise witness storage** | ❌ NO | ❌ NO | ❌ NO | ✅ YES |
| 7 | **Replace stored ciphertext object** | ❌ NO | ✅ YES | ✅ YES | ✅ YES |
| 8 | **Compromise one Fabric organization (peer state alteration)** | ❌ NO | ❌ NO | ❌ NO | ✅ YES |
| 9 | **Compromise two of three organizations (policy collusion)** | ❌ NO | ❌ NO | ✅ YES | ❌ NO |

## Detailed Findings by Scenario

### Scenario 1: Modify field in past event row
*Description*: Attacker alters action/metadata of committed event in database

- **PlainLog**: Undetected — Silent modification in unchained table
- **Design B (No Witness)**: Detected — Recomputed entry_hash differs from recorded SHA-256 digest
- **Design B (With Witness)**: Detected — Hash chain broken; Merkle root recalculation fails
- **Design A (Hyperledger Fabric)**: Detected — Discrepancy with immutable Fabric ledger record

### Scenario 2: Delete a middle event
*Description*: Attacker removes an incriminating audit event row from database

- **PlainLog**: Undetected — No link exists between rows; row vanishes undetected
- **Design B (No Witness)**: Detected — Broken prev_hash pointer link at subsequent entry
- **Design B (With Witness)**: Detected — Chain pointer broken; Merkle tree leaf count mismatch
- **Design A (Hyperledger Fabric)**: Detected — Event exists on Fabric ledger with no matching DB record

### Scenario 3: Reorder events
*Description*: Attacker swaps chronology of events in the database

- **PlainLog**: Undetected — Unordered table rows; order changes undetected
- **Design B (No Witness)**: Detected — prev_hash of swapped events points to non-preceding hashes
- **Design B (With Witness)**: Detected — prev_hash mismatch and Merkle leaf ordering divergence
- **Design A (Hyperledger Fabric)**: Detected — Fabric block timestamp and ordering consensus mismatch

### Scenario 4: Truncate the tail of the log
*Description*: Attacker removes recent log entries from the database

- **PlainLog**: Undetected — No record of maximum log length
- **Design B (No Witness)**: Undetected — Without external anchor, prefix of valid chain looks intact
- **Design B (With Witness)**: Detected — Witness ledger recorded treeSize=5; local DB only has 3 events
- **Design A (Hyperledger Fabric)**: Detected — Fabric ledger contains transactions missing from Postgres

### Scenario 5: Rewrite entire chain with legitimate signing key
*Description*: Malicious DBA/insider with access to private key and DB re-signs fabricated history

- **PlainLog**: Undetected — Attacker replaces rows at will
- **Design B (No Witness)**: Undetected — Internal signatures and hashes are valid; undetectable locally
- **Design B (With Witness)**: Detected — External Witness rejects conflicting checkpoint (409 Conflict Alert)
- **Design A (Hyperledger Fabric)**: Detected — Fabric state cannot be rewritten: 2-of-3 endorsement quorum across orgs fails

### Scenario 6: Rewrite chain plus compromise witness storage
*Description*: Attacker compromises both application DB, signing key, AND the witness database

- **PlainLog**: Undetected — Completely unmonitored
- **Design B (No Witness)**: Undetected — Internal check passes
- **Design B (With Witness)**: Undetected — LIMITATION: Compromising all witness replicas enables silent history rewrite
- **Design A (Hyperledger Fabric)**: Detected — Fabric Byzantine tolerance: 3 org peers verify ledger blocks independently

### Scenario 7: Replace stored ciphertext object
*Description*: Attacker modifies encrypted binary payload in storage or MinIO

- **PlainLog**: Undetected — No hash binding for stored encrypted objects
- **Design B (No Witness)**: Detected — Storage integrity scan detects ciphertext SHA-256 mismatch without decrypting
- **Design B (With Witness)**: Detected — Storage scan detects SHA-256 mismatch and logs critical audit event
- **Design A (Hyperledger Fabric)**: Detected — Storage scan emits critical event anchored to Fabric

### Scenario 8: Compromise one Fabric organization (peer state alteration)
*Description*: Attacker gains root access to 1 peer node and alters its World State DB directly

- **PlainLog**: Undetected — N/A
- **Design B (No Witness)**: Undetected — N/A (Fabric peer alteration does not affect Design B)
- **Design B (With Witness)**: Undetected — N/A
- **Design A (Hyperledger Fabric)**: Detected — Endorsement mismatch: remaining 2 orgs (ExamBody, Auditor) reach 2-of-3 quorum and reject corrupted peer

### Scenario 9: Compromise two of three organizations (policy collusion)
*Description*: Two malicious orgs collude to endorse fraudulent state without the 3rd org

- **PlainLog**: Undetected — N/A
- **Design B (No Witness)**: Undetected — N/A
- **Design B (With Witness)**: Detected — Independent Design B witness detects divergence between app logs and colluding chain
- **Design A (Hyperledger Fabric)**: Undetected — LIMITATION: 2-of-3 endorsement threshold is satisfied; Fabric accepts transaction! Documented honestly.

## Key Honest Findings & Theoretical Limits

1. **The Role of the External Witness in Design B**:
   Without an external witness, an adversary with database access and the Ed25519 signing key can silently rewrite the entire audit log (Scenario 5) or truncate the tail (Scenario 4) with 100% cryptographic validity. The external witness transforms Design B from an internal integrity mechanism to a non-repudiation system.

2. **The Limits of Endorsement Policies in Design A**:
   Hyperledger Fabric with a majority (2-of-3) endorsement policy protects against a compromised single organization (Scenario 8). However, if two organizations collude (Scenario 9), the endorsement quorum is legally met from the perspective of the network. A permissioned blockchain cannot prevent majority collusion; it guarantees that at least $M$-of-$N$ independent organizations signed off.

3. **Storage Ciphertext Verification**:
   Binding `ciphertext_sha256` at write time ensures that silent bitrot, direct SQL tampering, or MinIO S3 object modification is caught during scanning without ever exposing question plaintext or cryptographic keys.

## Interpretation
*(Template section to be completed by the lead researcher)*

[The user will record their qualitative interpretation, operational recommendations, and policy implications here.]
