from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, field_validator
from app.database import get_db
from app.models.db_models import User
from app.services.security import hash_password, verify_password, create_access_token

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

class AuthRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)

    @field_validator("password")
    @classmethod
    def validate_password_byte_length(cls, v: str) -> str:
        if len(v.encode("utf-8")) > 72:
            raise ValueError("Password must be 72 bytes or less")
        return v

class TokenResponse(BaseModel):
    status: str
    token: str

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register_user(payload: AuthRequest, db: Session = Depends(get_db)):
    # Normalize username (strip whitespace and convert to lowercase)
    username = payload.username.strip().lower()
    if len(username) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username must be at least 3 characters long"
        )
        
    # Check if user already exists
    existing_user = db.query(User).filter(User.username == username).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    
    # Hash password and create record
    hashed_pwd = hash_password(payload.password)
    new_user = User(username=username, hashed_password=hashed_pwd)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Issue JWT Token
    token = create_access_token(data={"sub": new_user.id, "username": new_user.username})
    return TokenResponse(status="success", token=token)

@router.post("/login", response_model=TokenResponse)
def login_user(payload: AuthRequest, db: Session = Depends(get_db)):
    username = payload.username.strip().lower()
    
    # Authenticate credentials
    user = db.query(User).filter(User.username == username).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
    
    # Issue JWT Token
    token = create_access_token(data={"sub": user.id, "username": user.username})
    return TokenResponse(status="success", token=token)
