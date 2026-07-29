"""E2E: payment-element aggregated flow — card via tabs, layout switching, redirect method (iDEAL)."""
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

    print("1. Navigating to /payment-element ...")
    page.goto(f"{BASE}/payment-element", wait_until="networkidle")
    page.screenshot(path="e2e-screenshots/e2e-pe-01-loaded.png")

    print("2. Locating payment iframe (tabs layout default) ...")
    frame = page.frame_locator("iframe[title='Nexus payment element']")
    tabs = frame.locator(".nexus-tab")
    expect(tabs).to_have_count(1, timeout=10000)
    print("   CNY currency filters out iDEAL (PE-005): only card tab.")

    print("2b. Switching currency to EUR restores iDEAL ...")
    page.locator(".chip", has_text="EUR").click()
    expect(tabs).to_have_count(2, timeout=5000)
    tab_texts = tabs.all_inner_texts()
    print(f"   Tabs: {tab_texts}")
    assert ("Card" in tab_texts or "银行卡" in tab_texts) and "iDEAL" in tab_texts, f"Unexpected tabs: {tab_texts}"

    print("3. Card subform visible by default; filling card details ...")
    number_input = frame.locator("input.nexus-number")
    number_input.wait_for(state="visible", timeout=10000)
    number_input.click()
    number_input.type("4242424242424242", delay=20)
    frame.locator("input.nexus-expiry").type("1228", delay=20)
    frame.locator("input.nexus-cvc").type("123", delay=20)
    page.screenshot(path="e2e-screenshots/e2e-pe-02-card-filled.png")

    print("4. Pay button enables via change bridge; paying with card ...")
    pay_btn = page.locator("button.btn-pay")
    expect(pay_btn).to_be_enabled(timeout=5000)
    pay_btn.click()

    result_box = page.locator(".result-box--success")
    expect(result_box).to_be_visible(timeout=15000)
    result_text = result_box.inner_text()
    print(f"   Result: {result_text}")
    assert "支付成功" in result_text and "card" in result_text and "tabs" in result_text, f"Unexpected: {result_text}"
    page.screenshot(path="e2e-screenshots/e2e-pe-03-card-success.png")

    print("5. Switching layout to accordion ...")
    page.locator(".chip", has_text="accordion").click()
    expect(frame.locator(".nexus-accordion-header")).to_have_count(2, timeout=5000)
    print("   Accordion headers rendered.")

    print("6. Switching layout to radio ...")
    page.locator(".chip", has_text="radio").click()
    expect(frame.locator("input.nexus-radio")).to_have_count(2, timeout=5000)
    print("   Radio list rendered.")

    print("7. Selecting iDEAL method and choosing bank ...")
    frame.locator(".nexus-radio-label", has_text="iDEAL").click()
    bank_select = frame.locator("select.nexus-bank-select")
    expect(bank_select).to_be_visible(timeout=5000)
    bank_select.select_option("ing")
    expect(pay_btn).to_be_enabled(timeout=5000)
    page.screenshot(path="e2e-screenshots/e2e-pe-04-ideal.png")

    print("8. Paying with iDEAL (redirect-method token) ...")
    pay_btn.click()
    expect(result_box).to_contain_text("ideal", timeout=15000)
    result_text = result_box.inner_text()
    print(f"   Result: {result_text}")
    assert "支付成功" in result_text and "ideal" in result_text, f"Unexpected: {result_text}"
    page.screenshot(path="e2e-screenshots/e2e-pe-05-ideal-success.png")

    if console_errors:
        print(f"\n   Console errors ({len(console_errors)}):")
        for e in console_errors[:5]:
            print(f"   - {e[:200]}")
    else:
        print("   No console errors.")

    print("\nE2E PASSED: payment element — card via tabs, layout switch, iDEAL redirect method")
    browser.close()
