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

    test("handles high zoom scale with larger maxDepth", () => {
        // Simulate deep quadtree (maxDepth = 20)
        const deepTree = new Quadtree(bounds, 1, 20);
        deepTree.insert({ x: 10, y: 10, w: 0.001, h: 0.001, id: 1 });
        deepTree.insert({ x: 10, y: 10, w: 0.001, h: 0.001, id: 2 });
        // Should divide
        expect(deepTree.divided).toBe(true);
        // It splits recursively until the node's bounds are too small to completely contain the objects,
        // so it might stop before maxDepth if objects overlap the center point
        let node = deepTree;
        while (node && node.divided) {
            let nextNode = node.nodes.find(n => n.divided || n.objects.length > 0);
            if (!nextNode) break; // Objects are stranded in the current parent node
            node = nextNode;
        }
        expect(node.depth).toBeGreaterThan(10); // Check that it divides deeply
        expect(node.objects.length).toBe(2);
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

    describe("boundary conditions", () => {
        let fillerTL, fillerTR, fillerBL, fillerBR, fillerStraddle;

        beforeEach(() => {
            // Force subdivision to test boundary interactions between children.
            // Spread them across quadrants so children don't immediately subdivide again.
            fillerTL = { x: 10, y: 10, w: 1, h: 1, id: 'filler-tl' };
            fillerTR = { x: 80, y: 10, w: 1, h: 1, id: 'filler-tr' };
            fillerBL = { x: 10, y: 80, w: 1, h: 1, id: 'filler-bl' };
            fillerBR = { x: 80, y: 80, w: 1, h: 1, id: 'filler-br' };
            fillerStraddle = { x: 45, y: 45, w: 10, h: 10, id: 'filler-straddle' };

            tree.insert(fillerTL);
            tree.insert(fillerTR);
            tree.insert(fillerBL);
            tree.insert(fillerBR);
            tree.insert(fillerStraddle); // 5th object to trigger split
        });

        test("objects touching but not crossing the horizontal midpoint", () => {
            // Midpoint Y is 50.
            const touchingTL = { x: 10, y: 40, w: 10, h: 10, id: 'touching-tl' }; // Bottom edge is 50
            const touchingBL = { x: 10, y: 50, w: 10, h: 10, id: 'touching-bl' }; // Top edge is 50

            tree.insert(touchingTL);
            tree.insert(touchingBL);

            // touchingTL should be wholly in TL (node 1)
            expect(tree.nodes[1].objects).toContain(touchingTL);
            // touchingBL should be wholly in BL (node 2)
            expect(tree.nodes[2].objects).toContain(touchingBL);

            // Neither should be trapped in the parent as a straddler
            expect(tree.objects).not.toContain(touchingTL);
            expect(tree.objects).not.toContain(touchingBL);
        });

        test("objects touching but not crossing the vertical midpoint", () => {
            // Midpoint X is 50.
            const touchingTL = { x: 40, y: 10, w: 10, h: 10, id: 'touching-tl-x' }; // Right edge is 50
            const touchingTR = { x: 50, y: 10, w: 10, h: 10, id: 'touching-tr-x' }; // Left edge is 50

            tree.insert(touchingTL);
            tree.insert(touchingTR);

            // touchingTL should be wholly in TL (node 1)
            expect(tree.nodes[1].objects).toContain(touchingTL);
            // touchingTR should be wholly in TR (node 0)
            expect(tree.nodes[0].objects).toContain(touchingTR);

            // Neither should be trapped in the parent as a straddler
            expect(tree.objects).not.toContain(touchingTL);
            expect(tree.objects).not.toContain(touchingTR);
        });

        test("objects exactly on the intersection fall into the first matching quadrant due to inclusive bounds", () => {
            const exactIntersection = { x: 50, y: 50, w: 0, h: 0, id: 'intersection' };
            const crossingH = { x: 10, y: 45, w: 10, h: 10, id: 'crossing-h' }; // Y crosses 50
            const crossingV = { x: 45, y: 10, w: 10, h: 10, id: 'crossing-v' }; // X crosses 50

            tree.insert(exactIntersection);
            tree.insert(crossingH);
            tree.insert(crossingV);

            // Due to `contains` using `>=` and `<=`, an object at exactly (50, 50) is treated
            // as fitting completely inside the Top-Right (TR) node (bounds: x: 50-100, y: 0-50).
            expect(tree.nodes[0].objects).toContain(exactIntersection);

            // Objects crossing boundaries cannot fit entirely in any single quadrant
            // and must remain in the parent node as straddlers.
            expect(tree.objects).toContain(crossingH);
            expect(tree.objects).toContain(crossingV);
        });

        test("retrieval handles inclusive boundaries correctly", () => {
            // Setup objects that each sit firmly in one quadrant but touch the center intersection (50, 50)
            const objTL = { x: 40, y: 40, w: 10, h: 10, id: 'tl' };
            const objTR = { x: 50, y: 40, w: 10, h: 10, id: 'tr' };
            const objBL = { x: 40, y: 50, w: 10, h: 10, id: 'bl' };
            const objBR = { x: 50, y: 50, w: 10, h: 10, id: 'br' };

            tree.insert(objTL);
            tree.insert(objTR);
            tree.insert(objBL);
            tree.insert(objBR);

            // A search exactly at the intersection should retrieve all 4 objects
            // because `intersects` uses `>=` and `<=` equivalent logic (not strictly greater/less).
            // It should also retrieve the filler object that straddles the center.
            const centerSearch = tree.retrieve({ x: 50, y: 50, w: 0, h: 0 });
            const expectedCenter = [objTL, objTR, objBL, objBR, fillerStraddle];
            expect(centerSearch.length).toBe(expectedCenter.length);
            expect(centerSearch).toEqual(expect.arrayContaining(expectedCenter));

            // A search completely overlapping TL quadrant (0,0 to 50,50)
            const tlSearch = tree.retrieve({ x: 0, y: 0, w: 50, h: 50 });
            // This search should find all objects that touch the TL quadrant, including those on its boundaries,
            // the filler in the TL quadrant, and the straddling filler.
            const expectedTL = [objTL, objTR, objBL, objBR, fillerTL, fillerStraddle];
            expect(tlSearch.length).toBe(expectedTL.length);
            expect(tlSearch).toEqual(expect.arrayContaining(expectedTL));

            // A search strictly isolated from the boundary (0,0 to 10,10)
            const isolatedSearch = tree.retrieve({ x: 0, y: 0, w: 10, h: 10 });
            // This should only find the top-left filler object, which touches the (10,10) point.
            expect(isolatedSearch.length).toBe(1);
            expect(isolatedSearch).toContain(fillerTL);
        });
    });
});
