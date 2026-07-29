"""E2E: Embedded Checkout (CFM-004) - hosted page in iframe, card payment, onComplete callback."""
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

    print("1. Navigating to /embedded-checkout ...")
    page.goto(f"{BASE}/embedded-checkout", wait_until="networkidle")

    print("2. Session created; hosted page iframe loads with order summary ...")
    session_id = page.locator(".session-id")
    expect(session_id).to_contain_text("cs_test_", timeout=10000)
    print(f"   {session_id.inner_text()}")

    frame = page.frame_locator("iframe[title='Nexus embedded checkout']")
    total = frame.locator("#cs-total")
    expect(total).to_contain_text("¥129.00", timeout=10000)
    items = frame.locator(".line-item")
    expect(items).to_have_count(2)
    print(f"   Line items: {items.all_inner_texts()}")
    page.screenshot(path="e2e-screenshots/e2e-ec-01-loaded.png")

    print("3. Declined card shows error inside hosted page ...")
    frame.locator("#cs-number").fill("4000000000000002")
    frame.locator("#cs-expiry").fill("12/28")
    frame.locator("#cs-cvc").fill("123")
    frame.locator("#cs-pay").click()
    error_el = frame.locator("#cs-error")
    expect(error_el).to_contain_text("拒绝", timeout=10000)
    print(f"   Error: {error_el.inner_text()}")
    page.screenshot(path="e2e-screenshots/e2e-ec-02-declined.png")

    print("4. Valid card completes payment; success shown in iframe ...")
    frame.locator("#cs-number").fill("4242424242424242")
    frame.locator("#cs-pay").click()
    success = frame.locator("#cs-success")
    expect(success).to_be_visible(timeout=10000)
    expect(success).to_contain_text("支付成功")

    print("5. onComplete fires in parent (postMessage bridge) ...")
    result_box = page.locator(".result-box--success")
    expect(result_box).to_be_visible(timeout=10000)
    result_text = result_box.inner_text()
    print(f"   Parent result: {result_text}")
    assert "结账完成" in result_text and "cs_test_" in result_text and "complete" in result_text, f"Unexpected: {result_text}"
    assert "pi_test_" in result_text, f"Missing payment_intent: {result_text}"
    page.screenshot(path="e2e-screenshots/e2e-ec-03-success.png")

    if console_errors:
        print(f"\n   Console errors ({len(console_errors)}):")
        for e in console_errors[:5]:
            print(f"   - {e[:200]}")
    else:
        print("   No console errors.")

    print("\nE2E PASSED: embedded checkout hosted page (CFM-004)")
    browser.close()
