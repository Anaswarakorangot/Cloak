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
    CREDIT_CARD = "CREDIT_CARD"
    BANK_ACCOUNT = "BANK_ACCOUNT"
    IP_ADDRESS = "IP_ADDRESS"
    MAC_ADDRESS = "MAC_ADDRESS"
    PASSPORT = "PASSPORT"
    DRIVER_LICENSE = "DRIVER_LICENSE"
    CRYPTO_WALLET = "CRYPTO_WALLET"
    VIN = "VIN"
    TAX_ID = "TAX_ID"
    MEDICAL_RECORD = "MEDICAL_RECORD"

class SpanStatus(str, Enum):
    REDACTED = "REDACTED"
    KEPT_VISIBLE = "KEPT_VISIBLE"
    STAGED_FOR_DISMISSAL = "STAGED_FOR_DISMISSAL"
    PENDING = "PENDING"  # First step of 2-step friction

# The severity weight table — drives the risk score formula
SEVERITY_WEIGHTS: Dict[str, float] = {
    "SSN": 1.00, "CREDIT_CARD": 0.98, "BANK_ACCOUNT": 0.98, "PASSPORT": 0.97,
    "CRYPTO_WALLET": 0.96, "TAX_ID": 0.95, "MEDICAL_RECORD": 0.95,
    "DRIVER_LICENSE": 0.92, "CUSTOM": 0.90, "PHONE": 0.80,
    "EMAIL": 0.75, "NAME": 0.60, "ADDRESS": 0.55,
    "IP_ADDRESS": 0.40, "MAC_ADDRESS": 0.35, "VIN": 0.30,
    "DOB": 0.20, "UNKNOWN": 0.10, "MANUAL_TAG": 1.00
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
