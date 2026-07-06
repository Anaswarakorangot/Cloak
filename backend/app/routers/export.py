import io, csv, zipfile
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List
from app.models.pii_schemas import PIISpan

router = APIRouter()

class ExportRequest(BaseModel):
    document_text: str
    spans: List[PIISpan]
    file_name: str

@router.post("/api/export")
async def export_document(request: ExportRequest):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        # 1. Audit log CSV
        csv_buf = io.StringIO()
        w = csv.writer(csv_buf)
        w.writerow(["Entity", "Type", "Confidence", "Risk Score", "Status", "Reason"])
        for s in request.spans:
            w.writerow([s.text, s.type.value, f"{s.confidence:.0%}",
                        f"{s.risk_score:.4f}", s.status.value, s.reason or "Auto-detected"])
        zf.writestr("audit_log.csv", csv_buf.getvalue())

        # 2. Redacted text document
        out = request.document_text
        for s in sorted(request.spans, key=lambda x: x.start, reverse=True):
            if s.suggested_redaction or s.status == "REDACTED":
                out = out[:s.start] + f"[REDACTED-{s.type.value}]" + out[s.end:]
        zf.writestr("redacted_document.txt", out)

    buf.seek(0)
    return StreamingResponse(buf, media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename=cloak_{request.file_name}.zip"})
