"""E2E: card-combined payment flow verification."""
import os
import sys
from playwright.sync_api import sync_playwright, expect

sys.stdout.reconfigure(encoding="utf-8")

BASE = os.environ.get("E2E_BASE", "http://localhost:3000")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 900})

    # Collect console errors for debugging
    console_errors = []
    page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
    page.on("pageerror", lambda err: console_errors.append(str(err)))

    print("1. Navigating to /card-combined ...")
    page.goto(f"{BASE}/card-combined", wait_until="networkidle")
    page.screenshot(path="e2e-01-loaded.png")
    print("   Page loaded.")

    # The card element renders inside an iframe
    print("2. Locating fields iframe ...")
    frame_locator = page.frame_locator("iframe[title='Nexus card element']")
    number_input = frame_locator.locator("input.nexus-number")
    number_input.wait_for(state="visible", timeout=10000)
    print("   Iframe card number input visible.")

    print("3. Typing card number 4242 4242 4242 4242 ...")
    number_input.click()
    number_input.type("4242424242424242", delay=30)

    print("4. Typing expiry 12/28 ...")
    expiry_input = frame_locator.locator("input.nexus-expiry")
    expiry_input.click()
    expiry_input.type("1228", delay=30)

    print("5. Typing CVC 123 ...")
    cvc_input = frame_locator.locator("input.nexus-cvc")
    cvc_input.click()
    cvc_input.type("123", delay=30)

    page.screenshot(path="e2e-02-filled.png")

    # Verify formatted values inside iframe
    number_val = number_input.input_value()
    expiry_val = expiry_input.input_value()
    print(f"   Formatted number: '{number_val}', expiry: '{expiry_val}'")
    assert "4242 4242 4242 4242" == number_val, f"Unexpected number format: {number_val}"

    print("6. Checking pay button becomes enabled (change event bridge) ...")
    pay_btn = page.locator("button.btn-pay")
    expect(pay_btn).to_be_enabled(timeout=5000)
    print("   Pay button enabled — bridge change events working.")

    print("7. Clicking pay ...")
    pay_btn.click()

    print("8. Waiting for success result ...")
    result_box = page.locator(".result-box--success")
    expect(result_box).to_be_visible(timeout=15000)
    result_text = result_box.inner_text()
    print(f"   Result: {result_text}")
    assert "支付成功" in result_text, f"Unexpected result: {result_text}"

    page.screenshot(path="e2e-03-success.png")

    print("9. Switching theme to night ...")
    page.locator(".theme-btn", has_text="night").click()
    card_el = frame_locator.locator(".nexus-card-element")
    bg = card_el.evaluate("el => getComputedStyle(el).backgroundColor")
    print(f"   Iframe card background: {bg}")
    assert bg == "rgb(48, 49, 61)", f"Night theme background not applied: {bg}"

    print("10. Switching theme to flat ...")
    page.locator(".theme-btn", has_text="flat").click()
    radius = card_el.evaluate("el => getComputedStyle(el).borderRadius")
    print(f"   Iframe card border-radius: {radius}")
    assert radius == "2px", f"Flat theme radius not applied: {radius}"

    page.screenshot(path="e2e-04-themes.png")

    if console_errors:
        print(f"\n   Console errors ({len(console_errors)}):")
        for e in console_errors[:5]:
            print(f"   - {e[:200]}")
    else:
        print("   No console errors.")

    print("\nE2E PASSED: card input -> bridge events -> tokenize -> confirm -> succeeded")
    browser.close()
