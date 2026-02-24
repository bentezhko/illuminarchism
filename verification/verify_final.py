import os
import sys
import time
from playwright.sync_api import sync_playwright

def run_verification():
    print(f"CWD: {os.getcwd()}")
    print("Starting Detailed Verification...")

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto("http://localhost:8083/index.html")

        try:
            page.wait_for_selector("#layer-manager", timeout=5000)
            print("Layer Manager found.")
        except:
            print("Layer Manager not found.")
            sys.exit(1)

        # 1. Test Entity Visibility Toggle
        # Find Water Group
        water_group = None
        groups = page.query_selector_all(".tree-group")
        for g in groups:
            if "Water" in g.query_selector(".spacer").inner_text():
                water_group = g
                break

        if not water_group:
             print("FAILED: Water group not found.")
             sys.exit(1)

        # Find first entity in Water group
        entity_item = water_group.query_selector(".tree-item")
        if not entity_item:
             print("FAILED: No entity found in Water group.")
             sys.exit(1)

        vis_btn = entity_item.query_selector(".icon-btn")
        print(f"Initial Entity Vis State: {vis_btn.inner_text()}")

        # Click Toggle
        vis_btn.click()
        time.sleep(0.5) # Wait for re-render

        # RE-QUERY because DOM was rebuilt
        groups = page.query_selector_all(".tree-group")
        for g in groups:
            if "Water" in g.query_selector(".spacer").inner_text():
                water_group = g
                break
        entity_item = water_group.query_selector(".tree-item")
        vis_btn = entity_item.query_selector(".icon-btn")

        # Check State
        print(f"New Entity Vis State: {vis_btn.inner_text()}")
        if vis_btn.inner_text() != "✕":
             print(f"FAILED: Entity visibility toggle didn't update icon. Got '{vis_btn.inner_text()}'")
             sys.exit(1)
        print("Entity Visibility Toggle Verified.")

        path = os.path.abspath("interaction_verification.png")
        page.screenshot(path=path)
        print(f"Screenshot saved to {path}")

        browser.close()
        print("Verification Complete.")

if __name__ == "__main__":
    run_verification()
