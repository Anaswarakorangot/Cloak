import os
import re
import uuid
import logging
from app.models.pii_schemas import PIISpan, PIIType, DocumentAnalysisResult, SEVERITY_WEIGHTS, SpanStatus

logger = logging.getLogger(__name__)

def _compute_risk_score(pii_type: str, confidence: float) -> float:
    """Core PS3 formula: higher score = more dangerous."""
    weight = SEVERITY_WEIGHTS.get(pii_type, 0.4)
    return round((1 - confidence) * weight, 4)

def _make_consensus(pii_type: str, confidence: float):
    """Simulate 3-model consensus. High confidence = all agree. Low = split."""
    if confidence >= 0.90:
        return [
            {"model": "NLP Engine", "agreed": True},
            {"model": "Regex Layer", "agreed": True},
            {"model": "Context Check", "agreed": True},
        ]
    elif confidence >= 0.60:
        return [
            {"model": "NLP Engine", "agreed": True},
            {"model": "Regex Layer", "agreed": True},
            {"model": "Context Check", "agreed": False},
        ]
    else:
        return [
            {"model": "NLP Engine", "agreed": True},
            {"model": "Regex Layer", "agreed": False},
            {"model": "Context Check", "agreed": False},
        ]

analyzer_engine = None

def get_analyzer_engine():
    global analyzer_engine
    if analyzer_engine is None:
        if os.getenv("DISABLE_PRESIDIO") == "true":
            logger.warning("PRESIDIO disabled via env. Bypassing Spacy NLP. Falling back to Regex.")
            return None
            
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
    (r'\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b', PIIType.PHONE, 0.90, "Matches standard US/CA phone number pattern"),
    (r'\b(?:\+?91|0)?[-\s]?[6-9]\d{4}[-\s]?\d{5}\b', PIIType.PHONE, 0.90, "Matches Indian phone number pattern"),
    (r'\B\+[1-9]\d{1,14}\b', PIIType.PHONE, 0.85, "Matches standard E.164 international phone number format"),
    (r'\b\d{3}-\d{4}\b', PIIType.PHONE, 0.65, "Matches 7-digit local phone number pattern"),
    # Date of birth patterns like MM/DD/YYYY or YYYY-MM-DD
    (r'\b\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}\b', PIIType.DOB, 0.72, "Matches typical Date of Birth (MM/DD/YYYY) format"),
    # Street address (number + street name)
    (r'\b\d{1,5}\s+[A-Z][a-zA-Z\s,]+(?:St|Ave|Rd|Blvd|Dr|Ln|Way|Court|Ct|Place|Pl|Drive|Boulevard)(?:[^.!?\n]{0,50}?,\s*[A-Z]{2}\s+\d{5})?\b\.?', PIIType.ADDRESS, 0.82, "Matches common US/UK street address structure"),
    (r'\b\d{1,5}[a-zA-Z]?\s*[-,/]?\s*\d{0,5}\s+[a-zA-Z\s,]+(?:Marg|Path|Gali|Layout|Block|Sector|Nagar|Colony|Enclave|Bagh|Vihar|Phase|Cross|Main|Street|Road)(?:[^.!?\n]{0,80}?)(?:,\s*[a-zA-Z\s]+)?\s*(?:-\s*)?\d{6}\b\.?', PIIType.ADDRESS, 0.85, "Matches common Indian/South Asian street address structures"),
    # Zip/PIN codes (standalone)
    (r'\b\d{5}(?:-\d{4})?\b', PIIType.ADDRESS, 0.55, "Matches standalone 5-digit or 9-digit US zip code format"),
    (r'\b[1-9]\d{2}\s?\d{3}\b', PIIType.ADDRESS, 0.60, "Matches standalone 6-digit Indian PIN code format"),
    # Bank Account numbers (e.g. #8899-0012-4451)
    (r'\b#?\d{4,}-\d{4,}-\d{4,}\b', PIIType.BANK_ACCOUNT, 0.90, "Matches typical bank/account number format"),
    # Credit Card (Visa, MasterCard, Amex, Discover)
    (r'\b(?:\d{4}[ -]?){3}\d{4}\b', PIIType.CREDIT_CARD, 0.95, "Matches standard 16-digit credit card pattern"),
    (r'\b3[47]\d{2}[ -]?\d{6}[ -]?\d{5}\b', PIIType.CREDIT_CARD, 0.95, "Matches Amex credit card pattern"),
    # IP Addresses (IPv4 and basic IPv6)
    (r'\b(?:\d{1,3}\.){3}\d{1,3}\b', PIIType.IP_ADDRESS, 0.75, "Matches IPv4 address"),
    (r'\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b', PIIType.IP_ADDRESS, 0.75, "Matches IPv6 address"),
    # MAC Address
    (r'\b(?:[0-9A-Fa-f]{2}[:-]){5}(?:[0-9A-Fa-f]{2})\b', PIIType.MAC_ADDRESS, 0.85, "Matches MAC address"),
    # US Passport
    (r'\b[A-Z]{1,2}\d{6,9}\b', PIIType.PASSPORT, 0.85, "Matches alphanumeric passport number format"),
    # Driver's License
    (r'\b(?:DL-)?[A-Z]{1,2}[ -]?\d{6,8}[ -]?[A-Z0-9]?\b', PIIType.DRIVER_LICENSE, 0.85, "Matches generic driver's license formats"),
    # Crypto Wallets (BTC, ETH)
    (r'\b(?:bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}\b', PIIType.CRYPTO_WALLET, 0.90, "Matches Bitcoin wallet address"),
    (r'\b0x[a-fA-F0-9]{40}\b', PIIType.CRYPTO_WALLET, 0.95, "Matches Ethereum wallet address"),
    # Vehicle Identification Number (VIN)
    (r'\b[A-HJ-NPR-Z0-9]{17}\b', PIIType.VIN, 0.60, "Matches 17-character VIN pattern"),
    # Tax/Employer ID
    (r'\b\d{2}-\d{7}\b', PIIType.TAX_ID, 0.88, "Matches US EIN/Tax ID format"),
]


def analyze_document_mock() -> DocumentAnalysisResult:
    raw = [
        # (text, type, confidence, auto_redact, reason)
        ("John Doe",             "NAME",  0.98, True,  "High-confidence person name detected by NLP engine."),
        ("john.doe@example.com", "EMAIL", 0.99, True,  "Standard email regex match with full domain validation."),
        ("123-45-6789",          "SSN",   0.97, True,  "9-digit SSN format confirmed. All 3 detection layers agreed."),
        # False Positive — project ID looks like SSN
        ("492-11-001",           "SSN",   0.60, True,  "WARNING: Regex matched SSN pattern, but context suggests project code. Review recommended."),
        # False Negatives — dangerous misses, HIGH risk_score
        ("Ananya Sharma",        "NAME",  0.45, False, "Low-confidence name. Only 1 of 3 detection layers flagged this."),
        ("555-0198",             "PHONE", 0.38, False, "7-digit local phone number. Ambiguous without area code. High false-negative risk."),
    ]

    spans = []
    for text, pii_type, confidence, suggested, reason in raw:
        # Find all occurrences in the mock document
        for match in re.finditer(re.escape(text), MOCK_DOCUMENT_TEXT):
            start = match.start()
            risk = _compute_risk_score(pii_type, confidence)
            spans.append(PIISpan(
                id=str(uuid.uuid4()),
                start=start, end=start + len(text),
                text=text, type=PIIType(pii_type),
                confidence=confidence, suggested_redaction=suggested,
                reason=reason,
                status=SpanStatus.PENDING,
                risk_score=risk,
                model_agreement=_make_consensus(pii_type, confidence)
            ))

    # CRITICAL: Sort by risk_score descending — highest danger reviewed first
    spans.sort(key=lambda s: -s.risk_score)
    unresolved_risk = sum(s.risk_score for s in spans if s.status == SpanStatus.KEPT_VISIBLE)
    return DocumentAnalysisResult(
        text=MOCK_DOCUMENT_TEXT, spans=spans,
        total_exposure_score=round(unresolved_risk, 4)
    )


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

def analyze_text_local(text: str, custom_rules: list = None, knowledge_graph: list = None) -> DocumentAnalysisResult:
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
                
    # 1.75 Apply Knowledge Graph Connections
    if knowledge_graph:
        for kg in knowledge_graph:
            val = kg.get('related_value')
            if not val: continue
            for match in re.finditer(re.escape(val), text, re.IGNORECASE):
                try:
                    pii_type = PIIType(kg.get('related_type', 'UNKNOWN'))
                except ValueError:
                    pii_type = PIIType.UNKNOWN
                
                combined_spans.append(PIISpan(
                    id=str(uuid.uuid4()),
                    start=match.start(),
                    end=match.end(),
                    text=match.group(),
                    type=pii_type,
                    confidence=1.9, # High priority, right below custom rules
                    suggested_redaction=True,
                    reason=f"Known Entity (Knowledge Graph): Historically linked to {kg.get('primary_value')}"
                ))

    # 2. Get Presidio results (if available)
    if engine is not None:
        PRESIDIO_TO_PII = {
            "PERSON": PIIType.NAME,
            "EMAIL_ADDRESS": PIIType.EMAIL,
            "PHONE_NUMBER": PIIType.PHONE,
            "US_SSN": PIIType.SSN,
            "US_PASSPORT": PIIType.PASSPORT,
            "US_DRIVER_LICENSE": PIIType.DRIVER_LICENSE,
            "US_BANK_NUMBER": PIIType.BANK_ACCOUNT,
            "CREDIT_CARD": PIIType.CREDIT_CARD,
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
    for span in deduplicated:
        span.risk_score = _compute_risk_score(span.type.value, span.confidence)
        span.model_agreement = _make_consensus(span.type.value, span.confidence)
        span.status = SpanStatus.REDACTED if span.suggested_redaction else SpanStatus.PENDING

    deduplicated.sort(key=lambda x: -x.risk_score)
    unresolved_risk = sum(s.risk_score for s in deduplicated if s.status == SpanStatus.PENDING and s.suggested_redaction == False)

    return DocumentAnalysisResult(text=text, spans=deduplicated, classification=classification, total_exposure_score=round(unresolved_risk, 4))


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
        suggested = c['confidence'] >= 0.70
        risk = _compute_risk_score(c['type'].value, c['confidence'])
        spans.append(PIISpan(
            id=str(uuid.uuid4()),
            start=c['start'],
            end=c['end'],
            text=c['text'],
            type=c['type'],
            confidence=c['confidence'],
            suggested_redaction=suggested,
            reason=c['reason'],
            status=SpanStatus.REDACTED if suggested else SpanStatus.PENDING,
            risk_score=risk,
            model_agreement=_make_consensus(c['type'].value, c['confidence'])
        ))

    spans.sort(key=lambda x: -x.risk_score)
    unresolved_risk = sum(s.risk_score for s in spans if s.status == SpanStatus.PENDING and s.suggested_redaction == False)
    return DocumentAnalysisResult(text=text, spans=spans, total_exposure_score=round(unresolved_risk, 4))
