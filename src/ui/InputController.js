/**
 * InputController Module
 * Handles mouse and keyboard input for WebGL renderer
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
            
            // Get mouse position for zoom center
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            this.renderer.zoom(scale, x, y);
        }, { passive: false });
        
        // Mouse down
        canvas.addEventListener('mousedown', (e) => {
            const rect = canvas.getBoundingClientRect();
            const screenX = e.clientX - rect.left;
            const screenY = e.clientY - rect.top;
            const worldPos = this.renderer.screenToWorld(screenX, screenY);
            
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
            const rect = canvas.getBoundingClientRect();
            const screenX = e.clientX - rect.left;
            const screenY = e.clientY - rect.top;
            const worldPos = this.renderer.screenToWorld(screenX, screenY);
            
            // Handle panning
            if (this.isDragging && this.app.activeTool === 'pan') {
                const dx = e.clientX - this.lastX;
                const dy = e.clientY - this.lastY;
                this.renderer.pan(dx, dy);
                this.lastX = e.clientX;
                this.lastY = e.clientY;
            }
            
            // Handle hover detection (throttled)
            this.hoverThrottle++;
            if (this.hoverThrottle % 5 === 0) {
                this.updateHover(worldPos);
            }
            
            // Update draft cursor
            if (this.app.activeTool.startsWith('draw_')) {
                this.app.draftCursor = worldPos;
            }
        });
        
        // Mouse up
        window.addEventListener('mouseup', () => {
            this.isDragging = false;
            canvas.style.cursor = 'crosshair';
        });
        
        // Touch support for mobile
        this.initTouchSupport(canvas);
        
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
                e.preventDefault();
                this.app.deleteEntity(this.app.selectedEntityId);
            }
            
            // Tool shortcuts
            if (e.key === 'p' || e.key === 'P') this.app.toolbar.selectTool('pan');
            if (e.key === 's' || e.key === 'S') this.app.toolbar.selectTool('select');
            if (e.key === 'd' || e.key === 'D') this.app.toolbar.selectTool('draw_poly');
        });
    }

    /**
     * Initialize touch support for tablets/mobile
     */
    initTouchSupport(canvas) {
        let lastTouchDistance = 0;
        
        canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                // Two-finger pinch zoom
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                lastTouchDistance = Math.sqrt(dx * dx + dy * dy);
                e.preventDefault();
            } else if (e.touches.length === 1) {
                // Single touch
                this.lastX = e.touches[0].clientX;
                this.lastY = e.touches[0].clientY;
            }
        }, { passive: false });
        
        canvas.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2) {
                // Pinch zoom
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (lastTouchDistance > 0) {
                    const scale = distance / lastTouchDistance;
                    const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                    const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
                    this.renderer.zoom(scale, centerX, centerY);
                }
                
                lastTouchDistance = distance;
                e.preventDefault();
            } else if (e.touches.length === 1 && this.app.activeTool === 'pan') {
                // Pan
                const dx = e.touches[0].clientX - this.lastX;
                const dy = e.touches[0].clientY - this.lastY;
                this.renderer.pan(dx, dy);
                this.lastX = e.touches[0].clientX;
                this.lastY = e.touches[0].clientY;
                e.preventDefault();
            }
        }, { passive: false });
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
