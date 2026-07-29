"""E2E: Payment Method Messaging - BNPL installment display, currency/style switching."""
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

    print("1. Navigating to /payment-messaging ...")
    page.goto(f"{BASE}/payment-messaging", wait_until="networkidle")

    print("2. Messaging iframe loads with default amount ($99.00) ...")
    frame = page.frame_locator("iframe[title='Nexus paymentMethodMessaging element']")
    frame.locator(".nexus-pmm-element").wait_for(state="visible", timeout=10000)

    messages = frame.locator(".nexus-pmm-message")
    expect(messages).to_have_count(3, timeout=5000)
    expect(messages.first).to_contain_text("Afterpay")
    expect(messages.first).to_contain_text("interest-free")
    page.screenshot(path="e2e-screenshots/e2e-pmm-01-loaded.png")

    print("3. Selecting a different product updates the amount ...")
    page.locator(".product-item", has_text="无线蓝牙耳机").click()
    frame = page.frame_locator("iframe[title='Nexus paymentMethodMessaging element']")
    expect(frame.locator(".nexus-pmm-message").first).to_contain_text("$12.25", timeout=5000)
    page.screenshot(path="e2e-screenshots/e2e-pmm-02-amount-changed.png")

    print("4. Switching currency to EUR ...")
    page.locator("select").first.select_option("EUR")
    frame = page.frame_locator("iframe[title='Nexus paymentMethodMessaging element']")
    expect(frame.locator(".nexus-pmm-message").first).to_contain_text("€", timeout=5000)
    page.screenshot(path="e2e-screenshots/e2e-pmm-03-eur.png")

    print("5. Switching to compact style ...")
    selects = page.locator("select")
    selects.nth(1).select_option("compact")
    frame = page.frame_locator("iframe[title='Nexus paymentMethodMessaging element']")
    expect(frame.locator(".nexus-pmm-compact")).to_be_visible(timeout=5000)
    page.screenshot(path="e2e-screenshots/e2e-pmm-04-compact.png")

    if console_errors:
        print(f"\n   Console errors ({len(console_errors)}):")
        for e in console_errors[:5]:
            print(f"   - {e[:200]}")
    else:
        print("   No console errors.")

    print("\nE2E PASSED: payment method messaging (BNPL display + currency/style switching)")
    browser.close()
