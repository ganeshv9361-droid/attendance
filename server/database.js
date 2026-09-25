import dotenv from 'dotenv';
dotenv.config();

import sqlite3 from 'sqlite3';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, 'attendance.db');

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
export const isCloudMode = Boolean(connectionString);

let pool = null;
let sqliteDb = null;

if (isCloudMode) {
  console.log('Connecting to Cloud PostgreSQL / Supabase Database...');
  pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  pool.on('error', (err) => {
    console.error('Unexpected error on idle PostgreSQL client:', err);
  });
} else {
  console.log('No DATABASE_URL supplied. Connecting to local SQLite database at', dbPath);
  sqliteDb = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Error opening local SQLite database:', err.message);
    } else {
      console.log('Connected to local SQLite database.');
    }
  });
}

// Convert SQLite parameterized SQL to PostgreSQL parameterized SQL
function formatPgSql(sql) {
  let paramIdx = 1;
  let formatted = sql.replace(/\?/g, () => `$${paramIdx++}`);

  // Handle SQLite INSERT OR REPLACE INTO attendance syntax for PostgreSQL
  if (/INSERT\s+OR\s+REPLACE\s+INTO\s+attendance/i.test(formatted)) {
    formatted = formatted.replace(
      /INSERT\s+OR\s+REPLACE\s+INTO\s+attendance\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i,
      'INSERT INTO attendance ($1) VALUES ($2) ON CONFLICT (date, session, student_id) DO UPDATE SET status = EXCLUDED.status, method = EXCLUDED.method, marked_at = CURRENT_TIMESTAMP'
    );
  }

  return formatted;
}

// Helper for run (INSERT, UPDATE, DELETE)
export const run = async (sql, params = []) => {
  if (isCloudMode) {
    const pgSql = formatPgSql(sql);
    const res = await pool.query(pgSql, params);
    return { lastID: res.rows[0]?.id || null, changes: res.rowCount };
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }
};

// Helper for get (Single row)
export const get = async (sql, params = []) => {
  if (isCloudMode) {
    const pgSql = formatPgSql(sql);
    const res = await pool.query(pgSql, params);
    return res.rows[0] || null;
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }
};

// Helper for all (Multiple rows)
export const all = async (sql, params = []) => {
  if (isCloudMode) {
    const pgSql = formatPgSql(sql);
    const res = await pool.query(pgSql, params);
    return res.rows;
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
};

export async function initDatabase() {
  if (isCloudMode) {
    console.log('Validating Supabase PostgreSQL connection & Master Administrator...');
    try {
      // 1. Ensure students table has year, branch, section, phone columns
      await pool.query(`
        ALTER TABLE students ADD COLUMN IF NOT EXISTS year TEXT;
        ALTER TABLE students ADD COLUMN IF NOT EXISTS branch TEXT;
        ALTER TABLE students ADD COLUMN IF NOT EXISTS section TEXT;
        ALTER TABLE students ADD COLUMN IF NOT EXISTS phone TEXT;
      `);

      // 2. Ensure default college departments exist if classes is empty
      const classesCount = await pool.query('SELECT COUNT(*) FROM classes');
      if (parseInt(classesCount.rows[0].count) === 0) {
        console.log('Seeding standard college departments on Supabase...');
        const initialClasses = [
          ['1-CSE-A', 'First Year CSE - Section A', 'Hall 101', 'Prof. Alan Turing'],
          ['1-CSE-B', 'First Year CSE - Section B', 'Hall 102', 'Prof. Ada Lovelace'],
          ['2-CSE', 'Second Year CSE', 'Hall 201', 'Dr. Donald Knuth'],
          ['3-CSE', 'Third Year CSE', 'Hall 301', 'Dr. Tim Berners-Lee'],
          ['4-CSE', 'Final Year CSE', 'Lab 401', 'Dr. Dennis Ritchie'],
          ['1-ECE-A', 'First Year ECE - Section A', 'Hall 105', 'Dr. Nikola Tesla'],
          ['2-ECE', 'Second Year ECE', 'Hall 205', 'Prof. Claude Shannon'],
          ['1-MECH-A', 'First Year MECH - Section A', 'Hall 108', 'Prof. James Watt']
        ];
        for (const [cid, cname, room, teacher] of initialClasses) {
          await pool.query(
            'INSERT INTO classes (id, name, room, teacher_name) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING',
            [cid, cname, room, teacher]
          );
        }
      }

      // 3. Ensure master admin
      const res = await pool.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
      if (res.rows.length === 0) {
        await pool.query(`
          INSERT INTO users (username, password, role, full_name, assigned_class_id)
          VALUES ('admin', 'admin123', 'admin', 'College Administrator / Dean', NULL)
          ON CONFLICT (username) DO NOTHING
        `);
        console.log('Master Administrator account initialized on Supabase: admin / admin123');
      } else {
        console.log('Master Administrator verified on Supabase.');
      }
    } catch (err) {
      console.warn('Could not query users/classes table directly:', err.message);
    }
    return;
  }

  // SQLite Fallback Table Creation
  await run(`
    CREATE TABLE IF NOT EXISTS classes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      room TEXT,
      teacher_name TEXT DEFAULT ''
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'teacher')),
      full_name TEXT NOT NULL,
      assigned_class_id TEXT,
      FOREIGN KEY(assigned_class_id) REFERENCES classes(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      roll_no INTEGER NOT NULL,
      name TEXT NOT NULL,
      gender TEXT DEFAULT 'Other',
      class_id TEXT NOT NULL,
      parent_name TEXT,
      parent_phone TEXT,
      email TEXT,
      qr_token TEXT NOT NULL,
      year TEXT,
      branch TEXT,
      section TEXT,
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(class_id) REFERENCES classes(id)
    )
  `);

  // Migrate existing SQLite tables to include new columns if missing
  try { await run('ALTER TABLE students ADD COLUMN year TEXT'); } catch(e) {}
  try { await run('ALTER TABLE students ADD COLUMN branch TEXT'); } catch(e) {}
  try { await run('ALTER TABLE students ADD COLUMN section TEXT'); } catch(e) {}
  try { await run('ALTER TABLE students ADD COLUMN phone TEXT'); } catch(e) {}

  await run(`
    CREATE TABLE IF NOT EXISTS holidays (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      session TEXT NOT NULL CHECK(session IN ('MORNING', 'AFTERNOON')),
      student_id TEXT NOT NULL,
      class_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('PRESENT', 'ABSENT')),
      method TEXT DEFAULT 'MANUAL' CHECK(method IN ('QR', 'MANUAL')),
      marked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(date, session, student_id),
      FOREIGN KEY(student_id) REFERENCES students(id),
      FOREIGN KEY(class_id) REFERENCES classes(id)
    )
  `);

  // Ensure default Master Admin account exists
  const adminExists = await get("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  if (!adminExists) {
    await run(`
      INSERT INTO users (username, password, role, full_name, assigned_class_id)
      VALUES ('admin', 'admin123', 'admin', 'College Administrator / Dean', NULL)
    `);
    console.log('Master Administrator account provisioned: admin / admin123');
  }

  console.log('EduTrack Campus Production Database v1.0 initialized.');
}

export default { run, get, all, initDatabase, isCloudMode };
