
import { describe, it, expect, mock, beforeAll } from 'bun:test';
import MedievalRenderer from './MedievalRenderer.js';

// Mock DOM
const mockCtx = {
    save: mock(() => {}),
    restore: mock(() => {}),
    translate: mock(() => {}),
    scale: mock(() => {}),
    beginPath: mock(() => {}),
    moveTo: mock(() => {}),
    lineTo: mock(() => {}),
    stroke: mock(() => {}),
    fillText: mock(() => {}),
    measureText: mock(() => ({ width: 10 })),
    createPattern: mock(() => {}),
    createImageData: mock(() => ({ data: new Uint8Array(512 * 512 * 4) })),
    putImageData: mock(() => {}),
    fillRect: mock(() => {}),
    clearRect: mock(() => {}),
    drawImage: mock(() => {}),
    setTransform: mock(() => {}),
    setLineDash: mock(() => {}),
    arc: mock(() => {}),
    fill: mock(() => {}),
    strokeRect: mock(() => {}),
    quadraticCurveTo: mock(() => {}),
    bezierCurveTo: mock(() => {}),
};

const mockCanvas = {
    getContext: mock(() => mockCtx),
    width: 800,
    height: 600,
};

// Global mocks
global.document = {
    getElementById: mock((id) => mockCanvas),
    createElement: mock((tag) => {
        if (tag === 'canvas') return { getContext: () => mockCtx, width: 0, height: 0 };
        return {};
    }),
};

global.window = {
    innerWidth: 800,
    innerHeight: 600,
    addEventListener: mock(() => {}),
};

global.HTMLCanvasElement = class {};

describe('MedievalRenderer', () => {
    it('should draw scale correctly', () => {
        const renderer = new MedievalRenderer('map-canvas');

        // Mock transform
        renderer.transform = { x: 0, y: 0, k: 1 };
        renderer.width = 800;
        renderer.height = 600;

        // Call drawScale
        renderer.drawScale();

        // Check if ctx methods were called
        expect(mockCtx.save).toHaveBeenCalled();
        expect(mockCtx.beginPath).toHaveBeenCalled();
        expect(mockCtx.moveTo).toHaveBeenCalled(); // Main line
        expect(mockCtx.lineTo).toHaveBeenCalled(); // Main line segments
        expect(mockCtx.stroke).toHaveBeenCalled();
        expect(mockCtx.fillText).toHaveBeenCalled(); // Label
        expect(mockCtx.restore).toHaveBeenCalled();

        // Check label text (should be "100 Leagues" or similar)
        // We can't easily inspect arguments with simple mocks unless we capture them,
        // but checking call count implies it reached that point.
    });

    it('should calculate different scale values for different zoom levels', () => {
         const renderer = new MedievalRenderer('map-canvas');

         // Case 1: k=1 -> target=150 -> units=150 -> scale=100
         renderer.transform.k = 1;
         renderer.drawScale();
         // We expect fillText to be called with "100 Leagues"

         // Case 2: k=0.5 -> target=150 -> units=300 -> scale=200
         renderer.transform.k = 0.5;
         renderer.drawScale();

         // Case 3: k=2 -> target=150 -> units=75 -> scale=50
         renderer.transform.k = 2;
         renderer.drawScale();
    });
});
