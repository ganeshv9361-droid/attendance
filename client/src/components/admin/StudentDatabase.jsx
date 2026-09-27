import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Search, Edit2, Trash2, QrCode, X, Check, Filter, Phone, Mail, Building, GraduationCap } from 'lucide-react';
import BackButton from '../common/BackButton';
import { apiFetch } from '../../utils/api';

const BRANCH_OPTIONS = [
  { code: 'CSE', label: 'CSE - Computer Science & Engineering' },
  { code: 'ECE', label: 'ECE - Electronics & Communication' },
  { code: 'EEE', label: 'EEE - Electrical & Electronics' },
  { code: 'MECH', label: 'MECH - Mechanical Engineering' },
  { code: 'CIVIL', label: 'CIVIL - Civil Engineering' },
  { code: 'IT', label: 'IT - Information Technology' },
  { code: 'AI&DS', label: 'AI&DS - Artificial Intelligence & Data Science' },
  { code: 'AI&ML', label: 'AI&ML - Artificial Intelligence & Machine Learning' },
  { code: 'AGRI', label: 'AGRI - Agriculture' },
  { code: 'CSD', label: 'CSD - Computer Science Design' }
];

export default function StudentDatabase({ onBack, onNavigateToQRCards }) {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [qrModalStudent, setQrModalStudent] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    rollNo: '',
    name: '',
    year: '1st Year',
    branch: 'CSE',
    section: 'A',
    email: '',
    phone: '',
    classId: '1-CSE-A',
    gender: 'Male'
  });

  useEffect(() => {
    fetchClasses();
    fetchStudents();
  }, [selectedClass, searchQuery]);

  const fetchClasses = async () => {
    try {
      const data = await apiFetch('/api/classes');
      setClasses(data);
    } catch (err) {
      console.error('Failed to load classes:', err);
    }
  };

  const fetchStudents = async () => {
    setLoading(true);
    try {
      let url = '/api/students?';
      if (selectedClass) url += `classId=${encodeURIComponent(selectedClass)}&`;
      if (searchQuery) url += `search=${encodeURIComponent(searchQuery)}&`;

      const data = await apiFetch(url);
      setStudents(data);
    } catch (err) {
      console.error('Failed to load students:', err);
    } finally {
      setLoading(false);
    }
  };

  // Helper to compute derived class ID
  const computeClassId = (year, branch, section) => {
    const cleanBranch = (branch || 'CSE').toUpperCase().trim();
    if (year === '1st Year' || year === '1') {
      const sec = (section || 'A').toUpperCase().trim();
      return `1-${cleanBranch}-${sec}`;
    }
    const yearDigit = year.replace(/[^0-9]/g, '') || '2';
    return `${yearDigit}-${cleanBranch}`;
  };

  const handleFieldChange = (field, value) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      // If changing year to 1st Year, default section to A if blank
      if (field === 'year') {
        if (value === '1st Year') {
          if (!updated.section) updated.section = 'A';
        } else {
          updated.section = '';
        }
      }
      updated.classId = computeClassId(updated.year, updated.branch, updated.section);
      return updated;
    });
  };

  const handleOpenAdd = () => {
    const defaultYear = '1st Year';
    const defaultBranch = 'CSE';
    const defaultSec = 'A';
    setFormData({
      rollNo: students.length > 0 ? Math.max(...students.map(s => Number(s.roll_no) || 0)) + 1 : '',
      name: '',
      year: defaultYear,
      branch: defaultBranch,
      section: defaultSec,
      email: '',
      phone: '',
      classId: computeClassId(defaultYear, defaultBranch, defaultSec),
      gender: 'Male'
    });
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (student) => {
    setEditingStudent(student);
    const yr = student.year || '1st Year';
    const br = student.branch || 'CSE';
    const sec = yr === '1st Year' ? (student.section || 'A') : '';
    setFormData({
      rollNo: student.roll_no,
      name: student.name,
      year: yr,
      branch: br,
      section: sec,
      email: student.email || '',
      phone: student.phone || student.parent_phone || '',
      classId: student.class_id || computeClassId(yr, br, sec),
      gender: student.gender || 'Male'
    });
  };

  const handleSaveStudent = async (e) => {
    e.preventDefault();
    try {
      const url = editingStudent
        ? `/api/students/${editingStudent.id}`
        : '/api/students';
      const method = editingStudent ? 'PUT' : 'POST';

      // Ensure classId is synced
      const finalClassId = computeClassId(formData.year, formData.branch, formData.section);
      const payload = {
        ...formData,
        classId: finalClassId,
        parentPhone: formData.phone // Sync phone for parent/guardian contact
      };

      await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      setIsAddModalOpen(false);
      setEditingStudent(null);
      fetchClasses();
      fetchStudents();
    } catch (err) {
      alert(err.message || 'Failed to save student record');
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Are you sure you want to delete student "${name}"?`)) return;
    try {
      await apiFetch(`/api/students/${id}`, { method: 'DELETE' });
      fetchStudents();
    } catch (err) {
      alert(err.message || 'Delete error');
    }
  };

  const handleViewQR = async (student) => {
    setQrModalStudent(student);
    try {
      const data = await apiFetch(`/api/students/${student.id}/qr`);
      setQrDataUrl(data.qrDataUrl);
    } catch (err) {
      console.error('Failed to generate QR:', err);
    }
  };

  const isFirstYear = formData.year === '1st Year' || formData.year === '1';

  return (
    <div>
      <BackButton onBack={onBack} label="Back to Admin Dashboard" />

      {/* Top Header */}
      <div className="card-header" style={{ marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 className="card-title" style={{ fontSize: '1.6rem' }}>
              <Users size={28} style={{ color: 'var(--accent-primary)' }} />
              <span>Student Academic Directory</span>
            </h1>
            <span style={{
              backgroundColor: 'var(--accent-light)',
              color: 'var(--accent-primary)',
              padding: '3px 10px',
              borderRadius: '9999px',
              fontWeight: 700,
              fontSize: '0.82rem'
            }}>
              {students.length} Students Enrolled
            </span>
          </div>
          <p className="card-subtitle">
            Manage student records with Name, Year, Branch, Section (1st Year), Common Mail ID & Phone Number.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={onNavigateToQRCards} className="btn-secondary">
            <QrCode size={18} />
            <span>Print Student ID Passes</span>
          </button>
          <button onClick={handleOpenAdd} className="btn-primary">
            <UserPlus size={18} />
            <span>Enroll New Student</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="card" style={{ marginBottom: '18px', padding: '14px 18px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>
              Filter by Department / Class
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              style={{ width: '100%' }}
            >
              <option value="">All Departments & Batches (College-wide)</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.id})</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>
              Search Students
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Search by student name, roll number, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '38px', width: '100%' }}
              />
              <Search size={18} style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)'
              }} />
            </div>
          </div>
        </div>
      </div>

      {/* Student Database Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Roll No</th>
              <th>Student Name</th>
              <th>Year</th>
              <th>Branch</th>
              <th>Section</th>
              <th>Phone Number</th>
              <th>Common Mail ID</th>
              <th>Department Code</th>
              <th style={{ textAlign: 'center' }}>QR Badge</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="10" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                  Loading college student database...
                </td>
              </tr>
            ) : students.length === 0 ? (
              <tr>
                <td colSpan="10" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                  <div style={{ marginBottom: '10px', fontSize: '1rem', fontWeight: 600 }}>No students found</div>
                  <button onClick={handleOpenAdd} className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                    <UserPlus size={16} /> Enroll First Student
                  </button>
                </td>
              </tr>
            ) : (
              students.map(s => {
                const isFirstYr = s.year === '1st Year' || s.year === '1';
                return (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 800, color: 'var(--accent-primary)' }}>#{s.roll_no}</td>
                    <td style={{ fontWeight: 700 }}>
                      <div>{s.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{s.id}</div>
                    </td>
                    <td>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        backgroundColor: isFirstYr ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-card-subtle)',
                        color: isFirstYr ? '#2563eb' : 'var(--text-secondary)'
                      }}>
                        {s.year || '-'}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{s.branch || '-'}</td>
                    <td>
                      {isFirstYr && s.section ? (
                        <span style={{
                          backgroundColor: 'rgba(16, 185, 129, 0.15)',
                          color: '#059669',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '0.8rem'
                        }}>
                          Sec {s.section}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>-</span>
                      )}
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)' }}>
                        <Phone size={13} style={{ color: 'var(--text-muted)' }} />
                        {s.phone || s.parent_phone || 'N/A'}
                      </span>
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        <Mail size={13} style={{ color: 'var(--text-muted)' }} />
                        {s.email || 'N/A'}
                      </span>
                    </td>
                    <td>
                      <span style={{
                        backgroundColor: 'var(--bg-card-subtle)',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontFamily: 'monospace',
                        fontSize: '0.82rem',
                        fontWeight: 600
                      }}>
                        {s.class_id}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={() => handleViewQR(s)}
                        className="btn-secondary"
                        style={{ padding: '5px 9px', fontSize: '0.78rem' }}
                        title="View Student QR Code Pass"
                      >
                        <QrCode size={15} />
                        <span>QR Pass</span>
                      </button>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          onClick={() => handleOpenEdit(s)}
                          className="btn-secondary"
                          style={{ padding: '6px 8px' }}
                          title="Edit Student Information"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(s.id, s.name)}
                          className="btn-outline-danger"
                          style={{ padding: '6px 8px' }}
                          title="Delete Student"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* STUDENT ENROLLMENT / EDIT MODAL */}
      {(isAddModalOpen || editingStudent) && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '560px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                  {editingStudent ? 'Edit Student Profile' : 'Enroll New Student'}
                </h2>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Enter student details. Section is enabled for 1st Year students only.
                </p>
              </div>
              <button
                onClick={() => { setIsAddModalOpen(false); setEditingStudent(null); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveStudent}>
              {/* Row 1: Roll No & Full Name */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                    Roll No *
                  </label>
                  <input
                    type="number"
                    value={formData.rollNo}
                    onChange={(e) => handleFieldChange('rollNo', e.target.value)}
                    placeholder="Enter Roll No"
                    required
                  />
                </div>
                <div style={{ flex: '2 1 200px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                    Student Full Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleFieldChange('name', e.target.value)}
                    placeholder="Enter Student Full Name"
                    required
                  />
                </div>
              </div>

              {/* Row 2: Year, Branch, and Section (Section shown for 1st Year ALONE) */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: '12px',
                marginBottom: '14px',
                padding: '12px',
                backgroundColor: 'var(--bg-card-subtle)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)'
              }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                    Academic Year *
                  </label>
                  <select
                    value={formData.year}
                    onChange={(e) => handleFieldChange('year', e.target.value)}
                    style={{ width: '100%', fontWeight: 600 }}
                  >
                    <option value="1st Year">1st Year (First)</option>
                    <option value="2nd Year">2nd Year (Second)</option>
                    <option value="3rd Year">3rd Year (Third)</option>
                    <option value="4th Year">4th Year (Final)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                    Branch / Dept *
                  </label>
                  <input
                    type="text"
                    list="branch-suggestions"
                    value={formData.branch}
                    onChange={(e) => handleFieldChange('branch', e.target.value)}
                    placeholder="Branch code"
                    required
                    style={{ width: '100%', fontWeight: 600, textTransform: 'uppercase' }}
                  />
                  <datalist id="branch-suggestions">
                    {BRANCH_OPTIONS.map(b => (
                      <option key={b.code} value={b.code}>{b.label}</option>
                    ))}
                  </datalist>
                </div>

                {/* Section Field: Visible for FIRST YEAR ALONE */}
                {isFirstYear ? (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--accent-primary)' }}>
                      Section * (1st Yr Only)
                    </label>
                    <select
                      value={formData.section}
                      onChange={(e) => handleFieldChange('section', e.target.value)}
                      style={{ width: '100%', borderColor: 'var(--accent-primary)', fontWeight: 700 }}
                      required
                    >
                      <option value="A">Section A</option>
                      <option value="B">Section B</option>
                      <option value="C">Section C</option>
                      <option value="D">Section D</option>
                      <option value="E">Section E</option>
                      <option value="F">Section F</option>
                      <option value="G">Section G</option>
                    </select>
                  </div>
                ) : null}
              </div>

              {/* Computed Department / Class ID Badge */}
              <div style={{
                marginBottom: '14px',
                fontSize: '0.82rem',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 12px',
                background: 'rgba(37, 99, 235, 0.08)',
                borderRadius: '6px'
              }}>
                <span>Assigned Department Batch:</span>
                <strong style={{ color: 'var(--accent-primary)', fontFamily: 'monospace', fontSize: '0.9rem' }}>
                  {formData.classId}
                </strong>
              </div>

              {/* Row 3: Common Mail ID & Phone Number */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleFieldChange('phone', e.target.value)}
                    placeholder="Enter phone number"
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                    Common Mail ID *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleFieldChange('email', e.target.value)}
                    placeholder="Enter student email"
                    required
                  />
                </div>
              </div>

              {/* Row 4: Gender */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                  Gender
                </label>
                <select
                  value={formData.gender}
                  onChange={(e) => handleFieldChange('gender', e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => { setIsAddModalOpen(false); setEditingStudent(null); }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ padding: '10px 20px' }}>
                  <Check size={18} />
                  <span>{editingStudent ? 'Update Record' : 'Enroll Student'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR PASS MODAL */}
      {qrModalStudent && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '400px', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Student Attendance QR Pass</h3>
              <button onClick={() => setQrModalStudent(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{
              backgroundColor: '#ffffff',
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              display: 'inline-block',
              boxShadow: 'var(--shadow-md)',
              marginBottom: '14px',
              border: '1px solid #cbd5e1'
            }}>
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="QR Code" style={{ width: '220px', height: '220px', display: 'block' }} />
              ) : (
                <div style={{ width: '220px', height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                  Generating QR Pass...
                </div>
              )}
            </div>

            <h4 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '4px' }}>{qrModalStudent.name}</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '18px' }}>
              Roll #{qrModalStudent.roll_no} • {qrModalStudent.year || ''} {qrModalStudent.branch || ''} {qrModalStudent.section ? `(Sec ${qrModalStudent.section})` : ''} • Code: <span style={{ fontFamily: 'monospace' }}>{qrModalStudent.class_id}</span>
            </p>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => {
                  if (!qrDataUrl) return;
                  const a = document.createElement('a');
                  a.href = qrDataUrl;
                  a.download = `QR_${qrModalStudent.class_id}_${qrModalStudent.roll_no}_${qrModalStudent.name.replace(/\s+/g, '_')}.png`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                }}
                className="btn-primary"
                style={{ flex: 1 }}
              >
                Download PNG
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="btn-secondary"
                style={{ flex: 1 }}
              >
                Print Pass
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
