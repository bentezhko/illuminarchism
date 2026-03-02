import asyncio
from playwright.async_api import async_playwright
import os

async def main():
    os.system("python3 -m http.server 8080 > /dev/null 2>&1 &")
    await asyncio.sleep(1) # wait for server
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(record_video_dir="videos/")
        page = await context.new_page()
        await page.goto("http://localhost:8080")
        await page.wait_for_selector("#map-canvas")

        # Click the map near the center to select the default entity (NewArea1) or something
        await page.mouse.click(400, 300)

        # Take a screenshot
        await page.screenshot(path="before.png")

        # Capture a short video of the animation
        await asyncio.sleep(1.0)
        await page.screenshot(path="after.png")

        await context.close()
        await browser.close()
    os.system("kill $(lsof -t -i :8080) 2>/dev/null || true")

asyncio.run(main())
