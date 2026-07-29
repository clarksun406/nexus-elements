"""E2E: express-checkout wallet buttons — availability, confirm flow, styling."""
import re
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

    print("1. Navigating to /express-checkout ...")
    page.goto(f"{BASE}/express-checkout", wait_until="networkidle")
    page.screenshot(path="e2e-ec-01-loaded.png")

    print("2. Locating express checkout iframe ...")
    frame = page.frame_locator("iframe[title='Nexus expressCheckout element']")
    buttons = frame.locator(".nexus-wallet-btn")
    expect(buttons).to_have_count(4, timeout=10000)
    wallets = buttons.evaluate_all("els => els.map(el => el.dataset.wallet)")
    print(f"   Wallet buttons: {wallets}")
    assert wallets == ["applePay", "googlePay", "paypal", "link"], f"Unexpected wallets: {wallets}"

    print("3. Checking ready event exposed availablePaymentMethods ...")
    available_line = page.locator(".available-line")
    expect(available_line).to_contain_text("applePay", timeout=5000)
    print(f"   {available_line.inner_text().strip()}")

    print("4. Clicking Apple Pay button (confirm event -> token -> confirmPayment) ...")
    apple_btn = frame.locator(".nexus-wallet-btn[data-wallet='applePay']")
    apple_btn.click()

    print("5. Waiting for success flash and result ...")
    expect(apple_btn).to_have_text("✓", timeout=10000)
    print("   Button flashed success (complete('success') round-trip).")
    result_box = page.locator(".result-box--success")
    expect(result_box).to_be_visible(timeout=15000)
    result_text = result_box.inner_text()
    print(f"   Result: {result_text}")
    assert "支付成功" in result_text and "applePay" in result_text, f"Unexpected: {result_text}"
    page.screenshot(path="e2e-ec-02-success.png")

    print("6. Switching theme to white ...")
    expect(apple_btn).to_have_text("Apple Pay", timeout=5000)
    page.locator(".chip", has_text="white").first.click()
    expect(apple_btn).to_have_css("background-color", "rgb(255, 255, 255)", timeout=5000)
    print("   White theme applied to button.")

    print("7. Switching button type to buy ...")
    page.locator(".chip", has_text="buy").click()
    gpay_btn = frame.locator(".nexus-wallet-btn[data-wallet='googlePay']")
    expect(gpay_btn).to_have_text("Buy with G Pay", timeout=5000)
    print("   G Pay label: Buy with G Pay")

    print("8. Switching layout to 2 columns ...")
    page.locator(".chip", has_text="2").click()
    container = frame.locator(".nexus-express-checkout")
    expect(container).to_have_attribute("style", re.compile(r"repeat\(2,\s*1fr\)"), timeout=5000)
    print("   grid-template-columns: repeat(2, 1fr)")

    page.screenshot(path="e2e-ec-03-styling.png")

    if console_errors:
        print(f"\n   Console errors ({len(console_errors)}):")
        for e in console_errors[:5]:
            print(f"   - {e[:200]}")
    else:
        print("   No console errors.")

    print("\nE2E PASSED: express checkout — wallets, confirm flow, complete(status), styling")
    browser.close()
