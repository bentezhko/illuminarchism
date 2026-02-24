import { describe, test, expect, beforeEach, afterEach, jest } from "bun:test";

// --- MOCK DOM ---
const mockElements = new Map();
const listeners = new Map();

global.document = {
    getElementById: (id) => mockElements.get(id) || null,
    createElement: (tag) => {
        const el = {
            tagName: tag.toUpperCase(),
            style: {},
            classList: {
                add: () => {},
                remove: () => {},
                toggle: () => {}
            },
            children: [],
            appendChild: (child) => {
                el.children.push(child);
            },
            addEventListener: () => {},
            dataset: {},
            setAttribute: () => {},
            innerHTML: '',
            textContent: ''
        };
        // Special case for SVG
        if (tag.includes(':')) {
             el.setAttribute = (k,v) => el[k] = v;
        }
        return el;
    },
    createElementNS: (ns, tag) => global.document.createElement(tag),
    createTextNode: (text) => ({
        nodeType: 3,
        textContent: text,
        get innerText() { return this.textContent; }
    }),
    body: {
        appendChild: (el) => {
            if (el.id) mockElements.set(el.id, el);
        },
        style: {}
    },
    addEventListener: (evt, cb) => {
        if (!listeners.has(evt)) listeners.set(evt, []);
        listeners.get(evt).push(cb);
    },
    removeEventListener: (evt, cb) => {
        if (!listeners.has(evt)) return;
        const arr = listeners.get(evt);
        const idx = arr.indexOf(cb);
        if (idx !== -1) arr.splice(idx, 1);
    },
    dispatchEvent: (evt) => {
         const handlers = listeners.get(evt.type);
         if (handlers) handlers.forEach(h => h(evt));
    }
};

global.window = {
    requestAnimationFrame: (cb) => {
        cb(); // Synchronous execution for tests
        return 1;
    },
    cancelAnimationFrame: (id) => {}
};
global.requestAnimationFrame = global.window.requestAnimationFrame;
global.cancelAnimationFrame = global.window.cancelAnimationFrame;

// Import AFTER mocking
import Timeline from "./Timeline.js";

// Helper to create mock elements
const createMockElement = (id) => {
    const el = {
        id,
        style: {},
        classList: { add:()=>{}, remove:()=>{} },
        addEventListener: (evt, cb) => {
             el._listeners = el._listeners || {};
             if(!el._listeners[evt]) el._listeners[evt] = [];
             el._listeners[evt].push(cb);
        },
        dispatchEvent: (evt) => {
             if(el._listeners && el._listeners[evt.type]) {
                 el._listeners[evt.type].forEach(h => h(evt));
             }
        },
        getBoundingClientRect: () => ({ left:0, top:0, width:1000, height:50, right:1000, bottom:50 }),
        closest: () => null,
        innerHTML: '',
        textContent: '',
        children: [],
        appendChild: (child) => {
             el.children.push(child);
        }
    };
    mockElements.set(id, el);
    return el;
};

// Mock App
const mockApp = {
    currentYear: 1000,
    formatYear: (y) => `${y} AD`,
    updateEntities: () => {},
    render: () => {},
    entitiesById: new Map(),
    entities: [],
    ontologyTaxonomy: {},
    connections: [],
    currentView: 'timeline',
    getConnectionYears: (c) => ({fromYear:c.fromYear, toYear:c.toYear}),
    isConnectionValid: () => true
};

describe("Timeline", () => {
    let timeline;

    beforeEach(() => {
        mockElements.clear();
        listeners.clear();

        createMockElement('year-display');
        createMockElement('btn-play');
        createMockElement('timeline-ui-track');
        createMockElement('ui-handle-start');
        createMockElement('ui-handle-end');
        createMockElement('label-start');
        createMockElement('label-end');
        createMockElement('ui-playhead');
        createMockElement('ui-ticks');
        createMockElement('keyframe-notches');
        createMockElement('view-timeline');
        createMockElement('btn-timeline-link'); // Added because Timeline checks for it

        timeline = new Timeline(mockApp);
    });

    test("initializes correctly", () => {
        expect(timeline.epochStartYear).toBe(-1000);
        expect(timeline.epochEndYear).toBe(2025);
        expect(timeline.trackContainer).toBeTruthy();
    });

    test("setYear updates playhead position", () => {
        timeline.setYear(1000);

        const playhead = mockElements.get('ui-playhead');
        expect(playhead.style.left).toContain('%');

        const pct = parseFloat(playhead.style.left);
        expect(pct).toBeCloseTo(66.11, 1);

        const display = mockElements.get('year-display');
        expect(display.innerHTML).toBe("1000 AD");
    });

    test("dragging start handle updates epochStartYear", () => {
        const handle = mockElements.get('ui-handle-start');
        handle.dispatchEvent({ type: 'mousedown', clientX: 0, preventDefault: () => {} });

        expect(timeline.isDragging).toBe(true);
        expect(timeline.dragTarget).toBe('start');

        document.dispatchEvent({ type: 'mousemove', clientX: 100 });

        expect(timeline.epochStartYear).toBe(-697);

        const label = mockElements.get('label-start');
        expect(label.children && label.children.length > 0).toBe(true);
        // Find all text nodes
        const textNodes = label.children.filter(c => c.nodeType === 3);
        const lastTextNode = textNodes[textNodes.length - 1];
        // Note: _safeFormatYear logic (-697 BC) might differ from mockApp.formatYear (-697 AD) if logic duplicated
        // Timeline.js uses _safeFormatYear now
        expect(lastTextNode.textContent).toContain("697 BC");
    });
});
