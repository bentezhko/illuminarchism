import { describe, it, expect, mock, beforeEach, beforeAll } from 'bun:test';
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
    closePath: mock(() => {}),
    stroke: mock(() => {}),
    fillText: mock((text, x, y) => {}),
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
    illuminarchismApp: { render: () => {} }
};

global.HTMLCanvasElement = class {};

describe('MedievalRenderer', () => {
    let renderer;

    beforeEach(() => {
        renderer = new MedievalRenderer('map-canvas');
        // Override patterns to avoid actual canvas calls or null checks
        renderer.noisePattern = {};
        renderer.waterPattern = {};

        // Reset mocks AFTER instantiation because constructor creates textures which call ctx methods
        mockCtx.moveTo.mockClear();
        mockCtx.lineTo.mockClear();
        mockCtx.closePath.mockClear();
        mockCtx.save.mockClear();
        mockCtx.restore.mockClear();
        mockCtx.fillText.mockClear();
        mockCtx.beginPath.mockClear();
        mockCtx.stroke.mockClear();
    });

    it('should draw scale correctly', () => {
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
    });

    it('should calculate different scale values for different zoom levels', () => {
        // Case 1: k=1 -> target=150 -> units=150 -> scale=100 (Default: Leagues)
        renderer.transform.k = 1;
        renderer.drawScale();
        expect(mockCtx.fillText).toHaveBeenLastCalledWith("100 Leagues", expect.any(Number), expect.any(Number));

        // Case 2: k=0.5 -> target=150 -> units=300 -> scale=200
        renderer.transform.k = 0.5;
        renderer.drawScale();
        expect(mockCtx.fillText).toHaveBeenLastCalledWith("200 Leagues", expect.any(Number), expect.any(Number));

        // Case 3: k=2 -> target=150 -> units=75 -> scale=50
        renderer.transform.k = 2;
        renderer.drawScale();
        expect(mockCtx.fillText).toHaveBeenLastCalledWith("50 Leagues", expect.any(Number), expect.any(Number));
    });

    it('should respect unit selection', () => {
        renderer.transform.k = 1;

        // Change unit to 'miles' (factor 3.0)
        // target=150 -> worldUnits=150 -> displayUnits=450 -> scale=200
        renderer.scaleUnit = 'miles';
        renderer.drawScale();
        expect(mockCtx.fillText).toHaveBeenLastCalledWith("200 Miles", expect.any(Number), expect.any(Number));
    });

    // --- TraceRoughPath Tests ---

    it('traceRoughPath should generate path commands with finite numbers', () => {
        const pts = [{ x: 10, y: 10 }, { x: 20, y: 20 }, { x: 30, y: 10 }];
        renderer.transform = { x: 0, y: 0, k: 1 };

        // Test with k=1 (roughness enabled)
        renderer.traceRoughPath(pts, true, mockCtx);

        expect(mockCtx.moveTo).toHaveBeenCalledTimes(1);
        // length 3 array: moveTo(0), lineTo(1), lineTo(2) -> 2 lineTo calls
        expect(mockCtx.lineTo).toHaveBeenCalledTimes(2);
        expect(mockCtx.closePath).toHaveBeenCalledTimes(1);

        const moveCall = mockCtx.moveTo.mock.calls[0];
        const lineCall1 = mockCtx.lineTo.mock.calls[0];
        const lineCall2 = mockCtx.lineTo.mock.calls[1];

        expect(Number.isFinite(moveCall[0])).toBe(true);
        expect(Number.isFinite(moveCall[1])).toBe(true);
        expect(Number.isFinite(lineCall1[0])).toBe(true);
        expect(Number.isFinite(lineCall1[1])).toBe(true);
        expect(Number.isFinite(lineCall2[0])).toBe(true);
        expect(Number.isFinite(lineCall2[1])).toBe(true);
    });

    it('traceRoughPath should work with small scale k', () => {
        const pts = [{ x: 10, y: 10 }, { x: 20, y: 20 }, { x: 30, y: 10 }];
        renderer.transform = { x: 0, y: 0, k: 0.1 }; // Roughness disabled

        renderer.traceRoughPath(pts, true, mockCtx);

        // Should call moveTo/lineTo with exact coords
        expect(mockCtx.moveTo).toHaveBeenCalledWith(10, 10);
        expect(mockCtx.lineTo).toHaveBeenCalledWith(20, 20);
        expect(mockCtx.lineTo).toHaveBeenCalledWith(30, 10);
    });

    it('traceRoughPath should work with large scale k', () => {
        const pts = [{ x: 10, y: 10 }, { x: 20, y: 20 }, { x: 30, y: 10 }];
        renderer.transform = { x: 0, y: 0, k: 10 }; // Roughness enabled

        renderer.traceRoughPath(pts, true, mockCtx);

        expect(mockCtx.moveTo).toHaveBeenCalled();
        const moveArg = mockCtx.moveTo.mock.calls[0];
        // Perturbation should be small (magnitude 2/10 = 0.2)
        expect(Math.abs(moveArg[0] - 10)).toBeLessThan(1);
        expect(Math.abs(moveArg[1] - 10)).toBeLessThan(1);
    });

    it('traceRoughPath should handle large coordinates gracefully', () => {
        const pts = [{ x: 1000000, y: 1000000 }, { x: 1000010, y: 1000010 }];
        renderer.transform = { x: 0, y: 0, k: 1 };

        renderer.traceRoughPath(pts, true, mockCtx);

        const moveArg = mockCtx.moveTo.mock.calls[0];
        expect(Number.isFinite(moveArg[0])).toBe(true);
        expect(Number.isFinite(moveArg[1])).toBe(true);
    });

    it('traceRoughPath should skip non-finite coordinates', () => {
        const pts = [{ x: Infinity, y: 10 }, { x: 20, y: NaN }, { x: 30, y: 10 }];

        // Use the shared mockCtx
        renderer.transform = { x: 0, y: 0, k: 1 };

        renderer.traceRoughPath(pts, true, mockCtx);

        expect(mockCtx.moveTo).not.toHaveBeenCalled();
        expect(mockCtx.lineTo).toHaveBeenCalledTimes(1);

        // Verify the one valid call
        const args = mockCtx.lineTo.mock.calls[0];
        expect(Number.isFinite(args[0])).toBe(true);
        expect(Number.isFinite(args[1])).toBe(true);
    });

    describe('getInvertedColor', () => {
        it('should correctly invert 6-digit hex colors', () => {
            expect(renderer.getInvertedColor('#ff0000', 0.8)).toBe('rgba(0,255,255,0.8)');
            expect(renderer.getInvertedColor('#00ff00', 0.8)).toBe('rgba(255,0,255,0.8)');
            expect(renderer.getInvertedColor('#0000ff', 0.8)).toBe('rgba(255,255,0,0.8)');
            expect(renderer.getInvertedColor('#ffffff', 0.8)).toBe('rgba(0,0,0,0.8)');
            expect(renderer.getInvertedColor('#000000', 0.8)).toBe('rgba(255,255,255,0.8)');
        });

        it('should correctly invert 3-digit hex colors', () => {
            expect(renderer.getInvertedColor('#f00', 0.8)).toBe('rgba(0,255,255,0.8)');
            expect(renderer.getInvertedColor('#0f0', 0.8)).toBe('rgba(255,0,255,0.8)');
            expect(renderer.getInvertedColor('#00f', 0.8)).toBe('rgba(255,255,0,0.8)');
            expect(renderer.getInvertedColor('#fff', 0.8)).toBe('rgba(0,0,0,0.8)');
            expect(renderer.getInvertedColor('#000', 0.8)).toBe('rgba(255,255,255,0.8)');
        });

        it('should return the fallback color for invalid or missing inputs', () => {
            const fallbackRGB = MedievalRenderer.FALLBACK_HIGHLIGHT_RGB;
            const expectedFallback = `rgba(${fallbackRGB},0.8)`;
            expect(renderer.getInvertedColor('', 0.8)).toBe(expectedFallback);
            expect(renderer.getInvertedColor(null, 0.8)).toBe(expectedFallback);
            expect(renderer.getInvertedColor(undefined, 0.8)).toBe(expectedFallback);
            expect(renderer.getInvertedColor('invalid', 0.8)).toBe(expectedFallback);
            expect(renderer.getInvertedColor('#ff', 0.8)).toBe(expectedFallback);
        });
    });

    it('resize should not block the main thread with texture generation', () => {
        // Measure execution time of resize() to ensure it's fast
        const start = performance.now();

        // Call resize multiple times to simulate rapid window resizing
        for (let i = 0; i < 10; i++) {
            renderer.resize();
        }

        const end = performance.now();
        const duration = end - start;

        // If texture generation (especially fbm with 262,144 iterations) was still
        // inside resize(), this would take hundreds of milliseconds or even seconds.
        // We expect it to be well under 50ms for 10 calls.
        expect(duration).toBeLessThan(50);
    });
});
