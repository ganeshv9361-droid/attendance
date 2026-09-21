import React, { useState } from 'react';
import { 
  School, ShieldCheck, UserCheck, Lock, User, Eye, EyeOff, Sparkles, 
  ArrowRight, QrCode, FileSpreadsheet, Clock, Wifi, Settings, CheckCircle2, AlertCircle 
} from 'lucide-react';
import ThemeToggle from './common/ThemeToggle';
import { apiFetch, getApiBaseUrl, setApiBaseUrl, DEFAULT_SERVER_URL } from '../utils/api';

export default function Login({ onLoginSuccess }) {
  const [activeTab, setActiveTab] = useState('teacher'); // 'teacher' or 'admin'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Server URL settings for Mobile APK / Remote access
  const [serverUrl, setServerUrlState] = useState(() => getApiBaseUrl() || DEFAULT_SERVER_URL);
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [pingStatus, setPingStatus] = useState(null); // 'testing', 'success', 'failed'

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setError('');
  };

  const handleSaveServerUrl = (newUrl) => {
    setServerUrlState(newUrl);
    setApiBaseUrl(newUrl);
  };

  const testServerConnection = async () => {
    setPingStatus('testing');
    try {
      const data = await apiFetch('/api/classes');
      if (Array.isArray(data)) {
        setPingStatus('success');
      } else {
        setPingStatus('failed');
      }
    } catch (e) {
      console.error('Ping failed:', e);
      setPingStatus('failed');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Save server URL if altered
    setApiBaseUrl(serverUrl);

    try {
      const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          role: activeTab
        })
      });

      onLoginSuccess(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'radial-gradient(circle at 50% 20%, var(--bg-secondary) 0%, var(--bg-primary) 100%)',
      padding: '20px'
    }}>
      {/* Top Navbar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        maxWidth: '1200px',
        width: '100%',
        margin: '0 auto',
        padding: '10px 0 20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img 
            src="/app-icon.png" 
            alt="EduTrack Logo" 
            style={{ width: '40px', height: '40px', borderRadius: '10px', boxShadow: 'var(--shadow-sm)' }} 
          />
          <div>
            <div className="brand-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>EduTrack Campus</span>
              <span style={{ fontSize: '0.65rem', background: 'var(--accent-primary)', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>v1.0</span>
            </div>
            <div className="brand-subtitle">College Attendance & Student Management</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => setShowServerConfig(!showServerConfig)}
            className="btn-secondary"
            style={{ padding: '8px 12px', fontSize: '0.8rem' }}
            title="Configure Backend Server IP / URL for Mobile APK"
          >
            <Wifi size={16} />
            <span className="hide-mobile">Server Config</span>
          </button>
          <ThemeToggle />
        </div>
      </div>

      {/* Server URL Config Banner (Crucial for Mobile APK Connection) */}
      {showServerConfig && (
        <div style={{
          maxWidth: '460px',
          width: '100%',
          margin: '0 auto 16px',
          padding: '16px',
          backgroundColor: 'var(--bg-card)',
          border: '1.5px solid var(--accent-primary)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-lg)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Settings size={16} style={{ color: 'var(--accent-primary)' }} />
              Backend Server Connection (Mobile APK)
            </span>
            <button onClick={() => setShowServerConfig(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)' }}>
              ✕
            </button>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>
            Enter your computer's local Wi-Fi IP address so the mobile app can reach the backend server:
          </p>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <input
              type="text"
              value={serverUrl}
              onChange={(e) => handleSaveServerUrl(e.target.value)}
              placeholder="http://10.138.117.168:5000"
              style={{ fontSize: '0.85rem', padding: '8px 10px' }}
            />
            <button onClick={testServerConnection} className="btn-secondary" style={{ padding: '8px 14px', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
              Test
            </button>
          </div>
          {pingStatus === 'testing' && <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Connecting to server...</span>}
          {pingStatus === 'success' && (
            <span style={{ fontSize: '0.78rem', color: 'var(--present-color)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle2 size={14} /> Connected successfully to EduTrack server!
            </span>
          )}
          {pingStatus === 'failed' && (
            <span style={{ fontSize: '0.78rem', color: 'var(--absent-color)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <AlertCircle size={14} /> Connection failed. Check Wi-Fi & IP.
            </span>
          )}
        </div>
      )}

      {/* Main Login Card Container */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '10px'
      }}>
        <div style={{
          maxWidth: '460px',
          width: '100%',
          backgroundColor: 'var(--bg-card)',
          border: '1.5px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-xl)',
          overflow: 'hidden'
        }}>
          {/* Header Banner */}
          <div style={{
            background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
            padding: '28px 24px',
            color: '#ffffff',
            textAlign: 'center',
            position: 'relative'
          }}>
            <div style={{
              width: '54px',
              height: '54px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.3)'
            }}>
              {activeTab === 'admin' ? <ShieldCheck size={30} /> : <UserCheck size={30} />}
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '4px' }}>
              {activeTab === 'admin' ? 'Dean & Academic Admin Portal' : 'Faculty & Professor Station'}
            </h2>
            <p style={{ fontSize: '0.85rem', opacity: 0.9 }}>
              {activeTab === 'admin' 
                ? 'Manage college departments, faculty user IDs & master reports' 
                : 'QR camera attendance & roll call for lectures and labs'}
            </p>
          </div>

          {/* Role Tabs */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            borderBottom: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-card-subtle)'
          }}>
            <button
              type="button"
              onClick={() => handleTabChange('teacher')}
              style={{
                padding: '14px',
                background: activeTab === 'teacher' ? 'var(--bg-card)' : 'transparent',
                color: activeTab === 'teacher' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                borderBottom: activeTab === 'teacher' ? '3px solid var(--accent-primary)' : '3px solid transparent',
                borderRadius: 0,
                fontWeight: 700,
                fontSize: '0.9rem'
              }}
            >
              <UserCheck size={18} />
              <span>Faculty / Professor</span>
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('admin')}
              style={{
                padding: '14px',
                background: activeTab === 'admin' ? 'var(--bg-card)' : 'transparent',
                color: activeTab === 'admin' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                borderBottom: activeTab === 'admin' ? '3px solid var(--accent-primary)' : '3px solid transparent',
                borderRadius: 0,
                fontWeight: 700,
                fontSize: '0.9rem'
              }}
            >
              <ShieldCheck size={18} />
              <span>Dean / Admin</span>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ padding: '28px 24px' }}>
            {error && (
              <div style={{
                backgroundColor: 'var(--absent-bg)',
                color: 'var(--absent-color)',
                border: '1px solid var(--absent-border)',
                padding: '12px 14px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.85rem',
                marginBottom: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                  <AlertCircle size={18} />
                  <span>Connection / Login Notice</span>
                </div>
                <div>{error}</div>
                {error.includes('Cannot reach backend server') && (
                  <button
                    type="button"
                    onClick={() => setShowServerConfig(true)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--accent-primary)',
                      textAlign: 'left',
                      padding: 0,
                      fontWeight: 700,
                      textDecoration: 'underline',
                      cursor: 'pointer',
                      marginTop: '4px'
                    }}
                  >
                    Click here to check/update Server Wi-Fi IP
                  </button>
                )}
              </div>
            )}

            {/* Username */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{
                display: 'block',
                fontSize: '0.82rem',
                fontWeight: 700,
                color: 'var(--text-secondary)',
                marginBottom: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                User ID / Username
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter User ID"
                  required
                  style={{ paddingLeft: '40px' }}
                />
                <User size={18} style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)'
                }} />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: '22px' }}>
              <label style={{
                display: 'block',
                fontSize: '0.82rem',
                fontWeight: 700,
                color: 'var(--text-secondary)',
                marginBottom: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                  style={{ paddingLeft: '40px', paddingRight: '40px' }}
                />
                <Lock size={18} style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)'
                }} />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    color: 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary"
              style={{ width: '100%', padding: '12px', fontSize: '1rem' }}
            >
              {isLoading ? 'Verifying...' : (
                <>
                  <span>Sign In as {activeTab === 'admin' ? 'Dean / Admin' : 'Faculty'}</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>

          </form>

          {/* System Highlights Footer */}
          <div style={{
            backgroundColor: 'var(--bg-card-subtle)',
            borderTop: '1px solid var(--border-color)',
            padding: '12px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.75rem',
            color: 'var(--text-secondary)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <QrCode size={14} style={{ color: 'var(--accent-primary)' }} />
              <span>Camera QR</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={14} style={{ color: '#10b981' }} />
              <span>12:10 PM Sessions</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileSpreadsheet size={14} style={{ color: '#059669' }} />
              <span>Multi-Class Excel</span>
            </div>
            <div style={{
              fontWeight: 800,
              fontSize: '0.7rem',
              color: 'var(--accent-primary)',
              backgroundColor: 'var(--accent-subtle)',
              padding: '2px 6px',
              borderRadius: '4px'
            }}>
              v1.0
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
