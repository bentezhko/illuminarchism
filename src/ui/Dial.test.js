import { describe, test, expect, beforeEach } from "bun:test";
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
    let domainEl, formEl, rankEl;

    beforeEach(() => {
        // Mock DOM elements
        domainEl = { textContent: '', parentElement: { style: {} } };
        formEl = { textContent: '', parentElement: { style: {} } };
        rankEl = { textContent: '', parentElement: { style: {} } };

        const elements = {
            'val-domain': domainEl,
            'val-form': formEl,
            'val-rank': rankEl
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
    });

    test("updateDisplay (default) shows abbreviations", () => {
        dial.updateDisplay();
        expect(domainEl.textContent).toBe("POL");
        expect(formEl.textContent).toBe("NAT");
        // Check rank if Ontology.js is working as expected
        // 'sovereign' is a valid subtype for 'nation-state'
        // But let's check if rankEl has content
        expect(rankEl.textContent).toBe("SOV");

    test("setHover('domain') shows full name and hides others", () => {
        dial.setHover('domain');
        expect(domainEl.textContent).toBe("Political & Administrative");
        expect(formEl.textContent).toBe("");
        expect(rankEl.textContent).toBe("");
    });

    test("setHover('form') shows full label and hides others", () => {
        dial.setHover('form');
        expect(domainEl.textContent).toBe("");
        expect(formEl.textContent).toBe("Nation-State");
        expect(rankEl.textContent).toBe("");
    });

    test("setHover('rank') shows full label and hides others", () => {
        // Assuming 'sovereign' -> 'Sovereign Unit' (label)
        dial.setHover('rank');
        expect(domainEl.textContent).toBe("");
        expect(formEl.textContent).toBe("");
        expect(rankEl.textContent).toBe("Sovereign Unit");
        expect(rankEl.textContent).not.toBe("SOV"); // Abbr for Sovereign
    });

    test("setHover(null) restores abbreviations", () => {
        dial.setHover('domain'); // Set to full name first
        dial.setHover(null);     // Restore
        expect(domainEl.textContent).toBe("POL");
        expect(formEl.textContent).toBe("NAT");
    });
});
