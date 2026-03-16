
import { describe, it, expect, mock, beforeEach, beforeAll } from 'bun:test';

// Mock WebGL context
const mockGl = {
    createBuffer: mock(() => ({})),
    bindBuffer: mock(() => {}),
    bufferData: mock((target, data, usage) => {
        // Capture data for inspection if needed
    }),
    createProgram: mock(() => ({})),
    createShader: mock(() => ({})),
    shaderSource: mock(() => {}),
    compileShader: mock(() => {}),
    attachShader: mock(() => {}),
    linkProgram: mock(() => {}),
    getProgramParameter: mock(() => true),
    getShaderParameter: mock(() => true),
    useProgram: mock(() => {}),
    getUniformLocation: mock(() => ({})),
    getAttribLocation: mock((program, name) => {
        // Return unique IDs for attributes
        const map = {
            'a_position': 0,
            'a_nextPosition': 1,
            'a_color': 2,
            'a_validStart': 3,
            'a_validEnd': 4,
            'a_yearStart': 5,
            'a_yearEnd': 6
        };
        return map[name] ?? -1;
    }),
    enableVertexAttribArray: mock(() => {}),
    vertexAttribPointer: mock(() => {}),
    uniform1f: mock(() => {}),
    uniformMatrix3fv: mock(() => {}),
    uniform4f: mock(() => {}),
    drawArrays: mock(() => {}),
    viewport: mock(() => {}),
    enable: mock(() => {}),
    blendFunc: mock(() => {}),
    clearColor: mock(() => {}),
    clear: mock(() => {}),
    deleteShader: mock(() => {}),
    getShaderInfoLog: mock(() => ''),
    getProgramInfoLog: mock(() => ''),
    lineWidth: mock(() => {}),

    // Constants
    ARRAY_BUFFER: 0x8892,
    STATIC_DRAW: 0x88E4,
    DYNAMIC_DRAW: 0x88E8,
    VERTEX_SHADER: 0x8B31,
    FRAGMENT_SHADER: 0x8B30,
    COMPILE_STATUS: 0x8B81,
    LINK_STATUS: 0x8B82,
    FLOAT: 0x1406,
    TRIANGLES: 0x0004,
    LINE_STRIP: 0x0003,
    COLOR_BUFFER_BIT: 0x4000,
    DEPTH_BUFFER_BIT: 0x0100,
    SRC_ALPHA: 0x0302,
    ONE_MINUS_SRC_ALPHA: 0x0303
};

const mockCanvas = {
    getContext: mock(() => mockGl),
    width: 800,
    height: 600,
    clientWidth: 800,
    clientHeight: 600,
    style: {}
};

// Global mocks
global.document = {
    createElement: mock((tag) => {
        if (tag === 'canvas') return mockCanvas;
        return {};
    }),
};
global.window = {};

// We need to mock the module BEFORE import
// This mock must be hoisted or defined before import
mock.module('./shaders/MedievalShader.js', () => ({
    VERTEX_SHADER: 'vertex shader source',
    FRAGMENT_SHADER: 'fragment shader source',
    PARCHMENT_VERTEX_SHADER: 'parchment vertex shader',
    PARCHMENT_FRAGMENT_SHADER: 'parchment fragment shader'
}));

// Now import the renderer which uses the mocked shader
const WebGLRenderer = (await import('./WebGLRenderer.js')).default;

describe('WebGLRenderer Performance', () => {
    let renderer;
    let entities;

    beforeEach(() => {
        mockGl.bufferData.mockClear();
        mockGl.vertexAttribPointer.mockClear();

        // Instantiate renderer
        // Note: constructor calls init() which calls createParchmentBuffer() -> bufferData
        renderer = new WebGLRenderer(mockCanvas);

        // Setup entity with multiple segments
        entities = [
            {
                id: 'e1',
                type: 'polity',
                color: '#ff0000',
                validRange: { start: 1000, end: 1200 },
                timeline: [
                    { year: 1000, geometry: [{x:0, y:0}, {x:10, y:0}, {x:10, y:10}] },
                    { year: 1010, geometry: [{x:0, y:0}, {x:15, y:0}, {x:15, y:15}] },
                    { year: 1020, geometry: [{x:0, y:0}, {x:20, y:0}, {x:20, y:20}] }
                ]
            }
        ];
    });

    it('should use static buffer and NOT rebuild when crossing keyframe boundary', () => {
        // Reset mocks after constructor
        mockGl.bufferData.mockClear();

        // Frame 1: 1005 (Segment 1000-1010)
        renderer.render(entities, 1005);

        // Expect 1 call for geometry buffer (STATIC_DRAW)
        // Find calls with STATIC_DRAW
        const staticCalls = mockGl.bufferData.mock.calls.filter(c => c[2] === mockGl.STATIC_DRAW);
        expect(staticCalls.length).toBe(1);

        // Frame 2: 1015 (Segment 1010-1020)
        renderer.render(entities, 1015);

        // Should NOT rebuild -> count remains same
        const staticCallsAfter = mockGl.bufferData.mock.calls.filter(c => c[2] === mockGl.STATIC_DRAW);
        expect(staticCallsAfter.length).toBe(1);
    });

    it('should configure vertex attributes correctly (stride and offsets)', () => {
        // Reset mocks after constructor
        mockGl.vertexAttribPointer.mockClear();

        renderer.render(entities, 1005);

        // Check vertexAttribPointer calls
        // Signature: (index, size, type, normalized, stride, offset)
        // Stride should be 44 (11 floats * 4 bytes)

        const calls = mockGl.vertexAttribPointer.mock.calls;

        // Verify we have calls for all 7 attributes
        expect(calls.length).toBeGreaterThanOrEqual(7);

        // Check stride for main attributes (indices 0-6 from our mock)
        // We only care about the calls related to the main program (stride 44)
        // Parchment program uses stride 0.

        const mainProgramCalls = calls.filter(c => c[4] === 44);
        // Expect at least 7 calls (one per attribute)
        // Note: It might be called multiple times per frame if we render multiple times
        expect(mainProgramCalls.length).toBeGreaterThanOrEqual(7);

        // Verify specific attributes
        // index 5 is a_yearStart (mocked above)
        // index 6 is a_yearEnd (mocked above)

        const yearStartCall = mainProgramCalls.find(c => c[0] === 5);
        expect(yearStartCall).toBeDefined();
        expect(yearStartCall[1]).toBe(1); // size 1
        expect(yearStartCall[5]).toBe(36); // offset 36

        const yearEndCall = mainProgramCalls.find(c => c[0] === 6);
        expect(yearEndCall).toBeDefined();
        expect(yearEndCall[1]).toBe(1); // size 1
        expect(yearEndCall[5]).toBe(40); // offset 40
    });

    it('should upload correct data structure to buffer', () => {
        mockGl.bufferData.mockClear();

        // We need to trigger a rebuild
        // Since the previous test used the same renderer instance, and entities might be cached
        // We should force a rebuild by passing new entities or clearing the buffer
        renderer.geometryBuffer = null;

        renderer.render(entities, 1005);

        // Find the bufferData call for geometry
        // Look for calls with STATIC_DRAW
        const calls = mockGl.bufferData.mock.calls.filter(c => c[2] === mockGl.STATIC_DRAW);
        expect(calls.length).toBeGreaterThan(0);

        const call = calls[calls.length - 1]; // Use last call
        const data = call[1]; // Float32Array

        expect(data).toBeInstanceOf(Float32Array);

        // Check if data length is multiple of 11
        expect(data.length % 11).toBe(0);

        // Inspect first vertex to see if yearStart/yearEnd are populated
        // The first segment is "before first keyframe" (static T0)
        // Range: [-1e9, 1000]

        let foundT0Segment = false;

        for (let i = 0; i < data.length; i += 11) {
            const yStart = data[i+9];
            const yEnd = data[i+10];

            // Check for roughly -1e9 (float precision might vary slightly)
            if (yStart < -1e8 && yEnd === 1000) {
                foundT0Segment = true;
                break;
            }
        }

        expect(foundT0Segment).toBe(true);
    });
});
