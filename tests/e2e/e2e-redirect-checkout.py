"""E2E: Redirect Checkout - redirect to hosted page, pay, redirect back to success."""
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

    print("1. Navigating to /redirect-checkout ...")
    page.goto(f"{BASE}/redirect-checkout", wait_until="networkidle")

    print("2. Order summary visible ...")
    expect(page.locator(".order-summary")).to_contain_text("Nexus Pro 年度订阅")
    expect(page.locator(".order-summary")).to_contain_text("¥129.00")
    page.screenshot(path="e2e-screenshots/e2e-redirect-01-loaded.png")

    print("3. Clicking '前往支付' redirects to hosted checkout page ...")
    page.locator(".pay-btn").click()

    print("4. Hosted checkout page loads with order details ...")
    page.wait_for_url("**/__nexus-checkout/**", timeout=15000)
    total = page.locator("#cs-total")
    expect(total).to_contain_text("¥129.00", timeout=10000)
    page.screenshot(path="e2e-screenshots/e2e-redirect-02-checkout.png")

    print("5. Filling card and submitting payment ...")
    page.locator("#cs-number").fill("4242424242424242")
    page.locator("#cs-expiry").fill("12/28")
    page.locator("#cs-cvc").fill("123")
    page.locator("#cs-pay").click()

    print("6. Payment success - redirecting back to success page ...")
    page.wait_for_url("**/redirect-success**", timeout=15000)

    print("7. Success page shows session details ...")
    expect(page.locator(".result-box--success")).to_contain_text("cs_test_", timeout=10000)
    expect(page.locator(".result-box--success")).to_contain_text("complete", timeout=5000)
    page.screenshot(path="e2e-screenshots/e2e-redirect-03-success.png")

    if console_errors:
        print(f"\n   Console errors ({len(console_errors)}):")
        for e in console_errors[:5]:
            print(f"   - {e[:200]}")
    else:
        print("   No console errors.")

    print("\nE2E PASSED: redirect checkout flow")
    browser.close()
