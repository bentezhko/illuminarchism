const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--enable-unsafe-webgpu',
      '--enable-features=Vulkan',
      '--no-sandbox'
    ]
  });

  const page = await browser.newPage();

  page.on('console', msg => {
    console.log(`BROWSER CONSOLE: ${msg.text()}`);
  });

  page.on('pageerror', err => {
    console.error(`BROWSER ERROR: ${err}`);
  });

  await page.goto('http://localhost:3000/index.html');

  await page.waitForTimeout(2000);

  await page.evaluate(() => {
     window.illuminarchismApp._animationLoop = () => {}; // Kill loop

     const renderer = window.illuminarchismApp.renderer;
     if (!renderer.device) return;

     console.log('Clearing old canvas');
     const canvas = document.getElementById('map-canvas');
     console.log('Canvas display:', getComputedStyle(canvas).display);
     console.log('Canvas opacty:', getComputedStyle(canvas).opacity);
     console.log('Canvas visibility:', getComputedStyle(canvas).visibility);

     // Remove it and re-add it?
     const p = canvas.parentNode;
     const id = canvas.id;
     canvas.remove();

     const newC = document.createElement('canvas');
     newC.id = id;
     newC.width = renderer.width;
     newC.height = renderer.height;
     newC.style.position = 'absolute';
     newC.style.top = '0';
     newC.style.left = '0';
     newC.style.zIndex = '1';
     p.appendChild(newC);

     console.log('Recreated canvas. Re-initing renderer...');
     renderer.canvas = newC;
     renderer.context = newC.getContext('webgpu');
     const presentationFormat = navigator.gpu.getPreferredCanvasFormat();

     renderer.context.configure({
         device: renderer.device,
         format: presentationFormat,
         alphaMode: 'premultiplied',
     });

     const commandEncoder = renderer.device.createCommandEncoder();
     const textureView = renderer.context.getCurrentTexture().createView();

     const renderPassDescriptor = {
         colorAttachments: [
             {
                 view: textureView,
                 clearValue: { r: 1.0, g: 0.0, b: 0.0, a: 1.0 }, // RED CLEAR
                 loadOp: 'clear',
                 storeOp: 'store',
             },
         ],
     };

     const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
     passEncoder.end();
     renderer.device.queue.submit([commandEncoder.finish()]);
     console.log("Draw submitted");
  });

  await page.waitForTimeout(500);

  await page.screenshot({ path: '/home/jules/verification/webgpu_final17.png' });

  await browser.close();
})();
