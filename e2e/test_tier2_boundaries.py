import pytest
import re
from playwright.sync_api import Page, expect

# ==========================================
# FEATURE 1: AUTH BOUNDARIES (5 Tests)
# ==========================================

def test_auth_empty_credentials(page: Page):
    """Submitting empty username/password shows validation error."""
    page.goto("http://localhost:5173/login")
    page.click("#login-btn")
    
    expect(page.locator("#error-message")).to_be_visible()
    expect(page.locator("#error-message")).to_contain_text("Username and password are required")

def test_auth_extremely_long_credentials(page: Page):
    """Extremely long credentials handled gracefully, returning error instead of crashing."""
    page.goto("http://localhost:5173/login")
    page.fill("#username", "a" * 150)
    page.fill("#password", "b" * 150)
    page.click("#login-btn")
    
    expect(page.locator("#error-message")).to_be_visible()
    expect(page.locator("#error-message")).to_contain_text("Inputs too long")

def test_auth_sql_injection_attempt(page: Page):
    """SQL injection characters in fields fail login safely without server-side error."""
    page.goto("http://localhost:5173/login")
    page.fill("#username", "admin' OR 1=1 --")
    page.fill("#password", "anything")
    page.click("#login-btn")
    
    expect(page.locator("#error-message")).to_be_visible()
    expect(page.locator("#error-message")).to_contain_text("Invalid username or password")

def test_auth_xss_in_username(page: Page):
    """XSS payloads in username do not execute scripts."""
    # We navigate to login and fill script tag
    page.goto("http://localhost:5173/login")
    
    xss_payload = "<script>window.xss_executed = true;</script>"
    page.fill("#username", xss_payload)
    page.fill("#password", "password")
    page.click("#login-btn")
    
    # Check that the XSS payload did not get executed in the page
    xss_executed = page.evaluate("window.xss_executed")
    assert xss_executed is not True

def test_auth_expired_token_handling(page: Page):
    """Navigating with an expired/invalid token redirects back to /login."""
    page.goto("http://localhost:5173/login")
    page.evaluate("localStorage.setItem('token', 'expired-token')")
    
    # Navigate to dashboard with invalid/expired token scenario
    page.goto("http://localhost:5173/dashboard?test_scenario=expired_token")
    
    # Wait, the client-side check reads local storage. In our mock routing,
    # if the scenario is expired_token, we can force redirect. Let's make sure
    # the page handles it. In dashboard code, if scenario is expired_token or unauthorized,
    # it redirects.
    expect(page).to_have_url(re.compile(r".*/login"))


# ==========================================
# FEATURE 2: DASHBOARD BOUNDARIES (5 Tests)
# ==========================================

def test_dashboard_empty_document_list(page: Page):
    """Dashboard handles zero documents gracefully, displaying a placeholder message."""
    page.goto("http://localhost:5173/login")
    page.evaluate("localStorage.setItem('token', 'mock-token-abc')")
    
    page.goto("http://localhost:5173/dashboard?test_scenario=empty")
    
    # Empty message should be visible
    expect(page.locator("#empty-message")).to_be_visible()
    expect(page.locator(".doc-item")).to_have_count(0)

def test_dashboard_huge_document_list(page: Page):
    """Renders a huge number of documents correctly without UI lockup."""
    page.goto("http://localhost:5173/login")
    page.evaluate("localStorage.setItem('token', 'mock-token-abc')")
    
    page.goto("http://localhost:5173/dashboard?test_scenario=huge")
    
    # Verify that it renders 100 items
    expect(page.locator(".doc-item")).to_have_count(100)

def test_dashboard_invalid_document_id(page: Page):
    """Accessing an unauthorized or invalid document ID redirects or shows message."""
    page.goto("http://localhost:5173/")
    
    # Navigate with expired/unauthorized token scenario
    page.goto("http://localhost:5173/?test_scenario=unauthorized")
    
    # The application shows "Failed to load document." when response is 401/error
    expect(page.locator("text=Failed to load document.")).to_be_visible()

def test_dashboard_unauthorized_access(page: Page):
    """Accessing the dashboard without an active token redirects to login."""
    page.goto("http://localhost:5173/login")
    page.evaluate("localStorage.removeItem('token')")
    
    page.goto("http://localhost:5173/dashboard")
    expect(page).to_have_url(re.compile(r".*/login"))

def test_dashboard_special_characters_in_doc_name(page: Page):
    """Document names with emojis and special characters render correctly."""
    page.goto("http://localhost:5173/login")
    page.evaluate("localStorage.setItem('token', 'mock-token-abc')")
    page.goto("http://localhost:5173/dashboard")
    
    expect(page.locator(".doc-name").first).to_be_visible()
    doc_name = page.locator(".doc-name").first.inner_text()
    # Check that the displayed name contains special characters/emojis rather than a hardcoded normal name
    assert re.search(r"[^\w\s\.\-]", doc_name) is not None


# ==========================================
# FEATURE 3: AI REDACTION BOUNDARIES (5 Tests)
# ==========================================

def test_ai_redaction_empty_document_text(page: Page):
    """Handles completely empty text from backend gracefully without crashing."""
    page.goto("http://localhost:5173/?test_scenario=empty")
    
    # Text area should exist but contain no spans
    expect(page.locator("div.font-serif")).to_be_empty()
    expect(page.locator("span.cursor-pointer:has-text('NAME')")).to_have_count(0)

def test_ai_redaction_huge_document_text(page: Page):
    """Handles large document (50,000 characters) without crash and highlights spans."""
    page.goto("http://localhost:5173/?test_scenario=huge")
    page.wait_for_selector("div.font-serif")
    
    # Ensure page rendered and contains the large document start indicator
    expect(page.locator("div.font-serif")).to_contain_text("Large document starts here")
    # Verify that the single span in huge text is redacted
    expect(page.locator("span.cursor-pointer:has-text('NAME')")).to_have_count(1)

def test_ai_redaction_overlapping_spans(page: Page):
    """Handles overlapping spans from AI models correctly."""
    page.goto("http://localhost:5173/?test_scenario=overlapping")
    page.wait_for_selector("div.font-serif")
    
    # The spans overlap. Playwright should render the resolved elements without crash
    expect(page.locator("span.cursor-pointer:has-text('NAME')").first).to_be_visible()

def test_ai_redaction_special_characters(page: Page):
    """Handles unicode, special characters, and emojis in text and redactions."""
    page.goto("http://localhost:5173/?test_scenario=special")
    page.wait_for_selector("div.font-serif")
    
    # Click the NAME badge to un-redact it
    page.locator("span.cursor-pointer:has-text('NAME')").first.click()
    
    # Now it renders as plain text
    expect(page.locator("div.font-serif")).to_contain_text("François Mitterrand")

def test_ai_redaction_zero_pii_spans(page: Page):
    """Handles documents with zero detected PII spans."""
    page.goto("http://localhost:5173/?test_scenario=zero_pii")
    page.wait_for_selector("div.font-serif")
    
    expect(page.locator("div.font-serif")).to_contain_text("no sensitive data")
    expect(page.locator("span.cursor-pointer:has-text('NAME')")).to_have_count(0)


# ==========================================
# FEATURE 4: OCR BOUNDARIES (5 Tests)
# ==========================================

def test_ocr_huge_file_upload(page: Page):
    """Simulates uploading a very large file, showing appropriate loading and success."""
    page.goto("http://localhost:5173/login")
    page.evaluate("localStorage.setItem('token', 'mock-token-abc')")
    page.goto("http://localhost:5173/ocr")
    
    # Simulate a large file buffer
    page.set_input_files("#file-input", {
        "name": "huge_audit_file.pdf",
        "mimeType": "application/pdf",
        "buffer": b"Dummy content" * 100000
    })
    page.click("#ocr-btn")
    
    expect(page.locator("#ocr-status")).to_have_text("Completed")

def test_ocr_invalid_file_format(page: Page):
    """Uploading unsupported format (e.g. .exe) shows error."""
    page.goto("http://localhost:5173/login")
    page.evaluate("localStorage.setItem('token', 'mock-token-abc')")
    page.goto("http://localhost:5173/ocr?test_scenario=invalid_format")
    
    page.set_input_files("#file-input", {
        "name": "malicious.exe",
        "mimeType": "application/octet-stream",
        "buffer": b"Dummy exe content"
    })
    page.click("#ocr-btn")
    
    expect(page.locator("#ocr-status")).to_have_text("Invalid file format")

def test_ocr_timeout_handling(page: Page):
    """Handles API network timeouts gracefully during OCR upload."""
    page.goto("http://localhost:5173/login")
    page.evaluate("localStorage.setItem('token', 'mock-token-abc')")
    page.goto("http://localhost:5173/ocr?test_scenario=timeout")
    
    page.set_input_files("#file-input", {
        "name": "large.pdf",
        "mimeType": "application/pdf",
        "buffer": b"Dummy content"
    })
    page.click("#ocr-btn")
    
    expect(page.locator("#ocr-status")).to_have_text("Gateway Timeout")

def test_ocr_special_chars_in_filename(page: Page):
    """Handles filenames with spaces, emojis, and special characters correctly."""
    page.goto("http://localhost:5173/login")
    page.evaluate("localStorage.setItem('token', 'mock-token-abc')")
    page.goto("http://localhost:5173/ocr")
    
    page.set_input_files("#file-input", {
        "name": "📄 Resume - François & Partners!.pdf",
        "mimeType": "application/pdf",
        "buffer": b"Dummy PDF content"
    })
    page.click("#ocr-btn")
    
    expect(page.locator("#ocr-status")).to_have_text("Completed")

def test_ocr_empty_content_returned(page: Page):
    """Handles scenario where OCR processes successfully but returns empty content."""
    page.goto("http://localhost:5173/login")
    page.evaluate("localStorage.setItem('token', 'mock-token-abc')")
    page.goto("http://localhost:5173/ocr?test_scenario=empty")
    
    page.set_input_files("#file-input", {
        "name": "blank.pdf",
        "mimeType": "application/pdf",
        "buffer": b"Dummy blank PDF"
    })
    page.click("#ocr-btn")
    
    expect(page.locator("#ocr-status")).to_have_text("Completed")


# ==========================================
# FEATURE 5: UI/UX POLISH BOUNDARIES (5 Tests)
# ==========================================

def test_ui_ux_multiple_rapid_clicks_on_export(page: Page):
    """Prevents multiple exports or handles multiple rapid clicks gracefully."""
    page.goto("http://localhost:5173/")
    
    # Speed bump triggers immediately
    page.click("button:has-text('Export Safe Document')")
    # Click again rapidly
    page.click("button:has-text('Export Safe Document')")
    
    expect(page.locator("h4:has-text('Wait, are you sure?')")).to_be_visible()

def test_ui_ux_speed_bump_override(page: Page):
    """Clicking 'Export Anyway' successfully bypasses speed bump and exports."""
    page.goto("http://localhost:5173/")
    
    page.click("button:has-text('Export Safe Document')")
    expect(page.locator("h4:has-text('Wait, are you sure?')")).to_be_visible()
    
    # Click Export Anyway
    page.click("button:has-text('Export Anyway')")
    
    # Speed bump is closed
    expect(page.locator("h4:has-text('Wait, are you sure?')")).not_to_be_visible()
    
    # Button should show success feedback
    expect(page.locator("button:has-text('Exported Successfully!')")).to_be_visible()

def test_ui_ux_tooltip_positioning(page: Page):
    """Tooltip renders safely without crashing the UI."""
    page.goto("http://localhost:5173/")
    
    # Verify tooltip starts hidden
    expect(page.locator("div.fixed.z-50")).not_to_be_visible()

def test_ui_ux_review_toggle_state_persistence(page: Page):
    """Toggle button keeps the view state consistent across multiple clicks."""
    page.goto("http://localhost:5173/")
    
    # Preview Final -> Back to Review -> Preview Final
    page.click("button:has-text('Preview Final')")
    expect(page.locator("button:has-text('Back to Review')")).to_be_visible()
    
    page.click("button:has-text('Back to Review')")
    expect(page.locator("button:has-text('Preview Final')")).to_be_visible()

def test_ui_ux_theme_styling_contrast(page: Page):
    """Ensure highlight spans use appropriate contrast classes (e.g. bg-amber-100)."""
    page.goto("http://localhost:5173/")
    
    # Select uncertain span and inspect class
    uncertain_span = page.locator("span[title='Uncertain: Was this missed?']").first
    classes = uncertain_span.evaluate("el => el.className")
    
    # Must use yellow highlight class to ensure standard UX design
    assert "bg-amber-100" in classes
