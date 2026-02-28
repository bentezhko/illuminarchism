import asyncio
from playwright.async_api import async_playwright
import time

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto("http://localhost:8080")

        # Wait for map
        await page.wait_for_selector("#map-canvas")
        time.sleep(1)

        # 1. Start drawing
        await page.evaluate("window.illuminarchismApp.setActiveTool('draw')")
        time.sleep(0.5)

        # 2. Add 4 points via evaluate to bypass test flakiness
        await page.evaluate("""
            const wp1 = {x: 100, y: 100};
            const wp2 = {x: 200, y: 100};
            const wp3 = {x: 200, y: 200};
            const wp4 = {x: 100, y: 200};
            window.illuminarchismApp.draftPoints.push(wp1, wp2, wp3, wp4);
        """)

        # 3. Commit drawing
        await page.evaluate("window.illuminarchismApp.commitDraft()")
        time.sleep(1)

        # Ensure info panel is visible and generic domain is POL
        info_visible = await page.evaluate("document.getElementById('info-panel').style.display === 'block'")
        if not info_visible:
            print("Info panel not visible!")
            return

        initial_domain = await page.evaluate("document.getElementById('val-domain').textContent")
        print(f"Initial domain: {initial_domain}")

        initial_category = await page.evaluate("document.getElementById('info-cat').textContent")
        print(f"Initial category label: {initial_category}")

        # 4. Click the domain tumbler on the dial!
        # Instead of just relying on UI clicks which can be flaky with playwright,
        # trigger the cycle method or the click event
        await page.evaluate("document.getElementById('val-domain').click()")
        time.sleep(0.5)

        new_domain = await page.evaluate("document.getElementById('val-domain').textContent")
        print(f"New domain: {new_domain}")

        # Let's verify the entity actually updated
        selected_id = await page.evaluate("window.illuminarchismApp.selectedEntityId")
        ent_domain = await page.evaluate(f"window.illuminarchismApp.entitiesById.get('{selected_id}').domain")
        print(f"Entity domain: {ent_domain}")

        if initial_domain != new_domain and ent_domain != "POL":
            print("Success! Dial updating works.")
        else:
            print("Failure: Entity did not update.")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
