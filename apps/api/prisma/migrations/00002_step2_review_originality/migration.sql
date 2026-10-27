-- ExamVault Step 2 Migration: Review, Originality Check, and Approval Workflow

-- ── 1. Update Enums ──
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'MODERATOR';

ALTER TYPE "question_status" ADD VALUE IF NOT EXISTS 'SCREENING';
ALTER TYPE "question_status" ADD VALUE IF NOT EXISTS 'DUPLICATE_FLAGGED';
ALTER TYPE "question_status" ADD VALUE IF NOT EXISTS 'READY_FOR_REVIEW';
ALTER TYPE "question_status" ADD VALUE IF NOT EXISTS 'CHANGES_REQUESTED';
ALTER TYPE "question_status" ADD VALUE IF NOT EXISTS 'MODERATION';

-- ── 2. Add Step 2 Versioning Columns to question_versions ──
ALTER TABLE "question_versions"
  ADD COLUMN IF NOT EXISTS "parent_version_id" UUID REFERENCES "question_versions"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "change_justification" TEXT,
  ADD COLUMN IF NOT EXISTS "policy_version" INTEGER,
  ADD COLUMN IF NOT EXISTS "superseded_at" TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "retirement_reason" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "retired_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "question_versions_parent_version_id_idx" ON "question_versions"("parent_version_id");

-- ── 3. User Subject Expertise ──
CREATE TABLE IF NOT EXISTS "user_subject_expertise" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "subject_id" UUID NOT NULL REFERENCES "subjects"("id") ON DELETE CASCADE,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE("user_id", "subject_id")
);

-- ── 4. User Signing Keys (Wrapped Ed25519) ──
CREATE TABLE IF NOT EXISTS "user_signing_keys" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "user_id" UUID NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "public_key" VARCHAR(256) NOT NULL,
  "wrapped_private_key" BYTEA NOT NULL,
  "key_id" VARCHAR(64) NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── 5. Conflict of Interest Declarations ──
CREATE TABLE IF NOT EXISTS "conflict_declarations" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "conflict_type" VARCHAR(64) NOT NULL,
  "encrypted_description" BYTEA NOT NULL,
  "description_nonce" BYTEA NOT NULL,
  "description_tag" BYTEA NOT NULL,
  "wrapped_key" BYTEA NOT NULL,
  "key_id" VARCHAR(64) NOT NULL,
  "conflict_hash" VARCHAR(64) NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "conflict_declarations_user_id_idx" ON "conflict_declarations"("user_id");
CREATE INDEX IF NOT EXISTS "conflict_declarations_conflict_hash_idx" ON "conflict_declarations"("conflict_hash");

-- ── 6. Approval Policies ──
CREATE TABLE IF NOT EXISTS "approval_policies" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "exam_id" UUID REFERENCES "exams"("id") ON DELETE SET NULL,
  "subject_id" UUID REFERENCES "subjects"("id") ON DELETE SET NULL,
  "question_type" "question_type",
  "version" INTEGER NOT NULL DEFAULT 1,
  "required_reviewers" INTEGER NOT NULL DEFAULT 2,
  "require_blind_solve" BOOLEAN NOT NULL DEFAULT TRUE,
  "require_moderator" BOOLEAN NOT NULL DEFAULT TRUE,
  "require_language_review" BOOLEAN NOT NULL DEFAULT TRUE,
  "max_review_days" INTEGER NOT NULL DEFAULT 7,
  "exact_match_threshold" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  "high_similarity_threshold" DOUBLE PRECISION NOT NULL DEFAULT 0.85,
  "medium_similarity_threshold" DOUBLE PRECISION NOT NULL DEFAULT 0.60,
  "effective_from" TIMESTAMP NOT NULL DEFAULT NOW(),
  "proposed_by_id" UUID NOT NULL REFERENCES "users"("id"),
  "approved_by_id" UUID REFERENCES "users"("id"),
  "is_active" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "approval_policies_subject_id_idx" ON "approval_policies"("subject_id");
CREATE INDEX IF NOT EXISTS "approval_policies_is_active_idx" ON "approval_policies"("is_active");

-- ── 7. Review Rounds ──
CREATE TABLE IF NOT EXISTS "review_rounds" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "question_version_id" UUID NOT NULL REFERENCES "question_versions"("id") ON DELETE CASCADE,
  "round_number" INTEGER NOT NULL DEFAULT 1,
  "policy_version" INTEGER NOT NULL DEFAULT 1,
  "policy_id" UUID REFERENCES "approval_policies"("id") ON DELETE SET NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "review_rounds_question_version_id_idx" ON "review_rounds"("question_version_id");

-- ── 8. Review Assignments ──
CREATE TABLE IF NOT EXISTS "review_assignments" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "round_id" UUID NOT NULL REFERENCES "review_rounds"("id") ON DELETE CASCADE,
  "question_version_id" UUID NOT NULL REFERENCES "question_versions"("id") ON DELETE CASCADE,
  "reviewer_id" UUID NOT NULL REFERENCES "users"("id"),
  "assigned_role" VARCHAR(20) NOT NULL DEFAULT 'REVIEWER',
  "status" VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  "due_date" TIMESTAMP NOT NULL,
  "selection_seed" VARCHAR(64) NOT NULL,
  "eligible_count" INTEGER NOT NULL,
  "reassigned_to_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "reassigned_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "reassignment_reason" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE("round_id", "reviewer_id")
);
CREATE INDEX IF NOT EXISTS "review_assignments_reviewer_id_idx" ON "review_assignments"("reviewer_id");
CREATE INDEX IF NOT EXISTS "review_assignments_status_idx" ON "review_assignments"("status");

-- ── 9. Reviews ──
CREATE TABLE IF NOT EXISTS "reviews" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "assignment_id" UUID NOT NULL UNIQUE REFERENCES "review_assignments"("id") ON DELETE CASCADE,
  "question_version_id" UUID NOT NULL REFERENCES "question_versions"("id") ON DELETE CASCADE,
  "reviewer_id" UUID NOT NULL REFERENCES "users"("id"),
  "phase" VARCHAR(20) NOT NULL DEFAULT 'SOLVE',
  "content_commitment" VARCHAR(128) NOT NULL,
  "encrypted_blind_answer" BYTEA,
  "blind_answer_nonce" BYTEA,
  "blind_answer_tag" BYTEA,
  "encrypted_solve_key" BYTEA,
  "time_taken_seconds" INTEGER,
  "difficulty_rating" DOUBLE PRECISION,
  "blind_answer_matches_key" BOOLEAN,
  "disagreement_flag" BOOLEAN NOT NULL DEFAULT FALSE,
  "disagreement_resolved" BOOLEAN NOT NULL DEFAULT FALSE,
  "disagreement_resolution_note" TEXT,
  "checklist" JSONB,
  "decision" VARCHAR(32),
  "encrypted_comments" BYTEA,
  "comments_nonce" BYTEA,
  "comments_tag" BYTEA,
  "encrypted_comments_key" BYTEA,
  "key_id" VARCHAR(64),
  "submitted_at" TIMESTAMP,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "reviews_question_version_id_idx" ON "reviews"("question_version_id");
CREATE INDEX IF NOT EXISTS "reviews_reviewer_id_idx" ON "reviews"("reviewer_id");

-- ── 10. Approvals (Append-Only) ──
CREATE TABLE IF NOT EXISTS "approvals" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "question_id" UUID NOT NULL REFERENCES "questions"("id") ON DELETE CASCADE,
  "version_no" INTEGER NOT NULL,
  "content_commitment" VARCHAR(128) NOT NULL,
  "decision" VARCHAR(32) NOT NULL,
  "role" VARCHAR(32) NOT NULL,
  "approver_id" UUID NOT NULL REFERENCES "users"("id"),
  "review_round" INTEGER NOT NULL DEFAULT 1,
  "policy_version" INTEGER NOT NULL DEFAULT 1,
  "timestamp" TIMESTAMP NOT NULL DEFAULT NOW(),
  "signature" VARCHAR(256) NOT NULL
);
CREATE INDEX IF NOT EXISTS "approvals_question_version_idx" ON "approvals"("question_id", "version_no");
CREATE INDEX IF NOT EXISTS "approvals_approver_id_idx" ON "approvals"("approver_id");

-- Append-only trigger for approvals table
CREATE OR REPLACE FUNCTION prevent_approvals_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'approvals table is append-only: % operations are prohibited', TG_OP;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS approvals_no_update ON approvals;
CREATE TRIGGER approvals_no_update
  BEFORE UPDATE ON approvals
  FOR EACH ROW
  EXECUTE FUNCTION prevent_approvals_mutation();

DROP TRIGGER IF EXISTS approvals_no_delete ON approvals;
CREATE TRIGGER approvals_no_delete
  BEFORE DELETE ON approvals
  FOR EACH ROW
  EXECUTE FUNCTION prevent_approvals_mutation();

-- ── 11. Originality Reports & Matches ──
CREATE TABLE IF NOT EXISTS "originality_reports" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "question_version_id" UUID NOT NULL UNIQUE REFERENCES "question_versions"("id") ON DELETE CASCADE,
  "risk_level" VARCHAR(20) NOT NULL,
  "highest_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "checked_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "service_version" VARCHAR(32) NOT NULL DEFAULT '1.0.0',
  "metadata" JSONB
);

CREATE TABLE IF NOT EXISTS "originality_matches" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "report_id" UUID NOT NULL REFERENCES "originality_reports"("id") ON DELETE CASCADE,
  "source_type" VARCHAR(20) NOT NULL,
  "source_reference" VARCHAR(255) NOT NULL,
  "matched_question_version_id" UUID REFERENCES "question_versions"("id") ON DELETE SET NULL,
  "matched_document_id" UUID,
  "overall_score" DOUBLE PRECISION NOT NULL,
  "exact_hash_match" BOOLEAN NOT NULL DEFAULT FALSE,
  "minhash_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "tfidf_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "semantic_score" DOUBLE PRECISION,
  "stem_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "options_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "options_reordered_match" BOOLEAN NOT NULL DEFAULT FALSE,
  "matched_spans" JSONB,
  "source_text_snippet" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "originality_matches_report_id_idx" ON "originality_matches"("report_id");

CREATE TABLE IF NOT EXISTS "duplicate_dispositions" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "question_version_id" UUID NOT NULL UNIQUE REFERENCES "question_versions"("id") ON DELETE CASCADE,
  "disposition" VARCHAR(32) NOT NULL,
  "moderator_id" UUID NOT NULL REFERENCES "users"("id"),
  "encrypted_justification" BYTEA NOT NULL,
  "justification_nonce" BYTEA NOT NULL,
  "justification_tag" BYTEA NOT NULL,
  "encrypted_justification_key" BYTEA NOT NULL,
  "key_id" VARCHAR(64) NOT NULL,
  "dispositioned_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── 12. Corpus Tables ──
CREATE TABLE IF NOT EXISTS "corpus_sources" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "name" VARCHAR(255) NOT NULL,
  "type" VARCHAR(32) NOT NULL,
  "license_note" TEXT,
  "imported_by_id" UUID NOT NULL REFERENCES "users"("id"),
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "corpus_documents" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "source_id" UUID NOT NULL REFERENCES "corpus_sources"("id") ON DELETE CASCADE,
  "title" VARCHAR(255) NOT NULL,
  "identifier" VARCHAR(100) NOT NULL,
  "plaintext_content" TEXT NOT NULL,
  "normalized_content" TEXT NOT NULL,
  "metadata" JSONB,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "corpus_documents_source_id_idx" ON "corpus_documents"("source_id");
CREATE INDEX IF NOT EXISTS "corpus_documents_identifier_idx" ON "corpus_documents"("identifier");

-- ── 13. In-App Notifications ──
CREATE TABLE IF NOT EXISTS "notifications" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "type" VARCHAR(64) NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  "message" TEXT NOT NULL,
  "link" VARCHAR(255),
  "is_read" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "notifications_user_id_idx" ON "notifications"("user_id");
CREATE INDEX IF NOT EXISTS "notifications_is_read_idx" ON "notifications"("is_read");

-- ── 14. Valid State Machine Transitions ──
CREATE TABLE IF NOT EXISTS "valid_state_transitions" (
  "from_status" VARCHAR(32) NOT NULL,
  "to_status" VARCHAR(32) NOT NULL,
  PRIMARY KEY ("from_status", "to_status")
);

INSERT INTO "valid_state_transitions" ("from_status", "to_status") VALUES
  ('DRAFT', 'SUBMITTED'),
  ('SUBMITTED', 'SCREENING'),
  ('SUBMITTED', 'WITHDRAWN'),
  ('SCREENING', 'READY_FOR_REVIEW'),
  ('SCREENING', 'DUPLICATE_FLAGGED'),
  ('DUPLICATE_FLAGGED', 'READY_FOR_REVIEW'),
  ('DUPLICATE_FLAGGED', 'REJECTED'),
  ('READY_FOR_REVIEW', 'UNDER_REVIEW'),
  ('READY_FOR_REVIEW', 'WITHDRAWN'),
  ('UNDER_REVIEW', 'CHANGES_REQUESTED'),
  ('UNDER_REVIEW', 'REJECTED'),
  ('UNDER_REVIEW', 'MODERATION'),
  ('MODERATION', 'APPROVED'),
  ('MODERATION', 'CHANGES_REQUESTED'),
  ('MODERATION', 'REJECTED'),
  ('APPROVED', 'RETIRED')
ON CONFLICT DO NOTHING;

-- State Machine Transition Enforcement Trigger
CREATE OR REPLACE FUNCTION check_state_machine_transition()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status != NEW.status THEN
    IF NOT EXISTS (
      SELECT 1 FROM "valid_state_transitions"
      WHERE "from_status" = OLD.status::text AND "to_status" = NEW.status::text
    ) THEN
      RAISE EXCEPTION 'Invalid state transition from % to % is prohibited by state machine policy.', OLD.status, NEW.status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS question_versions_transition_check ON question_versions;
CREATE TRIGGER question_versions_transition_check
  BEFORE UPDATE ON question_versions
  FOR EACH ROW
  EXECUTE FUNCTION check_state_machine_transition();

-- ── 15. Enhanced Immutability Trigger ──
-- Once a version leaves DRAFT, all content columns are strictly immutable
CREATE OR REPLACE FUNCTION prevent_submitted_version_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status != 'DRAFT' THEN
    IF OLD.encrypted_content != NEW.encrypted_content
       OR OLD.encrypted_answer != NEW.encrypted_answer
       OR OLD.content_commitment != NEW.content_commitment
       OR OLD.content_nonce != NEW.content_nonce
       OR OLD.content_tag != NEW.content_tag
       OR OLD.answer_nonce != NEW.answer_nonce
       OR OLD.answer_tag != NEW.answer_tag
       OR OLD.encrypted_content_key != NEW.encrypted_content_key
       OR OLD.encrypted_answer_key != NEW.encrypted_answer_key
       OR OLD.key_id != NEW.key_id THEN
      RAISE EXCEPTION 'Content columns of a non-draft question version are strictly immutable. Create a new version instead.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── 16. Database View: eligible_question_versions ──
CREATE OR REPLACE VIEW "eligible_question_versions" AS
SELECT
  qv.id AS version_id,
  q.id AS question_id,
  q.human_id,
  qv.version_no,
  q.subject_id,
  q.topic_id,
  q.type,
  q.difficulty,
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
