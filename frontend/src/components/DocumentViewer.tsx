import React, { useRef, useState, useEffect } from 'react';
import { RedactionBadge } from './RedactionBadge';
import { ControlPanel } from './ControlPanel';
import { PIIType, DocumentAnalysisResult } from '@shared/types';
import { cn } from '../lib/utils';
import * as Popover from '@radix-ui/react-popover';
import { Info, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface DocumentViewerProps {
  documentState: {
    document: DocumentAnalysisResult | null;
    loading: boolean;
    reviewMode: boolean;
    toggleReviewMode: () => void;
    removeRedaction: (spanId: string) => void;
    addRedaction: (start: number, end: number, text: string, type: PIIType) => void;
    confirmRedaction: (spanId: string) => void;
    timeOpen: number;
    fileName: string;
    detectionMode: 'gemini' | 'mock';
    setDocument: (doc: DocumentAnalysisResult | null, mode: 'gemini' | 'mock', name: string) => void;
  };
}

export function DocumentViewer({ documentState }: DocumentViewerProps) {
  const { document, loading, reviewMode, toggleReviewMode, removeRedaction, addRedaction, confirmRedaction, timeOpen, fileName } = documentState;
  const textRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{x: number, y: number, text: string, start: number, end: number} | null>(null);

  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      // Hide tooltip if clicking outside text area
      if (textRef.current && !textRef.current.contains(e.target as Node)) {
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
      const start = document.text.indexOf(text); 
      if (start !== -1) {
        setTooltip({
          x: rect.left + window.scrollX + (rect.width / 2),
          y: rect.top + window.scrollY - 10,
          text,
          start,
          end: start + text.length
        });
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

    document.spans.forEach((span, i) => {
      if (span.start > lastIndex) {
        elements.push(<span key={`text-${lastIndex}`}>{document.text.slice(lastIndex, span.start)}</span>);
      }

      const isUncertain = reviewMode && !span.suggested_redaction && span.confidence < 0.7;
      
      if (span.suggested_redaction) {
        elements.push(
          <RedactionBadge 
            key={`span-${span.id}`} 
            span={span} 
            reviewMode={reviewMode} 
            onRemove={removeRedaction} 
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
                      <h4 className="font-semibold text-slate-100 text-sm">AI Decision</h4>
                      {span.reason && (
                        <div className="ml-auto flex items-center gap-1.5 px-2 py-0.5 bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded text-[10px] font-bold tracking-wide uppercase shadow-[0_0_10px_rgba(245,158,11,0.1)]">
                          <span className="text-amber-400">✨</span> AI Flagged
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
      elements.push(<span key={`text-${lastIndex}`}>{document.text.slice(lastIndex)}</span>);
    }

    return elements;
  };

  return (
    <div className="flex flex-col h-full relative rounded-b-xl border-t-0 shadow-inner bg-slate-900/40">
      <ControlPanel 
        document={document} 
        reviewMode={reviewMode} 
        onToggleReviewMode={toggleReviewMode}
        timeOpen={timeOpen}
        fileName={fileName}
      />
      
      <div 
        ref={textRef}
        className="p-8 text-slate-300 leading-[2.5] text-[17px] whitespace-pre-wrap font-sans selection:bg-indigo-500/30 selection:text-indigo-200"
        onMouseUp={handleSelection}
      >
        {renderText()}
      </div>

      {tooltip && (
        <div 
          className="fixed z-50 bg-slate-800/90 backdrop-blur-md border border-slate-700/50 text-white rounded-lg shadow-2xl px-3 py-2 flex items-center gap-2 transform -translate-x-1/2 -translate-y-full ring-1 ring-white/5"
          style={{ top: tooltip.y, left: tooltip.x }}
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
        </div>
      )}
    </div>
  );
}
