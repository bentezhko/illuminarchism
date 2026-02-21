import { expect, test, describe, beforeEach } from "bun:test";
import { Quadtree } from "./SpatialIndex.js";

describe("Quadtree", () => {
    let tree;
    const bounds = { x: 0, y: 0, w: 100, h: 100 };
    const capacity = 4;
    const maxDepth = 4;

    beforeEach(() => {
        tree = new Quadtree(bounds, capacity, maxDepth);
    });

    test("initializes correctly", () => {
        expect(tree.bounds).toEqual(bounds);
        expect(tree.capacity).toBe(capacity);
        expect(tree.maxDepth).toBe(maxDepth);
        expect(tree.objects.length).toBe(0);
        expect(tree.nodes.length).toBe(0);
        expect(tree.divided).toBe(false);
    });

    test("returns empty array for empty tree", () => {
        expect(tree.retrieve(bounds)).toEqual([]);
    });

    test("inserts object into root when empty", () => {
        const obj = { x: 10, y: 10, w: 10, h: 10, id: 1 };
        tree.insert(obj);
        expect(tree.objects.length).toBe(1);
        expect(tree.objects[0]).toBe(obj);
    });

    test("subdivides when capacity exceeded", () => {
        for (let i = 0; i < capacity + 1; i++) {
            tree.insert({ x: 10, y: 10, w: 1, h: 1, id: i }); // All in same quadrant (TL)
        }
        expect(tree.divided).toBe(true);
        expect(tree.nodes.length).toBe(4);
        // Objects should be moved to children
        expect(tree.objects.length).toBe(0);

        // Verify all objects are still retrievable
        const retrieved = tree.retrieve({ x: 0, y: 0, w: 50, h: 50 });
        expect(retrieved.length).toBe(capacity + 1);

        // Note: they might have caused recursive subdivision in the child node,
        // so we don't strictly check nodes[1].objects.length.
    });

    test("handles recursive subdivision and respects maxDepth", () => {
        // Max depth 1
        const shallowTree = new Quadtree(bounds, 1, 1);

        shallowTree.insert({ x: 10, y: 10, w: 1, h: 1, id: 1 });
        shallowTree.insert({ x: 10, y: 10, w: 1, h: 1, id: 2 }); // Should trigger split of root

        expect(shallowTree.divided).toBe(true);

        // Now insert more into same child. Child is depth 1 (maxDepth).
        // It should NOT split further.
        shallowTree.insert({ x: 10, y: 10, w: 1, h: 1, id: 3 });

        // Access child (TL)
        const child = shallowTree.nodes[1];
        expect(child.depth).toBe(1);
        expect(child.divided).toBe(false); // Cannot divide because depth == maxDepth
        expect(child.objects.length).toBe(3); // All 3 stored here
    });

    test("distributes objects correctly upon subdivision", () => {
        // TR: 60, 10
        // TL: 10, 10
        // BL: 10, 60
        // BR: 60, 60
        const objects = [
            { x: 60, y: 10, w: 10, h: 10, id: 'TR' },
            { x: 10, y: 10, w: 10, h: 10, id: 'TL' },
            { x: 10, y: 60, w: 10, h: 10, id: 'BL' },
            { x: 60, y: 60, w: 10, h: 10, id: 'BR' },
            { x: 10, y: 10, w: 1, h: 1, id: 'TL2' } // Trigger split
        ];

        for (const obj of objects) {
            tree.insert(obj);
        }

        expect(tree.divided).toBe(true);
        expect(tree.objects.length).toBe(0); // All fit in quadrants

        // Check each quadrant
        expect(tree.nodes[0].objects.some(o => o.id === 'TR')).toBe(true);
        expect(tree.nodes[1].objects.some(o => o.id === 'TL')).toBe(true);
        expect(tree.nodes[2].objects.some(o => o.id === 'BL')).toBe(true);
        expect(tree.nodes[3].objects.some(o => o.id === 'BR')).toBe(true);
    });

    test("keeps objects in parent if they overlap boundaries", () => {
        // Object straddling TL and TR (x=45, w=10 -> 45 to 55; center X is 50)
        const straddler = { x: 45, y: 10, w: 10, h: 10, id: 'overlap' };

        // Fill tree to force subdivision
        for (let i = 0; i < capacity; i++) {
            tree.insert({ x: 10, y: 10, w: 1, h: 1, id: i });
        }
        tree.insert(straddler);

        expect(tree.divided).toBe(true);
        // The straddler should be in the root objects array because it doesn't fit in any child
        expect(tree.objects).toContain(straddler);
        // The other objects should be in children (TL)
        expect(tree.nodes[1].objects.length).toBe(capacity);
    });

    test("handles objects strictly outside root bounds", () => {
        // Root is 0,0,100,100
        const outlier = { x: 200, y: 200, w: 10, h: 10, id: 'outlier' };
        tree.insert(outlier);

        // Should be accepted at root level (depth 0)
        expect(tree.objects).toContain(outlier);

        // Force subdivision
        for (let i = 0; i < capacity; i++) {
            tree.insert({ x: 10, y: 10, w: 1, h: 1, id: i });
        }

        // Outlier should still be in root objects because children (covering 0-100) will reject it
        expect(tree.divided).toBe(true);
        expect(tree.objects).toContain(outlier);
        // Children should not have outlier
        expect(tree.nodes.some(n => n.objects.includes(outlier))).toBe(false);
    });

    test("rejects objects strictly outside child bounds (depth > 0)", () => {
        // This tests the specific line: if (!this.contains(this.bounds, obj) && this.depth > 0)

        // Force split first
        for (let i = 0; i < capacity + 1; i++) {
            tree.insert({ x: 10, y: 10, w: 1, h: 1, id: i });
        }

        const outlier = { x: 200, y: 200, w: 10, h: 10, id: 'outlier' };

        // Try to insert directly into a child (simulating recursion)
        // Note: we can access child nodes directly for testing
        const result = tree.nodes[0].insert(outlier); // TR node (50,0,50,50)

        expect(result).toBe(false);
        expect(tree.nodes[0].objects).not.toContain(outlier);
    });

    test("retrieves colliding objects", () => {
        const obj1 = { x: 10, y: 10, w: 10, h: 10, id: 1 };
        const obj2 = { x: 80, y: 80, w: 10, h: 10, id: 2 };
        tree.insert(obj1);
        tree.insert(obj2);

        // Retrieve area covering obj1
        const results1 = tree.retrieve({ x: 0, y: 0, w: 20, h: 20 });
        expect(results1).toContain(obj1);
        expect(results1).not.toContain(obj2);

        // Retrieve area covering obj2
        const results2 = tree.retrieve({ x: 70, y: 70, w: 30, h: 30 });
        expect(results2).toContain(obj2);
        expect(results2).not.toContain(obj1);

        // Retrieve area covering both
        const results3 = tree.retrieve({ x: 0, y: 0, w: 100, h: 100 });
        expect(results3).toContain(obj1);
        expect(results3).toContain(obj2);
    });

    test("retrieves outlier objects stored in root", () => {
        const outlier = { x: 200, y: 200, w: 10, h: 10, id: 'outlier' };
        tree.insert(outlier);

        // Force split to ensure root objects are checked even if divided
        for (let i = 0; i < capacity + 1; i++) {
            tree.insert({ x: 10, y: 10, w: 1, h: 1, id: i });
        }
        expect(tree.divided).toBe(true);

        const res = tree.retrieve({ x: 190, y: 190, w: 30, h: 30 });
        expect(res).toContain(outlier);
    });

    test("clears the tree", () => {
        tree.insert({ x: 10, y: 10, w: 10, h: 10 });
        tree.subdivide();

        tree.clear();

        expect(tree.objects.length).toBe(0);
        expect(tree.nodes.length).toBe(0);
        expect(tree.divided).toBe(false);
    });
});
