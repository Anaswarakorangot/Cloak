import os
import io
import tempfile
import logging
from fastapi import FastAPI, Response, UploadFile, File, Form, HTTPException, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from app.models.pii_schemas import DocumentAnalysisResult
from app.services.pii_detector import analyze_document_mock, analyze_text_local
from app.routers.auth import router as auth_router
from app.routers.rules import router as rules_router
from app.database import engine, Base, get_db
from sqlalchemy.orm import Session
from app.services.security import get_current_user
from app.models.db_models import User

load_dotenv()

logger = logging.getLogger("cloak.api")

app = FastAPI(title="Cloak API", version="2.0.0")

@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables initialized.")

app.include_router(auth_router)
app.include_router(rules_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {"status": "ok", "message": "Cloak API v2.0 is running"}

@app.get("/api/stats")
def get_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from app.models.db_models import Document, CustomRule
    import json
    
    docs = db.query(Document).filter(Document.batch.has(user_id=current_user.id)).all()
    docs_processed = sum(1 for d in docs if d.status == "processed")
    pending_review = sum(1 for d in docs if d.status == "pending")
    active_rules = db.query(CustomRule).filter(CustomRule.user_id == current_user.id, CustomRule.is_active == "true").count()
    
    total_redactions = 0
    unreviewed_redactions = 0
    
    for doc in docs:
        if doc.pii_spans:
            try:
                spans = json.loads(doc.pii_spans) if isinstance(doc.pii_spans, str) else doc.pii_spans
                total_redactions += len(spans)
                unreviewed_redactions += sum(1 for s in spans if not s.get("suggested_redaction", True) and s.get("confidence", 1.0) < 0.7)
            except Exception:
                pass
    
    return {
        "documents_processed": docs_processed,
        "pending_review": pending_review,
        "active_rules": active_rules,
        "total_redactions": total_redactions,
        "unreviewed_redactions": unreviewed_redactions
    }

@app.get("/api/documents")
def get_documents(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from app.models.db_models import Document
    import json
    
    docs = db.query(Document).filter(Document.batch.has(user_id=current_user.id)).order_by(Document.created_at.desc()).limit(10).all()
    
    result = []
    for doc in docs:
        redaction_count = 0
        if doc.pii_spans:
            try:
                spans = json.loads(doc.pii_spans) if isinstance(doc.pii_spans, str) else doc.pii_spans
                redaction_count = len(spans)
            except Exception:
                pass
                
        result.append({
            "id": doc.id,
            "file_name": doc.file_name,
            "created_at": doc.created_at.isoformat(),
            "status": doc.status,
            "redaction_count": redaction_count
        })
        
    return result


@app.get("/api/analyze", response_model=DocumentAnalysisResult)
def analyze_document_default(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Returns the default mock document analysis using the real local detector."""
    from app.services.pii_detector import MOCK_DOCUMENT_TEXT, analyze_text_local
    
    from app.models.db_models import CustomRule
    db_rules = db.query(CustomRule).filter(CustomRule.user_id == current_user.id, CustomRule.is_active == "true").all()
    custom_rules = [{"pattern": r.pattern, "type": r.entity_type, "name": r.name} for r in db_rules]
    result = analyze_text_local(MOCK_DOCUMENT_TEXT, custom_rules=custom_rules)
    
    import json
    from app.models.db_models import Batch, Document
    batch = Batch(name="Demo Document", user_id=current_user.id, status="processed")
    db.add(batch)
    db.commit()
    db.refresh(batch)
    
    doc = Document(
        batch_id=batch.id,
        file_name="Demo Document.txt",
        file_path="",
        status="processed",
        raw_text=MOCK_DOCUMENT_TEXT,
        pii_spans=json.dumps([s.dict() for s in result.spans])
    )
    db.add(doc)
    db.commit()
    
    return result


@app.post("/api/analyze-text", response_model=DocumentAnalysisResult)
async def analyze_text(body: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Analyze raw pasted text.
    Body: { "text": "...", "mode": "gemini" | "mock" }
    """
    text = body.get("text", "").strip()
    mode = body.get("mode", "mock")

    if not text:
        raise HTTPException(status_code=400, detail="Text cannot be empty.")
        
    # Fetch user custom rules
    from app.models.db_models import CustomRule
    db_rules = db.query(CustomRule).filter(CustomRule.user_id == current_user.id, CustomRule.is_active == "true").all()
    custom_rules = [{"pattern": r.pattern, "type": r.entity_type, "name": r.name} for r in db_rules]

    if mode == "gemini":
        from app.services.gemini_detector import analyze_with_gemini
        result = analyze_with_gemini(text, custom_rules=custom_rules)
    else:
        # Mock mode: run real regex detection on the actual pasted text
        result = analyze_text_local(text, custom_rules=custom_rules)
        
    import json
    from app.models.db_models import Batch, Document
    
    snippet = text[:30] + "..." if len(text) > 30 else text
    batch = Batch(name=snippet, user_id=current_user.id, status="processed")
    db.add(batch)
    db.commit()
    db.refresh(batch)
    
    doc = Document(
        batch_id=batch.id,
        file_name=snippet,
        file_path="",
        status="processed",
        raw_text=text,
        pii_spans=json.dumps([s.dict() for s in result.spans])
    )
    db.add(doc)
    db.commit()
    
    return result


@app.post("/api/analyze-upload", response_model=DocumentAnalysisResult)
async def analyze_upload(
    file: UploadFile = File(...),
    mode: str = Form(default="mock"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload a .txt or .pdf file and analyze it for PII.
    mode: "gemini" or "mock"
    """
    content_type = file.content_type or ""
    filename = file.filename or ""
    ext = os.path.splitext(filename)[1].lower()

    raw_bytes = await file.read()

    # Extract text
    extracted_text = ""
    try:
        if ext == ".txt" or "text/plain" in content_type:
            # Try UTF-8 first then latin-1
            for encoding in ["utf-8", "latin-1", "cp1252"]:
                try:
                    extracted_text = raw_bytes.decode(encoding)
                    break
                except UnicodeDecodeError:
                    continue
        elif ext == ".pdf" or "pdf" in content_type:
            extracted_text = _extract_pdf_text(raw_bytes)
        elif ext in [".png", ".jpg", ".jpeg"] or "image/" in content_type:
            extracted_text = _extract_image_text(raw_bytes)
        else:
            # Try as plain text
            extracted_text = raw_bytes.decode("utf-8", errors="replace")
    except Exception as e:
        logger.exception(f"Text extraction failed: {e}")
        raise HTTPException(status_code=422, detail=f"Could not extract text from file: {str(e)}")

    if not extracted_text.strip():
        raise HTTPException(status_code=422, detail="No text could be extracted from the file.")
    # Fetch user custom rules
    from app.models.db_models import CustomRule
    db_rules = db.query(CustomRule).filter(CustomRule.user_id == current_user.id, CustomRule.is_active == "true").all()
    custom_rules = [{"pattern": r.pattern, "type": r.entity_type, "name": r.name} for r in db_rules]

    # Detect PII
    if mode == "gemini":
        from app.services.gemini_detector import analyze_with_gemini
        result = analyze_with_gemini(extracted_text, custom_rules=custom_rules)
    else:
        # Mock mode: run real regex detection on the uploaded file's text
        result = analyze_text_local(extracted_text, custom_rules=custom_rules)
        
    import json
    from app.models.db_models import Batch, Document
    batch = Batch(name=filename or "Uploaded File", user_id=current_user.id, status="processed")
    db.add(batch)
    db.commit()
    db.refresh(batch)
    
    doc = Document(
        batch_id=batch.id,
        file_name=filename or "document.txt",
        file_path="",
        status="processed",
        raw_text=extracted_text,
        pii_spans=json.dumps([s.dict() for s in result.spans])
    )
    db.add(doc)
    db.commit()
    
    return result


def _extract_pdf_text(raw_bytes: bytes) -> str:
    """Extract text from a PDF using pdfplumber."""
    try:
        import pdfplumber
        with pdfplumber.open(io.BytesIO(raw_bytes)) as pdf:
            pages = []
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    pages.append(text)
            extracted = "\n".join(pages)
            if extracted.strip():
                return extracted
    except Exception as e:
        logger.warning(f"pdfplumber failed: {e}")

    # Fallback: try OCR if available
    try:
        import pytesseract
        from pdf2image import convert_from_bytes
        images = convert_from_bytes(raw_bytes)
        pages = [pytesseract.image_to_string(img) for img in images]
        return "\n".join(pages)
    except Exception as e:
        logger.warning(f"OCR fallback also failed: {e}")

    raise ValueError("Could not extract text from PDF.")

def _extract_image_text(raw_bytes: bytes) -> str:
    """Extract text from an image directly using pytesseract."""
    try:
        import pytesseract
        from PIL import Image
        import io
        img = Image.open(io.BytesIO(raw_bytes))
        return pytesseract.image_to_string(img)
    except Exception as e:
        logger.exception(f"Image OCR failed: {e}")
        raise ValueError(f"Could not extract text from image: {e}")


@app.post("/api/export")
def export_document(data: DocumentAnalysisResult, current_user: User = Depends(get_current_user)):
    """
    Export the finalized document, replacing suggested redactions with [TYPE] labels.
    Returns a downloadable .txt file.
    """
    text = data.text

    # Sort spans in reverse order to preserve indices during replacement
    redacted_spans = sorted(
        [span for span in data.spans if span.suggested_redaction],
        key=lambda x: x.start,
        reverse=True
    )

    for span in redacted_spans:
        label = f"[{span.type.upper()}]"
        text = text[:span.start] + label + text[span.end:]

    return StreamingResponse(
        io.BytesIO(text.encode("utf-8")),
        media_type="text/plain",
        headers={
            "Content-Disposition": 'attachment; filename="cloak-redacted.txt"'
        }
    )
