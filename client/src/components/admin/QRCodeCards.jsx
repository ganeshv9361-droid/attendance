import React, { useState, useEffect } from 'react';
import { QrCode, Printer, Download, Search, Check, Copy, Layers, ExternalLink, Sparkles } from 'lucide-react';
import BackButton from '../common/BackButton';
import { apiFetch } from '../../utils/api';

export default function QRCodeCards({ onBack }) {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [qrImages, setQrImages] = useState({});
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [selectedClass]);

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
      let url = '/api/students';
      if (selectedClass) url += `?classId=${selectedClass}`;
      const data = await apiFetch(url);
      setStudents(data);

      // Load QR code images for all students
      const images = {};
      for (const s of data) {
        try {
          const qrData = await apiFetch(`/api/students/${s.id}/qr`);
          images[s.id] = qrData.qrDataUrl;
        } catch (e) {
          console.error(`Failed to load QR for ${s.id}:`, e);
        }
      }
      setQrImages(images);
    } catch (err) {
      console.error('Failed to load students for QR:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadSingleQR = (student) => {
    const dataUrl = qrImages[student.id];
    if (!dataUrl) return;

    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `QR_${student.class_id}_${student.roll_no}_${student.name.replace(/\s+/g, '_')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyToken = (student) => {
    if (!student.qr_token) return;
    navigator.clipboard.writeText(student.qr_token);
    setCopiedId(student.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  // Filter students based on search query
  const filteredStudents = students.filter(s => {
    const q = searchQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q) ||
      String(s.roll_no).includes(q) ||
      s.class_id.toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <div className="no-print">
        <BackButton onBack={onBack} label="Back to Admin Dashboard" />
      </div>

      {/* Header & Controls */}
      <div className="card-header no-print" style={{ marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="card-title" style={{ fontSize: '1.6rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: 'var(--accent-subtle)',
              color: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <QrCode size={24} />
            </div>
            <span>Student QR Code Generator</span>
          </h1>
          <p className="card-subtitle">
            Generate and export high-resolution QR attendance codes. Print directly as attendance sheets or download individual PNG images.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button 
            onClick={handlePrint} 
            className="btn-primary"
            disabled={filteredStudents.length === 0}
            style={{ padding: '10px 18px', fontSize: '0.9rem' }}
          >
            <Printer size={18} />
            <span>Print QR Sheet ({filteredStudents.length})</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card no-print" style={{ marginBottom: '24px', padding: '16px' }}>
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: '1 1 240px', position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search by student name, USN, or roll no..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '38px', width: '100%' }}
            />
          </div>

          <div style={{ minWidth: '220px' }}>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              style={{ width: '100%' }}
            >
              <option value="">All Departments & Batches</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.id})</option>
              ))}
            </select>
          </div>

          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            Showing: <span style={{ color: 'var(--accent-primary)' }}>{filteredStudents.length}</span> QR codes
          </div>
        </div>
      </div>

      {/* QR Codes Grid */}
      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '50px', color: 'var(--text-muted)' }}>
          <QrCode size={36} className="animate-spin" style={{ margin: '0 auto 12px', opacity: 0.5 }} />
          <div>Generating QR codes for students...</div>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '50px', color: 'var(--text-muted)' }}>
          <p style={{ fontSize: '1rem', fontWeight: 600 }}>No students found.</p>
          <p style={{ fontSize: '0.85rem' }}>
            {searchQuery ? 'Try adjusting your search query.' : 'Add students in the Student Database to generate their QR codes.'}
          </p>
        </div>
      ) : (
        <div className="qr-grid-container" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: '20px'
        }}>
          {filteredStudents.map(student => (
            <div
              key={student.id}
              className="qr-item-card"
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1.5px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                boxShadow: 'var(--shadow-sm)',
                transition: 'all var(--transition-fast)'
              }}
            >
              {/* Header Label: Department + Roll */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                width: '100%',
                marginBottom: '12px',
                fontSize: '0.75rem',
                fontWeight: 700
              }}>
                <span style={{
                  backgroundColor: 'var(--accent-subtle)',
                  color: 'var(--accent-primary)',
                  padding: '2px 8px',
                  borderRadius: '4px'
                }}>
                  {student.class_id}
                </span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  Roll #{student.roll_no}
                </span>
              </div>

              {/* Clean High-Contrast QR Code Display */}
              <div style={{
                backgroundColor: '#ffffff',
                padding: '12px',
                borderRadius: '12px',
                border: '1px solid #cbd5e1',
                boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                marginBottom: '14px',
                display: 'inline-flex',
                justifyContent: 'center',
                alignItems: 'center'
              }}>
                {qrImages[student.id] ? (
                  <img
                    src={qrImages[student.id]}
                    alt={`QR Code for ${student.name}`}
                    style={{ width: '150px', height: '150px', display: 'block' }}
                  />
                ) : (
                  <div style={{ width: '150px', height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>
                    Loading QR...
                  </div>
                )}
              </div>

              {/* Student Identification Information */}
              <div style={{ width: '100%', marginBottom: '14px' }}>
                <div style={{
                  fontSize: '1rem',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  marginBottom: '2px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {student.name}
                </div>
                <div style={{
                  fontSize: '0.78rem',
                  fontFamily: 'monospace',
                  color: 'var(--text-secondary)',
                  fontWeight: 600
                }}>
                  USN: {student.id}
                </div>
              </div>

              {/* Action Buttons (Hidden when printing) */}
              <div className="no-print" style={{ display: 'flex', gap: '8px', width: '100%' }}>
                <button
                  type="button"
                  onClick={() => handleDownloadSingleQR(student)}
                  className="btn-secondary"
                  title="Download PNG image"
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    fontSize: '0.78rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                >
                  <Download size={14} />
                  <span>Download PNG</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleCopyToken(student)}
                  className="btn-secondary"
                  title="Copy QR token text"
                  style={{
                    padding: '8px 10px',
                    fontSize: '0.78rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {copiedId === student.id ? <Check size={14} style={{ color: 'var(--present-color)' }} /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Print Specific Stylesheet: Pure black & white, clean multi-column grid, no web borders */}
      <style>{`
        @media print {
          body {
            background: #ffffff !important;
            color: #000000 !important;
          }
          .no-print {
            display: none !important;
          }
          .qr-grid-container {
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 16px !important;
            page-break-inside: auto !important;
          }
          .qr-item-card {
            border: 1px dashed #94a3b8 !important;
            border-radius: 8px !important;
            padding: 14px !important;
            background: #ffffff !important;
            box-shadow: none !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>
    </div>
  );
}
