import express from 'express';
import cors from 'cors';
import QRCode from 'qrcode';
import { run, get, all, initDatabase } from './database.js';
import { generateDailyExcelWorkbook } from './excelExport.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

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

    await run(`
      INSERT INTO users (username, password, role, full_name, assigned_class_id)
      VALUES (?, ?, 'teacher', ?, ?)
    `, [username, password, fullName, assignedClassId || null]);

    // Also update class teacher_name if assigned
    if (assignedClassId) {
      await run('UPDATE classes SET teacher_name = ? WHERE id = ?', [fullName, assignedClassId]);
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

    let query = 'UPDATE users SET username = ?, full_name = ?, assigned_class_id = ?';
    let params = [username, fullName, assignedClassId || null];

    if (password) {
      query += ', password = ?';
      params.push(password);
    }

    query += ' WHERE id = ? AND role = "teacher"';
    params.push(id);

    await run(query, params);

    if (assignedClassId && fullName) {
      await run('UPDATE classes SET teacher_name = ? WHERE id = ?', [fullName, assignedClassId]);
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

app.post('/api/students', async (req, res) => {
  try {
    const { rollNo, name, gender, classId, parentName, parentPhone, email } = req.body;
    if (!rollNo || !name || !classId) {
      return res.status(400).json({ error: 'Roll No, Name, and Class are required' });
    }

    // Auto-generate ID: STU + random 4-digit or max ID
    const studentId = 'STU' + Math.floor(1000 + Math.random() * 9000);

    const qrToken = JSON.stringify({
      schema: 'SCHOOL_ATTENDANCE_V1',
      studentId: studentId,
      rollNo: Number(rollNo),
      name: name,
      classId: classId
    });

    await run(`
      INSERT INTO students (id, roll_no, name, gender, class_id, parent_name, parent_phone, email, qr_token)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [studentId, rollNo, name, gender || 'Other', classId, parentName || '', parentPhone || '', email || '', qrToken]);

    res.status(201).json({ success: true, studentId, message: 'Student registered successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/students/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rollNo, name, gender, classId, parentName, parentPhone, email } = req.body;

    const qrToken = JSON.stringify({
      schema: 'SCHOOL_ATTENDANCE_V1',
      studentId: id,
      rollNo: Number(rollNo),
      name: name,
      classId: classId
    });

    await run(`
      UPDATE students 
      SET roll_no = ?, name = ?, gender = ?, class_id = ?, parent_name = ?, parent_phone = ?, email = ?, qr_token = ?
      WHERE id = ?
    `, [rollNo, name, gender, classId, parentName, parentPhone, email, qrToken, id]);

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
    res.json(records);
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

    // 1. Single QR Scan
    if (qrData || studentId) {
      let targetStudentId = studentId;

      if (qrData) {
        try {
          const parsed = typeof qrData === 'string' ? JSON.parse(qrData) : qrData;
          targetStudentId = parsed.studentId || parsed.id;
        } catch {
          // If raw string is directly student ID
          targetStudentId = qrData;
        }
      }

      if (!targetStudentId) {
        return res.status(400).json({ error: 'Valid Student ID or QR code is required' });
      }

      const student = await get('SELECT * FROM students WHERE id = ?', [targetStudentId]);
      if (!student) {
        return res.status(404).json({ error: `Student with ID "${targetStudentId}" not found in database` });
      }

      // If classId specified, check student class
      if (classId && student.class_id !== classId) {
        return res.status(400).json({
          error: `Student ${student.name} belongs to ${student.class_id}, not ${classId}`
        });
      }

      // Check if already marked present
      const existing = await get(
        'SELECT * FROM attendance WHERE date = ? AND session = ? AND student_id = ?',
        [date, activeSession, student.id]
      );

      const isAlreadyPresent = existing && existing.status === 'PRESENT';

      await run(`
        INSERT OR REPLACE INTO attendance (date, session, student_id, class_id, status, method, marked_at)
        VALUES (?, ?, ?, ?, 'PRESENT', 'QR', CURRENT_TIMESTAMP)
      `, [date, activeSession, student.id, student.class_id]);

      return res.json({
        success: true,
        alreadyMarked: isAlreadyPresent,
        student: {
          id: student.id,
          rollNo: student.roll_no,
          name: student.name,
          classId: student.class_id,
          session: activeSession
        },
        message: isAlreadyPresent
          ? `${student.name} was already marked PRESENT for ${activeSession}`
          : `Successfully marked ${student.name} PRESENT for ${activeSession}`
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

// ---------------- EXCEL EXPORT (ALL CLASSES) ----------------
app.get('/api/attendance/export-excel', async (req, res) => {
  try {
    const { date = new Date().toISOString().split('T')[0] } = req.query;
    const workbook = await generateDailyExcelWorkbook(date);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Attendance_${date}_All_Classes.xlsx"`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Excel export error:', error);
    res.status(500).json({ error: 'Failed to generate Excel attendance report' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Attendance Server running on http://localhost:${PORT}`);
});
