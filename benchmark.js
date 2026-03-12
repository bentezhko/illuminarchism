import { distance, distSq } from './src/core/math.js';
import { CONFIG } from './src/config.js';

// Setup benchmark data
const points = Array.from({ length: 10000 }, () => ({
    x: Math.random() * 1000,
    y: Math.random() * 1000
}));

const wp = { x: 500, y: 500 };
const k = 1;
const threshold = CONFIG.INTERACTION_RADIUS / k;
const thresholdSq = threshold * threshold;

// Benchmark distance
const startDist = performance.now();
for (let i = 0; i < 10000; i++) {
    points.findIndex(pt => distance(pt, wp) < threshold);
}
const endDist = performance.now();

// Benchmark distSq
const startDistSq = performance.now();
for (let i = 0; i < 10000; i++) {
    points.findIndex(pt => distSq(pt, wp) < thresholdSq);
}
const endDistSq = performance.now();

console.log(`distance() time: ${endDist - startDist}ms`);
console.log(`distSq() time: ${endDistSq - startDistSq}ms`);
console.log(`Improvement: ${((endDist - startDist) / (endDistSq - startDistSq)).toFixed(2)}x`);
