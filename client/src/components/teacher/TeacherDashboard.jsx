import React, { useState, useEffect, useRef } from 'react';
import { 
  CheckCircle2, XCircle, QrCode, ClipboardList, Camera, CameraOff, 
  Phone, Users, Clock, AlertCircle, Sparkles, RefreshCw, Volume2, Calendar,
  Plus, X, Check, Search, Upload, UserCheck, ChevronDown
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
  const [recentScans, setRecentScans] = useState([]);
  const html5QrCodeRef = useRef(null);
  const fileInputRef = useRef(null);
  const lastScannedRef = useRef({ code: '', time: 0 });

  // Student list tab on right panel: 'present' | 'absent' | 'all'
  const [listTab, setListTab] = useState('present');
  const [searchQuery, setSearchQuery] = useState('');

  // Add Student Modal State
  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
  const [studentForm, setStudentForm] = useState({
    rollNo: '',
    name: '',
    gender: 'Male',
    classId: '',
    parentName: '',
    parentPhone: '',
    email: ''
  });
  const [addStudentError, setAddStudentError] = useState('');

  // Add Class Modal State
  const [isAddClassModalOpen, setIsAddClassModalOpen] = useState(false);
  const [newClassName, setNewClassName] = useState('');

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
    if (selectedClassId) {
      fetchStudentsAndAttendance();
    }
  }, [selectedClassId, date, session]);

  // Clean up scanner when unmounting
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
      } else if (selectedClassId && !data.some(c => c.id === selectedClassId)) {
        if (data.length > 0) setSelectedClassId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load classes:', err);
    }
  };

  const fetchStudentsAndAttendance = async () => {
    if (!selectedClassId) return;
    setLoading(true);
    try {
      // 1. Fetch students of this class
      const stuData = await apiFetch(`/api/students?classId=${encodeURIComponent(selectedClassId)}`);
      setStudents(stuData);

      // 2. Fetch existing attendance for this class, date, and session
      const attData = await apiFetch(`/api/attendance?classId=${encodeURIComponent(selectedClassId)}&date=${date}&session=${session}`);

      const map = {};
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
  const toggleStudent = async (studentId) => {
    const newStatus = attendanceMap[studentId] === 'PRESENT' ? 'ABSENT' : 'PRESENT';
    setAttendanceMap(prev => ({
      ...prev,
      [studentId]: newStatus
    }));

    // Auto-save toggle to server
    try {
      await apiFetch('/api/attendance/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          session,
          classId: selectedClassId,
          records: [{ studentId, classId: selectedClassId, status: newStatus }]
        })
      });
    } catch (err) {
      console.error('Failed to save toggle:', err);
    }
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

    // Stop prior scanner if any
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch (e) {}
      html5QrCodeRef.current = null;
    }

    setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode('qr-reader');
        html5QrCodeRef.current = scanner;

        // Try getting cameras to select rear/environment camera
        const cameras = await Html5Qrcode.getCameras().catch(() => []);
        let cameraConfig = { facingMode: 'environment' };

        if (cameras && cameras.length > 0) {
          const rearCamera = cameras.find(c => /back|rear|environment|world/i.test(c.label));
          cameraConfig = rearCamera ? rearCamera.id : cameras[cameras.length - 1].id;
        }

        await scanner.start(
          cameraConfig,
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
          },
          onQrScanSuccess,
          (errorMessage) => {
            // Frame scan without QR, normal, ignore
          }
        );
      } catch (err) {
        console.error('Failed to start camera:', err);
        setScanFeedback({
          type: 'error',
          text: 'Camera access denied or unavailable. Grant camera permission or use the "Scan Photo / File" button below.'
        });
        setIsScanning(false);
      }
    }, 200);
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch (e) {}
      html5QrCodeRef.current = null;
    }
    setIsScanning(false);
  };

  // File / Image QR scan fallback
  const handleFileScan = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      let scanner = html5QrCodeRef.current;
      if (!scanner) {
        scanner = new Html5Qrcode('qr-reader');
        html5QrCodeRef.current = scanner;
      }
      const decodedText = await scanner.scanFile(file, true);
      onQrScanSuccess(decodedText);
    } catch (err) {
      playBeep(350, 0.2);
      setScanFeedback({
        type: 'error',
        text: 'Could not detect a valid QR code in the uploaded image. Please try again.'
      });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const onQrScanSuccess = async (decodedText) => {
    const now = Date.now();
    // Debounce repeated scans within 2.5 seconds
    if (lastScannedRef.current.code === decodedText && (now - lastScannedRef.current.time) < 2500) {
      return;
    }
    lastScannedRef.current = { code: decodedText, time: now };

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

      // Update local state map
      setAttendanceMap(prev => ({
        ...prev,
        [data.student.id]: 'PRESENT'
      }));

      // Add to recent scans list
      setRecentScans(prev => [
        { student: data.student, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), alreadyMarked: data.alreadyMarked },
        ...prev.slice(0, 4)
      ]);

      if (data.alreadyMarked) {
        playBeep(600, 0.1);
        setScanFeedback({
          type: 'warning',
          text: `${data.student.name} (#${data.student.rollNo}) was already marked PRESENT today!`
        });
      } else {
        playBeep(1046, 0.15); // high chime
        confetti({ particleCount: 35, spread: 55, origin: { y: 0.7 } });
        setScanFeedback({
          type: 'success',
          text: `Verified! ${data.student.name} (#${data.student.rollNo}) marked PRESENT.`
        });
      }
    } catch (err) {
      console.error('Error processing scan:', err);
      playBeep(350, 0.2); // low error tone
      setScanFeedback({
        type: 'error',
        text: err.message || 'QR Scan error. Student might belong to another class.'
      });
    }
  };

  // Add Student Handler
  const handleOpenAddStudent = () => {
    setStudentForm({
      rollNo: students.length > 0 ? Math.max(...students.map(s => Number(s.roll_no) || 0)) + 1 : 1,
      name: '',
      gender: 'Male',
      classId: selectedClassId,
      parentName: '',
      parentPhone: '',
      email: ''
    });
    setAddStudentError('');
    setIsAddStudentModalOpen(true);
  };

  const handleSaveStudent = async (e) => {
    e.preventDefault();
    setAddStudentError('');
    try {
      await apiFetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(studentForm)
      });

      setIsAddStudentModalOpen(false);
      fetchClasses();
      fetchStudentsAndAttendance();
      setScanFeedback({
        type: 'success',
        text: `Student "${studentForm.name}" registered successfully to class ${studentForm.classId}!`
      });
    } catch (err) {
      setAddStudentError(err.message || 'Failed to add student');
    }
  };

  // Add Class Handler
  const handleCreateNewClass = async (e) => {
    e.preventDefault();
    if (!newClassName.trim()) return;
    try {
      const clean = newClassName.trim();
      await apiFetch('/api/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: clean,
          name: clean,
          room: 'Room TBD',
          teacherName: user.fullName || ''
        })
      });
      setIsAddClassModalOpen(false);
      setNewClassName('');
      await fetchClasses();
      setSelectedClassId(clean);
    } catch (err) {
      alert(err.message || 'Failed to create class');
    }
  };

  // Stats calculation
  const totalStudents = students.length;
  const presentStudents = students.filter(s => attendanceMap[s.id] === 'PRESENT');
  const absentStudents = students.filter(s => attendanceMap[s.id] !== 'PRESENT');
  const presentCount = presentStudents.length;
  const absentCount = absentStudents.length;
  const attendanceRate = totalStudents > 0 ? ((presentCount / totalStudents) * 100).toFixed(1) : 0;

  // Filtered lists for the right-hand panel
  const getFilteredList = () => {
    let list = [];
    if (listTab === 'present') list = presentStudents;
    else if (listTab === 'absent') list = absentStudents;
    else list = students;

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(s => 
      s.name.toLowerCase().includes(q) || 
      String(s.roll_no).includes(q) ||
      (s.parent_name && s.parent_name.toLowerCase().includes(q))
    );
  };

  const displayedStudents = getFilteredList();

  return (
    <div>
      {/* Top Header & Context Controls */}
      <div className="card-header" style={{ marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <h1 className="card-title" style={{ fontSize: '1.6rem' }}>
              <span>Faculty Attendance Station</span>
            </h1>
            <span className="user-role-badge badge-teacher">
              {user.fullName || 'Faculty Member'}
            </span>
          </div>
          <p className="card-subtitle">
            Roll call for <strong>{selectedClassId || 'Selected Class'}</strong> • QR Camera Check-in & Manual Records
          </p>
        </div>

        {/* Top Control Bar: Class Selector, Add Student Button & Session */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Class Chooser */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Class:</span>
            <select
              value={selectedClassId}
              onChange={(e) => {
                stopScanner();
                setSelectedClassId(e.target.value);
              }}
              style={{ fontWeight: 700, padding: '8px 12px', minWidth: '150px', borderRadius: 'var(--radius-sm)' }}
            >
              {classes.length === 0 && <option value="">No classes found</option>}
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name || c.id}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setIsAddClassModalOpen(true)}
              className="btn-secondary"
              style={{ padding: '8px 10px', fontSize: '0.78rem' }}
              title="Create new class"
            >
              + Class
            </button>
          </div>

          {/* Add Student Button for Teachers */}
          <button
            type="button"
            onClick={handleOpenAddStudent}
            className="btn-primary"
            style={{ padding: '8px 14px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={16} />
            <span>Add Student</span>
          </button>

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
        marginBottom: '20px',
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
              (Automatic switch occurs at 12:10 PM daily)
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
        <div className="card" onClick={() => setListTab('all')} style={{ cursor: 'pointer' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Class Enrolled
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '4px' }}>
            {totalStudents}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Class: {selectedClassId}</div>
        </div>

        <div className="card" onClick={() => setListTab('present')} style={{ borderBottom: '3px solid var(--present-color)', cursor: 'pointer' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--present-color)', textTransform: 'uppercase' }}>
            Total Present
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '4px', color: 'var(--present-color)' }}>
            {presentCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {attendanceRate}% of class present
          </div>
        </div>

        <div className="card" onClick={() => setListTab('absent')} style={{ borderBottom: '3px solid var(--absent-color)', cursor: 'pointer' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--absent-color)', textTransform: 'uppercase' }}>
            Total Absent
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '4px', color: 'var(--absent-color)' }}>
            {absentCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Click to view absentees
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
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.1fr', gap: '24px' }}>
        {/* Left Column: QR Scanner or Manual List */}
        <div>
          {mode === 'qr' ? (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <h2 className="card-title">
                  <Camera size={22} style={{ color: 'var(--accent-primary)' }} />
                  <span>Live Camera QR Check-in</span>
                </h2>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {/* Image/File scan fallback */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    capture="environment"
                    style={{ display: 'none' }}
                    onChange={handleFileScan}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-secondary"
                    style={{ padding: '8px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                    title="Upload QR photo or scan from gallery"
                  >
                    <Upload size={15} />
                    <span>Scan Photo</span>
                  </button>

                  {!isScanning ? (
                    <button onClick={startScanner} className="btn-primary" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Camera size={16} />
                      <span>Open Camera Scanner</span>
                    </button>
                  ) : (
                    <button onClick={stopScanner} className="btn-secondary" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CameraOff size={16} />
                      <span>Stop Camera</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Camera Scanner Viewport */}
              <div style={{
                position: 'relative',
                minHeight: '300px',
                backgroundColor: '#000000',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px'
              }}>
                <div id="qr-reader" style={{ width: '100%', maxWidth: '380px' }}></div>

                {!isScanning && (
                  <div style={{ textAlign: 'center', color: '#94a3b8', padding: '30px 16px' }}>
                    <QrCode size={52} style={{ margin: '0 auto 12px', opacity: 0.7 }} />
                    <h3 style={{ fontSize: '1.1rem', color: '#ffffff', marginBottom: '4px' }}>Camera is on Standby</h3>
                    <p style={{ fontSize: '0.85rem', marginBottom: '14px' }}>Click "Open Camera Scanner" to scan student QR codes.</p>
                    <button onClick={startScanner} className="btn-primary" style={{ margin: '0 auto', padding: '8px 20px' }}>
                      Start Camera
                    </button>
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

              {/* Recent Scans Stream */}
              {recentScans.length > 0 && (
                <div style={{ marginBottom: '14px' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase' }}>
                    Live Recent Check-ins:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {recentScans.map((r, i) => (
                      <div key={i} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '6px 12px',
                        backgroundColor: 'var(--bg-card-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        borderLeft: '3px solid var(--present-color)',
                        fontSize: '0.84rem'
                      }}>
                        <span style={{ fontWeight: 600 }}>
                          #{r.student.rollNo} • {r.student.name}
                        </span>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          {r.time} • 🟢 PRESENT
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Instructions */}
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                Tip: Hold the student's QR code in front of the camera. The student will be verified and marked Present automatically.
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

        {/* Right Column: STUDENT NAMELIST PANEL (Present / Absent / All) */}
        <div>
          <div className="card" style={{ borderTop: `4px solid ${listTab === 'present' ? 'var(--present-color)' : listTab === 'absent' ? 'var(--absent-color)' : 'var(--accent-primary)'}` }}>
            {/* Tab Header Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--bg-card-subtle)', padding: '3px', borderRadius: 'var(--radius-md)' }}>
                <button
                  type="button"
                  onClick={() => setListTab('present')}
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    borderRadius: 'var(--radius-sm)',
                    background: listTab === 'present' ? 'var(--present-color)' : 'transparent',
                    color: listTab === 'present' ? '#ffffff' : 'var(--text-secondary)',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  🟢 Present ({presentCount})
                </button>
                <button
                  type="button"
                  onClick={() => setListTab('absent')}
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    borderRadius: 'var(--radius-sm)',
                    background: listTab === 'absent' ? 'var(--absent-color)' : 'transparent',
                    color: listTab === 'absent' ? '#ffffff' : 'var(--text-secondary)',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  🔴 Absent ({absentCount})
                </button>
                <button
                  type="button"
                  onClick={() => setListTab('all')}
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    borderRadius: 'var(--radius-sm)',
                    background: listTab === 'all' ? 'var(--accent-primary)' : 'transparent',
                    color: listTab === 'all' ? '#ffffff' : 'var(--text-secondary)',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  👥 All ({totalStudents})
                </button>
              </div>

              <button
                type="button"
                onClick={handleOpenAddStudent}
                className="btn-secondary"
                style={{ padding: '6px 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                title="Add student to this class"
              >
                <Plus size={14} />
                <span>Add</span>
              </button>
            </div>

            {/* Quick Search in List */}
            <div style={{ position: 'relative', marginBottom: '14px' }}>
              <input
                type="text"
                placeholder={`Search ${listTab} students by name or roll...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '34px', fontSize: '0.84rem', padding: '7px 10px 7px 34px' }}
              />
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>

            {/* Empty State */}
            {displayedStudents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
                {listTab === 'present' ? (
                  <>
                    <QrCode size={36} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                    <div style={{ fontWeight: 700 }}>No Students Marked Present Yet</div>
                    <div style={{ fontSize: '0.78rem' }}>Scan QR cards or use Manual Roster to mark attendance.</div>
                  </>
                ) : listTab === 'absent' ? (
                  <>
                    <CheckCircle2 size={36} style={{ margin: '0 auto 8px', color: 'var(--present-color)' }} />
                    <div style={{ fontWeight: 700, color: 'var(--present-color)' }}>All Students Present!</div>
                    <div style={{ fontSize: '0.78rem' }}>100% attendance recorded for this session.</div>
                  </>
                ) : (
                  <>
                    <Users size={36} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                    <div style={{ fontWeight: 700 }}>No Students Enrolled in {selectedClassId}</div>
                    <button onClick={handleOpenAddStudent} className="btn-primary" style={{ marginTop: '10px', padding: '6px 14px', fontSize: '0.8rem' }}>
                      + Add First Student
                    </button>
                  </>
                )}
              </div>
            ) : (
              /* Students Name List */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '460px', overflowY: 'auto' }}>
                {displayedStudents.map(s => {
                  const isPresent = attendanceMap[s.id] === 'PRESENT';
                  return (
                    <div
                      key={s.id}
                      style={{
                        padding: '10px 12px',
                        backgroundColor: 'var(--bg-card-subtle)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px'
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: isPresent ? 'var(--present-bg)' : 'var(--absent-bg)',
                            color: isPresent ? 'var(--present-color)' : 'var(--absent-color)'
                          }}>
                            #{s.roll_no}
                          </span>
                          <span style={{ fontWeight: 700, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {s.name}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          Parent: {s.parent_name || 'N/A'} {s.parent_phone && `• ${s.parent_phone}`}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {s.parent_phone && (
                          <a
                            href={`tel:${s.parent_phone}`}
                            className="btn-secondary"
                            style={{ padding: '5px 8px', fontSize: '0.72rem', textDecoration: 'none' }}
                            title={`Call parent: ${s.parent_phone}`}
                          >
                            <Phone size={13} style={{ color: 'var(--accent-primary)' }} />
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={() => toggleStudent(s.id)}
                          className={isPresent ? 'btn-outline-danger' : 'btn-success'}
                          style={{ padding: '5px 9px', fontSize: '0.74rem', whiteSpace: 'nowrap' }}
                        >
                          {isPresent ? 'Undo' : 'Mark'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ADD STUDENT MODAL FOR TEACHERS */}
      {isAddStudentModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={20} style={{ color: 'var(--accent-primary)' }} />
                <span>Add Student to Class</span>
              </h2>
              <button onClick={() => setIsAddStudentModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {addStudentError && (
              <div style={{ padding: '8px 12px', backgroundColor: 'var(--absent-bg)', color: 'var(--absent-color)', borderRadius: 'var(--radius-sm)', marginBottom: '14px', fontSize: '0.82rem' }}>
                {addStudentError}
              </div>
            )}

            <form onSubmit={handleSaveStudent}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                    Roll No *
                  </label>
                  <input
                    type="number"
                    value={studentForm.rollNo}
                    onChange={(e) => setStudentForm({ ...studentForm, rollNo: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                    Student Full Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Ramesh Kumar"
                    value={studentForm.name}
                    onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                    Class / Course *
                  </label>
                  <input
                    type="text"
                    list="teacher-class-options"
                    value={studentForm.classId}
                    onChange={(e) => setStudentForm({ ...studentForm, classId: e.target.value })}
                    placeholder="e.g. CSE-A"
                    required
                  />
                  <datalist id="teacher-class-options">
                    {classes.map(c => (
                      <option key={c.id} value={c.name || c.id}>{c.name} ({c.id})</option>
                    ))}
                  </datalist>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                    Gender
                  </label>
                  <select
                    value={studentForm.gender}
                    onChange={(e) => setStudentForm({ ...studentForm, gender: e.target.value })}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                  Parent / Guardian Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Suresh Kumar"
                  value={studentForm.parentName}
                  onChange={(e) => setStudentForm({ ...studentForm, parentName: e.target.value })}
                />
              </div>

              <div style={{ marginBottom: '22px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                  Parent Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={studentForm.parentPhone}
                  onChange={(e) => setStudentForm({ ...studentForm, parentPhone: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsAddStudentModalOpen(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  <Check size={16} />
                  <span>Save Student</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE NEW CLASS MODAL */}
      {isAddClassModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '420px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                Create / Type New Class
              </h2>
              <button onClick={() => setIsAddClassModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateNewClass}>
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                  Class / Course Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. CSE-B or Data Science"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setIsAddClassModalOpen(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create Class
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
