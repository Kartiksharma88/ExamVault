-- ExamVault Step 3 Migration: Encrypted Storage and Dual-Design Audit Registration

-- ── 1. Add Ciphertext SHA-256 Columns to question_versions ──
ALTER TABLE "question_versions"
  ADD COLUMN IF NOT EXISTS "ciphertext_sha256" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "answer_ciphertext_sha256" VARCHAR(64);

-- Backfill ciphertext SHA-256 for existing question versions without decrypting
UPDATE "question_versions"
SET "ciphertext_sha256" = encode(digest("encrypted_content" || "content_tag", 'sha256'), 'hex'),
    "answer_ciphertext_sha256" = encode(digest("encrypted_answer" || "answer_tag", 'sha256'), 'hex')
WHERE "ciphertext_sha256" IS NULL;

-- ── 2. Add Canonical Event Columns to audit_events ──
ALTER TABLE "audit_events"
  ADD COLUMN IF NOT EXISTS "schema_version" VARCHAR(16) NOT NULL DEFAULT '1.0.0',
  ADD COLUMN IF NOT EXISTS "actor_pseudonym" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "version_no" INTEGER,
  ADD COLUMN IF NOT EXISTS "payload_hash" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "content_commitment" VARCHAR(128),
  ADD COLUMN IF NOT EXISTS "approval_signature" VARCHAR(512),
  ADD COLUMN IF NOT EXISTS "metadata_hash" VARCHAR(64);

ALTER TABLE "audit_events"
  ALTER COLUMN "signature" TYPE VARCHAR(512);

CREATE INDEX IF NOT EXISTS "audit_events_actor_pseudonym_idx" ON "audit_events"("actor_pseudonym");
CREATE INDEX IF NOT EXISTS "audit_events_entry_hash_idx" ON "audit_events"("entry_hash");

-- ── 3. Transactional Audit Outbox Table ──
CREATE TABLE IF NOT EXISTS "audit_outbox" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "event_id" UUID NOT NULL REFERENCES "audit_events"("id") ON DELETE CASCADE,
  "sink_type" VARCHAR(32) NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  "payload" JSONB NOT NULL,
  "retry_count" INTEGER NOT NULL DEFAULT 0,
  "max_retries" INTEGER NOT NULL DEFAULT 5,
  "last_error" TEXT,
  "next_retry_at" TIMESTAMP,
  "committed_at" TIMESTAMP,
  "fabric_tx_id" VARCHAR(128),
  "fabric_block_no" BIGINT,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "audit_outbox_status_next_retry_idx" ON "audit_outbox"("status", "next_retry_at");
CREATE INDEX IF NOT EXISTS "audit_outbox_event_id_idx" ON "audit_outbox"("event_id");
CREATE INDEX IF NOT EXISTS "audit_outbox_sink_type_idx" ON "audit_outbox"("sink_type");

-- ── 4. Merkle Checkpoints Table ──
CREATE TABLE IF NOT EXISTS "merkle_checkpoints" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "root_hash" VARCHAR(64) NOT NULL,
  "range_start" INTEGER NOT NULL,
  "range_end" INTEGER NOT NULL,
  "event_count" INTEGER NOT NULL,
  "tree_size" INTEGER NOT NULL,
  "signature" VARCHAR(512) NOT NULL,
  "witness_signature" VARCHAR(512),
  "witness_receipt" JSONB,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "merkle_checkpoints_range_idx" ON "merkle_checkpoints"("range_start", "range_end");
CREATE INDEX IF NOT EXISTS "merkle_checkpoints_root_hash_idx" ON "merkle_checkpoints"("root_hash");

-- ── 5. Storage Integrity Scans Table ──
CREATE TABLE IF NOT EXISTS "storage_integrity_scans" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "scanned_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "total_objects" INTEGER NOT NULL,
  "valid_objects" INTEGER NOT NULL,
  "corrupted_objects" INTEGER NOT NULL,
  "missing_objects" INTEGER NOT NULL,
  "orphaned_objects" INTEGER NOT NULL,
  "details" JSONB,
  "audit_event_id" UUID
);

CREATE INDEX IF NOT EXISTS "storage_integrity_scans_scanned_at_idx" ON "storage_integrity_scans"("scanned_at");

-- ── 6. Baseline Plain Log Table (Experiment Baseline 0) ──
CREATE TABLE IF NOT EXISTS "plain_audit_logs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "timestamp" TIMESTAMP NOT NULL DEFAULT NOW(),
  "event_type" VARCHAR(64) NOT NULL,
  "subject_type" VARCHAR(64) NOT NULL,
  "subject_id" VARCHAR(255) NOT NULL,
  "payload" JSONB
);

CREATE INDEX IF NOT EXISTS "plain_audit_logs_timestamp_idx" ON "plain_audit_logs"("timestamp");
CREATE INDEX IF NOT EXISTS "plain_audit_logs_event_type_idx" ON "plain_audit_logs"("event_type");
