import { expect, test, describe } from "bun:test";
import AtlasExporter from "./AtlasExporter.js";

describe("AtlasExporter.convertToGeoJSON", () => {
    test("handles null or undefined points", () => {
        expect(AtlasExporter.convertToGeoJSON(null)).toBe(null);
        expect(AtlasExporter.convertToGeoJSON(undefined)).toBe(null);
    });

    test("handles empty points array", () => {
        expect(AtlasExporter.convertToGeoJSON([])).toBe(null);
    });

    test("converts polity (open polygon) to closed Polygon", () => {
        const points = [{x: 0, y: 0}, {x: 10, y: 0}, {x: 10, y: 10}];
        const result = AtlasExporter.convertToGeoJSON(points, 'polity');

        expect(result.type).toBe('Polygon');
        expect(result.coordinates).toHaveLength(1);
        const ring = result.coordinates[0];
        expect(ring).toHaveLength(4); // 3 points + 1 closing point
        expect(ring[0]).toEqual([0, 0]);
        expect(ring[1]).toEqual([10, 0]);
        expect(ring[2]).toEqual([10, 10]);
        expect(ring[3]).toEqual([0, 0]); // Closed
    });

    test("converts polity (closed polygon) without duplicating end point", () => {
        const points = [{x: 0, y: 0}, {x: 10, y: 0}, {x: 10, y: 10}, {x: 0, y: 0}];
        const result = AtlasExporter.convertToGeoJSON(points, 'polity');

        expect(result.type).toBe('Polygon');
        expect(result.coordinates).toHaveLength(1);
        const ring = result.coordinates[0];
        expect(ring).toHaveLength(4); // Should remain 4 points
        expect(ring[0]).toEqual([0, 0]);
        expect(ring[3]).toEqual([0, 0]);
    });

    test("converts river to LineString", () => {
        const points = [{x: 0, y: 0}, {x: 5, y: 5}, {x: 10, y: 0}];
        const result = AtlasExporter.convertToGeoJSON(points, 'river');

        expect(result.type).toBe('LineString');
        expect(result.coordinates).toHaveLength(3);
        expect(result.coordinates[0]).toEqual([0, 0]);
        expect(result.coordinates[1]).toEqual([5, 5]);
        expect(result.coordinates[2]).toEqual([10, 0]);
    });

    test("converts route to LineString", () => {
        const points = [{x: 0, y: 0}, {x: 5, y: 5}];
        const result = AtlasExporter.convertToGeoJSON(points, 'route');

        expect(result.type).toBe('LineString');
        expect(result.coordinates).toHaveLength(2);
        expect(result.coordinates[0]).toEqual([0, 0]);
        expect(result.coordinates[1]).toEqual([5, 5]);
    });

    test("converts city to Point", () => {
        const points = [{x: 15, y: 20}];
        const result = AtlasExporter.convertToGeoJSON(points, 'city');

        expect(result.type).toBe('Point');
        expect(result.coordinates).toEqual([15, 20]);
    });

    test("defaults to Polygon for unknown type", () => {
        const points = [{x: 0, y: 0}, {x: 10, y: 0}, {x: 10, y: 10}];
        const result = AtlasExporter.convertToGeoJSON(points, 'unknown_type');

        expect(result.type).toBe('Polygon');
        expect(result.coordinates).toHaveLength(1);
        expect(result.coordinates[0]).toHaveLength(3); // Default case doesn't close the polygon explicitly
        expect(result.coordinates[0][0]).toEqual([0, 0]);
        expect(result.coordinates[0][2]).toEqual([10, 10]);
    });
});
