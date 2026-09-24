import React, { useState, useEffect } from 'react';
import { UserCheck, Plus, Trash2, Edit2, School, X, Check, ShieldCheck, Key, BookOpen } from 'lucide-react';
import BackButton from '../common/BackButton';
import { apiFetch } from '../../utils/api';

export default function FacultyManager({ onBack }) {
  const [activeTab, setActiveTab] = useState('faculty'); // 'faculty' or 'departments'
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);

  // Faculty Modal
  const [isFacultyModalOpen, setIsFacultyModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [facultyForm, setFacultyForm] = useState({
    username: '',
    password: '',
    fullName: '',
    assignedClassId: ''
  });

  // Department Modal
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [deptForm, setDeptForm] = useState({
    id: '',
    name: '',
    room: '',
    teacherName: ''
  });

  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tData, cData] = await Promise.all([
        apiFetch('/api/teachers'),
        apiFetch('/api/classes')
      ]);
      setTeachers(tData);
      setClasses(cData);
    } catch (err) {
      console.error('Failed to load faculty/departments:', err);
    } finally {
      setLoading(false);
    }
  };

  // --- FACULTY HANDLERS ---
  const handleOpenAddFaculty = () => {
    setEditingTeacher(null);
    setFacultyForm({
      username: '',
      password: '',
      fullName: '',
      assignedClassId: ''
    });
    setIsFacultyModalOpen(true);
  };

  const handleOpenEditFaculty = (t) => {
    setEditingTeacher(t);
    setFacultyForm({
      username: t.username,
      password: '', // leave blank unless changing
      fullName: t.full_name,
      assignedClassId: t.assigned_class_id || ''
    });
    setIsFacultyModalOpen(true);
  };

  const handleSaveFaculty = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    try {
      const endpoint = editingTeacher ? `/api/teachers/${editingTeacher.id}` : '/api/teachers';
      const method = editingTeacher ? 'PUT' : 'POST';

      await apiFetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(facultyForm)
      });

      setIsFacultyModalOpen(false);
      setMessage({ type: 'success', text: editingTeacher ? 'Faculty account updated' : 'New faculty user created successfully!' });
      fetchData();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleDeleteFaculty = async (id, name) => {
    if (!confirm(`Are you sure you want to remove faculty account for "${name}"?`)) return;
    try {
      await apiFetch(`/api/teachers/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  // --- DEPARTMENT HANDLERS ---
  const handleOpenAddDept = () => {
    setEditingDept(null);
    setDeptForm({ id: '', name: '', room: '', teacherName: '' });
    setIsDeptModalOpen(true);
  };

  const handleOpenEditDept = (dept) => {
    setEditingDept(dept);
    setDeptForm({
      id: dept.id,
      name: dept.name,
      room: dept.room || '',
      teacherName: dept.teacher_name || ''
    });
    setIsDeptModalOpen(true);
  };

  const handleSaveDept = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    try {
      const endpoint = editingDept ? `/api/classes/${editingDept.id}` : '/api/classes';
      const method = editingDept ? 'PUT' : 'POST';

      await apiFetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deptForm)
      });

      setIsDeptModalOpen(false);
      setMessage({ type: 'success', text: editingDept ? 'Department updated' : 'New department created!' });
      fetchData();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleDeleteDept = async (id, name) => {
    if (!confirm(`Are you sure you want to remove department "${name}" (${id})?`)) return;
    try {
      await apiFetch(`/api/classes/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div>
      <BackButton onBack={onBack} label="Back to Admin Dashboard" />

      <div className="card-header" style={{ marginBottom: '24px' }}>
        <div>
          <h1 className="card-title" style={{ fontSize: '1.6rem' }}>
            <UserCheck size={28} style={{ color: 'var(--accent-primary)' }} />
            <span>Faculty & Department Administration</span>
          </h1>
          <p className="card-subtitle">
            Admin exclusive: Create professor accounts, set logins, and manage college departments/batches.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {activeTab === 'faculty' ? (
            <button onClick={handleOpenAddFaculty} className="btn-primary">
              <Plus size={18} />
              <span>Create Faculty Account</span>
            </button>
          ) : (
            <button onClick={handleOpenAddDept} className="btn-primary">
              <Plus size={18} />
              <span>Create New Department</span>
            </button>
          )}
        </div>
      </div>

      {message.text && (
        <div style={{
          padding: '12px 18px',
          borderRadius: 'var(--radius-md)',
          marginBottom: '20px',
          backgroundColor: message.type === 'success' ? 'var(--present-bg)' : 'var(--absent-bg)',
          color: message.type === 'success' ? 'var(--present-color)' : 'var(--absent-color)',
          border: `1px solid ${message.type === 'success' ? 'var(--present-border)' : 'var(--absent-border)'}`,
          fontWeight: 600
        }}>
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
        <button
          onClick={() => setActiveTab('faculty')}
          className={activeTab === 'faculty' ? 'btn-primary' : 'btn-secondary'}
          style={{ padding: '8px 18px' }}
        >
          <UserCheck size={18} />
          <span>Faculty & Teachers ({teachers.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('departments')}
          className={activeTab === 'departments' ? 'btn-primary' : 'btn-secondary'}
          style={{ padding: '8px 18px' }}
        >
          <BookOpen size={18} />
          <span>Departments & Classes ({classes.length})</span>
        </button>
      </div>

      {/* TAB 1: FACULTY MANAGEMENT */}
      {activeTab === 'faculty' && (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Faculty Full Name</th>
                <th>Username / User ID</th>
                <th>Role</th>
                <th>Assigned Department</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map(t => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 700 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--accent-light)',
                        color: 'var(--accent-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '0.85rem'
                      }}>
                        {t.full_name?.charAt(0) || 'F'}
                      </div>
                      <span>{t.full_name}</span>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'monospace', backgroundColor: 'var(--bg-card-subtle)', padding: '2px 8px', borderRadius: '4px' }}>
                      {t.username}
                    </span>
                  </td>
                  <td>
                    <span className="user-role-badge badge-teacher">Faculty</span>
                  </td>
                  <td>
                    {t.assigned_class_id ? (
                      <span style={{
                        backgroundColor: 'var(--accent-light)',
                        color: 'var(--accent-primary)',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '0.82rem'
                      }}>
                        {t.assigned_class_id} • {t.class_name || ''}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>Unassigned</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '8px' }}>
                      <button
                        onClick={() => handleOpenEditFaculty(t)}
                        className="btn-secondary"
                        style={{ padding: '6px 10px' }}
                        title="Edit Faculty Account"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => handleDeleteFaculty(t.id, t.full_name)}
                        className="btn-outline-danger"
                        style={{ padding: '6px 10px' }}
                        title="Delete Faculty Account"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: DEPARTMENTS MANAGEMENT */}
      {activeTab === 'departments' && (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Dept Code</th>
                <th>Department & Batch Name</th>
                <th>Venue / Room</th>
                <th>Assigned Faculty</th>
                <th>Enrolled Students</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {classes.map(c => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 800 }}>
                    <span style={{
                      backgroundColor: 'var(--accent-light)',
                      color: 'var(--accent-primary)',
                      padding: '3px 8px',
                      borderRadius: '4px'
                    }}>
                      {c.id}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{c.name}</td>
                  <td>{c.room || 'N/A'}</td>
                  <td>{c.teacher_name || 'Not assigned'}</td>
                  <td style={{ fontWeight: 700 }}>{c.studentCount} students</td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '8px' }}>
                      <button
                        onClick={() => handleOpenEditDept(c)}
                        className="btn-secondary"
                        style={{ padding: '6px 10px' }}
                        title="Edit Department"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => handleDeleteDept(c.id, c.name)}
                        className="btn-outline-danger"
                        style={{ padding: '6px 10px' }}
                        title="Delete Department"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* FACULTY MODAL */}
      {isFacultyModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                {editingTeacher ? 'Edit Faculty Account' : 'Create New Faculty User ID'}
              </h2>
              <button
                onClick={() => setIsFacultyModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveFaculty}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                  Faculty Full Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dr. Arvind Kumar"
                  value={facultyForm.fullName}
                  onChange={(e) => setFacultyForm({ ...facultyForm, fullName: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                    Username / User ID *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. arvind_cse"
                    value={facultyForm.username}
                    onChange={(e) => setFacultyForm({ ...facultyForm, username: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                    Password {editingTeacher && '(Leave blank to keep unchanged)'} *
                  </label>
                  <input
                    type="text"
                    placeholder={editingTeacher ? '••••••••' : 'Enter login password'}
                    value={facultyForm.password}
                    onChange={(e) => setFacultyForm({ ...facultyForm, password: e.target.value })}
                    required={!editingTeacher}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                  Assigned Course / Subject / Class
                </label>
                <input
                  type="text"
                  list="faculty-course-suggestions"
                  placeholder="Type course name (e.g. Data Structures, Python, CSE-A)"
                  value={facultyForm.assignedClassId}
                  onChange={(e) => setFacultyForm({ ...facultyForm, assignedClassId: e.target.value })}
                />
                <datalist id="faculty-course-suggestions">
                  {classes.map(c => (
                    <option key={c.id} value={c.name || c.id}>{c.name} ({c.id})</option>
                  ))}
                </datalist>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Manually type any course or subject name. It will be registered automatically.
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsFacultyModalOpen(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  <Check size={18} />
                  <span>{editingTeacher ? 'Update Account' : 'Create Faculty User'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DEPARTMENT MODAL */}
      {isDeptModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                {editingDept ? 'Edit Department / Class' : 'Create New Department / Class'}
              </h2>
              <button
                onClick={() => setIsDeptModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveDept}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                    Dept Code *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. IT-3B"
                    value={deptForm.id}
                    disabled={!!editingDept}
                    onChange={(e) => setDeptForm({ ...deptForm, id: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                    Department & Batch Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. B.Tech Information Tech - 3rd Year"
                    value={deptForm.name}
                    onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '24px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                    Lecture Room / Lab
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Computing Lab 3"
                    value={deptForm.room}
                    onChange={(e) => setDeptForm({ ...deptForm, room: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                    Faculty Incharge Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Dr. Jane Foster"
                    value={deptForm.teacherName}
                    onChange={(e) => setDeptForm({ ...deptForm, teacherName: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsDeptModalOpen(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  <Check size={18} />
                  <span>{editingDept ? 'Update Department' : 'Create Department'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
