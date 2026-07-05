import os
import uuid
import json
import re
import logging
from dotenv import load_dotenv
from app.models.pii_schemas import PIISpan, PIIType, DocumentAnalysisResult

load_dotenv()

logger = logging.getLogger("cloak.gemini")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

SYSTEM_PROMPT = """You are a precise PII (Personally Identifying Information) detection engine.
Analyze the provided text and identify ALL spans of sensitive information.

Return a JSON array of objects. Each object must have:
- "text": the exact string from the document
- "type": one of "NAME", "EMAIL", "PHONE", "SSN", "ADDRESS", "DOB", "UNKNOWN"
- "confidence": a float between 0.0 and 1.0 indicating your certainty
- "reason": a concise one-sentence explanation of why this was flagged

Be thorough. Common patterns to detect:
- Full names (first + last), standalone surnames in context
- Email addresses
- Phone numbers (any format: 555-1234, (555) 123-4567, +1 555 123 4567)
- Social Security Numbers (XXX-XX-XXXX)
- Street addresses, cities with ZIP codes
- Dates of birth
- Any other uniquely identifying data

IMPORTANT: Only return the JSON array, no markdown fences, no extra text.
Example output:
[
  {"text": "John Doe", "type": "NAME", "confidence": 0.98, "reason": "Full person name with first and last name."},
  {"text": "john@example.com", "type": "EMAIL", "confidence": 0.99, "reason": "Valid email address format."}
]
"""


def _find_span_offset(text: str, target: str, search_from: int = 0) -> int:
    """Find the position of target in text, starting from search_from."""
    idx = text.find(target, search_from)
    return idx


def analyze_with_gemini(text: str, custom_rules: list = None) -> DocumentAnalysisResult:
    """
    Call Gemini API to detect PII in the provided text.
    Falls back to regex-based local detection on any failure.
    """
    if not GEMINI_API_KEY:
        logger.warning("No GEMINI_API_KEY found. Falling back to local regex detector.")
        from app.services.pii_detector import analyze_text_local
        return analyze_text_local(text, custom_rules=custom_rules)

    try:
        from google import genai
        from google.genai import types as genai_types
        from app.services.pii_detector import analyze_text_local
        
        # 1. Run local detector FIRST to get the baseline spans
        local_result = analyze_text_local(text, custom_rules=custom_rules)
        
        # Add the privacy justification note to local spans
        for span in local_result.spans:
            if span.suggested_redaction:
                span.reason = f"🔒 Secured Locally: {span.type.value} was masked before sending document to Gemini cloud AI."

        
        # 2. Mask the high-confidence local spans with asterisks to protect them from the cloud
        # We replace characters exactly so the string length and indices remain identical.
        masked_text_chars = list(text)
        for local_span in local_result.spans:
            if local_span.suggested_redaction:
                for i in range(local_span.start, local_span.end):
                    if masked_text_chars[i].isalnum():
                        masked_text_chars[i] = "*"
        masked_text_str = "".join(masked_text_chars)

        # 3. Call Gemini API using the MASKED text for contextual reasoning
        client = genai.Client(api_key=GEMINI_API_KEY)
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            config=genai_types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
            ),
            contents=f"Analyze this document for PII:\n\n{masked_text_str}"
        )
        raw = response.text.strip()

        # Strip markdown code fences if present
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)

        detections = json.loads(raw)
        spans = []
        search_from = 0

        for item in detections:
            span_text = item.get("text", "")
            pii_type_str = item.get("type", "UNKNOWN").upper()
            confidence = float(item.get("confidence", 0.8))
            reason = item.get("reason", "")

            try:
                pii_type = PIIType(pii_type_str)
            except ValueError:
                pii_type = PIIType.UNKNOWN

            start_idx = _find_span_offset(masked_text_str, span_text, search_from)
            if start_idx == -1:
                start_idx = _find_span_offset(masked_text_str, span_text, 0)
            if start_idx == -1:
                # If Gemini modified the string (it shouldn't), try finding it in the original text
                start_idx = _find_span_offset(text, span_text, 0)
                
            if start_idx == -1:
                logger.warning(f"Could not locate span '{span_text}' in text. Skipping.")
                continue

            end_idx = start_idx + len(span_text)
            
            # Since the text was masked, the span_text might contain asterisks.
            # Get the actual original text for this span so the UI displays it correctly.
            original_span_text = text[start_idx:end_idx]
            
            # If the span is purely asterisks or spaces, it means Gemini just re-flagged our masked data. Skip it.
            if all(c == '*' or c.isspace() for c in span_text):
                continue
                
            suggested_redaction = confidence >= 0.7

            spans.append(PIISpan(
                id=str(uuid.uuid4()),
                start=start_idx,
                end=end_idx,
                text=original_span_text,
                type=pii_type,
                confidence=confidence,
                suggested_redaction=suggested_redaction,
                reason=reason
            ))

        # 4. Merge local spans and Gemini spans
        # We give a slight artificial confidence boost to Gemini spans so they win overlap conflicts
        # because Gemini provides 'reasoning' which we want to keep in the UI.
        for g_span in spans:
            g_span.confidence += 0.0001
            
        all_spans = local_result.spans + spans

        # Sort and deduplicate
        all_spans.sort(key=lambda s: (s.start, -s.confidence))
        
        deduplicated = []
        last_end = -1
        for span in all_spans:
            # Normalize confidence if we boosted it
            if span.confidence > 1.0:
                span.confidence -= 0.0001
                
            if span.start >= last_end:
                deduplicated.append(span)
                last_end = span.end
            else:
                if deduplicated and span.confidence > deduplicated[-1].confidence:
                    deduplicated[-1] = span
                    last_end = span.end

        logger.info(f"Gemini (Hybrid) detected {len(deduplicated)} PII spans.")
        return DocumentAnalysisResult(text=text, spans=deduplicated)

    except Exception as e:
        logger.exception(f"Gemini detection failed ({type(e).__name__}): {e}. Falling back to local regex.")
        from app.services.pii_detector import analyze_text_local
        return analyze_text_local(text, custom_rules=custom_rules)
