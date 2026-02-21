import { expect, test, describe } from "bun:test";
import HistoricalEntity from "./Entity.js";

describe("HistoricalEntity", () => {
    describe("fromJSON", () => {
        test("should create an entity from new JSON format", () => {
            const data = {
                id: "ent-1",
                name: "Test Entity",
                domain: "political",
                typology: "nation-state",
                subtype: "sovereign",
                adminLevel: 1,
                color: "#ff0000",
                hatchStyle: "solid",
                parentId: "parent-1",
                children: ["child-1"],
                boundaryType: "hard",
                boundaryConfidence: 0.95,
                attributes: { "OCM:640": "State" },
                validTime: { start: "1900-01-01", end: "2000-01-01" },
                transactionTime: { created: 1600000000000, modified: 1600000000000 },
                externalRefs: { wikidata: "Q1" },
                description: "A test entity",
                visible: false,
                timeline: [{ year: 1900, geometry: [] }],
                validRange: { start: 1900, end: 2000 }
            };

            const entity = HistoricalEntity.fromJSON(data);

            expect(entity).toBeInstanceOf(HistoricalEntity);
            expect(entity.id).toBe(data.id);
            expect(entity.name).toBe(data.name);
            expect(entity.domain).toBe(data.domain);
            expect(entity.typology).toBe(data.typology);
            expect(entity.subtype).toBe(data.subtype);
            expect(entity.adminLevel).toBe(data.adminLevel);
            expect(entity.color).toBe(data.color);
            expect(entity.hatchStyle).toBe(data.hatchStyle);
            expect(entity.parentId).toBe(data.parentId);
            expect(entity.children).toEqual(data.children);
            expect(entity.boundaryType).toBe(data.boundaryType);
            expect(entity.boundaryConfidence).toBe(data.boundaryConfidence);
            expect(entity.attributes).toEqual(data.attributes);
            expect(entity.validTime).toEqual(data.validTime);
            expect(entity.transactionTime).toEqual(data.transactionTime);
            expect(entity.externalRefs).toEqual(data.externalRefs);
            expect(entity.description).toBe(data.description);
            expect(entity.visible).toBe(data.visible);
            expect(entity.timeline).toEqual(data.timeline);
            expect(entity.validRange).toEqual(data.validRange);
        });

        test("should create an entity from legacy JSON format and migrate properties", () => {
            const data = {
                id: "ent-legacy",
                name: "Legacy Entity",
                category: "political",
                type: "polity",
                color: "#00ff00",
                parentId: "parent-legacy",
                hatchStyle: "diagonal-right",
                extraProp: "should be preserved"
            };

            const entity = HistoricalEntity.fromJSON(data);

            expect(entity).toBeInstanceOf(HistoricalEntity);
            expect(entity.id).toBe(data.id);
            expect(entity.name).toBe(data.name);

            // Legacy properties preserved
            expect(entity.category).toBe(data.category);
            expect(entity.type).toBe(data.type);
            expect(entity.color).toBe(data.color);
            expect(entity.parentId).toBe(data.parentId);
            expect(entity.hatchStyle).toBe(data.hatchStyle);

            // Migration logic (based on migrateFromLegacy in Ontology.js)
            // political -> political
            expect(entity.domain).toBe("political");
            // polity -> nation-state
            expect(entity.typology).toBe("nation-state");

            // Extra properties from Object.assign
            expect(entity.extraProp).toBe("should be preserved");
        });

        test("should handle missing optional fields in new format with defaults", () => {
            const data = {
                id: "ent-min",
                name: "Minimal Entity",
                domain: "political"
                // Missing many optional fields
            };

            const entity = HistoricalEntity.fromJSON(data);

            expect(entity.id).toBe(data.id);
            expect(entity.name).toBe(data.name);
            expect(entity.domain).toBe("political");

            // Check defaults
            expect(entity.typology).toBe("nation-state");
            expect(entity.timeline).toEqual([]);
            expect(entity.validRange).toEqual({ start: -Infinity, end: Infinity });
            expect(entity.visible).toBe(true);
            expect(entity.attributes).toEqual({});
            expect(entity.children).toEqual([]);
        });

        test("should restore validRange when present", () => {
            const data = {
                id: "ent-range",
                name: "Range Entity",
                domain: "political",
                validRange: { start: 100, end: 500 }
            };

            const entity = HistoricalEntity.fromJSON(data);
            expect(entity.validRange).toEqual({ start: 100, end: 500 });
        });

        test("should handle JSON-serialized Infinity values in validRange (as null)", () => {
            // Simulation of JSON.parse(JSON.stringify({ start: -Infinity, end: Infinity })) -> { start: null, end: null }
            const data = {
                id: "ent-infinity",
                name: "Infinity Entity",
                domain: "political",
                validRange: { start: null, end: null }
            };

            const entity = HistoricalEntity.fromJSON(data);
            // Should convert nulls back to Infinity
            expect(entity.validRange).toEqual({ start: -Infinity, end: Infinity });
        });

        test("should use defaults if validRange is missing in new format", () => {
             const data = {
                id: "ent-no-range",
                name: "No Range Entity",
                domain: "political"
            };
            const entity = HistoricalEntity.fromJSON(data);
            expect(entity.validRange).toEqual({ start: -Infinity, end: Infinity });
        });

        test("should derive boundaryType from typology if missing", () => {
            // nation-state -> legal boundaryType
            const data = {
                id: "ent-boundary",
                name: "Boundary Entity",
                domain: "political",
                typology: "nation-state"
            };
            const entity = HistoricalEntity.fromJSON(data);
            expect(entity.boundaryType).toBe("legal");
        });

        test("should use provided boundaryType if present", () => {
             const data = {
                id: "ent-boundary-override",
                name: "Boundary Entity",
                domain: "political",
                typology: "nation-state",
                boundaryType: "fuzzy"
            };
            const entity = HistoricalEntity.fromJSON(data);
            expect(entity.boundaryType).toBe("fuzzy");
        });
    });

    describe("getGeometryAtYear", () => {
        test("should return null if targetYear is out of valid range", () => {
            const entity = new HistoricalEntity("ent", "Test", {
                validRange: { start: 1000, end: 2000 }
            });
            entity.addKeyframe(1000, [{x:0, y:0}]);
            // addKeyframe expands range by 100 years -> 900 to 2100

            expect(entity.getGeometryAtYear(800)).toBeNull();
            expect(entity.getGeometryAtYear(2200)).toBeNull();
        });

        test("should return null if timeline is empty", () => {
            const entity = new HistoricalEntity("ent", "Test", {
                validRange: { start: 1000, end: 2000 }
            });
            expect(entity.getGeometryAtYear(1500)).toBeNull();
        });

        test("should return single keyframe geometry regardless of year if only one keyframe exists (within range)", () => {
            const entity = new HistoricalEntity("ent", "Test", {
                validRange: { start: 1000, end: 2000 }
            });
            const geo = [{x:0, y:0}];
            entity.addKeyframe(1000, geo, true);

            // Should return geo for any year inside range
            expect(entity.getGeometryAtYear(1000)).toEqual(geo);
            expect(entity.getGeometryAtYear(1500)).toEqual(geo);
        });

        test("should interpolate between two keyframes (Polygon)", () => {
            const entity = new HistoricalEntity("ent", "Test", {
                domain: "political",
                typology: "nation-state" // Polygon
            });

            const geo1 = [
                {x:0, y:0}, {x:10, y:0}, {x:10, y:10}, {x:0, y:10}
            ];
            const geo2 = [
                {x:10, y:10}, {x:20, y:10}, {x:20, y:20}, {x:10, y:20}
            ];

            entity.addKeyframe(1000, geo1, true); // prevent resampling to keep points clean
            entity.addKeyframe(2000, geo2, true);

            const mid = entity.getGeometryAtYear(1500);

            expect(mid).toHaveLength(4);
            expect(mid[0]).toEqual({x: 5, y: 5});
            expect(mid[2]).toEqual({x: 15, y: 15});
        });

        test("should interpolate between two keyframes (Polyline/River)", () => {
             const entity = new HistoricalEntity("ent", "Test", {
                domain: "geographic",
                typology: "river" // LineString
            });

            const geo1 = [
                {x:0, y:0}, {x:10, y:0}
            ];
            const geo2 = [
                {x:0, y:10}, {x:10, y:10}
            ];

            entity.addKeyframe(1000, geo1, true);
            entity.addKeyframe(2000, geo2, true);

            const mid = entity.getGeometryAtYear(1500);

            // Midpoint: (0, 5), (10, 5)
            expect(mid).toHaveLength(2);
            expect(mid[0]).toEqual({x: 0, y: 5});
            expect(mid[1]).toEqual({x: 10, y: 5});
        });

        test("should resample geometry when point counts differ", () => {
            const entity = new HistoricalEntity("ent", "Test", {
                domain: "political"
            });

            // Triangle
            const geo1 = [
                {x:0, y:0}, {x:10, y:0}, {x:5, y:10}
            ];
            // Square
            const geo2 = [
                {x:0, y:0}, {x:10, y:0}, {x:10, y:10}, {x:0, y:10}
            ];

            entity.addKeyframe(1000, geo1, true);
            entity.addKeyframe(2000, geo2, true);

            const mid = entity.getGeometryAtYear(1500);

            // Should be resampled to CONFIG.RESAMPLE_COUNT (100)
            expect(mid.length).toBe(100);
        });

        test("should handle single point entity correctly", () => {
             const entity = new HistoricalEntity("ent", "Test", {
                domain: "political",
                typology: "city" // Point
            });

            const geo1 = [{x:0, y:0}];
            const geo2 = [{x:10, y:10}];

            entity.addKeyframe(1000, geo1);
            entity.addKeyframe(2000, geo2);

            const mid = entity.getGeometryAtYear(1500);
            expect(mid).toHaveLength(1);
            expect(mid[0]).toEqual({x: 5, y: 5});
        });
    });
});
