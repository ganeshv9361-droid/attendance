import express from 'express';
import cors from 'cors';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { run, get, all, initDatabase, isCloudMode } from './database.js';
import { generateDailyExcelWorkbook } from './excelExport.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, 'public');

export function getLocalIpAddress() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Serve static frontend assets if available
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
}

// Initialize database schema and seeds
initDatabase().catch(err => {
  console.error('Failed to initialize database:', err);
});

// Helper: Determine session based on 12:10 PM rule
export function getCurrentSession() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  // 12:10 PM is 12 * 60 + 10 = 730 minutes
  const totalMinutes = hours * 60 + minutes;
  return totalMinutes < 730 ? 'MORNING' : 'AFTERNOON';
}

// Health check route for Render monitoring
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'edutrack-campus-api',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Server info endpoint (provides Wi-Fi IP and database mode for web and mobile)
app.get('/api/server-info', (req, res) => {
  const localIp = getLocalIpAddress();
  res.json({
    status: 'ok',
    service: 'edutrack-campus-api',
    localIp,
    port: PORT,
    wifiUrl: `http://${localIp}:${PORT}`,
    isCloudMode,
    database: isCloudMode ? 'Cloud PostgreSQL / Supabase' : 'Local SQLite (attendance.db - Offline)'
  });
});

// ---------------- AUTHENTICATION ----------------
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    let query = 'SELECT * FROM users WHERE username = ? AND password = ?';
    let params = [username, password];
    if (role) {
      query += ' AND role = ?';
      params.push(role);
    }

    const user = await get(query, params);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials or role mismatch' });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        fullName: user.full_name,
        assignedClassId: user.assigned_class_id
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error during login' });
  }
});

// ---------------- CLASSES ----------------
app.get('/api/classes', async (req, res) => {
  try {
    const classes = await all('SELECT * FROM classes ORDER BY id ASC');
    // Also include student counts
    const classStats = await all(`
      SELECT class_id, COUNT(*) as student_count 
      FROM students 
      GROUP BY class_id
    `);
    const countMap = {};
    for (const stat of classStats) {
      countMap[stat.class_id] = stat.student_count;
    }

    const result = classes.map(c => ({
      ...c,
      studentCount: countMap[c.id] || 0
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/classes', async (req, res) => {
  try {
    const { id, name, room, teacherName } = req.body;
    if (!id || !name) {
      return res.status(400).json({ error: 'Class/Department ID and Name are required' });
    }
    await run(
      'INSERT INTO classes (id, name, room, teacher_name) VALUES (?, ?, ?, ?)',
      [id, name, room || '', teacherName || '']
    );
    res.status(201).json({ success: true, message: 'Department/Class created' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/classes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, room, teacherName } = req.body;
    await run(
      'UPDATE classes SET name = ?, room = ?, teacher_name = ? WHERE id = ?',
      [name, room || '', teacherName || '', id]
    );
    res.json({ success: true, message: 'Class updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/classes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await run('DELETE FROM classes WHERE id = ?', [id]);
    res.json({ success: true, message: 'Class deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ---------------- TEACHERS / FACULTY MANAGEMENT (ADMIN ONLY) ----------------
app.get('/api/teachers', async (req, res) => {
  try {
    const teachers = await all(`
      SELECT u.id, u.username, u.role, u.full_name, u.assigned_class_id, c.name as class_name
      FROM users u
      LEFT JOIN classes c ON u.assigned_class_id = c.id
      WHERE u.role = 'teacher'
      ORDER BY u.id ASC
    `);
    res.json(teachers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/teachers', async (req, res) => {
  try {
    const { username, password, fullName, assignedClassId } = req.body;
    if (!username || !password || !fullName) {
      return res.status(400).json({ error: 'Username, password, and full name are required' });
    }

    let cleanClassId = assignedClassId ? assignedClassId.trim() : null;
    if (cleanClassId) {
      const existingClass = await get('SELECT id FROM classes WHERE id = ? OR LOWER(name) = LOWER(?)', [cleanClassId, cleanClassId]);
      if (existingClass) {
        cleanClassId = existingClass.id;
      } else {
        // Auto-create class/course when typed manually
        await run('INSERT INTO classes (id, name, room, teacher_name) VALUES (?, ?, ?, ?)', [
          cleanClassId,
          cleanClassId,
          'Main Campus',
          fullName
        ]);
      }
    }

    await run(`
      INSERT INTO users (username, password, role, full_name, assigned_class_id)
      VALUES (?, ?, 'teacher', ?, ?)
    `, [username, password, fullName, cleanClassId || null]);

    // Also update class teacher_name if assigned
    if (cleanClassId) {
      await run('UPDATE classes SET teacher_name = ? WHERE id = ?', [fullName, cleanClassId]);
    }

    res.status(201).json({ success: true, message: 'Faculty account created successfully' });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: `Username "${req.body.username}" is already taken` });
    }
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/teachers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { username, password, fullName, assignedClassId } = req.body;

    let cleanClassId = assignedClassId ? assignedClassId.trim() : null;
    if (cleanClassId) {
      const existingClass = await get('SELECT id FROM classes WHERE id = ? OR LOWER(name) = LOWER(?)', [cleanClassId, cleanClassId]);
      if (existingClass) {
        cleanClassId = existingClass.id;
      } else {
        await run('INSERT INTO classes (id, name, room, teacher_name) VALUES (?, ?, ?, ?)', [
          cleanClassId,
          cleanClassId,
          'Main Campus',
          fullName
        ]);
      }
    }

    let query = 'UPDATE users SET username = ?, full_name = ?, assigned_class_id = ?';
    let params = [username, fullName, cleanClassId || null];

    if (password) {
      query += ', password = ?';
      params.push(password);
    }

    query += ' WHERE id = ? AND role = "teacher"';
    params.push(id);

    await run(query, params);

    if (cleanClassId && fullName) {
      await run('UPDATE classes SET teacher_name = ? WHERE id = ?', [fullName, cleanClassId]);
    }

    res.json({ success: true, message: 'Faculty account updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/teachers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await run('DELETE FROM users WHERE id = ? AND role = "teacher"', [id]);
    res.json({ success: true, message: 'Faculty account deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ---------------- STUDENTS ----------------
app.get('/api/students', async (req, res) => {
  try {
    const { classId, search } = req.query;
    let sql = `
      SELECT s.*, c.name as class_name 
      FROM students s
      LEFT JOIN classes c ON s.class_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (classId) {
      sql += ' AND s.class_id = ?';
      params.push(classId);
    }

    if (search) {
      sql += ' AND (s.name LIKE ? OR s.roll_no LIKE ? OR s.id LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY s.class_id ASC, s.roll_no ASC';
    const students = await all(sql, params);
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/students/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const student = await get(`
      SELECT s.*, c.name as class_name 
      FROM students s 
      LEFT JOIN classes c ON s.class_id = c.id 
      WHERE s.id = ? OR s.qr_token = ? OR CAST(s.roll_no AS TEXT) = ?
    `, [id, id, id]);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json(student);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/students', async (req, res) => {
  try {
    const { rollNo, name, gender, classId, parentName, parentPhone, email, year, branch, section, phone } = req.body;
    if (!rollNo || !name) {
      return res.status(400).json({ error: 'Roll No and Name are required' });
    }

    // Auto-derive class ID if not explicitly provided
    let cleanClassId = classId ? classId.trim() : '';
    if (!cleanClassId && year && branch) {
      const cleanYear = year.replace(/[^0-9]/g, '') || year;
      if (cleanYear === '1' || year.toLowerCase().includes('1st') || year.toLowerCase().includes('first')) {
        cleanClassId = `1-${branch.toUpperCase()}-${(section || 'A').toUpperCase()}`;
      } else {
        cleanClassId = `${cleanYear}-${branch.toUpperCase()}`;
      }
    }
    if (!cleanClassId) cleanClassId = 'General';

    const existingClass = await get('SELECT id FROM classes WHERE id = ? OR LOWER(name) = LOWER(?)', [cleanClassId, cleanClassId]);
    if (existingClass) {
      cleanClassId = existingClass.id;
    } else {
      // Auto-create class so manually typed classes work seamlessly!
      await run('INSERT INTO classes (id, name, room, teacher_name) VALUES (?, ?, ?, ?)', [
        cleanClassId,
        cleanClassId,
        'Main Campus',
        ''
      ]);
    }

    // Auto-generate ID: STU + random 4-digit
    const studentId = 'STU' + Math.floor(1000 + Math.random() * 9000);

    const qrToken = JSON.stringify({
      schema: 'COLLEGE_ATTENDANCE_V1',
      studentId: studentId,
      rollNo: Number(rollNo),
      name: name,
      year: year || '',
      branch: branch || '',
      section: section || '',
      classId: cleanClassId
    });

    await run(`
      INSERT INTO students (id, roll_no, name, gender, class_id, parent_name, parent_phone, email, qr_token, year, branch, section, phone)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      studentId, 
      rollNo, 
      name, 
      gender || 'Other', 
      cleanClassId, 
      parentName || '', 
      parentPhone || phone || '', 
      email || '', 
      qrToken,
      year || '',
      branch || '',
      section || '',
      phone || parentPhone || ''
    ]);

    res.status(201).json({ 
      success: true, 
      studentId, 
      classId: cleanClassId,
      qrToken,
      message: 'Student registered successfully' 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/students/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rollNo, name, gender, classId, parentName, parentPhone, email, year, branch, section, phone } = req.body;

    let cleanClassId = classId ? classId.trim() : '';
    if (!cleanClassId && year && branch) {
      const cleanYear = year.replace(/[^0-9]/g, '') || year;
      if (cleanYear === '1' || year.toLowerCase().includes('1st') || year.toLowerCase().includes('first')) {
        cleanClassId = `1-${branch.toUpperCase()}-${(section || 'A').toUpperCase()}`;
      } else {
        cleanClassId = `${cleanYear}-${branch.toUpperCase()}`;
      }
    }
    if (!cleanClassId) cleanClassId = 'General';

    const existingClass = await get('SELECT id FROM classes WHERE id = ? OR LOWER(name) = LOWER(?)', [cleanClassId, cleanClassId]);
    if (existingClass) {
      cleanClassId = existingClass.id;
    } else {
      await run('INSERT INTO classes (id, name, room, teacher_name) VALUES (?, ?, ?, ?)', [
        cleanClassId,
        cleanClassId,
        'Main Campus',
        ''
      ]);
    }

    const qrToken = JSON.stringify({
      schema: 'COLLEGE_ATTENDANCE_V1',
      studentId: id,
      rollNo: Number(rollNo),
      name: name,
      year: year || '',
      branch: branch || '',
      section: section || '',
      classId: cleanClassId
    });

    await run(`
      UPDATE students 
      SET roll_no = ?, name = ?, gender = ?, class_id = ?, parent_name = ?, parent_phone = ?, email = ?, qr_token = ?, year = ?, branch = ?, section = ?, phone = ?
      WHERE id = ?
    `, [
      rollNo, 
      name, 
      gender, 
      cleanClassId, 
      parentName || '', 
      parentPhone || phone || '', 
      email || '', 
      qrToken, 
      year || '', 
      branch || '', 
      section || '', 
      phone || parentPhone || '', 
      id
    ]);

    res.json({ success: true, message: 'Student updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/students/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await run('DELETE FROM attendance WHERE student_id = ?', [id]);
    await run('DELETE FROM students WHERE id = ?', [id]);
    res.json({ success: true, message: 'Student deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate QR Code image for a student
app.get('/api/students/:id/qr', async (req, res) => {
  try {
    const { id } = req.params;
    const student = await get('SELECT * FROM students WHERE id = ?', [id]);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const qrData = student.qr_token || JSON.stringify({
      studentId: student.id,
      rollNo: student.roll_no,
      name: student.name,
      classId: student.class_id
    });

    const qrDataUrl = await QRCode.toDataURL(qrData, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 280,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    });

    res.json({ studentId: id, qrDataUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ---------------- HOLIDAYS ----------------
app.get('/api/holidays', async (req, res) => {
  try {
    const holidays = await all('SELECT * FROM holidays ORDER BY date ASC');
    res.json(holidays);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/holidays', async (req, res) => {
  try {
    const { date, title, description } = req.body;
    if (!date || !title) {
      return res.status(400).json({ error: 'Date and Title are required' });
    }
    await run(
      'INSERT INTO holidays (date, title, description) VALUES (?, ?, ?)',
      [date, title, description || 'School Holiday']
    );
    res.status(201).json({ success: true, message: 'Holiday added' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/holidays/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await run('DELETE FROM holidays WHERE id = ?', [id]);
    res.json({ success: true, message: 'Holiday deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ---------------- ATTENDANCE ----------------
app.get('/api/attendance', async (req, res) => {
  try {
    const { date = new Date().toISOString().split('T')[0], classId, session } = req.query;
    let sql = 'SELECT * FROM attendance WHERE date = ?';
    const params = [date];

    if (session) {
      sql += ' AND session = ?';
      params.push(session.toUpperCase());
    }

    if (classId) {
      sql += ' AND class_id = ?';
      params.push(classId);
    }

    const records = await all(sql, params);
    const formattedRecords = records.map(r => ({
      ...r,
      date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date).split('T')[0]
    }));
    res.json(formattedRecords);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark Attendance: Supports single QR scan or bulk manual update
app.post('/api/attendance/mark', async (req, res) => {
  try {
    const {
      date = new Date().toISOString().split('T')[0],
      session = getCurrentSession(),
      classId,
      // For Single QR Scan:
      qrData,
      studentId,
      // For Bulk Manual Update:
      records
    } = req.body;

    const activeSession = session.toUpperCase();

    // 1. Single QR Scan - Automatically detect student & assign attendance to their specific class
    if (qrData || studentId) {
      let targetStudentId = studentId;

      if (qrData) {
        try {
          const parsed = typeof qrData === 'string' ? JSON.parse(qrData) : qrData;
          targetStudentId = parsed.studentId || parsed.id || parsed.student_id;
        } catch {
          targetStudentId = typeof qrData === 'string' ? qrData.trim() : qrData;
        }
      }

      if (!targetStudentId) {
        return res.status(400).json({ error: 'Valid Student ID or QR code is required' });
      }

      let student = await get(`
        SELECT s.*, c.name as class_name 
        FROM students s 
        LEFT JOIN classes c ON s.class_id = c.id 
        WHERE s.id = ? OR s.qr_token = ? OR LOWER(s.id) = LOWER(?)
      `, [targetStudentId, qrData || targetStudentId, targetStudentId]);

      if (!student && qrData) {
        student = await get(`
          SELECT s.*, c.name as class_name 
          FROM students s 
          LEFT JOIN classes c ON s.class_id = c.id 
          WHERE CAST(s.roll_no AS TEXT) = ? OR s.roll_no = ?
        `, [String(targetStudentId), Number(targetStudentId) || 0]);
      }

      if (!student) {
        return res.status(404).json({ error: `Student with ID "${targetStudentId}" not found in database` });
      }

      // Automatically route attendance to student's particular class!
      const targetClassId = student.class_id || 'General';
      const className = student.class_name || targetClassId;

      // Check if already marked present
      const existing = await get(
        'SELECT * FROM attendance WHERE date = ? AND session = ? AND student_id = ?',
        [date, activeSession, student.id]
      );

      const isAlreadyPresent = existing && existing.status === 'PRESENT';

      await run(`
        INSERT OR REPLACE INTO attendance (date, session, student_id, class_id, status, method, marked_at)
        VALUES (?, ?, ?, ?, 'PRESENT', 'QR', CURRENT_TIMESTAMP)
      `, [date, activeSession, student.id, targetClassId]);

      return res.json({
        success: true,
        alreadyMarked: isAlreadyPresent,
        student: {
          id: student.id,
          rollNo: student.roll_no,
          name: student.name,
          classId: targetClassId,
          className,
          year: student.year,
          branch: student.branch,
          section: student.section,
          phone: student.phone || student.parent_phone,
          email: student.email,
          session: activeSession
        },
        message: isAlreadyPresent
          ? `${student.name} (#${student.roll_no}) was already marked PRESENT today in ${className}`
          : `✅ Verified! ${student.name} (#${student.roll_no}) marked PRESENT in ${className}`
      });
    }

    // 2. Bulk Manual Attendance Submission
    if (Array.isArray(records)) {
      for (const rec of records) {
        await run(`
          INSERT OR REPLACE INTO attendance (date, session, student_id, class_id, status, method, marked_at)
          VALUES (?, ?, ?, ?, ?, 'MANUAL', CURRENT_TIMESTAMP)
        `, [date, activeSession, rec.studentId, rec.classId || classId, rec.status]);
      }

      return res.json({
        success: true,
        count: records.length,
        message: `Successfully saved ${records.length} attendance records for ${activeSession}`
      });
    }

    res.status(400).json({ error: 'Please provide either qrData or records array' });
  } catch (error) {
    console.error('Attendance mark error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Comprehensive Daily Summary (Morning & Afternoon, All Classes, Absentees)
app.get('/api/attendance/daily-summary', async (req, res) => {
  try {
    const { date = new Date().toISOString().split('T')[0] } = req.query;

    const classes = await all('SELECT * FROM classes ORDER BY id ASC');
    const students = await all('SELECT * FROM students ORDER BY class_id ASC, roll_no ASC');
    const attendanceRecords = await all('SELECT * FROM attendance WHERE date = ?', [date]);
    const holiday = await get('SELECT * FROM holidays WHERE date = ?', [date]);

    // Build lookup: `${student_id}_${session}` => record
    const attMap = {};
    for (const att of attendanceRecords) {
      attMap[`${att.student_id}_${att.session}`] = att;
    }

    let schoolTotal = students.length;
    let schoolMorningPresent = 0;
    let schoolMorningAbsent = 0;
    let schoolAfternoonPresent = 0;
    let schoolAfternoonAbsent = 0;

    const classSummaries = [];
    const morningAbsentees = [];
    const afternoonAbsentees = [];

    for (const c of classes) {
      const classStudents = students.filter(s => s.class_id === c.id);
      let amPres = 0, amAbs = 0, pmPres = 0, pmAbs = 0;

      for (const s of classStudents) {
        const am = attMap[`${s.id}_MORNING`];
        const pm = attMap[`${s.id}_AFTERNOON`];

        if (am) {
          if (am.status === 'PRESENT') amPres++;
          else if (am.status === 'ABSENT') {
            amAbs++;
            morningAbsentees.push({
              studentId: s.id,
              rollNo: s.roll_no,
              name: s.name,
              classId: c.id,
              className: c.name,
              parentName: s.parent_name,
              parentPhone: s.parent_phone
            });
          }
        }

        if (pm) {
          if (pm.status === 'PRESENT') pmPres++;
          else if (pm.status === 'ABSENT') {
            pmAbs++;
            afternoonAbsentees.push({
              studentId: s.id,
              rollNo: s.roll_no,
              name: s.name,
              classId: c.id,
              className: c.name,
              parentName: s.parent_name,
              parentPhone: s.parent_phone
            });
          }
        }
      }

      schoolMorningPresent += amPres;
      schoolMorningAbsent += amAbs;
      schoolAfternoonPresent += pmPres;
      schoolAfternoonAbsent += pmAbs;

      classSummaries.push({
        classId: c.id,
        className: c.name,
        teacherName: c.teacher_name,
        room: c.room,
        totalStudents: classStudents.length,
        morning: {
          present: amPres,
          absent: amAbs,
          markedCount: amPres + amAbs,
          percentage: classStudents.length > 0 ? ((amPres / classStudents.length) * 100).toFixed(1) : 0
        },
        afternoon: {
          present: pmPres,
          absent: pmAbs,
          markedCount: pmPres + pmAbs,
          percentage: classStudents.length > 0 ? ((pmPres / classStudents.length) * 100).toFixed(1) : 0
        }
      });
    }

    res.json({
      date,
      holiday: holiday ? { title: holiday.title, description: holiday.description } : null,
      currentAutoSession: getCurrentSession(),
      schoolSummary: {
        totalStudents: schoolTotal,
        morning: {
          present: schoolMorningPresent,
          absent: schoolMorningAbsent,
          percentage: schoolTotal > 0 ? ((schoolMorningPresent / schoolTotal) * 100).toFixed(1) : 0
        },
        afternoon: {
          present: schoolAfternoonPresent,
          absent: schoolAfternoonAbsent,
          percentage: schoolTotal > 0 ? ((schoolAfternoonPresent / schoolTotal) * 100).toFixed(1) : 0
        }
      },
      classSummaries,
      morningAbsentees,
      afternoonAbsentees
    });
  } catch (error) {
    console.error('Daily summary error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ---------------- EXCEL EXPORT (CLASS SPECIFIC OR ALL CLASSES) ----------------
app.get('/api/attendance/export-excel', async (req, res) => {
  try {
    const { date = new Date().toISOString().split('T')[0], classId } = req.query;
    const workbook = await generateDailyExcelWorkbook(date, classId || null);

    const safeFilename = classId 
      ? `Attendance_${date}_${classId.replace(/[^a-zA-Z0-9_-]/g, '_')}.xlsx`
      : `Attendance_${date}_All_Classes.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeFilename}"`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Excel export error:', error);
    res.status(500).json({ error: 'Failed to generate Excel attendance report' });
  }
});

// SPA fallback: Serve web application or informative API status page
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: `API route not found: ${req.method} ${req.path}` });
  }

  const indexPath = path.resolve(publicDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>EduTrack Campus Cloud API</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 36px; max-width: 520px; width: 100%; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }
    .badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; background: rgba(34, 197, 94, 0.15); border: 1px solid rgba(34, 197, 94, 0.3); color: #4ade80; border-radius: 9999px; font-size: 0.85rem; font-weight: 600; margin-bottom: 16px; }
    .pulse { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 10px #22c55e; }
    h1 { margin: 0 0 8px 0; font-size: 1.6rem; color: #ffffff; }
    p { color: #94a3b8; font-size: 0.95rem; line-height: 1.5; margin: 0 0 20px 0; }
    .info-box { background: #0f172a; border-radius: 10px; padding: 16px; font-family: monospace; font-size: 0.85rem; color: #cbd5e1; margin-bottom: 20px; }
    .btn { display: inline-block; background: #3b82f6; color: white; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-weight: 600; font-size: 0.9rem; transition: background 0.2s; }
    .btn:hover { background: #2563eb; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge"><div class="pulse"></div> Live & Healthy</div>
    <h1>EduTrack Campus Cloud API</h1>
    <p>The centralized attendance & student management cloud service is online and connected to Supabase PostgreSQL.</p>
    <div class="info-box">
      <div>✓ Database: Supabase PostgreSQL (Cloud)</div>
      <div>✓ Service: edutrack-campus-api</div>
      <div>✓ Uptime: ${Math.floor(process.uptime())}s</div>
      <div>✓ Health Check: <a href="/api/health" style="color: #60a5fa;">/api/health</a></div>
    </div>
    <a href="/api/health" class="btn">View API Health Status</a>
  </div>
</body>
</html>`);
});

const localIp = getLocalIpAddress();
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
==================================================================
  EduTrack Campus Server v1.0 (${isCloudMode ? 'Cloud Mode' : 'Local Offline Mode'})
  Database: ${isCloudMode ? 'Cloud PostgreSQL / Supabase' : 'Local SQLite (/server/attendance.db - NO INTERNET NEEDED)'}
  Local Web: http://localhost:${PORT}
  Mobile Wi-Fi IP for Phone: http://${localIp}:${PORT}
==================================================================
  `);
});
