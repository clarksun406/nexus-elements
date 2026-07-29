"""E2E: card-split payment flow verification (cardNumber / cardExpiry / cardCvc)."""
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

    print("1. Navigating to /card-split ...")
    page.goto(f"{BASE}/card-split", wait_until="networkidle")
    print("   Page loaded.")

    print("2. Locating the three field iframes ...")
    number_frame = page.frame_locator("iframe[title='Nexus cardNumber element']")
    expiry_frame = page.frame_locator("iframe[title='Nexus cardExpiry element']")
    cvc_frame = page.frame_locator("iframe[title='Nexus cardCvc element']")

    number_input = number_frame.locator("input.nexus-input")
    expiry_input = expiry_frame.locator("input.nexus-input")
    cvc_input = cvc_frame.locator("input.nexus-input")
    number_input.wait_for(state="visible", timeout=10000)
    expiry_input.wait_for(state="visible", timeout=10000)
    cvc_input.wait_for(state="visible", timeout=10000)
    print("   All three iframes visible.")

    print("3. Typing card number 4242 4242 4242 4242 ...")
    number_input.click()
    number_input.type("4242424242424242", delay=30)

    print("4. Typing expiry 12/28 ...")
    expiry_input.click()
    expiry_input.type("1228", delay=30)

    print("5. Typing CVC 123 ...")
    cvc_input.click()
    cvc_input.type("123", delay=30)

    number_val = number_input.input_value()
    print(f"   Formatted number: '{number_val}'")
    assert number_val == "4242 4242 4242 4242", f"Unexpected number format: {number_val}"

    print("6. Checking pay button becomes enabled (3 change events bridged) ...")
    pay_btn = page.locator("button.btn-pay")
    expect(pay_btn).to_be_enabled(timeout=5000)
    print("   Pay button enabled.")

    print("7. Clicking pay ...")
    pay_btn.click()

    print("8. Waiting for success result ...")
    result_box = page.locator(".result-box--success")
    expect(result_box).to_be_visible(timeout=15000)
    result_text = result_box.inner_text()
    print(f"   Result: {result_text}")
    assert "支付成功" in result_text, f"Unexpected result: {result_text}"
    assert "visa" in result_text, f"Brand missing from result: {result_text}"

    page.screenshot(path="e2e-screenshots/e2e-split-success.png")

    if console_errors:
        print(f"\n   Console errors ({len(console_errors)}):")
        for e in console_errors[:5]:
            print(f"   - {e[:200]}")
    else:
        print("   No console errors.")

    print("\nE2E PASSED: split fields -> bridge events -> tokenize -> confirm -> succeeded")
    browser.close()
