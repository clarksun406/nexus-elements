"""E2E: Link Authentication - phone/email OTP flow."""
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

    print("1. Navigating to /link-authentication ...")
    page.goto(f"{BASE}/link-authentication", wait_until="networkidle")

    print("2. Phone mode: enter phone number ...")
    frame = page.frame_locator("iframe[title='Nexus linkAuthentication element']")
    phone_input = frame.locator(".nexus-link-phone")
    phone_input.wait_for(state="visible", timeout=10000)
    phone_input.fill("5551234567")
    page.screenshot(path="e2e-link-01-phone.png")

    print("3. Send verification code ...")
    frame.locator(".nexus-link-send-btn").click()

    print("4. OTP step: 6-digit code input visible ...")
    otp_inputs = frame.locator(".nexus-otp-input")
    expect(otp_inputs.first).to_be_visible(timeout=10000)
    expect(frame.locator(".nexus-link-subtitle")).to_contain_text("555")
    page.screenshot(path="e2e-link-02-otp.png")

    print("5. Enter OTP code ...")
    for i, digit in enumerate("123456"):
        otp_inputs.nth(i).fill(digit)

    print("6. Verify ...")
    frame.locator(".nexus-link-send-btn", has_text="验证").click()

    print("7. Verified state ...")
    expect(frame.locator(".nexus-link-verified")).to_be_visible(timeout=10000)
    expect(page.locator(".result-box")).to_contain_text("complete: true", timeout=5000)
    page.screenshot(path="e2e-link-03-verified.png")

    print("8. Switch to email mode and test ...")
    page.goto(f"{BASE}/link-authentication", wait_until="networkidle")
    frame = page.frame_locator("iframe[title='Nexus linkAuthentication element']")
    frame.locator(".nexus-link-mode-toggle button", has_text="邮箱").click()
    frame.locator(".nexus-link-email").fill("test@example.com")
    frame.locator(".nexus-link-send-btn").click()
    expect(frame.locator(".nexus-otp-input").first).to_be_visible(timeout=10000)
    expect(frame.locator(".nexus-link-subtitle")).to_contain_text("test@example.com")
    page.screenshot(path="e2e-link-04-email.png")

    if console_errors:
        print(f"\n   Console errors ({len(console_errors)}):")
        for e in console_errors[:5]:
            print(f"   - {e[:200]}")
    else:
        print("   No console errors.")

    print("\nE2E PASSED: link authentication (phone + email OTP flow)")
    browser.close()
