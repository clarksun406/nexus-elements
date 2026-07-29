"""E2E: Payment Element advanced - saved methods (PE-006), billingDetails email (PE-010/011)."""
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

    print("1. Navigating to /payment-element ...")
    page.goto(f"{BASE}/payment-element", wait_until="networkidle")

    frame = page.frame_locator("iframe[title='Nexus payment element']")
    frame.locator("input.nexus-number").wait_for(state="visible", timeout=10000)
    pay_btn = page.locator("button.btn-pay")

    print("2. Enabling saved cards (PE-006) ...")
    page.locator(".chip", has_text="已保存卡").click()
    saved_items = frame.locator(".nexus-saved-item")
    expect(saved_items).to_have_count(3, timeout=5000)  # 2 saved + use-new
    saved_texts = saved_items.all_inner_texts()
    print(f"   Saved items: {saved_texts}")
    assert any("4242" in t for t in saved_texts), f"Missing visa 4242: {saved_texts}"

    print("3. Selecting saved visa and paying ...")
    saved_items.first.click()
    expect(pay_btn).to_be_enabled(timeout=5000)
    page.screenshot(path="e2e-pe-adv-01-saved.png")
    pay_btn.click()
    result_box = page.locator(".result-box--success")
    expect(result_box).to_be_visible(timeout=15000)
    print(f"   Result: {result_box.inner_text()}")

    print("4. Switching back to new payment method hides saved form ...")
    frame.locator(".nexus-saved-item", has_text="Use a new payment method").click()
    expect(frame.locator("input.nexus-number")).to_be_visible(timeout=5000)

    print("5. Enabling required email (PE-010): card alone is not complete ...")
    page.locator(".chip", has_text="收集邮箱").click()
    email_input = frame.locator("input.nexus-billing-email")
    email_input.wait_for(state="visible", timeout=5000)
    number_input = frame.locator("input.nexus-number")
    number_input.click()
    number_input.type("4242424242424242", delay=20)
    frame.locator("input.nexus-expiry").type("1228", delay=20)
    frame.locator("input.nexus-cvc").type("123", delay=20)
    expect(pay_btn).to_be_disabled()
    print("   Pay button stays disabled without email.")

    print("6. Invalid email shows error ...")
    email_input.fill("not-an-email")
    email_input.blur()
    expect(frame.locator(".nexus-error")).to_be_visible(timeout=5000)
    expect(pay_btn).to_be_disabled()
    page.screenshot(path="e2e-pe-adv-02-bad-email.png")

    print("7. Valid email completes and pays ...")
    email_input.fill("demo@nexus.dev")
    expect(pay_btn).to_be_enabled(timeout=5000)
    pay_btn.click()
    expect(page.locator(".result-box--success")).to_be_visible(timeout=15000)
    print(f"   Result: {page.locator('.result-box--success').inner_text()}")
    page.screenshot(path="e2e-pe-adv-03-success.png")

    if console_errors:
        print(f"\n   Console errors ({len(console_errors)}):")
        for e in console_errors[:5]:
            print(f"   - {e[:200]}")
    else:
        print("   No console errors.")

    print("\nE2E PASSED: saved payment methods + billingDetails collection")
    browser.close()
