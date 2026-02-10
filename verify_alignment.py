import asyncio
from playwright.async_api import async_playwright, expect
import os

async def run_test():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1280, 'height': 800})
        page = await context.new_page()

        await page.goto("http://localhost:8000")
        await page.wait_for_selector("#loading-overlay", state="hidden", timeout=10000)

        print("Switching to Timeline view...")
        await page.click('#btn-view-timeline')
        await page.wait_for_selector('#view-timeline', state="visible")

        # Create a connection
        print("Creating a connection...")
        await page.click('#btn-timeline-link')
        first_bar = page.locator('.timeline-bar').first
        await first_bar.click()
        second_bar = page.locator('.timeline-bar').nth(1)
        await second_bar.click()

        # Take screenshot to verify alignment
        print("Taking screenshot...")
        await page.screenshot(path="verify_alignment.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run_test())
