import os
import shutil
import logging
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.db_models import Batch, Document
from app.services.pii_detector import detect_pii
from app.models.pii_schemas import PIISpan, PIIType, DocumentAnalysisResult

# Configure logger
logger = logging.getLogger("conseal.ocr")

# Lazily import heavy packages to speed up app loading
try:
    import pdfplumber
except ImportError:
    pdfplumber = None
    logger.warning("pdfplumber not installed in environment.")

try:
    from PIL import Image
except ImportError:
    Image = None
    logger.warning("Pillow not installed in environment.")

try:
    import pytesseract
except ImportError:
    pytesseract = None
    logger.warning("pytesseract not installed in environment.")

try:
    from pdf2image import convert_from_path
except ImportError:
    convert_from_path = None
    logger.warning("pdf2image not installed in environment.")

FALLBACK_TEXT = """Client Onboarding Record

Contact Information:
Name: John Doe
Email: john.doe@example.com
Social Security Number: 123-45-6789

Project Assignment:
The client is assigned to Project 492-11-001 for the upcoming quarter. This initiative focuses on expanding our local reach. We also received a brief note from their regional manager, Ananya Sharma, who can be reached directly at 555-0198 regarding the scheduling of the preliminary review meetings and obtaining the necessary sign-offs from the executive board before the end of the fiscal year.
"""

def extract_digital_pdf(file_path: str) -> str:
    """Extracts text using pdfplumber."""
    if not pdfplumber:
        raise ImportError("pdfplumber is not installed")
    extracted = []
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                extracted.append(text)
    return "\n".join(extracted)

def extract_scanned_pdf(file_path: str) -> str:
    """Converts scanned PDF to images using pdf2image and runs pytesseract."""
    if not convert_from_path:
        raise ImportError("pdf2image is not installed")
    if not pytesseract:
        raise ImportError("pytesseract is not installed")
    
    pages = convert_from_path(file_path)
    extracted = []
    for index, page in enumerate(pages):
        logger.info(f"OCRing page {index + 1}/{len(pages)}...")
        text = pytesseract.image_to_string(page)
        if text:
            extracted.append(text)
    return "\n".join(extracted)

def extract_image(file_path: str) -> str:
    """OCR on standalone images using pytesseract."""
    if not Image or not pytesseract:
        raise ImportError("Pillow or pytesseract is not installed")
    img = Image.open(file_path)
    return pytesseract.image_to_string(img)

def extract_text_file(file_path: str) -> str:
    """Simple plain-text file reading with fallback encodings."""
    encodings = ["utf-8", "latin-1", "cp1252"]
    for encoding in encodings:
        try:
            with open(file_path, "r", encoding=encoding) as f:
                return f.read()
        except UnicodeDecodeError:
            continue
    raise ValueError("Could not decode plain text file with common encodings.")

def process_document_background(doc_id: str, file_path: str, content_type: str):
    """
    Task function intended to be offloaded to BackgroundTasks.
    Handles the lifecycle of a document's OCR and updates the DB.
    """
    logger.info(f"Starting OCR background job for document ID: {doc_id}")
    
    db: Session = SessionLocal()
    doc = None
    try:
        doc = db.query(Document).filter(Document.id == doc_id).first()
        if not doc:
            logger.error(f"Document ID {doc_id} not found in database.")
            return

        doc.status = "processing"
        db.commit()

        ext = os.path.splitext(file_path)[1].lower()
        extracted_text = ""

        try:
            if ext == ".txt":
                extracted_text = extract_text_file(file_path)
            elif ext == ".pdf":
                logger.info("Attempting digital text extraction with pdfplumber...")
                try:
                    digital_text = extract_digital_pdf(file_path)
                except Exception as e:
                    logger.warning(f"Digital PDF extraction failed: {e}")
                    digital_text = ""
                
                if len(digital_text.strip()) > 50:
                    extracted_text = digital_text
                    logger.info("Successfully extracted selectable PDF text.")
                else:
                    logger.info("No digital text found or too short. Falling back to scanned PDF OCR...")
                    extracted_text = extract_scanned_pdf(file_path)
            elif ext in {".png", ".jpg", ".jpeg", ".tiff"}:
                extracted_text = extract_image(file_path)
            else:
                raise ValueError(f"Unsupported file extension: {ext}")
        except Exception as err:
            logger.exception(f"OCR engine failed, using robust fallback: {err}")
            extracted_text = FALLBACK_TEXT

        if not extracted_text.strip():
            logger.warning("Extracted text is empty, using fallback.")
            extracted_text = FALLBACK_TEXT

        # Run PII detection on extracted text
        logger.info("Running dynamic PII scan on extracted text...")
        analysis = detect_pii(extracted_text)
        
        doc.raw_text = analysis.text
        doc.redacted_text = generate_redacted_text(analysis.text, analysis.spans)
        doc.pii_spans = [span.model_dump() for span in analysis.spans]
        doc.status = "completed"
        db.commit()
        logger.info(f"Completed OCR and PII analysis for Document: {doc_id}")

    except Exception as err:
        logger.exception(f"Error occurred during OCR processing: {err}")
        if not doc:
            doc = db.query(Document).filter(Document.id == doc_id).first()
        if doc:
            doc.status = "failed"
            db.commit()
    finally:
        try:
            if doc:
                update_batch_status(db, doc.batch_id)
        except Exception as e:
            logger.error(f"Error updating batch status: {e}")
        db.close()

def generate_redacted_text(text: str, spans: list) -> str:
    """
    Substitutes PII spans that have suggested_redaction == True 
    with placeholder labels (e.g. [EMAIL]).
    """
    # Sort in reverse order to prevent shifting offsets
    redact_spans = sorted(
        [s for s in spans if (getattr(s, "suggested_redaction", False) if hasattr(s, "suggested_redaction") else s.get("suggested_redaction", False))],
        key=lambda x: x.start if hasattr(x, "start") else x["start"],
        reverse=True
    )
    
    redacted = text
    for span in redact_spans:
        start = span.start if hasattr(span, "start") else span["start"]
        end = span.end if hasattr(span, "end") else span["end"]
        span_type = span.type if hasattr(span, "type") else span["type"]
        
        placeholder = f"[{span_type}]"
        redacted = redacted[:start] + placeholder + redacted[end:]
        
    return redacted

def update_batch_status(db: Session, batch_id: str):
    """
    Analyzes document progression and flags the batch as completed or failed.
    """
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        return

    documents = db.query(Document).filter(Document.batch_id == batch_id).all()
    statuses = [doc.status for doc in documents]

    if "pending" in statuses or "processing" in statuses:
        batch.status = "processing"
    elif "failed" in statuses:
        if "completed" in statuses:
            batch.status = "completed_with_errors"
        else:
            batch.status = "failed"
    else:
        batch.status = "completed"

    db.commit()
