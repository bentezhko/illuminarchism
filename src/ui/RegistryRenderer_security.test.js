import { test, expect, mock } from "bun:test";

// Mock DOM
const capturedElements = [];
global.document = {
    getElementById: () => ({
        innerHTML: '',
        appendChild: () => {}
    }),
    createElement: (tag) => {
        const el = {
            tagName: tag.toUpperCase(),
            style: {},
            classList: { add: () => {}, remove: () => {} },
            appendChild: (child) => {
                if (!el.children) el.children = [];
                el.children.push(child);
            },
            set textContent(val) { this._textContent = val; },
            get textContent() { return this._textContent; },
            _innerHTML: '',
            set innerHTML(val) { this._innerHTML = val; },
            get innerHTML() { return this._innerHTML; }
        };
        capturedElements.push(el);
        return el;
    }
};

// Mock Ontology
mock.module('../core/Ontology.js', () => {
    return {
        getTypology: () => ({}),
        POLITICAL_SUBTYPES: {
            MALICIOUS: {
                label: 'Malicious',
                abbr: 'MAL',
                examples: '<img src=x onerror=alert(1)>'
            }
        },
        LINGUISTIC_SUBTYPES: {},
        RELIGIOUS_SUBTYPES: {},
        GEOGRAPHIC_SUBTYPES: {}
    };
});

import RegistryRenderer from "./RegistryRenderer.js";

test("RegistryRenderer vulnerability check: unescaped examples", () => {
    const appMock = {
        ontologyTaxonomy: {
            'political': {
                domain: { name: 'Political', abbr: 'POL' },
                types: [{ value: 'state', label: 'State' }]
            }
        }
    };

    const renderer = new RegistryRenderer(appMock, 'registry-content');
    renderer.render();

    // Find the div containing the examples
    const exDiv = capturedElements.find(el => el._innerHTML && el._innerHTML.includes('Ex:'));

    expect(exDiv).toBeDefined();
    // If vulnerable, it will contain the raw tag
    // If fixed, it should be escaped
    expect(exDiv.innerHTML).not.toContain("<img src=x onerror=alert(1)>");
    expect(exDiv.innerHTML).toContain("&lt;img src=x onerror=alert(1)&gt;");
});
