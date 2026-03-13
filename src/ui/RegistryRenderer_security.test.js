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
            children: [],
            classList: { add: () => {}, remove: () => {} },
            appendChild: (child) => {
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
    },
    createTextNode: (text) => ({
        nodeType: 3,
        textContent: text
    })
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

test("RegistryRenderer vulnerability check: createTextNode for examples", () => {
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
    // It should have a text node child with the raw string
    const textNode = exDiv.children.find(child => child.nodeType === 3);
    expect(textNode).toBeDefined();
    expect(textNode.textContent).toBe('<img src=x onerror=alert(1)>');
});
