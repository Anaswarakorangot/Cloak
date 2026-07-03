from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional
from app.models.pii_schemas import PIISpan

class DocumentResponse(BaseModel):
    id: str
    batch_id: str
    file_name: str
    status: str
    content_type: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class BatchResponse(BaseModel):
    id: str
    name: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime
    documents: List[DocumentResponse] = []

    class Config:
        from_attributes = True

class DocumentDetailResponse(BaseModel):
    id: str
    batch_id: str
    file_name: str
    status: str
    content_type: Optional[str] = None
    raw_text: Optional[str] = None
    redacted_text: Optional[str] = None
    pii_spans: Optional[List[PIISpan]] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
