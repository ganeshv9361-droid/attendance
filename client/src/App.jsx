import React, { useState, useEffect } from 'react';
import { School, LogOut, ShieldCheck, UserCheck, Smartphone } from 'lucide-react';
import Login from './components/Login';
import ThemeToggle from './components/common/ThemeToggle';
import AdminDashboard from './components/admin/AdminDashboard';
import StudentDatabase from './components/admin/StudentDatabase';
import QRCodeCards from './components/admin/QRCodeCards';
import HolidayCalendar from './components/admin/HolidayCalendar';
import FacultyManager from './components/admin/FacultyManager';
import TeacherDashboard from './components/teacher/TeacherDashboard';

export default function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('edutrack_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [adminView, setAdminView] = useState('dashboard'); // 'dashboard', 'students', 'qr-cards', 'calendar'

  useEffect(() => {
    if (user) {
      localStorage.setItem('edutrack_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('edutrack_user');
    }
  }, [user]);

  const handleLogout = () => {
    setUser(null);
    setAdminView('dashboard');
  };

  if (!user) {
    return <Login onLoginSuccess={(u) => setUser(u)} />;
  }

  return (
    <div className="app-container">
      {/* Universal Top Navigation */}
      <header className="navbar no-print">
        <div className="brand" onClick={() => setAdminView('dashboard')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
          <img 
            src="/app-icon.png" 
            alt="EduTrack Logo" 
            style={{ width: '32px', height: '32px', borderRadius: '8px', boxShadow: 'var(--shadow-sm)', flexShrink: 0 }} 
          />
          <div style={{ minWidth: 0 }}>
            <div className="brand-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>EduTrack</span>
              <span className="hide-mobile" style={{ fontSize: '0.65rem', background: 'var(--accent-primary)', color: '#fff', padding: '2px 5px', borderRadius: '4px', fontWeight: 800, flexShrink: 0 }}>v1.0</span>
            </div>
            <div className="brand-subtitle">Attendance &amp; Management</div>
          </div>
        </div>

        <div className="nav-actions">
          {/* User Info Pill */}
          <div className="user-pill">
            {user.role === 'admin' ? (
              <ShieldCheck size={14} style={{ color: '#8b5cf6', flexShrink: 0 }} />
            ) : (
              <UserCheck size={14} style={{ color: '#0284c7', flexShrink: 0 }} />
            )}
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.fullName || user.username}
            </span>
            <span className={`user-role-badge ${user.role === 'admin' ? 'badge-admin' : 'badge-teacher'}`}>
              {user.role}
            </span>
          </div>

          {/* Android APK Download Button - hide on small mobile */}
          <a
            href="/EduTrack-Attendance.apk"
            download="EduTrack-Attendance.apk"
            className="btn-secondary hide-mobile"
            style={{ padding: '6px 10px', fontSize: '0.78rem', gap: '4px', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.35)' }}
            title="Download Android APK File"
          >
            <Smartphone size={14} />
            <span>APK</span>
          </a>

          {/* Theme Toggle (Dark / Light) */}
          <ThemeToggle />

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="btn-secondary"
            style={{ padding: '6px 10px', fontSize: '0.82rem' }}
            title="Sign Out"
          >
            <LogOut size={15} />
            <span className="hide-mobile">Logout</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="main-content">
        {user.role === 'admin' ? (
          <>
            {adminView === 'dashboard' && (
              <AdminDashboard onNavigate={(view) => setAdminView(view)} />
            )}
            {adminView === 'students' && (
              <StudentDatabase
                onBack={() => setAdminView('dashboard')}
                onNavigateToQRCards={() => setAdminView('qr-cards')}
              />
            )}
            {adminView === 'qr-cards' && (
              <QRCodeCards onBack={() => setAdminView('dashboard')} />
            )}
            {adminView === 'calendar' && (
              <HolidayCalendar onBack={() => setAdminView('dashboard')} />
            )}
            {adminView === 'faculty' && (
              <FacultyManager onBack={() => setAdminView('dashboard')} />
            )}
          </>
        ) : (
          /* Teacher / User Portal */
          <TeacherDashboard
            user={user}
            onBack={() => {}}
            onLogout={handleLogout}
          />
        )}
      </main>
    </div>
  );
}
