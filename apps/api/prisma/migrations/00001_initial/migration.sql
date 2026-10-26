-- ExamVault Initial Migration
-- This migration creates all tables and sets up the append-only audit trigger

-- ── Extensions ──
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Enums ──
DO $$ BEGIN
  CREATE TYPE "Role" AS ENUM ('ADMIN', 'EXAMINER', 'REVIEWER', 'AUDITOR');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "question_status" AS ENUM ('DRAFT', 'SUBMITTED', 'WITHDRAWN', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'RETIRED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "question_type" AS ENUM ('MCQ_SINGLE', 'MCQ_MULTI', 'INTEGER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "cognitive_level" AS ENUM ('REMEMBER', 'UNDERSTAND', 'APPLY', 'ANALYZE', 'EVALUATE', 'CREATE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "language" AS ENUM ('EN', 'HI', 'BILINGUAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ── Users ──
CREATE TABLE IF NOT EXISTS "users" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "email" VARCHAR(255) NOT NULL UNIQUE,
  "name" VARCHAR(255) NOT NULL,
  "password_hash" VARCHAR(255) NOT NULL,
  "role" "Role" NOT NULL DEFAULT 'EXAMINER',
  "mfa_secret" VARCHAR(255),
  "mfa_enabled" BOOLEAN NOT NULL DEFAULT FALSE,
  "login_attempts" INTEGER NOT NULL DEFAULT 0,
  "locked_until" TIMESTAMP,
  "must_setup_mfa" BOOLEAN NOT NULL DEFAULT TRUE,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── Sessions ──
CREATE TABLE IF NOT EXISTS "sessions" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "csrf_token" VARCHAR(128) NOT NULL,
  "mfa_verified" BOOLEAN NOT NULL DEFAULT FALSE,
  "expires_at" TIMESTAMP NOT NULL,
  "last_active" TIMESTAMP NOT NULL DEFAULT NOW(),
  "user_agent" VARCHAR(512),
  "ip_address" VARCHAR(45),
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "sessions_user_id_idx" ON "sessions"("user_id");
CREATE INDEX IF NOT EXISTS "sessions_expires_at_idx" ON "sessions"("expires_at");

-- ── Exams ──
CREATE TABLE IF NOT EXISTS "exams" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "name" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── Subjects ──
CREATE TABLE IF NOT EXISTS "subjects" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "exam_id" UUID NOT NULL REFERENCES "exams"("id") ON DELETE CASCADE,
  "name" VARCHAR(255) NOT NULL,
  "code" VARCHAR(10) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "next_seq" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE("exam_id", "code")
);

-- ── Topics ──
CREATE TABLE IF NOT EXISTS "topics" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "subject_id" UUID NOT NULL REFERENCES "subjects"("id") ON DELETE CASCADE,
  "name" VARCHAR(255) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── Subtopics ──
CREATE TABLE IF NOT EXISTS "subtopics" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "topic_id" UUID NOT NULL REFERENCES "topics"("id") ON DELETE CASCADE,
  "name" VARCHAR(255) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── Questions ──
CREATE TABLE IF NOT EXISTS "questions" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "human_id" VARCHAR(20) NOT NULL UNIQUE,
  "author_id" UUID NOT NULL REFERENCES "users"("id"),
  "subject_id" UUID NOT NULL REFERENCES "subjects"("id"),
  "topic_id" UUID REFERENCES "topics"("id"),
  "subtopic_id" UUID REFERENCES "subtopics"("id"),
  "type" "question_type" NOT NULL,
  "difficulty" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "cognitive_level" "cognitive_level" NOT NULL,
  "marks" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "negative_marks" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "estimated_time" INTEGER NOT NULL DEFAULT 120,
  "language" "language" NOT NULL DEFAULT 'EN',
  "current_version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "questions_author_id_idx" ON "questions"("author_id");
CREATE INDEX IF NOT EXISTS "questions_subject_id_idx" ON "questions"("subject_id");
CREATE INDEX IF NOT EXISTS "questions_type_idx" ON "questions"("type");
CREATE INDEX IF NOT EXISTS "questions_human_id_idx" ON "questions"("human_id");

-- ── Question Versions ──
CREATE TABLE IF NOT EXISTS "question_versions" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "question_id" UUID NOT NULL REFERENCES "questions"("id") ON DELETE CASCADE,
  "version_no" INTEGER NOT NULL,
  "status" "question_status" NOT NULL DEFAULT 'DRAFT',
  "author_id" UUID NOT NULL REFERENCES "users"("id"),
  "encrypted_content" BYTEA NOT NULL,
  "content_nonce" BYTEA NOT NULL,
  "content_tag" BYTEA NOT NULL,
  "encrypted_content_key" BYTEA NOT NULL,
  "encrypted_answer" BYTEA NOT NULL,
  "answer_nonce" BYTEA NOT NULL,
  "answer_tag" BYTEA NOT NULL,
  "encrypted_answer_key" BYTEA NOT NULL,
  "content_commitment" VARCHAR(128) NOT NULL,
  "key_id" VARCHAR(64) NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE("question_id", "version_no")
);
CREATE INDEX IF NOT EXISTS "question_versions_question_id_idx" ON "question_versions"("question_id");
CREATE INDEX IF NOT EXISTS "question_versions_status_idx" ON "question_versions"("status");

-- ── Audit Events ──
CREATE TABLE IF NOT EXISTS "audit_events" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "timestamp" TIMESTAMP NOT NULL DEFAULT NOW(),
  "actor_id" UUID REFERENCES "users"("id"),
  "action" VARCHAR(64) NOT NULL,
  "target_type" VARCHAR(64) NOT NULL,
  "target_id" VARCHAR(255),
  "metadata" JSONB,
  "prev_hash" VARCHAR(128) NOT NULL,
  "entry_hash" VARCHAR(128) NOT NULL,
  "signature" VARCHAR(256) NOT NULL
);
CREATE INDEX IF NOT EXISTS "audit_events_timestamp_idx" ON "audit_events"("timestamp");
CREATE INDEX IF NOT EXISTS "audit_events_actor_id_idx" ON "audit_events"("actor_id");
CREATE INDEX IF NOT EXISTS "audit_events_action_idx" ON "audit_events"("action");
CREATE INDEX IF NOT EXISTS "audit_events_target_idx" ON "audit_events"("target_type", "target_id");

-- ══════════════════════════════════════════════════════════════════
-- APPEND-ONLY TRIGGER: Block UPDATE and DELETE on audit_events
-- This is a critical security control for tamper-evidence
-- ══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION prevent_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_events table is append-only: % operations are prohibited', TG_OP;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_events_no_update ON audit_events;
CREATE TRIGGER audit_events_no_update
  BEFORE UPDATE ON audit_events
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_mutation();

DROP TRIGGER IF EXISTS audit_events_no_delete ON audit_events;
CREATE TRIGGER audit_events_no_delete
  BEFORE DELETE ON audit_events
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_mutation();

-- ══════════════════════════════════════════════════════════════════
-- IMMUTABILITY TRIGGER: Prevent modification of SUBMITTED question versions
-- ══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION prevent_submitted_version_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IN ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED') THEN
    -- Allow only status changes (e.g., SUBMITTED -> WITHDRAWN)
    IF OLD.encrypted_content != NEW.encrypted_content
       OR OLD.encrypted_answer != NEW.encrypted_answer
       OR OLD.content_commitment != NEW.content_commitment THEN
      RAISE EXCEPTION 'Cannot modify content of a submitted question version. Create a new version instead.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS question_versions_immutability ON question_versions;
CREATE TRIGGER question_versions_immutability
  BEFORE UPDATE ON question_versions
  FOR EACH ROW
  EXECUTE FUNCTION prevent_submitted_version_mutation();

-- ── Updated at trigger ──
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER exams_updated_at BEFORE UPDATE ON exams FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER subjects_updated_at BEFORE UPDATE ON subjects FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER topics_updated_at BEFORE UPDATE ON topics FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER subtopics_updated_at BEFORE UPDATE ON subtopics FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER questions_updated_at BEFORE UPDATE ON questions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
