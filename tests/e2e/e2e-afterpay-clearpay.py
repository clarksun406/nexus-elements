"""E2E: Afterpay/Clearpay - BNPL 4-installment display, locale/currency switching, limit handling."""
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

    print("1. Navigating to /afterpay-clearpay ...")
    page.goto(f"{BASE}/afterpay-clearpay", wait_until="networkidle")

    print("2. Afterpay iframe loads with default amount ...")
    frame = page.frame_locator("iframe[title='Nexus afterpayClearpay element']")
    frame.locator(".nexus-apc").wait_for(state="visible", timeout=10000)
    expect(frame.locator(".nexus-apc-message")).to_contain_text("4 期免息", timeout=5000)
    expect(frame.locator(".nexus-apc-brand")).to_contain_text("Afterpay")
    page.screenshot(path="e2e-screenshots/e2e-apc-01-default.png")

    print("3. Changing amount via slider ...")
    page.locator(".range-input").fill("20000")
    page.locator(".range-input").dispatch_event("input")
    frame = page.frame_locator("iframe[title='Nexus afterpayClearpay element']")
    expect(frame.locator(".nexus-apc-message")).to_contain_text("Afterpay", timeout=5000)
    page.screenshot(path="e2e-screenshots/e2e-apc-02-amount-changed.png")

    print("4. Switching currency to GBP (Clearpay brand) ...")
    page.locator(".btn-group button", has_text="GBP").click()
    frame = page.frame_locator("iframe[title='Nexus afterpayClearpay element']")
    expect(frame.locator(".nexus-apc-brand")).to_contain_text("Clearpay", timeout=5000)
    expect(frame.locator(".nexus-apc-message")).to_contain_text("£", timeout=5000)
    page.screenshot(path="e2e-screenshots/e2e-apc-03-gbp-clearpay.png")

    print("5. Switching to compact style ...")
    page.locator(".btn-group button", has_text="Compact").click()
    frame = page.frame_locator("iframe[title='Nexus afterpayClearpay element']")
    expect(frame.locator(".nexus-apc-compact")).to_be_visible(timeout=5000)
    expect(frame.locator(".nexus-apc-compact-text")).to_contain_text("4 ×")
    page.screenshot(path="e2e-screenshots/e2e-apc-04-compact.png")

    print("6. Testing over-limit amount ...")
    page.locator(".ctrl-btn", has_text="超限").click()
    frame = page.frame_locator("iframe[title='Nexus afterpayClearpay element']")
    expect(frame.locator(".nexus-apc-over-limit")).to_be_visible(timeout=5000)
    expect(frame.locator(".nexus-apc-over-limit")).to_contain_text("超出")
    page.screenshot(path="e2e-screenshots/e2e-apc-05-over-limit.png")

    print("7. Restoring normal amount ...")
    page.locator(".ctrl-btn", has_text="正常").click()
    frame = page.frame_locator("iframe[title='Nexus afterpayClearpay element']")
    frame.locator(".nexus-apc").wait_for(state="visible", timeout=10000)
    expect(frame.locator(".nexus-apc-compact")).to_be_visible(timeout=5000)
    expect(frame.locator(".nexus-apc-over-limit")).not_to_be_visible(timeout=5000)
    page.screenshot(path="e2e-screenshots/e2e-apc-06-restored.png")

    if console_errors:
        print(f"\n   Console errors ({len(console_errors)}):")
        for e in console_errors[:5]:
            print(f"   - {e[:200]}")
    else:
        print("   No console errors.")

    print("\nE2E PASSED: afterpay/clearpay (installment display, locale switch, compact, limit)")
    browser.close()
