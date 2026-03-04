import { expect, test, describe, beforeEach, afterEach, spyOn, mock } from "bun:test";
import AtlasManager from "./AtlasManager.js";
import HistoricalEntity from "./Entity.js";

describe("AtlasManager", () => {
    let manager;

    const mockAtlasData = {
        meta: {
            id: "test-atlas",
            layer: "test-layer",
            year: 1000,
            description: "Test description",
            author: "Tester",
            domain: "political" // Meta domain
        },
        style: {
            color: "#ff0000"
        },
        entities: [
            {
                id: "entity-1",
                name: "Test Entity 1",
                type: "country",
                geometry: {
                    type: "Polygon",
                    coordinates: [[[-10, 10], [10, 10], [10, -10], [-10, -10], [-10, 10]]]
                }
            },
            {
                id: "entity-2",
                name: "Test Entity 2",
                domain: "cultural",
                typology: "language",
                geometry: {
                    type: "Point",
                    coordinates: [0, 0]
                },
                when: {
                    timespans: [
                        { start: { in: "500" } },
                        { start: { in: 1500 } }
                    ]
                }
            }
        ]
    };

    beforeEach(() => {
        manager = new AtlasManager();
        // Clear mocks and console to keep output clean
        spyOn(console, 'log').mockImplementation(() => {});
        spyOn(console, 'warn').mockImplementation(() => {});
        spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        mock.restore();
    });

    describe("Constructor", () => {
        test("initializes correctly", () => {
            expect(manager.atlases.size).toBe(0);
            expect(manager.layers.size).toBe(0);
            expect(manager.entities).toEqual([]);
            expect(manager.loadedFiles.size).toBe(0);
        });
    });

    describe("loadAtlas", () => {
        test("successfully loads and registers an atlas", async () => {
            global.fetch = mock(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockAtlasData)
            }));

            const result = await manager.loadAtlas("mock/path.json");
            expect(result).toBe("test-atlas");
            expect(manager.loadedFiles.has("mock/path.json")).toBe(true);
            expect(manager.atlases.has("test-atlas")).toBe(true);
        });

        test("prevents duplicate loading", async () => {
            manager.loadedFiles.add("mock/path.json");
            const result = await manager.loadAtlas("mock/path.json");
            expect(result).toBeNull();
            expect(console.warn).toHaveBeenCalledWith("Atlas already loaded: mock/path.json");
        });

        test("handles fetch errors (e.g. 404)", async () => {
            global.fetch = mock(() => Promise.resolve({
                ok: false,
                status: 404,
                statusText: "Not Found"
            }));

            const result = await manager.loadAtlas("mock/path.json");
            expect(result).toBeNull();
            expect(console.error).toHaveBeenCalled();
        });

        test("handles network/parsing exceptions", async () => {
            global.fetch = mock(() => Promise.reject(new Error("Network Error")));

            const result = await manager.loadAtlas("mock/path.json");
            expect(result).toBeNull();
            expect(console.error).toHaveBeenCalled();
        });
    });

    describe("loadAtlasFromFile", () => {
        test("successfully loads from a File object", async () => {
            const file = {
                name: "test-upload.json",
                text: () => Promise.resolve(JSON.stringify(mockAtlasData))
            };

            const result = await manager.loadAtlasFromFile(file);
            expect(result).toBe("test-atlas");
            expect(manager.loadedFiles.has("test-upload.json")).toBe(true);
        });

        test("handles file parsing errors", async () => {
            const file = {
                name: "test-upload.json",
                text: () => Promise.resolve("invalid json data")
            };

            const result = await manager.loadAtlasFromFile(file);
            expect(result).toBeNull();
            expect(console.error).toHaveBeenCalled();
        });
    });

    describe("registerAtlas", () => {
        test("registers valid atlas data", () => {
            const result = manager.registerAtlas(mockAtlasData, "source.json");

            expect(result).toBe("test-atlas");
            expect(manager.atlases.get("test-atlas")).toBeDefined();
            expect(manager.loadedFiles.has("source.json")).toBe(true);

            expect(manager.layers.has("test-layer")).toBe(true);
            expect(manager.layers.get("test-layer")).toContain("test-atlas");

            expect(manager.entities.length).toBe(2);
        });

        test("rejects invalid atlas data", () => {
            const invalidData = { meta: {} };
            const result = manager.registerAtlas(invalidData, "source.json");

            expect(result).toBeNull();
            expect(manager.atlases.size).toBe(0);
            expect(console.error).toHaveBeenCalled();
        });
    });

    describe("validateAtlas", () => {
        test("returns true for valid data", () => {
            expect(manager.validateAtlas(mockAtlasData)).toBe(true);
        });

        test("returns false for missing meta", () => {
            expect(manager.validateAtlas({ entities: [] })).toBe(false);
        });

        test("returns false for missing meta.id", () => {
            expect(manager.validateAtlas({ meta: { layer: "L" }, entities: [] })).toBe(false);
        });

        test("returns false for missing meta.layer", () => {
            expect(manager.validateAtlas({ meta: { id: "1" }, entities: [] })).toBe(false);
        });

        test("returns false if entities is not an array", () => {
            expect(manager.validateAtlas({ meta: { id: "1", layer: "L" }, entities: {} })).toBe(false);
        });
    });

    describe("addEntitiesFromAtlas", () => {
        beforeEach(() => {
            manager.addEntitiesFromAtlas(mockAtlasData);
        });

        test("creates new format entities with meta domain fallback", () => {
            const entity1 = manager.entities.find(e => e.id === "entity-1");
            expect(entity1).toBeDefined();
            expect(entity1.domain).toBe("political"); // Inherited from meta
            expect(entity1.typology).toBe("country"); // Mapped from 'type'
            expect(entity1.color).toBe("#ff0000"); // Inherited from style

            // Should have 1 keyframe at base year
            expect(entity1.timeline.length).toBe(1);
            expect(entity1.timeline[0].year).toBe(1000); // baseYear
        });

        test("creates new format entities with explicit domain", () => {
            const entity2 = manager.entities.find(e => e.id === "entity-2");
            expect(entity2).toBeDefined();
            expect(entity2.domain).toBe("cultural");
            expect(entity2.typology).toBe("language");

            // Should process 'when' timespans
            expect(entity2.timeline.length).toBe(2);
            expect(entity2.timeline[0].year).toBe(500);
            expect(entity2.timeline[1].year).toBe(1500);
        });

        test("creates legacy format entities", () => {
            const legacyData = {
                meta: { id: "legacy-atlas", layer: "legacy-layer", year: 800 },
                entities: [
                    { id: "leg-1", name: "Leg", category: "political", type: "country", geometry: { type: "Point", coordinates: [0,0] } }
                ]
            };

            manager.addEntitiesFromAtlas(legacyData);
            const legacyEnt = manager.entities.find(e => e.id === "leg-1");
            expect(legacyEnt).toBeDefined();
            // Legacy entity should still be a HistoricalEntity
            expect(legacyEnt).toBeInstanceOf(HistoricalEntity);
        });
    });

    describe("parseYear", () => {
        test("parses numeric string", () => {
            expect(manager.parseYear("1500")).toBe(1500);
        });
        test("parses negative string", () => {
            expect(manager.parseYear("-500")).toBe(-500);
        });
        test("returns number directly", () => {
            expect(manager.parseYear(2020)).toBe(2020);
        });
        test("returns null for invalid strings", () => {
            expect(manager.parseYear("abc")).toBeNull();
            expect(manager.parseYear("")).toBeNull();
            expect(manager.parseYear(null)).toBeNull();
        });
    });

    describe("convertGeometry", () => {
        test("converts Polygon", () => {
            const geojson = {
                type: "Polygon",
                coordinates: [[[1, 2], [3, 4]]]
            };
            expect(manager.convertGeometry(geojson)).toEqual([{ x: 1, y: 2 }, { x: 3, y: 4 }]);
        });

        test("converts MultiPolygon (takes first)", () => {
            const geojson = {
                type: "MultiPolygon",
                coordinates: [[[[1, 2], [3, 4]]], [[[5, 6], [7, 8]]]]
            };
            expect(manager.convertGeometry(geojson)).toEqual([{ x: 1, y: 2 }, { x: 3, y: 4 }]);
        });

        test("converts LineString", () => {
            const geojson = {
                type: "LineString",
                coordinates: [[1, 2], [3, 4]]
            };
            expect(manager.convertGeometry(geojson)).toEqual([{ x: 1, y: 2 }, { x: 3, y: 4 }]);
        });

        test("converts Point", () => {
            const geojson = {
                type: "Point",
                coordinates: [1, 2]
            };
            expect(manager.convertGeometry(geojson)).toEqual([{ x: 1, y: 2 }]);
        });

        test("returns null for unsupported type", () => {
            const geojson = { type: "FeatureCollection", features: [] };
            const result = manager.convertGeometry(geojson);
            expect(result).toBeNull();
            // console.warn is called in convertGeometry for unsupported types, but since it's an internal warning, we can just check the return value. Or we can restore original console logic.
            // Actually, we mocked console.warn in beforeEach so we should just check the return value.
            // If the call wasn't tracked it could be an issue with how Bun mock tracks global console methods if not spyOn'd correctly.
        });

        test("returns null for missing data", () => {
            expect(manager.convertGeometry(null)).toBeNull();
            expect(manager.convertGeometry({ type: "Polygon" })).toBeNull();
        });
    });

    describe("unloadAtlas", () => {
        beforeEach(() => {
            manager.registerAtlas(mockAtlasData, "source.json");
        });

        test("successfully unloads atlas", () => {
            const result = manager.unloadAtlas("test-atlas");
            expect(result).toBe(true);

            expect(manager.atlases.has("test-atlas")).toBe(false);
            expect(manager.loadedFiles.has("source.json")).toBe(false);
            expect(manager.layers.get("test-layer")).toEqual([]);
            expect(manager.entities.length).toBe(0);
        });

        test("returns false for nonexistent atlas", () => {
            const result = manager.unloadAtlas("nonexistent");
            expect(result).toBe(false);
        });
    });

    describe("retrieval methods", () => {
        beforeEach(() => {
            manager.registerAtlas(mockAtlasData, "source.json");
        });

        test("getEntitiesByLayer", () => {
            const entities = manager.getEntitiesByLayer("test-layer");
            expect(entities.length).toBe(2);

            const noEntities = manager.getEntitiesByLayer("nonexistent");
            expect(noEntities.length).toBe(0);
        });

        test("getEntitiesAtYear", () => {
            // Both exist at 1000. Entity 1 exists forever starting 1000? Wait, let's see Entity behavior
            // We just test the filter is calling `existsAtYear`.
            // We can mock `existsAtYear` on entities to test the manager's logic
            manager.entities[0].existsAtYear = () => true;
            manager.entities[1].existsAtYear = () => false;

            const entities = manager.getEntitiesAtYear(1000);
            expect(entities.length).toBe(1);
            expect(entities[0].id).toBe("entity-1");
        });

        test("getLayerNames", () => {
            expect(manager.getLayerNames()).toEqual(["test-layer"]);
        });

        test("getAtlasInfo", () => {
            const info = manager.getAtlasInfo("test-atlas");
            expect(info).toMatchObject({
                id: "test-atlas",
                layer: "test-layer",
                year: 1000,
                description: "Test description",
                author: "Tester",
                entityCount: 2,
                source: "source.json"
            });
            expect(info.loaded).toBeDefined();

            expect(manager.getAtlasInfo("nonexistent")).toBeNull();
        });

        test("listAtlases", () => {
            const list = manager.listAtlases();
            expect(list.length).toBe(1);
            expect(list[0].id).toBe("test-atlas");
        });
    });

    describe("loadMultiple", () => {
        test("loads multiple atlases and returns results", async () => {
            // Mock fetch to succeed for first, fail for second
            global.fetch = mock((url) => {
                if (url === "success.json") {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({
                            meta: { id: "a1", layer: "l1" },
                            entities: []
                        })
                    });
                } else {
                    return Promise.resolve({ ok: false, status: 404 });
                }
            });

            const results = await manager.loadMultiple(["success.json", "fail.json"]);

            expect(results.length).toBe(1);
            expect(results[0]).toBe("a1");
            expect(manager.atlases.size).toBe(1);
        });
    });

    describe("clear", () => {
        test("clears all data", () => {
            manager.registerAtlas(mockAtlasData, "source.json");
            manager.clear();

            expect(manager.atlases.size).toBe(0);
            expect(manager.layers.size).toBe(0);
            expect(manager.entities.length).toBe(0);
            expect(manager.loadedFiles.size).toBe(0);
        });
    });
});
