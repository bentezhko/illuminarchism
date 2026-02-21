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

    test("returns null for polity with less than 3 points", () => {
        const points = [{x: 0, y: 0}, {x: 1, y: 1}];
        expect(AtlasExporter.convertToGeoJSON(points, 'polity')).toBe(null);
    });

    test("converts polity (open polygon) to closed Polygon", () => {
        const points = [{x: 0, y: 0}, {x: 10, y: 0}, {x: 10, y: 10}];
        const result = AtlasExporter.convertToGeoJSON(points, 'polity');

        expect(result).toEqual({
            type: 'Polygon',
            coordinates: [[
                [0, 0],
                [10, 0],
                [10, 10],
                [0, 0]
            ]]
        });
    });

    test("converts polity (closed polygon) without duplicating end point", () => {
        const points = [{x: 0, y: 0}, {x: 10, y: 0}, {x: 10, y: 10}, {x: 0, y: 0}];
        const result = AtlasExporter.convertToGeoJSON(points, 'polity');

        expect(result).toEqual({
            type: 'Polygon',
            coordinates: [[
                [0, 0],
                [10, 0],
                [10, 10],
                [0, 0]
            ]]
        });
    });

    test("converts river to LineString", () => {
        const points = [{x: 0, y: 0}, {x: 5, y: 5}, {x: 10, y: 0}];
        const result = AtlasExporter.convertToGeoJSON(points, 'river');

        expect(result).toEqual({
            type: 'LineString',
            coordinates: [
                [0, 0],
                [5, 5],
                [10, 0]
            ]
        });
    });

    test("converts route to LineString", () => {
        const points = [{x: 0, y: 0}, {x: 5, y: 5}];
        const result = AtlasExporter.convertToGeoJSON(points, 'route');

        expect(result).toEqual({
            type: 'LineString',
            coordinates: [
                [0, 0],
                [5, 5]
            ]
        });
    });

    test("converts city to Point", () => {
        const points = [{x: 15, y: 20}];
        const result = AtlasExporter.convertToGeoJSON(points, 'city');

        expect(result).toEqual({
            type: 'Point',
            coordinates: [15, 20]
        });
    });

    test("defaults to Polygon for unknown type", () => {
        const points = [{x: 0, y: 0}, {x: 10, y: 0}, {x: 10, y: 10}];
        const result = AtlasExporter.convertToGeoJSON(points, 'unknown_type');

        expect(result).toEqual({
            type: 'Polygon',
            coordinates: [[
                [0, 0],
                [10, 0],
                [10, 10]
            ]]
        });
    });
});
