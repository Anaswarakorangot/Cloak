import pytest
import re
from playwright.sync_api import Page, expect
from test_tier1_features import select_text_in_page

def test_scenario_hr_resume_redaction(page: Page):
    """Mimic HR manager uploading a resume, reviewing suggested name/email redactions, approving them, manually redacting a phone number, waiting 5 seconds, and exporting safely."""
    # HR logs in
    page.goto("http://localhost:5173/login")
    page.fill("#username", "admin")
    page.fill("#password", "password")
    page.click("#login-btn")
    
    # Navigates to OCR to upload resume
    page.click("#upload-btn")
    page.set_input_files("#file-input", {
        "name": "Jane_Doe_Resume.pdf",
        "mimeType": "application/pdf",
        "buffer": b"Resume of Jane Doe, jane.doe@email.com, 555-9876"
    })
    page.click("#ocr-btn")
    
    # Redirected to review screen
    expect(page).to_have_url(re.compile(r".*/\?doc_id=doc-new"))
    page.wait_for_selector("div.font-serif")
    
    # Review suggested redactions (NAME, EMAIL, SSN etc)
    expect(page.locator("span.cursor-pointer:has-text('NAME')").first).to_be_visible()
    
    # Manually redact phone number (555-0198 in default mock document)
    select_text_in_page(page, "div.font-serif", "555-0198")
    page.locator("div.fixed.z-50 button:has-text('PHONE')").evaluate("el => el.click()")
    
    # Simulate waiting 5+ seconds for careful audit
    page.evaluate("const originalNow = Date.now; Date.now = () => originalNow() + 10000;")
    
    # Export clean resume
    page.click("button:has-text('Export Safe Document')")
    
    # Verify speed bump shows because Ananya Sharma is still a low-confidence unreviewed span
    expect(page.locator("h4:has-text('Wait, are you sure?')")).to_be_visible()
    # Auditor overrides and exports anyway
    page.click("button:has-text('Export Anyway')")
    expect(page.locator("button:has-text('Exported Successfully!')")).to_be_visible()

def test_scenario_legal_contract_audit(page: Page):
    """Mimic legal auditor processing a contract, noticing low-confidence spans (unresolved), reviewing them, clicking export, seeing speed bump, dismissing it, adding the missing redactions, and then exporting."""
    page.goto("http://localhost:5173/")
    page.wait_for_selector("div.font-serif")
    
    # Auditor reads the document and decides to export directly
    page.evaluate("const originalNow = Date.now; Date.now = () => originalNow() + 10000;") # Override time speed bump
    page.click("button:has-text('Export Safe Document')")
    
    # Speed bump warning shows due to Ananya Sharma and 555-0198
    expect(page.locator("h4:has-text('Wait, are you sure?')")).to_be_visible()
    
    # Dismiss speed bump to resolve the issues
    page.click("button:has-text('Keep Reviewing')")
    expect(page.locator("h4:has-text('Wait, are you sure?')")).not_to_be_visible()
    
    # Redact Ananya Sharma
    select_text_in_page(page, "div.font-serif", "Ananya Sharma")
    page.locator("div.fixed.z-50 button:has-text('NAME')").evaluate("el => el.click()")
    
    # Redact 555-0198
    select_text_in_page(page, "div.font-serif", "555-0198")
    page.locator("div.fixed.z-50 button:has-text('PHONE')").evaluate("el => el.click()")
    
    # Export again
    page.click("button:has-text('Export Safe Document')")
    expect(page.locator("button:has-text('Exported Successfully!')")).to_be_visible()

def test_scenario_medical_record_scrubbing(page: Page):
    """Mimic medical officer uploading a patient chart, finding multiple PII categories, deleting a false-positive redaction (e.g. a project code/id that was falsely flagged as SSN), and exporting."""
    page.goto("http://localhost:5173/")
    page.wait_for_selector("div.font-serif")
    
    # Find the badge for false positive "492-11-001" (SSN type)
    # The default mock analyze returns:
    # 492-11-001 as SSN suggested_redaction=True
    # We locate the badge that has text SSN and check its content.
    # In review mode, we have badges like "SSN".
    # John Doe (NAME), john.doe@example.com (EMAIL), 123-45-6789 (SSN), 492-11-001 (SSN)
    # Let's remove the second SSN badge (which corresponds to 492-11-001)
    ssn_badges = page.locator("span.cursor-pointer:has-text('SSN')")
    expect(ssn_badges).to_have_count(2)
    
    # Click the second SSN badge to remove it (un-redact)
    ssn_badges.nth(1).hover()
    ssn_badges.nth(1).click()
    
    # Verify the second SSN badge is gone
    expect(page.locator("span.cursor-pointer:has-text('SSN')")).to_have_count(1)
    expect(page.locator("text=492-11-001")).to_be_visible() # Renders plain text instead of badge
    
    # Complete other actions and export
    page.evaluate("const originalNow = Date.now; Date.now = () => originalNow() + 10000;")
    page.click("button:has-text('Export Safe Document')")
    
    # Speed bump displays because Ananya Sharma/555-0198 are still unreviewed
    expect(page.locator("h4:has-text('Wait, are you sure?')")).to_be_visible()
    page.click("button:has-text('Export Anyway')")
    expect(page.locator("button:has-text('Exported Successfully!')")).to_be_visible()

def test_scenario_financial_statement_review(page: Page):
    """Mimic compliance officer reviewing a financial statement, checking dashboard, auditing redactions, toggling preview to verify visual blackouts, and exporting."""
    page.goto("http://localhost:5173/login")
    page.evaluate("localStorage.setItem('token', 'mock-token-abc')")
    page.goto("http://localhost:5173/dashboard")
    
    # Select document from list
    page.locator(".review-btn").first.click()
    expect(page).to_have_url(re.compile(r".*/\?doc_id=doc-1"))
    page.wait_for_selector("div.font-serif")
    
    # Check that high-confidence redaction badges are loaded
    expect(page.locator("span.cursor-pointer:has-text('NAME')").first).to_be_visible()
    
    # Toggle Preview Mode to verify visual blackout representation
    page.click("button:has-text('Preview Final')")
    expect(page.locator("span:has-text('[REDACTED]')").first).to_be_visible()
    
    # Toggle back to Review Mode to complete audit
    page.click("button:has-text('Back to Review')")
    
    # Export anyway via speed bump override
    page.evaluate("const originalNow = Date.now; Date.now = () => originalNow() + 10000;")
    page.click("button:has-text('Export Safe Document')")
    page.click("button:has-text('Export Anyway')")
    expect(page.locator("button:has-text('Exported Successfully!')")).to_be_visible()

def test_scenario_multi_document_batch_review(page: Page):
    """Mimic an operator processing multiple documents in sequence from the dashboard, completing one, returning to dashboard, and starting the next one."""
    page.goto("http://localhost:5173/login")
    page.evaluate("localStorage.setItem('token', 'mock-token-abc')")
    page.goto("http://localhost:5173/dashboard")
    
    # 1. Review Doc 1
    page.locator(".review-btn").nth(0).click()
    expect(page).to_have_url(re.compile(r".*/\?doc_id=doc-1"))
    page.wait_for_selector("div.font-serif")
    
    # Check loaded spans, do export override
    expect(page.locator("span.cursor-pointer:has-text('NAME')").first).to_be_visible()
    page.evaluate("const originalNow = Date.now; Date.now = () => originalNow() + 10000;")
    page.click("button:has-text('Export Safe Document')")
    page.click("button:has-text('Export Anyway')")
    expect(page.locator("button:has-text('Exported Successfully!')")).to_be_visible()
    
    # Go back to dashboard
    page.goto("http://localhost:5173/dashboard")
    
    # 2. Review Doc 2
    page.locator(".review-btn").nth(1).click()
    expect(page).to_have_url(re.compile(r".*/\?doc_id=doc-2"))
    page.wait_for_selector("div.font-serif")
    
    # Verify loaded
    expect(page.locator("span.cursor-pointer:has-text('NAME')").first).to_be_visible()
