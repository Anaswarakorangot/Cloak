from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List
from app.database import get_db
from app.models.db_models import User, CustomRule
from app.services.security import get_current_user

router = APIRouter(prefix="/api/rules", tags=["Rules"])

class RuleRequest(BaseModel):
    name: str = Field(..., min_length=1)
    pattern: str = Field(..., min_length=1)
    entity_type: str = Field(..., min_length=1)

class RuleResponse(RuleRequest):
    id: str
    is_active: str

@router.get("", response_model=List[RuleResponse])
def get_rules(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rules = db.query(CustomRule).filter(CustomRule.user_id == current_user.id).all()
    return rules

@router.post("", response_model=RuleResponse)
def create_rule(payload: RuleRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rule = CustomRule(
        user_id=current_user.id,
        name=payload.name,
        pattern=payload.pattern,
        entity_type=payload.entity_type,
        is_active="true"
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule

@router.delete("/{rule_id}")
def delete_rule(rule_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rule = db.query(CustomRule).filter(CustomRule.id == rule_id, CustomRule.user_id == current_user.id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    db.delete(rule)
    db.commit()
    return {"status": "success"}

@router.patch("/{rule_id}/toggle")
def toggle_rule(rule_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rule = db.query(CustomRule).filter(CustomRule.id == rule_id, CustomRule.user_id == current_user.id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    rule.is_active = "false" if rule.is_active == "true" else "true"
    db.commit()
    db.refresh(rule)
    return rule
