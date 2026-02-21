import { expect, test, describe } from "bun:test";
import { escapeHTML } from "./math.js";

describe("escapeHTML", () => {
    test("escapes basic HTML entities", () => {
        expect(escapeHTML("<script>alert(1)</script>")).toBe("&lt;script&gt;alert(1)&lt;/script&gt;");
        expect(escapeHTML('attr="value"')).toBe("attr=&quot;value&quot;");
        expect(escapeHTML("'single'")).toBe("&#39;single&#39;");
        expect(escapeHTML("a & b")).toBe("a &amp; b");
    });

    test("handles null or undefined", () => {
        expect(escapeHTML(null)).toBe("");
        expect(escapeHTML(undefined)).toBe("");
    });

    test("handles non-string values", () => {
        expect(escapeHTML(123)).toBe("123");
        expect(escapeHTML(0)).toBe("0");
        expect(escapeHTML(true)).toBe("true");
        expect(escapeHTML(false)).toBe("false");
    });

    test("escapes complex attack vectors", () => {
        const payload = '<img src=x onerror="alert(\'XSS\')">';
        const expected = "&lt;img src=x onerror=&quot;alert(&#39;XSS&#39;)&quot;&gt;";
        expect(escapeHTML(payload)).toBe(expected);
    });
});
