/**
 * InputController Module
 * Handles mouse and keyboard input
 */

import GeoMath from '../core/GeoMath.js';

export default class InputController {
    constructor(app) {
        this.app = app;
        this.renderer = app.renderer;
        this.isDragging = false;
        this.lastX = 0;
        this.lastY = 0;
        this.hoverThrottle = 0;
        this.init();
    }

    init() {
        const canvas = this.renderer.canvas;
        
        // Wheel event for zooming
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = -Math.sign(e.deltaY);
            const scale = 1 + (delta * 0.1);
            this.renderer.zoom(scale, e.offsetX, e.offsetY);
            this.app.render();
        }, { passive: false });
        
        // Mouse down
        canvas.addEventListener('mousedown', (e) => {
            const worldPos = this.renderer.toWorld(e.offsetX, e.offsetY);
            
            if (this.app.activeTool === 'pan') {
                this.isDragging = true;
                this.lastX = e.clientX;
                this.lastY = e.clientY;
                canvas.style.cursor = 'grabbing';
            } else if (this.app.activeTool === 'select') {
                if (this.app.hoveredEntityId) {
                    this.app.selectEntity(this.app.hoveredEntityId);
                }
            } else if (this.app.activeTool === 'draw_poly' || this.app.activeTool === 'draw_line') {
                this.app.addDraftPoint(worldPos);
            }
        });
        
        // Mouse move
        canvas.addEventListener('mousemove', (e) => {
            const worldPos = this.renderer.toWorld(e.offsetX, e.offsetY);
            
            // Handle panning
            if (this.isDragging && this.app.activeTool === 'pan') {
                const dx = e.clientX - this.lastX;
                const dy = e.clientY - this.lastY;
                this.renderer.pan(dx, dy);
                this.lastX = e.clientX;
                this.lastY = e.clientY;
                this.app.render();
            }
            
            // Handle hover detection (throttled)
            this.hoverThrottle++;
            if (this.hoverThrottle % 5 === 0) {
                this.updateHover(worldPos);
            }
            
            // Update draft cursor
            if (this.app.activeTool.startsWith('draw_')) {
                this.app.draftCursor = worldPos;
                this.app.render();
            }
        });
        
        // Mouse up
        window.addEventListener('mouseup', () => {
            this.isDragging = false;
            canvas.style.cursor = 'crosshair';
        });
        
        // Keyboard shortcuts
        window.addEventListener('keydown', (e) => {
            // Enter to finish drawing
            if (e.key === 'Enter' && this.app.draftPoints.length > 2) {
                this.app.finishDraft();
            }
            
            // Escape to cancel
            if (e.key === 'Escape') {
                this.app.cancelDraft();
            }
            
            // Delete selected entity
            if ((e.key === 'Delete' || e.key === 'Backspace') && this.app.selectedEntityId) {
                this.app.deleteEntity(this.app.selectedEntityId);
            }
        });
    }

    /**
     * Update which entity is being hovered
     */
    updateHover(worldPos) {
        this.app.hoveredEntityId = null;
        
        // Check entities in reverse order (top to bottom)
        for (let i = this.app.entities.length - 1; i >= 0; i--) {
            const entity = this.app.entities[i];
            const geometry = entity.getGeometryAtYear(this.app.currentYear);
            
            if (geometry && geometry.length > 0) {
                if (entity.type === 'polity') {
                    if (GeoMath.isPointInPolygon(worldPos, geometry)) {
                        this.app.hoveredEntityId = entity.id;
                        break;
                    }
                }
            }
        }
    }
}
