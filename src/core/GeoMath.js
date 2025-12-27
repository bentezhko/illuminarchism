/**
 * GeoMath Module
 * Pure geometric calculations for historical cartography
 * No rendering, no DOM - just mathematics
 */

export default class GeoMath {
    /**
     * Calculate Euclidean distance between two points
     */
    static distance(p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Linear interpolation between two values
     */
    static lerp(a, b, t) {
        return a + (b - a) * t;
    }

    /**
     * Linear interpolation between two points
     */
    static lerpPoint(p1, p2, t) {
        return {
            x: this.lerp(p1.x, p2.x, t),
            y: this.lerp(p1.y, p2.y, t)
        };
    }

    /**
     * Calculate centroid of a polygon
     */
    static getCentroid(points) {
        if (!points || points.length === 0) return { x: 0, y: 0 };
        
        let sumX = 0, sumY = 0;
        for (let p of points) {
            sumX += p.x;
            sumY += p.y;
        }
        return {
            x: sumX / points.length,
            y: sumY / points.length
        };
    }

    /**
     * Point-in-polygon test using ray casting algorithm
     */
    static isPointInPolygon(point, polygon) {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].x, yi = polygon[i].y;
            const xj = polygon[j].x, yj = polygon[j].y;
            
            const intersect = ((yi > point.y) !== (yj > point.y)) &&
                (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
            
            if (intersect) inside = !inside;
        }
        return inside;
    }

    /**
     * Midpoint displacement algorithm for fractal coastlines
     * Creates realistic, irregular borders
     */
    static roughenPolygon(points, iterations = 2, displacement = 15) {
        let current = [...points];
        
        for (let iter = 0; iter < iterations; iter++) {
            const next = [];
            
            for (let i = 0; i < current.length; i++) {
                const p1 = current[i];
                const p2 = current[(i + 1) % current.length];
                
                // Add original point
                next.push(p1);
                
                // Calculate midpoint
                const mid = this.lerpPoint(p1, p2, 0.5);
                
                // Calculate perpendicular displacement
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const len = Math.sqrt(dx * dx + dy * dy);
                
                if (len > 0) {
                    const nx = -dy / len; // perpendicular normal
                    const ny = dx / len;
                    
                    const amount = (Math.random() - 0.5) * displacement;
                    mid.x += nx * amount;
                    mid.y += ny * amount;
                }
                
                next.push(mid);
            }
            
            current = next;
            displacement *= 0.5; // Reduce displacement each iteration
        }
        
        return current;
    }

    /**
     * Smooth a polygon using Chaikin's corner cutting algorithm
     */
    static smoothPolygon(points, iterations = 1) {
        let current = [...points];
        
        for (let iter = 0; iter < iterations; iter++) {
            const next = [];
            
            for (let i = 0; i < current.length; i++) {
                const p1 = current[i];
                const p2 = current[(i + 1) % current.length];
                
                // Cut corners at 1/4 and 3/4
                next.push(this.lerpPoint(p1, p2, 0.25));
                next.push(this.lerpPoint(p1, p2, 0.75));
            }
            
            current = next;
        }
        
        return current;
    }

    /**
     * Calculate bounding box of a polygon
     */
    static getBoundingBox(points) {
        if (!points || points.length === 0) {
            return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
        }
        
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        
        for (let p of points) {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        }
        
        return { minX, minY, maxX, maxY };
    }
}
