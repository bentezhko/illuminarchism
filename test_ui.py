from playwright.sync_api import sync_playwright

def test_ui(page):
    page.on("console", lambda msg: print(f"Console: {msg.text}"))
    page.on("pageerror", lambda err: print(f"Page Error: {err}"))

    page.goto("http://localhost:8080")

    # Wait for canvas
    page.wait_for_selector("#map-canvas")

    # 1. Take a screenshot of the new toolbar
    page.screenshot(path="/tmp/toolbar_view.png")

    # 2. Draw a polygon to test the new draft workflow
    # Click draw tool
    draw_btn = page.locator("button[data-tool='draw']")
    draw_btn.click()
    page.wait_for_timeout(500)

    # Click on canvas to draw points
    box = page.locator("#map-canvas").bounding_box()
    cx = box["x"] + box["width"] / 2
    cy = box["y"] + box["height"] / 2

    # We must construct true Point objects for draftPoints
    page.evaluate(f"window.illuminarchismApp.addDraftPoint({{x: {cx - 50}, y: {cy - 50}}})")
    page.evaluate(f"window.illuminarchismApp.addDraftPoint({{x: {cx + 50}, y: {cy - 50}}})")
    page.evaluate(f"window.illuminarchismApp.addDraftPoint({{x: {cx + 50}, y: {cy + 50}}})")
    page.evaluate(f"window.illuminarchismApp.addDraftPoint({{x: {cx - 50}, y: {cy + 50}}})")

    # Check draft points size
    size = page.evaluate("window.illuminarchismApp.draftPoints.length")
    print(f"Draft points size: {size}")

    # Commit the draft
    page.evaluate("window.illuminarchismApp.commitDraft()")

    # Wait for rendering
    page.wait_for_timeout(500)

    # Verify entity is selected
    selected_id = page.evaluate("window.illuminarchismApp.selectedEntityId")
    print(f"Selected entity id: {selected_id}")

    # Select it explicitly via function if it isn't
    if selected_id:
        page.evaluate(f"window.illuminarchismApp.selectEntity('{selected_id}', true)")

    page.wait_for_selector("#info-panel", state="visible", timeout=2000)

    # Take screenshot of info panel with dial
    page.screenshot(path="/tmp/info_panel_view.png")

    # 3. Change typology to city
    # Click the form dial to change it
    form_dial = page.locator(".dial-btn[data-type='form']")
    if form_dial.count() > 0:
        for _ in range(10): # Cycle through until we hit city (or just a few times to see it change)
            form_dial.click()
            page.wait_for_timeout(100)
            val = form_dial.inner_text()
            if "CTY" in val or "City" in val:
                break

    # Escape draw mode so scroll zooms the map rather than being ignored/prevented by draw logic
    page.keyboard.press('Escape')
    page.evaluate("window.illuminarchismApp.activeTool = 'select'")

    # Wait a moment for rendering
    page.wait_for_timeout(500)

    # Zoom out to trigger the point rendering
    # Simulate wheel event on canvas
    for _ in range(15):
        page.mouse.wheel(delta_x=0, delta_y=500)
        page.wait_for_timeout(50)

    page.wait_for_timeout(1000)

    page.screenshot(path="/tmp/zoomed_out_city.png")
    print("Success!")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            test_ui(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="/tmp/error.png")
            raise
        finally:
            browser.close()
