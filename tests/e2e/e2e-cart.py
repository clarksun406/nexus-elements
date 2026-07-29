"""E2E: Cart Element - product list, quantity editing, promo codes, totals."""
import os
import sys
from playwright.sync_api import sync_playwright, expect

sys.stdout.reconfigure(encoding="utf-8")

BASE = os.environ.get("E2E_BASE", "http://localhost:3000")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 1200})

    console_errors = []
    page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
    page.on("pageerror", lambda err: console_errors.append(str(err)))

    print("1. Navigating to /cart ...")
    page.goto(f"{BASE}/cart", wait_until="networkidle")

    print("2. Cart iframe loads with 3 items ...")
    frame = page.frame_locator("iframe[title='Nexus cart element']")
    frame.locator(".nexus-cart").wait_for(state="visible", timeout=10000)

    items = frame.locator(".nexus-cart-item")
    expect(items).to_have_count(3, timeout=5000)
    page.screenshot(path="e2e-screenshots/e2e-cart-01-loaded.png")

    print("3. Verifying item names are displayed ...")
    expect(items.first.locator(".nexus-cart-item-name")).to_contain_text("Nexus Pro")
    expect(items.nth(1).locator(".nexus-cart-item-name")).to_contain_text("无线蓝牙耳机")
    page.screenshot(path="e2e-screenshots/e2e-cart-02-items.png")

    print("4. Increasing quantity of first item ...")
    first_item = items.first
    first_item.locator(".nexus-cart-qty-btn").last.click()
    expect(first_item.locator(".nexus-cart-qty-value")).to_have_text("2", timeout=5000)
    page.screenshot(path="e2e-screenshots/e2e-cart-03-qty-increased.png")

    print("5. Decreasing quantity back ...")
    first_item.locator(".nexus-cart-qty-btn").first.click()
    expect(first_item.locator(".nexus-cart-qty-value")).to_have_text("1", timeout=5000)

    print("6. Verifying shipping options are visible ...")
    shipping_options = frame.locator(".nexus-cart-shipping-option")
    expect(shipping_options).to_have_count(3, timeout=5000)
    expect(shipping_options.first).to_contain_text("标准配送")

    print("7. Selecting express shipping ...")
    shipping_options.nth(1).click()
    page.wait_for_timeout(500)
    active_shipping = frame.locator(".nexus-cart-shipping-option.active")
    expect(active_shipping).to_contain_text("加急配送", timeout=5000)
    page.screenshot(path="e2e-screenshots/e2e-cart-04-shipping.png")

    print("8. Applying promo code NEXUS10 ...")
    promo_input = frame.locator(".nexus-cart-promo-field")
    promo_input.fill("NEXUS10")
    frame.locator(".nexus-cart-promo-btn").click()
    expect(frame.locator(".nexus-cart-promo-applied")).to_be_visible(timeout=5000)
    expect(frame.locator(".nexus-cart-promo-code")).to_have_text("NEXUS10", timeout=5000)
    page.screenshot(path="e2e-screenshots/e2e-cart-05-promo.png")

    print("9. Verifying discount is shown in summary ...")
    expect(frame.locator(".nexus-cart-discount")).to_be_visible(timeout=5000)
    expect(frame.locator(".nexus-cart-total")).to_be_visible()

    print("10. Removing promo code ...")
    frame.locator(".nexus-cart-promo-remove").click()
    expect(frame.locator(".nexus-cart-promo-applied")).not_to_be_visible(timeout=5000)

    print("11. Testing invalid promo code ...")
    promo_input = frame.locator(".nexus-cart-promo-field")
    promo_input.fill("INVALID")
    frame.locator(".nexus-cart-promo-btn").click()
    expect(frame.locator(".nexus-cart-promo-error")).to_contain_text("无效", timeout=5000)
    page.screenshot(path="e2e-screenshots/e2e-cart-06-invalid-promo.png")

    print("12. Removing an item ...")
    frame.locator(".nexus-cart-item-remove").first.click()
    items = frame.locator(".nexus-cart-item")
    expect(items).to_have_count(2, timeout=5000)
    page.screenshot(path="e2e-screenshots/e2e-cart-07-item-removed.png")

    print("13. Testing empty cart via button ...")
    page.locator(".ctrl-btn--danger").click()
    frame = page.frame_locator("iframe[title='Nexus cart element']")
    expect(frame.locator(".nexus-cart-empty")).to_be_visible(timeout=5000)
    expect(frame.locator(".nexus-cart-empty-text")).to_contain_text("购物车为空")
    page.screenshot(path="e2e-screenshots/e2e-cart-08-empty.png")

    print("14. Resetting cart ...")
    page.locator("button", has_text="重置").click()
    frame = page.frame_locator("iframe[title='Nexus cart element']")
    expect(frame.locator(".nexus-cart-item")).to_have_count(3, timeout=5000)
    page.screenshot(path="e2e-screenshots/e2e-cart-09-reset.png")

    if console_errors:
        print(f"\n   Console errors ({len(console_errors)}):")
        for e in console_errors[:5]:
            print(f"   - {e[:200]}")
    else:
        print("   No console errors.")

    print("\nE2E PASSED: cart element (items, qty, shipping, promo, empty state)")
    browser.close()
