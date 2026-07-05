import pytest
import jwt
from datetime import timedelta, datetime, timezone
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.main import app
from app.database import SessionLocal, get_db
from app.models.db_models import User, Batch, Document
from app.services.security import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
    get_current_user,
    JWT_SECRET_KEY,
    JWT_ALGORITHM,
)

@pytest.fixture
def client():
    return TestClient(app, raise_server_exceptions=False)

@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture(autouse=True)
def cleanup_users(db_session: Session):
    # Clean up test users before and after tests
    usernames_to_clean = [
        "test_adv_user", "test_long_pwd", "🚀🌟🔥", "test_fk_user", "dup_user"
    ]
    for username in usernames_to_clean:
        user = db_session.query(User).filter(User.username == username).first()
        if user:
            # Delete related batches first manually if needed, or rely on cascade
            db_session.delete(user)
    db_session.commit()
    yield
    for username in usernames_to_clean:
        user = db_session.query(User).filter(User.username == username).first()
        if user:
            db_session.delete(user)
    db_session.commit()

# ------------------------------------------------------------------------------
# 1. SQL Injection (SQLi) Attacks
# ------------------------------------------------------------------------------

def test_sqli_registration_and_login(client):
    sqli_payloads = [
        "' OR '1'='1",
        "admin'--",
        "'; DROP TABLE users;--",
        "\" OR \"\"",
        "') OR ('1'='1"
    ]
    for payload in sqli_payloads:
        # 1. Test register. It should register it as a literal string (if it passes validation)
        # or reject it if it fails length validation. It should NEVER crash the DB or cause syntax errors.
        username = payload[:50] # Keep within pydantic length constraint
        if len(username) < 3:
            username = username + "abc" # ensure min length
        
        reg_response = client.post("/api/auth/register", json={"username": username, "password": "securepassword123"})
        
        # If it was registered successfully or failed due to standard validation
        if reg_response.status_code == 201:
            # Login with the exact SQLi payload username
            login_response = client.post("/api/auth/login", json={"username": username, "password": "securepassword123"})
            assert login_response.status_code == 200
            assert "token" in login_response.json()
            
            # Make sure we can't log in with the SQLi username and a wrong password
            wrong_login = client.post("/api/auth/login", json={"username": username, "password": "wrongpassword"})
            assert wrong_login.status_code == 401
        else:
            # If standard validation failed, it must be 400 or 422, not a 500 internal server error
            assert reg_response.status_code in (400, 422)

# ------------------------------------------------------------------------------
# 2. Boundary Lengths & Input Formats
# ------------------------------------------------------------------------------

def test_extreme_long_username(client):
    # Username exceeds Pydantic max_length=50
    long_username = "a" * 51
    response = client.post("/api/auth/register", json={"username": long_username, "password": "password123"})
    assert response.status_code == 422

def test_extreme_long_password_bcrypt_vulnerability(client):
    # Bcrypt throws a ValueError for passwords > 72 bytes.
    # This test asserts that the backend returns a 422 validation error.
    username = "test_long_pwd"
    long_password = "a" * 73
    
    response = client.post("/api/auth/register", json={"username": username, "password": long_password})
    assert response.status_code == 422

def test_unicode_and_emoji_inputs(client):
    username = "🚀🌟🔥"
    password = "🔑🔑🔑🔑🔑🔑"
    
    # Register
    reg_response = client.post("/api/auth/register", json={"username": username, "password": password})
    assert reg_response.status_code == 201
    
    # Login
    login_response = client.post("/api/auth/login", json={"username": username, "password": password})
    assert login_response.status_code == 200

def test_null_byte_in_inputs(client):
    # Null byte in username/password
    username = "test\x00user"
    password = "password\x00123"
    
    # Register with null bytes
    reg_response = client.post("/api/auth/register", json={"username": username, "password": password})
    assert reg_response.status_code in (201, 400, 422)

# ------------------------------------------------------------------------------
# 3. JWT Signature and Expiry Verification
# ------------------------------------------------------------------------------

def test_expired_jwt_token(db_session: Session):
    # Create an expired token (expires in the past)
    expired_delta = timedelta(seconds=-10)
    data = {"sub": "test-uuid", "username": "test_adv_user"}
    token = create_access_token(data, expires_delta=expired_delta)
    
    # Attempt to decode it
    decoded = decode_access_token(token)
    assert decoded is None # PyJWT decode should fail due to ExpiredSignatureError
    
    # Verify get_current_user raises HTTPException
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    with pytest.raises(HTTPException) as exc_info:
        get_current_user(credentials=credentials, db=db_session)
    assert exc_info.value.status_code == 401
    assert "Could not validate credentials" in exc_info.value.detail

def test_invalid_jwt_signature(db_session: Session):
    # Create token with a different key
    data = {"sub": "test-uuid", "username": "test_adv_user"}
    bad_token = jwt.encode(data, "wrong_secret_key", algorithm=JWT_ALGORITHM)
    
    # Attempt to decode it
    decoded = decode_access_token(bad_token)
    assert decoded is None
    
    # Verify get_current_user raises HTTPException
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=bad_token)
    with pytest.raises(HTTPException) as exc_info:
        get_current_user(credentials=credentials, db=db_session)
    assert exc_info.value.status_code == 401

def test_jwt_none_algorithm(db_session: Session):
    # Create token using alg=None
    data = {"sub": "test-uuid", "username": "test_adv_user"}
    none_token = jwt.encode(data, key=None, algorithm="none")
    
    # Attempt to decode it
    decoded = decode_access_token(none_token)
    assert decoded is None
    
    # Verify get_current_user raises HTTPException
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=none_token)
    with pytest.raises(HTTPException) as exc_info:
        get_current_user(credentials=credentials, db=db_session)
    assert exc_info.value.status_code == 401

def test_jwt_tampered_payload(db_session: Session):
    # Generate valid token
    data = {"sub": "test-uuid", "username": "test_adv_user"}
    token = create_access_token(data)
    
    # Tamper with the token (e.g. change part of the signature/payload)
    parts = token.split(".")
    assert len(parts) == 3
    # Let's modify the signature part (last part)
    tampered_token = f"{parts[0]}.{parts[1]}.{"x" * len(parts[2])}"
    
    # Decode should fail
    decoded = decode_access_token(tampered_token)
    assert decoded is None

# ------------------------------------------------------------------------------
# 4. Database Constraint Violations
# ------------------------------------------------------------------------------

def test_db_unique_username_constraint(db_session: Session):
    # Create two users with the same username directly in DB
    user1 = User(username="dup_user", hashed_password="pwd")
    user2 = User(username="dup_user", hashed_password="pwd")
    
    db_session.add(user1)
    db_session.commit()
    
    db_session.add(user2)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()

def test_db_foreign_key_constraints_disabled(db_session: Session):
    # SQLite now enforces foreign key constraints.
    # This test asserts that inserting a Batch with an invalid, non-existent user_id raises IntegrityError.
    
    invalid_batch = Batch(name="invalid_batch", user_id="non-existent-user-id")
    db_session.add(invalid_batch)
    
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()

def test_db_document_foreign_key_constraints_disabled(db_session: Session):
    # SQLite now enforces foreign key constraints.
    # This test asserts that inserting a Document with an invalid, non-existent batch_id raises IntegrityError.
    
    invalid_doc = Document(
        batch_id="non-existent-batch-id",
        file_name="test.txt",
        file_path="/tmp/test.txt",
        status="pending"
    )
    db_session.add(invalid_doc)
    
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()
