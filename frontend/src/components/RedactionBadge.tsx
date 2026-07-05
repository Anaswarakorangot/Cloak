import React, { useState } from 'react';
import { PIISpan, PIIType } from '@shared/types';
import { cn } from '../lib/utils';
import { EyeOff, Eye, Info, ShieldCheck, ShieldAlert } from 'lucide-react';
import * as Popover from '@radix-ui/react-popover';

interface Props {
  span: PIISpan;
  reviewMode: boolean;
  onRemove: (id: string) => void;
  detectionMode?: 'gemini' | 'mock';
  clusterId?: number;
}

const getReasoning = (type: PIIType, confidence: number) => {
  if (confidence > 0.9) return `High confidence pattern match for standard ${type.toLowerCase()} format.`;
  if (confidence > 0.7) return `Context suggests this is likely a ${type.toLowerCase()}.`;
  return `Ambiguous context. Flagged as possible ${type.toLowerCase()} for safety.`;
};

export function RedactionBadge({ span, reviewMode, onRemove, detectionMode = 'gemini', clusterId }: Props) {
  const [hover, setHover] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  if (!reviewMode) {
    if (span.suggested_redaction) {
      return <span className="bg-slate-900 text-transparent select-none rounded px-2 py-0.5 tracking-[0.2em] font-mono text-sm border border-slate-800/50 shadow-inner">███████</span>;
    }
    return <span>{span.text}</span>;
  }

  // Review Mode styling
  if (span.suggested_redaction) {
    const isHighConfidence = span.confidence >= 0.8;
    
    return (
      <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
        <Popover.Trigger asChild>
          <span 
            className={cn(
              "inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold cursor-pointer transition-all duration-300 border backdrop-blur-sm mx-0.5",
              isOpen ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-200 ring-2 ring-indigo-500/30" :
              hover 
                ? "bg-rose-500/10 border-rose-500/30 text-rose-400 line-through scale-[0.98] shadow-inner" 
                : "bg-indigo-500/10 border-indigo-500/30 text-indigo-300 shadow-[0_0_10px_rgba(99,102,241,0.1)] hover:shadow-[0_0_15px_rgba(99,102,241,0.2)]"
            )}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
          >
            {hover ? <Eye size={14} /> : <EyeOff size={14} />}
            {span.type}{clusterId ? ` ${clusterId}` : ''}
          </span>
        </Popover.Trigger>
        
        <Popover.Portal>
          <Popover.Content 
            className="z-50 w-72 rounded-xl bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 shadow-2xl p-4 ring-1 ring-white/10 animate-in fade-in zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-95"
            sideOffset={5}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <Info size={16} className="text-indigo-400" />
                <h4 className="font-semibold text-slate-100 text-sm">
                  {detectionMode === 'gemini' ? 'AI Decision' : 'Detection Engine'}
                </h4>
                {span.reason && (
                  <div className="ml-auto flex items-center gap-1.5 px-2 py-0.5 bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 rounded text-[10px] font-bold tracking-wide uppercase shadow-[0_0_10px_rgba(99,102,241,0.2)]">
                    {detectionMode === 'gemini' ? (
                      <><span className="text-indigo-400">✨</span> Verified by AI</>
                    ) : (
                      <><span className="text-indigo-400">🛡️</span> Local Engine</>
                    )}
                  </div>
                )}
              </div>
              <div className={cn(
                "px-2 py-0.5 rounded-md text-xs font-bold border",
                isHighConfidence ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"
              )}>
                {Math.round(span.confidence * 100)}% Confidence
              </div>
            </div>
            
            <p className="text-slate-300 text-sm mb-4 leading-relaxed bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
              {span.reason || getReasoning(span.type, span.confidence)}
            </p>
            
            <div className="flex gap-2">
              <button 
                onClick={() => setIsOpen(false)}
                className="flex-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg border border-slate-700 transition-colors"
              >
                Keep Hidden
              </button>
              <button 
                onClick={() => {
                  setIsOpen(false);
                  setTimeout(() => onRemove(span.id), 100);
                }}
                className="flex-1 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-bold rounded-lg border border-rose-500/30 transition-colors flex items-center justify-center gap-1"
              >
                <Eye size={14} /> Un-redact
              </button>
            </div>
            <Popover.Arrow className="fill-slate-800/80" />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    );
  }

  return <span>{span.text}</span>;
}
