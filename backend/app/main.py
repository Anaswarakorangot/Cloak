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
from app.routers.export import router as export_router
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
    
    # Automatically seed a test user for hackathon judges
    from app.services.security import hash_password
    db = next(get_db())
    admin_user = db.query(User).filter(User.username == "admin").first()
    if not admin_user:
        hashed_pw = hash_password("password123")
        test_user = User(username="admin", hashed_password=hashed_pw)
        db.add(test_user)
        db.commit()
        logger.info("Seeded default test user: admin / password123")

app.include_router(auth_router)
app.include_router(rules_router)
app.include_router(export_router)

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


def _populate_knowledge_graph(db: Session, user_id: str, spans: list):
    from app.models.db_models import KnowledgeGraph
    from app.models.pii_schemas import PIIType
    
    names = list(set([s.text for s in spans if s.type == PIIType.NAME and s.confidence >= 0.7]))
    if len(names) == 1:
        primary_name = names[0]
        for s in spans:
            if s.type in (PIIType.PHONE, PIIType.EMAIL, PIIType.SSN, PIIType.ADDRESS) and s.confidence >= 0.7:
                exists = db.query(KnowledgeGraph).filter(
                    KnowledgeGraph.user_id == user_id,
                    KnowledgeGraph.related_entity_value == s.text
                ).first()
                if not exists:
                    kg = KnowledgeGraph(
                        user_id=user_id,
                        primary_entity_type="NAME",
                        primary_entity_value=primary_name,
                        related_entity_type=s.type.value,
                        related_entity_value=s.text
                    )
                    db.add(kg)
        db.commit()


@app.get("/api/analyze", response_model=DocumentAnalysisResult)
def analyze_document_default(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Returns the default mock document analysis using the real local detector."""
    from app.services.pii_detector import MOCK_DOCUMENT_TEXT, analyze_document_mock
    
    from app.models.db_models import CustomRule, KnowledgeGraph
    db_rules = db.query(CustomRule).filter(CustomRule.user_id == current_user.id, CustomRule.is_active == "true").all()
    custom_rules = [{"pattern": r.pattern, "type": r.entity_type, "name": r.name} for r in db_rules]
    
    db_kg = db.query(KnowledgeGraph).filter(KnowledgeGraph.user_id == current_user.id).all()
    kg_data = [{"related_value": k.related_entity_value, "related_type": k.related_entity_type, "primary_value": k.primary_entity_value} for k in db_kg]
    
    result = analyze_document_mock()
    
    _populate_knowledge_graph(db, current_user.id, result.spans)
    
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
    from app.models.db_models import CustomRule, KnowledgeGraph
    db_rules = db.query(CustomRule).filter(CustomRule.user_id == current_user.id, CustomRule.is_active == "true").all()
    custom_rules = [{"pattern": r.pattern, "type": r.entity_type, "name": r.name} for r in db_rules]

    db_kg = db.query(KnowledgeGraph).filter(KnowledgeGraph.user_id == current_user.id).all()
    kg_data = [{"related_value": k.related_entity_value, "related_type": k.related_entity_type, "primary_value": k.primary_entity_value} for k in db_kg]

    if mode == "gemini":
        from app.services.gemini_detector import analyze_with_gemini
        result = analyze_with_gemini(text, custom_rules=custom_rules, knowledge_graph=kg_data)
    else:
        # Mock mode: run real regex detection on the actual pasted text
        result = analyze_text_local(text, custom_rules=custom_rules, knowledge_graph=kg_data)
        
    _populate_knowledge_graph(db, current_user.id, result.spans)
        
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
    layout_data = None
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
            extracted_text, layout_data = _extract_image_text_and_layout(raw_bytes)
        else:
            # Try as plain text
            extracted_text = raw_bytes.decode("utf-8", errors="replace")
    except Exception as e:
        logger.exception(f"Text extraction failed: {e}")
        raise HTTPException(status_code=422, detail=f"Could not extract text from file: {str(e)}")

    if not extracted_text.strip():
        raise HTTPException(status_code=422, detail="No text could be extracted from the file.")
    # Fetch user custom rules
    from app.models.db_models import CustomRule, KnowledgeGraph
    db_rules = db.query(CustomRule).filter(CustomRule.user_id == current_user.id, CustomRule.is_active == "true").all()
    custom_rules = [{"pattern": r.pattern, "type": r.entity_type, "name": r.name} for r in db_rules]
    
    db_kg = db.query(KnowledgeGraph).filter(KnowledgeGraph.user_id == current_user.id).all()
    kg_data = [{"related_value": k.related_entity_value, "related_type": k.related_entity_type, "primary_value": k.primary_entity_value} for k in db_kg]

    # Detect PII
    if mode == "gemini":
        from app.services.gemini_detector import analyze_with_gemini
        result = analyze_with_gemini(extracted_text, custom_rules=custom_rules, knowledge_graph=kg_data)
    else:
        # Mock mode: run real regex detection on the uploaded file's text
        result = analyze_text_local(extracted_text, custom_rules=custom_rules, knowledge_graph=kg_data)
        
    _populate_knowledge_graph(db, current_user.id, result.spans)
        
    import json
    from app.models.db_models import Batch, Document
    batch = Batch(name=filename or "Uploaded File", user_id=current_user.id, status="processed")
    db.add(batch)
    db.commit()
    db.refresh(batch)
    
    file_path = ""
    if ext in [".pdf", ".png", ".jpg", ".jpeg"]:
        os.makedirs("uploads", exist_ok=True)
        file_path = f"uploads/{batch.id}_{filename}"
        with open(file_path, "wb") as f:
            f.write(raw_bytes)
            
    doc = Document(
        batch_id=batch.id,
        file_name=filename or "document.txt",
        file_path=file_path,
        status="processed",
        raw_text=extracted_text,
        pii_spans=json.dumps([s.dict() for s in result.spans]),
        layout_data=json.dumps(layout_data) if layout_data else None
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    
    result.document_id = doc.id
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

def _extract_image_text_and_layout(raw_bytes: bytes):
    """Extract text and layout from an image using pytesseract."""
    try:
        import pytesseract
        from PIL import Image
        import io
        img = Image.open(io.BytesIO(raw_bytes))
        data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)
        
        words = []
        layout = []
        current_idx = 0
        
        for i in range(len(data['text'])):
            word = data['text'][i]
            if not word.strip():
                continue
                
            words.append(word)
            start_idx = current_idx
            end_idx = current_idx + len(word)
            layout.append({
                'word': word,
                'start': start_idx,
                'end': end_idx,
                'box': {
                    'left': data['left'][i],
                    'top': data['top'][i],
                    'width': data['width'][i],
                    'height': data['height'][i]
                }
            })
            current_idx = end_idx + 1 # +1 for the space
            
        text = " ".join(words)
        return text, layout
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

@app.post("/api/export-pdf")
def export_pdf_document(data: DocumentAnalysisResult, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Redact the original PDF and return it.
    """
    if not data.document_id:
        raise HTTPException(status_code=400, detail="document_id is required to export original PDF")
        
    from app.models.db_models import Document
    doc = db.query(Document).filter(Document.id == data.document_id, Document.batch.has(user_id=current_user.id)).first()
    
    if not doc or not doc.file_path or not os.path.exists(doc.file_path):
        raise HTTPException(status_code=404, detail="Original PDF not found")
        
    try:
        import fitz  # PyMuPDF
        pdf = fitz.open(doc.file_path)
        
        redacted_spans = [span for span in data.spans if span.suggested_redaction]
        
        for page in pdf:
            for span in redacted_spans:
                # Search for the exact text string in the PDF page
                text_instances = page.search_for(span.text)
                for inst in text_instances:
                    # Draw a black rectangle over the text
                    page.add_redact_annot(inst, fill=(0, 0, 0))
            page.apply_redactions()
            
        pdf_bytes = pdf.write()
        pdf.close()
        
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="redacted_{doc.file_name}"'
            }
        )
    except ImportError:
        raise HTTPException(status_code=500, detail="PyMuPDF is not installed on the server.")
    except Exception as e:
        logger.exception(f"PDF redaction failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to redact PDF")

@app.get("/api/documents/{doc_id}/pdf")
def get_original_pdf(doc_id: str, db: Session = Depends(get_db)):
    """
    Serve the original uploaded PDF.
    """
    from app.models.db_models import Document
    from fastapi.responses import FileResponse
    doc = db.query(Document).filter(Document.id == doc_id).first()
    
    if not doc or not doc.file_path or not os.path.exists(doc.file_path):
        raise HTTPException(status_code=404, detail="Original PDF not found")
        
    return FileResponse(doc.file_path, media_type="application/pdf")

@app.post("/api/export-image")
def export_image_document(data: DocumentAnalysisResult, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Redact the original image and return it.
    """
    if not data.document_id:
        raise HTTPException(status_code=400, detail="document_id is required to export original image")
        
    from app.models.db_models import Document
    doc = db.query(Document).filter(Document.id == data.document_id, Document.batch.has(user_id=current_user.id)).first()
    
    if not doc or not doc.file_path or not os.path.exists(doc.file_path):
        raise HTTPException(status_code=404, detail="Original image not found")
        
    if not doc.layout_data:
        raise HTTPException(status_code=400, detail="Document does not have image layout data")
        
    try:
        from PIL import Image, ImageDraw
        import json
        
        img = Image.open(doc.file_path)
        draw = ImageDraw.Draw(img)
        
        layout = json.loads(doc.layout_data)
        redacted_spans = [span for span in data.spans if span.suggested_redaction]
        
        for span in redacted_spans:
            s_start = span.start
            s_end = span.end
            
            for word_box in layout:
                w_start = word_box['start']
                w_end = word_box['end']
                
                if max(s_start, w_start) < min(s_end, w_end):
                    box = word_box['box']
                    draw.rectangle([box['left'], box['top'], box['left'] + box['width'], box['top'] + box['height']], fill="black")
                    
        img_bytes = io.BytesIO()
        ext = os.path.splitext(doc.file_name)[1].lower()
        format = "PNG" if ext == ".png" else "JPEG"
        img.save(img_bytes, format=format)
        img_bytes.seek(0)
        
        media_type = f"image/{format.lower()}"
        
        return StreamingResponse(
            img_bytes,
            media_type=media_type,
            headers={
                "Content-Disposition": f'attachment; filename="redacted_{doc.file_name}"'
            }
        )
    except Exception as e:
        logger.exception(f"Image redaction failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to redact image")
