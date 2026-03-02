import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        # Load local index.html directly
        await page.goto("http://localhost:8080/")

        # Wait for initialization
        await asyncio.sleep(1.0)

        # Click "New Area"
        await page.click('#btn-draw')

        # Draw a triangle
        await page.mouse.click(200, 200)
        await asyncio.sleep(0.1)
        await page.mouse.click(300, 200)
        await asyncio.sleep(0.1)
        await page.mouse.click(250, 300)
        await asyncio.sleep(0.1)
        # Double click to finish
        await page.mouse.click(250, 300, click_count=2)

        # Wait for selection state and animation
        await asyncio.sleep(1.0)

        await page.screenshot(path="after4.png")
        await browser.close()

asyncio.run(run())
