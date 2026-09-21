import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Search, Edit2, Trash2, QrCode, X, Check, Eye } from 'lucide-react';
import BackButton from '../common/BackButton';
import { apiFetch } from '../../utils/api';

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
    gender: 'Male',
    classId: '',
    parentName: '',
    parentPhone: '',
    email: ''
  });

  useEffect(() => {
    fetchClasses();
    fetchStudents();
  }, [selectedClass, searchQuery]);

  const fetchClasses = async () => {
    try {
      const data = await apiFetch('/api/classes');
      setClasses(data);
      if (data.length > 0 && !formData.classId) {
        setFormData(prev => ({ ...prev, classId: data[0].id }));
      }
    } catch (err) {
      console.error('Failed to load classes:', err);
    }
  };

  const fetchStudents = async () => {
    setLoading(true);
    try {
      let url = '/api/students?';
      if (selectedClass) url += `classId=${selectedClass}&`;
      if (searchQuery) url += `search=${encodeURIComponent(searchQuery)}&`;

      const data = await apiFetch(url);
      setStudents(data);
    } catch (err) {
      console.error('Failed to load students:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setFormData({
      rollNo: '',
      name: '',
      gender: 'Male',
      classId: classes[0]?.id || '',
      parentName: '',
      parentPhone: '',
      email: ''
    });
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (student) => {
    setEditingStudent(student);
    setFormData({
      rollNo: student.roll_no,
      name: student.name,
      gender: student.gender,
      classId: student.class_id,
      parentName: student.parent_name || '',
      parentPhone: student.parent_phone || '',
      email: student.email || ''
    });
  };

  const handleSaveStudent = async (e) => {
    e.preventDefault();
    try {
      const url = editingStudent 
        ? `/api/students/${editingStudent.id}`
        : '/api/students';
      const method = editingStudent ? 'PUT' : 'POST';

      await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      setIsAddModalOpen(false);
      setEditingStudent(null);
      fetchStudents();
    } catch (err) {
      alert(err.message || 'Failed to save student');
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Are you sure you want to permanently delete student "${name}"?`)) return;
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

  return (
    <div>
      <BackButton onBack={onBack} label="Back to Admin Dashboard" />

      <div className="card-header" style={{ marginBottom: '24px' }}>
        <div>
          <h1 className="card-title" style={{ fontSize: '1.6rem' }}>
            <Users size={28} style={{ color: 'var(--accent-primary)' }} />
            <span>College Student Directory & Database</span>
          </h1>
          <p className="card-subtitle">
            Manage college department enrollments, update academic records, and generate student QR passes.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onNavigateToQRCards} className="btn-secondary">
            <QrCode size={18} />
            <span>Print Student ID Badges</span>
          </button>
          <button onClick={handleOpenAdd} className="btn-primary">
            <UserPlus size={18} />
            <span>Enroll New Student</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="card" style={{ marginBottom: '20px', padding: '16px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>
              Filter by Department / Batch
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
            >
              <option value="">All Departments (College-wide)</option>
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
                placeholder="Search by student name, roll number, or USN..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '38px' }}
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

      {/* Student List Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Roll No</th>
              <th>Student ID</th>
              <th>Name</th>
              <th>Gender</th>
              <th>Class</th>
              <th>Parent / Guardian</th>
              <th>Parent Phone</th>
              <th style={{ textAlign: 'center' }}>QR Code</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                  Loading student database...
                </td>
              </tr>
            ) : students.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                  No students found matching the filter criteria.
                </td>
              </tr>
            ) : (
              students.map(s => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 700 }}>#{s.roll_no}</td>
                  <td>
                    <span style={{
                      fontFamily: 'monospace',
                      backgroundColor: 'var(--bg-card-subtle)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '0.85rem'
                    }}>
                      {s.id}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{s.name}</td>
                  <td>{s.gender}</td>
                  <td>
                    <span style={{
                      fontWeight: 600,
                      backgroundColor: 'var(--accent-light)',
                      color: 'var(--accent-primary)',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '0.82rem'
                    }}>
                      {s.class_id}
                    </span>
                  </td>
                  <td>{s.parent_name || 'N/A'}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{s.parent_phone || 'N/A'}</td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      onClick={() => handleViewQR(s)}
                      className="btn-secondary"
                      style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                      title="View Student QR Code Badge"
                    >
                      <QrCode size={16} />
                      <span>View QR</span>
                    </button>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '6px' }}>
                      <button
                        onClick={() => handleOpenEdit(s)}
                        className="btn-secondary"
                        style={{ padding: '6px 10px' }}
                        title="Edit Student Information"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(s.id, s.name)}
                        className="btn-outline-danger"
                        style={{ padding: '6px 10px' }}
                        title="Delete Student"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ADD / EDIT MODAL */}
      {(isAddModalOpen || editingStudent) && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                {editingStudent ? 'Edit Student Details' : 'Register New Student'}
              </h2>
              <button
                onClick={() => { setIsAddModalOpen(false); setEditingStudent(null); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveStudent}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                    Roll Number *
                  </label>
                  <input
                    type="number"
                    value={formData.rollNo}
                    onChange={(e) => setFormData({ ...formData, rollNo: e.target.value })}
                    placeholder="e.g. 101"
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Arthur Morgan"
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                    Class *
                  </label>
                  <select
                    value={formData.classId}
                    onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                    required
                  >
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.id})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                    Gender
                  </label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
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
                  value={formData.parentName}
                  onChange={(e) => setFormData({ ...formData, parentName: e.target.value })}
                  placeholder="e.g. Mary Morgan"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '24px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                    Parent Phone Number
                  </label>
                  <input
                    type="tel"
                    value={formData.parentPhone}
                    onChange={(e) => setFormData({ ...formData, parentPhone: e.target.value })}
                    placeholder="+1 555-0199"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                    Student Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="student@school.edu"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => { setIsAddModalOpen(false); setEditingStudent(null); }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  <Check size={18} />
                  <span>{editingStudent ? 'Update Student' : 'Save Student'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR CODE MODAL */}
      {qrModalStudent && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '400px', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Student Attendance QR Code</h3>
              <button onClick={() => setQrModalStudent(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{
              backgroundColor: '#ffffff',
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              display: 'inline-block',
              boxShadow: 'var(--shadow-md)',
              marginBottom: '16px',
              border: '1px solid #cbd5e1'
            }}>
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="QR Code" style={{ width: '220px', height: '220px', display: 'block' }} />
              ) : (
                <div style={{ width: '220px', height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                  Generating QR...
                </div>
              )}
            </div>

            <h4 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '4px' }}>{qrModalStudent.name}</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '20px' }}>
              Roll #{qrModalStudent.roll_no} • {qrModalStudent.class_id} • USN: <span style={{ fontFamily: 'monospace' }}>{qrModalStudent.id}</span>
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
                Print QR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
