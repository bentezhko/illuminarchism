import { expect, test, describe, beforeEach, afterEach, mock } from "bun:test";
import AtlasLoader from "./AtlasLoader.js";
import HistoricalEntity from "../core/Entity.js";

describe("AtlasLoader", () => {
    let mockApp;
    let loader;
    let originalFileReader;
    let originalConsoleError;
    let originalConsoleLog;

    beforeEach(() => {
        // Mock app
        mockApp = {
            entities: [],
            connections: [],
            selectedEntityId: null,
            hoveredEntityId: null,
            atlasMeta: null,
            layers: null,
            showMessage: mock(),
            updateEntities: mock(),
            render: mock(),
            layerManager: { render: mock() },
            registry: { render: mock() }
        };

        loader = new AtlasLoader(mockApp);

        // Mock console.error and console.log to keep test output clean
        originalConsoleError = console.error;
        originalConsoleLog = console.log;
        console.error = mock();
        console.log = mock();

        // Mock FileReader
        originalFileReader = global.FileReader;
        global.FileReader = class {
            constructor() {
                this.onload = null;
                this.error = null;
                this.result = null;
            }
            readAsText(file) {
                // Simulate asynchronous reading that FileReader would do
                // For simplicity we will just call onload directly in our tests
                // with a fake event
            }
        };
    });

    afterEach(() => {
        global.FileReader = originalFileReader;
        console.error = originalConsoleError;
        console.log = originalConsoleLog;
    });

    describe("loadFromJSON", () => {
        test("returns early if no file is provided", () => {
            const event = { target: { files: [] } };
            loader.loadFromJSON(event);
            // Shouldn't throw or do anything
        });

        test("parses valid JSON file and calls parseAtlasData", () => {
            let readerInstance;
            global.FileReader = class {
                constructor() {
                    readerInstance = this;
                    this.onload = null;
                }
                readAsText(file) {
                    this.onload({
                        target: { result: JSON.stringify({ entities: [] }) }
                    });
                }
            };

            const parseMock = mock();
            loader.parseAtlasData = parseMock;

            const file = new File(["{}"], "test.json", { type: "application/json" });
            const event = { target: { files: [file] } };

            loader.loadFromJSON(event);

            expect(parseMock).toHaveBeenCalled();
            expect(parseMock.mock.calls[0][0]).toEqual({ entities: [] });
        });

        test("shows error message if JSON is invalid", () => {
            let readerInstance;
            global.FileReader = class {
                constructor() {
                    readerInstance = this;
                    this.onload = null;
                }
                readAsText(file) {
                    this.onload({
                        target: { result: "invalid json string" }
                    });
                }
            };

            const file = new File(["invalid json string"], "test.json", { type: "application/json" });
            const event = { target: { files: [file] } };

            loader.loadFromJSON(event);

            expect(console.error).toHaveBeenCalled();
            expect(mockApp.showMessage).toHaveBeenCalledWith("Failed to load atlas file. Invalid JSON.");
        });
    });

    describe("parseAtlasData", () => {
        test("handles valid JSON string", () => {
            const validJsonString = JSON.stringify({ entities: [] });
            loader.parseAtlasData(validJsonString);

            expect(mockApp.entities).toEqual([]);
            expect(mockApp.updateEntities).toHaveBeenCalled();
            expect(mockApp.render).toHaveBeenCalled();
        });

        test("returns early and logs error if JSON string is invalid", () => {
            const invalidJsonString = "invalid json";
            loader.parseAtlasData(invalidJsonString);

            expect(console.error).toHaveBeenCalledWith("Invalid JSON string:", expect.anything());
            expect(mockApp.updateEntities).not.toHaveBeenCalled();
        });

        test("returns early and logs error if 'entities' array is missing", () => {
            const invalidJson = { notEntities: [] };
            loader.parseAtlasData(invalidJson);

            expect(console.error).toHaveBeenCalledWith("Invalid atlas format: 'entities' array missing");
            expect(mockApp.updateEntities).not.toHaveBeenCalled();
        });

        test("returns early and logs error if 'entities' is not an array", () => {
            const invalidJson = { entities: "not an array" };
            loader.parseAtlasData(invalidJson);

            expect(console.error).toHaveBeenCalledWith("Invalid atlas format: 'entities' array missing");
            expect(mockApp.updateEntities).not.toHaveBeenCalled();
        });

        test("successfully parses basic valid atlas data", () => {
            const validJson = {
                entities: [
                    { id: "1", name: "Entity 1", domain: "political" }
                ]
            };

            // Add some existing state to verify it gets cleared
            mockApp.entities = [{ id: "old" }];
            mockApp.connections = [{ id: "old_conn" }];
            mockApp.selectedEntityId = "old";
            mockApp.hoveredEntityId = "old";

            loader.parseAtlasData(validJson);

            expect(mockApp.entities.length).toBe(1);
            expect(mockApp.entities[0]).toBeInstanceOf(HistoricalEntity);
            expect(mockApp.entities[0].id).toBe("1");
            expect(mockApp.entities[0].name).toBe("Entity 1");

            // Verifying state clears
            expect(mockApp.connections).toEqual([]);
            expect(mockApp.selectedEntityId).toBeNull();
            expect(mockApp.hoveredEntityId).toBeNull();

            // Verification calls
            expect(mockApp.updateEntities).toHaveBeenCalled();
            expect(mockApp.layerManager.render).toHaveBeenCalled();
            expect(mockApp.render).toHaveBeenCalled();
            expect(mockApp.registry.render).toHaveBeenCalled();
        });

        test("restores metadata and layers if present", () => {
            const validJson = {
                meta: { name: "Test Atlas", author: "Tester" },
                layers: [{ id: "layer1", name: "Layer 1" }],
                entities: []
            };

            loader.parseAtlasData(validJson);

            expect(mockApp.atlasMeta).toEqual(validJson.meta);
            expect(mockApp.layers).toEqual(validJson.layers);
        });

        test("restores connections if present", () => {
            const validJson = {
                entities: [],
                connections: [{ source: "1", target: "2" }]
            };

            loader.parseAtlasData(validJson);

            expect(mockApp.connections).toEqual(validJson.connections);
        });

        test("works without optional UI components (layerManager, registry)", () => {
            // Remove optional components
            delete mockApp.layerManager;
            delete mockApp.registry;

            const validJson = { entities: [] };

            // Should not throw
            expect(() => loader.parseAtlasData(validJson)).not.toThrow();

            expect(mockApp.updateEntities).toHaveBeenCalled();
            expect(mockApp.render).toHaveBeenCalled();
        });
    });
});
