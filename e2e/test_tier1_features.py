import pytest
import time
from playwright.sync_api import Page, expect

# Helper for manual text selection in Playwright
def select_text_in_page(page: Page, container_selector: str, text_to_select: str):
    page.evaluate("""(args) => {
        const [selector, text] = args;
        const container = document.querySelector(selector);
        if (!container) return;
        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
        let node;
        while (node = walker.nextNode()) {
            const index = node.nodeValue.indexOf(text);
            if (index !== -1) {
                const range = document.createRange();
                range.setStart(node, index);
                range.setEnd(node, index + text.length);
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
                // Dispatch mouseup to trigger selection callback
                container.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
                break;
            }
        }
    }""", [container_selector, text_to_select])

# ==========================================
# FEATURE 1: AUTH (5 Tests)
# ==========================================

def test_auth_page_renders(page: Page):
    """Test that the login page renders elements (title, inputs, submit button)."""
    page.goto("http://localhost:5173/login")
    expect(page.locator("h2")).to_have_text("Login")
    expect(page.locator("#username")).to_be_visible()
    expect(page.locator("#password")).to_be_visible()
    expect(page.locator("#login-btn")).to_be_visible()

def test_auth_successful_login(page: Page):
    """Valid credentials redirect to /dashboard and store token."""
    page.goto("http://localhost:5173/login")
    page.fill("#username", "admin")
    page.fill("#password", "password")
    page.click("#login-btn")
    
    # Verify redirection to dashboard
    expect(page).to_have_url(re.compile(r".*/dashboard"))
    
    # Verify token storage
    token = page.evaluate("localStorage.getItem('token')")
    assert token == "mock-token-abc"

def test_auth_failed_login(page: Page):
    """Invalid credentials show error message."""
    page.goto("http://localhost:5173/login")
    page.fill("#username", "admin")
    page.fill("#password", "wrongpassword")
    page.click("#login-btn")
    
    # Verify error message is displayed
    expect(page.locator("#error-message")).to_be_visible()
    expect(page.locator("#error-message")).to_contain_text("Invalid username or password")

def test_auth_logout(page: Page):
    """Clicking logout clears token and redirects to /login."""
    page.goto("http://localhost:5173/login")
    page.evaluate("localStorage.setItem('token', 'mock-token-abc')")
    
    page.goto("http://localhost:5173/dashboard")
    page.click("#logout-btn")
    
    expect(page).to_have_url(re.compile(r".*/login"))
    token = page.evaluate("localStorage.getItem('token')")
    assert token is None

def test_auth_session_persistence(page: Page):
    """Page reload keeps the user logged in if token is present."""
    page.goto("http://localhost:5173/login")
    page.evaluate("localStorage.setItem('token', 'mock-token-abc')")
    
    page.goto("http://localhost:5173/dashboard")
    expect(page.locator("h2")).to_have_text("Dashboard")
    
    page.reload()
    expect(page.locator("h2")).to_have_text("Dashboard")


# ==========================================
# FEATURE 2: DASHBOARD (5 Tests)
# ==========================================

def test_dashboard_page_renders(page: Page):
    """Check that the dashboard renders header, file list, and upload button."""
    page.goto("http://localhost:5173/login")
    page.evaluate("localStorage.setItem('token', 'mock-token-abc')")
    page.goto("http://localhost:5173/dashboard")
    
    expect(page.locator("h2")).to_have_text("Dashboard")
    expect(page.locator("#upload-btn")).to_be_visible()
    expect(page.locator("#logout-btn")).to_be_visible()

def test_dashboard_document_list(page: Page):
    """Check that the documents list displays items and details."""
    page.goto("http://localhost:5173/login")
    page.evaluate("localStorage.setItem('token', 'mock-token-abc')")
    page.goto("http://localhost:5173/dashboard")
    
    expect(page.locator(".doc-item")).to_have_count(2)
    expect(page.locator(".doc-name").first).to_contain_text("Client Onboarding Record.pdf")

def test_dashboard_logout_navigation(page: Page):
    """Logout button redirects user back to login."""
    page.goto("http://localhost:5173/login")
    page.evaluate("localStorage.setItem('token', 'mock-token-abc')")
    page.goto("http://localhost:5173/dashboard")
    
    page.click("#logout-btn")
    expect(page).to_have_url(re.compile(r".*/login"))

def test_dashboard_navigation_to_ocr(page: Page):
    """Upload button redirects to /ocr."""
    page.goto("http://localhost:5173/login")
    page.evaluate("localStorage.setItem('token', 'mock-token-abc')")
    page.goto("http://localhost:5173/dashboard")
    
    page.click("#upload-btn")
    expect(page).to_have_url(re.compile(r".*/ocr"))

def test_dashboard_navigation_to_review(page: Page):
    """Clicking 'Review' on a document redirects to the review page."""
    page.goto("http://localhost:5173/login")
    page.evaluate("localStorage.setItem('token', 'mock-token-abc')")
    page.goto("http://localhost:5173/dashboard")
    
    page.locator(".review-btn").first.click()
    expect(page).to_have_url(re.compile(r".*/\?doc_id=doc-1"))


# ==========================================
# FEATURE 3: AI REDACTION (5 Tests)
# ==========================================

import re

def test_ai_redaction_load(page: Page):
    """Renders the document text with initial redactions."""
    page.goto("http://localhost:5173/")
    page.wait_for_selector("div.font-serif")
    
    # Check that high confidence redactions render as badges in Review Mode
    # "John Doe", "john.doe@example.com", "123-45-6789", "492-11-001" are redacted by default
    # So we should see badges containing NAME, EMAIL, SSN
    expect(page.locator("span.cursor-pointer:has-text('NAME')").first).to_be_visible()
    expect(page.locator("span.cursor-pointer:has-text('EMAIL')").first).to_be_visible()
    expect(page.locator("span.cursor-pointer:has-text('SSN')").first).to_be_visible()

def test_ai_redaction_remove_span(page: Page):
    """Clicking a redacted badge removes the redaction (marking as false positive)."""
    page.goto("http://localhost:5173/")
    page.wait_for_selector("div.font-serif")
    
    # Find the badge for John Doe (which is NAME type)
    badge = page.locator("span.cursor-pointer:has-text('NAME')").first
    badge.hover()
    badge.click()
    
    # The badge should be gone and replaced with "John Doe" plain text
    expect(page.locator("span.cursor-pointer:has-text('NAME')")).to_have_count(0)
    expect(page.locator("text=John Doe")).to_be_visible()

def test_ai_redaction_add_span(page: Page):
    """Selecting text and choosing a PII type adds a redacted badge."""
    page.goto("http://localhost:5173/")
    page.wait_for_selector("div.font-serif")
    
    # Let's select the word "initiative"
    select_text_in_page(page, "div.font-serif", "initiative")
    
    # Wait for the tooltip to appear and select "NAME"
    tooltip = page.locator("div.fixed.z-50")
    expect(tooltip).to_be_visible()
    
    # Click NAME option in tooltip programmatically to prevent window mousedown dismissal
    tooltip.locator("button:has-text('NAME')").evaluate("el => el.click()")
    
    # Check that a new NAME badge is created and tooltip is hidden
    expect(tooltip).not_to_be_visible()
    expect(page.locator("span.cursor-pointer:has-text('NAME')")).to_have_count(2) # Original + New

def test_ai_redaction_suggested_vs_low_confidence(page: Page):
    """Suggested redactions are badged, while low confidence unredacted items are highlighted in amber."""
    page.goto("http://localhost:5173/")
    page.wait_for_selector("div.font-serif")
    
    # Check that suggested redaction is badged
    expect(page.locator("span.cursor-pointer:has-text('EMAIL')").first).to_be_visible()
    
    # Check that low confidence items (like Ananya Sharma) have the warning background
    uncertain_item = page.locator("span[title='Uncertain: Was this missed?']").first
    expect(uncertain_item).to_be_visible()
    expect(uncertain_item).to_contain_text("Ananya Sharma")

def test_ai_redaction_preview_mode_toggle(page: Page):
    """Toggling review mode hides redaction badges and overlays black boxes in preview mode."""
    page.goto("http://localhost:5173/")
    page.wait_for_selector("div.font-serif")
    
    # Click Preview Final
    page.click("button:has-text('Preview Final')")
    
    # Check that review mode button changes label
    expect(page.locator("button:has-text('Back to Review')")).to_be_visible()
    
    # Badges should disappear, and black-box placeholders should be visible
    expect(page.locator("span.cursor-pointer:has-text('NAME')")).to_have_count(0)
    expect(page.locator("span:has-text('[REDACTED]')").first).to_be_visible()
    
    # Switch back
    page.click("button:has-text('Back to Review')")
    expect(page.locator("span.cursor-pointer:has-text('NAME')").first).to_be_visible()


# ==========================================
# FEATURE 4: OCR (5 Tests)
# ==========================================

def test_ocr_page_renders(page: Page):
    """Check OCR upload page elements."""
    page.goto("http://localhost:5173/login")
    page.evaluate("localStorage.setItem('token', 'mock-token-abc')")
    page.goto("http://localhost:5173/ocr")
    
    expect(page.locator("h2")).to_have_text("OCR Upload")
    expect(page.locator("#file-input")).to_be_visible()
    expect(page.locator("#ocr-btn")).to_be_visible()

def test_ocr_successful_upload(page: Page):
    """Selecting a file and uploading it shows Processing and then Completed with text."""
    page.goto("http://localhost:5173/login")
    page.evaluate("localStorage.setItem('token', 'mock-token-abc')")
    page.goto("http://localhost:5173/ocr")
    
    # Set a mock file
    page.set_input_files("#file-input", {
        "name": "test_resume.pdf",
        "mimeType": "application/pdf",
        "buffer": b"Dummy PDF content"
    })
    
    page.click("#ocr-btn")
    
    # Check status transition
    expect(page.locator("#ocr-status")).to_have_text("Completed")
    expect(page.locator("#ocr-result")).to_be_visible()
    expect(page.locator("#ocr-result")).to_contain_text("Client Onboarding Record")

def test_ocr_failed_upload(page: Page):
    """Simulating OCR API error shows 'OCR Failed'."""
    page.goto("http://localhost:5173/login")
    page.evaluate("localStorage.setItem('token', 'mock-token-abc')")
    page.goto("http://localhost:5173/ocr?test_scenario=invalid_format")
    
    page.set_input_files("#file-input", {
        "name": "test_resume.pdf",
        "mimeType": "application/pdf",
        "buffer": b"Dummy PDF content"
    })
    
    page.click("#ocr-btn")
    expect(page.locator("#ocr-status")).to_have_text("Invalid file format")

def test_ocr_empty_file_upload(page: Page):
    """Submitting form without a file shows validation error."""
    page.goto("http://localhost:5173/login")
    page.evaluate("localStorage.setItem('token', 'mock-token-abc')")
    page.goto("http://localhost:5173/ocr")
    
    page.click("#ocr-btn")
    expect(page.locator("#ocr-status")).to_have_text("No file selected")

def test_ocr_auto_redirect_to_review(page: Page):
    """After successful OCR processing, user is auto-redirected to the review page."""
    page.goto("http://localhost:5173/login")
    page.evaluate("localStorage.setItem('token', 'mock-token-abc')")
    page.goto("http://localhost:5173/ocr")
    
    page.set_input_files("#file-input", {
        "name": "test_resume.pdf",
        "mimeType": "application/pdf",
        "buffer": b"Dummy PDF"
    })
    
    page.click("#ocr-btn")
    # Wait for the redirection to the review page
    expect(page).to_have_url(re.compile(r".*/\?doc_id=doc-new"))


# ==========================================
# FEATURE 5: UI/UX POLISH (5 Tests)
# ==========================================

def test_ui_ux_layout_responsive(page: Page):
    """The main layout has appropriate padding and alignment classes."""
    page.goto("http://localhost:5173/")
    
    # Check that main card elements are present and have the correct flex/alignment layout classes
    expect(page.locator(".min-h-screen")).to_be_visible()
    expect(page.locator(".max-w-4xl")).to_be_visible()

def test_ui_ux_loading_spinner(page: Page):
    """Displays a spinner and loading text while document analysis is pending."""
    page.goto("http://localhost:5173/")
    expect(page.locator(".animate-spin")).to_be_visible()
    expect(page.locator("text=Analyzing document for PII...")).to_be_visible()

def test_ui_ux_speed_bump_under_5s(page: Page):
    """Exporting in under 5 seconds shows the speed bump dialog."""
    page.goto("http://localhost:5173/?test_scenario=zero_pii")
    
    # Immediately click export
    page.click("button:has-text('Export Safe Document')")
    
    # Speed bump popup should display
    expect(page.locator("h4:has-text('Wait, are you sure?')")).to_be_visible()
    expect(page.locator("p")).to_contain_text("You reviewed that very quickly")

def test_ui_ux_speed_bump_uncertain_areas(page: Page):
    """Exporting with unresolved low-confidence spans shows the speed bump dialog."""
    page.goto("http://localhost:5173/")
    
    # Mock Date.now to simulate elapsed time
    page.evaluate("const originalNow = Date.now; Date.now = () => originalNow() + 10000;")
    
    # Now let's try to export
    page.click("button:has-text('Export Safe Document')")
    
    # Since there are still 2 uncertain areas, the speed bump should show
    expect(page.locator("h4:has-text('Wait, are you sure?')")).to_be_visible()
    expect(page.locator("p")).to_contain_text("highlighted areas you haven't reviewed yet")

def test_ui_ux_speed_bump_dismiss(page: Page):
    """Clicking 'Keep Reviewing' closes the speed bump dialog."""
    page.goto("http://localhost:5173/")
    
    page.click("button:has-text('Export Safe Document')")
    expect(page.locator("h4:has-text('Wait, are you sure?')")).to_be_visible()
    
    # Click Keep Reviewing
    page.click("button:has-text('Keep Reviewing')")
    expect(page.locator("h4:has-text('Wait, are you sure?')")).not_to_be_visible()
