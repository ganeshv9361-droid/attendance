-- ==========================================================
-- EduTrack Campus v1.0 - Supabase PostgreSQL Database Schema
-- Run this script in Supabase Dashboard -> SQL Editor -> New Query
-- ==========================================================

-- 1. Classes / Departments Table
CREATE TABLE IF NOT EXISTS classes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    room TEXT,
    teacher_name TEXT DEFAULT ''
);

-- 2. Users Table (Dean/Admin and Faculty/Professors)
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'teacher')),
    full_name TEXT NOT NULL,
    assigned_class_id TEXT REFERENCES classes(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Students Table
CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    roll_no INTEGER NOT NULL,
    name TEXT NOT NULL,
    gender TEXT DEFAULT 'Other',
    class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    parent_name TEXT,
    parent_phone TEXT,
    email TEXT,
    qr_token TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Academic Calendar & Holidays Table
CREATE TABLE IF NOT EXISTS holidays (
    id BIGSERIAL PRIMARY KEY,
    date DATE UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Daily Attendance Table (Morning Lectures & Afternoon Labs)
CREATE TABLE IF NOT EXISTS attendance (
    id BIGSERIAL PRIMARY KEY,
    date DATE NOT NULL,
    session TEXT NOT NULL CHECK(session IN ('MORNING', 'AFTERNOON')),
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK(status IN ('PRESENT', 'ABSENT')),
    method TEXT DEFAULT 'MANUAL' CHECK(method IN ('QR', 'MANUAL')),
    marked_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_daily_student_session UNIQUE (date, session, student_id)
);

-- Optimized Indexes for Query Performance
CREATE INDEX IF NOT EXISTS idx_attendance_date_session ON attendance(date, session);
CREATE INDEX IF NOT EXISTS idx_attendance_class_date ON attendance(class_id, date);
CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);

-- Provision Default Master Admin (Login: admin / admin123)
INSERT INTO users (username, password, role, full_name, assigned_class_id)
VALUES ('admin', 'admin123', 'admin', 'College Administrator / Dean', NULL)
ON CONFLICT (username) DO NOTHING;

-- Enable Row Level Security (RLS)
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Allow full access to API service & Anon key
DROP POLICY IF EXISTS "Allow full access to classes" ON classes;
CREATE POLICY "Allow full access to classes" ON classes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow full access to users" ON users;
CREATE POLICY "Allow full access to users" ON users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow full access to students" ON students;
CREATE POLICY "Allow full access to students" ON students FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow full access to holidays" ON holidays;
CREATE POLICY "Allow full access to holidays" ON holidays FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow full access to attendance" ON attendance;
CREATE POLICY "Allow full access to attendance" ON attendance FOR ALL USING (true) WITH CHECK (true);
