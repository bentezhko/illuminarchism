
import { describe, test, expect, beforeEach, afterEach, jest } from "bun:test";
import Timeline from "./Timeline.js";

// --- MOCK DOM ---
const mockElements = new Map();
const listeners = new Map();

// Helper to create mock elements
const createMockElement = (id, type='div') => {
    const el = {
        id,
        tagName: type.toUpperCase(),
        style: {},
        _className: '',
        get className() { return this._className; },
        set className(val) {
            this._className = val;
            this._classList = new Set(val.split(' ').filter(c => c));
        },
        _classList: new Set(),
        get classList() {
            return {
                add: (c) => this._classList.add(c),
                remove: (c) => this._classList.delete(c),
                toggle: (c) => {
                    if (this._classList.has(c)) this._classList.delete(c);
                    else this._classList.add(c);
                },
                contains: (c) => this._classList.has(c)
            };
        },
        children: [],
        appendChild: (child) => {
            child.parentElement = el;
            el.children.push(child);
        },
        addEventListener: (evt, cb) => {
             el._listeners = el._listeners || {};
             if(!el._listeners[evt]) el._listeners[evt] = [];
             el._listeners[evt].push(cb);
        },
        dispatchEvent: (evt) => {
             if (!evt.target) evt.target = el;
             if(el._listeners && el._listeners[evt.type]) {
                 el._listeners[evt.type].forEach(h => h(evt));
             }
        },
        getBoundingClientRect: () => ({ left:0, top:0, width:1000, height:50, right:1000, bottom:50 }),
        closest: (sel) => {
            if (sel === '.timeline-bar-track') return { getBoundingClientRect: () => ({ width: 1000 }) }; // Mock track
            return null;
        },
        dataset: {},
        setAttribute: (k, v) => { el[k] = v; },
        innerHTML: '',
        textContent: '',
        querySelector: () => null,
        querySelectorAll: () => []
    };
    if (id) mockElements.set(id, el);
    return el;
};

global.document = {
    getElementById: (id) => mockElements.get(id) || null,
    createElement: (tag) => createMockElement(null, tag),
    createElementNS: (ns, tag) => createMockElement(null, tag),
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
global.Number = Number; // Ensure global Number is available

// Mock Entity
const mockEntity = {
    id: 'ent1',
    name: 'Test Entity',
    domain: 'political',
    validRange: { start: 1000, end: 1100 },
    timeline: [],
    color: '#ff0000'
};

// Mock App
const mockApp = {
    currentYear: 1050,
    formatYear: (y) => `${y}`,
    updateEntities: () => {},
    render: () => {},
    entitiesById: new Map([['ent1', mockEntity]]),
    entities: [mockEntity],
    ontologyTaxonomy: { 'political': { domain: { name: 'Political' } } },
    connections: [],
    currentView: 'timeline',
    getConnectionYears: (c) => ({fromYear:c.fromYear, toYear:c.toYear}),
    isConnectionValid: () => true,
    selectEntity: () => {},
    showMessage: () => {},
    showConfirm: () => {},
    showContextMenu: () => {}
};

describe("Timeline Entity Dragging", () => {
    let timeline;

    beforeEach(() => {
        mockEntity.validRange = { start: 1000, end: 1100 }; // Reset
        mockElements.clear();
        listeners.clear();

        createMockElement('year-display');
        createMockElement('view-timeline');
        createMockElement('timeline-ui-track');
        createMockElement('ui-playhead');
        createMockElement('ui-ticks');
        createMockElement('label-start');
        createMockElement('label-end');
        createMockElement('btn-play');
        createMockElement('btn-timeline-link');
        createMockElement('keyframe-notches');

        // Setup initial timeline view container
        const viewContainer = mockElements.get('view-timeline');
        viewContainer.scrollHeight = 500;
        viewContainer.scrollTop = 0;

        timeline = new Timeline(mockApp);
        // Force epoch to known range for easy calculation
        timeline.epochStartYear = 0;
        timeline.epochEndYear = 2000; // 2000 years range
        // Track width mock is 1000px. So 2 years per pixel.
    });

    test("Dragging an entity bar updates its validRange", () => {
        timeline.renderView();

        // Find the bar element
        // In our mock, createElement returns an object. We need to find the one with dataset.id = 'ent1'
        // Since renderView appends to view-timeline, we can inspect mockElements or traverse.
        // But our mock createElement doesn't auto-register to mockElements unless ID is present.
        // We'll have to rely on traversing viewContainer's children.

        const viewContainer = mockElements.get('view-timeline');

        // Traverse to find the bar
        let bar = null;
        // view -> header, groups...
        // group -> header, content
        // content -> row
        // row -> label, track
        // track -> bar

        const findBar = (el) => {
            if (el.dataset && el.dataset.id === 'ent1') return el;
            for (const child of el.children) {
                const found = findBar(child);
                if (found) return found;
            }
            return null;
        };

        bar = findBar(viewContainer);
        expect(bar).toBeTruthy();

        // Initial state
        const initialStart = mockEntity.validRange.start; // 1000
        const initialEnd = mockEntity.validRange.end; // 1100

        // Simulate mousedown on bar
        // clientX = 0 doesn't matter much as we look at delta.
        // But let's say we click at x=500 (middle of track).
        bar.dispatchEvent({ type: 'mousedown', clientX: 500, preventDefault: () => {}, stopPropagation: () => {} });

        // Simulate mousemove by 50px to the right
        // 50px * 2 years/px = 100 years
        document.dispatchEvent({ type: 'mousemove', clientX: 550 });
        document.dispatchEvent({ type: 'mouseup' });

        // Expect range to shift by +100 years
        // 1000 -> 1100, 1100 -> 1200
        expect(mockEntity.validRange.start).toBe(initialStart + 100);
        expect(mockEntity.validRange.end).toBe(initialEnd + 100);
    });

    test("Dragging left handle updates start year only", () => {
        timeline.renderView();
        const viewContainer = mockElements.get('view-timeline');

        const findBar = (el) => {
            if (el.dataset && el.dataset.id === 'ent1') return el;
            for (const child of el.children) {
                const found = findBar(child);
                if (found) return found;
            }
            return null;
        };

        const bar = findBar(viewContainer);
        expect(bar).toBeTruthy();

        // Find left handle
        const handleL = bar.children.find(c => c.classList.contains('handle-l'));
        expect(handleL).toBeTruthy();

        const initialStart = mockEntity.validRange.start; // 1000
        const initialEnd = mockEntity.validRange.end; // 1100

        // Drag left handle 25px right (+50 years)
        handleL.dispatchEvent({ type: 'mousedown', clientX: 500, preventDefault: () => {}, stopPropagation: () => {} });
        document.dispatchEvent({ type: 'mousemove', clientX: 525 });
        document.dispatchEvent({ type: 'mouseup' });

        // Expect start to move +50, end to stay same
        // 1000 -> 1050
        expect(mockEntity.validRange.start).toBe(initialStart + 50);
        expect(mockEntity.validRange.end).toBe(initialEnd);
    });
});
