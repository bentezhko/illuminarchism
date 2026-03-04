import { expect, test, describe } from "bun:test";
import GeoMath from "./GeoMath.js";

describe("GeoMath.distance", () => {
    test("calculates distance between two distinct points", () => {
        const p1 = { x: 0, y: 0 };
        const p2 = { x: 3, y: 4 };
        expect(GeoMath.distance(p1, p2)).toBe(5);
    });

    test("calculates distance when points are identical", () => {
        const p1 = { x: 5, y: 5 };
        const p2 = { x: 5, y: 5 };
        expect(GeoMath.distance(p1, p2)).toBe(0);
    });

    test("handles negative coordinates correctly", () => {
        const p1 = { x: -3, y: -4 };
        const p2 = { x: 3, y: 4 };
        expect(GeoMath.distance(p1, p2)).toBe(10);
    });
});

describe("GeoMath.lerp", () => {
    test("interpolates correctly at t=0", () => {
        expect(GeoMath.lerp(10, 20, 0)).toBe(10);
    });

    test("interpolates correctly at t=1", () => {
        expect(GeoMath.lerp(10, 20, 1)).toBe(20);
    });

    test("interpolates correctly at t=0.5", () => {
        expect(GeoMath.lerp(10, 20, 0.5)).toBe(15);
    });

    test("extrapolates when t < 0", () => {
        expect(GeoMath.lerp(10, 20, -0.5)).toBe(5);
    });

    test("extrapolates when t > 1", () => {
        expect(GeoMath.lerp(10, 20, 1.5)).toBe(25);
    });
});

describe("GeoMath.lerpPoint", () => {
    test("interpolates correctly at t=0", () => {
        const p1 = { x: 10, y: 10 };
        const p2 = { x: 20, y: 20 };
        expect(GeoMath.lerpPoint(p1, p2, 0)).toEqual({ x: 10, y: 10 });
    });

    test("interpolates correctly at t=1", () => {
        const p1 = { x: 10, y: 10 };
        const p2 = { x: 20, y: 20 };
        expect(GeoMath.lerpPoint(p1, p2, 1)).toEqual({ x: 20, y: 20 });
    });

    test("interpolates correctly at t=0.5", () => {
        const p1 = { x: 10, y: 10 };
        const p2 = { x: 30, y: 50 };
        expect(GeoMath.lerpPoint(p1, p2, 0.5)).toEqual({ x: 20, y: 30 });
    });
});

describe("GeoMath.getCentroid", () => {
    test("calculates centroid of a square correctly", () => {
        const points = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 }
        ];
        expect(GeoMath.getCentroid(points)).toEqual({ x: 5, y: 5 });
    });

    test("calculates centroid of a triangle correctly", () => {
        const points = [
            { x: 0, y: 0 },
            { x: 6, y: 0 },
            { x: 3, y: 6 }
        ];
        expect(GeoMath.getCentroid(points)).toEqual({ x: 3, y: 2 });
    });

    test("returns {x:0, y:0} for empty array", () => {
        expect(GeoMath.getCentroid([])).toEqual({ x: 0, y: 0 });
    });

    test("returns {x:0, y:0} for null/undefined", () => {
        expect(GeoMath.getCentroid(null)).toEqual({ x: 0, y: 0 });
        expect(GeoMath.getCentroid(undefined)).toEqual({ x: 0, y: 0 });
    });
});

describe("GeoMath.isPointInPolygon", () => {
    const polygon = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 }
    ];

    test("returns true for point clearly inside", () => {
        expect(GeoMath.isPointInPolygon({ x: 5, y: 5 }, polygon)).toBe(true);
    });

    test("returns false for point clearly outside", () => {
        expect(GeoMath.isPointInPolygon({ x: 15, y: 15 }, polygon)).toBe(false);
        expect(GeoMath.isPointInPolygon({ x: -5, y: 5 }, polygon)).toBe(false);
    });

    // Ray casting behavior on edges/vertices can be inconsistent, but typically:
    test("handles point on edge (might depend on implementation, testing for no crash)", () => {
        const result = GeoMath.isPointInPolygon({ x: 5, y: 0 }, polygon);
        expect(typeof result).toBe("boolean");
    });
});

describe("GeoMath.roughenPolygon", () => {
    const square = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 }
    ];

    test("increases number of points correctly", () => {
        // 4 points, 1 iteration -> 8 points
        const roughened1 = GeoMath.roughenPolygon(square, 1, 0);
        expect(roughened1.length).toBe(8);

        // 4 points, 2 iterations -> 16 points
        const roughened2 = GeoMath.roughenPolygon(square, 2, 0);
        expect(roughened2.length).toBe(16);
    });

    test("preserves original vertices when displacement is 0", () => {
        const roughened = GeoMath.roughenPolygon(square, 1, 0);
        expect(roughened[0]).toEqual(square[0]);
        expect(roughened[2]).toEqual(square[1]);
        expect(roughened[4]).toEqual(square[2]);
        expect(roughened[6]).toEqual(square[3]);
    });

    test("adds randomness based on displacement", () => {
        // Mock Math.random to always return 1 (max displacement)
        const originalRandom = Math.random;
        Math.random = () => 1;

        const roughened = GeoMath.roughenPolygon(square, 1, 10);

        // Midpoint between (0,0) and (100,0) is (50,0)
        // Normal is (0, 1) or (0, -1) depending on winding
        // Displacement amount = (1 - 0.5) * 10 = 5
        const midPoint = roughened[1];

        // Distance from actual midpoint should be around 5
        const dist = GeoMath.distance(midPoint, { x: 50, y: 0 });
        expect(dist).toBeCloseTo(5);

        Math.random = originalRandom; // Restore
    });
});

describe("GeoMath.smoothPolygon", () => {
    const square = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 }
    ];

    test("doubles number of points correctly per iteration", () => {
        // 4 points, 1 iteration -> 8 points
        const smoothed1 = GeoMath.smoothPolygon(square, 1);
        expect(smoothed1.length).toBe(8);

        // 4 points, 2 iterations -> 16 points
        const smoothed2 = GeoMath.smoothPolygon(square, 2);
        expect(smoothed2.length).toBe(16);
    });

    test("cuts corners correctly at 1/4 and 3/4", () => {
        const smoothed = GeoMath.smoothPolygon(square, 1);

        // Between (0,0) and (100,0)
        expect(smoothed[0]).toEqual({ x: 25, y: 0 });
        expect(smoothed[1]).toEqual({ x: 75, y: 0 });
    });
});

describe("GeoMath.getBoundingBox", () => {
    test("calculates bounding box correctly for standard polygon", () => {
        const points = [
            { x: 10, y: 20 },
            { x: 30, y: 10 },
            { x: 40, y: 40 },
            { x: 20, y: 50 }
        ];
        const bbox = GeoMath.getBoundingBox(points);
        expect(bbox).toEqual({ minX: 10, minY: 10, maxX: 40, maxY: 50 });
    });

    test("handles single point correctly", () => {
        const points = [{ x: 5, y: 5 }];
        const bbox = GeoMath.getBoundingBox(points);
        expect(bbox).toEqual({ minX: 5, minY: 5, maxX: 5, maxY: 5 });
    });

    test("returns 0 box for empty array", () => {
        const bbox = GeoMath.getBoundingBox([]);
        expect(bbox).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0 });
    });

    test("returns 0 box for null/undefined", () => {
        const bboxNull = GeoMath.getBoundingBox(null);
        expect(bboxNull).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0 });

        const bboxUndefined = GeoMath.getBoundingBox(undefined);
        expect(bboxUndefined).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0 });
    });

    test("handles negative coordinates correctly", () => {
        const points = [
            { x: -10, y: -20 },
            { x: -30, y: 10 },
            { x: 40, y: -40 },
            { x: 20, y: 50 }
        ];
        const bbox = GeoMath.getBoundingBox(points);
        expect(bbox).toEqual({ minX: -30, minY: -40, maxX: 40, maxY: 50 });
    });
});