import pytest
import time
from playwright.sync_api import Page, expect

def test_ui_ux_speed_bump_flakiness_demo(page: Page):
    page.goto("http://localhost:5173/?test_scenario=zero_pii")
    page.wait_for_selector("div.font-serif")
    
    # Simulate a 6-second delay (e.g. slow CI or slow page rendering/user interaction)
    time.sleep(6)
    
    # Attempt to export
    page.click("button:has-text('Export Safe Document')")
    
    # This assertion will fail because timeOpen is now > 5s, so the speed bump does not show
    expect(page.locator("h4:has-text('Wait, are you sure?')")).to_be_visible()
