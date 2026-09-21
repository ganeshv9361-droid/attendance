import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Plus, Trash2, ShieldAlert, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import BackButton from '../common/BackButton';
import { apiFetch } from '../../utils/api';

export default function HolidayCalendar({ onBack }) {
  const [holidays, setHolidays] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [newDate, setNewDate] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  useEffect(() => {
    fetchHolidays();
  }, []);

  const fetchHolidays = async () => {
    try {
      const data = await apiFetch('/api/holidays');
      setHolidays(data);
    } catch (err) {
      console.error('Failed to load holidays:', err);
    }
  };

  const handleAddHoliday = async (e) => {
    e.preventDefault();
    if (!newDate || !newTitle) return;

    setIsSubmitting(true);
    setFeedback({ type: '', message: '' });

    try {
      await apiFetch('/api/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: newDate,
          title: newTitle,
          description: newDescription
        })
      });

      setFeedback({ type: 'success', message: 'Holiday scheduled successfully!' });
      setNewDate('');
      setNewTitle('');
      setNewDescription('');
      fetchHolidays();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteHoliday = async (id) => {
    if (!confirm('Are you sure you want to remove this holiday?')) return;
    try {
      await apiFetch(`/api/holidays/${id}`, { method: 'DELETE' });
      fetchHolidays();
    } catch (err) {
      console.error('Failed to delete holiday:', err);
    }
  };

  // Calendar rendering logic
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  const monthName = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Map holidays for fast lookup
  const holidayMap = {};
  for (const h of holidays) {
    holidayMap[h.date] = h;
  }

  return (
    <div>
      <BackButton onBack={onBack} label="Back to Admin Dashboard" />

      <div className="card-header" style={{ marginBottom: '24px' }}>
        <div>
          <h1 className="card-title" style={{ fontSize: '1.6rem' }}>
            <CalendarIcon size={28} style={{ color: 'var(--holiday-color)' }} />
            <span>School Calendar & Holidays</span>
          </h1>
          <p className="card-subtitle">
            Manage institutional holidays and calendar events. Holidays are automatically flagged on attendance records.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '24px' }}>
        {/* Left Column: Visual Monthly Calendar */}
        <div className="card">
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px'
          }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>{monthName}</h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={prevMonth} className="btn-secondary" style={{ padding: '6px 12px' }}>
                <ChevronLeft size={16} />
              </button>
              <button onClick={nextMonth} className="btn-secondary" style={{ padding: '6px 12px' }}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Days of week header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            textAlign: 'center',
            fontWeight: 700,
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
            marginBottom: '10px'
          }}>
            <span style={{ color: 'var(--absent-color)' }}>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>

          {/* Calendar Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '6px'
          }}>
            {/* Empty slots for days before 1st of month */}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} style={{ minHeight: '64px', opacity: 0.2 }} />
            ))}

            {/* Days of the current month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const isToday = new Date().toISOString().split('T')[0] === dateStr;
              const isSunday = new Date(year, month, dayNum).getDay() === 0;
              const holiday = holidayMap[dateStr];

              return (
                <div
                  key={dateStr}
                  style={{
                    minHeight: '68px',
                    padding: '6px',
                    borderRadius: 'var(--radius-sm)',
                    border: isToday ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                    backgroundColor: holiday 
                      ? 'var(--holiday-bg)' 
                      : isSunday 
                        ? 'var(--bg-card-subtle)' 
                        : 'var(--bg-card)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span style={{
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      color: isSunday ? 'var(--absent-color)' : 'var(--text-primary)'
                    }}>
                      {dayNum}
                    </span>
                    {isToday && (
                      <span style={{
                        fontSize: '0.65rem',
                        backgroundColor: 'var(--accent-primary)',
                        color: '#fff',
                        padding: '1px 4px',
                        borderRadius: '3px'
                      }}>
                        Today
                      </span>
                    )}
                  </div>

                  {holiday && (
                    <div
                      title={`${holiday.title} - ${holiday.description}`}
                      style={{
                        backgroundColor: 'var(--holiday-color)',
                        color: '#ffffff',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        padding: '2px 4px',
                        borderRadius: '3px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        marginTop: '4px'
                      }}
                    >
                      {holiday.title}
                    </div>
                  )}

                  {isSunday && !holiday && (
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Weekend</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Add Holiday & Scheduled List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Add Holiday Form */}
          <div className="card">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plus size={18} style={{ color: 'var(--accent-primary)' }} />
              <span>Schedule New Holiday</span>
            </h3>

            {feedback.message && (
              <div style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                marginBottom: '14px',
                fontSize: '0.85rem',
                backgroundColor: feedback.type === 'success' ? 'var(--present-bg)' : 'var(--absent-bg)',
                color: feedback.type === 'success' ? 'var(--present-color)' : 'var(--absent-color)',
                border: `1px solid ${feedback.type === 'success' ? 'var(--present-border)' : 'var(--absent-border)'}`
              }}>
                {feedback.message}
              </div>
            )}

            <form onSubmit={handleAddHoliday}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                  Holiday Date
                </label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                  Holiday Title / Occasion
                </label>
                <input
                  type="text"
                  placeholder="e.g. Founders Day / Annual Sports Meet"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                  Description (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. School Closed - Special Event"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary"
                style={{ width: '100%' }}
              >
                <Plus size={16} />
                <span>{isSubmitting ? 'Saving...' : 'Add to School Calendar'}</span>
              </button>
            </form>
          </div>

          {/* Holiday List */}
          <div className="card" style={{ maxHeight: '350px', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px' }}>
              All Scheduled Holidays ({holidays.length})
            </h3>
            {holidays.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No holidays added yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {holidays.map(h => (
                  <div
                    key={h.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      backgroundColor: 'var(--bg-card-subtle)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{h.title}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        <span style={{ fontWeight: 600, color: 'var(--holiday-color)' }}>{h.date}</span>
                        {h.description && ` • ${h.description}`}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteHoliday(h.id)}
                      className="btn-outline-danger"
                      style={{ padding: '6px' }}
                      title="Delete Holiday"
                    >
                      <Trash2 size={14} />
                    </button>
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
