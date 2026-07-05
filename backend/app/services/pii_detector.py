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

Follow-up Notes:
Later that week, Ananya called John to discuss the project. John agreed to the terms. Please ensure all documents are sent to john.doe@example.com before Friday.
"""

# Regex patterns for common PII types
PII_PATTERNS = [
    # Email (highest priority, very specific)
    (r'[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}', PIIType.EMAIL, 0.99, "Matches standard email address format"),
    # SSN: 123-45-6789
    (r'\b\d{3}-\d{2}-\d{4}\b', PIIType.SSN, 0.97, "Matches structured US Social Security Number format"),
    # Phone: various formats
    (r'\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b', PIIType.PHONE, 0.90, "Matches standard phone number pattern"),
    (r'\b\d{3}-\d{4}\b', PIIType.PHONE, 0.65, "Matches 7-digit local phone number pattern"),
    # Date of birth patterns like MM/DD/YYYY or YYYY-MM-DD
    (r'\b\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}\b', PIIType.DOB, 0.72, "Matches typical Date of Birth (MM/DD/YYYY) format"),
    # Street address (number + street name)
    (r'\b\d{1,5}\s+[A-Z][a-zA-Z\s,]+(?:St|Ave|Rd|Blvd|Dr|Ln|Way|Court|Ct|Place|Pl|Drive|Boulevard)(?:[^.!?\n]{0,50}?,\s*[A-Z]{2}\s+\d{5})?\b\.?', PIIType.ADDRESS, 0.82, "Matches common street address structure"),
    # Zip codes (standalone 5 or 9 digit)
    (r'\b\d{5}(?:-\d{4})?\b', PIIType.ADDRESS, 0.55, "Matches standalone 5-digit or 9-digit zip code format"),
    # Account numbers (e.g. #8899-0012-4451)
    (r'\b#?\d{4,}-\d{4,}-\d{4,}\b', PIIType.CUSTOM, 0.90, "Matches typical bank/account number format"),
    # Removing overly broad name regex to prevent false positives on addresses. We rely on Presidio for NAMES.
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
        
        # We intentionally MISS the subsequent mentions of "Ananya" and "John" 
        # so the user can demonstrate the "Manual Redact" auto-propagation feature!
    ]
    
    spans.sort(key=lambda s: s.start)
    return DocumentAnalysisResult(text=MOCK_DOCUMENT_TEXT, spans=spans)


def _classify_document(text: str) -> str:
    text_lower = text.lower()
    
    legal_keywords = ['contract', 'liability', 'plaintiff', 'defendant', 'court', 'litigation', 'subpoena']
    medical_keywords = ['patient', 'diagnosis', 'treatment', 'medical', 'symptom', 'clinic', 'physician', 'hospital']
    financial_keywords = ['account', 'balance', 'transaction', 'invoice', 'payment', 'fiscal', 'tax', 'credit']
    
    scores = {
        'LEGAL': sum(text_lower.count(k) for k in legal_keywords),
        'MEDICAL': sum(text_lower.count(k) for k in medical_keywords),
        'FINANCIAL': sum(text_lower.count(k) for k in financial_keywords)
    }
    
    best_match = max(scores.items(), key=lambda x: x[1])
    if best_match[1] > 2:  # Threshold to be considered a specific type
        return best_match[0]
    return 'GENERAL'

def analyze_text_local(text: str, custom_rules: list = None) -> DocumentAnalysisResult:
    """
    Run local PII detection using Microsoft Presidio + Custom Regex + User Custom Rules.
    Merges both approaches to maximize detection accuracy.
    """
    engine = get_analyzer_engine()
    classification = _classify_document(text)
    
    # 1. Get Regex results
    regex_result = _analyze_text_regex_fallback(text)
    combined_spans = regex_result.spans
    
    # 1.5. Apply User Custom Rules (Regex)
    if custom_rules:
        for rule in custom_rules:
            try:
                # Assuming custom_rules is a list of dicts: {'pattern': str, 'type': str, 'name': str}
                pii_type = PIIType(rule['type'].upper())
            except ValueError:
                pii_type = PIIType.CUSTOM
                
            for match in re.finditer(rule['pattern'], text):
                combined_spans.append(PIISpan(
                    id=str(uuid.uuid4()),
                    start=match.start(),
                    end=match.end(),
                    text=match.group(),
                    type=pii_type,
                    confidence=2.0, # Custom rules are highest priority
                    suggested_redaction=True,
                    reason=f"Matched custom rule: {rule['name']}"
                ))
    
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

                    # Create a human readable reason for Presidio detections
                    entity_name = r.entity_type.replace('_', ' ').title()
                    presidio_reason = f"Detected {entity_name} using NLP entity recognition ({int(r.score * 100)}% confidence)"

                    combined_spans.append(PIISpan(
                        id=str(uuid.uuid4()),
                        start=r.start,
                        end=r.end,
                        text=span_text,
                        type=pii_type,
                        confidence=r.score + 1.0, # Presidio wins over normal regex patterns
                        suggested_redaction=r.score >= 0.70,
                        reason=presidio_reason
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
                last_end = max(last_end, span.end)
                
    # Normalize confidence back to [0, 1] range
    for span in deduplicated:
        if span.confidence >= 2.0:
            span.confidence = 1.0
        elif span.confidence > 1.0:
            span.confidence -= 1.0
                
    # 4. Entity Coreference / Alias Resolution
    # Find all unique NAME spans that were detected
    detected_names = [s.text for s in deduplicated if s.type == PIIType.NAME]
    
    # Extract potential aliases (first names, last names)
    aliases = set()
    for name in detected_names:
        parts = [p for p in name.split() if p.istitle() and len(p) > 2]
        for p in parts:
            aliases.add(p)
            
    # Simple safeguard against common capitalized words
    stop_words = {"The", "And", "For", "Project", "Client", "Company"}
    aliases = set(a for a in aliases if a not in stop_words)

    for alias in aliases:
        for match in re.finditer(rf"\b{re.escape(alias)}\b", text):
            start, end = match.start(), match.end()
            is_covered = any(s.start <= start and s.end >= end for s in deduplicated)
            
            if not is_covered:
                deduplicated.append(PIISpan(
                    id=str(uuid.uuid4()),
                    start=start,
                    end=end,
                    text=alias,
                    type=PIIType.NAME,
                    confidence=0.85, 
                    suggested_redaction=True,
                    reason=f"Identified as an alias/coreference for a previously detected name."
                ))
                
    # Re-sort after coreference
    deduplicated.sort(key=lambda x: (x.start, -x.confidence))

    return DocumentAnalysisResult(text=text, spans=deduplicated, classification=classification)


def _analyze_text_regex_fallback(text: str) -> DocumentAnalysisResult:
    """
    Run regex-based PII detection on any text.
    Returns spans sorted by position, deduplicated (no overlaps).
    """
    candidates = []

    for pattern, pii_type, base_confidence, reason in PII_PATTERNS:
        for match in re.finditer(pattern, text):
            candidates.append({
                'start': match.start(),
                'end': match.end(),
                'text': match.group(),
                'type': pii_type,
                'confidence': base_confidence,
                'reason': reason
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
            reason=c['reason']
        ))

    return DocumentAnalysisResult(text=text, spans=spans)
