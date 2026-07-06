import React from 'react';
import { PIISpan } from '@shared/types';

interface Props {
  span: PIISpan;
  instanceCount: number;
  onApprove: (id: string) => void;
  onStage: (id: string) => void;
  onConfirm: (id: string) => void;
  onGlobalApply: (text: string, status: 'REDACTED' | 'KEPT_VISIBLE') => void;
}

export function SpanActionCard({ span, instanceCount, onApprove, onStage, onConfirm, onGlobalApply }: Props) {
  const risk = span.risk_score ?? 0;
  const isHighRisk = risk > 0.4;
  const isMedRisk = risk > 0.2;
  const isStaged = span.status === 'STAGED_FOR_DISMISSAL';

  return (
    <div className={`rounded-lg p-3 mb-2 border transition-all duration-300 ${
      isHighRisk ? 'border-red-500/50 bg-red-950/10' :
      isMedRisk  ? 'border-amber-500/30 bg-amber-950/10' :
                   'border-neutral-700 bg-neutral-900'
    }`} style={{ borderLeftWidth: isHighRisk ? '5px' : isMedRisk ? '4px' : '1px' }}>

      {/* Header */}
      <div className="flex justify-between items-center mb-1">
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${isHighRisk ? 'bg-red-500 animate-pulse' : isMedRisk ? 'bg-amber-400' : 'bg-neutral-500'}`} />
          <span className="font-mono text-xs font-bold text-white">{span.type}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* 3-Model Consensus Dots — shows how many detection layers agreed */}
          {span.model_agreement?.map((m, i) => (
            <span key={i} title={`${m.model}: ${m.agreed ? 'Flagged' : 'Ignored'}`}
              className={`w-2 h-2 rounded-full ${m.agreed ? 'bg-green-500' : 'bg-neutral-600'}`} />
          ))}
          <span className="text-xs text-neutral-400 font-mono">
            Risk: <span className={isHighRisk ? 'text-red-400 font-bold' : 'text-neutral-300'}>{risk.toFixed(3)}</span>
          </span>
        </div>
      </div>

      {/* Text + Reason */}
      <p className="text-xs font-mono text-neutral-300 bg-neutral-800/50 px-2 py-1 rounded mb-1 truncate">"{span.text}"</p>
      <p className="text-xs text-neutral-500 italic mb-3 leading-tight">{span.reason}</p>

      {/* ASYMMETRIC FRICTION BUTTONS — the PS3 core */}
      <div className="flex gap-2">
        {/* SAFE ACTION: Always 1 click, always available */}
        <button onClick={(e) => { e.stopPropagation(); onApprove(span.id); }}
          className="flex-1 bg-neutral-700 hover:bg-neutral-600 text-white text-xs py-1.5 rounded transition-colors flex items-center justify-center gap-1 font-semibold">
          ✓ Redact
        </button>

        {/* DANGEROUS ACTION: Varies based on risk */}
        {!isHighRisk ? (
          <button onClick={(e) => { e.stopPropagation(); onConfirm(span.id); }}
            className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 text-xs py-1.5 rounded transition-colors">
            Dismiss
          </button>
        ) : isStaged ? (
          <button onClick={(e) => { e.stopPropagation(); onConfirm(span.id); }}
            className="flex-1 bg-red-800 hover:bg-red-700 text-white text-xs py-1.5 rounded font-bold animate-pulse">
            ⚠ Confirm Leak
          </button>
        ) : (
          <button onClick={(e) => { e.stopPropagation(); onStage(span.id); }}
            className="flex-1 bg-amber-800/40 hover:bg-amber-700/40 text-amber-200 text-xs py-1.5 rounded transition-colors">
            Stage Dismiss
          </button>
        )}
      </div>

      {/* Smart Deduplication — show if 2+ identical instances */}
      {instanceCount > 1 && (
        <button onClick={(e) => { e.stopPropagation(); onGlobalApply(span.text, span.suggested_redaction ? 'KEPT_VISIBLE' : 'REDACTED'); }}
          className="w-full mt-1.5 border border-neutral-700 text-neutral-400 hover:text-white text-xs py-1 rounded transition-colors">
          Apply to all {instanceCount} instances of "{span.text}"
        </button>
      )}
    </div>
  );
}
