export enum PIIType {
  NAME = 'NAME',
  EMAIL = 'EMAIL',
  PHONE = 'PHONE',
  SSN = 'SSN',
  ADDRESS = 'ADDRESS',
  DOB = 'DOB',
  UNKNOWN = 'UNKNOWN',
  CUSTOM = 'CUSTOM',
}

export type SpanStatus = 'REDACTED' | 'KEPT_VISIBLE' | 'STAGED_FOR_DISMISSAL' | 'PENDING';

export interface ModelConsensus {
  model: string;
  agreed: boolean;
}

export interface PIISpan {
  id: string;
  start: number;
  end: number;
  text: string;
  type: PIIType;
  confidence: number;
  suggested_redaction: boolean;
  reason?: string; // Explanation from Gemini AI
  status?: SpanStatus;
  risk_score?: number;
  model_agreement?: ModelConsensus[];
}

export interface DocumentAnalysisResult {
  document_id?: string;
  text: string;
  spans: PIISpan[];
  classification?: 'LEGAL' | 'MEDICAL' | 'FINANCIAL' | 'GENERAL';
  total_exposure_score?: number;
}

export interface SessionLogEntry {
  id: string;
  action: string;
  timestamp: number;
  type: 'ADD' | 'REMOVE' | 'CONFIRM' | 'AUTO_ACTION';
  previousSpans?: PIISpan[]; // State of spans before this action for undo
}
