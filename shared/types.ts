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
  text: string;
  spans: PIISpan[];
}
