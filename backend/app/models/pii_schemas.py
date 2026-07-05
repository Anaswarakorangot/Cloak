from enum import Enum
from pydantic import BaseModel
from typing import List, Optional

class PIIType(str, Enum):
    NAME = "NAME"
    EMAIL = "EMAIL"
    PHONE = "PHONE"
    SSN = "SSN"
    ADDRESS = "ADDRESS"
    DOB = "DOB"
    UNKNOWN = "UNKNOWN"
    CUSTOM = "CUSTOM"

class PIISpan(BaseModel):
    id: str
    start: int
    end: int
    text: str
    type: PIIType
    confidence: float
    # If the tool decided to redact it (high confidence) or just flag for review (low confidence)
    suggested_redaction: bool
    reason: Optional[str] = None  # Explanation from Gemini AI

class DocumentAnalysisResult(BaseModel):
    document_id: Optional[int] = None
    text: str
    spans: List[PIISpan]
    classification: Optional[str] = "GENERAL"
