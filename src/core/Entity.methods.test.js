import { expect, test, describe, spyOn, afterEach, jest } from "bun:test";
import HistoricalEntity from "./Entity.js";

describe("HistoricalEntity Methods", () => {
    let entity;

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe("Attribute Management", () => {
        test("setAttribute should update attributes and modified time", () => {
            entity = new HistoricalEntity("ent-1", "Test Entity", { domain: "political" });
            const initialModified = entity.transactionTime.modified;

            const now = Date.now() + 1000;
            spyOn(Date, 'now').mockReturnValue(now);

            entity.setAttribute("OCM:430", "Value");

            expect(entity.attributes["OCM:430"]).toBe("Value");
            expect(entity.transactionTime.modified).toBe(now);
            expect(entity.transactionTime.modified).toBeGreaterThan(initialModified);
        });

        test("getAttribute should retrieve the correct value", () => {
            entity = new HistoricalEntity("ent-1", "Test Entity", {
                attributes: { "key1": "val1" }
            });
            expect(entity.getAttribute("key1")).toBe("val1");
            expect(entity.getAttribute("nonexistent")).toBeUndefined();
        });

        test("removeAttribute should delete attribute and update modified time", () => {
            entity = new HistoricalEntity("ent-1", "Test Entity", {
                attributes: { "key1": "val1" }
            });
            const initialModified = entity.transactionTime.modified;
            const now = Date.now() + 1000;
            spyOn(Date, 'now').mockReturnValue(now);

            entity.removeAttribute("key1");

            expect(entity.attributes["key1"]).toBeUndefined();
            expect(entity.transactionTime.modified).toBe(now);
        });

        test("getAttributesList should return list of key-value objects", () => {
            entity = new HistoricalEntity("ent-1", "Test Entity", {
                attributes: { "a": 1, "b": 2 }
            });
            const list = entity.getAttributesList();
            expect(list).toHaveLength(2);
            expect(list).toContainEqual({ key: "a", value: 1 });
            expect(list).toContainEqual({ key: "b", value: 2 });
        });
    });

    describe("Hierarchy Management", () => {
        test("addChild should add child ID and update modified time", () => {
            entity = new HistoricalEntity("parent", "Parent", { domain: "political" });
            const initialModified = entity.transactionTime.modified;
            const now = Date.now() + 1000;
            const dateSpy = spyOn(Date, 'now').mockReturnValue(now);

            entity.addChild("child-1");

            expect(entity.children).toContain("child-1");
            expect(entity.transactionTime.modified).toBe(now);

            // Adding same child again should not duplicate or update time
            const later = now + 1000;
            dateSpy.mockReturnValue(later);
            entity.addChild("child-1");
            expect(entity.children).toHaveLength(1);
            expect(entity.transactionTime.modified).toBe(now); // Still old 'now'
        });

        test("removeChild should remove child ID and update modified time", () => {
            entity = new HistoricalEntity("parent", "Parent", {
                children: ["child-1", "child-2"]
            });
            const initialModified = entity.transactionTime.modified;
            const now = Date.now() + 1000;
            spyOn(Date, 'now').mockReturnValue(now);

            entity.removeChild("child-1");

            expect(entity.children).not.toContain("child-1");
            expect(entity.children).toContain("child-2");
            expect(entity.transactionTime.modified).toBe(now);

            // Removing non-existent child should not update time
            const later = now + 1000;
            spyOn(Date, 'now').mockReturnValue(later);
            entity.removeChild("nonexistent");
            expect(entity.transactionTime.modified).toBe(now);
        });
    });

    describe("Derived Properties and UI", () => {
        test("updateDerivedProperties should sync legacy props", () => {
            entity = new HistoricalEntity("ent", "Test", {
                domain: "political",
                typology: "nation-state"
            });

            // Initial (derived in constructor)
            expect(entity.category).toBe("political");
            expect(entity.type).toBe("polity");

            // Change domain and typology
            entity.domain = "religious";
            entity.typology = "sect";
            entity.updateDerivedProperties();

            expect(entity.category).toBe("faith");
            expect(entity.type).toBe("sect");
        });

        test("getDisplayInfo should return correct labels", () => {
            entity = new HistoricalEntity("ent", "Test", {
                domain: "political",
                typology: "empire",
                boundaryConfidence: 0.85
            });

            const info = entity.getDisplayInfo();
            expect(info.domainLabel).toBe("Political & Administrative");
            expect(info.domainAbbr).toBe("POL");
            expect(info.typologyLabel).toBe("Empire");
            expect(info.confidencePercent).toBe(85);
        });
    });
});
