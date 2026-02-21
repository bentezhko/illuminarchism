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
});
