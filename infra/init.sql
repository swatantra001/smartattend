-- Enable PostGIS for geospatial queries
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── COLLEGES ────────────────────────────────────────────────────────────────
CREATE TABLE colleges (
  college_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              TEXT NOT NULL,
  address           TEXT,
  config            JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─── DEPARTMENTS ─────────────────────────────────────────────────────────────
CREATE TABLE departments (
  dept_id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  college_id        UUID NOT NULL REFERENCES colleges(college_id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  code              TEXT NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─── USERS ───────────────────────────────────────────────────────────────────
CREATE TYPE user_role AS ENUM ('STUDENT', 'PROFESSOR', 'ADMIN');

CREATE TABLE users (
  user_id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  college_id        UUID NOT NULL REFERENCES colleges(college_id) ON DELETE CASCADE,
  email             TEXT UNIQUE NOT NULL,
  password_hash     TEXT NOT NULL,
  role              user_role NOT NULL,
  is_active         BOOLEAN DEFAULT TRUE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_college ON users(college_id);

-- ─── STUDENTS ────────────────────────────────────────────────────────────────
CREATE TABLE students (
  student_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID UNIQUE NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  dept_id           UUID NOT NULL REFERENCES departments(dept_id),
  name              TEXT NOT NULL,
  roll_number       TEXT UNIQUE NOT NULL,
  semester          INTEGER NOT NULL CHECK (semester BETWEEN 1 AND 10),
  face_embedding    FLOAT8[],           -- 512-dim ArcFace embedding
  face_enrolled_at  TIMESTAMPTZ,
  face_photo_url    TEXT,               -- S3 URL of enrollment photo (30-day TTL)
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_students_roll ON students(roll_number);
CREATE INDEX idx_students_dept ON students(dept_id);

-- ─── PROFESSORS ──────────────────────────────────────────────────────────────
CREATE TABLE professors (
  professor_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID UNIQUE NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  dept_id           UUID NOT NULL REFERENCES departments(dept_id),
  name              TEXT NOT NULL,
  employee_code     TEXT UNIQUE NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─── COURSES ─────────────────────────────────────────────────────────────────
CREATE TABLE courses (
  course_id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dept_id           UUID NOT NULL REFERENCES departments(dept_id),
  name              TEXT NOT NULL,
  code              TEXT NOT NULL,
  section           TEXT,
  semester          INTEGER NOT NULL CHECK (semester BETWEEN 1 AND 10),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(code, section)
);

-- ─── COURSE ENROLLMENTS ───────────────────────────────────────────────────────
CREATE TABLE course_enrollments (
  enrollment_id     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id         UUID NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
  student_id        UUID NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
  professor_id      UUID NOT NULL REFERENCES professors(professor_id),
  enrolled_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(course_id, student_id)
);

CREATE INDEX idx_enrollments_course ON course_enrollments(course_id);
CREATE INDEX idx_enrollments_student ON course_enrollments(student_id);

-- ─── DEVICE BINDINGS ──────────────────────────────────────────────────────────
CREATE TABLE device_bindings (
  binding_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  device_id         TEXT NOT NULL,      -- SHA256 of installation UUID
  device_model      TEXT,
  platform          TEXT,               -- 'ios' | 'android'
  fcm_token         TEXT,               -- Firebase push token
  bound_at          TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at      TIMESTAMPTZ DEFAULT NOW(),
  is_active         BOOLEAN DEFAULT TRUE,
  UNIQUE(user_id, device_id)
);

CREATE INDEX idx_device_bindings_user ON device_bindings(user_id);

-- ─── DEVICE RESET REQUESTS ────────────────────────────────────────────────────
CREATE TYPE reset_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE device_reset_requests (
  request_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES users(user_id),
  old_device_id     TEXT,
  new_device_id     TEXT NOT NULL,
  reason            TEXT NOT NULL,
  proof_url         TEXT,               -- S3 URL of uploaded proof image
  status            reset_status DEFAULT 'PENDING',
  admin_id          UUID REFERENCES users(user_id),
  admin_note        TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  resolved_at       TIMESTAMPTZ
);

-- ─── STUDENT LOCATIONS (last known) ──────────────────────────────────────────
CREATE TABLE student_locations (
  location_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id        UUID UNIQUE NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
  location          GEOGRAPHY(POINT, 4326) NOT NULL,
  accuracy_meters   FLOAT,
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- PostGIS spatial index for geofence queries
CREATE INDEX idx_student_locations_geo ON student_locations USING GIST(location);

-- ─── ATTENDANCE SESSIONS ──────────────────────────────────────────────────────
CREATE TYPE session_status AS ENUM ('ACTIVE', 'ENDED', 'EXPIRED');

CREATE TABLE attendance_sessions (
  session_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  professor_id      UUID NOT NULL REFERENCES professors(professor_id),
  course_id         UUID NOT NULL REFERENCES courses(course_id),
  professor_location GEOGRAPHY(POINT, 4326) NOT NULL,
  radius_meters     INTEGER DEFAULT 200,
  status            session_status DEFAULT 'ACTIVE',
  challenges        TEXT[],             -- e.g. ['BLINK_TWICE', 'TURN_HEAD_RIGHT']
  scene_baseline    FLOAT8[],           -- averaged background feature vector
  scene_sample_count INTEGER DEFAULT 0,
  started_at        TIMESTAMPTZ DEFAULT NOW(),
  ended_at          TIMESTAMPTZ,
  expires_at        TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_sessions_professor ON attendance_sessions(professor_id);
CREATE INDEX idx_sessions_status ON attendance_sessions(status);

-- ─── ATTENDANCE RECORDS ───────────────────────────────────────────────────────
CREATE TYPE attendance_status AS ENUM ('PRESENT', 'ABSENT', 'MANUAL_OVERRIDE');
CREATE TYPE verification_status AS ENUM ('PENDING', 'FACE_PASSED', 'VERIFIED', 'FAILED', 'SUSPICIOUS');
CREATE TYPE marked_by AS ENUM ('SYSTEM', 'PROFESSOR');

CREATE TABLE attendance_records (
  record_id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id            UUID NOT NULL REFERENCES attendance_sessions(session_id),
  student_id            UUID NOT NULL REFERENCES students(student_id),
  status                attendance_status DEFAULT 'ABSENT',
  verification_status   verification_status DEFAULT 'PENDING',
  face_score            FLOAT,           -- cosine similarity 0-1
  liveness_score        FLOAT,           -- 0-1 composite score
  scene_score           FLOAT,           -- cosine similarity vs classroom baseline
  marked_by             marked_by DEFAULT 'SYSTEM',
  professor_override_by UUID REFERENCES professors(professor_id),
  verification_timestamp TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, student_id)
);

CREATE INDEX idx_records_session ON attendance_records(session_id);
CREATE INDEX idx_records_student ON attendance_records(student_id);

-- ─── AUDIT LOGS ───────────────────────────────────────────────────────────────
CREATE TABLE audit_logs (
  log_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID REFERENCES users(user_id),
  action        TEXT NOT NULL,
  metadata      JSONB DEFAULT '{}',
  ip_address    INET,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);

-- ─── TRIGGER: auto-update updated_at ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────────
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY;

-- Seed college for development
INSERT INTO colleges (college_id, name, address)
VALUES ('00000000-0000-0000-0000-000000000001', 'Demo College', 'Demo Address');






















-- ─── MIGRATION: SmartAttend New Features ─────────────────────────────────────
-- Run after 001_initial.sql

-- ─── OTP VERIFICATION TABLE ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS otp_verifications (
  otp_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  identifier    TEXT NOT NULL,        -- email OR roll_number/employee_code
  otp_hash      TEXT NOT NULL,        -- bcrypt hash of 6-digit OTP
  purpose       TEXT NOT NULL,        -- 'PASSWORD_RESET'
  expires_at    TIMESTAMPTZ NOT NULL,
  used          BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_otp_identifier ON otp_verifications(identifier);

-- -- ─── SESSION CHAT MESSAGES ───────────────────────────────────────────────────
-- CREATE TABLE IF NOT EXISTS session_chat_messages (
--   message_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--   session_id    UUID NOT NULL REFERENCES attendance_sessions(session_id) ON DELETE CASCADE,
--   student_id    UUID NOT NULL REFERENCES students(student_id),
--   message       TEXT NOT NULL CHECK (char_length(message) <= 500),
--   created_at    TIMESTAMPTZ DEFAULT NOW()
-- );

-- ─── ADD attendance_count TO attendance_sessions ─────────────────────────────
-- Tracks how many attendance credits a student earns for this session (1 or 2 based on duration)
ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS attendance_credits INTEGER DEFAULT 1;
-- Duration in minutes of the class
ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS class_duration_minutes INTEGER DEFAULT 60;

-- ─── ADD override_reason TO attendance_records ───────────────────────────────
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS override_reason TEXT;

-- ─── COURSE SOFT-DELETE ───────────────────────────────────────────────────────
ALTER TABLE courses ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(user_id);






-- ─── MIGRATION: Add pending_email to students and professors ──────────────────
-- This column holds the admin-provided email BEFORE the user creates their account.
-- Once they register, users.email is the source of truth.

ALTER TABLE students ADD COLUMN IF NOT EXISTS pending_email TEXT;
ALTER TABLE professors ADD COLUMN IF NOT EXISTS pending_email TEXT;

-- Index for fast lookup during registration
CREATE INDEX IF NOT EXISTS idx_students_pending_email ON students(pending_email);
CREATE INDEX IF NOT EXISTS idx_professors_pending_email ON professors(pending_email);

-- Allow user_id to be NULL initially (pre-registration state)
-- students.user_id and professors.user_id were NOT NULL before — change to nullable
ALTER TABLE students ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE professors ALTER COLUMN user_id DROP NOT NULL;






-- ─── MIGRATION: professor_courses table ──────────────────────────────────────
-- D:\smartattend\services\api\src\database\migrations\003_professor_courses.sql
--
-- Run this ONCE against your PostgreSQL database.
-- It is safe to run multiple times (uses IF NOT EXISTS / ON CONFLICT guards).
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── NEW TABLE: professor_courses ────────────────────────────────────────────
-- Tracks which professors are assigned to which courses.
-- This is separate from course_enrollments (which tracks student-professor-course).
-- A professor must have a row here before they can enroll students.

CREATE TABLE IF NOT EXISTS professor_courses (
  assignment_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  professor_id    UUID NOT NULL REFERENCES professors(professor_id) ON DELETE CASCADE,
  course_id       UUID NOT NULL REFERENCES courses(course_id)      ON DELETE CASCADE,
  assigned_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(professor_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_professor_courses_professor ON professor_courses(professor_id);
CREATE INDEX IF NOT EXISTS idx_professor_courses_course    ON professor_courses(course_id);

-- ─── BACKFILL: existing professor-course relationships ───────────────────────
-- If you already have course_enrollments rows with professor_id set,
-- migrate those professor-course pairs into professor_courses.
-- This ensures professors who already have students don't lose their courses.

INSERT INTO professor_courses (professor_id, course_id)
SELECT DISTINCT ce.professor_id, ce.course_id
FROM course_enrollments ce
WHERE ce.professor_id IS NOT NULL
ON CONFLICT (professor_id, course_id) DO NOTHING;

-- ─── SAFETY: make sure courses table has soft-delete columns ─────────────────
-- (These were added in migration 002 — safe to run again)
ALTER TABLE courses ADD COLUMN IF NOT EXISTS is_active   BOOLEAN DEFAULT TRUE;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS deleted_by  UUID REFERENCES users(user_id);

-- ─── VERIFY ──────────────────────────────────────────────────────────────────
-- Run this to confirm the migration worked:
-- SELECT COUNT(*) FROM professor_courses;
-- SELECT * FROM professor_courses LIMIT 5;


DROP TABLE IF EXISTS session_chat_messages;

CREATE TABLE IF NOT EXISTS session_chat_messages (
  message_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id    UUID NOT NULL REFERENCES attendance_sessions(session_id) ON DELETE CASCADE,
  sender_type   TEXT NOT NULL CHECK (sender_type IN ('STUDENT', 'PROFESSOR')),
  student_id    UUID REFERENCES students(student_id) ON DELETE SET NULL,
  professor_id  UUID REFERENCES professors(professor_id) ON DELETE SET NULL,
  message       TEXT NOT NULL CHECK (char_length(message) <= 500),
  created_at    TIMESTAMPTZ DEFAULT NOW(),

  -- Logic Check: Ensure a message has exactly one valid sender based on type
  CONSTRAINT check_sender_logic CHECK (
    (sender_type = 'STUDENT' AND student_id IS NOT NULL AND professor_id IS NULL) OR
    (sender_type = 'PROFESSOR' AND professor_id IS NOT NULL AND student_id IS NULL)
  )
);
CREATE INDEX idx_chat_session ON session_chat_messages(session_id, created_at DESC);
