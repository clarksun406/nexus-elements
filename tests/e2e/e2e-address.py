"""E2E: Address Element - dynamic country fields, postal validation, change events."""
import os
import sys
from playwright.sync_api import sync_playwright, expect

sys.stdout.reconfigure(encoding="utf-8")

BASE = os.environ.get("E2E_BASE", "http://localhost:3000")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 1000})

    console_errors = []
    page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
    page.on("pageerror", lambda err: console_errors.append(str(err)))

    print("1. Navigating to /address ...")
    page.goto(f"{BASE}/address", wait_until="networkidle")
    page.screenshot(path="e2e-screenshots/e2e-address-01-loaded.png")

    frame = page.frame_locator("iframe[title='Nexus address element']")
    name_input = frame.locator("input.nexus-address-name")
    name_input.wait_for(state="visible", timeout=10000)

    print("2. US mode: state is a select with ZIP validation ...")
    state_el = frame.locator(".nexus-address-state")
    assert state_el.evaluate("el => el.tagName") == "SELECT", "US state should be a <select>"

    name_input.fill("Zhang San")
    frame.locator("input.nexus-address-line1").fill("123 Main Street")
    frame.locator("input.nexus-address-city").fill("New York")
    frame.locator("select.nexus-address-state").select_option("NY")

    print("3. Invalid ZIP should mark invalid ...")
    postal = frame.locator("input.nexus-address-postal")
    postal.fill("abc")
    postal.blur()
    error_msg = frame.locator(".nexus-error")
    expect(error_msg).to_be_visible(timeout=5000)
    expect(page.locator(".result-box")).to_contain_text("valid: false", timeout=5000)
    page.screenshot(path="e2e-screenshots/e2e-address-02-invalid-zip.png")

    print("4. Valid ZIP completes the address ...")
    postal.fill("10001")
    expect(page.locator(".result-box")).to_contain_text("complete: true", timeout=5000)
    expect(page.locator(".result-box")).to_contain_text('"postal_code": "10001"', timeout=5000)
    expect(page.locator(".result-box")).to_contain_text('"country": "US"', timeout=5000)
    page.screenshot(path="e2e-screenshots/e2e-address-03-complete.png")

    print("5. Switching country to GB: state becomes text input ...")
    frame.locator("select.nexus-address-country").select_option("GB")
    state_el = frame.locator(".nexus-address-state")
    assert state_el.evaluate("el => el.tagName") == "INPUT", "GB county should be an <input>"
    postal.fill("SW1A 1AA")
    expect(page.locator(".result-box")).to_contain_text("complete: true", timeout=5000)

    print("6. Billing mode hides phone (fields.phone=optional keeps it) and re-renders ...")
    page.locator("input[value='billing']").check()
    frame = page.frame_locator("iframe[title='Nexus address element']")
    frame.locator("input.nexus-address-name").wait_for(state="visible", timeout=10000)
    page.screenshot(path="e2e-screenshots/e2e-address-04-billing.png")

    if console_errors:
        print(f"\n   Console errors ({len(console_errors)}):")
        for e in console_errors[:5]:
            print(f"   - {e[:200]}")
    else:
        print("   No console errors.")

    print("\nE2E PASSED: address element dynamic fields + postal validation + change events")
    browser.close()
