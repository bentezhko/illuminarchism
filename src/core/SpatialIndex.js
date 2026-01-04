/**
 * Quadtree Spatial Index
 * efficiently stores and retrieves entities based on 2D position/bounds.
 */

export class Quadtree {
    /**
     * @param {Object} bounds { x, y, w, h }
     * @param {number} capacity bucket size before split
     * @param {number} maxDepth maximum recursion depth
     */
    constructor(bounds, capacity = 10, maxDepth = 8, depth = 0) {
        this.bounds = bounds;
        this.capacity = capacity;
        this.maxDepth = maxDepth;
        this.depth = depth;
        this.objects = [];
        this.nodes = [];
        this.divided = false;
    }

    /**
     * Clear the quadtree
     */
    clear() {
        this.objects = [];
        for (let i = 0; i < this.nodes.length; i++) {
            if (this.nodes[i]) this.nodes[i].clear();
        }
        this.nodes = [];
        this.divided = false;
    }

    /**
     * Divide into 4 sub-quadrants
     */
    subdivide() {
        const x = this.bounds.x;
        const y = this.bounds.y;
        const w = this.bounds.w / 2;
        const h = this.bounds.h / 2;

        this.nodes[0] = new Quadtree({ x: x + w, y: y, w: w, h: h }, this.capacity, this.maxDepth, this.depth + 1); // TR
        this.nodes[1] = new Quadtree({ x: x, y: y, w: w, h: h }, this.capacity, this.maxDepth, this.depth + 1); // TL
        this.nodes[2] = new Quadtree({ x: x, y: y + h, w: w, h: h }, this.capacity, this.maxDepth, this.depth + 1); // BL
        this.nodes[3] = new Quadtree({ x: x + w, y: y + h, w: w, h: h }, this.capacity, this.maxDepth, this.depth + 1); // BR

        this.divided = true;

        // Re-distribute existing objects
        const oldObjects = this.objects;
        this.objects = [];
        for (const obj of oldObjects) {
            this.insert(obj);
        }
    }

    /**
     * Insert object { x, y, w, h, id, ... }
     */
    insert(obj) {
        if (!this.contains(this.bounds, obj) && this.depth > 0) {
            // Object is outside this node bounds (shouldn't happen if root is big enough or if we handle outliers)
            // But we'll ignore for safety if strictly outside, or maybe add to closest? 
            // For now, strict containment:
            return false;
        }

        if (this.divided) {
            if (this.nodes[0].insert(obj)) return true;
            if (this.nodes[1].insert(obj)) return true;
            if (this.nodes[2].insert(obj)) return true;
            if (this.nodes[3].insert(obj)) return true;
            // If it doesn't fit into children (overlaps boundaries), keep it here
        }

        this.objects.push(obj);

        if (!this.divided && this.objects.length > this.capacity && this.depth < this.maxDepth) {
            this.subdivide();
        }

        return true;
    }

    /**
     * Retrieve all objects potentially colliding with range { x, y, w, h }
     */
    retrieve(range) {
        let found = [];
        if (!this.intersects(this.bounds, range)) return found;

        if (this.divided) {
            // If range intersects with children, search them
            if (this.intersects(this.nodes[0].bounds, range)) found = found.concat(this.nodes[0].retrieve(range));
            if (this.intersects(this.nodes[1].bounds, range)) found = found.concat(this.nodes[1].retrieve(range));
            if (this.intersects(this.nodes[2].bounds, range)) found = found.concat(this.nodes[2].retrieve(range));
            if (this.intersects(this.nodes[3].bounds, range)) found = found.concat(this.nodes[3].retrieve(range));
        }

        // Add objects at this level
        // We could filter here for strict intersection, but retrieve usually returns *candidates*
        // Optimization: checking exact intersection right here is better for the caller
        for (const obj of this.objects) {
            if (this.intersects(obj, range)) {
                found.push(obj);
            }
        }

        return found;
    }

    // Helpers
    contains(container, rect) {
        return (rect.x >= container.x &&
            rect.y >= container.y &&
            rect.x + rect.w <= container.x + container.w &&
            rect.y + rect.h <= container.y + container.h);
    }

    intersects(a, b) {
        return !(b.x > a.x + a.w ||
            b.x + b.w < a.x ||
            b.y > a.y + a.h ||
            b.y + b.h < a.y);
    }
}
