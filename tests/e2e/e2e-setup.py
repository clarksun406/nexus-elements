"""E2E: SetupIntent confirmSetup flow verification."""
import os
import sys
from playwright.sync_api import sync_playwright, expect

sys.stdout.reconfigure(encoding="utf-8")

BASE = os.environ.get("E2E_BASE", "http://localhost:3000")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 900})

    console_errors = []
    page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
    page.on("pageerror", lambda err: console_errors.append(str(err)))

    print("1. Navigating to /setup-intent ...")
    page.goto(f"{BASE}/setup-intent", wait_until="networkidle")
    page.screenshot(path="e2e-screenshots/e2e-setup-01-loaded.png")

    print("2. Filling card in iframe ...")
    frame_locator = page.frame_locator("iframe[title='Nexus card element']")
    number_input = frame_locator.locator("input.nexus-number")
    number_input.wait_for(state="visible", timeout=10000)
    number_input.click()
    number_input.type("4242424242424242", delay=30)
    frame_locator.locator("input.nexus-expiry").type("1228", delay=30)
    frame_locator.locator("input.nexus-cvc").type("123", delay=30)

    print("3. Waiting for save button enabled ...")
    save_btn = page.locator("button.btn-pay")
    expect(save_btn).to_be_enabled(timeout=5000)

    print("4. Clicking save ...")
    save_btn.click()

    print("5. Waiting for success result ...")
    result_box = page.locator(".result-box--success")
    expect(result_box).to_be_visible(timeout=15000)
    result_text = result_box.inner_text()
    print(f"   Result: {result_text}")
    assert "保存成功" in result_text and "seti_test_" in result_text, f"Unexpected result: {result_text}"
    page.screenshot(path="e2e-screenshots/e2e-setup-02-success.png")

    print("6. Declined card should surface error ...")
    page.reload(wait_until="networkidle")
    frame_locator = page.frame_locator("iframe[title='Nexus card element']")
    number_input = frame_locator.locator("input.nexus-number")
    number_input.wait_for(state="visible", timeout=10000)
    number_input.click()
    number_input.type("4000000000000002", delay=30)
    frame_locator.locator("input.nexus-expiry").type("1228", delay=30)
    frame_locator.locator("input.nexus-cvc").type("123", delay=30)
    save_btn = page.locator("button.btn-pay")
    expect(save_btn).to_be_enabled(timeout=5000)
    save_btn.click()
    error_box = page.locator(".result-box--error")
    expect(error_box).to_be_visible(timeout=15000)
    print(f"   Error: {error_box.inner_text()}")

    if console_errors:
        print(f"\n   Console errors ({len(console_errors)}):")
        for e in console_errors[:5]:
            print(f"   - {e[:200]}")
    else:
        print("   No console errors.")

    print("\nE2E PASSED: card input -> confirmSetup -> setup_intent succeeded + decline path")
    browser.close()
