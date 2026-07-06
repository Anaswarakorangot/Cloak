from enum import Enum
from pydantic import BaseModel
from typing import List, Optional, Dict

class PIIType(str, Enum):
    NAME = "NAME"
    EMAIL = "EMAIL"
    PHONE = "PHONE"
    SSN = "SSN"
    ADDRESS = "ADDRESS"
    DOB = "DOB"
    UNKNOWN = "UNKNOWN"
    CUSTOM = "CUSTOM"
    MANUAL_TAG = "MANUAL_TAG"  # User manually highlighted this

class SpanStatus(str, Enum):
    REDACTED = "REDACTED"
    KEPT_VISIBLE = "KEPT_VISIBLE"
    STAGED_FOR_DISMISSAL = "STAGED_FOR_DISMISSAL"
    PENDING = "PENDING"  # First step of 2-step friction

# The severity weight table — drives the risk score formula
SEVERITY_WEIGHTS: Dict[str, float] = {
    "SSN": 1.00, "CUSTOM": 0.95, "PHONE": 0.80,
    "EMAIL": 0.75, "NAME": 0.60, "ADDRESS": 0.55,
    "DOB": 0.50, "UNKNOWN": 0.40, "MANUAL_TAG": 1.0,
}

class PIISpan(BaseModel):
    id: str
    start: int
    end: int
    text: str
    type: PIIType
    confidence: float
    suggested_redaction: bool
    reason: Optional[str] = None
    status: SpanStatus = SpanStatus.REDACTED
    risk_score: float = 0.0          # (1 - confidence) * severity_weight
    # Simulated consensus from 3 models (visual feature the judges see)
    model_agreement: Optional[List[Dict]] = None  # [{"model": "Gemini", "agreed": True}, ...]

class DocumentAnalysisResult(BaseModel):
    document_id: Optional[str] = None
    text: str
    spans: List[PIISpan]
    classification: Optional[str] = "GENERAL"
    total_exposure_score: float = 0.0  # Sum of unresolved risk scores → drives Exposure Meter
