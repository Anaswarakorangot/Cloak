import re
import uuid
import logging
from app.models.pii_schemas import PIISpan, PIIType, DocumentAnalysisResult

logger = logging.getLogger(__name__)

analyzer_engine = None

def get_analyzer_engine():
    global analyzer_engine
    if analyzer_engine is None:
        try:
            from presidio_analyzer import AnalyzerEngine
            from presidio_analyzer.nlp_engine import NlpEngineProvider
            
            # Configure to use the small spacy model to avoid 400MB downloads
            configuration = {
                "nlp_engine_name": "spacy",
                "models": [{"lang_code": "en", "model_name": "en_core_web_sm"}],
            }
            provider = NlpEngineProvider(nlp_configuration=configuration)
            nlp_engine = provider.create_engine()
            
            analyzer_engine = AnalyzerEngine(nlp_engine=nlp_engine, supported_languages=["en"])
            logger.info("Presidio AnalyzerEngine initialized with en_core_web_sm.")
        except ImportError:
            logger.warning("presidio-analyzer not installed, falling back to regex.")
            return None
    return analyzer_engine

MOCK_DOCUMENT_TEXT = """Client Onboarding Record

Contact Information:
Name: John Doe
Email: john.doe@example.com
Social Security Number: 123-45-6789

Project Assignment:
The client is assigned to Project 492-11-001 for the upcoming quarter. This initiative focuses on expanding our local reach. We also received a brief note from their regional manager, Ananya Sharma, who can be reached directly at 555-0198 regarding the scheduling of the preliminary review meetings and obtaining the necessary sign-offs from the executive board before the end of the fiscal year.
"""

# Regex patterns for common PII types
PII_PATTERNS = [
    # Email (highest priority, very specific)
    (r'[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}', PIIType.EMAIL, 0.99),
    # SSN: 123-45-6789
    (r'\b\d{3}-\d{2}-\d{4}\b', PIIType.SSN, 0.97),
    # Phone: various formats
    (r'\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b', PIIType.PHONE, 0.90),
    (r'\b\d{3}-\d{4}\b', PIIType.PHONE, 0.65),
    # Date of birth patterns like MM/DD/YYYY or YYYY-MM-DD
    (r'\b\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}\b', PIIType.DOB, 0.72),
    # Street address (number + street name)
    (r'\b\d{1,5}\s+[A-Z][a-z]+(?:\s+[A-Za-z]+){1,3}(?:St|Ave|Rd|Blvd|Dr|Ln|Way|Court|Ct|Place|Pl|Drive)\b\.?', PIIType.ADDRESS, 0.82),
    # Zip codes (standalone 5 or 9 digit)
    (r'\b\d{5}(?:-\d{4})?\b', PIIType.ADDRESS, 0.55),
    # Full names: Capitalized First + Last (with optional middle)
    (r'\b[A-Z][a-z]{1,20}(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]{1,25}\b', PIIType.NAME, 0.75),
]


def _create_span(text_to_find: str, pii_type: PIIType, confidence: float, suggested_redaction: bool) -> PIISpan:
    start_idx = MOCK_DOCUMENT_TEXT.find(text_to_find)
    if start_idx == -1:
        raise ValueError(f"Could not find '{text_to_find}' in mock text.")
    
    return PIISpan(
        id=str(uuid.uuid4()),
        start=start_idx,
        end=start_idx + len(text_to_find),
        text=text_to_find,
        type=pii_type,
        confidence=confidence,
        suggested_redaction=suggested_redaction
    )

def analyze_document_mock() -> DocumentAnalysisResult:
    """
    Returns the canonical mock document with predefined edge cases for demo.
    This is ONLY for the demo shortcut — real uploads use analyze_text_local().
    """
    spans = [
        # True Positives (High confidence, redacted)
        _create_span("John Doe", PIIType.NAME, 0.98, True),
        _create_span("john.doe@example.com", PIIType.EMAIL, 0.99, True),
        _create_span("123-45-6789", PIIType.SSN, 0.95, True),
        
        # False Positive (High confidence, redacted incorrectly — project code looks like SSN)
        _create_span("492-11-001", PIIType.SSN, 0.92, True),
        
        # False Negatives (Missed PII — low confidence, NOT redacted by default)
        _create_span("Ananya Sharma", PIIType.NAME, 0.45, False),
        _create_span("555-0198", PIIType.PHONE, 0.38, False),
    ]
    
    spans.sort(key=lambda s: s.start)
    return DocumentAnalysisResult(text=MOCK_DOCUMENT_TEXT, spans=spans)


def analyze_text_local(text: str) -> DocumentAnalysisResult:
    """
    Run local PII detection using Microsoft Presidio + Custom Regex.
    Merges both approaches to maximize detection accuracy.
    """
    engine = get_analyzer_engine()
    
    # 1. Get Regex results
    regex_result = _analyze_text_regex_fallback(text)
    combined_spans = regex_result.spans
    
    # 2. Get Presidio results (if available)
    if engine is not None:
        PRESIDIO_TO_PII = {
            "PERSON": PIIType.NAME,
            "EMAIL_ADDRESS": PIIType.EMAIL,
            "PHONE_NUMBER": PIIType.PHONE,
            "US_SSN": PIIType.SSN,
            "US_PASSPORT": PIIType.UNKNOWN,
            "US_DRIVER_LICENSE": PIIType.UNKNOWN,
            "US_BANK_NUMBER": PIIType.UNKNOWN,
            "CREDIT_CARD": PIIType.UNKNOWN,
            "LOCATION": PIIType.ADDRESS,
            # "DATE_TIME": PIIType.DOB, # Disabled to prevent false positives on phrases like "upcoming quarter"
        }

        try:
            results = engine.analyze(text=text, entities=list(PRESIDIO_TO_PII.keys()), language='en')
            for r in results:
                pii_type = PRESIDIO_TO_PII.get(r.entity_type, PIIType.UNKNOWN)
                if pii_type != PIIType.UNKNOWN:
                    span_text = text[r.start:r.end]
                    # Fix bug where presidio includes trailing newlines
                    clean_text = span_text.strip()
                    if len(clean_text) < len(span_text):
                        r.end = r.start + len(clean_text)
                        span_text = clean_text

                    if not span_text:
                        continue

                    combined_spans.append(PIISpan(
                        id=str(uuid.uuid4()),
                        start=r.start,
                        end=r.end,
                        text=span_text,
                        type=pii_type,
                        confidence=r.score,
                        suggested_redaction=r.score >= 0.70,
                        reason=None
                    ))
        except Exception as e:
            logger.warning(f"Presidio analysis failed: {e}. Relying solely on regex.")

    # 3. Merge and deduplicate (prefer higher confidence)
    combined_spans.sort(key=lambda x: (x.start, -x.confidence))
    
    deduplicated = []
    last_end = -1
    for span in combined_spans:
        if span.start >= last_end:
            deduplicated.append(span)
            last_end = span.end
        else:
            # Overlapping span
            if deduplicated and span.confidence > deduplicated[-1].confidence:
                deduplicated[-1] = span
                last_end = span.end
                
    return DocumentAnalysisResult(text=text, spans=deduplicated)


def _analyze_text_regex_fallback(text: str) -> DocumentAnalysisResult:
    """
    Run regex-based PII detection on any text.
    Returns spans sorted by position, deduplicated (no overlaps).
    """
    candidates = []

    for pattern, pii_type, base_confidence in PII_PATTERNS:
        for match in re.finditer(pattern, text):
            candidates.append({
                'start': match.start(),
                'end': match.end(),
                'text': match.group(),
                'type': pii_type,
                'confidence': base_confidence,
            })

    # Sort by start, then break ties by keeping higher confidence
    candidates.sort(key=lambda c: (c['start'], -c['confidence']))

    # Deduplicate: remove overlapping spans (keep highest confidence per region)
    deduplicated = []
    last_end = -1
    for c in candidates:
        if c['start'] >= last_end:
            deduplicated.append(c)
            last_end = c['end']
        else:
            # Overlapping — keep whichever has higher confidence
            if deduplicated and c['confidence'] > deduplicated[-1]['confidence']:
                deduplicated[-1] = c
                last_end = c['end']

    spans = []
    for c in deduplicated:
        spans.append(PIISpan(
            id=str(uuid.uuid4()),
            start=c['start'],
            end=c['end'],
            text=c['text'],
            type=c['type'],
            confidence=c['confidence'],
            suggested_redaction=c['confidence'] >= 0.70,
            reason=None  # No Gemini reason for local detection
        ))

    return DocumentAnalysisResult(text=text, spans=spans)
