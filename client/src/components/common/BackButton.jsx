import React from 'react';
import { ArrowLeft } from 'lucide-react';

export default function BackButton({ onBack, label = 'Back to Dashboard' }) {
  return (
    <div className="back-button-container no-print">
      <button onClick={onBack} className="btn-back">
        <ArrowLeft size={18} />
        <span>{label}</span>
      </button>
    </div>
  );
}
