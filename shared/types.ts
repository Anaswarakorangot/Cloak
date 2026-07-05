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

export interface PIISpan {
  id: string;
  start: number;
  end: number;
  text: string;
  type: PIIType;
  confidence: number;
  suggested_redaction: boolean;
  reason?: string; // Explanation from Gemini AI
}

export interface DocumentAnalysisResult {
  document_id?: number;
  text: string;
  spans: PIISpan[];
  classification?: 'LEGAL' | 'MEDICAL' | 'FINANCIAL' | 'GENERAL';
}

export interface SessionLogEntry {
  id: string;
  action: string;
  timestamp: number;
  type: 'ADD' | 'REMOVE' | 'CONFIRM' | 'AUTO_ACTION';
  previousSpans?: PIISpan[]; // State of spans before this action for undo
}
