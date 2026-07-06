import React, { useState, useEffect } from 'react';
import { PIISpan } from '@shared/types';
import { X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (format: 'txt' | 'doc' | 'pdf') => void;
  spans: PIISpan[];
  documentText?: string;
  fileName?: string;
}

export function FinalExportModal({ isOpen, onClose, onConfirm, spans }: Props) {
  const [state, setState] = useState<'scanning' | 'issues' | 'clear'>('scanning');

  const dismissedHighRisk = spans.filter(s =>
    s.status === 'KEPT_VISIBLE' && (s.risk_score ?? 0) > 0.4
  ).length;
  const caughtCount = spans.filter(s =>
    s.suggested_redaction || s.status === 'REDACTED'
  ).length;

  useEffect(() => {
    if (!isOpen) { setState('scanning'); return; }
    const t = setTimeout(() => setState(dismissedHighRisk > 0 ? 'issues' : 'clear'), 2200);
    return () => clearTimeout(t);
  }, [isOpen, dismissedHighRisk]);

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-[#111111] border border-neutral-700 rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl relative">
        <button 
          onClick={onClose}
          className="absolute -top-3 -right-3 w-8 h-8 flex items-center justify-center bg-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-700 rounded-full border border-neutral-600 transition-all shadow-lg z-50"
          title="Close"
        >
          <X size={16} />
        </button>

        {state === 'scanning' && (
          <div className="text-center">
            <div className="w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h2 className="text-white text-xl font-bold">Running Final Safety Sweep</h2>
            <p className="text-neutral-400 text-sm mt-2">Checking for uncaught PII before export...</p>
          </div>
        )}

        {state === 'clear' && (
          <div className="text-center">
            <div className="text-5xl mb-3">✅</div>
            <h2 className="text-white text-xl font-bold mb-5">All Clear — Safe to Export</h2>
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-green-950/30 border border-green-700/30 rounded-lg p-4">
                <p className="text-green-400 text-3xl font-bold">{caughtCount}</p>
                <p className="text-neutral-400 text-xs mt-1">Exposures Caught</p>
              </div>
              <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-4">
                <p className="text-green-400 text-3xl font-bold">0</p>
                <p className="text-neutral-400 text-xs mt-1">Exposures Missed</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { onConfirm('pdf'); onClose(); }} className="flex-1 bg-white text-black font-bold py-3 rounded-lg hover:bg-neutral-200 transition-colors">PDF</button>
              <button onClick={() => { onConfirm('doc'); onClose(); }} className="flex-1 bg-white text-black font-bold py-3 rounded-lg hover:bg-neutral-200 transition-colors">DOC</button>
              <button onClick={() => { onConfirm('txt'); onClose(); }} className="flex-1 bg-white text-black font-bold py-3 rounded-lg hover:bg-neutral-200 transition-colors">TXT</button>
            </div>
          </div>
        )}

        {state === 'issues' && (
          <div className="text-center">
            <div className="text-5xl mb-3">⚠️</div>
            <h2 className="text-white text-xl font-bold mb-2">Wait — Review Needed</h2>
            <p className="text-neutral-400 text-sm mb-5">
              You dismissed <span className="text-red-400 font-bold">{dismissedHighRisk} high-risk item(s)</span> without redacting them.
              These may still contain PII.
            </p>
            <div className="flex gap-2 mt-4">
              <button onClick={onClose}
                className="flex-1 border border-neutral-600 text-white py-2.5 rounded-lg hover:bg-neutral-800 transition-colors">
                ← Go Back & Review
              </button>
            </div>
            <div className="flex gap-2 mt-2">
              <button onClick={() => { onConfirm('pdf'); onClose(); }} className="flex-1 bg-red-900/80 text-white font-bold py-2.5 rounded-lg hover:bg-red-800 transition-colors">Export PDF</button>
              <button onClick={() => { onConfirm('doc'); onClose(); }} className="flex-1 bg-red-900/80 text-white font-bold py-2.5 rounded-lg hover:bg-red-800 transition-colors">Export DOC</button>
              <button onClick={() => { onConfirm('txt'); onClose(); }} className="flex-1 bg-red-900/80 text-white font-bold py-2.5 rounded-lg hover:bg-red-800 transition-colors">Export TXT</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
