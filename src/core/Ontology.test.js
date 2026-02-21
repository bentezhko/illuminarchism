import { expect, test, describe } from "bun:test";
import { validateEntity } from "./Ontology.js";

describe("validateEntity", () => {
    test("should validate a correct entity", () => {
        const entity = {
            domain: "political",
            typology: "archaic-state"
        };
        const result = validateEntity(entity);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    test("should validate an entity with correct OCM attributes", () => {
        const entity = {
            domain: "political",
            typology: "archaic-state",
            attributes: {
                "OCM:640": "State"
            }
        };
        const result = validateEntity(entity);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    test("should return error for invalid domain", () => {
        const entity = {
            domain: "invalid-domain",
            typology: "archaic-state"
        };
        const result = validateEntity(entity);
        expect(result.valid).toBe(false);
        expect(result.errors).toEqual([
            "Invalid domain: invalid-domain",
            "Invalid typology 'archaic-state' for domain 'invalid-domain'"
        ]);
    });

    test("should return error for invalid typology in valid domain", () => {
        const entity = {
            domain: "political",
            typology: "invalid-typology"
        };
        const result = validateEntity(entity);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain("Invalid typology 'invalid-typology' for domain 'political'");
    });

    test("should return error for unknown OCM code", () => {
        const entity = {
            domain: "political",
            typology: "archaic-state",
            attributes: {
                "OCM:999": "Unknown"
            }
        };
        const result = validateEntity(entity);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain("Unknown OCM code: OCM:999");
    });

    test("should handle missing domain or typology", () => {
        const entity = {};
        const result = validateEntity(entity);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
    });

    test("should return error when entity is null", () => {
        const result = validateEntity(null);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain("Entity is null or undefined");
    });

    test("should return error when entity is undefined", () => {
        const result = validateEntity(undefined);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain("Entity is null or undefined");
    });

    test("should reject typology from incorrect domain", () => {
        const entity = {
            domain: "political",
            typology: "river" // river is a geographic typology
        };
        const result = validateEntity(entity);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain("Invalid typology 'river' for domain 'political'");
    });

    test("should allow valid non-OCM attributes", () => {
        const entity = {
            domain: "political",
            typology: "archaic-state",
            attributes: {
                "customField": "value",
                "population": 1000
            }
        };
        const result = validateEntity(entity);
        expect(result.valid).toBe(true);
    });

    test("should validate specific OCM codes", () => {
        const entity = {
            domain: "political",
            typology: "archaic-state",
            attributes: {
                "OCM:640": "State",
                "OCM:161": "Population"
            }
        };
        const result = validateEntity(entity);
        expect(result.valid).toBe(true);
    });

    test("should reject malformed OCM codes", () => {
        const entity = {
            domain: "political",
            typology: "archaic-state",
            attributes: {
                "OCM:": "Empty code",
                "OCM:ABC": "Invalid alpha code"
            }
        };
        const result = validateEntity(entity);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain("Unknown OCM code: OCM:");
        expect(result.errors).toContain("Unknown OCM code: OCM:ABC");
    });

    test("should handle null attributes", () => {
        const entity = {
            domain: "political",
            typology: "archaic-state",
            attributes: null
        };
        const result = validateEntity(entity);
        expect(result.valid).toBe(true);
    });
});
