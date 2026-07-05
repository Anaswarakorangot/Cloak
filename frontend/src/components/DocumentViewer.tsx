import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { RedactionBadge } from './RedactionBadge';
import { ControlPanel } from './ControlPanel';
import { PIIType, DocumentAnalysisResult } from '@shared/types';
import { cn } from '../lib/utils';
import * as Popover from '@radix-ui/react-popover';
import { Info, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DocumentViewerProps {
  documentState: {
    document: DocumentAnalysisResult | null;
    loading: boolean;
    reviewMode: boolean;
    toggleReviewMode: () => void;
    removeRedaction: (spanId: string) => void;
    addRedaction: (start: number, end: number, text: string, type: PIIType) => void;
    confirmRedaction: (spanId: string) => void;
    startTime: number;
    fileName: string;
    detectionMode: 'gemini' | 'mock';
    setDocument: (doc: DocumentAnalysisResult | null, mode: 'gemini' | 'mock', name: string) => void;
    sessionLog?: any[];
    undoLastAction?: () => void;
  };
}

export function DocumentViewer({ documentState }: DocumentViewerProps) {
  const { document, loading, reviewMode, toggleReviewMode, removeRedaction, addRedaction, confirmRedaction, startTime, fileName, sessionLog = [], undoLastAction } = documentState;
  const textRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{x: number, y: number, text: string, start: number, end: number} | null>(null);
  const [focusedSpanIndex, setFocusedSpanIndex] = useState<number>(0);

  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const tooltipEl = document.getElementById('redaction-tooltip');
      if (
        textRef.current && 
        !textRef.current.contains(e.target as Node) &&
        (!tooltipEl || !tooltipEl.contains(e.target as Node))
      ) {
        setTooltip(null);
      }
    };
    window.addEventListener('mousedown', handleDocumentClick);
    return () => window.removeEventListener('mousedown', handleDocumentClick);
  }, []);

  if (loading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center space-y-4 h-full bg-slate-900/20 rounded-lg">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin shadow-lg shadow-indigo-500/20"></div>
        <div className="text-slate-400 font-medium">Analyzing document for PII...</div>
      </div>
    );
  }

  if (!document) {
    return <div className="p-8 text-center text-red-500">Failed to load document.</div>;
  }

  const pendingSpans = document.spans
    .filter(s => !s.suggested_redaction)
    .sort((a, b) => {
       const getSeverity = (t: string) => ['SSN', 'PHONE', 'EMAIL'].includes(t) ? 3 : 1;
       const riskA = (1 - a.confidence) * getSeverity(a.type);
       const riskB = (1 - b.confidence) * getSeverity(b.type);
       return riskB - riskA;
    });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!reviewMode || pendingSpans.length === 0) return;
      if (window.document.activeElement?.tagName === 'INPUT' || window.document.activeElement?.tagName === 'TEXTAREA') return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedSpanIndex(prev => Math.min(prev + 1, pendingSpans.length - 1));
        const el = window.document.getElementById(`queue-item-${pendingSpans[Math.min(focusedSpanIndex + 1, pendingSpans.length - 1)]?.id}`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedSpanIndex(prev => Math.max(prev - 1, 0));
        const el = window.document.getElementById(`queue-item-${pendingSpans[Math.max(focusedSpanIndex - 1, 0)]?.id}`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const spanId = pendingSpans[focusedSpanIndex]?.id;
        if (spanId) {
          confirmRedaction(spanId);
          setFocusedSpanIndex(prev => Math.min(prev, Math.max(0, pendingSpans.length - 2)));
        }
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        const spanId = pendingSpans[focusedSpanIndex]?.id;
        if (spanId) {
          removeRedaction(spanId);
          setFocusedSpanIndex(prev => Math.min(prev, Math.max(0, pendingSpans.length - 2)));
        }
      } else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (undoLastAction) undoLastAction();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [reviewMode, pendingSpans, focusedSpanIndex, confirmRedaction, removeRedaction, undoLastAction]);

  const handleSelection = () => {
    if (!reviewMode) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      setTooltip(null);
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const text = selection.toString().trim();
    
    if (text.length > 0) {
      let node = range.startContainer;
      let parentSpan = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement);
      while (parentSpan && !parentSpan.hasAttribute('data-index') && parentSpan !== textRef.current) {
        parentSpan = parentSpan.parentElement;
      }
      
      const dataIndexStr = parentSpan?.getAttribute('data-index');
      let exactStart = dataIndexStr ? parseInt(dataIndexStr, 10) : -1;
      
      if (exactStart !== -1 && node.nodeType === Node.TEXT_NODE) {
        // startOffset is the character offset within the text node
        exactStart += range.startOffset;
      }
      
      // Verify text matches exactly at exactStart to handle multiple identical strings
      if (exactStart !== -1 && document.text.substring(exactStart, exactStart + text.length) === text) {
        setTooltip({
          x: rect.left + (rect.width / 2),
          y: rect.top - 10,
          text,
          start: exactStart,
          end: exactStart + text.length
        });
      } else {
        // Fallback to indexOf if something went wrong
        const start = document.text.indexOf(text, Math.max(0, exactStart - 5)); 
        if (start !== -1) {
          setTooltip({
            x: rect.left + (rect.width / 2),
            y: rect.top - 10,
            text,
            start,
            end: start + text.length
          });
        }
      }
    }
  };

  const handleAddRedaction = (type: PIIType) => {
    if (tooltip) {
      addRedaction(tooltip.start, tooltip.end, tooltip.text, type);
      setTooltip(null);
      window.getSelection()?.removeAllRanges();
    }
  };

  const renderText = () => {
    let lastIndex = 0;
    const elements: React.ReactNode[] = [];
    
    const clusters = new Map<string, number>();
    const typeCounters = new Map<PIIType, number>();

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

    document.spans.forEach((span, i) => {
      if (span.start > lastIndex) {
        elements.push(<span key={`text-${lastIndex}`} data-index={lastIndex}>{document.text.slice(lastIndex, span.start)}</span>);
      }

      const isUncertain = reviewMode && !span.suggested_redaction && span.confidence < 0.7;
      
      if (span.suggested_redaction) {
        elements.push(
          <RedactionBadge 
            key={`span-${span.id}`} 
            span={span} 
            reviewMode={reviewMode} 
            onRemove={removeRedaction}
            detectionMode={documentState.detectionMode}
            clusterId={clusters.get(`${span.type}-${span.text.toLowerCase()}`)}
          />
        );
      } else if (isUncertain) {
        // We need controlled open state to close before triggering state update
        const UncertainSpan = () => {
          const [open, setOpen] = React.useState(false);
          return (
            <Popover.Root open={open} onOpenChange={setOpen}>
              <Popover.Trigger asChild>
                <span
                  id={`span-${span.id}`}
                  className="transition-all duration-300 bg-amber-500/10 border-b border-amber-500/50 text-amber-200 px-0.5 mx-0.5 rounded-sm shadow-[0_0_10px_rgba(245,158,11,0.1)] cursor-pointer hover:bg-amber-500/20"
                >
                  {span.text}
                </span>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  className="z-50 w-72 rounded-xl bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 shadow-2xl p-4 ring-1 ring-white/10"
                  sideOffset={5}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Info size={16} className="text-amber-400" />
                      <h4 className="font-semibold text-slate-100 text-sm">
                        {documentState.detectionMode === 'gemini' ? 'AI Decision' : 'Detection Engine'}
                      </h4>
                      {span.reason && (
                        <div className="ml-auto flex items-center gap-1.5 px-2 py-0.5 bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded text-[10px] font-bold tracking-wide uppercase shadow-[0_0_10px_rgba(245,158,11,0.1)]">
                          {documentState.detectionMode === 'gemini' ? (
                            <><span className="text-amber-400">✨</span> AI Flagged</>
                          ) : (
                            <><span className="text-amber-400">🛡️</span> Local Flagged</>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="px-2 py-0.5 rounded-md text-xs font-bold border bg-amber-500/10 text-amber-400 border-amber-500/20">
                      {Math.round(span.confidence * 100)}% Confidence
                    </div>
                  </div>
                  <p className="text-slate-300 text-sm mb-4 leading-relaxed bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
                    {span.reason || 'Ambiguous context. Left visible to avoid over-redacting, but flagged for your review.'}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setOpen(false)}
                      className="flex-1 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-bold rounded-lg border border-emerald-500/30 transition-colors flex items-center justify-center gap-1"
                    >
                      <CheckCircle2 size={14} /> Safe
                    </button>
                    <button
                      onClick={() => {
                        setOpen(false);
                        // Defer state update until after popover animation completes
                        setTimeout(() => confirmRedaction(span.id), 100);
                      }}
                      className="flex-1 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-bold rounded-lg border border-rose-500/30 transition-colors flex items-center justify-center gap-1"
                    >
                      <ShieldAlert size={14} /> Redact
                    </button>
                  </div>
                  <Popover.Arrow className="fill-slate-800/80" />
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          );
        };
        elements.push(<UncertainSpan key={`span-${span.id}`} />);

      } else {
        elements.push(
          <span key={`span-${span.id}`}>
            {span.text}
          </span>
        );
      }
      
      lastIndex = span.end;
    });

    if (lastIndex < document.text.length) {
      elements.push(<span key={`text-${lastIndex}`} data-index={lastIndex}>{document.text.slice(lastIndex)}</span>);
    }

    return elements;
  };

  const pendingSpans = document.spans
    .filter(s => !s.suggested_redaction)
    .sort((a, b) => {
       const getSeverity = (t: string) => ['SSN', 'PHONE', 'EMAIL'].includes(t) ? 3 : 1;
       const riskA = (1 - a.confidence) * getSeverity(a.type);
       const riskB = (1 - b.confidence) * getSeverity(b.type);
       return riskB - riskA;
    });

  return (
    <div className="flex h-full relative rounded-b-3xl border-t-0 shadow-inner bg-white/[0.02] backdrop-blur-md">
      
      {/* Main Document Area */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-white/5">
        <ControlPanel 
          document={document} 
          reviewMode={reviewMode} 
          onToggleReviewMode={toggleReviewMode}
          startTime={startTime}
          fileName={fileName}
          onAddRedaction={addRedaction}
        />

        {document?.classification && (
          <div className="bg-slate-800/80 border-b border-slate-700/50 px-6 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-sm font-semibold">Document Type Detected:</span>
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                document.classification === 'LEGAL' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                document.classification === 'MEDICAL' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                document.classification === 'FINANCIAL' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                'bg-slate-700/50 text-slate-300 border border-slate-600/50'
              }`}>
                {document.classification}
              </span>
            </div>
            {document.classification !== 'GENERAL' && (
              <span className="text-xs text-slate-500 italic">Thresholds auto-adjusted for {document.classification.toLowerCase()} context</span>
            )}
          </div>
        )}
        
        {documentState.detectionMode === 'gemini' && reviewMode && (
          <div className="bg-indigo-500/10 border-b border-indigo-500/20 px-6 py-3 flex items-start gap-3">
            <Info className="text-indigo-400 shrink-0 mt-0.5" size={16} />
            <p className="text-sm text-indigo-200/80 leading-relaxed font-sans">
              <strong className="text-indigo-300">Privacy Verification:</strong> All structured data (like SSNs and phone numbers) was detected locally and masked with asterisks before this document was sent to Gemini. The AI only evaluated contextual relationships to find hidden PII, ensuring your most sensitive data never left this device.
            </p>
          </div>
        )}
        
        {reviewMode ? (
          <div className="flex w-full h-[70vh] overflow-hidden">
            <div 
              ref={textRef}
              className={`p-8 text-slate-300 leading-[2.5] text-[17px] whitespace-pre-wrap font-sans selection:bg-indigo-500/30 selection:text-indigo-200 overflow-y-auto ${fileName.toLowerCase().endsWith('.pdf') && document.document_id ? 'flex-1 border-r border-slate-700/50' : 'w-full max-h-[70vh]'}`}
              onMouseUp={handleSelection}
            >
              {fileName.toLowerCase().endsWith('.pdf') && document.document_id && (
                <div className="text-xs text-indigo-400 font-bold mb-4 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span> Extracted Text For Review
                </div>
              )}
              {renderText()}
            </div>
            {fileName.toLowerCase().endsWith('.pdf') && document.document_id && (
              <div className="flex-1 bg-[#1e1e1e] flex flex-col">
                <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 text-xs text-slate-400 font-bold tracking-wider uppercase flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span> Original PDF Context
                </div>
                <iframe 
                  src={`http://localhost:8000/api/documents/${document.document_id}/pdf`} 
                  className="w-full flex-1 border-0"
                  title="Original PDF Document"
                />
              </div>
            )}
          </div>
        ) : (
          <div className="flex w-full overflow-hidden h-[70vh]">
            <div className="flex-1 p-8 border-r border-slate-700/50 overflow-y-auto bg-slate-950/40">
              <h3 className="text-slate-400 mb-6 font-bold uppercase tracking-wider text-xs flex items-center gap-2 sticky top-0 bg-slate-950/90 py-2 backdrop-blur-sm z-10">
                <span className="w-2 h-2 rounded-full bg-slate-500"></span> Original Text
              </h3>
              <div className="text-slate-500 leading-[2.5] text-[15px] whitespace-pre-wrap font-sans opacity-70">
                {document.text}
              </div>
            </div>
            <div className="flex-1 p-8 overflow-y-auto bg-slate-900/40 shadow-inner">
              <h3 className="text-emerald-400 mb-6 font-bold uppercase tracking-wider text-xs flex items-center gap-2 sticky top-0 bg-slate-900/90 py-2 backdrop-blur-sm z-10">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Redacted Safe Export
              </h3>
              <div className="text-slate-200 leading-[2.5] text-[15px] whitespace-pre-wrap font-sans">
                {renderText()}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Risk-Ordered Review Queue Sidebar */}
      {reviewMode && (
        <div className="w-80 bg-slate-900/60 flex flex-col shrink-0 rounded-br-3xl overflow-hidden">
          <div className="p-4 border-b border-slate-800/60 bg-slate-900/80">
            <h3 className="font-bold text-slate-200 flex items-center gap-2">
              <ShieldAlert className="text-amber-400" size={18} />
              Review Queue
            </h3>
            <p className="text-xs text-slate-400 mt-1">Sorted by risk (Uncertainty × Severity)</p>
            <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-500 font-mono tracking-wider bg-slate-950/50 p-2 rounded border border-slate-800/50">
               <span className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">↑↓ Nav</span>
               <span className="bg-slate-800 px-1.5 py-0.5 rounded text-rose-300">Enter Redact</span>
               <span className="bg-slate-800 px-1.5 py-0.5 rounded text-emerald-300">Del Ignore</span>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {pendingSpans.length === 0 ? (
              <div className="text-center p-6 text-slate-500 text-sm border-b border-slate-800/60 pb-8 mb-4">
                <CheckCircle2 size={32} className="mx-auto mb-2 opacity-50" />
                All clear! No uncertain items pending review.
              </div>
            ) : (
              <div className="space-y-3 border-b border-slate-800/60 pb-6 mb-4">
                {pendingSpans.map((span, index) => (
                  <div 
                    id={`queue-item-${span.id}`}
                    key={span.id} 
                    className={`p-3 rounded-lg hover:border-amber-500/40 transition-all cursor-pointer group hover:bg-slate-800/80 ${
                      index === focusedSpanIndex ? 'bg-slate-800 border border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.2)]' : 'bg-slate-800/50 border border-amber-500/20'
                    }`}
                    onClick={() => {
                      setFocusedSpanIndex(index);
                      const el = window.document.getElementById(`span-${span.id}`);
                      if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        // Brief highlight animation
                        el.classList.add('ring-2', 'ring-amber-400', 'ring-offset-2', 'ring-offset-slate-900');
                        setTimeout(() => el.classList.remove('ring-2', 'ring-amber-400', 'ring-offset-2', 'ring-offset-slate-900'), 1500);
                      }
                    }}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="bg-amber-500/10 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-500/20">
                        {span.type} • {Math.round(span.confidence * 100)}%
                      </span>
                    </div>
                    <p className="text-slate-200 font-medium text-sm mb-3 bg-slate-900/50 p-2 rounded">
                      "{span.text}"
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); confirmRedaction(span.id); }}
                        className="flex-1 px-2 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-bold rounded border border-rose-500/30 transition-colors"
                      >
                        Redact
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeRedaction(span.id); }}
                        className="flex-1 px-2 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-bold rounded border border-emerald-500/30 transition-colors"
                      >
                        Ignore
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Session Log / Decision Trail */}
            <div className="pt-2 pb-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Session Trail</h4>
                {sessionLog.length > 0 && (
                  <button 
                    onClick={undoLastAction}
                    className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
                  >
                    ⤺ Undo Last
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {sessionLog.length === 0 ? (
                  <p className="text-xs text-slate-600 italic">No manual actions taken yet.</p>
                ) : (
                  sessionLog.map(log => (
                    <div key={log.id} className="flex gap-2 items-start text-xs text-slate-300 bg-slate-900/40 p-2 rounded border border-white/5">
                      <span className="text-slate-500 shrink-0">
                        {new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
                      </span>
                      <span>
                        <strong className={
                          log.type === 'AUTO_ACTION' ? 'text-purple-400' :
                          log.type === 'REMOVE' ? 'text-emerald-400' :
                          'text-rose-400'
                        }>{log.type}</strong>: {log.action}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}


      <AnimatePresence>
      {tooltip && createPortal(
        <motion.div 
          key="tooltip"
          initial={{ opacity: 0, y: 10, scale: 0.95, x: "-50%" }}
          animate={{ opacity: 1, y: 0, scale: 1, x: "-50%" }}
          exit={{ opacity: 0, y: 10, scale: 0.95, x: "-50%" }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          id="redaction-tooltip"
          className="fixed z-50 bg-[#0a0a0a]/95 backdrop-blur-2xl border border-white/10 text-white rounded-xl shadow-2xl px-3 py-2 flex items-center gap-2 ring-1 ring-white/5"
          style={{ top: tooltip.y - 45, left: tooltip.x }}
        >
          <span className="text-xs font-semibold mr-2 border-r border-slate-600/50 pr-2 text-indigo-300 uppercase tracking-wider">Redact as:</span>
          {[PIIType.NAME, PIIType.PHONE, PIIType.EMAIL, PIIType.SSN].map(type => (
            <button 
              key={type}
              onClick={(e) => {
                e.stopPropagation();
                handleAddRedaction(type);
              }}
              className="text-xs font-medium hover:bg-indigo-500/20 hover:text-indigo-200 px-2 py-1.5 rounded transition-all duration-200"
            >
              {type}
            </button>
          ))}
        </motion.div>,
        window.document.body
      )}
      </AnimatePresence>
    </div>
  );
}
