import ExcelJS from 'exceljs';
import { all } from './database.js';

/**
 * Generates a comprehensive Excel workbook for all College Departments on a given date.
 * Contains:
 * 1. College Overview Sheet (Department summary with AM Lecture & PM Lab counts & %)
 * 2. Dedicated Sheet for each Department / Batch with full student roster & AM/PM attendance
 * 3. Master Absentee List (All absent students across departments with guardian contacts)
 */
export async function generateDailyExcelWorkbook(date) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'EduTrack College Campus System';
  workbook.lastModifiedBy = 'Dean of Academics Office';
  workbook.created = new Date();
  workbook.modified = new Date();

  // 1. Fetch all departments
  const classes = await all('SELECT * FROM classes ORDER BY id ASC');

  // 2. Fetch all college students
  const students = await all(`
    SELECT s.*, c.name as class_name 
    FROM students s 
    LEFT JOIN classes c ON s.class_id = c.id 
    ORDER BY s.class_id ASC, s.roll_no ASC
  `);

  // 3. Fetch attendance for this date
  const attendanceRecords = await all(`
    SELECT * FROM attendance WHERE date = ?
  `, [date]);

  const attMap = {};
  for (const att of attendanceRecords) {
    attMap[`${att.student_id}_${att.session}`] = att;
  }

  // --- SHEET 1: College Overview ---
  const overviewSheet = workbook.addWorksheet('Campus Overview', {
    views: [{ showGridLines: true }]
  });

  // Title Block
  overviewSheet.mergeCells('A1:I1');
  const titleCell = overviewSheet.getCell('A1');
  titleCell.value = `COLLEGE DAILY ATTENDANCE MASTER REPORT - ${date}`;
  titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }; // Dark Navy
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  overviewSheet.getRow(1).height = 36;

  // Subheader
  overviewSheet.mergeCells('A2:I2');
  const subCell = overviewSheet.getCell('A2');
  subCell.value = `Generated: ${new Date().toLocaleString()} | College Academic Affairs • Morning Lecture & Afternoon Lab Sessions`;
  subCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF475569' } };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  overviewSheet.getRow(2).height = 20;

  // Table Headers
  const overviewHeaders = [
    'Dept Code', 'Department & Batch', 'Faculty Advisor / HOD', 'Enrolled Students',
    'Morning Lecture Present', 'Morning Lecture Absent', 'Morning %',
    'Afternoon Lab Present', 'Afternoon Lab Absent', 'Afternoon %'
  ];
  overviewSheet.getRow(4).values = overviewHeaders;
  const headerRow = overviewSheet.getRow(4);
  headerRow.height = 28;
  headerRow.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

  for (let col = 1; col <= overviewHeaders.length; col++) {
    headerRow.getCell(col).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' }
    };
    headerRow.getCell(col).border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'medium' },
      right: { style: 'thin' }
    };
  }

  let totalCollegeStudents = 0;
  let totalMorningPresent = 0;
  let totalMorningAbsent = 0;
  let totalAfternoonPresent = 0;
  let totalAfternoonAbsent = 0;

  let rowIdx = 5;
  for (const c of classes) {
    const deptStudents = students.filter(s => s.class_id === c.id);
    const count = deptStudents.length;
    totalCollegeStudents += count;

    let amPres = 0, amAbs = 0, pmPres = 0, pmAbs = 0;

    for (const s of deptStudents) {
      const amAtt = attMap[`${s.id}_MORNING`];
      if (amAtt) {
        if (amAtt.status === 'PRESENT') amPres++;
        else if (amAtt.status === 'ABSENT') amAbs++;
      }
      const pmAtt = attMap[`${s.id}_AFTERNOON`];
      if (pmAtt) {
        if (pmAtt.status === 'PRESENT') pmPres++;
        else if (pmAtt.status === 'ABSENT') pmAbs++;
      }
    }

    totalMorningPresent += amPres;
    totalMorningAbsent += amAbs;
    totalAfternoonPresent += pmPres;
    totalAfternoonAbsent += pmAbs;

    const amRate = count > 0 ? ((amPres / count) * 100).toFixed(1) + '%' : '0%';
    const pmRate = count > 0 ? ((pmPres / count) * 100).toFixed(1) + '%' : '0%';

    const r = overviewSheet.getRow(rowIdx);
    r.values = [
      c.id, c.name, c.teacher_name || 'N/A', count,
      amPres, amAbs, amRate,
      pmPres, pmAbs, pmRate
    ];
    r.height = 22;
    r.alignment = { vertical: 'middle', horizontal: 'center' };
    r.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
    r.getCell(3).alignment = { vertical: 'middle', horizontal: 'left' };

    if (rowIdx % 2 === 0) {
      for (let col = 1; col <= overviewHeaders.length; col++) {
        r.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }
    }

    rowIdx++;
  }

  // Overall Campus Totals Row
  const totalRow = overviewSheet.getRow(rowIdx);
  const collegeAmRate = totalCollegeStudents > 0 ? ((totalMorningPresent / totalCollegeStudents) * 100).toFixed(1) + '%' : '0%';
  const collegePmRate = totalCollegeStudents > 0 ? ((totalAfternoonPresent / totalCollegeStudents) * 100).toFixed(1) + '%' : '0%';

  totalRow.values = [
    'TOTAL', 'All Departments Combined', 'Campus-Wide', totalCollegeStudents,
    totalMorningPresent, totalMorningAbsent, collegeAmRate,
    totalAfternoonPresent, totalAfternoonAbsent, collegePmRate
  ];
  totalRow.height = 26;
  totalRow.font = { bold: true };
  totalRow.alignment = { vertical: 'middle', horizontal: 'center' };
  for (let col = 1; col <= overviewHeaders.length; col++) {
    totalRow.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    totalRow.getCell(col).border = { top: { style: 'thin' }, bottom: { style: 'double' } };
  }

  overviewSheet.columns = [
    { width: 14 }, { width: 34 }, { width: 28 }, { width: 18 },
    { width: 22 }, { width: 22 }, { width: 15 },
    { width: 22 }, { width: 22 }, { width: 15 }
  ];

  // --- SHEET 2...N: Each Department Roster ---
  for (const c of classes) {
    const deptStudents = students.filter(s => s.class_id === c.id);
    const sheetName = `Dept ${c.id}`.replace(/[\/\?\*\[\]\:]/g, '-');
    const deptSheet = workbook.addWorksheet(sheetName, { views: [{ showGridLines: true }] });

    deptSheet.mergeCells('A1:J1');
    const dHead = deptSheet.getCell('A1');
    dHead.value = `${c.name} (${c.id}) - Attendance on ${date}`;
    dHead.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    dHead.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    dHead.alignment = { horizontal: 'center', vertical: 'middle' };
    deptSheet.getRow(1).height = 30;

    deptSheet.mergeCells('A2:J2');
    const dSub = deptSheet.getCell('A2');
    dSub.value = `Faculty Incharge / HOD: ${c.teacher_name || 'N/A'} | Venue: ${c.room || 'N/A'} | Total Enrolled: ${deptStudents.length}`;
    dSub.font = { size: 10, italic: true };
    dSub.alignment = { horizontal: 'center', vertical: 'middle' };
    deptSheet.getRow(2).height = 18;

    const deptHeaders = [
      'Roll No', 'USN / Reg No', 'Student Name', 'Gender',
      'Morning Lecture Status', 'Lecture Check-in',
      'Afternoon Lab Status', 'Lab Check-in',
      'Guardian Name', 'Guardian Contact'
    ];
    deptSheet.getRow(4).values = deptHeaders;
    const dpHeadRow = deptSheet.getRow(4);
    dpHeadRow.height = 26;
    dpHeadRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    dpHeadRow.alignment = { horizontal: 'center', vertical: 'middle' };
    for (let col = 1; col <= deptHeaders.length; col++) {
      dpHeadRow.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
      dpHeadRow.getCell(col).border = { top: { style: 'thin' }, bottom: { style: 'medium' } };
    }

    let dpRowIdx = 5;
    for (const s of deptStudents) {
      const am = attMap[`${s.id}_MORNING`];
      const pm = attMap[`${s.id}_AFTERNOON`];

      const amStatus = am ? am.status : 'NOT MARKED';
      const amMethod = am ? am.method : '-';
      const pmStatus = pm ? pm.status : 'NOT MARKED';
      const pmMethod = pm ? pm.method : '-';

      const row = deptSheet.getRow(dpRowIdx);
      row.values = [
        s.roll_no, s.id, s.name, s.gender,
        amStatus, amMethod,
        pmStatus, pmMethod,
        s.parent_name || 'N/A', s.parent_phone || 'N/A'
      ];
      row.height = 20;
      row.alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(3).alignment = { vertical: 'middle', horizontal: 'left' };
      row.getCell(9).alignment = { vertical: 'middle', horizontal: 'left' };

      if (amStatus === 'PRESENT') {
        row.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
        row.getCell(5).font = { color: { argb: 'FF166534' }, bold: true };
      } else if (amStatus === 'ABSENT') {
        row.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
        row.getCell(5).font = { color: { argb: 'FF991B1B' }, bold: true };
      }

      if (pmStatus === 'PRESENT') {
        row.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
        row.getCell(7).font = { color: { argb: 'FF166534' }, bold: true };
      } else if (pmStatus === 'ABSENT') {
        row.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
        row.getCell(7).font = { color: { argb: 'FF991B1B' }, bold: true };
      }

      dpRowIdx++;
    }

    deptSheet.columns = [
      { width: 10 }, { width: 18 }, { width: 24 }, { width: 12 },
      { width: 22 }, { width: 16 },
      { width: 20 }, { width: 16 },
      { width: 22 }, { width: 18 }
    ];
  }

  // --- SHEET LAST: Campus Master Absentee List ---
  const absSheet = workbook.addWorksheet('Dean Office Absentees', { views: [{ showGridLines: true }] });
  absSheet.mergeCells('A1:G1');
  const absHead = absSheet.getCell('A1');
  absHead.value = `COLLEGE CAMPUS ABSENTEE LOG - ${date}`;
  absHead.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  absHead.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB91C1C' } };
  absHead.alignment = { horizontal: 'center', vertical: 'middle' };
  absSheet.getRow(1).height = 32;

  const absHeaders = ['Department', 'Roll No', 'USN / Reg No', 'Student Name', 'Absent Session(s)', 'Guardian Name', 'Contact Phone'];
  absSheet.getRow(3).values = absHeaders;
  const absHeaderRow = absSheet.getRow(3);
  absHeaderRow.height = 26;
  absHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  absHeaderRow.alignment = { horizontal: 'center', vertical: 'middle' };
  for (let col = 1; col <= absHeaders.length; col++) {
    absHeaderRow.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF991B1B' } };
  }

  let absRowIdx = 4;
  let totalAbsentees = 0;

  for (const s of students) {
    const am = attMap[`${s.id}_MORNING`];
    const pm = attMap[`${s.id}_AFTERNOON`];

    const isAmAbsent = am && am.status === 'ABSENT';
    const isPmAbsent = pm && pm.status === 'ABSENT';

    if (isAmAbsent || isPmAbsent) {
      totalAbsentees++;
      let sessionText = '';
      if (isAmAbsent && isPmAbsent) sessionText = 'Morning Lecture & Afternoon Lab';
      else if (isAmAbsent) sessionText = 'Morning Lecture Only';
      else if (isPmAbsent) sessionText = 'Afternoon Lab Only';

      const r = absSheet.getRow(absRowIdx);
      r.values = [
        s.class_id, s.roll_no, s.id, s.name,
        sessionText, s.parent_name || 'N/A', s.parent_phone || 'N/A'
      ];
      r.height = 20;
      r.alignment = { vertical: 'middle', horizontal: 'center' };
      r.getCell(4).alignment = { vertical: 'middle', horizontal: 'left' };
      r.getCell(6).alignment = { vertical: 'middle', horizontal: 'left' };
      r.getCell(5).font = { bold: true, color: { argb: 'FFDC2626' } };
      absRowIdx++;
    }
  }

  if (totalAbsentees === 0) {
    absSheet.mergeCells('A4:G4');
    const emptyCell = absSheet.getCell('A4');
    emptyCell.value = 'No students absent on this date (100% Attendance).';
    emptyCell.alignment = { horizontal: 'center', vertical: 'middle' };
    emptyCell.font = { italic: true, color: { argb: 'FF16A34A' } };
    absSheet.getRow(4).height = 30;
  }

  absSheet.columns = [
    { width: 14 }, { width: 10 }, { width: 18 }, { width: 24 },
    { width: 30 }, { width: 22 }, { width: 20 }
  ];

  return workbook;
}
