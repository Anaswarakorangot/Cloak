import React, { useState } from 'react';
import { DocumentAnalysisResult } from '@shared/types';
import { ShieldCheck, ShieldAlert, Eye, Layout, Loader2, CheckCircle2 } from 'lucide-react';

interface Props {
  document: DocumentAnalysisResult | null;
  reviewMode: boolean;
  onToggleReviewMode: () => void;
  timeOpen: number;
  fileName?: string;
}

export function ControlPanel({ document, reviewMode, onToggleReviewMode, timeOpen, fileName = 'document' }: Props) {
  const [showSpeedBump, setShowSpeedBump] = useState(false);
  const [exported, setExported] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const lowConfidenceUnreviewed = document?.spans.filter(s => s.confidence < 0.7 && !s.suggested_redaction).length || 0;
  
  const handleExportClick = () => {
    if (lowConfidenceUnreviewed > 0 || timeOpen < 5000) {
      setShowSpeedBump(true);
    } else {
      doExport();
    }
  };

  const doExport = async () => {
    setShowSpeedBump(false);
    setIsExporting(true);
    
    try {
      const response = await fetch('http://localhost:8000/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(document),
      });
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      const baseName = fileName.replace(/\.[^/.]+$/, '');
      a.download = `${baseName}-redacted.txt`;
      window.document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      
      setExported(true);
      setTimeout(() => setExported(false), 3000);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex items-center justify-between bg-slate-900/60 p-5 border-b border-slate-800/60 rounded-t-xl backdrop-blur-md">
      <div className="flex items-center space-x-4">
        <button 
          onClick={onToggleReviewMode}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800/80 border border-slate-700/50 rounded-lg text-sm font-semibold text-slate-300 hover:bg-slate-700 hover:text-white hover:border-slate-600 transition-all shadow-inner"
        >
          {reviewMode ? <Eye size={16} className="text-indigo-400" /> : <Layout size={16} className="text-indigo-400" />}
          {reviewMode ? 'Preview Final' : 'Back to Review'}
        </button>
        
        {reviewMode && lowConfidenceUnreviewed > 0 && (
          <div className="flex items-center text-amber-400 text-sm font-semibold gap-2 bg-amber-500/10 px-4 py-2 rounded-lg border border-amber-500/20 shadow-inner">
            <ShieldAlert size={16} className="animate-pulse" />
            <span>{lowConfidenceUnreviewed} uncertain areas</span>
          </div>
        )}
      </div>

      <div className="relative">
        <button 
          onClick={handleExportClick}
          disabled={isExporting}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg font-bold text-sm transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)] hover:shadow-[0_0_25px_rgba(79,70,229,0.5)] active:scale-[0.98] disabled:opacity-70"
        >
          {isExporting ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
          {exported ? 'Exported Successfully!' : isExporting ? 'Exporting...' : 'Export Safe Document'}
        </button>

        {showSpeedBump && (
          <div className="absolute right-0 top-full mt-4 w-96 bg-slate-900/95 backdrop-blur-xl rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-slate-700/50 p-6 z-50 ring-1 ring-white/10">
            <h4 className="font-bold text-slate-100 mb-3 flex items-center gap-2 text-lg">
              <ShieldAlert className="text-amber-500" size={20} /> Wait, are you sure?
            </h4>
            <p className="text-sm text-slate-300 mb-6 leading-relaxed">
              {lowConfidenceUnreviewed > 0 
                ? `You have ${lowConfidenceUnreviewed} highlighted areas you haven't reviewed yet. Automation bias is real—take a second look.` 
                : "You reviewed that very quickly. Did you double check for missed PII?"}
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowSpeedBump(false)}
                className="px-4 py-2 text-sm font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700 hover:border-slate-600"
              >
                Keep Reviewing
              </button>
              <button 
                onClick={doExport}
                className="px-4 py-2 text-sm font-bold text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 hover:text-rose-200 rounded-lg transition-colors border border-rose-500/20 hover:border-rose-500/40"
              >
                Export Anyway
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
