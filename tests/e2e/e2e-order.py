"""E2E: Order Element - status display, items, payment, address, timeline."""
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

    print("1. Navigating to /order ...")
    page.goto(f"{BASE}/order", wait_until="networkidle")

    print("2. Order iframe loads with default 'processing' status ...")
    frame = page.frame_locator("iframe[title='Nexus order element']")
    frame.locator(".nexus-order").wait_for(state="visible", timeout=10000)

    status_badge = frame.locator(".nexus-order-status")
    expect(status_badge).to_contain_text("处理中", timeout=5000)
    page.screenshot(path="e2e-screenshots/e2e-order-01-processing.png")

    print("3. Verifying order items are displayed ...")
    order_items = frame.locator(".nexus-order-item")
    expect(order_items).to_have_count(2, timeout=5000)
    expect(order_items.first).to_contain_text("Nexus Pro")
    expect(order_items.nth(1)).to_contain_text("无线蓝牙耳机")

    print("4. Verifying payment method section ...")
    expect(frame.locator(".nexus-order-card-brand")).to_contain_text("Visa")
    expect(frame.locator(".nexus-order-card-last4")).to_contain_text("4242")

    print("5. Verifying shipping address section ...")
    expect(frame.locator(".nexus-order-address-name")).to_contain_text("张三")
    expect(frame.locator(".nexus-order-address-line")).to_contain_text("科技园南路")
    page.screenshot(path="e2e-screenshots/e2e-order-02-details.png")

    print("6. Verifying timeline events ...")
    timeline_items = frame.locator(".nexus-order-timeline-item")
    expect(timeline_items).to_have_count(2, timeout=5000)

    print("7. Switching to 'paid' status ...")
    page.locator(".status-btn", has_text="已支付").click()
    frame = page.frame_locator("iframe[title='Nexus order element']")
    expect(frame.locator(".nexus-order-status")).to_contain_text("已支付", timeout=5000)
    timeline_items = frame.locator(".nexus-order-timeline-item")
    expect(timeline_items).to_have_count(3, timeout=5000)
    page.screenshot(path="e2e-screenshots/e2e-order-03-paid.png")

    print("8. Switching to 'failed' status ...")
    page.locator(".status-btn", has_text="失败").click()
    frame = page.frame_locator("iframe[title='Nexus order element']")
    expect(frame.locator(".nexus-order-status")).to_contain_text("支付失败", timeout=5000)
    page.screenshot(path="e2e-screenshots/e2e-order-04-failed.png")

    print("9. Switching to 'cancelled' status ...")
    page.locator(".status-btn", has_text="已取消").click()
    frame = page.frame_locator("iframe[title='Nexus order element']")
    expect(frame.locator(".nexus-order-status")).to_contain_text("已取消", timeout=5000)
    page.screenshot(path="e2e-screenshots/e2e-order-05-cancelled.png")

    print("10. Switching to 'refunded' status ...")
    page.locator(".status-btn", has_text="已退款").click()
    frame = page.frame_locator("iframe[title='Nexus order element']")
    expect(frame.locator(".nexus-order-status")).to_contain_text("已退款", timeout=5000)
    timeline_items = frame.locator(".nexus-order-timeline-item")
    expect(timeline_items).to_have_count(4, timeout=5000)
    page.screenshot(path="e2e-screenshots/e2e-order-06-refunded.png")

    print("11. Switching back to 'pending' status ...")
    page.locator(".status-btn", has_text="待处理").click()
    frame = page.frame_locator("iframe[title='Nexus order element']")
    expect(frame.locator(".nexus-order-status")).to_contain_text("待处理", timeout=5000)
    page.screenshot(path="e2e-screenshots/e2e-order-07-pending.png")

    if console_errors:
        print(f"\n   Console errors ({len(console_errors)}):")
        for e in console_errors[:5]:
            print(f"   - {e[:200]}")
    else:
        print("   No console errors.")

    print("\nE2E PASSED: order element (status switching, items, payment, address, timeline)")
    browser.close()
