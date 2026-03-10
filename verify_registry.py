import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1280, "height": 720})

        # Block fonts
        await page.route("**/*.{ttf,woff,woff2,otf}", lambda route: route.abort())
        await page.route("**/fonts.googleapis.com/**", lambda route: route.abort())
        await page.route("**/fonts.gstatic.com/**", lambda route: route.abort())

        print("Navigating to page...")
        await page.goto("http://localhost:3000", wait_until="load")
        await page.wait_for_timeout(2000)

        print("Opening Registry...")
        await page.hover("#btn-registry-menu")
        await page.wait_for_timeout(500)

        # Hover over first domain (Political)
        print("Hovering over Political Domain...")
        domain_items = await page.query_selector_all(".scroll-item")
        for d in domain_items:
            t = await d.inner_text()
            if "Political" in t:
                await d.hover()
                break

        await page.wait_for_timeout(1000)

        # Hover over a form
        print("Hovering over Nation-State Form...")
        form_items = await page.query_selector_all(".scroll-item")
        for f in form_items:
            t = await f.inner_text()
            if "Nation-State" in t:
                await f.hover()
                break

        await page.wait_for_timeout(1000)

        # Screenshot
        screenshot_path = "/home/jules/verification/registry_hover_test.png"
        await page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        # Test the ? Modal
        print("Opening Help & Information modal...")
        await page.evaluate("document.getElementById('btn-ontology').click()")
        await page.wait_for_timeout(500)

        screenshot_modal_path = "/home/jules/verification/registry_modal_test.png"
        await page.screenshot(path=screenshot_modal_path)
        print(f"Screenshot saved to {screenshot_modal_path}")

        await browser.close()

asyncio.run(run())
