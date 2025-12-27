/**
 * Entity Module
 * Manages historical entities with temporal geometry and hierarchical relationships
 */

import GeoMath from './GeoMath.js';

// Configuration constants
export const CONFIG = {
    ZOOM_SENSITIVITY: 0.001,
    MIN_ZOOM: 0.1,
    MAX_ZOOM: 5,
    BACKGROUND_COLOR: '#f3e9d2',
    RESAMPLE_COUNT: 100,
    WATERCOLOR_PASSES: 3,
    WATERCOLOR_JITTER: 3,
    ANIMATION_SPEED: 200
};

// Helper function for linear interpolation
export const lerp = (start, end, t) => start * (1 - t) + end * t;

/**
 * Resample geometry to fixed point count for smooth morphing
 */
export function resampleGeometry(points, targetCount, isClosed) {
    if (points.length < 2) return points;
    
    const result = [];
    let totalLen = 0;
    const segments = [];
    
    const endIdx = isClosed ? points.length : points.length - 1;
    for (let i = 0; i < endIdx; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % points.length];
        const len = GeoMath.distance(p1, p2);
        segments.push({ start: p1, end: p2, len });
        totalLen += len;
    }
    
    if (totalLen === 0) return points;
    
    const step = totalLen / targetCount;
    let accumulated = 0;
    let segIdx = 0;
    let segProgress = 0;
    
    for (let i = 0; i < targetCount; i++) {
        const targetDist = i * step;
        
        while (segIdx < segments.length && accumulated + segments[segIdx].len < targetDist) {
            accumulated += segments[segIdx].len;
            segIdx++;
        }
        
        if (segIdx >= segments.length) break;
        
        segProgress = (targetDist - accumulated) / segments[segIdx].len;
        const seg = segments[segIdx];
        result.push({
            x: lerp(seg.start.x, seg.end.x, segProgress),
            y: lerp(seg.start.y, seg.end.y, segProgress)
        });
    }
    
    return result;
}

/**
 * Calculate signed area of a polygon (for winding order detection)
 */
export function getSignedArea(points) {
    let area = 0;
    for (let i = 0; i < points.length; i++) {
        const j = (i + 1) % points.length;
        area += points[i].x * points[j].y;
        area -= points[j].x * points[i].y;
    }
    return area / 2;
}

/**
 * Ensure polygon has counter-clockwise winding
 */
export function ensureCCW(points) {
    return getSignedArea(points) < 0 ? [...points].reverse() : points;
}

/**
 * HistoricalEntity class
 * Represents a temporal geographical entity with keyframe-based geometry
 */
export default class HistoricalEntity {
    constructor(id, name, type, color, parentId = null) {
        this.id = id;
        this.name = name;
        this.type = type; // 'polity', 'river', 'city', etc.
        this.color = color;
        this.parentId = parentId; // For hierarchical relationships
        this.description = "A mapped entity.";
        this.timeline = []; // Array of {year, geometry}
        this.validRange = { start: -Infinity, end: Infinity };
        this.currentGeometry = null;
    }

    /**
     * Add a keyframe at specific year
     */
    addKeyframe(year, geometry) {
        // Remove existing keyframe at this year
        this.timeline = this.timeline.filter(k => k.year !== year);
        
        let resampled;
        if (this.type === 'city') {
            resampled = geometry; // Cities are points, don't resample
        } else {
            const isClosed = (this.type === 'polity');
            resampled = resampleGeometry(geometry, CONFIG.RESAMPLE_COUNT, isClosed);
        }
        
        this.timeline.push({ year, geometry: resampled });
        this.timeline.sort((a, b) => a.year - b.year);
        
        // Update valid range
        if (this.timeline.length > 0) {
            this.validRange.start = Math.min(this.timeline[0].year - 100, this.validRange.start);
            this.validRange.end = Math.max(this.timeline[this.timeline.length - 1].year + 100, this.validRange.end);
        }
    }

    /**
     * Get interpolated geometry at specific year
     */
    getGeometryAtYear(targetYear) {
        if (this.timeline.length === 0) return null;
        if (this.timeline.length === 1) return this.timeline[0].geometry;
        
        // Find surrounding keyframes
        let before = null, after = null;
        
        for (let i = 0; i < this.timeline.length; i++) {
            if (this.timeline[i].year <= targetYear) {
                before = this.timeline[i];
            }
            if (this.timeline[i].year >= targetYear && !after) {
                after = this.timeline[i];
                break;
            }
        }
        
        // Exact match
        if (before && before.year === targetYear) return before.geometry;
        if (after && after.year === targetYear) return after.geometry;
        
        // Before timeline start
        if (!before && after) return after.geometry;
        
        // After timeline end
        if (before && !after) return before.geometry;
        
        // Interpolate between keyframes
        if (before && after) {
            const t = (targetYear - before.year) / (after.year - before.year);
            return this.interpolateGeometry(before.geometry, after.geometry, t);
        }
        
        return null;
    }

    /**
     * Interpolate between two geometries
     */
    interpolateGeometry(geo1, geo2, t) {
        const minLen = Math.min(geo1.length, geo2.length);
        const result = [];
        
        for (let i = 0; i < minLen; i++) {
            result.push({
                x: lerp(geo1[i].x, geo2[i].x, t),
                y: lerp(geo1[i].y, geo2[i].y, t)
            });
        }
        
        return result;
    }

    /**
     * Check if entity exists at given year
     */
    existsAtYear(year) {
        return year >= this.validRange.start && year <= this.validRange.end;
    }

    /**
     * Update current geometry (for real-time editing)
     */
    setCurrentGeometry(geometry) {
        this.currentGeometry = geometry;
    }
}

/**
 * EntityManager class
 * Manages collection of entities and their relationships
 */
export class EntityManager {
    constructor() {
        this.entities = [];
        this.selectedId = null;
    }

    addEntity(entity) {
        this.entities.push(entity);
        return entity.id;
    }

    getEntity(id) {
        return this.entities.find(e => e.id === id);
    }

    removeEntity(id) {
        this.entities = this.entities.filter(e => e.id !== id);
        if (this.selectedId === id) {
            this.selectedId = null;
        }
    }

    getChildren(parentId) {
        return this.entities.filter(e => e.parentId === parentId);
    }

    getAllEntitiesAtYear(year) {
        return this.entities.filter(e => e.existsAtYear(year));
    }

    selectEntity(id) {
        this.selectedId = id;
    }

    getSelected() {
        return this.selectedId ? this.getEntity(this.selectedId) : null;
    }
}
