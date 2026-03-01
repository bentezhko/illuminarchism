const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('http://localhost:8080');

  // Wait for loading to finish
  await page.waitForSelector('#loading-overlay', { state: 'hidden', timeout: 10000 });

  // Click pan tool to ensure we are not drawing
  await page.click('[data-tool="pan"]');

  // Click roughly in the center to select the test entity "Lingua Antiqua"
  await page.mouse.click(500, 300);

  // Wait for animation
  await page.waitForTimeout(1000);

  // Try to click specifically on Lingua Antiqua if it's rendered, or we right click?
  // Actually, we can just trigger a hover and context menu via JS
  await page.evaluate(() => {
    // Force select the first entity if available
    if (window.app && window.app.entities && window.app.entities.length > 0) {
       window.app.selectEntity(window.app.entities[0].id, true);
       // Trigger the old context menu explicitly to see if it shows up overlapping
       window.app.showContextMenu(window.app.entities[0], 200, 200);
    }
  });

  await page.waitForTimeout(500);

  await page.screenshot({ path: 'docked_panel.png' });
  await browser.close();
})();
