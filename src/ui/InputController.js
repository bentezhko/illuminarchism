import { CONFIG } from '../config.js';
import { distance, distanceToSegment, getBoundingBox } from '../core/math.js';

export default class InputController {
    constructor(app) {
        this.app = app;
        this.renderer = app.renderer;
        this.isDragging = false;
        this.lastX = 0; this.lastY = 0; this.hoverThrottle = 0;

        // State for Vertex Edit
        this.dragVertexIndex = null;

        // State for Transform Tool
        this.transformMode = null; // 'move', 'resize-tl', 'resize-tr', etc.
        this.transformStart = null; // Mouse start position
        this.originalGeometry = null; // Snapshot for transform calculation

        this.init();
    }

    getTransformHandle(wp, bbox, scale) {
        const handleSize = 10 / scale; // Detection radius slightly larger than visual
        const corners = {
            'resize-tl': { x: bbox.minX, y: bbox.minY },
            'resize-tr': { x: bbox.maxX, y: bbox.minY },
            'resize-br': { x: bbox.maxX, y: bbox.maxY },
            'resize-bl': { x: bbox.minX, y: bbox.maxY }
        };

        for (let key in corners) {
            if (distance(wp, corners[key]) < handleSize) return key;
        }
        return null;
    }

    // NEW Helper for Safe Event Binding
    safeAddListener(id, event, handler) {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener(event, handler);
        } else {
            console.warn(`Element with ID '${id}' not found. Event '${event}' not bound.`);
        }
    }

    init() {
        const c = this.renderer.canvas;
        c.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (this.app.currentView !== 'map') return;
            const d = -Math.sign(e.deltaY);
            const s = 1 + (d * 0.1);
            const t = this.renderer.transform;
            const mx = e.offsetX, my = e.offsetY;
            const wp = this.renderer.toWorld(mx, my);

            let newK = t.k * s;
            newK = Math.max(CONFIG.MIN_ZOOM, Math.min(CONFIG.MAX_ZOOM, newK));

            t.x = mx - (wp.x * newK);
            t.y = my - (wp.y * newK);
            t.k = newK;

            this.app.render();
        });

        // MouseDown Handler
        c.addEventListener('mousedown', (e) => {
            const wp = this.renderer.toWorld(e.offsetX, e.offsetY);

            // Left Click (button 0)
            if (e.button === 0) {

                // Priority 0: Transform Tool
                if (this.app.activeTool === 'transform' && this.app.selectedEntityId) {
                    const ent = this.app.entities.find(en => en.id === this.app.selectedEntityId);
                    if (ent && ent.currentGeometry && ent.type !== 'city') {
                        const bbox = getBoundingBox(ent.currentGeometry);
                        // Check handles
                        const handle = this.getTransformHandle(wp, bbox, this.renderer.transform.k);
                        if (handle) {
                            this.isDragging = true;
                            this.transformMode = handle;
                            this.transformStart = wp;
                            this.originalGeometry = ent.currentGeometry.map(p => ({ ...p }));
                            c.style.cursor = 'nwse-resize';
                            return;
                        }
                        // Check Inside Box (Move)
                        if (wp.x >= bbox.minX && wp.x <= bbox.maxX && wp.y >= bbox.minY && wp.y <= bbox.maxY) {
                            this.isDragging = true;
                            this.transformMode = 'move';
                            this.transformStart = wp;
                            this.originalGeometry = ent.currentGeometry.map(p => ({ ...p }));
                            c.style.cursor = 'move';
                            return;
                        }
                    }
                }

                // Priority 1: Vertex Edit Mode
                if (this.app.activeTool === 'vertex-edit' && this.app.selectedEntityId) {
                    const ent = this.app.entities.find(en => en.id === this.app.selectedEntityId);
                    if (ent && ent.currentGeometry) {
                        const hitIdx = ent.currentGeometry.findIndex(pt => distance(pt, wp) < 10 / this.renderer.transform.k);
                        if (hitIdx !== -1) {
                            this.isDragging = true;
                            this.dragVertexIndex = hitIdx;
                            c.style.cursor = 'grabbing';
                            return;
                        } else {
                            // Add vertex logic
                            const poly = ent.currentGeometry;
                            for (let i = 0; i < poly.length; i++) {
                                const p1 = poly[i];
                                const p2 = poly[(i + 1) % poly.length];
                                if (distanceToSegment(wp, p1, p2) < 5 / this.renderer.transform.k) {
                                    ent.currentGeometry.splice(i + 1, 0, { x: wp.x, y: wp.y });
                                    this.app.finishVertexEdit();
                                    this.app.render();
                                    return;
                                }
                            }
                        }
                    }
                }

                // Priority 2: Drawing Tool
                if (this.app.activeTool === 'draw') {
                    if (this.app.drawType === 'city') {
                        this.app.addDraftPoint(wp);
                        this.app.commitDraft();
                    } else {
                        this.app.addDraftPoint(wp);
                    }
                    return;
                }

                // Priority 3: Erase Tool
                if (this.app.activeTool === 'erase' && this.app.hoveredEntityId) {
                    this.app.deleteEntity(this.app.hoveredEntityId);
                    return;
                }

                // Priority 4: Default Navigation (Pan)
                // If not in a specific modal tool, Left Click creates Pan interaction
                this.isDragging = true;
                this.lastX = e.clientX;
                this.lastY = e.clientY;
                c.style.cursor = 'grabbing';
            }

            // Middle Click (button 1)
            if (e.button === 1 && this.app.activeTool === 'draw') {
                e.preventDefault();
                this.app.commitDraft();
            }
        });

        // Context Menu (Right Click) -> Seek / Details
        c.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (this.app.currentView !== 'map') return;

            const wp = this.renderer.toWorld(e.offsetX, e.offsetY);

            // Vertex Edit: Delete Point
            if (this.app.activeTool === 'vertex-edit' && this.app.selectedEntityId) {
                const ent = this.app.entities.find(en => en.id === this.app.selectedEntityId);
                if (ent && ent.currentGeometry) {
                    const hitIdx = ent.currentGeometry.findIndex(pt => distance(pt, wp) < 10 / this.renderer.transform.k);
                    if (hitIdx !== -1 && ent.currentGeometry.length > 3) {
                        ent.currentGeometry.splice(hitIdx, 1);
                        this.app.finishVertexEdit();
                        this.app.render();
                    }
                    return;
                }
            }

            // Default: Seek / Inspect
            // Perform a hit test right now
            try {
                this.app.checkHover(wp);
            } catch(err) {
                console.error('checkHover failed on right-click:', err);
            }

            if (this.app.hoveredEntityId) {
                this.app.selectEntity(this.app.hoveredEntityId, true); // Select
                this.app.openInfoPanel(); // Open "Details Overview"
                // The Info Panel will contain the "Edit" button to switch mode
            } else {
                this.app.deselect();
                // Optionally close info panel?
                if (this.app.infoPanel) this.app.infoPanel.hide();
            }
        });

        // FIXED: Mousemove with better bounds checking and drag prevention
        c.addEventListener('mousemove', (e) => {
            if (this.app.currentView !== 'map') return;
            
            // Safety check: ensure we have valid coordinates
            if (typeof e.offsetX !== 'number' || typeof e.offsetY !== 'number') return;
            
            const wp = this.renderer.toWorld(e.offsetX, e.offsetY);

            // Handle Transform (Move/Resize)
            if (this.isDragging && this.app.activeTool === 'transform' && this.transformMode && this.originalGeometry) {
                this.app.applyTransform(this.transformMode, this.originalGeometry, this.transformStart, wp, e.shiftKey);
                return;
            }

            // Handle Dragging Vertex
            if (this.isDragging && this.app.activeTool === 'vertex-edit' && this.dragVertexIndex !== null) {
                this.app.editVertex(this.dragVertexIndex, wp);
                return;
            }

            // Handle Panning - CRITICAL: Don't call checkHover during pan drag!
            if (this.isDragging && this.app.activeTool === 'pan') {
                const dx = e.clientX - this.lastX;
                const dy = e.clientY - this.lastY;
                this.lastX = e.clientX; this.lastY = e.clientY;
                this.renderer.transform.x += dx;
                this.renderer.transform.y += dy;
                this.app.render();
                return;
            }

            // Handle Vertex Hover Effect
            if (this.app.activeTool === 'vertex-edit' && this.app.selectedEntityId && !this.isDragging) {
                const ent = this.app.entities.find(en => en.id === this.app.selectedEntityId);
                if (ent && ent.currentGeometry) {
                    const hitIdx = ent.currentGeometry.findIndex(pt => distance(pt, wp) < 10 / this.renderer.transform.k);
                    this.app.highlightVertex(hitIdx !== -1 ? hitIdx : null);
                    c.style.cursor = (hitIdx !== -1) ? 'pointer' : 'default';
                }
            }

            // Drawing mode cursor update
            if (this.app.activeTool === 'draw') { 
                this.app.updateDraftCursor(wp); 
                return; 
            }
            
            // CRITICAL FIX: Enable hover detection in pan mode when NOT dragging (unified Navigate tool)
            if (!this.isDragging && (this.app.activeTool === 'pan' || this.app.activeTool === 'erase')) {
                const now = Date.now();
                if (now - this.hoverThrottle > 50) { // Increased throttle to 50ms
                    this.hoverThrottle = now;
                    try {
                        this.app.checkHover(wp);
                    } catch(err) {
                        console.error('checkHover failed:', err);
                        // Reset hover state on error
                        this.app.hoveredEntityId = null;
                    }
                }
            }
        });

        window.addEventListener('mouseup', () => {
            if (this.isDragging && (this.app.activeTool === 'vertex-edit' || this.app.activeTool === 'transform')) {
                // Finish Edit - Commit Keyframe
                this.app.finishVertexEdit();
            }

            this.isDragging = false;
            this.dragVertexIndex = null;
            this.transformMode = null;
            this.transformStart = null;
            this.originalGeometry = null;

            if (this.app.activeTool === 'pan') c.style.cursor = 'grab';
        });

        // Spacebar Handler
        window.addEventListener('keydown', (e) => {
            if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;

            if (e.code === 'Space') {
                e.preventDefault();
                this.app.togglePlay();
            }

            // FOCUS KEYBIND
            if (e.code === 'KeyF') {
                this.app.focusSelectedEntity();
            }

            if (this.app.activeTool === 'draw') {
                if (e.key === 'Enter') this.app.commitDraft();
                if (e.key === 'Escape') this.app.cancelDraft();
            }
        });

        // Timeline Interaction Listeners
        this.initTimelineInteraction();
    }

    initTimelineInteraction() {
        const tlContainer = document.getElementById('view-timeline');
        if (!tlContainer) return; // Safety check
        
        let isDraggingBar = false;
        let dragTarget = null;
        let dragType = null; // 'move', 'start', 'end'
        let startX = 0;
        let initialStartYear = 0;
        let initialEndYear = 0;

        tlContainer.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('timeline-bar') || e.target.classList.contains('timeline-handle')) {
                isDraggingBar = true;
                if (e.target.classList.contains('handle-l')) {
                    dragType = 'start';
                    dragTarget = e.target.parentElement.dataset.id;
                } else if (e.target.classList.contains('handle-r')) {
                    dragType = 'end';
                    dragTarget = e.target.parentElement.dataset.id;
                } else {
                    dragType = 'move';
                    dragTarget = e.target.dataset.id;
                }
                startX = e.clientX;
                const ent = this.app.entities.find(en => en.id === dragTarget);
                if (ent) {
                    initialStartYear = ent.validRange.start;
                    initialEndYear = ent.validRange.end;
                }
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDraggingBar || !dragTarget) return;

            const trackEl = document.querySelector('.timeline-bar-track');
            if (!trackEl) return;
            
            const trackWidth = trackEl.offsetWidth;
            const epochStartEl = document.getElementById('epoch-start');
            const epochEndEl = document.getElementById('epoch-end');
            
            if (!epochStartEl || !epochEndEl) return;
            
            const epochStart = parseInt(epochStartEl.value);
            const epochEnd = parseInt(epochEndEl.value);
            const totalYears = epochEnd - epochStart;

            const deltaPixels = e.clientX - startX;
            const deltaYears = Math.round((deltaPixels / trackWidth) * totalYears);

            const ent = this.app.entities.find(en => en.id === dragTarget);
            if (!ent) return;

            if (dragType === 'move') {
                // Handle infinite ranges
                if (!Number.isFinite(initialStartYear) && !Number.isFinite(initialEndYear)) {
                    // Both infinite: Cannot move eternity
                    return;
                } else if (!Number.isFinite(initialStartYear)) {
                    // Start is infinite: Shift end only
                    ent.validRange.end = initialEndYear + deltaYears;
                } else if (!Number.isFinite(initialEndYear)) {
                    // End is infinite: Shift start only
                    ent.validRange.start = initialStartYear + deltaYears;
                } else {
                    // Standard move
                    const duration = initialEndYear - initialStartYear;
                    let newStart = initialStartYear + deltaYears;
                    let newEnd = newStart + duration;
                    ent.validRange.start = newStart;
                    ent.validRange.end = newEnd;
                }
            } else if (dragType === 'start') {
                ent.validRange.start = Math.min(initialStartYear + deltaYears, ent.validRange.end - 1);
            } else if (dragType === 'end') {
                ent.validRange.end = Math.max(initialEndYear + deltaYears, ent.validRange.start + 1);
            }

            this.app.renderTimelineView();
        });

        window.addEventListener('mouseup', () => {
            if (isDraggingBar) {
                isDraggingBar = false;
                dragTarget = null;
                this.app.updateInfoPanel(); // Refresh UI if open
                this.app.render(); // Refresh map
            }
        });
    }
}
