"""E2E: Bank Transfer Elements - iDEAL, IBAN, BECS, FPX, EPS, P24 tab switching."""
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

    print("1. Navigating to /bank-transfer ...")
    page.goto(f"{BASE}/bank-transfer", wait_until="networkidle")
    page.screenshot(path="e2e-screenshots/e2e-bank-01-loaded.png")

    # --- iDEAL ---
    print("2. iDEAL: search and select a bank ...")
    frame = page.frame_locator("iframe[title='Nexus idealBank element']")
    search_input = frame.locator(".nexus-bank-search")
    search_input.wait_for(state="visible", timeout=10000)

    search_input.fill("abn")
    items = frame.locator(".nexus-bank-item")
    expect(items.first).to_be_visible(timeout=5000)
    first_bank_name = items.first.locator(".nexus-bank-name").inner_text()
    print(f"   Filtered bank: {first_bank_name}")
    items.first.click()

    expect(page.locator(".result-box")).to_contain_text("complete: true", timeout=5000)
    expect(page.locator(".value-dump")).to_contain_text('"bank":', timeout=5000)
    page.screenshot(path="e2e-screenshots/e2e-bank-02-ideal.png")

    # --- IBAN ---
    print("3. IBAN: enter valid DE IBAN ...")
    page.locator(".tab-btn", has_text="IBAN").click()
    frame = page.frame_locator("iframe[title='Nexus iban element']")
    iban_input = frame.locator(".nexus-iban-input")
    iban_input.wait_for(state="visible", timeout=10000)

    iban_input.fill("DE89370400440532013000")
    expect(page.locator(".result-box")).to_contain_text("complete: true", timeout=5000)
    expect(page.locator(".value-dump")).to_contain_text("DE89", timeout=5000)
    page.screenshot(path="e2e-screenshots/e2e-bank-03-iban.png")

    # --- BECS ---
    print("4. BECS: enter BSB + account number ...")
    page.locator(".tab-btn", has_text="BECS").click()
    frame = page.frame_locator("iframe[title='Nexus auBankAccount element']")
    bsb_input = frame.locator(".nexus-au-bsb")
    bsb_input.wait_for(state="visible", timeout=10000)

    bsb_input.fill("062000")
    frame.locator(".nexus-au-account").fill("123456789")
    expect(page.locator(".result-box")).to_contain_text("complete: true", timeout=5000)
    expect(page.locator(".value-dump")).to_contain_text("062000", timeout=5000)
    page.screenshot(path="e2e-screenshots/e2e-bank-04-becs.png")

    # --- FPX ---
    print("5. FPX: select a bank ...")
    page.locator(".tab-btn", has_text="FPX").click()
    frame = page.frame_locator("iframe[title='Nexus fpxBank element']")
    fpx_items = frame.locator(".nexus-bank-item")
    fpx_items.first.wait_for(state="visible", timeout=10000)
    fpx_items.first.click()
    expect(page.locator(".result-box")).to_contain_text("complete: true", timeout=5000)
    page.screenshot(path="e2e-screenshots/e2e-bank-05-fpx.png")

    # --- EPS ---
    print("6. EPS: select a bank ...")
    page.locator(".tab-btn", has_text="EPS").click()
    frame = page.frame_locator("iframe[title='Nexus epsBank element']")
    eps_items = frame.locator(".nexus-bank-item")
    eps_items.first.wait_for(state="visible", timeout=10000)
    eps_items.first.click()
    expect(page.locator(".result-box")).to_contain_text("complete: true", timeout=5000)
    page.screenshot(path="e2e-screenshots/e2e-bank-06-eps.png")

    # --- P24 ---
    print("7. P24: select a bank ...")
    page.locator(".tab-btn", has_text="P24").click()
    frame = page.frame_locator("iframe[title='Nexus p24Bank element']")
    p24_items = frame.locator(".nexus-bank-item")
    p24_items.first.wait_for(state="visible", timeout=10000)
    p24_items.first.click()
    expect(page.locator(".result-box")).to_contain_text("complete: true", timeout=5000)
    page.screenshot(path="e2e-screenshots/e2e-bank-07-p24.png")

    if console_errors:
        print(f"\n   Console errors ({len(console_errors)}):")
        for e in console_errors[:5]:
            print(f"   - {e[:200]}")
    else:
        print("   No console errors.")

    print("\nE2E PASSED: bank transfer elements (iDEAL/IBAN/BECS/FPX/EPS/P24)")
    browser.close()
