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
                            this.originalGeometry = ent.currentGeometry.map(p => ({ ...p })); // Deep copy
                            c.style.cursor = 'nwse-resize'; // Simplification
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
                        // Check for vertex click
                        const hitIdx = ent.currentGeometry.findIndex(pt => distance(pt, wp) < 10 / this.renderer.transform.k);
                        if (hitIdx !== -1) {
                            this.isDragging = true;
                            this.dragVertexIndex = hitIdx;
                            c.style.cursor = 'grabbing';
                            return; // Stop processing other tools
                        } else {
                            // Check for edge click to ADD vertex
                            // Iterate segments
                            const poly = ent.currentGeometry;
                            for (let i = 0; i < poly.length; i++) {
                                const p1 = poly[i];
                                const p2 = poly[(i + 1) % poly.length];
                                if (distanceToSegment(wp, p1, p2) < 5 / this.renderer.transform.k) {
                                    // Insert new point
                                    ent.currentGeometry.splice(i + 1, 0, { x: wp.x, y: wp.y });
                                    this.app.finishVertexEdit(); // Auto-save
                                    this.app.render();
                                    return;
                                }
                            }
                        }
                    }
                }

                // Priority 2: Pan Tool
                if (this.app.activeTool === 'pan') {
                    this.isDragging = true;
                    this.lastX = e.clientX;
                    this.lastY = e.clientY;
                    c.style.cursor = 'grabbing';
                    return;
                }

                // Priority 3: Drawing
                else if (this.app.activeTool === 'draw') {
                    // Check for middle click (button 1) logic below, this is left click
                    if (this.app.drawType === 'city') {
                        this.app.addDraftPoint(wp);
                        this.app.commitDraft();
                    } else {
                        this.app.addDraftPoint(wp);
                    }
                    return;
                }

                // Priority 4: Erase
                else if (this.app.activeTool === 'erase' && this.app.hoveredEntityId) {
                    this.app.deleteEntity(this.app.hoveredEntityId);
                    return;
                }

                // Priority 5: Selection (Inspect/Vertex/General)
                // Just SELECT, do not open info panel
                if (this.app.hoveredEntityId) {
                    this.app.selectEntity(this.app.hoveredEntityId, false); // false = don't open panel
                } else {
                    this.app.deselect();
                }
            }

            // Middle Click (button 1) to Finish Polygon
            if (e.button === 1 && this.app.activeTool === 'draw') {
                e.preventDefault();
                this.app.commitDraft();
            }
        });

        // Context Menu (Right Click)
        c.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (this.app.currentView !== 'map') return;

            const wp = this.renderer.toWorld(e.offsetX, e.offsetY);

            // Vertex Edit: Right Click to Delete Point
            if (this.app.activeTool === 'vertex-edit' && this.app.selectedEntityId) {
                const ent = this.app.entities.find(en => en.id === this.app.selectedEntityId);
                if (ent && ent.currentGeometry) {
                    const hitIdx = ent.currentGeometry.findIndex(pt => distance(pt, wp) < 10 / this.renderer.transform.k);
                    if (hitIdx !== -1) {
                        // Don't delete if too few points
                        if (ent.currentGeometry.length > 3) {
                            ent.currentGeometry.splice(hitIdx, 1);
                            this.app.finishVertexEdit();
                            this.app.render();
                        }
                        return;
                    }
                }
            }

            // If hovering over an entity, select it AND open the panel
            if (this.app.hoveredEntityId) {
                this.app.selectEntity(this.app.hoveredEntityId, true); // true = open panel
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (this.app.currentView !== 'map') return;
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

            // Handle Panning
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
            if (this.app.activeTool === 'vertex-edit' && this.app.selectedEntityId) {
                const ent = this.app.entities.find(en => en.id === this.app.selectedEntityId);
                if (ent && ent.currentGeometry) {
                    const hitIdx = ent.currentGeometry.findIndex(pt => distance(pt, wp) < 10 / this.renderer.transform.k);
                    this.app.highlightVertex(hitIdx !== -1 ? hitIdx : null);
                    c.style.cursor = (hitIdx !== -1) ? 'pointer' : 'default';
                }
            }

            if (this.app.activeTool === 'draw') { this.app.updateDraftCursor(wp); return; }
            if (this.app.activeTool === 'inspect' || this.app.activeTool === 'erase' || this.app.activeTool === 'pan' || this.app.activeTool === 'vertex-edit' || this.app.activeTool === 'transform') {
                const now = Date.now();
                if (now - this.hoverThrottle > 30) {
                    this.hoverThrottle = now;
                    this.app.checkHover(wp);
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

            const trackWidth = document.querySelector('.timeline-bar-track').offsetWidth;
            const epochStart = parseInt(document.getElementById('epoch-start').value);
            const epochEnd = parseInt(document.getElementById('epoch-end').value);
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
