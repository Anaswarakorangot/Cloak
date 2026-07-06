import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { DocumentAnalysisResult } from '@shared/types';
import { ShieldCheck, ShieldAlert, Eye, Layout, Loader2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { jsPDF } from 'jspdf';
import { ExposureMeter } from './ExposureMeter';
import { FinalExportModal } from './FinalExportModal';

interface Props {
  document: DocumentAnalysisResult | null;
  reviewMode: boolean;
  onToggleReviewMode: () => void;
  startTime: number;
  fileName?: string;
  onAddRedaction?: (start: number, end: number, text: string, type: any) => void;
  totalExposureScore?: number;
}

export function ControlPanel({ document, reviewMode, onToggleReviewMode, startTime, fileName = 'document', onAddRedaction, totalExposureScore = 0 }: Props) {
  const [showSpeedBump, setShowSpeedBump] = useState(false);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualText, setManualText] = useState('');
  const [manualType, setManualType] = useState('NAME');
  const [rememberTerm, setRememberTerm] = useState(false);
  const [exported, setExported] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const { token } = useAuth();

  const lowConfidenceUnreviewed = document?.spans.filter(s => s.confidence < 0.7 && !s.suggested_redaction).length || 0;
  
  const handleExportClick = () => {
    const timeOpen = Date.now() - startTime;
    if (lowConfidenceUnreviewed > 0 || timeOpen < 5000) {
      setShowSpeedBump(true);
    } else {
      doExport();
    }
  };

  const [exportFormat, setExportFormat] = useState<'txt' | 'doc' | 'pdf'>('txt');
  const [exportName, setExportName] = useState(fileName.replace(/\.[^/.]+$/, ''));

  const doExport = async () => {
    setShowSpeedBump(false);
    setIsExporting(false); // Close the speed bump if open
    
    // Compute clusters
    const clusters = new Map<string, number>();
    const typeCounters = new Map<string, number>();
    if (document) {
      document.spans.forEach(span => {
        if (span.suggested_redaction) {
          const key = `${span.type}-${span.text.toLowerCase()}`;
          if (!clusters.has(key)) {
            const count = (typeCounters.get(span.type) || 0) + 1;
            typeCounters.set(span.type, count);
            clusters.set(key, count);
          }
        }
      });
    }

    if (exportFormat === 'pdf') {
      setIsExporting(true);

      const isPdf = fileName.toLowerCase().endsWith('.pdf');
      const isImg = fileName.toLowerCase().match(/\.(png|jpg|jpeg)$/);

      if ((isPdf || isImg) && document?.document_id) {
        try {
          const endpoint = isImg ? 'http://localhost:8000/api/export-image' : 'http://localhost:8000/api/export-pdf';
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('cloak_token')}`
            },
            body: JSON.stringify(document)
          });
          
          if (!response.ok) throw new Error("Failed to export native file");
          
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = window.document.createElement('a');
          a.href = url;
          const ext = isImg ? fileName.split('.').pop() : 'pdf';
          a.download = `redacted_${exportName || 'document'}.${ext}`;
          window.document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          a.remove();
          
          setIsExporting(false);
          setExported(true);
          setShowSummary(true);
          setTimeout(() => setExported(false), 3000);
          return;
        } catch (err) {
          console.error("Native export failed, falling back to HTML export", err);
        }
      }
      const doc = new jsPDF({
        orientation: 'p',
        unit: 'pt',
        format: 'letter'
      });
      
      let htmlText = document?.text || '';
      const sortedSpans = [...(document?.spans || [])]
        .filter(s => s.suggested_redaction)
        .sort((a, b) => b.start - a.start);
      
      for (const span of sortedSpans) {
        htmlText = htmlText.slice(0, span.start) + 
          `<span style="background-color: black; color: black; border-radius: 2px;">${'X'.repeat(span.text.length)}</span>` + 
          htmlText.slice(span.end);
      }

      const element = window.document.createElement('div');
      element.style.width = '600px';
      element.style.padding = '40px';
      element.style.fontFamily = 'Helvetica, Arial, sans-serif';
      element.style.fontSize = '14px';
      element.style.whiteSpace = 'pre-wrap';
      element.style.lineHeight = '1.6';
      element.style.color = '#000000';
      element.style.backgroundColor = '#ffffff';
      element.innerHTML = htmlText;
      
      // Temporarily add to DOM so html2canvas can read it
      element.style.position = 'fixed';
      element.style.left = '0';
      element.style.top = '0';
      element.style.zIndex = '-9999';
      window.document.body.appendChild(element);

      doc.html(element, {
        callback: function (doc) {
          doc.save(`${exportName || 'document'}.pdf`);
          window.document.body.removeChild(element);
          setIsExporting(false);
          setExported(true);
          setShowSummary(true);
          setTimeout(() => setExported(false), 3000);
        },
        x: 0,
        y: 0,
        width: 600,
        windowWidth: 600
      });
      
      return;
    }

    let plainText = document?.text || '';
    const sortedSpans = [...(document?.spans || [])]
      .filter(s => s.suggested_redaction)
      .sort((a, b) => b.start - a.start);
    
    for (const span of sortedSpans) {
      const key = `${span.type}-${span.text.toLowerCase()}`;
      const clusterId = clusters.get(key);
      const label = `[${span.type}${clusterId ? ` ${clusterId}` : ''}]`;
      plainText = plainText.slice(0, span.start) + label + plainText.slice(span.end);
    }

    let fileContent = plainText;
    let mimeType = 'text/plain';
    
    if (exportFormat === 'doc') {
      const htmlText = plainText.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>');
      fileContent = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset='utf-8'><title>${exportName}</title></head>
<body style="font-family: Arial, sans-serif; font-size: 12pt; color: #000;">
${htmlText}
</body>
</html>`;
      mimeType = 'application/msword;charset=utf-8';
    }
    
    // Add UTF-8 BOM (\ufeff) to ensure Word parses characters correctly
    const blob = new Blob(['\ufeff', fileContent], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `${exportName || 'document'}.${exportFormat}`;
    window.document.body.appendChild(a);
    
    // Slight delay before cleanup prevents strict browsers from aborting the download
    setTimeout(() => {
        a.click();
        setTimeout(() => {
            window.URL.revokeObjectURL(url);
            a.remove();
        }, 1000);
    }, 100);
    
    setExported(true);
    setShowSummary(true);
    setTimeout(() => setExported(false), 3000);
  };

  const generateCertificate = () => {
    if (!document) return;
    
    const redactedSpans = document.spans.filter(s => s.suggested_redaction);
    const byType = redactedSpans.reduce((acc, s) => {
      acc[s.type] = (acc[s.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const certContent = `
==================================================
        CLOAK REDACTION CERTIFICATE
==================================================
Date: ${new Date().toLocaleString()}
Document ID: ${fileName || 'Unnamed Document'}
Document Type: ${document.classification || 'GENERAL'}

--- REDACTION SUMMARY ---
Total Exposures Masked: ${redactedSpans.length}
Unresolved Risks Ignored/Exported: ${lowConfidenceUnreviewed}

--- ENTITIES REDACTED ---
${Object.entries(byType).map(([type, count]) => `${type.padEnd(15)} : ${count}`).join('\n')}

--- ENGINES UTILIZED ---
- Local Presidio/Regex Engine (Offline Structured Data)
- Gemini Contextual AI Hybrid Engine

This certificate proves that the document was successfully processed 
by the Cloak platform. All structured data was secured locally.
==================================================
`;
    
    const blob = new Blob([certContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `${exportName || 'document'}_Redaction_Certificate.txt`;
    window.document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
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

        {reviewMode && onAddRedaction && (
          <button 
            type="button"
            onClick={() => setShowManualAdd(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 border border-indigo-500/30 rounded-lg text-sm font-semibold text-indigo-300 hover:bg-indigo-500/20 hover:text-indigo-200 transition-all shadow-inner"
          >
            <ShieldAlert size={16} />
            Manual Redact
          </button>
        )}
        
        {reviewMode && lowConfidenceUnreviewed > 0 && (
          <div className="flex items-center text-amber-400 text-sm font-semibold gap-2 bg-amber-500/10 px-4 py-2 rounded-lg border border-amber-500/20 shadow-inner">
            <ShieldAlert size={16} className="animate-pulse" />
            <span>{lowConfidenceUnreviewed} uncertain areas</span>
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-4">
        <ExposureMeter score={totalExposureScore} />
      </div>

      <div className="relative">
        <button 
          onClick={() => setShowExportModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg font-bold text-sm transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)] hover:shadow-[0_0_25px_rgba(79,70,229,0.5)] active:scale-[0.98] disabled:opacity-70"
        >
          <ShieldCheck size={18} />
          {exported ? 'Exported Successfully!' : 'Export Safe Document'}
        </button>

        {showManualAdd && createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-96 bg-[#0a0a0a]/95 backdrop-blur-3xl rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10 p-8 ring-1 ring-white/5 animate-in zoom-in-95 duration-200">
              <h4 className="font-bold text-slate-100 mb-6 text-xl flex items-center gap-2">
                <ShieldAlert className="text-indigo-400" size={20} /> Add Manual Redaction
              </h4>
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">Text to Redact</label>
                  <input 
                    type="text" 
                    placeholder="e.g. John Doe"
                    value={manualText}
                    onChange={e => setManualText(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/10 rounded-lg shadow-inner px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">Category</label>
                  <select 
                    value={manualType}
                    onChange={e => setManualType(e.target.value)}
                    className="w-full bg-[#111] border border-white/10 rounded-lg shadow-inner px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
                  >
                    <option value="NAME">NAME</option>
                    <option value="PHONE">PHONE</option>
                    <option value="EMAIL">EMAIL</option>
                    <option value="SSN">SSN</option>
                    <option value="CUSTOM">CUSTOM (Custom Rule)</option>
                  </select>
                </div>
                
                <label className="flex items-center gap-2 mt-4 text-sm text-slate-300">
                  <input type="checkbox" checked={rememberTerm} onChange={e => setRememberTerm(e.target.checked)} className="rounded bg-slate-800 border-white/10" />
                  Always redact this term in future documents
                </label>
              </div>
              
              <div className="flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setShowManualAdd(false)}
                  className="px-5 py-2.5 text-sm font-bold text-slate-300 hover:text-white transition-colors rounded-lg hover:bg-white/5"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  disabled={!manualText.trim()}
                  onClick={async () => {
                    if (onAddRedaction && manualText.trim()) {
                      onAddRedaction(0, 0, manualText.trim(), manualType as any);
                      
                      if (rememberTerm) {
                        try {
                          await fetch('http://localhost:8000/api/rules', {
                            method: 'POST',
                            headers: { 
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({
                              name: `Auto-Memory: ${manualText.trim()}`,
                              pattern: manualText.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), // escape regex
                              entity_type: manualType
                            })
                          });
                        } catch (err) {
                          console.error("Failed to save custom rule", err);
                        }
                      }
                      
                      setManualText('');
                      setRememberTerm(false);
                      setShowManualAdd(false);
                    }
                  }}
                  className="px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 shadow-lg shadow-indigo-500/20 border border-white/10 rounded-lg transition-colors disabled:opacity-50"
                >
                  Redact All Matches
                </button>
              </div>
            </div>
          </div>,
          window.document.body
        )}

        {showExportModal && (
          <FinalExportModal 
            isOpen={showExportModal} 
            onClose={() => setShowExportModal(false)}
            spans={document?.spans ?? []}
            documentText={document?.text ?? ''}
            fileName={fileName}
          />
        )}

        {showSummary && createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-96 bg-[#0a0a0a]/95 backdrop-blur-3xl rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10 p-8 ring-1 ring-white/5 animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 mb-4 mx-auto">
                <CheckCircle2 className="text-emerald-400" size={24} />
              </div>
              <h4 className="font-bold text-slate-100 mb-2 text-xl text-center">Export Complete</h4>
              <p className="text-center text-slate-400 text-sm mb-6">Risk-Framed Summary</p>
              
              <div className="space-y-3 mb-6 bg-slate-900/50 rounded-xl p-4 border border-white/5">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-300">Exposures Caught & Masked</span>
                  <span className="text-sm font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded">
                    {document?.spans.filter(s => s.suggested_redaction).length || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-300">Unresolved Risks Exported</span>
                  <span className={`text-sm font-bold px-2 py-0.5 rounded ${
                    lowConfidenceUnreviewed > 0 ? 'text-rose-400 bg-rose-400/10' : 'text-slate-400 bg-slate-800'
                  }`}>
                    {lowConfidenceUnreviewed}
                  </span>
                </div>
              </div>
              
              <div className="flex gap-2">
                <button 
                  type="button"
                  onClick={generateCertificate}
                  className="flex-1 px-3 py-2.5 text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 shadow-md border border-slate-700 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <ShieldAlert size={14} /> Certificate
                </button>
                <button 
                  type="button"
                  onClick={() => setShowSummary(false)}
                  className="flex-1 px-3 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-500/20 rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          window.document.body
        )}
      </div>
    </div>
  );
}
