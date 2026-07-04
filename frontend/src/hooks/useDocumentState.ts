import { useState } from 'react';
import { DocumentAnalysisResult, PIISpan, PIIType } from '@shared/types';

export function useDocumentState() {
  const [document, setDocumentState] = useState<DocumentAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [reviewMode, setReviewMode] = useState(true);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [detectionMode, setDetectionMode] = useState<'gemini' | 'mock'>('mock');
  const [fileName, setFileName] = useState<string>('');

  const setDocument = (doc: DocumentAnalysisResult, mode: 'gemini' | 'mock', name: string) => {
    setDocumentState(doc);
    setDetectionMode(mode);
    setFileName(name);
    setStartTime(Date.now());
    setReviewMode(true);
  };

  const removeRedaction = (spanId: string) => {
    if (!document) return;
    setDocumentState({
      ...document,
      spans: document.spans.filter(s => s.id !== spanId)
    });
  };

  const addRedaction = (start: number, end: number, text: string, type: PIIType) => {
    if (!document) return;
    const newSpan: PIISpan = {
      id: Math.random().toString(36).substring(2, 9),
      start,
      end,
      text,
      type,
      confidence: 1.0,
      suggested_redaction: true,
      reason: 'Manually added by user.'
    };
    // Remove any existing overlapping spans
    const filtered = document.spans.filter(s => !(s.start < end && s.end > start));
    const newSpans = [...filtered, newSpan].sort((a, b) => a.start - b.start);
    setDocumentState({
      ...document,
      spans: newSpans
    });
  };

  // Promote an existing uncertain span to a confirmed redaction (fixes false negative)
  const confirmRedaction = (spanId: string) => {
    if (!document) return;
    setDocumentState({
      ...document,
      spans: document.spans.map(s =>
        s.id === spanId ? { ...s, suggested_redaction: true, confidence: 1.0, reason: 'Manually confirmed by user.' } : s
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
    timeOpen: Date.now() - startTime
  };
}
