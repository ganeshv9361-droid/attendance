import React, { useState, useEffect } from 'react';
import { 
  Users, QrCode, Calendar as CalendarIcon, FileSpreadsheet, Download, 
  CheckCircle2, XCircle, Clock, AlertTriangle, Phone, Search, ChevronRight, School, UserCheck 
} from 'lucide-react';
import { apiFetch, getApiBaseUrl } from '../../utils/api';

export default function AdminDashboard({ onNavigate }) {
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [activeSession, setActiveSession] = useState('MORNING');
  const [summaryData, setSummaryData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    fetchDailySummary();
  }, [date]);

  const fetchDailySummary = async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/api/attendance/daily-summary?date=${date}`);
      setSummaryData(data);
      if (data.currentAutoSession && !activeSession) {
        setActiveSession(data.currentAutoSession);
      }
    } catch (err) {
      console.error('Failed to fetch daily summary:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadExcel = async () => {
    setIsDownloading(true);
    try {
      const baseUrl = getApiBaseUrl();
      const link = document.createElement('a');
      link.href = `${baseUrl}/api/attendance/export-excel?date=${date}`;
      link.setAttribute('download', `Attendance_${date}_All_Classes.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Excel download failed:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  const currentAbsentees = activeSession === 'MORNING'
    ? summaryData?.morningAbsentees || []
    : summaryData?.afternoonAbsentees || [];

  return (
    <div>
      {/* Top Header & Date Filter */}
      <div className="card-header" style={{ marginBottom: '24px' }}>
        <div>
          <h1 className="card-title" style={{ fontSize: '1.6rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <School size={28} style={{ color: 'var(--accent-primary)' }} />
            <span>Dean & Academic Administration Control</span>
            <span style={{ fontSize: '0.7rem', backgroundColor: 'var(--accent-subtle)', color: 'var(--accent-primary)', padding: '3px 8px', borderRadius: '4px', fontWeight: 800 }}>v1.0</span>
          </h1>
          <p className="card-subtitle">
            College-wide department attendance monitoring, student database, QR generation, and academic records.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Date Picker */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{ width: 'auto', padding: '8px 14px' }}
            />
          </div>

          {/* Session Switcher Pill */}
          <div className="session-pill-container">
            <button
              onClick={() => setActiveSession('MORNING')}
              className={`session-btn ${activeSession === 'MORNING' ? 'active' : ''}`}
            >
              Morning Lectures (AM)
            </button>
            <button
              onClick={() => setActiveSession('AFTERNOON')}
              className={`session-btn ${activeSession === 'AFTERNOON' ? 'active' : ''}`}
            >
              Afternoon Labs (PM)
            </button>
          </div>

          {/* Master Excel Download Button */}
          <button
            onClick={handleDownloadExcel}
            disabled={isDownloading}
            className="btn-success"
            style={{ padding: '8px 16px' }}
            title="Download full multi-sheet Excel file with all departments attendance"
          >
            <FileSpreadsheet size={18} />
            <span>{isDownloading ? 'Generating...' : 'Export All-Departments Excel (.xlsx)'}</span>
          </button>
        </div>
      </div>

      {/* Holiday Alert if Applicable */}
      {summaryData?.holiday && (
        <div style={{
          backgroundColor: 'var(--holiday-bg)',
          border: '1.5px solid var(--holiday-border)',
          color: 'var(--holiday-color)',
          padding: '14px 20px',
          borderRadius: 'var(--radius-md)',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <CalendarIcon size={22} />
          <div>
            <strong>College Academic Holiday: {summaryData.holiday.title}</strong>
            <div style={{ fontSize: '0.85rem' }}>{summaryData.holiday.description}</div>
          </div>
        </div>
      )}

      {/* Quick Navigation Cards */}
      <div className="grid-4" style={{ marginBottom: '28px' }}>
        <div
          className="card"
          onClick={() => onNavigate('students')}
          style={{ cursor: 'pointer', borderLeft: '4px solid var(--accent-primary)' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '10px',
                backgroundColor: 'var(--accent-light)',
                color: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Users size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Student Database</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Enroll, edit & upgrade college directory
                </p>
              </div>
            </div>
            <ChevronRight size={20} style={{ color: 'var(--text-muted)' }} />
          </div>
        </div>

        <div
          className="card"
          onClick={() => onNavigate('faculty')}
          style={{ cursor: 'pointer', borderLeft: '4px solid #f59e0b' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '10px',
                backgroundColor: 'var(--warning-bg)',
                color: 'var(--warning-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <UserCheck size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Faculty & Departments</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Create professor logins & setup departments
                </p>
              </div>
            </div>
            <ChevronRight size={20} style={{ color: 'var(--text-muted)' }} />
          </div>
        </div>

        <div
          className="card"
          onClick={() => onNavigate('qr-cards')}
          style={{ cursor: 'pointer', borderLeft: '4px solid #10b981' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '10px',
                backgroundColor: 'var(--present-bg)',
                color: 'var(--present-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <QrCode size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>QR Code Generator</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Generate, download PNG & print attendance QR codes
                </p>
              </div>
            </div>
            <ChevronRight size={20} style={{ color: 'var(--text-muted)' }} />
          </div>
        </div>

        <div
          className="card"
          onClick={() => onNavigate('calendar')}
          style={{ cursor: 'pointer', borderLeft: '4px solid #8b5cf6' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '10px',
                backgroundColor: 'var(--holiday-bg)',
                color: 'var(--holiday-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <CalendarIcon size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Academic Calendar</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  View dates, symposiums & holidays
                </p>
              </div>
            </div>
            <ChevronRight size={20} style={{ color: 'var(--text-muted)' }} />
          </div>
        </div>
      </div>

      {/* KPI Metric Summary Cards */}
      <div className="grid-4" style={{ marginBottom: '28px' }}>
        <div className="card">
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Total Enrolled
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '6px', color: 'var(--text-primary)' }}>
            {summaryData?.schoolSummary?.totalStudents || 0}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Across all {summaryData?.classSummaries?.length || 0} classes
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Morning Attendance
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '6px', color: 'var(--present-color)' }}>
            {summaryData?.schoolSummary?.morning?.percentage || 0}%
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {summaryData?.schoolSummary?.morning?.present || 0} Present • {summaryData?.schoolSummary?.morning?.absent || 0} Absent
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Afternoon Attendance
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '6px', color: '#0284c7' }}>
            {summaryData?.schoolSummary?.afternoon?.percentage || 0}%
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {summaryData?.schoolSummary?.afternoon?.present || 0} Present • {summaryData?.schoolSummary?.afternoon?.absent || 0} Absent
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            12:10 PM Rule Status
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: 800, marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={20} style={{ color: 'var(--accent-primary)' }} />
            <span>Active: {summaryData?.currentAutoSession || 'AFTERNOON'}</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Morning resets to PM at 12:10 PM
          </div>
        </div>
      </div>

      {/* Department-by-Department Attendance Table */}
      <div className="card" style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Department & Batch Attendance Record</h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Showing semester records for {date} (All Departments)
            </p>
          </div>

          <button onClick={fetchDailySummary} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
            Refresh Data
          </button>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Dept Code</th>
                <th>Department & Batch</th>
                <th>Faculty Incharge</th>
                <th>Venue / Room</th>
                <th>Enrolled</th>
                <th style={{ textAlign: 'center' }}>Morning Lectures (AM)</th>
                <th style={{ textAlign: 'center' }}>Afternoon Labs (PM)</th>
              </tr>
            </thead>
            <tbody>
              {summaryData?.classSummaries?.map(c => (
                <tr key={c.classId}>
                  <td style={{ fontWeight: 700 }}>
                    <span style={{
                      backgroundColor: 'var(--accent-light)',
                      color: 'var(--accent-primary)',
                      padding: '2px 8px',
                      borderRadius: '4px'
                    }}>
                      {c.classId}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{c.className}</td>
                  <td>{c.teacherName || 'N/A'}</td>
                  <td>{c.room || 'N/A'}</td>
                  <td style={{ fontWeight: 700 }}>{c.totalStudents}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontWeight: 700,
                      color: c.morning.percentage > 75 ? 'var(--present-color)' : 'var(--absent-color)'
                    }}>
                      {c.morning.percentage}% ({c.morning.present}P / {c.morning.absent}A)
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontWeight: 700,
                      color: c.afternoon.percentage > 75 ? 'var(--present-color)' : 'var(--absent-color)'
                    }}>
                      {c.afternoon.percentage}% ({c.afternoon.present}P / {c.afternoon.absent}A)
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* School-Wide Absentee Namelist Panel */}
      <div className="card" style={{ borderLeft: '4px solid var(--absent-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--absent-color)' }}>
              <XCircle size={22} />
              <span>School Absentee Namelist ({activeSession} Session)</span>
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Students absent on {date} during {activeSession.toLowerCase()} roll call. Use emergency contact numbers to notify guardians.
            </p>
          </div>

          <span className="status-badge status-absent">
            {currentAbsentees.length} Absent Students
          </span>
        </div>

        {currentAbsentees.length === 0 ? (
          <div style={{
            padding: '24px',
            textAlign: 'center',
            backgroundColor: 'var(--present-bg)',
            color: 'var(--present-color)',
            borderRadius: 'var(--radius-md)',
            fontWeight: 600
          }}>
            <CheckCircle2 size={24} style={{ margin: '0 auto 8px', display: 'block' }} />
            No students absent during {activeSession.toLowerCase()} session (100% Attendance)!
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Roll No</th>
                  <th>Student ID</th>
                  <th>Student Name</th>
                  <th>Parent / Guardian</th>
                  <th>Contact Phone</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {currentAbsentees.map(abs => (
                  <tr key={`${abs.studentId}_${abs.classId}`}>
                    <td style={{ fontWeight: 700 }}>
                      <span style={{
                        backgroundColor: 'var(--accent-light)',
                        color: 'var(--accent-primary)',
                        padding: '2px 8px',
                        borderRadius: '4px'
                      }}>
                        {abs.classId}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700 }}>#{abs.rollNo}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{abs.studentId}</td>
                    <td style={{ fontWeight: 700 }}>{abs.name}</td>
                    <td>{abs.parentName || 'N/A'}</td>
                    <td>
                      {abs.parentPhone ? (
                        <a
                          href={`tel:${abs.parentPhone}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            color: 'var(--accent-primary)',
                            textDecoration: 'none',
                            fontWeight: 600
                          }}
                        >
                          <Phone size={14} />
                          <span>{abs.parentPhone}</span>
                        </a>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>N/A</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="status-badge status-absent">
                        Marked Absent
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
