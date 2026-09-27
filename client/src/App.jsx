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
        <div className="brand" onClick={() => setAdminView('dashboard')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img 
            src="/app-icon.png" 
            alt="EduTrack Logo" 
            style={{ width: '36px', height: '36px', borderRadius: '8px', boxShadow: 'var(--shadow-sm)' }} 
          />
          <div>
            <div className="brand-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>EduTrack Campus</span>
              <span style={{ fontSize: '0.65rem', background: 'var(--accent-primary)', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>v1.0</span>
            </div>
            <div className="brand-subtitle">College Attendance & Department Management</div>
          </div>
        </div>

        <div className="nav-actions">
          {/* User Info Pill */}
          <div className="user-pill">
            {user.role === 'admin' ? (
              <ShieldCheck size={16} style={{ color: '#8b5cf6' }} />
            ) : (
              <UserCheck size={16} style={{ color: '#0284c7' }} />
            )}
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {user.fullName || user.username}
            </span>
            <span className={`user-role-badge ${user.role === 'admin' ? 'badge-admin' : 'badge-teacher'}`}>
              {user.role}
            </span>
          </div>

          {/* Android APK Download Button */}
          <a
            href="/EduTrack-Attendance.apk"
            download="EduTrack-Attendance.apk"
            className="btn-secondary"
            style={{ padding: '8px 12px', fontSize: '0.82rem', gap: '6px', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.35)' }}
            title="Download Android APK File"
          >
            <Smartphone size={16} />
            <span className="hide-mobile">Get APK</span>
          </a>

          {/* Theme Toggle (Dark / Light) */}
          <ThemeToggle />

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="btn-secondary"
            style={{ padding: '8px 14px', fontSize: '0.85rem' }}
            title="Sign Out"
          >
            <LogOut size={16} />
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
