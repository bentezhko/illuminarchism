import { test, expect, describe, mock, beforeEach } from "bun:test";

// Mock the dependencies
const mockResampleGeometry = mock((points, count, isClosed) => {
    return points.map(p => ({ ...p, resampled: true, closed: isClosed }));
});

mock.module("./math.js", () => {
    return {
        resampleGeometry: mockResampleGeometry,
        alignPolygonClosed: mock(() => {}),
        alignPolylineOpen: mock(() => {}),
        getCentroid: mock(() => ({x: 0, y: 0})),
        lerp: mock((a, b, t) => a),
        distance: mock(() => 0),
        distSq: mock(() => 0),
        isPointInPolygon: mock(() => false),
        distanceToSegment: mock(() => 0),
        getSignedArea: mock(() => 0),
        getBoundingBox: mock(() => ({x:0, y:0, w:0, h:0})),
        enforceClockwise: mock((pts) => pts),
        escapeHTML: mock((str) => str),
    };
});

// Import the module AFTER mocking
import HistoricalEntity from "./Entity.js";

describe("HistoricalEntity.addKeyframe", () => {
    beforeEach(() => {
        mockResampleGeometry.mockClear();
    });

    test("should add a polygon keyframe and resample it (closed)", () => {
        const entity = new HistoricalEntity("test-1", "Test", {
            domain: "political",
            typology: "nation-state"
        });

        const inputGeo = [{x:0, y:0}, {x:10, y:0}, {x:10, y:10}];
        entity.addKeyframe(1900, inputGeo);

        expect(entity.timeline).toHaveLength(1);
        expect(entity.timeline[0].year).toBe(1900);
        // Check if resampleGeometry was called
        expect(mockResampleGeometry).toHaveBeenCalled();
        expect(mockResampleGeometry).toHaveBeenCalledWith(expect.any(Array), expect.any(Number), true); // true for closed

        // Check if the geometry in timeline is the mocked result
        expect(entity.timeline[0].geometry[0]).toHaveProperty("resampled", true);
        expect(entity.timeline[0].geometry[0]).toHaveProperty("closed", true);
    });

    test("should add a line keyframe and resample it (open)", () => {
        const entity = new HistoricalEntity("test-river", "Test River", {
            domain: "geographic",
            typology: "river" // Explicitly river
        });

        // Ensure type is derived correctly for the test logic
        // Based on Entity.js logic: isLineType = this.type === 'river' || this.typology === 'river' || this.typology === 'coast'
        // 'river' typology maps to 'river' type in migrateFromLegacy/deriveTypeFromTypology

        const inputGeo = [{x:0, y:0}, {x:10, y:10}];
        entity.addKeyframe(1900, inputGeo);

        expect(mockResampleGeometry).toHaveBeenCalledWith(expect.any(Array), expect.any(Number), false); // false for open
        expect(entity.timeline[0].geometry[0]).toHaveProperty("closed", false);
    });

    test("should NOT resample point geometries", () => {
        const entity = new HistoricalEntity("test-city", "Test City", {
            domain: "political",
            typology: "city" // Should be treated as point type
        });

        // getTypology('political', 'city') should return object with geometryType: 'Point'
        // Wait, Ontology.js defines CITY under POLITICAL_TYPOLOGY with geometryType: 'Point'

        const inputGeo = [{x:5, y:5}];
        entity.addKeyframe(1900, inputGeo);

        expect(mockResampleGeometry).not.toHaveBeenCalled();
        expect(entity.timeline[0].geometry).toEqual([{x:5, y:5}]);
        // Should be a deep copy
        expect(entity.timeline[0].geometry).not.toBe(inputGeo);
    });

    test("should NOT resample if preventResampling is true", () => {
        const entity = new HistoricalEntity("test-1", "Test", {
            domain: "political",
            typology: "nation-state"
        });

        const inputGeo = [{x:0, y:0}, {x:10, y:0}, {x:10, y:10}];
        entity.addKeyframe(1900, inputGeo, true); // preventResampling = true

        expect(mockResampleGeometry).not.toHaveBeenCalled();
        expect(entity.timeline[0].geometry).toEqual(inputGeo);
        expect(entity.timeline[0].geometry).not.toBe(inputGeo); // Still deep copied
    });

    test("should manage timeline order and overwrites", () => {
        const entity = new HistoricalEntity("test-1", "Test", {
            domain: "political"
        });

        entity.addKeyframe(2000, [{x:0,y:0}]);
        entity.addKeyframe(1900, [{x:0,y:0}]);

        // Use a polygon (3 points) to trigger resampling
        const poly = [{x:1,y:1}, {x:2,y:1}, {x:2,y:2}];
        entity.addKeyframe(2000, poly); // Overwrite 2000

        expect(entity.timeline).toHaveLength(2);
        expect(entity.timeline[0].year).toBe(1900);
        expect(entity.timeline[1].year).toBe(2000);
        expect(entity.timeline[1].geometry[0]).toHaveProperty("resampled", true);
    });

    test("should expand validRange if finite", () => {
        const entity = new HistoricalEntity("test-range", "Test", {
            domain: "political",
            validRange: { start: 1800, end: 1900 }
        });

        entity.addKeyframe(2000, [{x:0,y:0}]);

        // Logic: end = max(2000 + 100, 1900) = 2100
        expect(entity.validRange.end).toBe(2100);
        expect(entity.validRange.start).toBe(1800);

        entity.addKeyframe(1700, [{x:0,y:0}]);
        // Logic: start = min(1700 - 100, 1800) = 1600
        expect(entity.validRange.start).toBe(1600);
    });

    test("should NOT expand validRange if infinite", () => {
        const entity = new HistoricalEntity("test-inf", "Test", {
            domain: "political",
            validRange: { start: -Infinity, end: Infinity }
        });

        entity.addKeyframe(2000, [{x:0,y:0}]);
        expect(entity.validRange.start).toBe(-Infinity);
        expect(entity.validRange.end).toBe(Infinity);
    });
});
