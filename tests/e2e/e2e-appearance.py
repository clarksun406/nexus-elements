"""E2E: appearance playground — variables, rules, fonts, locale, element style, API methods."""
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

    print("1. Navigating to /appearance ...")
    page.goto(f"{BASE}/appearance", wait_until="networkidle")
    page.screenshot(path="e2e-screenshots/e2e-appearance-01-loaded.png")
    print("   Page loaded.")

    print("2. Locating fields iframe ...")
    frame_locator = page.frame_locator("iframe[title='Nexus card element']")
    number_input = frame_locator.locator("input.nexus-number")
    number_input.wait_for(state="visible", timeout=10000)
    card_el = frame_locator.locator(".nexus-card-element")
    print("   Iframe card element visible.")

    print("3. Testing theme switching ...")
    for t in ["flat", "night", "none", "stripe"]:
        page.locator(".control-section .chip", has_text=t).first.click()
        page.wait_for_timeout(300)
    bg = card_el.evaluate("el => getComputedStyle(el).backgroundColor")
    print(f"   After cycling themes, background: {bg}")
    page.screenshot(path="e2e-screenshots/e2e-appearance-02-themes.png")

    print("4. Testing locale switching ...")
    for loc in ["en", "ja", "ko"]:
        page.locator(".control-section .chip", has_text=loc).first.click()
        page.wait_for_timeout(200)
    page.locator(".control-section .chip", has_text="zh").first.click()
    page.wait_for_timeout(200)
    print("   Locale switched zh -> en -> ja -> ko -> zh.")

    print("5. Testing font switching ...")
    page.locator(".control-section .chip", has_text="Inter").first.click()
    page.wait_for_timeout(500)
    page.screenshot(path="e2e-screenshots/e2e-appearance-03-font.png")
    page.locator(".control-section .chip", has_text="System Default").first.click()
    page.wait_for_timeout(300)
    print("   Font switched to Inter and back.")

    print("6. Testing custom variables ...")
    page.locator("input[type='checkbox']").first.check()
    page.wait_for_timeout(300)
    color_input = page.locator(".var-grid .color-input").first
    expect(color_input).to_be_visible(timeout=3000)
    color_input.fill("#ff0000")
    page.wait_for_timeout(500)
    page.screenshot(path="e2e-screenshots/e2e-appearance-04-custom-vars.png")
    print("   Custom variables enabled, colorPrimary set to #ff0000.")

    page.locator(".var-grid .select-input").first.select_option("16px")
    page.wait_for_timeout(300)
    print("   fontSizeBase changed to 16px.")

    page.locator("input[type='checkbox']").first.uncheck()
    page.wait_for_timeout(300)
    print("   Custom variables disabled.")

    print("7. Testing rules override ...")
    rule_checkboxes = page.locator(".rule-item input[type='checkbox']")
    rule_checkboxes.first.check()
    page.wait_for_timeout(500)
    page.screenshot(path="e2e-screenshots/e2e-appearance-05-rules.png")
    print("   .Input rule enabled.")

    rule_checkboxes.nth(1).check()
    page.wait_for_timeout(300)
    print("   .Input:hover rule enabled.")

    rule_checkboxes.first.uncheck()
    rule_checkboxes.nth(1).uncheck()
    page.wait_for_timeout(300)
    print("   Rules disabled.")

    print("8. Testing element style (per-element) ...")
    checkboxes = page.locator("input[type='checkbox']")
    element_style_toggle = checkboxes.nth(1)
    element_style_toggle.check()
    page.wait_for_timeout(500)
    page.screenshot(path="e2e-screenshots/e2e-appearance-06-element-style.png")
    print("   Element style enabled.")
    element_style_toggle.uncheck()
    page.wait_for_timeout(300)

    print("9. Testing element methods (focus/blur/clear) ...")
    number_input.click()
    number_input.type("4242424242424242", delay=20)
    page.wait_for_timeout(300)

    page.locator(".method-btn[data-method='blur']").click()
    page.wait_for_timeout(300)
    page.locator(".method-btn[data-method='focus']").click()
    page.wait_for_timeout(300)

    event_entries = page.locator(".event-entry")
    count = event_entries.count()
    print(f"   Event log has {count} entries after focus/blur.")
    assert count >= 2, f"Expected at least 2 events, got {count}"

    page.locator(".method-btn[data-method='clear']").click()
    page.wait_for_timeout(500)
    number_val = number_input.input_value()
    print(f"   After clear(), number input value: '{number_val}'")
    assert number_val == "", f"Expected empty after clear, got '{number_val}'"
    page.screenshot(path="e2e-screenshots/e2e-appearance-07-methods.png")

    print("10. Verifying event log entries ...")
    event_types = page.locator(".event-type").all_inner_texts()
    print(f"   Event types logged: {event_types[:10]}")
    has_focus = any("focus" in t for t in event_types)
    has_blur = any("blur" in t for t in event_types)
    assert has_focus, "Expected focus event in log"
    assert has_blur, "Expected blur event in log"

    page.locator(".clear-btn").click()
    page.wait_for_timeout(200)
    expect(page.locator(".event-empty")).to_be_visible(timeout=3000)
    print("   Event log cleared successfully.")

    if console_errors:
        print(f"\n   Console errors ({len(console_errors)}):")
        for e in console_errors[:5]:
            print(f"   - {e[:200]}")
    else:
        print("   No console errors.")

    print("\nE2E PASSED: appearance playground — themes/vars/rules/fonts/locale/style/methods/events")
    browser.close()
