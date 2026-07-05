import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.db_models import User
from app.services.security import decode_access_token

@pytest.fixture(scope="module")
def client():
    return TestClient(app)

@pytest.fixture(autouse=True)
def clean_test_user():
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == "testuser").first()
        if user:
            db.delete(user)
            db.commit()
    finally:
        db.close()
    yield
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == "testuser").first()
        if user:
            db.delete(user)
            db.commit()
    finally:
        db.close()

def test_registration_success(client):
    response = client.post("/api/auth/register", json={"username": "testuser", "password": "password123"})
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "success"
    assert "token" in data

def test_registration_duplicate(client):
    response = client.post("/api/auth/register", json={"username": "testuser", "password": "password123"})
    assert response.status_code == 201
    
    response = client.post("/api/auth/register", json={"username": "testuser", "password": "password123"})
    assert response.status_code == 400
    assert response.json()["detail"] == "Username already registered"

def test_registration_invalid_username(client):
    response = client.post("/api/auth/register", json={"username": "  ab  ", "password": "password123"})
    assert response.status_code == 400
    assert "Username must be at least 3 characters long" in response.json()["detail"]

def test_registration_short_password(client):
    response = client.post("/api/auth/register", json={"username": "testuser", "password": "123"})
    assert response.status_code == 422 # Pydantic validation error

def test_login_success(client):
    client.post("/api/auth/register", json={"username": "testuser", "password": "password123"})
    
    response = client.post("/api/auth/login", json={"username": "testuser", "password": "password123"})
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "token" in data
    
    # Verify token decoding
    decoded = decode_access_token(data["token"])
    assert decoded is not None
    assert decoded["username"] == "testuser"

def test_login_wrong_password(client):
    client.post("/api/auth/register", json={"username": "testuser", "password": "password123"})
    
    response = client.post("/api/auth/login", json={"username": "testuser", "password": "wrongpassword"})
    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect username or password"

def test_login_nonexistent_user(client):
    response = client.post("/api/auth/login", json={"username": "no_such_user", "password": "password123"})
    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect username or password"
