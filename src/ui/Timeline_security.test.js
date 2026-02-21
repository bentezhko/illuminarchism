import { test, expect, beforeAll } from "bun:test";

// Mock DOM
global.document = {
    getElementById: () => ({
        addEventListener: () => {},
        style: {},
        classList: { add: () => {}, remove: () => {}, contains: () => false },
        value: "2000",
        min: "0",
        max: "3000"
    }),
    createElement: (tag) => {
        if (tag === 'div') {
            return {
                style: {},
                classList: { add: () => {}, remove: () => {}, toggle: () => {} },
                appendChild: () => {},
                addEventListener: () => {},
                dataset: {},
                getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 10 }),
                set innerHTML(val) { this._innerHTML = val; },
                get innerHTML() { return this._innerHTML; }
            };
        }
        return {
             setAttribute: () => {},
             style: {},
             appendChild: () => {},
             addEventListener: () => {} // Add this for svg elements
        };
    },
    createElementNS: (ns, tag) => ({
        setAttribute: () => {},
        style: {},
        appendChild: () => {},
        addEventListener: () => {}
    }),
    body: {
        appendChild: () => {}
    }
};

global.window = {};

import Timeline from "./Timeline.js";

test("Timeline.showLinkEditor vulnerability check", () => {
    const appMock = {
        currentYear: 2000,
        getConnectionYears: (c) => ({ fromYear: c.fromYear, toYear: c.toYear }),
        formatYear: (y) => y,
        render: () => {},
        renderView: () => {}
    };

    const timeline = new Timeline(appMock);

    // Mock linkInfo element to capture innerHTML
    let capturedHTML = "";
    timeline.linkInfo = {
        style: {},
        classList: { add: () => {}, remove: () => {} },
        set innerHTML(val) { capturedHTML = val; }
    };

    const mockEvent = { clientX: 0, clientY: 0 };
    // Malicious payload in year
    const maliciousYear = '2000" onclick="alert(1)';
    const mockConn = { fromYear: maliciousYear, toYear: maliciousYear };

    // Malicious payload in entity names (already fixed apparently)
    const mockFromEnt = { name: "<img src=x onerror=alert(1)>", validRange: { start: 0, end: 100 } };
    const mockToEnt = { name: "NormalEntity", validRange: { start: 0, end: 100 } };

    timeline.showLinkEditor(mockEvent, mockConn, mockFromEnt, mockToEnt);

    // Check for Entity Name XSS (Should be safe)
    expect(capturedHTML).not.toContain("<img src=x onerror=alert(1)>");
    expect(capturedHTML).toContain("&lt;img src=x onerror=alert(1)&gt;");

    // Check for Year XSS
    // value="${escapeHTML(currentYear)}" -> value="2000&quot; onclick=&quot;alert(1)&quot;"
    // This ensures it is contained within the attribute value and not executed as an attribute
    expect(capturedHTML).not.toContain('value="2000" onclick="alert(1)"');
    expect(capturedHTML).toContain('value="2000&quot; onclick=&quot;alert(1)"');
});
