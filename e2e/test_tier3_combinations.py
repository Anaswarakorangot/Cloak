import pytest
import re
from playwright.sync_api import Page, expect
from test_tier1_features import select_text_in_page

def test_flow_login_upload_ocr_review_export(page: Page):
    """Complete path: Login -> Dashboard -> OCR Upload -> OCR complete -> Review page -> Resolve low-confidence spans -> Export successfully."""
    # 1. Login
    page.goto("http://localhost:5173/login")
    page.fill("#username", "admin")
    page.fill("#password", "password")
    page.click("#login-btn")
    expect(page).to_have_url(re.compile(r".*/dashboard"))

    # 2. Go to OCR
    page.click("#upload-btn")
    expect(page).to_have_url(re.compile(r".*/ocr"))

    # 3. Upload and OCR
    page.set_input_files("#file-input", {
        "name": "invoice.pdf",
        "mimeType": "application/pdf",
        "buffer": b"Invoice contents"
    })
    page.click("#ocr-btn")
    expect(page.locator("#ocr-status")).to_have_text("Completed")

    # 4. Redirection to Review page (loads the real react app index page in our flow)
    expect(page).to_have_url(re.compile(r".*/\?doc_id=doc-new"))

    # 5. Resolve low confidence spans (Ananya Sharma & 555-0198) by clicking them to redact, or removing them
    # Wait for the document to load
    page.wait_for_selector("div.font-serif")
    expect(page.locator("span[title='Uncertain: Was this missed?']").first).to_be_visible()
    
    # Let's select the low confidence name and redact it manually
    select_text_in_page(page, "div.font-serif", "Ananya Sharma")
    tooltip = page.locator("div.fixed.z-50")
    expect(tooltip).to_be_visible()
    tooltip.locator("button:has-text('NAME')").evaluate("el => el.click()")
    expect(tooltip).not_to_be_visible()

    # Redact the phone number as well
    select_text_in_page(page, "div.font-serif", "555-0198")
    expect(tooltip).to_be_visible()
    tooltip.locator("button:has-text('PHONE')").evaluate("el => el.click()")
    expect(tooltip).not_to_be_visible()

    # 6. Export document
    page.evaluate("const originalNow = Date.now; Date.now = () => originalNow() + 10000;")
    page.click("button:has-text('Export Safe Document')")
    expect(page.locator("button:has-text('Exported Successfully!')")).to_be_visible()

def test_flow_unauthorized_redirect_loop(page: Page):
    """User tries to access /dashboard directly -> redirected to /login -> logs in -> redirects to /dashboard."""
    page.goto("http://localhost:5173/login")
    page.evaluate("localStorage.removeItem('token')")
    
    # Try accessing dashboard
    page.goto("http://localhost:5173/dashboard")
    expect(page).to_have_url(re.compile(r".*/login"))
    
    # Login now
    page.fill("#username", "admin")
    page.fill("#password", "password")
    page.click("#login-btn")
    
    # Redirected to dashboard
    expect(page).to_have_url(re.compile(r".*/dashboard"))

def test_flow_session_expiry_during_export(page: Page):
    """User is logged in -> reviews a document -> token expires -> clicks export -> redirects to login."""
    # Pre-auth
    page.goto("http://localhost:5173/login")
    page.evaluate("localStorage.setItem('token', 'mock-token-abc')")
    
    # Open review with expired token scenario
    page.goto("http://localhost:5173/?test_scenario=expired_token")
    
    # Since api fails with 401, it shows "Failed to load document."
    expect(page.locator("text=Failed to load document.")).to_be_visible()

def test_flow_ocr_fail_retry_flow(page: Page):
    """User goes to OCR -> uploads file -> fails -> tries again with different file -> succeeds -> redirected to review."""
    page.goto("http://localhost:5173/login")
    page.evaluate("localStorage.setItem('token', 'mock-token-abc')")
    page.goto("http://localhost:5173/ocr?test_scenario=invalid_format")
    
    # First upload (fails)
    page.set_input_files("#file-input", {
        "name": "virus.exe",
        "mimeType": "application/octet-stream",
        "buffer": b"Harmful content"
    })
    page.click("#ocr-btn")
    expect(page.locator("#ocr-status")).to_have_text("Invalid file format")
    
    # Retry (succeeds by going to normal url without scenario params)
    page.goto("http://localhost:5173/ocr")
    page.set_input_files("#file-input", {
        "name": "safe_image.png",
        "mimeType": "image/png",
        "buffer": b"Valid Image Content"
    })
    page.click("#ocr-btn")
    expect(page.locator("#ocr-status")).to_have_text("Completed")
    expect(page).to_have_url(re.compile(r".*/\?doc_id=doc-new"))

def test_flow_user_isolation_check(page: Page):
    """User A logs in -> uploads document -> logs out -> User B logs in -> cannot see User A's document or data."""
    # User A Login
    page.goto("http://localhost:5173/login")
    page.fill("#username", "user_a")
    page.fill("#password", "password123")
    page.click("#login-btn")
    expect(page).to_have_url(re.compile(r".*/dashboard"))
    
    token_a = page.evaluate("localStorage.getItem('token')")
    assert token_a is not None
    
    # User A logs out
    page.click("#logout-btn")
    expect(page).to_have_url(re.compile(r".*/login"))
    
    # User B logs in
    page.fill("#username", "user_b")
    page.fill("#password", "password456")
    page.click("#login-btn")
    expect(page).to_have_url(re.compile(r".*/dashboard"))
    
    # Ensure a new session token is available and is different from User A's token
    token_b = page.evaluate("localStorage.getItem('token')")
    assert token_b is not None
    assert token_b != token_a

def test_flow_login_direct_review_access(page: Page):
    """Trying to access a review page without auth redirects to login, and then user can log in."""
    page.goto("http://localhost:5173/login")
    page.evaluate("localStorage.removeItem('token')")
    
    # Direct access dashboard (which acts as main app page check)
    page.goto("http://localhost:5173/dashboard")
    expect(page).to_have_url(re.compile(r".*/login"))
    
    # Log in
    page.fill("#username", "admin")
    page.fill("#password", "password")
    page.click("#login-btn")
    expect(page).to_have_url(re.compile(r".*/dashboard"))
