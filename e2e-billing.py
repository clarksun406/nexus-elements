"""E2E: Billing - plan selection, payment, SetupIntent subscription flow."""
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

    print("1. Navigating to /billing ...")
    page.goto(f"{BASE}/billing", wait_until="networkidle")

    print("2. Plan selection: monthly plan visible ...")
    expect(page.locator(".plan-card")).to_contain_text("Nexus Pro")
    expect(page.locator(".plan-card")).to_contain_text("¥29.00/月")
    page.screenshot(path="e2e-billing-01-plan.png")

    print("3. Switch to yearly plan ...")
    page.locator(".period-toggle button", has_text="年付").click()
    expect(page.locator(".plan-card")).to_contain_text("¥290.00/年")
    page.screenshot(path="e2e-billing-02-yearly.png")

    print("4. Click '继续支付' to proceed to payment step ...")
    page.locator(".btn-pay", has_text="继续支付").click()
    expect(page.locator(".order-summary")).to_contain_text("年度订阅")
    page.screenshot(path="e2e-billing-03-payment.png")

    print("5. Wait for Payment Element iframe to load ...")
    frame = page.frame_locator("iframe[title='Nexus payment element']")
    frame.locator("input").first.wait_for(state="visible", timeout=10000)

    print("6. Fill card details in Payment Element ...")
    frame.locator("input").first.fill("4242424242424242")
    inputs = frame.locator("input")
    inputs.nth(1).fill("1228")
    inputs.nth(2).fill("123")

    print("7. Wait for complete state and click subscribe ...")
    expect(page.locator(".btn-pay")).not_to_be_disabled(timeout=10000)
    page.locator(".btn-pay", has_text="订阅").click()

    print("8. Subscription success ...")
    expect(page.locator(".success-section")).to_be_visible(timeout=15000)
    expect(page.locator(".success-section")).to_contain_text("订阅成功")
    expect(page.locator(".success-detail")).to_contain_text("seti_")
    page.screenshot(path="e2e-billing-04-success.png")

    if console_errors:
        print(f"\n   Console errors ({len(console_errors)}):")
        for e in console_errors[:5]:
            print(f"   - {e[:200]}")
    else:
        print("   No console errors.")

    print("\nE2E PASSED: billing subscription flow")
    browser.close()
