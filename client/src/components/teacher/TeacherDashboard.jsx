import React, { useState, useEffect, useRef } from 'react';
import { 
  CheckCircle2, XCircle, QrCode, ClipboardList, Camera, CameraOff, 
  Phone, Users, Clock, AlertCircle, Sparkles, RefreshCw, Volume2, Calendar 
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Html5Qrcode } from 'html5-qrcode';
import BackButton from '../common/BackButton';
import { apiFetch } from '../../utils/api';

export default function TeacherDashboard({ user, onBack, onLogout }) {
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(user.assignedClassId || '');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Session state: Morning vs Afternoon (with 12:10 PM auto-rule)
  const [session, setSession] = useState(() => {
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    return minutes < 730 ? 'MORNING' : 'AFTERNOON';
  });

  const [mode, setMode] = useState('qr'); // 'qr' or 'manual'
  const [students, setStudents] = useState([]);
  const [attendanceMap, setAttendanceMap] = useState({}); // { studentId: 'PRESENT' | 'ABSENT' }
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Scanner state
  const [isScanning, setIsScanning] = useState(false);
  const [scanFeedback, setScanFeedback] = useState(null); // { type: 'success'|'warning'|'error', text: '' }
  const html5QrCodeRef = useRef(null);

  // Synthesize pleasant audio beep using Web Audio API
  const playBeep = (freq = 880, duration = 0.15) => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
      console.warn('Audio play prevented:', e);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    fetchStudentsAndAttendance();
  }, [selectedClassId, date, session]);

  // Clean up scanner when unmounting or switching modes
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const fetchClasses = async () => {
    try {
      const data = await apiFetch('/api/classes');
      setClasses(data);
      if (!selectedClassId && data.length > 0) {
        setSelectedClassId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load classes:', err);
    }
  };

  const fetchStudentsAndAttendance = async () => {
    setLoading(true);
    try {
      // 1. Fetch students of this class
      const stuData = await apiFetch(`/api/students?classId=${selectedClassId}`);
      setStudents(stuData);

      // 2. Fetch existing attendance for this class, date, and session
      const attData = await apiFetch(`/api/attendance?classId=${selectedClassId}&date=${date}&session=${session}`);

      const map = {};
      // Default all to ABSENT initially if not marked, or preserve marked
      for (const s of stuData) {
        map[s.id] = 'ABSENT';
      }
      for (const att of attData) {
        map[att.student_id] = att.status;
      }
      setAttendanceMap(map);
    } catch (err) {
      console.error('Failed to load attendance:', err);
    } finally {
      setLoading(false);
    }
  };

  // Toggle individual student attendance
  const toggleStudent = (studentId) => {
    setAttendanceMap(prev => ({
      ...prev,
      [studentId]: prev[studentId] === 'PRESENT' ? 'ABSENT' : 'PRESENT'
    }));
  };

  const markAll = (status) => {
    const updated = {};
    for (const s of students) {
      updated[s.id] = status;
    }
    setAttendanceMap(updated);
  };

  // Save manual attendance
  const handleSaveManualAttendance = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const records = students.map(s => ({
        studentId: s.id,
        classId: selectedClassId,
        status: attendanceMap[s.id] || 'ABSENT'
      }));

      await apiFetch('/api/attendance/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          session,
          classId: selectedClassId,
          records
        })
      });

      setSaveSuccess(true);
      confetti({ particleCount: 50, spread: 60 });
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Save failed:', err);
      alert(err.message || 'Failed to save attendance');
    } finally {
      setIsSaving(false);
    }
  };

  // Start Live QR Scanner
  const startScanner = async () => {
    setIsScanning(true);
    setScanFeedback(null);

    // Give DOM time to render reader div
    setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode('qr-reader');
        html5QrCodeRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 240, height: 240 }
          },
          onQrScanSuccess,
          (errorMessage) => {
            // normal frame error, ignore
          }
        );
      } catch (err) {
        console.error('Failed to start camera:', err);
        setScanFeedback({
          type: 'error',
          text: 'Camera access denied or unavailable. Please ensure permissions are granted.'
        });
        setIsScanning(false);
      }
    }, 150);
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch (e) {
        // ignore
      }
      html5QrCodeRef.current = null;
    }
    setIsScanning(false);
  };

  const onQrScanSuccess = async (decodedText) => {
    try {
      const data = await apiFetch('/api/attendance/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          session,
          classId: selectedClassId,
          qrData: decodedText
        })
      });

      // Update state
      setAttendanceMap(prev => ({
        ...prev,
        [data.student.id]: 'PRESENT'
      }));

      if (data.alreadyMarked) {
        playBeep(600, 0.1);
        setScanFeedback({
          type: 'warning',
          text: `${data.student.name} was already marked PRESENT today!`
        });
      } else {
        playBeep(1046, 0.15); // high C chime
        confetti({ particleCount: 30, spread: 50, origin: { y: 0.7 } });
        setScanFeedback({
          type: 'success',
          text: `Verified! ${data.student.name} (Roll #${data.student.rollNo}) marked PRESENT.`
        });
      }
    } catch (err) {
      console.error('Error processing scan:', err);
    }
  };

  // Stats calculation
  const totalStudents = students.length;
  const presentCount = students.filter(s => attendanceMap[s.id] === 'PRESENT').length;
  const absentCount = totalStudents - presentCount;
  const attendanceRate = totalStudents > 0 ? ((presentCount / totalStudents) * 100).toFixed(1) : 0;
  const absentees = students.filter(s => attendanceMap[s.id] !== 'PRESENT');

  return (
    <div>
      {/* Top Header & Context Controls */}
      <div className="card-header" style={{ marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <h1 className="card-title" style={{ fontSize: '1.6rem' }}>
              <span>Faculty Attendance Station</span>
            </h1>
            <span className="user-role-badge badge-teacher">
              {user.fullName || 'Teacher'}
            </span>
          </div>
          <p className="card-subtitle">
            Roll call for {selectedClassId} • Real-time QR Camera Check-in & Manual Records
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Class Selector */}
          <select
            value={selectedClassId}
            onChange={(e) => {
              stopScanner();
              setSelectedClassId(e.target.value);
            }}
            style={{ width: 'auto', minWidth: '160px', padding: '8px 12px' }}
          >
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.id})</option>
            ))}
          </select>

          {/* Date Picker */}
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ width: 'auto', padding: '8px 12px' }}
          />

          {/* Morning vs Afternoon Session Switcher */}
          <div className="session-pill-container">
            <button
              onClick={() => setSession('MORNING')}
              className={`session-btn ${session === 'MORNING' ? 'active' : ''}`}
            >
              Morning (AM)
            </button>
            <button
              onClick={() => setSession('AFTERNOON')}
              className={`session-btn ${session === 'AFTERNOON' ? 'active' : ''}`}
            >
              Afternoon (PM)
            </button>
          </div>
        </div>
      </div>

      {/* 12:10 PM Rule Alert Bar */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        padding: '12px 18px',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Clock size={20} style={{ color: 'var(--accent-primary)' }} />
          <span style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>
            <strong>Active Session:</strong> {session === 'MORNING' ? 'Morning Roll Call' : 'Afternoon Roll Call'}
            <span style={{ color: 'var(--text-muted)', marginLeft: '6px' }}>
              (Automatic switch/reset occurs at 12:10 PM daily)
            </span>
          </span>
        </div>

        {/* Mode Selector Tabs (QR vs Manual) */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => {
              if (mode === 'qr') stopScanner();
              setMode('qr');
            }}
            className={mode === 'qr' ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '7px 16px', fontSize: '0.85rem' }}
          >
            <Camera size={16} />
            <span>QR Scanner Mode</span>
          </button>
          <button
            onClick={() => {
              stopScanner();
              setMode('manual');
            }}
            className={mode === 'manual' ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '7px 16px', fontSize: '0.85rem' }}
          >
            <ClipboardList size={16} />
            <span>Manual Roster Mode</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics Row */}
      <div className="grid-4" style={{ marginBottom: '24px' }}>
        <div className="card">
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Class Enrolled
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '4px' }}>
            {totalStudents}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Class {selectedClassId}</div>
        </div>

        <div className="card" style={{ borderBottom: '3px solid var(--present-color)' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--present-color)', textTransform: 'uppercase' }}>
            Total Present
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '4px', color: 'var(--present-color)' }}>
            {presentCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {attendanceRate}% of class
          </div>
        </div>

        <div className="card" style={{ borderBottom: '3px solid var(--absent-color)' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--absent-color)', textTransform: 'uppercase' }}>
            Total Absent
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '4px', color: 'var(--absent-color)' }}>
            {absentCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Listed in Absentist table
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Date & Session
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '8px' }}>
            {session}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {date}
          </div>
        </div>
      </div>

      {/* MAIN ATTENDANCE INTERACTION AREA */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '24px' }}>
        {/* Left Column: QR Scanner or Manual List */}
        <div>
          {mode === 'qr' ? (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                <h2 className="card-title">
                  <Camera size={22} style={{ color: 'var(--accent-primary)' }} />
                  <span>Live Camera QR Check-in</span>
                </h2>
                {!isScanning ? (
                  <button onClick={startScanner} className="btn-primary" style={{ padding: '8px 16px' }}>
                    <Camera size={16} />
                    <span>Open Camera Scanner</span>
                  </button>
                ) : (
                  <button onClick={stopScanner} className="btn-secondary" style={{ padding: '8px 16px' }}>
                    <CameraOff size={16} />
                    <span>Stop Camera</span>
                  </button>
                )}
              </div>

              {/* Camera Scanner Viewport */}
              <div style={{
                position: 'relative',
                minHeight: '320px',
                backgroundColor: '#000000',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px'
              }}>
                <div id="qr-reader" style={{ width: '100%', maxWidth: '420px' }}></div>

                {!isScanning && (
                  <div style={{ textAlign: 'center', color: '#94a3b8', padding: '30px' }}>
                    <QrCode size={48} style={{ margin: '0 auto 12px', opacity: 0.7 }} />
                    <h3 style={{ fontSize: '1.1rem', color: '#ffffff', marginBottom: '4px' }}>Camera is Standby</h3>
                    <p style={{ fontSize: '0.85rem' }}>Click "Open Camera Scanner" to scan student QR cards.</p>
                  </div>
                )}
              </div>

              {/* Scanner Feedback Banner */}
              {scanFeedback && (
                <div style={{
                  padding: '12px 18px',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '16px',
                  fontWeight: 600,
                  fontSize: '0.92rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  backgroundColor: scanFeedback.type === 'success' ? 'var(--present-bg)' : scanFeedback.type === 'warning' ? 'var(--warning-bg)' : 'var(--absent-bg)',
                  color: scanFeedback.type === 'success' ? 'var(--present-color)' : scanFeedback.type === 'warning' ? 'var(--warning-color)' : 'var(--absent-color)',
                  border: `1px solid ${scanFeedback.type === 'success' ? 'var(--present-border)' : 'var(--absent-border)'}`
                }}>
                  {scanFeedback.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                  <span>{scanFeedback.text}</span>
                </div>
              )}

              {/* Instructions */}
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                Tip: Hold the student's ID card QR code in front of your camera. Student will automatically be recorded Present with audio verification.
              </p>
            </div>
          ) : (
            /* MANUAL ROSTER MODE */
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
                <h2 className="card-title">
                  <ClipboardList size={22} style={{ color: 'var(--accent-primary)' }} />
                  <span>Manual Attendance Roll Call</span>
                </h2>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => markAll('PRESENT')} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                    All Present
                  </button>
                  <button onClick={() => markAll('ABSENT')} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                    All Absent
                  </button>
                  <button
                    onClick={handleSaveManualAttendance}
                    disabled={isSaving}
                    className="btn-success"
                    style={{ padding: '6px 14px', fontSize: '0.85rem' }}
                  >
                    {isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Attendance'}
                  </button>
                </div>
              </div>

              {/* Roster Table */}
              <div className="table-container" style={{ maxHeight: '480px', overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Roll</th>
                      <th>Student Name</th>
                      <th>Gender</th>
                      <th style={{ textAlign: 'center' }}>Status</th>
                      <th style={{ textAlign: 'right' }}>Toggle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map(s => {
                      const isPresent = attendanceMap[s.id] === 'PRESENT';
                      return (
                        <tr key={s.id} onClick={() => toggleStudent(s.id)} style={{ cursor: 'pointer' }}>
                          <td style={{ fontWeight: 700 }}>#{s.roll_no}</td>
                          <td style={{ fontWeight: 600 }}>{s.name}</td>
                          <td>{s.gender}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={`status-badge ${isPresent ? 'status-present' : 'status-absent'}`}>
                              {isPresent ? 'PRESENT' : 'ABSENT'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleStudent(s.id);
                              }}
                              className={isPresent ? 'btn-outline-danger' : 'btn-success'}
                              style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                            >
                              {isPresent ? 'Mark Absent' : 'Mark Present'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: ABSENTIST NAMELIST PANEL */}
        <div>
          <div className="card" style={{ borderTop: '4px solid var(--absent-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--absent-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <XCircle size={20} />
                  <span>Absentist Namelist</span>
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  {session} session • Class {selectedClassId}
                </p>
              </div>

              <span className="status-badge status-absent">
                {absentees.length} Absent
              </span>
            </div>

            {absentees.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '30px 16px',
                backgroundColor: 'var(--present-bg)',
                color: 'var(--present-color)',
                borderRadius: 'var(--radius-md)'
              }}>
                <CheckCircle2 size={32} style={{ margin: '0 auto 8px', display: 'block' }} />
                <div style={{ fontWeight: 700 }}>Full Attendance!</div>
                <div style={{ fontSize: '0.8rem' }}>Every student is marked present.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '460px', overflowY: 'auto' }}>
                {absentees.map(s => (
                  <div
                    key={s.id}
                    style={{
                      padding: '12px 14px',
                      backgroundColor: 'var(--bg-card-subtle)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>
                        #{s.roll_no} • {s.name}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Parent: {s.parent_name || 'N/A'}
                      </div>
                    </div>

                    {s.parent_phone ? (
                      <a
                        href={`tel:${s.parent_phone}`}
                        className="btn-secondary"
                        style={{ padding: '6px 10px', fontSize: '0.75rem', textDecoration: 'none' }}
                        title="Call Parent"
                      >
                        <Phone size={14} style={{ color: 'var(--accent-primary)' }} />
                        <span>Call</span>
                      </a>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No phone</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
