
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
});
