
import { describe, test, expect, beforeEach, spyOn } from "bun:test";
import Dial from "./Dial.js";

// Mock minimal DOM if not present
if (typeof document === 'undefined') {
    global.document = {
        getElementById: () => null
    };
}

describe("Dial", () => {
    let app;
    let dial;
    let domainEl, formEl, rankEl, dialEl;

    beforeEach(() => {
        // Mock DOM elements
        domainEl = { textContent: '', parentElement: { style: {} } };
        formEl = { textContent: '', parentElement: { style: {} } };
        rankEl = { textContent: '', parentElement: { style: {} } };
        dialEl = { title: "Ontology: Domain - Form - Rank" };

        const elements = {
            'val-domain': domainEl,
            'val-form': formEl,
            'val-rank': rankEl,
            'entity-dial': dialEl
        };

        // Mock document.getElementById
        global.document.getElementById = (id) => elements[id];

        // Mock App State
        app = {
            drawDomain: 'political',
            drawTypology: 'nation-state',
            drawSubtype: 'sovereign',
            ontologyTaxonomy: {
                'political': {
                    domain: { name: 'Political & Administrative', abbr: 'POL' },
                    types: [
                        { value: 'nation-state', label: 'Nation-State', abbr: 'NAT' },
                        { value: 'empire', label: 'Empire', abbr: 'EMP' }
                    ]
                }
            }
        };

        dial = new Dial(app);
        dial.updateDisplay(); // Initialize display
    });

    test("updateDisplay always shows abbreviations on wheels", () => {
        dial.updateDisplay();
        expect(domainEl.textContent).toBe("POL");
        expect(formEl.textContent).toBe("NAT");
        // 'sovereign' is a valid subtype for 'nation-state'
        expect(rankEl.textContent).not.toBe("");
    });

    test("setHover('domain') updates tooltip title", () => {
        dial.setHover('domain');
        expect(dialEl.title).toBe("Political & Administrative");
        // Wheels should still show abbreviations
        expect(domainEl.textContent).toBe("POL");
    });

    test("setHover('form') updates tooltip title", () => {
        dial.setHover('form');
        expect(dialEl.title).toBe("Nation-State");
        // Wheels should still show abbreviations
        expect(formEl.textContent).toBe("NAT");
    });

    test("setHover('rank') updates tooltip title", () => {
        // Assuming 'sovereign' -> 'Sovereign Unit' (label) or similar from Ontology
        dial.setHover('rank');
        // We don't know the exact label from the mock app state unless we mock _getSubtypesForTypology return or use real ontology logic
        // But since Dial imports Ontology.js, it uses real logic for subtypes if not mocked.
        // Let's just check it's not empty and not the default
        expect(dialEl.title).not.toBe("");
        expect(dialEl.title).not.toBe("Ontology: Domain - Form - Rank");
        // Wheels should still show abbreviations
        expect(rankEl.textContent).not.toBe("");
    });

    test("setHover(null) restores default tooltip title", () => {
        dial.setHover('domain'); // Set to something else first
        expect(dialEl.title).toBe("Political & Administrative");

        dial.setHover(null);     // Restore
        expect(dialEl.title).toBe("Ontology: Domain - Form - Rank");
    });
});
