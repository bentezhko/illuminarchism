import { expect, test, describe } from "bun:test";
import { escapeHTML, resampleGeometry, alignPolygonClosed } from "./math.js";

describe("alignPolygonClosed", () => {
    test("returns second polygon as-is if lengths differ", () => {
        const p1 = [{ x: 0, y: 0 }];
        const p2 = [{ x: 0, y: 0 }, { x: 1, y: 1 }];
        expect(alignPolygonClosed(p1, p2)).toEqual(p2);
    });

    test("aligns identical polygons correctly", () => {
        const poly = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 5 }];
        expect(alignPolygonClosed(poly, poly)).toEqual(poly);
    });

    test("aligns rotated triangle to match first polygon", () => {
        // poly1: Triangle ABC
        const poly1 = [
            { x: 0, y: 0 },   // A
            { x: 10, y: 0 },  // B
            { x: 5, y: 5 }    // C
        ];
        // poly2: Triangle BCA (rotated)
        const poly2 = [
            { x: 10, y: 0 },  // B
            { x: 5, y: 5 },   // C
            { x: 0, y: 0 }    // A
        ];

        // Should align poly2 to match poly1 order: A, B, C
        const aligned = alignPolygonClosed(poly1, poly2);

        expect(aligned).toEqual(poly1);
    });

    test("aligns square regardless of starting point", () => {
        const poly1 = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 }
        ];
        // poly2 is poly1 rotated by 2 steps
        const poly2 = [
            { x: 10, y: 10 },
            { x: 0, y: 10 },
            { x: 0, y: 0 },
            { x: 10, y: 0 }
        ];

        const aligned = alignPolygonClosed(poly1, poly2);
        expect(aligned).toEqual(poly1);
    });

    test("handles empty polygons", () => {
        expect(alignPolygonClosed([], [])).toEqual([]);
    });

    test("handles single point polygons", () => {
        const p1 = [{ x: 1, y: 1 }];
        const p2 = [{ x: 2, y: 2 }];
        expect(alignPolygonClosed(p1, p2)).toEqual(p2);
    });
});

describe("resampleGeometry", () => {
    test("resamples a simple line segment (open)", () => {
        const points = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
        const resampled = resampleGeometry(points, 3, false);
        expect(resampled.length).toBe(3);
        expect(resampled[0]).toEqual({ x: 0, y: 0 });
        expect(resampled[1]).toEqual({ x: 5, y: 0 });
        expect(resampled[2]).toEqual({ x: 10, y: 0 });
    });

    test("resamples a 2-segment polyline (open)", () => {
        const points = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }];
        const resampled = resampleGeometry(points, 3, false);
        expect(resampled.length).toBe(3);
        // Expect points at 0, 10, 20
        expect(resampled[0]).toEqual({ x: 0, y: 0 });
        expect(resampled[1].x).toBeCloseTo(10);
        expect(resampled[1].y).toBeCloseTo(0);
        expect(resampled[2]).toEqual({ x: 20, y: 0 });
    });

    test("resamples a closed square", () => {
        // A square with side length 10 has a perimeter of 40.
        // Resampling to 4 points should return the corners.
        const square = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
        const resampled = resampleGeometry(square, 4, true);

        expect(resampled.length).toBe(4);

        // The resampled points should match the original corners.
        // `enforceClockwise` might change the order, so we compare sets of points.
        const originalCorners = new Set(square.map(p => `${p.x},${p.y}`));
        const resampledCorners = new Set(resampled.map(p => `${Math.round(p.x)},${Math.round(p.y)}`));

        expect(resampledCorners).toEqual(originalCorners);
    });

    test("handles edge cases", () => {
        expect(resampleGeometry([], 5)).toEqual([]);
        expect(resampleGeometry([{ x: 0, y: 0 }], 5)).toEqual([{ x: 0, y: 0 }]);
    });
});

describe("escapeHTML", () => {
    test("escapes basic HTML entities", () => {
        expect(escapeHTML("<script>alert(1)</script>")).toBe("&lt;script&gt;alert(1)&lt;/script&gt;");
        expect(escapeHTML('attr="value"')).toBe("attr=&quot;value&quot;");
        expect(escapeHTML("'single'")).toBe("&#39;single&#39;");
        expect(escapeHTML("a & b")).toBe("a &amp; b");
    });

    test("handles null or undefined", () => {
        expect(escapeHTML(null)).toBe("");
        expect(escapeHTML(undefined)).toBe("");
    });

    test("handles non-string values", () => {
        expect(escapeHTML(123)).toBe("123");
        expect(escapeHTML(0)).toBe("0");
        expect(escapeHTML(true)).toBe("true");
        expect(escapeHTML(false)).toBe("false");
    });

    test("escapes complex attack vectors", () => {
        const payload = '<img src=x onerror="alert(\'XSS\')">';
        const expected = "&lt;img src=x onerror=&quot;alert(&#39;XSS&#39;)&quot;&gt;";
        expect(escapeHTML(payload)).toBe(expected);
    });
});
