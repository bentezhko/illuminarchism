
import { Quadtree } from './SpatialIndex.js';
import { describe, it, expect } from 'bun:test';

describe('SpatialIndex', () => {
    it('should retrieve objects outside bounds', () => {
        const qt = new Quadtree({ x: 0, y: 0, w: 100, h: 100 });
        const obj = { x: 200, y: 200, w: 10, h: 10, id: 'outlier' };

        qt.insert(obj);

        // Verify it was inserted into outliers
        expect(qt.outliers).toContain(obj);
        // It should NOT be in the main objects array
        expect(qt.objects).not.toContain(obj);

        // Try to retrieve it with a range covering it
        const range = { x: 190, y: 190, w: 30, h: 30 };
        const result = qt.retrieve(range);

        // Should retrieve it now
        expect(result).toContain(obj);
    });

    it('should retrieve objects inside bounds', () => {
        const qt = new Quadtree({ x: 0, y: 0, w: 100, h: 100 });
        const obj = { x: 10, y: 10, w: 10, h: 10, id: 'inside' };
        qt.insert(obj);
        const result = qt.retrieve({ x: 0, y: 0, w: 100, h: 100 });
        expect(result).toContain(obj);
    });

    it('should clear outliers when cleared', () => {
        const qt = new Quadtree({ x: 0, y: 0, w: 100, h: 100 });
        const obj = { x: 200, y: 200, w: 10, h: 10, id: 'outlier' };
        qt.insert(obj);
        expect(qt.outliers.length).toBe(1);
        qt.clear();
        expect(qt.outliers.length).toBe(0);
    });

    it('should not subdivide due to outliers', () => {
         const qt = new Quadtree({ x: 0, y: 0, w: 100, h: 100 }, 2); // capacity 2
         // Insert 3 outliers
         qt.insert({ x: 200, y: 200, w: 10, h: 10 });
         qt.insert({ x: 210, y: 200, w: 10, h: 10 });
         qt.insert({ x: 220, y: 200, w: 10, h: 10 });

         // Should not be divided because they are in outliers, not objects
         expect(qt.divided).toBe(false);
         expect(qt.objects.length).toBe(0);
         expect(qt.outliers.length).toBe(3);

         // Insert inside objects
         qt.insert({ x: 10, y: 10, w: 10, h: 10 });
         qt.insert({ x: 20, y: 20, w: 10, h: 10 });
         expect(qt.divided).toBe(false); // Capacity reached but not exceeded yet? 2 objects.

         qt.insert({ x: 30, y: 30, w: 10, h: 10 });
         // Now it should divide
         expect(qt.divided).toBe(true);
    });
});
