-- ══════════════════════════════════════════════════════════════════════
-- Migration 00004: Step 4 (Generation) & Step 5 (Threshold Release)
-- ══════════════════════════════════════════════════════════════════════

-- 1. Add CUSTODIAN role
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'CUSTODIAN';

-- 2. Add final_time_seconds to question_versions
ALTER TABLE "question_versions" ADD COLUMN IF NOT EXISTS "final_time_seconds" INTEGER;

-- 3. Exam Blueprints & Versions
CREATE TABLE IF NOT EXISTS "exam_blueprints" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "exam_id" UUID NOT NULL REFERENCES "exams"("id") ON DELETE CASCADE,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "created_by_id" UUID NOT NULL REFERENCES "users"("id")
);
CREATE INDEX IF NOT EXISTS "idx_exam_blueprints_exam_id" ON "exam_blueprints"("exam_id");

CREATE TABLE IF NOT EXISTS "blueprint_versions" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "blueprint_id" UUID NOT NULL REFERENCES "exam_blueprints"("id") ON DELETE CASCADE,
    "version_no" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "version_hash" VARCHAR(64) NOT NULL,
    "is_approved" BOOLEAN NOT NULL DEFAULT FALSE,
    "proposer_id" UUID NOT NULL REFERENCES "users"("id"),
    "approver_id" UUID REFERENCES "users"("id"),
    "approval_signature" VARCHAR(512),
    "approved_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "uq_blueprint_version" UNIQUE ("blueprint_id", "version_no")
);
CREATE INDEX IF NOT EXISTS "idx_blueprint_versions_hash" ON "blueprint_versions"("version_hash");

-- 4. Custodian Groups & Members
CREATE TABLE IF NOT EXISTS "custodian_groups" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "n" INTEGER NOT NULL CHECK ("n" >= 3),
    "k" INTEGER NOT NULL CHECK ("k" >= 2 AND "k" <= "n"),
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "custodian_group_members" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "group_id" UUID NOT NULL REFERENCES "custodian_groups"("id") ON DELETE CASCADE,
    "custodian_id" UUID NOT NULL REFERENCES "users"("id"),
    "public_key" VARCHAR(128) NOT NULL,
    "fingerprint" VARCHAR(64) NOT NULL,
    "enrolled_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "uq_custodian_group_member" UNIQUE ("group_id", "custodian_id")
);
CREATE INDEX IF NOT EXISTS "idx_custodian_group_members_custodian" ON "custodian_group_members"("custodian_id");

-- 5. Generation Requests & Approvals
CREATE TABLE IF NOT EXISTS "generation_requests" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "exam_id" UUID NOT NULL REFERENCES "exams"("id") ON DELETE CASCADE,
    "blueprint_version_id" UUID NOT NULL REFERENCES "blueprint_versions"("id"),
    "custodian_group_id" UUID NOT NULL REFERENCES "custodian_groups"("id"),
    "proposer_id" UUID NOT NULL REFERENCES "users"("id"),
    "status" VARCHAR(32) NOT NULL DEFAULT 'REQUESTED',
    "sets_count" INTEGER NOT NULL DEFAULT 1 CHECK ("sets_count" >= 1 AND "sets_count" <= 4),
    "export_profile" VARCHAR(64) NOT NULL DEFAULT 'GENERIC_CSV',
    "generate_not_before" TIMESTAMPTZ NOT NULL,
    "generate_not_after" TIMESTAMPTZ NOT NULL,
    "release_not_before" TIMESTAMPTZ NOT NULL,
    "answer_key_not_before" TIMESTAMPTZ NOT NULL,
    "download_retention_minutes" INTEGER NOT NULL DEFAULT 720,
    "request_hash" VARCHAR(64) NOT NULL,
    "rejection_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "idx_generation_requests_exam" ON "generation_requests"("exam_id");
CREATE INDEX IF NOT EXISTS "idx_generation_requests_status" ON "generation_requests"("status");

CREATE TABLE IF NOT EXISTS "generation_approvals" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "request_id" UUID NOT NULL REFERENCES "generation_requests"("id") ON DELETE CASCADE,
    "approver_id" UUID NOT NULL REFERENCES "users"("id"),
    "request_hash" VARCHAR(64) NOT NULL,
    "signature" VARCHAR(512) NOT NULL,
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "uq_generation_approvals_request_approver" UNIQUE ("request_id", "approver_id")
);

-- 6. Papers & Artifacts
CREATE TABLE IF NOT EXISTS "papers" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "exam_id" UUID NOT NULL REFERENCES "exams"("id") ON DELETE CASCADE,
    "request_id" UUID NOT NULL UNIQUE REFERENCES "generation_requests"("id") ON DELETE CASCADE,
    "blueprint_version_id" UUID NOT NULL REFERENCES "blueprint_versions"("id"),
    "sets_count" INTEGER NOT NULL DEFAULT 1,
    "status" VARCHAR(32) NOT NULL DEFAULT 'GENERATING',
    "paper_hash" VARCHAR(64),
    "seed_commit" VARCHAR(64),
    "revealed_seed" VARCHAR(128),
    "revealed_salt" VARCHAR(64),
    "public_manifest" JSONB,
    "validation_summary" JSONB,
    "failure_reason" TEXT,
    "released_at" TIMESTAMPTZ,
    "wiped_at" TIMESTAMPTZ,
    "answer_key_released_at" TIMESTAMPTZ,
    "closed_at" TIMESTAMPTZ,
    "cancelled_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "idx_papers_exam_id" ON "papers"("exam_id");
CREATE INDEX IF NOT EXISTS "idx_papers_status" ON "papers"("status");

CREATE TABLE IF NOT EXISTS "paper_artifacts" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "paper_id" UUID NOT NULL REFERENCES "papers"("id") ON DELETE CASCADE,
    "artifact_type" VARCHAR(32) NOT NULL, -- PAPER or ANSWER_KEY
    "ciphertext_location" VARCHAR(512) NOT NULL,
    "ciphertext_sha256" VARCHAR(64) NOT NULL,
    "key_commitment" VARCHAR(64) NOT NULL,
    "nonce" BYTEA NOT NULL,
    "format_version" VARCHAR(16) NOT NULL DEFAULT 'v1',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "uq_paper_artifact_type" UNIQUE ("paper_id", "artifact_type")
);

CREATE TABLE IF NOT EXISTS "key_share_records" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "paper_id" UUID NOT NULL REFERENCES "papers"("id") ON DELETE CASCADE,
    "artifact_type" VARCHAR(32) NOT NULL,
    "share_index" INTEGER NOT NULL,
    "custodian_id" UUID NOT NULL REFERENCES "users"("id"),
    "sealed_share" TEXT NOT NULL,
    "share_commitment" VARCHAR(64) NOT NULL,
    "salt" VARCHAR(64) NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'SEALED',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "uq_key_share_custodian" UNIQUE ("paper_id", "artifact_type", "custodian_id")
);

CREATE TABLE IF NOT EXISTS "share_submissions" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "paper_id" UUID NOT NULL REFERENCES "papers"("id") ON DELETE CASCADE,
    "custodian_id" UUID NOT NULL REFERENCES "users"("id"),
    "artifact_type" VARCHAR(32) NOT NULL,
    "share_index" INTEGER NOT NULL,
    "submitted_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "status" VARCHAR(32) NOT NULL DEFAULT 'ACCEPTED',
    "rejection_reason" VARCHAR(64)
);
CREATE INDEX IF NOT EXISTS "idx_share_submissions_paper_artifact" ON "share_submissions"("paper_id", "artifact_type");

CREATE TABLE IF NOT EXISTS "question_reservations" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "paper_id" UUID NOT NULL REFERENCES "papers"("id") ON DELETE CASCADE,
    "reservation_handle" VARCHAR(64) NOT NULL,
    "reserved_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "uq_paper_reservation" UNIQUE ("paper_id", "reservation_handle")
);
CREATE INDEX IF NOT EXISTS "idx_question_reservations_handle" ON "question_reservations"("reservation_handle");

CREATE TABLE IF NOT EXISTS "download_tokens" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "token" VARCHAR(64) NOT NULL UNIQUE,
    "paper_id" UUID NOT NULL REFERENCES "papers"("id") ON DELETE CASCADE,
    "user_id" UUID NOT NULL REFERENCES "users"("id"),
    "file_type" VARCHAR(32) NOT NULL,
    "remaining_uses" INTEGER NOT NULL DEFAULT 5,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "idx_download_tokens_token" ON "download_tokens"("token");
CREATE INDEX IF NOT EXISTS "idx_download_tokens_user_paper" ON "download_tokens"("paper_id", "user_id");

CREATE TABLE IF NOT EXISTS "question_exclusion_groups" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "question_version_id" UUID NOT NULL UNIQUE REFERENCES "question_versions"("id") ON DELETE CASCADE,
    "group_id" VARCHAR(64) NOT NULL,
    "source" VARCHAR(32) NOT NULL,
    "template_family_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "idx_question_exclusion_groups_group" ON "question_exclusion_groups"("group_id");

-- 7. Trigger: Append-Only on generation_approvals
CREATE OR REPLACE FUNCTION block_generation_approvals_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Cryptographic violation: generation_approvals table is append-only. UPDATE and DELETE operations are forbidden.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generation_approvals_append_only ON "generation_approvals";
CREATE TRIGGER trg_generation_approvals_append_only
    BEFORE UPDATE OR DELETE ON "generation_approvals"
    FOR EACH ROW
    EXECUTE FUNCTION block_generation_approvals_mutation();

-- 8. Trigger: Dual-Admin separation on generation_approvals
CREATE OR REPLACE FUNCTION check_generation_approval_separation()
RETURNS TRIGGER AS $$
DECLARE
    proposer_uuid UUID;
BEGIN
    SELECT proposer_id INTO proposer_uuid FROM "generation_requests" WHERE id = NEW.request_id;
    IF NEW.approver_id = proposer_uuid THEN
        RAISE EXCEPTION 'Dual-control violation: Proposer cannot approve their own generation request (approver_id = %).', NEW.approver_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generation_approvals_separation ON "generation_approvals";
CREATE TRIGGER trg_generation_approvals_separation
    BEFORE INSERT ON "generation_approvals"
    FOR EACH ROW
    EXECUTE FUNCTION check_generation_approval_separation();

-- 9. Trigger: Blueprint versions immutability once approved
CREATE OR REPLACE FUNCTION check_blueprint_version_immutability()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.is_approved = TRUE THEN
        RAISE EXCEPTION 'Immutability violation: Approved blueprint version % cannot be modified or deleted.', OLD.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_blueprint_version_immutability ON "blueprint_versions";
CREATE TRIGGER trg_blueprint_version_immutability
    BEFORE UPDATE OR DELETE ON "blueprint_versions"
    FOR EACH ROW
    EXECUTE FUNCTION check_blueprint_version_immutability();

-- 10. Trigger: Only one active non-CLOSED/non-CANCELLED paper per exam
CREATE OR REPLACE FUNCTION check_single_active_paper()
RETURNS TRIGGER AS $$
DECLARE
    active_count INTEGER;
BEGIN
    IF NEW.status NOT IN ('CLOSED', 'CANCELLED', 'FAILED_INFEASIBLE', 'FAILED_VALIDATION', 'FAILED_ERROR') THEN
        SELECT COUNT(*) INTO active_count
        FROM "papers"
        WHERE exam_id = NEW.exam_id
          AND id <> NEW.id
          AND status NOT IN ('CLOSED', 'CANCELLED', 'FAILED_INFEASIBLE', 'FAILED_VALIDATION', 'FAILED_ERROR');

        IF active_count > 0 THEN
            RAISE EXCEPTION 'Concurrency violation: Exam % already has an active paper in generation or release lifecycle.', NEW.exam_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_single_active_paper ON "papers";
CREATE TRIGGER trg_single_active_paper
    BEFORE INSERT OR UPDATE OF status ON "papers"
    FOR EACH ROW
    EXECUTE FUNCTION check_single_active_paper();

-- 11. Update eligible_question_versions view with final_difficulty and final_time_seconds
DROP VIEW IF EXISTS "eligible_question_versions" CASCADE;
CREATE OR REPLACE VIEW "eligible_question_versions" AS
SELECT
  qv.id AS version_id,
  q.id AS question_id,
  q.human_id,
  qv.version_no,
  q.subject_id,
  q.topic_id,
  q.type,
  COALESCE(qv.final_difficulty, q.difficulty) AS difficulty,
  COALESCE(qv.final_difficulty, q.difficulty) AS final_difficulty,
  COALESCE(qv.final_time_seconds, q.estimated_time) AS final_time_seconds,
  q.marks,
  q.negative_marks,
  qv.content_commitment,
  qv.created_at,
  appr_mod.timestamp AS approved_at
FROM "question_versions" qv
JOIN "questions" q ON q.id = qv.question_id
LEFT JOIN "approval_policies" pol ON (
  pol.is_active = TRUE
  AND (pol.subject_id IS NULL OR pol.subject_id = q.subject_id)
  AND (pol.exam_id IS NULL OR pol.exam_id = q.subject_id)
)
-- Must have valid moderator approval record
JOIN "approvals" appr_mod ON (
  appr_mod.question_id = qv.question_id
  AND appr_mod.version_no = qv.version_no
  AND appr_mod.content_commitment = qv.content_commitment
  AND appr_mod.role = 'MODERATOR'
  AND appr_mod.decision = 'APPROVE'
)
WHERE
  qv.status = 'APPROVED'
  AND qv.superseded_at IS NULL
  AND qv.retirement_reason IS NULL
  -- Signed reviewer approvals count must satisfy policy requirement (default 2)
  AND (
    SELECT COUNT(DISTINCT a.approver_id)
    FROM "approvals" a
    WHERE a.question_id = qv.question_id
      AND a.version_no = qv.version_no
      AND a.content_commitment = qv.content_commitment
      AND a.role = 'REVIEWER'
      AND a.decision = 'APPROVE'
  ) >= COALESCE(pol.required_reviewers, 2)
  -- No unresolved blind answer disagreements
  AND NOT EXISTS (
    SELECT 1 FROM "reviews" r
    WHERE r.question_version_id = qv.id
      AND r.disagreement_flag = TRUE
      AND r.disagreement_resolved = FALSE
  )
  -- No confirmed duplicate dispositions
  AND NOT EXISTS (
    SELECT 1 FROM "duplicate_dispositions" dd
    WHERE dd.question_version_id = qv.id
      AND dd.disposition = 'CONFIRMED_DUPLICATE'
  );

-- 12. Backfill question_exclusion_groups from Step 2 SIMILAR_ALLOWED duplicate dispositions
INSERT INTO "question_exclusion_groups" ("id", "question_version_id", "group_id", "source", "created_at")
SELECT
    gen_random_uuid(),
    dd.question_version_id,
    'SIMILAR_GROUP_' || SUBSTRING(dd.id::text, 1, 8),
    'SIMILAR_ALLOWED',
    NOW()
FROM "duplicate_dispositions" dd
WHERE dd.disposition = 'SIMILAR_ALLOWED'
ON CONFLICT ("question_version_id") DO NOTHING;

