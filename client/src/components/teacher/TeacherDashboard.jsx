import React, { useState, useEffect, useRef } from 'react';
import { 
  CheckCircle2, XCircle, QrCode, ClipboardList, Camera, CameraOff, 
  Phone, Users, Clock, AlertCircle, Sparkles, RefreshCw, Volume2, Calendar,
  Plus, X, Check, Search, Upload, UserCheck, ChevronDown, Download, FileSpreadsheet,
  CheckCheck
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Html5Qrcode } from 'html5-qrcode';
import BackButton from '../common/BackButton';
import { apiFetch, getApiBaseUrl } from '../../utils/api';

const BRANCH_OPTIONS = ['CSE', 'ECE', 'EEE', 'MECH', 'CIVIL', 'IT', 'AI&DS'];

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
  const [autoDownloadNotice, setAutoDownloadNotice] = useState(false);

  // Scanner state
  const [isScanning, setIsScanning] = useState(false);
  const [scanFeedback, setScanFeedback] = useState(null); // { type: 'success'|'warning'|'error', text: '' }
  const [recentScans, setRecentScans] = useState([]);
  const html5QrCodeRef = useRef(null);
  const fileInputRef = useRef(null);
  const lastScannedRef = useRef({ code: '', time: 0 });

  // Student directory tab on side panel: 'present' | 'absent' | 'all'
  const [listTab, setListTab] = useState('present');
  const [searchQuery, setSearchQuery] = useState('');

  // Add Student Modal State
  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
  const [studentForm, setStudentForm] = useState({
    rollNo: '',
    name: '',
    year: '1st Year',
    branch: 'CSE',
    section: 'A',
    email: '',
    phone: '',
    classId: '',
    gender: 'Male'
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
      const stuData = await apiFetch(`/api/students?classId=${encodeURIComponent(selectedClassId)}`);
      setStudents(stuData);

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

  // Trigger Excel Report Download
  const handleDownloadExcel = async (customClassId = selectedClassId) => {
    const baseUrl = getApiBaseUrl();
    const downloadUrl = `${baseUrl}/api/attendance/export-excel?date=${date}&classId=${encodeURIComponent(customClassId || '')}`;
    const filename = `Attendance_${date}_${customClassId || 'All'}.xlsx`;

    try {
      const res = await fetch(downloadUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl);
      }, 200);
    } catch (e) {
      console.warn('Direct blob download fallback:', e);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.setAttribute('download', filename);
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => document.body.removeChild(a), 200);
    }
  };

  // Save manual attendance & automatically download Excel if afternoon session
  const handleSaveManualAttendance = async () => {
    setIsSaving(true);
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

      confetti({ particleCount: 50, spread: 60 });

      // If afternoon attendance, automatically trigger Excel download as requested!
      if (session === 'AFTERNOON') {
        setAutoDownloadNotice(true);
        setTimeout(() => {
          handleDownloadExcel();
        }, 600);
        setTimeout(() => setAutoDownloadNotice(false), 8000);
      } else {
        alert('Morning Attendance saved successfully!');
      }
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
          (errorMessage) => {}
        );
      } catch (err) {
        console.error('Failed to start camera:', err);
        setScanFeedback({
          type: 'error',
          text: 'Camera access denied or unavailable. Grant camera permission in browser/device settings or use "Scan Photo / File" below.'
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
        text: 'Could not detect a valid QR code in the uploaded image. Please try another photo.'
      });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const onQrScanSuccess = async (decodedText) => {
    const now = Date.now();
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

      setAttendanceMap(prev => ({
        ...prev,
        [data.student.id]: 'PRESENT'
      }));

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
        playBeep(1046, 0.15);
        confetti({ particleCount: 30, spread: 50, origin: { y: 0.7 } });
        setScanFeedback({
          type: 'success',
          text: `Verified! ${data.student.name} (#${data.student.rollNo}) marked PRESENT.`
        });
      }
    } catch (err) {
      console.error('Error processing scan:', err);
      playBeep(350, 0.2);
      setScanFeedback({
        type: 'error',
        text: err.message || 'QR Scan error. Student may belong to another class.'
      });
    }
  };

  // Add Student Handler
  const handleOpenAddStudent = () => {
    // Parse year/branch from selected class if possible
    let yr = '1st Year';
    let br = 'CSE';
    let sec = 'A';
    if (selectedClassId) {
      const parts = selectedClassId.split('-');
      if (parts[0] === '1') yr = '1st Year';
      else if (parts[0] === '2') yr = '2nd Year';
      else if (parts[0] === '3') yr = '3rd Year';
      else if (parts[0] === '4') yr = '4th Year';
      if (parts[1]) br = parts[1];
      if (parts[2]) sec = parts[2];
    }

    setStudentForm({
      rollNo: students.length > 0 ? Math.max(...students.map(s => Number(s.roll_no) || 0)) + 1 : 101,
      name: '',
      year: yr,
      branch: br,
      section: yr === '1st Year' ? sec : '',
      email: '',
      phone: '',
      classId: selectedClassId,
      gender: 'Male'
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
        body: JSON.stringify({
          ...studentForm,
          classId: selectedClassId,
          parentPhone: studentForm.phone
        })
      });

      setIsAddStudentModalOpen(false);
      fetchClasses();
      fetchStudentsAndAttendance();
      setScanFeedback({
        type: 'success',
        text: `Student "${studentForm.name}" registered successfully to ${selectedClassId}!`
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
          room: 'Main Campus',
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

  // Filtered lists for the directory panel
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
      (s.phone && s.phone.includes(q))
    );
  };

  const displayedStudents = getFilteredList();

  return (
    <div>
      {/* Top Header & Context Controls */}
      <div className="card-header" style={{ marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 className="card-title" style={{ fontSize: '1.5rem' }}>
              <span>Faculty Attendance Station</span>
            </h1>
            <span className="user-role-badge badge-teacher">
              {user.fullName || 'Faculty'}
            </span>
          </div>
          <p className="card-subtitle">
            Roll call & QR check-in for <strong>{selectedClassId || 'Selected Class'}</strong> • Stored as daily Excel report
          </p>
        </div>

        {/* Action Controls: Class Selector, Excel Download */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Class Chooser Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              style={{
                fontWeight: 700,
                fontSize: '0.9rem',
                padding: '8px 12px',
                borderColor: 'var(--accent-primary)',
                backgroundColor: 'var(--bg-card)'
              }}
            >
              {classes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.id} - {c.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => setIsAddClassModalOpen(true)}
              className="btn-secondary"
              style={{ padding: '8px 10px', fontSize: '0.8rem' }}
              title="Add New Department / Class"
            >
              <Plus size={16} />
              <span className="hide-mobile">Class</span>
            </button>
          </div>

          {/* Download Today's Excel Report */}
          <button
            onClick={() => handleDownloadExcel()}
            className="btn-secondary"
            style={{ padding: '8px 12px', fontSize: '0.82rem', borderColor: '#10b981', color: '#10b981' }}
            title="Download Daily Attendance Excel Sheet"
          >
            <FileSpreadsheet size={16} />
            <span>Download Excel</span>
          </button>
        </div>
      </div>

      {/* Date & Session Selector Bar */}
      <div className="card" style={{ padding: '12px 16px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          {/* Date Picker */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={18} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Date:</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{ padding: '6px 10px', fontSize: '0.85rem' }}
            />
          </div>

          {/* Session Selector (Morning vs Afternoon) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', marginRight: '4px' }}>Session:</span>
            <button
              type="button"
              onClick={() => setSession('MORNING')}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.82rem',
                fontWeight: 700,
                border: '1.5px solid',
                borderColor: session === 'MORNING' ? 'var(--accent-primary)' : 'var(--border-color)',
                backgroundColor: session === 'MORNING' ? 'var(--accent-light)' : 'transparent',
                color: session === 'MORNING' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                cursor: 'pointer'
              }}
            >
              🌅 Morning Lecture
            </button>
            <button
              type="button"
              onClick={() => setSession('AFTERNOON')}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.82rem',
                fontWeight: 700,
                border: '1.5px solid',
                borderColor: session === 'AFTERNOON' ? '#f59e0b' : 'var(--border-color)',
                backgroundColor: session === 'AFTERNOON' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                color: session === 'AFTERNOON' ? '#d97706' : 'var(--text-secondary)',
                cursor: 'pointer'
              }}
            >
              🌆 Afternoon Lab
            </button>
          </div>

          {/* Mode Switch: QR Scanner vs Manual Roll Call */}
          <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--bg-card-subtle)', padding: '4px', borderRadius: '8px' }}>
            <button
              onClick={() => setMode('qr')}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.82rem',
                fontWeight: mode === 'qr' ? 700 : 500,
                border: 'none',
                background: mode === 'qr' ? 'var(--bg-card)' : 'transparent',
                color: mode === 'qr' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                boxShadow: mode === 'qr' ? 'var(--shadow-sm)' : 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <QrCode size={15} />
              <span>QR Scanner</span>
            </button>
            <button
              onClick={() => { setMode('manual'); stopScanner(); }}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.82rem',
                fontWeight: mode === 'manual' ? 700 : 500,
                border: 'none',
                background: mode === 'manual' ? 'var(--bg-card)' : 'transparent',
                color: mode === 'manual' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                boxShadow: mode === 'manual' ? 'var(--shadow-sm)' : 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <ClipboardList size={15} />
              <span>Manual Roll Call</span>
            </button>
          </div>
        </div>
      </div>

      {/* Auto Download Banner Alert */}
      {autoDownloadNotice && (
        <div style={{
          backgroundColor: 'rgba(16, 185, 129, 0.15)',
          border: '1.5px solid #10b981',
          color: '#065f46',
          padding: '12px 18px',
          borderRadius: 'var(--radius-md)',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          animation: 'fadeIn 0.3s ease'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckCircle2 size={22} style={{ color: '#10b981' }} />
            <div>
              <strong style={{ fontSize: '0.95rem' }}>Afternoon Attendance Recorded!</strong>
              <div style={{ fontSize: '0.82rem' }}>Today's attendance Excel report has been saved to server and downloaded automatically. 📥</div>
            </div>
          </div>
          <button
            onClick={() => handleDownloadExcel()}
            className="btn-primary"
            style={{ padding: '6px 14px', fontSize: '0.8rem', backgroundColor: '#10b981' }}
          >
            Download Again
          </button>
        </div>
      )}

      {/* 3 Key Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '18px' }}>
        <div className="card" style={{ padding: '14px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
            Total Enrolled
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            {totalStudents}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Class {selectedClassId}
          </div>
        </div>

        <div className="card" style={{ padding: '14px', textAlign: 'center', borderBottom: '3px solid #10b981' }}>
          <div style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 700, textTransform: 'uppercase' }}>
            🟢 Present
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#10b981' }}>
            {presentCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {attendanceRate}% Present
          </div>
        </div>

        <div className="card" style={{ padding: '14px', textAlign: 'center', borderBottom: '3px solid #ef4444' }}>
          <div style={{ fontSize: '0.78rem', color: '#ef4444', fontWeight: 700, textTransform: 'uppercase' }}>
            🔴 Absent
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ef4444' }}>
            {absentCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {totalStudents > 0 ? (100 - attendanceRate).toFixed(1) : 0}% Absent
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: '16px', alignItems: 'start' }}>
        {/* LEFT COLUMN: QR Scanner OR Manual Checklist */}
        <div>
          {mode === 'qr' ? (
            /* QR CAMERA SCANNER MODE */
            <div className="card" style={{ padding: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <span style={{ fontWeight: 800, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Camera size={20} style={{ color: 'var(--accent-primary)' }} />
                  Live QR Camera Scanner
                </span>

                <div style={{ display: 'flex', gap: '6px' }}>
                  {!isScanning ? (
                    <button onClick={startScanner} className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                      <Camera size={16} />
                      <span>Start Camera</span>
                    </button>
                  ) : (
                    <button onClick={stopScanner} className="btn-outline-danger" style={{ padding: '8px 14px', fontSize: '0.85rem' }}>
                      <CameraOff size={16} />
                      <span>Stop Camera</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Viewfinder Window */}
              <div style={{
                position: 'relative',
                width: '100%',
                minHeight: '280px',
                backgroundColor: '#0f172a',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: isScanning ? '2.5px solid #22c55e' : '2px dashed var(--border-color)',
                marginBottom: '14px'
              }}>
                <div id="qr-reader" style={{ width: '100%', height: '100%' }}></div>

                {!isScanning && (
                  <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>
                    <QrCode size={54} style={{ margin: '0 auto 12px', opacity: 0.6 }} />
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: '#f8fafc', marginBottom: '6px' }}>
                      Camera is Paused
                    </div>
                    <p style={{ fontSize: '0.82rem', maxWidth: '300px', margin: '0 auto 14px', color: '#cbd5e1' }}>
                      Tap "Start Camera" to scan student QR cards, or upload an image file from device.
                    </p>
                    <button onClick={startScanner} className="btn-primary" style={{ padding: '9px 18px', fontSize: '0.85rem' }}>
                      <Camera size={16} />
                      <span>Turn On Scanner</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Photo Upload Fallback */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Having camera trouble? Upload QR picture:
                </span>
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleFileScan}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                >
                  <Upload size={14} />
                  <span>Scan Photo / File</span>
                </button>
              </div>

              {/* Instant Scan Feedback Alert */}
              {scanFeedback && (
                <div style={{
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginBottom: '14px',
                  backgroundColor: scanFeedback.type === 'success' ? 'var(--present-bg)' : (scanFeedback.type === 'warning' ? '#fef3c7' : 'var(--absent-bg)'),
                  color: scanFeedback.type === 'success' ? 'var(--present-color)' : (scanFeedback.type === 'warning' ? '#92400e' : 'var(--absent-color)'),
                  border: `1px solid ${scanFeedback.type === 'success' ? 'var(--present-border)' : (scanFeedback.type === 'warning' ? '#fde68a' : 'var(--absent-border)')}`
                }}>
                  {scanFeedback.type === 'success' && <CheckCircle2 size={20} />}
                  {scanFeedback.type === 'warning' && <AlertCircle size={20} />}
                  {scanFeedback.type === 'error' && <XCircle size={20} />}
                  <span>{scanFeedback.text}</span>
                </div>
              )}

              {/* Afternoon Finalize & Download Button */}
              {session === 'AFTERNOON' && (
                <div style={{
                  padding: '12px 16px',
                  backgroundColor: 'rgba(245, 158, 11, 0.1)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '14px'
                }}>
                  <div>
                    <strong style={{ fontSize: '0.85rem', color: '#b45309' }}>Finished Afternoon Attendance?</strong>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Download the completed daily attendance Excel workbook.</div>
                  </div>
                  <button
                    onClick={() => handleDownloadExcel()}
                    className="btn-primary"
                    style={{ backgroundColor: '#f59e0b', padding: '8px 14px', fontSize: '0.82rem' }}
                  >
                    <Download size={15} />
                    <span>Download Excel</span>
                  </button>
                </div>
              )}

              {/* Recent Scan History Stream */}
              {recentScans.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                    Recent Check-ins
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {recentScans.map((scan, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px 12px',
                          backgroundColor: 'var(--bg-card-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.82rem'
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>
                          #{scan.student.rollNo} {scan.student.name}
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                          {scan.time}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* MANUAL ROLL CALL / CHECKLIST MODE */
            <div className="card" style={{ padding: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>
                    Manual Roll Call: {selectedClassId}
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                    Tap Present / Absent for each student, then save attendance below.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => markAll('PRESENT')}
                    className="btn-secondary"
                    style={{ padding: '5px 10px', fontSize: '0.78rem', color: '#10b981' }}
                  >
                    All Present
                  </button>
                  <button
                    type="button"
                    onClick={() => markAll('ABSENT')}
                    className="btn-secondary"
                    style={{ padding: '5px 10px', fontSize: '0.78rem', color: '#ef4444' }}
                  >
                    All Absent
                  </button>
                </div>
              </div>

              {/* Student Checklist Table */}
              <div style={{ maxHeight: '420px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', marginBottom: '16px' }}>
                <table style={{ margin: 0 }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 1, backgroundColor: 'var(--bg-card-subtle)' }}>
                    <tr>
                      <th style={{ width: '60px' }}>Roll</th>
                      <th>Student Name</th>
                      <th>Year/Branch</th>
                      <th style={{ textAlign: 'right' }}>Status Toggle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.length === 0 ? (
                      <tr>
                        <td colSpan="4" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                          No students enrolled in this class yet.
                        </td>
                      </tr>
                    ) : (
                      students.map(s => {
                        const isPresent = attendanceMap[s.id] === 'PRESENT';
                        return (
                          <tr key={s.id}>
                            <td style={{ fontWeight: 800, color: 'var(--accent-primary)' }}>#{s.roll_no}</td>
                            <td style={{ fontWeight: 600 }}>{s.name}</td>
                            <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                              {s.year || ''} {s.branch || ''} {s.section ? `(${s.section})` : ''}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                type="button"
                                onClick={() => toggleStudent(s.id)}
                                style={{
                                  padding: '5px 12px',
                                  borderRadius: '9999px',
                                  fontSize: '0.78rem',
                                  fontWeight: 700,
                                  border: 'none',
                                  cursor: 'pointer',
                                  backgroundColor: isPresent ? 'var(--present-color)' : 'var(--absent-color)',
                                  color: '#ffffff',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                {isPresent ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                                <span>{isPresent ? 'PRESENT' : 'ABSENT'}</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Big Save Button */}
              <button
                type="button"
                onClick={handleSaveManualAttendance}
                disabled={isSaving || students.length === 0}
                className="btn-primary"
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '0.95rem',
                  backgroundColor: session === 'AFTERNOON' ? '#d97706' : 'var(--accent-primary)'
                }}
              >
                {isSaving ? 'Saving...' : (
                  session === 'AFTERNOON' ? (
                    <>
                      <Download size={18} />
                      <span>Save & Download Afternoon Excel 📥</span>
                    </>
                  ) : (
                    <>
                      <Check size={18} />
                      <span>Save Morning Attendance</span>
                    </>
                  )
                )}
              </button>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Roster Tabs (Present List, Absent List, All) & Add Student */}
        <div>
          <div className="card" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>
                Class Roster & Name List
              </span>

              {/* "+ Add Student" Button directly from Teacher Station */}
              <button
                type="button"
                onClick={handleOpenAddStudent}
                className="btn-primary"
                style={{ padding: '6px 12px', fontSize: '0.78rem' }}
              >
                <Plus size={15} />
                <span>Add Student</span>
              </button>
            </div>

            {/* Present / Absent / All Tabs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', marginBottom: '12px', backgroundColor: 'var(--bg-card-subtle)', padding: '3px', borderRadius: '8px' }}>
              <button
                type="button"
                onClick={() => setListTab('present')}
                style={{
                  padding: '6px',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: listTab === 'present' ? 700 : 500,
                  border: 'none',
                  background: listTab === 'present' ? '#10b981' : 'transparent',
                  color: listTab === 'present' ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                Present ({presentCount})
              </button>
              <button
                type="button"
                onClick={() => setListTab('absent')}
                style={{
                  padding: '6px',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: listTab === 'absent' ? 700 : 500,
                  border: 'none',
                  background: listTab === 'absent' ? '#ef4444' : 'transparent',
                  color: listTab === 'absent' ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                Absent ({absentCount})
              </button>
              <button
                type="button"
                onClick={() => setListTab('all')}
                style={{
                  padding: '6px',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: listTab === 'all' ? 700 : 500,
                  border: 'none',
                  background: listTab === 'all' ? 'var(--bg-card)' : 'transparent',
                  color: listTab === 'all' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                All ({totalStudents})
              </button>
            </div>

            {/* Search Input */}
            <div style={{ position: 'relative', marginBottom: '12px' }}>
              <input
                type="text"
                placeholder="Search name, roll no..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '32px', fontSize: '0.8rem', width: '100%', padding: '6px 8px 6px 32px' }}
              />
              <Search size={15} style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)'
              }} />
            </div>

            {/* Name List Content */}
            <div style={{ maxHeight: '380px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {displayedStudents.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  {listTab === 'present' && 'No students present yet today.'}
                  {listTab === 'absent' && 'All students are present! (100% Attendance)'}
                  {listTab === 'all' && 'No students found.'}
                </div>
              ) : (
                displayedStudents.map(s => {
                  const isPresent = attendanceMap[s.id] === 'PRESENT';
                  return (
                    <div
                      key={s.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 12px',
                        backgroundColor: 'var(--bg-card-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        borderLeft: `4px solid ${isPresent ? '#10b981' : '#ef4444'}`
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                          #{s.roll_no} {s.name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {s.year || ''} {s.branch || ''} {s.section ? `• Sec ${s.section}` : ''}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {/* Parent/Contact Phone call option for absentees */}
                        {!isPresent && (s.phone || s.parent_phone) && (
                          <a
                            href={`tel:${s.phone || s.parent_phone}`}
                            style={{
                              padding: '5px',
                              borderRadius: '50%',
                              backgroundColor: 'rgba(239, 68, 68, 0.1)',
                              color: '#ef4444',
                              display: 'inline-flex'
                            }}
                            title={`Call parent / student: ${s.phone || s.parent_phone}`}
                          >
                            <Phone size={14} />
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={() => toggleStudent(s.id)}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            border: 'none',
                            cursor: 'pointer',
                            backgroundColor: isPresent ? '#10b981' : '#ef4444',
                            color: '#ffffff'
                          }}
                        >
                          {isPresent ? 'PRESENT' : 'ABSENT'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ADD STUDENT MODAL */}
      {isAddStudentModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                  Enroll Student to {selectedClassId}
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Add student with Name, Year, Branch, Section (1st Year), Phone & Email.
                </p>
              </div>
              <button
                onClick={() => setIsAddStudentModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {addStudentError && (
              <div style={{
                backgroundColor: 'var(--absent-bg)',
                color: 'var(--absent-color)',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.82rem',
                marginBottom: '14px'
              }}>
                {addStudentError}
              </div>
            )}

            <form onSubmit={handleSaveStudent}>
              <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '4px' }}>
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
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '4px' }}>
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={studentForm.name}
                    onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                    placeholder="e.g. Michael Scott"
                    required
                  />
                </div>
              </div>

              {/* Year, Branch, Section */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: studentForm.year === '1st Year' ? '1fr 1fr 1fr' : '1fr 1fr',
                gap: '10px',
                marginBottom: '12px',
                backgroundColor: 'var(--bg-card-subtle)',
                padding: '10px',
                borderRadius: '6px'
              }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '4px' }}>
                    Year *
                  </label>
                  <select
                    value={studentForm.year}
                    onChange={(e) => {
                      const yr = e.target.value;
                      setStudentForm({
                        ...studentForm,
                        year: yr,
                        section: yr === '1st Year' ? 'A' : ''
                      });
                    }}
                    style={{ width: '100%' }}
                  >
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="4th Year">4th Year</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '4px' }}>
                    Branch *
                  </label>
                  <input
                    type="text"
                    value={studentForm.branch}
                    onChange={(e) => setStudentForm({ ...studentForm, branch: e.target.value.toUpperCase() })}
                    placeholder="CSE"
                    required
                    style={{ width: '100%', textTransform: 'uppercase' }}
                  />
                </div>

                {studentForm.year === '1st Year' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '4px', color: 'var(--accent-primary)' }}>
                      Section * (1st Yr)
                    </label>
                    <select
                      value={studentForm.section}
                      onChange={(e) => setStudentForm({ ...studentForm, section: e.target.value })}
                      style={{ width: '100%', borderColor: 'var(--accent-primary)', fontWeight: 700 }}
                      required
                    >
                      <option value="A">Section A</option>
                      <option value="B">Section B</option>
                      <option value="C">Section C</option>
                      <option value="D">Section D</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Phone & Common Mail ID */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '4px' }}>
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    value={studentForm.phone}
                    onChange={(e) => setStudentForm({ ...studentForm, phone: e.target.value })}
                    placeholder="9876543210"
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '4px' }}>
                    Common Mail ID *
                  </label>
                  <input
                    type="email"
                    value={studentForm.email}
                    onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
                    placeholder="student@college.edu"
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsAddStudentModalOpen(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ padding: '8px 18px' }}>
                  <Plus size={16} />
                  <span>Register & Generate QR</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD CLASS MODAL */}
      {isAddClassModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '420px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>Add New Class / Department</h3>
              <button onClick={() => setIsAddClassModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateNewClass}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>
                  Class Code / Department Name
                </label>
                <input
                  type="text"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="e.g. 1-IT-A, 3-MECH, B.Tech CSE"
                  required
                  autoFocus
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
