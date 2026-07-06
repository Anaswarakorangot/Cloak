import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { RedactionBadge } from './RedactionBadge';
import { ControlPanel } from './ControlPanel';
import { EntityNode } from './EntityNode';
import { SpanActionCard } from './SpanActionCard';
import { PIIType, DocumentAnalysisResult } from '@shared/types';
import { cn } from '../lib/utils';
import * as Popover from '@radix-ui/react-popover';
import { Info, ShieldAlert, CheckCircle2, ChevronLeft, ChevronRight, SlidersHorizontal, Eye, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Document as PdfDocument, Page as PdfPage, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = `${pdfjsWorker}?v=${pdfjs.version}`;


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
    totalExposureScore: number;
    stageForDismissal: (spanId: string) => void;
    globalResolve: (text: string, action: 'REDACT' | 'KEEP') => void;
    revertSpanStatus: (spanId: string) => void;
  };
}

export function DocumentViewer({ documentState }: DocumentViewerProps) {
  const { 
    document, loading, reviewMode, removeRedaction, addRedaction, confirmRedaction, 
    toggleReviewMode, fileName, startTime, sessionLog = [], undoLastAction,
    totalExposureScore, stageForDismissal, globalResolve, revertSpanStatus
  } = documentState;

  const reviewQueue = React.useMemo(() =>
    [...(document?.spans ?? [])]
      .filter(s => s.status === 'PENDING' || s.status === 'STAGED_FOR_DISMISSAL')
      .sort((a, b) => (b.risk_score ?? 0) - (a.risk_score ?? 0)),
  [document?.spans]);

  const instanceCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    document?.spans.forEach(s => { counts[s.text] = (counts[s.text] ?? 0) + 1; });
    return counts;
  }, [document?.spans]);

  const pendingSpans = document?.spans
    .filter(s => s.status !== 'REDACTED' && s.status !== 'KEPT_VISIBLE')
    .sort((a, b) => (b.risk_score ?? 0) - (a.risk_score ?? 0)) || [];

  const textRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{x: number, y: number, text?: string, start?: number, end?: number, spanId?: string} | null>(null);
  const [hoverTooltip, setHoverTooltip] = useState<{x: number, y: number, spanId: string} | null>(null);
  const [focusedSpanIndex, setFocusedSpanIndex] = useState<number>(0);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0.7);
  const [aiPreviewMode, setAiPreviewMode] = useState<boolean>(false);

  const downloadAuditCSV = () => {
    if (!document) return;
    const headers = ['Type', 'Text', 'Confidence', 'Status', 'Risk Score', 'Reason'];
    const rows = document.spans.map(s => [
      s.type,
      `"${s.text.replace(/"/g, '""')}"`,
      s.confidence.toFixed(2),
      s.status,
      (s.risk_score ?? 0).toFixed(3),
      `"${(s.reason || '').replace(/"/g, '""')}"`
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `cloak_audit_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (fileName.toLowerCase().endsWith('.pdf') && document?.document_id) {
      const fetchPdf = async () => {
        try {
          const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/documents/${document.document_id}/pdf`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('cloak_token')}` }
          });
          if (res.ok) {
            const blob = await res.blob();
            setPdfUrl(URL.createObjectURL(blob));
          } else {
            console.error("Failed to fetch original PDF");
          }
        } catch (e) {
          console.error("Error fetching PDF", e);
        }
      };
      fetchPdf();
    }
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [document?.document_id, fileName]);
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      const tooltipEl = window.document.getElementById('redaction-tooltip');
      if (
        textRef.current && 
        !textRef.current.contains(e.target as Node) &&
        (!tooltipEl || !tooltipEl.contains(e.target as Node))
      ) {
        setTooltip(null);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!e.target || !(e.target as HTMLElement).closest) return;
      const target = e.target as HTMLElement;
      
      // If the click menu is open, don't show hover tooltips
      const tooltipEl = window.document.getElementById('redaction-tooltip');
      if (tooltipEl && tooltipEl.contains(target)) return;

      // If hovering over the hover tooltip itself, keep it open!
      const hoverTooltipEl = window.document.getElementById('hover-tooltip-div');
      if (hoverTooltipEl && hoverTooltipEl.contains(target)) return;
      
      const markNode = target.closest('[data-span-id]');
      
      if (markNode) {
        const spanId = markNode.getAttribute('data-span-id');
        if (spanId) {
          const rect = markNode.getBoundingClientRect();
          setHoverTooltip(prev => {
            if (prev && prev.spanId === spanId) return prev; // Avoid unnecessary re-renders
            return { x: rect.left + rect.width / 2, y: rect.top, spanId };
          });
        }
      } else {
        setHoverTooltip(prev => prev ? null : prev);
      }
    };

    window.addEventListener('mousedown', handleDocumentClick);
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousedown', handleDocumentClick);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [tooltip]);

  if (loading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center space-y-4 h-full bg-slate-900/20 rounded-lg">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin shadow-lg shadow-orange-500/20"></div>
        <div className="text-slate-400 font-medium">Analyzing document for PII...</div>
      </div>
    );
  }

  if (!document) {
    return <div className="p-8 text-center text-red-500">Failed to load document.</div>;
  }

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
    // Clean up text from pdf text layer artifacts
    const text = selection.toString().replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    
    if (text.length > 0) {
      // Just show the tooltip! addRedaction will use regex to find all occurrences globally.
      setTooltip({
        x: rect.left + (rect.width / 2),
        y: rect.top - 10,
        text,
        start: 0,
        end: text.length
      });
    }
  };

  const getTextRenderer = React.useCallback(
    (isFinalPreview: boolean) => (textItem: any) => {
      let str = textItem.str;
      if (!document?.spans) return str;
      
      const activeSpans = isFinalPreview 
        ? document.spans.filter(s => s.status === 'REDACTED')
        : document.spans.filter(s => s.status !== 'KEPT_VISIBLE' && s.suggested_redaction);
      
      // Deduplicate by text to prevent nested <mark> tags stacking opacity
      const uniqueTextMap = new Map<string, any>();
      for (const span of activeSpans) {
        if (span.text.length < 2) continue;
        // Prefer REDACTED if there are mixed statuses for the same text
        if (!uniqueTextMap.has(span.text) || span.status === 'REDACTED') {
          uniqueTextMap.set(span.text, span);
        }
      }

      // Sort by length descending so longer phrases are replaced before shorter words inside them
      const sortedUniqueSpans = Array.from(uniqueTextMap.values()).sort((a, b) => b.text.length - a.text.length);

      for (const span of sortedUniqueSpans) {
        let markStyle = "border-radius: 2px; padding: 0.25em 0; margin: -0.25em 0; display: inline-block; line-height: 1;";
        
        if (isFinalPreview || span.status === 'REDACTED') {
            markStyle += " background-color: black; color: transparent; box-shadow: 0 0 2px black;";
        } else {
            markStyle += " background-color: rgba(0, 0, 0, 0.3); color: inherit; border-bottom: 2px dashed rgba(0, 0, 0, 0.6);";
        }


        // Only replace if the text exists and isn't already inside a mark tag attribute
        if (str.includes(span.text)) {
           // Basic protection against replacing inside an already added HTML tag
           const parts = str.split(span.text);
           str = parts.join(`<mark style="${markStyle} cursor: pointer;" data-span-id="${span.id}">${span.text}</mark>`);
        } else if (span.text.includes(str.trim()) && str.trim().length > 3) {
           str = `<mark style="${markStyle} cursor: pointer;" data-span-id="${span.id}">${str}</mark>`;
        }
      }
      return str;
    },
    [document?.spans]
  );

  const handleSpanClick = (span: any, e?: React.MouseEvent) => {
    if (span.status === 'REDACTED' || span.status === 'KEPT_VISIBLE') {
      const rect = e ? (e.target as HTMLElement).getBoundingClientRect() : null;
      if (rect) {
        setTooltip({ x: rect.left + rect.width / 2, y: rect.top, spanId: span.id });
        setHoverTooltip(null);
      } else {
        revertSpanStatus(span.id);
      }
      return;
    }
    const index = reviewQueue.findIndex(s => s.id === span.id);
    if (index !== -1) setFocusedSpanIndex(index);
    const el = window.document.getElementById(`queue-item-${span.id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-amber-400');
      setTimeout(() => el.classList.remove('ring-2', 'ring-amber-400'), 1500);
    }
  };

  const renderText = () => {
    let lastIndex = 0;
    const elements: React.ReactNode[] = [];

    document.spans.forEach((span, i) => {
      if (span.start > lastIndex) {
        elements.push(<span key={`text-${lastIndex}`} data-index={lastIndex}>{document.text.slice(lastIndex, span.start)}</span>);
      }

      elements.push(
        <EntityNode 
          key={`span-${span.id}`} 
          span={span} 
          onClick={handleSpanClick}
          isFinalPreview={!reviewMode}
        />
      );
      
      lastIndex = span.end;
    });

    if (lastIndex < document.text.length) {
      elements.push(<span key={`text-${lastIndex}`} data-index={lastIndex}>{document.text.slice(lastIndex)}</span>);
    }

    return elements;
  };

  const renderPdfViewer = (isFinalPreview: boolean) => (
    <div className="w-full flex flex-col h-full min-h-0 overflow-hidden">
      <div className="bg-slate-900 px-6 py-3 border-b border-slate-800 text-xs text-slate-400 font-bold tracking-wider uppercase flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isFinalPreview ? (
            <><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Redacted PDF Preview</>
          ) : (
            <><span className="w-2 h-2 rounded-full bg-amber-500"></span> Live Interactive PDF Redaction</>
          )}
        </div>
        <div className="text-slate-500 italic lowercase normal-case">
          {isFinalPreview ? "This is how the final exported document will look" : "Highlight text directly on the document below to manually redact"}
        </div>
      </div>
      <div 
        ref={pdfRef}
        className="w-full flex-1 overflow-auto bg-slate-800/20 relative flex flex-col items-center min-h-0"
        onMouseUp={isFinalPreview ? undefined : handleSelection}
      >
        {pdfUrl ? (
          <PdfDocument
            file={pdfUrl}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            className="flex flex-col items-center p-8 selection:bg-orange-500/30"
            error={<div className="text-red-400 p-8">Failed to load PDF file. The PDF may be corrupted or missing.</div>}
            loading={<div className="text-slate-400 p-8">Loading PDF visual...</div>}
          >
          <PdfPage 
            pageNumber={pageNumber} 
            renderTextLayer={true} 
            renderAnnotationLayer={true}
            customTextRenderer={getTextRenderer(isFinalPreview)}
            className="shadow-2xl border border-white/10"
            width={800}
          />
        </PdfDocument>
        ) : (
          <div className="text-slate-400 p-8 mt-10">Fetching secure document...</div>
        )}
        
        {numPages && numPages > 1 && (
          <div className="sticky bottom-6 mx-auto w-fit flex items-center gap-4 bg-slate-900/95 border border-slate-700/50 backdrop-blur-md px-6 py-3 rounded-full shadow-2xl z-10">
            <button 
              onClick={() => setPageNumber(p => Math.max(1, p - 1))}
              disabled={pageNumber <= 1}
              className="p-1 text-slate-400 hover:text-white disabled:opacity-50 transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="text-sm font-semibold text-slate-200 w-24 text-center">
              Page {pageNumber} of {numPages}
            </span>
            <button 
              onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}
              disabled={pageNumber >= numPages}
              className="p-1 text-slate-400 hover:text-white disabled:opacity-50 transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-full relative rounded-b-3xl border-t-0 shadow-inner bg-white/[0.02] backdrop-blur-md">
      
      {/* Main Document Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 border-r border-white/5">
        <ControlPanel 
          document={document} 
          reviewMode={reviewMode} 
          onToggleReviewMode={toggleReviewMode}
          startTime={startTime}
          fileName={fileName}
          onAddRedaction={addRedaction}
          totalExposureScore={totalExposureScore}
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
          <div className="bg-orange-500/10 border-b border-orange-500/20 px-6 py-3 flex items-start gap-3">
            <Info className="text-orange-400 shrink-0 mt-0.5" size={16} />
            <p className="text-sm text-orange-200/80 leading-relaxed font-sans">
              <strong className="text-orange-300">Privacy Verification:</strong> All structured data (like SSNs and phone numbers) was detected locally and masked with asterisks before this document was sent to Gemini. The AI only evaluated contextual relationships to find hidden PII, ensuring your most sensitive data never left this device.
            </p>
          </div>
        )}
        
        {reviewMode ? (
          <div className="flex-1 flex w-full overflow-hidden bg-[#1e1e1e] min-h-0">
            {aiPreviewMode ? (
              <div className="flex-1 w-full min-h-0 p-8 text-slate-200 leading-[2.5] text-[17px] whitespace-pre-wrap font-mono overflow-y-auto bg-slate-950">
                <div className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-2.5 rounded-lg mb-6 flex items-center gap-2">
                  <Eye size={14} className="text-emerald-400" />
                  <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">AI Preview Mode</span>
                  <span className="text-xs text-emerald-400/70 ml-2">— This is exactly what a downstream AI model will receive</span>
                </div>
                {(() => {
                  let result = document.text;
                  const typeCounters: Record<string, number> = {};
                  const tokenMap: Record<string, string> = {};
                  const sorted = [...document.spans]
                    .filter(s => s.suggested_redaction && s.confidence >= confidenceThreshold)
                    .sort((a, b) => b.start - a.start);
                  for (const span of sorted) {
                    const key = `${span.type}-${span.text.toLowerCase()}`;
                    if (!tokenMap[key]) {
                      typeCounters[span.type] = (typeCounters[span.type] || 0) + 1;
                      tokenMap[key] = `[${span.type}_${typeCounters[span.type]}]`;
                    }
                    result = result.slice(0, span.start) + tokenMap[key] + result.slice(span.end);
                  }
                  return result;
                })()}
              </div>
            ) : !(fileName.toLowerCase().endsWith('.pdf') && document.document_id) ? (
              <div 
                ref={textRef}
                className="flex-1 w-full min-h-0 p-8 text-slate-300 leading-[2.5] text-[17px] whitespace-pre-wrap font-sans selection:bg-orange-500/30 selection:text-orange-200 overflow-y-auto"
                onMouseUp={handleSelection}
              >
                {renderText()}
              </div>
            ) : (
              renderPdfViewer(false)
            )}
          </div>
        ) : (
          <div className="flex-1 flex w-full overflow-hidden min-h-0">
            {fileName.toLowerCase().endsWith('.pdf') && document.document_id ? (
              <div className="w-full bg-[#1e1e1e] flex flex-col">{renderPdfViewer(true)}</div>
            ) : (
              <>
                <div className="flex-1 min-h-0 p-8 border-r border-slate-700/50 overflow-y-auto bg-slate-950/40">
                  <h3 className="text-slate-400 mb-6 font-bold uppercase tracking-wider text-xs flex items-center gap-2 sticky top-0 bg-slate-950/90 py-2 backdrop-blur-sm z-10">
                    <span className="w-2 h-2 rounded-full bg-slate-500"></span> Original Text
                  </h3>
                  <div className="text-slate-500 leading-[2.5] text-[15px] whitespace-pre-wrap font-sans opacity-70">
                    {document.text}
                  </div>
                </div>
                <div className="flex-1 min-h-0 p-8 overflow-y-auto bg-slate-900/40 shadow-inner">
                  <h3 className="text-emerald-400 mb-6 font-bold uppercase tracking-wider text-xs flex items-center gap-2 sticky top-0 bg-slate-900/90 py-2 backdrop-blur-sm z-10">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Redacted Safe Export
                  </h3>
                  <div className="text-slate-200 leading-[2.5] text-[15px] whitespace-pre-wrap font-sans">
                    {renderText()}
                  </div>
                </div>
              </>
            )}
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

          {/* Confidence Threshold Slider */}
          <div className="px-4 py-3 border-b border-slate-800/60 bg-slate-900/50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <SlidersHorizontal size={13} className="text-indigo-400" />
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Confidence Threshold</span>
              </div>
              <span className="text-xs font-mono font-bold text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                {(confidenceThreshold * 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={confidenceThreshold * 100}
              onChange={(e) => setConfidenceThreshold(Number(e.target.value) / 100)}
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <div className="flex justify-between text-[10px] text-slate-600 mt-1">
              <span>Show All</span>
              <span>High Confidence Only</span>
            </div>
          </div>

          {/* AI Preview + CSV Audit Buttons */}
          <div className="px-4 py-2.5 border-b border-slate-800/60 flex items-center gap-2">
            <button
              onClick={() => setAiPreviewMode(!aiPreviewMode)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all border ${
                aiPreviewMode
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.15)]'
                  : 'bg-slate-800/80 text-slate-400 border-slate-700/50 hover:bg-slate-700 hover:text-slate-200'
              }`}
            >
              <Eye size={13} />
              {aiPreviewMode ? 'AI View ON' : 'AI Preview'}
            </button>
            <button
              onClick={downloadAuditCSV}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-slate-800/80 text-slate-400 border border-slate-700/50 hover:bg-slate-700 hover:text-slate-200 transition-all"
              title="Download compliance audit log as CSV"
            >
              <Download size={13} />
              CSV
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {reviewQueue.length === 0 ? (
              <div className="text-center p-6 text-slate-500 text-sm border-b border-slate-800/60 pb-8 mb-4">
                <CheckCircle2 size={32} className="mx-auto mb-2 opacity-50" />
                All clear! No items pending review.
              </div>
            ) : (
              <div className="space-y-3 border-b border-slate-800/60 pb-6 mb-4">
                {reviewQueue.filter(span => span.confidence >= confidenceThreshold).map((span, index) => (
                  <div id={`queue-item-${span.id}`} key={span.id}>
                    <SpanActionCard
                      span={span}
                      instanceCount={instanceCounts[span.text] || 1}
                      onApprove={(id) => confirmRedaction(id)}
                      onStage={(id) => stageForDismissal(id)}
                      onConfirm={(id) => removeRedaction(id)}
                      onGlobalApply={globalResolve}
                    />
                  </div>
                ))}
                {reviewQueue.filter(span => span.confidence < confidenceThreshold).length > 0 && (
                  <div className="text-center text-[10px] text-slate-600 py-2 border-t border-slate-800/40 mt-2">
                    {reviewQueue.filter(span => span.confidence < confidenceThreshold).length} items hidden below {(confidenceThreshold * 100).toFixed(0)}% threshold
                  </div>
                )}
              </div>
            )}

            
            {/* Session Log / Decision Trail */}
            <div className="pt-2 pb-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Session Trail</h4>
                {sessionLog.length > 0 && (
                  <button 
                    onClick={undoLastAction}
                    className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1 font-semibold"
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
          {tooltip.text && (
            <>
              <span className="text-xs font-semibold mr-2 border-r border-slate-600/50 pr-2 text-orange-300 uppercase tracking-wider">Redact as:</span>
              {[PIIType.NAME, PIIType.PHONE, PIIType.EMAIL, PIIType.SSN].map(type => (
                <button 
                  key={type}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddRedaction(tooltip.text!, tooltip.start!, tooltip.end!, type);
                    setTooltip(null);
                  }}
                  className="text-xs font-medium hover:bg-orange-500/20 hover:text-orange-200 px-2 py-1.5 rounded transition-all duration-200"
                >
                  {type}
                </button>
              ))}
            </>
          )}
        </motion.div>,
        window.document.body
      )}
      </AnimatePresence>

      {/* Hover Info Tooltip */}
      {createPortal(
        <AnimatePresence>
          {hoverTooltip && !tooltip && (() => {
            const span = document?.spans.find(s => s.id === hoverTooltip.spanId);
            if (!span) return null;
            
            const agreedModels = span.model_agreement?.filter((m: any) => m.agreed).map((m: any) => m.model) || [];

            return (
              <motion.div 
                key={`hover-tooltip-${span.id}`}
                id="hover-tooltip-div"
                initial={{ opacity: 0, y: "calc(-100% + 5px)", scale: 0.95, x: "-50%" }}
                animate={{ opacity: 1, y: "-100%", scale: 1, x: "-50%" }}
                exit={{ opacity: 0, scale: 0.95, x: "-50%", y: "-100%" }}
                transition={{ duration: 0.15 }}
                className="fixed z-[9999] bg-slate-900/95 backdrop-blur-xl border border-slate-700 shadow-2xl p-3 flex flex-col gap-1.5 w-64 pointer-events-auto rounded-lg after:content-[''] after:absolute after:top-full after:left-0 after:right-0 after:h-6"
                style={{ top: hoverTooltip.y - 10, left: hoverTooltip.x }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                    {span.type}
                  </span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    span.confidence >= 0.7 ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'
                  }`}>
                    {(span.confidence * 100).toFixed(0)}% CONFIDENCE
                  </span>
                </div>
                
                <p className="text-xs text-slate-300 leading-relaxed font-sans">
                  {span.reason || 'Detected as potential PII.'}
                </p>

                {agreedModels.length > 0 && (
                  <div className="mt-1 pt-1.5 border-t border-slate-700/50 flex flex-col gap-1.5">
                    {agreedModels.includes("Gemini 2.5 Flash") && (
                      <div className="flex items-center gap-1.5 bg-indigo-500/10 border border-indigo-500/20 px-2 py-1 rounded w-fit">
                        <span className="text-indigo-400 text-[10px] font-bold uppercase tracking-wider">✨ Verified by AI</span>
                      </div>
                    )}
                    {!agreedModels.includes("Gemini 2.5 Flash") && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Models:</span>
                        <span className="text-[10px] text-indigo-300 font-medium">{agreedModels.join(', ')}</span>
                      </div>
                    )}
                  </div>
                )}

                {span.status === 'REDACTED' ? (() => {
                  const isHighRisk = span.type === PIIType.SSN || 
                    span.type === PIIType.CREDIT_CARD || 
                    span.type === PIIType.BANK_ACCOUNT || 
                    span.confidence >= 0.8 || 
                    (span.risk_score ?? 0) >= 8;
                  
                  return (
                    <div className="mt-2 pt-2 border-t border-slate-700/50 flex flex-col items-stretch gap-2">
                      {isHighRisk && (
                        <div className="bg-rose-500/10 border border-rose-500/20 px-2 py-1.5 rounded flex items-start gap-1.5">
                          <span className="text-rose-500 text-[10px] font-bold leading-tight uppercase">⚠️ High Sensitivity: Think carefully before unredacting!</span>
                        </div>
                      )}
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          revertSpanStatus(span.id);
                          setHoverTooltip(null);
                        }}
                        className={`text-xs font-bold px-3 py-1.5 rounded transition-all duration-200 border w-full text-center ${
                          isHighRisk 
                            ? 'bg-rose-900/40 hover:bg-rose-800 text-rose-300 border-rose-500/30 hover:border-rose-400' 
                            : 'bg-slate-800 hover:bg-slate-700 text-amber-400 border-amber-500/30'
                        }`}
                      >
                        ⤺ {isHighRisk ? 'Unredact Anyway' : 'Revert to Pending'}
                      </button>
                    </div>
                  );
                })() : (
                  <div className="mt-2 pt-2 border-t border-slate-700/50 flex flex-col items-stretch gap-2">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        confirmRedaction(span.id);
                        setHoverTooltip(null);
                      }}
                      className="text-xs font-bold px-3 py-1.5 rounded transition-all duration-200 border w-full text-center bg-emerald-900/40 hover:bg-emerald-800 text-emerald-400 border-emerald-500/30"
                    >
                      ✓ Redact Item
                    </button>
                  </div>
                )}
              </motion.div>
            );
          })()}
        </AnimatePresence>,
        window.document.body
      )}
    </div>
  );
}
