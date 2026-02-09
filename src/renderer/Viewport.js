/**
 * Viewport Module
 * Manages camera transformations (pan, zoom) for world coordinates
 */

import { CONFIG } from '../config.js';

export default class Viewport {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        
        // Camera transform
        this.x = width / 2;
        this.y = height / 2;
        this.zoom = 1;
    }

    /**
     * Resize viewport
     */
    resize(width, height) {
        this.width = width;
        this.height = height;
    }

    /**
     * Convert screen coordinates to world coordinates
     */
    screenToWorld(screenX, screenY) {
        return {
            x: (screenX - this.x) / this.zoom,
            y: (screenY - this.y) / this.zoom
        };
    }

    /**
     * Convert world coordinates to screen coordinates
     */
    worldToScreen(worldX, worldY) {
        return {
            x: worldX * this.zoom + this.x,
            y: worldY * this.zoom + this.y
        };
    }

    /**
     * Pan the viewport
     */
    pan(dx, dy) {
        this.x += dx;
        this.y += dy;
    }

    /**
     * Zoom towards a specific point
     */
    zoomAt(scale, centerX, centerY) {
        const oldZoom = this.zoom;
        this.zoom = Math.max(
            CONFIG.MIN_ZOOM,
            Math.min(CONFIG.MAX_ZOOM, this.zoom * scale)
        );
        
        // Adjust position to zoom towards center point
        if (centerX !== undefined && centerY !== undefined) {
            this.x = centerX - (centerX - this.x) * (this.zoom / oldZoom);
            this.y = centerY - (centerY - this.y) * (this.zoom / oldZoom);
        }
    }

    /**
     * Fit bounds into viewport
     */
    fitBounds(minX, minY, maxX, maxY, padding = 50) {
        const boundsWidth = maxX - minX;
        const boundsHeight = maxY - minY;
        
        const scaleX = (this.width - padding * 2) / boundsWidth;
        const scaleY = (this.height - padding * 2) / boundsHeight;
        
        this.zoom = Math.min(scaleX, scaleY);
        this.zoom = Math.max(
            CONFIG.MIN_ZOOM,
            Math.min(CONFIG.MAX_ZOOM, this.zoom)
        );
        
        const centerWorldX = (minX + maxX) / 2;
        const centerWorldY = (minY + maxY) / 2;
        
        this.x = this.width / 2 - centerWorldX * this.zoom;
        this.y = this.height / 2 - centerWorldY * this.zoom;
    }

    /**
     * Reset to default view
     */
    reset() {
        this.x = this.width / 2;
        this.y = this.height / 2;
        this.zoom = 1;
    }

    /**
     * Get current visible bounds in world coordinates
     */
    getVisibleBounds() {
        const topLeft = this.screenToWorld(0, 0);
        const bottomRight = this.screenToWorld(this.width, this.height);
        
        return {
            minX: topLeft.x,
            minY: topLeft.y,
            maxX: bottomRight.x,
            maxY: bottomRight.y
        };
    }
}
