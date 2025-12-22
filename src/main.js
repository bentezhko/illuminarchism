/**
 * Illuminarchism - Main Entry Point
 * Agent-driven deep map platform for historiographical cartography
 */

// Initialize WebGL context
const canvas = document.getElementById('webgl-canvas');
const gl = canvas.getContext('webgl2');

if (!gl) {
  document.getElementById('loading').textContent = 'WebGL 2.0 not supported';
  throw new Error('WebGL 2.0 is required but not available');
}

// Set canvas size
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  gl.viewport(0, 0, canvas.width, canvas.height);
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Clear to medieval parchment color
gl.clearColor(0.91, 0.87, 0.77, 1.0);
gl.clear(gl.COLOR_BUFFER_BIT);

// Timeline controls
const yearSlider = document.getElementById('year-slider');
const yearDisplay = document.getElementById('year-display');
const loading = document.getElementById('loading');
const timelineControl = document.getElementById('timeline-control');

yearSlider.addEventListener('input', (e) => {
  yearDisplay.textContent = e.target.value;
  // TODO: Trigger temporal state retrieval and map reconstruction
  console.log(`Reconstructing world for year: ${e.target.value}`);
});

// Simulate initialization
setTimeout(() => {
  loading.style.display = 'none';
  timelineControl.style.display = 'block';
  console.log('Illuminarchism initialized - Ready to illuminate the past');
}, 1500);

console.log('Illuminarchism: WebGL Rendering Engine Starting...');
