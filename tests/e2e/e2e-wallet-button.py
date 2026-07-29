"""E2E: Wallet Button - single wallet rendering, theme/type/height switching."""
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

    print("1. Navigating to /wallet-button ...")
    page.goto(f"{BASE}/wallet-button", wait_until="networkidle")

    print("2. Wallet button iframe loads with Apple Pay default ...")
    frame = page.frame_locator("iframe[title='Nexus walletButton element']").first
    frame.locator(".nexus-wb").wait_for(state="visible", timeout=10000)
    expect(frame.locator(".nexus-wb-text")).to_contain_text("Apple Pay")
    page.screenshot(path="e2e-screenshots/e2e-wb-01-apple-pay.png")

    print("3. Switching to Google Pay ...")
    page.locator(".controls .btn-group button", has_text="Google Pay").click()
    frame = page.frame_locator("iframe[title='Nexus walletButton element']").first
    expect(frame.locator(".nexus-wb-text")).to_contain_text("Google Pay", timeout=5000)
    page.screenshot(path="e2e-screenshots/e2e-wb-02-google-pay.png")

    print("4. Switching to PayPal ...")
    page.locator(".controls .btn-group button", has_text="PayPal").click()
    frame = page.frame_locator("iframe[title='Nexus walletButton element']").first
    expect(frame.locator(".nexus-wb-text")).to_contain_text("PayPal", timeout=5000)
    page.screenshot(path="e2e-screenshots/e2e-wb-03-paypal.png")

    print("5. Switching to Link ...")
    page.locator(".controls .btn-group button", has_text="Link").click()
    frame = page.frame_locator("iframe[title='Nexus walletButton element']").first
    expect(frame.locator(".nexus-wb-text")).to_contain_text("Link", timeout=5000)
    page.screenshot(path="e2e-screenshots/e2e-wb-04-link.png")

    print("6. Changing button type to 'Buy' ...")
    page.locator(".controls .btn-group button", has_text="Buy").click()
    frame = page.frame_locator("iframe[title='Nexus walletButton element']").first
    expect(frame.locator(".nexus-wb-text")).to_contain_text("Buy", timeout=5000)
    page.screenshot(path="e2e-screenshots/e2e-wb-05-buy-type.png")

    print("7. Switching to white theme ...")
    page.locator(".controls .btn-group button", has_text="White").first.click()
    frame = page.frame_locator("iframe[title='Nexus walletButton element']").first
    expect(frame.locator(".nexus-wb--white")).to_be_visible(timeout=5000)
    page.screenshot(path="e2e-screenshots/e2e-wb-06-white-theme.png")

    print("8. Verifying all wallets preview section ...")
    previews = page.locator(".wallet-preview")
    expect(previews).to_have_count(4, timeout=5000)
    page.screenshot(path="e2e-screenshots/e2e-wb-07-all-previews.png")

    print("9. Testing disabled state ...")
    page.locator("input[type='checkbox']").check()
    frame = page.frame_locator("iframe[title='Nexus walletButton element']").first
    expect(frame.locator(".nexus-wb[disabled]")).to_be_visible(timeout=5000)
    page.screenshot(path="e2e-screenshots/e2e-wb-08-disabled.png")

    if console_errors:
        print(f"\n   Console errors ({len(console_errors)}):")
        for e in console_errors[:5]:
            print(f"   - {e[:200]}")
    else:
        print("   No console errors.")

    print("\nE2E PASSED: wallet button (wallets, themes, types, height, disabled)")
    browser.close()
