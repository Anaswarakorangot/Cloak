import React from 'react';
import { PIISpan } from '@shared/types';

interface Props {
  span: PIISpan;
  onClick: (span: PIISpan, e?: React.MouseEvent) => void;
  isFinalPreview?: boolean;
}

export function EntityNode({ span, onClick, isFinalPreview = false }: Props) {
  const status = span.status ?? (span.suggested_redaction ? 'REDACTED' : 'KEPT_VISIBLE');
  const risk = span.risk_score ?? 0;

  const getTooltipText = () => {
    // No longer generating string, using new DocumentViewer hoverTooltip
    return '';
  };

  const titleText = getTooltipText();

  if (isFinalPreview) {
    if (status === 'REDACTED') {
      return (
        <span 
          className="bg-black text-transparent select-none rounded-sm px-1 cursor-pointer hover:ring-2 hover:ring-amber-500 transition-all" 
          data-span-id={span.id}
          onClick={(e) => onClick(span, e)}
        >
          {span.text}
        </span>
      );
    }
    // If it's not redacted in final preview, it leaks as plain text.
    return <span data-span-id={span.id} onClick={(e) => onClick(span, e)} className="cursor-pointer hover:bg-slate-800 rounded px-0.5">{span.text}</span>;
  }

  let cls = 'cursor-pointer rounded-sm mx-0.5 px-0.5 transition-all duration-200 inline ';

  if (status === 'REDACTED') {
    // STATE 1: Confirmed black bar — no visual noise, Sam can scan past it
    cls += 'bg-neutral-900 text-neutral-500 text-xs font-mono border border-neutral-800';
  } else if (status === 'STAGED_FOR_DISMISSAL') {
    // STATE 2: Halfway through 2-step — orange pulse, waiting for confirm
    cls += 'bg-orange-900/30 text-orange-300 border-b-2 border-orange-500 animate-pulse';
  } else if (status === 'PENDING' && span.suggested_redaction) {
    // STATE 2.5: AI suggested, waiting for user approval — purple highlight
    cls += 'bg-purple-900/30 text-purple-200 border-b-2 border-purple-500';
  } else if (risk > 0.4) {
    // STATE 3: High-risk miss (phone at 38%, name at 45%) — red pulse, DEMANDS attention
    cls += 'border-b-2 border-dotted border-red-500 text-red-300 animate-pulse';
  } else if (risk > 0.2) {
    // STATE 4: Borderline miss — amber underline, worth a look
    cls += 'border-b-2 border-dotted border-amber-400 text-amber-200';
  } else {
    // STATE 5: AI scanned + deliberately kept visible (e.g., "Houston" the city)
    // Dotted blue = "I checked this, it is fine" — Silence is not trust.
    cls += 'border-b border-dotted border-blue-500/60 text-blue-200/80';
  }

  return (
    <span className={cls} onClick={(e) => onClick(span, e)} data-span-id={span.id}>
      {status === 'REDACTED' ? `[${span.type}]` : span.text}
    </span>
  );
}
