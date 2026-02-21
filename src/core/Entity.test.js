
import { describe, it, expect, beforeEach } from 'bun:test';
import HistoricalEntity from './Entity.js';

describe('HistoricalEntity Geometry Caching', () => {
    let entity;
    const geo1 = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 }
    ];
    const geo2 = [
        { x: 50, y: 50 },
        { x: 150, y: 50 },
        { x: 150, y: 150 },
        { x: 50, y: 150 },
        { x: 100, y: 100 } // Extra point to force resampling
    ];

    beforeEach(() => {
        entity = new HistoricalEntity('test-1', 'Test Entity', {
            domain: 'political',
            typology: 'nation-state'
        });
        entity.addKeyframe(1000, geo1);
        entity.addKeyframe(2000, geo2);
    });

    it('should calculate geometry at a specific year', () => {
        const result = entity.getGeometryAtYear(1500);
        expect(result).not.toBeNull();
        expect(result.length).toBeGreaterThan(0);
        // It should be resampled to CONFIG.RESAMPLE_COUNT (100)
        expect(result.length).toBe(100);
    });

    it('should cache geometry calculations', () => {
        // First call - should populate cache
        expect(entity._geometryCache.size).toBe(0);
        entity.getGeometryAtYear(1500);
        expect(entity._geometryCache.size).toBe(1);
        expect(entity._geometryCache.has('1000-2000')).toBe(true);

        // Second call with same year - should use cache (size remains 1)
        entity.getGeometryAtYear(1500);
        expect(entity._geometryCache.size).toBe(1);

        // Third call with different year but same interval - should use cache
        entity.getGeometryAtYear(1200);
        expect(entity._geometryCache.size).toBe(1);
    });

    it('should clear cache when adding a keyframe', () => {
        entity.getGeometryAtYear(1500);
        expect(entity._geometryCache.size).toBe(1);

        const geo3 = [
            { x: 200, y: 200 },
            { x: 300, y: 200 },
            { x: 300, y: 300 }
        ];

        // Add new keyframe in the middle
        entity.addKeyframe(1500, geo3);

        // Cache should be cleared
        expect(entity._geometryCache.size).toBe(0);

        // Requesting geometry now should create new cache entries
        entity.getGeometryAtYear(1250); // Between 1000 and 1500
        expect(entity._geometryCache.size).toBe(1);
        expect(entity._geometryCache.has('1000-1500')).toBe(true);
    });

    it('should handle different intervals correctly', () => {
        const geo3 = [
            { x: 200, y: 200 },
            { x: 300, y: 200 },
            { x: 300, y: 300 }
        ];
        entity.addKeyframe(3000, geo3);

        // 1000-2000
        entity.getGeometryAtYear(1500);
        expect(entity._geometryCache.size).toBe(1);
        expect(entity._geometryCache.has('1000-2000')).toBe(true);

        // 2000-3000
        entity.getGeometryAtYear(2500);
        expect(entity._geometryCache.size).toBe(2);
        expect(entity._geometryCache.has('2000-3000')).toBe(true);
    });
});
