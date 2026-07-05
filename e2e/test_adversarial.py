import pytest
import re
from playwright.sync_api import Page, expect

def select_nth_occurrence(page: Page, container_selector: str, text: str, occurrence: int):
    page.evaluate("""(args) => {
        const [selector, targetText, n] = args;
        const container = document.querySelector(selector);
        if (!container) return;
        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
        let node;
        let count = 0;
        while (node = walker.nextNode()) {
            let index = -1;
            while (true) {
                index = node.nodeValue.indexOf(targetText, index + 1);
                if (index === -1) break;
                count++;
                if (count === n) {
                    const range = document.createRange();
                    range.setStart(node, index);
                    range.setEnd(node, index + targetText.length);
                    const sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(range);
                    // Dispatch mouseup to trigger selection callback
                    container.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
                    return;
                }
            }
        }
    }""", [container_selector, text, occurrence])

import uuid

def login_if_needed(page: Page):
    page.goto("http://localhost:5173/login")
    if page.url.endswith("/login"):
        # Register a new user
        page.click("button:has-text('Sign up')")
        test_username = f"testuser_{uuid.uuid4().hex[:8]}"
        page.fill("input[type='text']", test_username)
        page.fill("input[type='password']", "password")
        page.click("button:has-text('Create Account')")
        page.wait_for_selector("text=Welcome to your Workspace")

def test_adversarial_duplicate_word_redaction(page: Page):
    """
    Test that manual text selection works correctly when there are duplicate words.
    We will select the 3rd occurrence of the word 'the' (in 'from the executive board')
    and redact it. We expect the 3rd 'the' to be redacted, NOT the 1st 'the'.
    """
    login_if_needed(page)
    page.goto("http://localhost:5173/")
    # Click Upload New Document (demo mode)
    page.wait_for_selector("text=Upload New Document")
    page.click("button:has-text('demo document')")
    page.wait_for_selector("div.font-sans")
    
    # Select the 3rd occurrence of the word 'the'
    select_nth_occurrence(page, "div.font-sans", "the", 3)
    
    # Click NAME in the tooltip
    tooltip = page.locator("div.fixed.z-50")
    expect(tooltip).to_be_visible()
    tooltip.locator("button:has-text('NAME')").evaluate("el => el.click()")
    expect(tooltip).not_to_be_visible()
    
    # Now, let's verify if the 3rd occurrence of 'the' is redacted,
    # or if the 1st occurrence was redacted instead.
    # The 1st occurrence is in "...for the upcoming quarter..."
    # The 3rd occurrence is in "...from the executive board..."
    
    # Let's inspect the page content or text structure.
    # We can check if "for [NAME] upcoming quarter" exists (wrong redaction)
    # or "from [NAME] executive board" exists (correct redaction).
    # Specifically, if the 1st 'the' is redacted, there will be a NAME badge in "...for [NAME] upcoming..."
    # Let's locate the text surrounding the first 'the'.
    # In the HTML, if the first 'the' was redacted, then "for" and "upcoming" will be separated by the badge.
    
    # Let's check the text content of the parent div.
    # If the bug occurred, the first 'the' is redacted:
    # "assigned to Project 492-11-001 for [NAME] upcoming quarter"
    # Let's check if the text near "upcoming quarter" contains the badge.
    upcoming_area = page.locator("span:has-text('upcoming quarter')")
    # Wait, is 'upcoming quarter' plain text?
    # If the first 'the' is redacted, the html is:
    # ... for </span><span class="... badge">NAME</span><span> upcoming quarter ...
    # So "upcoming quarter" will be in its own text node.
    # Let's see if the first 'the' became redacted by checking if "for the upcoming" is still intact.
    # If the first 'the' is NOT redacted, "for the upcoming quarter" will be plain text.
    # If the bug happened, "for the upcoming quarter" is broken, and "for " is followed by a badge, then " upcoming quarter".
    
    # Let's assert that "for the upcoming quarter" is still present (i.e. not redacted).
    # If the bug is present, this assertion will FAIL!
    expect(page.locator("text=for the upcoming quarter")).to_be_visible()

def test_adversarial_time_open_freeze(page: Page):
    """
    Test that waiting for 5.5 seconds actually bypasses the speed bump
    in the zero_pii scenario (which has no unreviewed low-confidence spans).
    If the speed bump still shows after waiting 5.5 seconds, it proves that
    the timeOpen state is frozen at load time.
    """
    login_if_needed(page)
    page.goto("http://localhost:5173/?test_scenario=zero_pii")
    # The zero_pii scenario automatically bypasses the dashboard and loads a mock document
    page.wait_for_selector("div.font-sans")
    
    # Wait 5.5 seconds
    page.wait_for_timeout(5500)
    
    page.click("button:has-text('Export Safe Document')")
    
    speed_bump = page.locator("h4:has-text('Wait, are you sure?')")
    expect(speed_bump).not_to_be_visible()
