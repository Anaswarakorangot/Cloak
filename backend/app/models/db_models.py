import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, JSON, Text
from sqlalchemy.orm import relationship
from app.database import Base

def generate_uuid():
    return str(uuid.uuid4())

def utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    username = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    # Relationships
    batches = relationship("Batch", back_populates="user", cascade="all, delete-orphan")
    custom_rules = relationship("CustomRule", back_populates="user", cascade="all, delete-orphan")

class Batch(Base):
    __tablename__ = "batches"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=True)
    status = Column(String(50), default="pending", nullable=False)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    # Relationships
    user = relationship("User", back_populates="batches")
    documents = relationship("Document", back_populates="batch", cascade="all, delete-orphan")

class Document(Base):
    __tablename__ = "documents"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    batch_id = Column(String(36), ForeignKey("batches.id", ondelete="CASCADE"), nullable=False, index=True)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    status = Column(String(50), default="pending", nullable=False)
    content_type = Column(String(100), nullable=True)
    raw_text = Column(Text, nullable=True)
    redacted_text = Column(Text, nullable=True)
    pii_spans = Column(JSON, nullable=True)
    layout_data = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    # Relationships
    batch = relationship("Batch", back_populates="documents")

class CustomRule(Base):
    __tablename__ = "custom_rules"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    pattern = Column(String(500), nullable=False)
    entity_type = Column(String(50), nullable=False)
    is_active = Column(String(10), default="true", nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)
    
    # Relationships
    user = relationship("User", back_populates="custom_rules")

class KnowledgeGraph(Base):
    __tablename__ = "knowledge_graph"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    primary_entity_type = Column(String(50), nullable=False, default="NAME") 
    primary_entity_value = Column(String(255), nullable=False) 
    related_entity_type = Column(String(50), nullable=False) 
    related_entity_value = Column(String(255), nullable=False) 
    created_at = Column(DateTime, default=utc_now, nullable=False)
    
    user = relationship("User")
