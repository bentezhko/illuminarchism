import { expect, test, describe } from "bun:test";
import { escapeHTML, resampleGeometry } from "./math.js";

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

    test("resamples a closed triangle", () => {
        // Equilateral triangle side length 10
        // Perimeter 30
        const points = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 8.66 }];
        // Closing the loop explicitly for clarity, but resampleGeometry handles implicit closing if isClosed=true
        // Wait, resampleGeometry uses enforceClockwise which might reorder points.
        // Let's use a simple square to avoid clockwise issues if already clockwise.
        // (0,0) -> (10,0) -> (10,10) -> (0,10). Counter-clockwise?
        // Signed area: (0*0 - 10*0) + (10*10 - 10*0) + (10*10 - 0*10) + (0*0 - 0*10)
        // = 0 + 100 + 100 + 0 = 200. Positive. So it's CCW?
        // Wait, standard Cartesian: x right, y up.
        // (0,0) -> (10,0) -> (10,10) -> (0,10) is CCW.
        // enforceClockwise might reverse it.
        // Let's use a line for simplicity or check return value.

        // Let's just test a line treated as closed loop (degenerate polygon)
        // Or better, just test the open polyline logic first which is definitely broken.

        // Let's try the square.
        const square = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
        const resampled = resampleGeometry(square, 4, true);
        expect(resampled.length).toBe(4);
        // Should be corners if aligned with step.
        // Perimeter 40. Step 10.
        // Points: (0,0), (10,0), (10,10), (0,10).
        // enforceClockwise might reverse to CW: (0,0) -> (0,10) -> (10,10) -> (10,0).

        // We can check if all points are corners.
        const corners = new Set(square.map(p => `${p.x},${p.y}`));
        resampled.forEach(p => {
            const key = `${Math.round(p.x)},${Math.round(p.y)}`;
            expect(corners.has(key)).toBe(true);
        });
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
