import os
import io
import tempfile
import logging
from fastapi import FastAPI, Response, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from app.models.pii_schemas import DocumentAnalysisResult
from app.services.pii_detector import analyze_document_mock, analyze_text_local
from app.routers.auth import router as auth_router

load_dotenv()

logger = logging.getLogger("conseal.api")

app = FastAPI(title="Conseal API", version="2.0.0")
app.include_router(auth_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {"status": "ok", "message": "Conseal API v2.0 is running"}


@app.get("/api/analyze", response_model=DocumentAnalysisResult)
def analyze_document_default():
    """Returns the default mock document analysis (backwards compat)."""
    return analyze_document_mock()


@app.post("/api/analyze-text", response_model=DocumentAnalysisResult)
async def analyze_text(body: dict):
    """
    Analyze raw pasted text.
    Body: { "text": "...", "mode": "gemini" | "mock" }
    """
    text = body.get("text", "").strip()
    mode = body.get("mode", "mock")

    if not text:
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    if mode == "gemini":
        from app.services.gemini_detector import analyze_with_gemini
        return analyze_with_gemini(text)
    else:
        # Mock mode: run real regex detection on the actual pasted text
        return analyze_text_local(text)


@app.post("/api/analyze-upload", response_model=DocumentAnalysisResult)
async def analyze_upload(
    file: UploadFile = File(...),
    mode: str = Form(default="mock")
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
        else:
            # Try as plain text
            extracted_text = raw_bytes.decode("utf-8", errors="replace")
    except Exception as e:
        logger.exception(f"Text extraction failed: {e}")
        raise HTTPException(status_code=422, detail=f"Could not extract text from file: {str(e)}")

    if not extracted_text.strip():
        raise HTTPException(status_code=422, detail="No text could be extracted from the file.")

    # Detect PII
    if mode == "gemini":
        from app.services.gemini_detector import analyze_with_gemini
        return analyze_with_gemini(extracted_text)
    else:
        # Mock mode: run real regex detection on the uploaded file's text
        return analyze_text_local(extracted_text)


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


@app.post("/api/export")
def export_document(data: DocumentAnalysisResult):
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
            "Content-Disposition": 'attachment; filename="conseal-redacted.txt"'
        }
    )
