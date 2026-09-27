import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { all } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const reportsDir = path.resolve(__dirname, 'reports');

if (!fs.existsSync(reportsDir)) {
  try {
    fs.mkdirSync(reportsDir, { recursive: true });
  } catch (e) {
    console.error('Could not create reports directory:', e);
  }
}

/**
 * Generates an Excel workbook for College Departments on a given date.
 * If classId is provided, focuses on that specific department/class.
 * Otherwise, generates the complete campus overview and all department rosters.
 */
export async function generateDailyExcelWorkbook(date, classId = null) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'EduTrack College Campus System';
  workbook.lastModifiedBy = 'Dean of Academics Office';
  workbook.created = new Date();
  workbook.modified = new Date();

  // 1. Fetch departments
  let classes = await all('SELECT * FROM classes ORDER BY id ASC');
  if (classId) {
    const filtered = classes.filter(c => 
      c.id.toLowerCase() === classId.toLowerCase() || 
      (c.name && c.name.toLowerCase() === classId.toLowerCase())
    );
    if (filtered.length > 0) {
      classes = filtered;
    }
  }

  // 2. Fetch students
  let studentsSql = `
    SELECT s.*, c.name as class_name 
    FROM students s 
    LEFT JOIN classes c ON s.class_id = c.id 
  `;
  const params = [];
  if (classId) {
    studentsSql += ' WHERE s.class_id = ? OR LOWER(c.name) = LOWER(?)';
    params.push(classId, classId);
  }
  studentsSql += ' ORDER BY s.class_id ASC, s.roll_no ASC';
  const students = await all(studentsSql, params);

  // 3. Fetch attendance for this date
  const attendanceRecords = await all('SELECT * FROM attendance WHERE date = ?', [date]);

  const attMap = {};
  for (const att of attendanceRecords) {
    attMap[`${att.student_id}_${att.session}`] = att;
  }

  // --- SHEET 1: Overview Summary ---
  const overviewSheet = workbook.addWorksheet('Summary Overview', {
    views: [{ showGridLines: true }]
  });

  overviewSheet.mergeCells('A1:J1');
  const titleCell = overviewSheet.getCell('A1');
  titleCell.value = classId 
    ? `DEPARTMENT ATTENDANCE REPORT (${classId}) - ${date}`
    : `COLLEGE CAMPUS MASTER ATTENDANCE REPORT - ${date}`;
  titleCell.font = { name: 'Arial', size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  overviewSheet.getRow(1).height = 36;

  overviewSheet.mergeCells('A2:J2');
  const subCell = overviewSheet.getCell('A2');
  subCell.value = `Generated: ${new Date().toLocaleString()} | College Academic Affairs • Morning Lecture & Afternoon Lab Sessions`;
  subCell.font = { name: 'Arial', size: 9.5, italic: true, color: { argb: 'FF475569' } };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  overviewSheet.getRow(2).height = 20;

  const overviewHeaders = [
    'Dept / Class ID', 'Department / Batch Name', 'Faculty Advisor / HOD', 'Total Students',
    'Morning Present', 'Morning Absent', 'Morning %',
    'Afternoon Present', 'Afternoon Absent', 'Afternoon %'
  ];
  overviewSheet.getRow(4).values = overviewHeaders;
  const headerRow = overviewSheet.getRow(4);
  headerRow.height = 28;
  headerRow.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
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

  // Total summary row
  const totalRow = overviewSheet.getRow(rowIdx);
  const amRateTotal = totalCollegeStudents > 0 ? ((totalMorningPresent / totalCollegeStudents) * 100).toFixed(1) + '%' : '0%';
  const pmRateTotal = totalCollegeStudents > 0 ? ((totalAfternoonPresent / totalCollegeStudents) * 100).toFixed(1) + '%' : '0%';

  totalRow.values = [
    'TOTAL', 'Combined Overview', 'All Batches', totalCollegeStudents,
    totalMorningPresent, totalMorningAbsent, amRateTotal,
    totalAfternoonPresent, totalAfternoonAbsent, pmRateTotal
  ];
  totalRow.height = 26;
  totalRow.font = { bold: true };
  totalRow.alignment = { vertical: 'middle', horizontal: 'center' };
  for (let col = 1; col <= overviewHeaders.length; col++) {
    totalRow.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    totalRow.getCell(col).border = { top: { style: 'thin' }, bottom: { style: 'double' } };
  }

  // --- College-Wide Percentage Summary Cards ---
  rowIdx += 2; // Blank row

  overviewSheet.mergeCells(`A${rowIdx}:J${rowIdx}`);
  const ovSumHead = overviewSheet.getCell(`A${rowIdx}`);
  ovSumHead.value = 'COLLEGE-WIDE DAILY ATTENDANCE PERCENTAGE BENCHMARKS';
  ovSumHead.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  ovSumHead.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  ovSumHead.alignment = { horizontal: 'center', vertical: 'middle' };
  overviewSheet.getRow(rowIdx).height = 26;
  rowIdx++;

  const amPct = totalCollegeStudents > 0 ? ((totalMorningPresent / totalCollegeStudents) * 100).toFixed(1) : '0.0';
  const amAbsPct = totalCollegeStudents > 0 ? ((totalMorningAbsent / totalCollegeStudents) * 100).toFixed(1) : '0.0';
  const pmPct = totalCollegeStudents > 0 ? ((totalAfternoonPresent / totalCollegeStudents) * 100).toFixed(1) : '0.0';
  const pmAbsPct = totalCollegeStudents > 0 ? ((totalAfternoonAbsent / totalCollegeStudents) * 100).toFixed(1) : '0.0';

  overviewSheet.mergeCells(`A${rowIdx}:C${rowIdx}`);
  overviewSheet.getCell(`A${rowIdx}`).value = 'Morning Lectures (AM):';
  overviewSheet.getCell(`A${rowIdx}`).font = { bold: true };
  overviewSheet.getCell(`A${rowIdx}`).alignment = { horizontal: 'right', vertical: 'middle' };

  overviewSheet.mergeCells(`D${rowIdx}:E${rowIdx}`);
  overviewSheet.getCell(`D${rowIdx}`).value = `PRESENT: ${amPct}% (${totalMorningPresent} students)`;
  overviewSheet.getCell(`D${rowIdx}`).font = { bold: true, color: { argb: 'FF166534' } };
  overviewSheet.getCell(`D${rowIdx}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
  overviewSheet.getCell(`D${rowIdx}`).alignment = { horizontal: 'center', vertical: 'middle' };

  overviewSheet.mergeCells(`F${rowIdx}:G${rowIdx}`);
  overviewSheet.getCell(`F${rowIdx}`).value = `ABSENT: ${amAbsPct}% (${totalMorningAbsent} students)`;
  overviewSheet.getCell(`F${rowIdx}`).font = { bold: true, color: { argb: 'FF991B1B' } };
  overviewSheet.getCell(`F${rowIdx}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
  overviewSheet.getCell(`F${rowIdx}`).alignment = { horizontal: 'center', vertical: 'middle' };
  overviewSheet.getRow(rowIdx).height = 24;
  rowIdx++;

  overviewSheet.mergeCells(`A${rowIdx}:C${rowIdx}`);
  overviewSheet.getCell(`A${rowIdx}`).value = 'Afternoon Labs (PM):';
  overviewSheet.getCell(`A${rowIdx}`).font = { bold: true };
  overviewSheet.getCell(`A${rowIdx}`).alignment = { horizontal: 'right', vertical: 'middle' };

  overviewSheet.mergeCells(`D${rowIdx}:E${rowIdx}`);
  overviewSheet.getCell(`D${rowIdx}`).value = `PRESENT: ${pmPct}% (${totalAfternoonPresent} students)`;
  overviewSheet.getCell(`D${rowIdx}`).font = { bold: true, color: { argb: 'FF166534' } };
  overviewSheet.getCell(`D${rowIdx}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
  overviewSheet.getCell(`D${rowIdx}`).alignment = { horizontal: 'center', vertical: 'middle' };

  overviewSheet.mergeCells(`F${rowIdx}:G${rowIdx}`);
  overviewSheet.getCell(`F${rowIdx}`).value = `ABSENT: ${pmAbsPct}% (${totalAfternoonAbsent} students)`;
  overviewSheet.getCell(`F${rowIdx}`).font = { bold: true, color: { argb: 'FF991B1B' } };
  overviewSheet.getCell(`F${rowIdx}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
  overviewSheet.getCell(`F${rowIdx}`).alignment = { horizontal: 'center', vertical: 'middle' };
  overviewSheet.getRow(rowIdx).height = 24;

  overviewSheet.columns = [
    { width: 16 }, { width: 32 }, { width: 26 }, { width: 16 },
    { width: 18 }, { width: 18 }, { width: 14 },
    { width: 18 }, { width: 18 }, { width: 14 }
  ];

  // --- SHEET 2...N: Department Student Roster ---
  for (const c of classes) {
    const deptStudents = students.filter(s => s.class_id === c.id);
    const cleanSheetName = `Roster_${c.id}`.replace(/[\/\?\*\[\]\:]/g, '-').slice(0, 30);
    const deptSheet = workbook.addWorksheet(cleanSheetName, { views: [{ showGridLines: true }] });

    deptSheet.mergeCells('A1:L1');
    const dHead = deptSheet.getCell('A1');
    dHead.value = `${c.name} (${c.id}) - Attendance on ${date}`;
    dHead.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
    dHead.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    dHead.alignment = { horizontal: 'center', vertical: 'middle' };
    deptSheet.getRow(1).height = 30;

    deptSheet.mergeCells('A2:L2');
    const dSub = deptSheet.getCell('A2');
    dSub.value = `Faculty Incharge / HOD: ${c.teacher_name || 'N/A'} | Venue: ${c.room || 'N/A'} | Enrolled: ${deptStudents.length}`;
    dSub.font = { size: 9.5, italic: true };
    dSub.alignment = { horizontal: 'center', vertical: 'middle' };
    deptSheet.getRow(2).height = 18;

    const deptHeaders = [
      'Roll No', 'Student Name', 'Department / Branch', 'Year', 'Section',
      'Morning Status', 'Morning Check-in',
      'Afternoon Status', 'Afternoon Check-in',
      'Phone Number', 'Common Mail ID'
    ];
    deptSheet.getRow(4).values = deptHeaders;
    const dpHeadRow = deptSheet.getRow(4);
    dpHeadRow.height = 28;
    dpHeadRow.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    dpHeadRow.alignment = { horizontal: 'center', vertical: 'middle' };
    for (let col = 1; col <= deptHeaders.length; col++) {
      dpHeadRow.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      dpHeadRow.getCell(col).border = { top: { style: 'thin' }, bottom: { style: 'medium' } };
    }

    let dpRowIdx = 5;
    let deptAmPresent = 0;
    let deptAmAbsent = 0;
    let deptPmPresent = 0;
    let deptPmAbsent = 0;

    for (const s of deptStudents) {
      const am = attMap[`${s.id}_MORNING`];
      const pm = attMap[`${s.id}_AFTERNOON`];

      const amStatus = am ? am.status : 'NOT MARKED';
      const amMethod = am ? (am.method || 'MANUAL') : '-';
      const pmStatus = pm ? pm.status : 'NOT MARKED';
      const pmMethod = pm ? (pm.method || 'MANUAL') : '-';

      if (amStatus === 'PRESENT') deptAmPresent++;
      else if (amStatus === 'ABSENT') deptAmAbsent++;

      if (pmStatus === 'PRESENT') deptPmPresent++;
      else if (pmStatus === 'ABSENT') deptPmAbsent++;

      const row = deptSheet.getRow(dpRowIdx);
      row.values = [
        s.roll_no,
        s.name,
        s.branch || c.id || '-',
        s.year || '-',
        s.section || '-',
        amStatus,
        amMethod,
        pmStatus,
        pmMethod,
        s.phone || s.parent_phone || '-',
        s.email || '-'
      ];
      row.height = 22;
      row.alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' }; // Student Name
      row.getCell(11).alignment = { vertical: 'middle', horizontal: 'left' }; // Mail

      // Zebra striping
      if (dpRowIdx % 2 === 0) {
        for (let col = 1; col <= deptHeaders.length; col++) {
          row.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        }
      }

      if (amStatus === 'PRESENT') {
        row.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
        row.getCell(6).font = { color: { argb: 'FF166534' }, bold: true };
      } else if (amStatus === 'ABSENT') {
        row.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
        row.getCell(6).font = { color: { argb: 'FF991B1B' }, bold: true };
      }

      if (pmStatus === 'PRESENT') {
        row.getCell(8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
        row.getCell(8).font = { color: { argb: 'FF166534' }, bold: true };
      } else if (pmStatus === 'ABSENT') {
        row.getCell(8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
        row.getCell(8).font = { color: { argb: 'FF991B1B' }, bold: true };
      }

      dpRowIdx++;
    }

    // --- BOTTOM PERCENTAGE & STATISTICAL SUMMARY ---
    dpRowIdx++; // Blank spacing row

    const totalInDept = deptStudents.length;
    const amPresRate = totalInDept > 0 ? ((deptAmPresent / totalInDept) * 100).toFixed(1) : '0.0';
    const amAbsRate = totalInDept > 0 ? ((deptAmAbsent / totalInDept) * 100).toFixed(1) : '0.0';
    const pmPresRate = totalInDept > 0 ? ((deptPmPresent / totalInDept) * 100).toFixed(1) : '0.0';
    const pmAbsRate = totalInDept > 0 ? ((deptPmAbsent / totalInDept) * 100).toFixed(1) : '0.0';

    // Summary Header Banner
    deptSheet.mergeCells(`A${dpRowIdx}:K${dpRowIdx}`);
    const sumHead = deptSheet.getCell(`A${dpRowIdx}`);
    sumHead.value = `DEPARTMENT ATTENDANCE PERCENTAGE & STATISTICAL SUMMARY`;
    sumHead.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    sumHead.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    sumHead.alignment = { horizontal: 'center', vertical: 'middle' };
    deptSheet.getRow(dpRowIdx).height = 26;
    dpRowIdx++;

    // Total Enrolled Row
    deptSheet.mergeCells(`A${dpRowIdx}:C${dpRowIdx}`);
    const totLabel = deptSheet.getCell(`A${dpRowIdx}`);
    totLabel.value = 'Total Students Enrolled:';
    totLabel.font = { bold: true };
    totLabel.alignment = { horizontal: 'right', vertical: 'middle' };
    deptSheet.getCell(`D${dpRowIdx}`).value = totalInDept;
    deptSheet.getCell(`D${dpRowIdx}`).font = { bold: true, size: 11 };
    deptSheet.getCell(`D${dpRowIdx}`).alignment = { horizontal: 'center', vertical: 'middle' };
    deptSheet.getRow(dpRowIdx).height = 24;
    dpRowIdx++;

    // Morning Session Summary Row
    deptSheet.mergeCells(`A${dpRowIdx}:C${dpRowIdx}`);
    const amLabel = deptSheet.getCell(`A${dpRowIdx}`);
    amLabel.value = 'Morning Lectures (AM):';
    amLabel.font = { bold: true };
    amLabel.alignment = { horizontal: 'right', vertical: 'middle' };

    deptSheet.getCell(`D${dpRowIdx}`).value = `Present: ${deptAmPresent}`;
    deptSheet.getCell(`D${dpRowIdx}`).font = { bold: true };

    deptSheet.mergeCells(`E${dpRowIdx}:F${dpRowIdx}`);
    const amPresCell = deptSheet.getCell(`E${dpRowIdx}`);
    amPresCell.value = `PRESENT: ${amPresRate}%`;
    amPresCell.font = { bold: true, size: 11, color: { argb: 'FF166534' } };
    amPresCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
    amPresCell.alignment = { horizontal: 'center', vertical: 'middle' };

    deptSheet.getCell(`G${dpRowIdx}`).value = `Absent: ${deptAmAbsent}`;
    deptSheet.getCell(`G${dpRowIdx}`).font = { bold: true };

    deptSheet.mergeCells(`H${dpRowIdx}:I${dpRowIdx}`);
    const amAbsCell = deptSheet.getCell(`H${dpRowIdx}`);
    amAbsCell.value = `ABSENT: ${amAbsRate}%`;
    amAbsCell.font = { bold: true, size: 11, color: { argb: 'FF991B1B' } };
    amAbsCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
    amAbsCell.alignment = { horizontal: 'center', vertical: 'middle' };

    deptSheet.getRow(dpRowIdx).height = 26;
    dpRowIdx++;

    // Afternoon Session Summary Row
    deptSheet.mergeCells(`A${dpRowIdx}:C${dpRowIdx}`);
    const pmLabel = deptSheet.getCell(`A${dpRowIdx}`);
    pmLabel.value = 'Afternoon Labs (PM):';
    pmLabel.font = { bold: true };
    pmLabel.alignment = { horizontal: 'right', vertical: 'middle' };

    deptSheet.getCell(`D${dpRowIdx}`).value = `Present: ${deptPmPresent}`;
    deptSheet.getCell(`D${dpRowIdx}`).font = { bold: true };

    deptSheet.mergeCells(`E${dpRowIdx}:F${dpRowIdx}`);
    const pmPresCell = deptSheet.getCell(`E${dpRowIdx}`);
    pmPresCell.value = `PRESENT: ${pmPresRate}%`;
    pmPresCell.font = { bold: true, size: 11, color: { argb: 'FF166534' } };
    pmPresCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
    pmPresCell.alignment = { horizontal: 'center', vertical: 'middle' };

    deptSheet.getCell(`G${dpRowIdx}`).value = `Absent: ${deptPmAbsent}`;
    deptSheet.getCell(`G${dpRowIdx}`).font = { bold: true };

    deptSheet.mergeCells(`H${dpRowIdx}:I${dpRowIdx}`);
    const pmAbsCell = deptSheet.getCell(`H${dpRowIdx}`);
    pmAbsCell.value = `ABSENT: ${pmAbsRate}%`;
    pmAbsCell.font = { bold: true, size: 11, color: { argb: 'FF991B1B' } };
    pmAbsCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
    pmAbsCell.alignment = { horizontal: 'center', vertical: 'middle' };

    deptSheet.getRow(dpRowIdx).height = 26;

    deptSheet.columns = [
      { width: 12 }, { width: 24 }, { width: 20 }, { width: 12 }, { width: 10 },
      { width: 18 }, { width: 16 },
      { width: 18 }, { width: 16 },
      { width: 18 }, { width: 26 }
    ];
  }

  // --- SHEET LAST: Absentees List ---
  const absSheet = workbook.addWorksheet('Absentees Roster', { views: [{ showGridLines: true }] });
  absSheet.mergeCells('A1:H1');
  const absHead = absSheet.getCell('A1');
  absHead.value = `CAMPUS ABSENTEE LOG - ${date}`;
  absHead.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
  absHead.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB91C1C' } };
  absHead.alignment = { horizontal: 'center', vertical: 'middle' };
  absSheet.getRow(1).height = 32;

  const absHeaders = ['Department', 'Roll No', 'Student ID', 'Student Name', 'Absent Session(s)', 'Year/Branch', 'Phone Number', 'Common Mail ID'];
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
        s.class_id,
        s.roll_no,
        s.id,
        s.name,
        sessionText,
        `${s.year || ''} ${s.branch || ''} ${s.section ? '(' + s.section + ')' : ''}`.trim() || '-',
        s.phone || s.parent_phone || '-',
        s.email || '-'
      ];
      r.height = 20;
      r.alignment = { vertical: 'middle', horizontal: 'center' };
      r.getCell(4).alignment = { vertical: 'middle', horizontal: 'left' };
      r.getCell(8).alignment = { vertical: 'middle', horizontal: 'left' };
      r.getCell(5).font = { bold: true, color: { argb: 'FFDC2626' } };
      absRowIdx++;
    }
  }

  if (totalAbsentees === 0) {
    absSheet.mergeCells('A4:H4');
    const emptyCell = absSheet.getCell('A4');
    emptyCell.value = 'No students absent on this date (100% Attendance).';
    emptyCell.alignment = { horizontal: 'center', vertical: 'middle' };
    emptyCell.font = { italic: true, color: { argb: 'FF16A34A' } };
    absSheet.getRow(4).height = 30;
  }

  absSheet.columns = [
    { width: 14 }, { width: 10 }, { width: 16 }, { width: 24 },
    { width: 28 }, { width: 20 }, { width: 18 }, { width: 26 }
  ];

  // Also permanently store the excel file on the server
  try {
    const safeClass = classId ? classId.replace(/[^a-zA-Z0-9_-]/g, '_') : 'All_Classes';
    const filePath = path.resolve(reportsDir, `Attendance_${date}_${safeClass}.xlsx`);
    await workbook.xlsx.writeFile(filePath);
    console.log(`Saved daily attendance Excel to disk: ${filePath}`);
  } catch (err) {
    console.warn('Could not save Excel to reportsDir:', err.message);
  }

  return workbook;
}
