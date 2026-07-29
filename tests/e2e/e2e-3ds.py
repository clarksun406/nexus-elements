"""E2E: 3DS redirect chain (card 4000 0000 0000 3220 -> requires_action -> challenge -> succeeded)."""
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

    print("1. Navigating to /card-combined ...")
    page.goto(f"{BASE}/card-combined", wait_until="networkidle")
    print("   Page loaded.")

    print("2. Typing 3DS test card 4000 0000 0000 3220 ...")
    frame_locator = page.frame_locator("iframe[title='Nexus card element']")
    number_input = frame_locator.locator("input.nexus-number")
    number_input.wait_for(state="visible", timeout=10000)
    number_input.click()
    number_input.type("4000000000003220", delay=30)

    expiry_input = frame_locator.locator("input.nexus-expiry")
    expiry_input.click()
    expiry_input.type("1228", delay=30)

    cvc_input = frame_locator.locator("input.nexus-cvc")
    cvc_input.click()
    cvc_input.type("123", delay=30)
    print("   Card filled.")

    print("3. Clicking pay (expect auto-redirect to 3DS challenge) ...")
    page.locator("button.btn-pay").click()

    page.wait_for_url("**/3ds-mock**", timeout=15000)
    print(f"   Redirected to: {page.url}")

    print("4. Approving the 3DS challenge ...")
    page.locator("button.approve").click()

    page.wait_for_url(lambda url: "status=approved" in url, timeout=15000)
    print(f"   Returned to: {page.url}")

    print("5. Verifying final success result ...")
    result_box = page.locator(".result-box--success")
    expect(result_box).to_be_visible(timeout=15000)
    result_text = result_box.inner_text()
    print(f"   Result: {result_text}")
    assert "支付成功" in result_text, f"Unexpected result: {result_text}"
    assert "3DS 验证通过" in result_text, f"3DS marker missing: {result_text}"

    page.screenshot(path="e2e-screenshots/e2e-3ds-success.png")

    if console_errors:
        print(f"\n   Console errors ({len(console_errors)}):")
        for e in console_errors[:5]:
            print(f"   - {e[:200]}")
    else:
        print("   No console errors.")

    print("\nE2E PASSED: confirm -> requires_action -> 3DS redirect -> approved -> succeeded")
    browser.close()
