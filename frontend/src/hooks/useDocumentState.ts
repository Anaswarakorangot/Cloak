import { useState, useMemo } from 'react';
import { DocumentAnalysisResult, PIISpan, PIIType, SessionLogEntry, SpanStatus } from '@shared/types';

export function useDocumentState() {
  const [document, setDocumentState] = useState<DocumentAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [reviewMode, setReviewMode] = useState(true);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [detectionMode, setDetectionMode] = useState<'gemini' | 'mock'>('mock');
  const [fileName, setFileName] = useState<string>('');
  const [sessionLog, setSessionLog] = useState<SessionLogEntry[]>([]);
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0.5);

  const totalExposureScore = useMemo(() =>
    (document?.spans ?? [])
      .filter(s => s.status !== 'REDACTED')
      .reduce((sum, s) => sum + (s.risk_score ?? 0), 0),
    [document]
  );

  const stageForDismissal = (spanId: string) => {
    if (!document) return;
    setDocumentState({
      ...document,
      spans: document.spans.map(s =>
        s.id === spanId ? { ...s, status: 'STAGED_FOR_DISMISSAL' as SpanStatus } : s
      )
    });
  };

  const globalResolve = (text: string, finalStatus: 'REDACTED' | 'KEPT_VISIBLE') => {
    if (!document) return;
    addLog('GLOBAL_RESOLVE' as any, `Bulk-applied ${finalStatus} to all "${text}"`, document.spans);
    setDocumentState({
      ...document,
      spans: document.spans.map(s =>
        s.text === text
          ? { ...s, status: finalStatus, suggested_redaction: finalStatus === 'REDACTED' }
          : s
      )
    });
  };

  const addLog = (type: SessionLogEntry['type'], action: string, previousSpans: PIISpan[]) => {
    setSessionLog(prev => [{
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
      type,
      action,
      previousSpans
    }, ...prev]);
  };

  const undoLastAction = () => {
    if (sessionLog.length === 0 || !document) return;
    const lastAction = sessionLog[0];
    if (lastAction.previousSpans) {
      setDocumentState({ ...document, spans: lastAction.previousSpans });
    }
    setSessionLog(prev => prev.slice(1));
  };

  const setDocument = (doc: DocumentAnalysisResult, mode: 'gemini' | 'mock', name: string) => {
    setDocumentState(doc);
    setDetectionMode(mode);
    setFileName(name);
    setStartTime(Date.now());
    setReviewMode(true);
    setSessionLog([]);
  };

  const removeRedaction = (spanId: string) => {
    if (!document) return;
    addLog('REMOVE', 'Ignored a flagged span', document.spans);
    setDocumentState({
      ...document,
      spans: document.spans.map(s => 
        s.id === spanId ? { ...s, status: 'KEPT_VISIBLE' as SpanStatus, suggested_redaction: false } : s
      )
    });
  };

  const addRedaction = (start: number, end: number, text: string, type: PIIType) => {
    if (!document) return;
    
    const newSpans: PIISpan[] = [];
    const escapedText = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Removed \b because it fails if the user types a string starting/ending with punctuation (like +1-555-1234)
    const regex = new RegExp(escapedText, 'gi');
    
    let match;
    while ((match = regex.exec(document.text)) !== null) {
      const matchStart = match.index;
      const matchedStr = match[0];
      const matchEnd = matchStart + matchedStr.length;
      
      // Skip if already covered by an existing redaction
      const isCovered = document.spans.some(s => s.suggested_redaction && s.start <= matchStart && s.end >= matchEnd);
      if (!isCovered) {
        newSpans.push({
          id: Math.random().toString(36).substring(2, 9),
          start: matchStart,
          end: matchEnd,
          text: matchedStr, // Use the actual matched text from the document
          type,
          confidence: 1.0,
          suggested_redaction: true,
          reason: 'Manually added by user.'
        });
      }
    }

    if (newSpans.length > 0) {
      addLog('ADD', `Manually redacted "${text}"`, document.spans);
      let filtered = document.spans;
      for (const newSpan of newSpans) {
        // Remove existing spans that overlap with the new ones
        filtered = filtered.filter(s => !(s.start < newSpan.end && s.end > newSpan.start));
      }
      const finalSpans = [...filtered, ...newSpans].sort((a, b) => a.start - b.start);
      setDocumentState({
        ...document,
        spans: finalSpans
      });
    }
  };

  // Promote an existing uncertain span to a confirmed redaction (fixes false negative)
  const confirmRedaction = (spanId: string) => {
    if (!document) return;
    addLog('CONFIRM', 'Confirmed an uncertain span', document.spans);
    setDocumentState({
      ...document,
      spans: document.spans.map(s =>
        s.id === spanId ? { ...s, status: 'REDACTED' as SpanStatus, suggested_redaction: true, confidence: 1.0, reason: 'Manually confirmed by user.' } : s
      )
    });
  };

  const toggleReviewMode = () => setReviewMode(!reviewMode);

  return {
    document,
    loading,
    reviewMode,
    toggleReviewMode,
    removeRedaction,
    addRedaction,
    confirmRedaction,
    setDocument,
    detectionMode,
    fileName,
    startTime,
    sessionLog,
    undoLastAction,
    stageForDismissal,
    globalResolve,
    confidenceThreshold,
    setConfidenceThreshold,
    totalExposureScore,
  };
}
