import { CONFIG } from '../config.js';
import { distance, distanceToSegment, getBoundingBox, getRepresentativePoint } from '../core/math.js';
import { isRenderedAsPoint } from '../core/Ontology.js';

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

        // State for Click vs Drag detection
        this.interactionStartX = 0;
        this.interactionStartY = 0;
        this.wasHoveringOnDown = false;

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

    _getTransformHoverMode(wp) {
        if (!this.app.selectedEntityId) return null;

        const ent = this.app.entitiesById.get(this.app.selectedEntityId);
        if (!ent || !ent.currentGeometry) return null;

        const isPoint = ent.currentGeometry.length === 1 || isRenderedAsPoint(ent, this.renderer.transform.k);
        const k = this.renderer.transform.k;

        if (isPoint) {
            const pt = getRepresentativePoint(ent.currentGeometry);
            if (distance(wp, pt) < 25 / k) {
                return 'move';
            }
        } else {
            const bbox = getBoundingBox(ent.currentGeometry);
            const handle = this.getTransformHandle(wp, bbox, k);
            if (handle) {
                return handle;
            }
            if (wp.x >= bbox.minX && wp.x <= bbox.maxX && wp.y >= bbox.minY && wp.y <= bbox.maxY) {
                return 'move';
            }
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

            // Force hover check on click to ensure hoveredEntityId is up to date
            this.app.checkHover(wp);

            // Left Click (button 0)
            if (e.button === 0) {

                // Priority 0: Transform Tool
                if (this.app.activeTool === 'transform' && this.app.selectedEntityId) {
                    const hoverMode = this._getTransformHoverMode(wp);
                    if (hoverMode) {
                        this.isDragging = true;
                        this.transformMode = hoverMode;
                        this.transformStart = wp;
                        const ent = this.app.entitiesById.get(this.app.selectedEntityId);
                        this.originalGeometry = ent.currentGeometry.map(p => ({ ...p }));

                        if (hoverMode === 'resize-tl' || hoverMode === 'resize-br') {
                            c.style.cursor = 'nwse-resize';
                        } else if (hoverMode === 'resize-tr' || hoverMode === 'resize-bl') {
                            c.style.cursor = 'nesw-resize';
                        } else if (hoverMode === 'move') {
                            c.style.cursor = 'move';
                        }
                        return;
                    }
                }

                // Priority 1: Vertex Edit Mode
                if (this.app.activeTool === 'vertex-edit' && this.app.selectedEntityId) {
                    const ent = this.app.entitiesById.get(this.app.selectedEntityId);
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
                    if (this.app.isHoveringFirstDraftPoint) {
                        this.app.commitDraft();
                    } else if (this.app.drawType === 'city') {
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

                this.interactionStartX = e.clientX;
                this.interactionStartY = e.clientY;
                this.wasHoveringOnDown = !!this.app.hoveredEntityId;

                this.isDragging = true;
                this.lastX = e.clientX;
                this.lastY = e.clientY;
                c.style.cursor = 'grabbing';
            }

            // Middle Click (button 1)
            if (e.button === 1 && this.app.activeTool === 'draw') {
                e.preventDefault();
                this.app.commitDraft();
                return;
            }

            // Right Click (button 2)
            if (e.button === 2 && this.app.activeTool === 'draw' && this.app.draftPoints && this.app.draftPoints.length > 0) {
                e.preventDefault();
                this.app.isDestructingLastPoint = true;
                this.app.rightClickDownTime = Date.now();

                if (!this.app.isSelectionAnimating) {
                    this.app.isSelectionAnimating = true;
                    requestAnimationFrame(this.app._animationLoop);
                }

                this.app.rightClickDestructTimeout = setTimeout(() => {
                    if (this.app.isDestructingLastPoint) {
                        this.app.removeLastDraftPoint();
                    }
                }, 500);
            }
        });

        // Context Menu (Right Click) -> Seek / Details
        c.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (this.app.currentView !== 'map') return;
            if (this.app.activeTool === 'draw') return;

            const wp = this.renderer.toWorld(e.offsetX, e.offsetY);

            // Vertex Edit: Delete Point
            if (this.app.activeTool === 'vertex-edit' && this.app.selectedEntityId) {
                const ent = this.app.entitiesById.get(this.app.selectedEntityId);
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
            } catch (err) {
                console.error('checkHover failed on right-click:', err);
            }

            if (this.app.hoveredEntityId) {
                const ent = this.app.entitiesById.get(this.app.hoveredEntityId);
                if (ent) {
                    this.app.selectEntity(ent.id, true);
                    // this.app.showContextMenu(ent, e.clientX, e.clientY); // Old context menu overlaps with new info-panel
                }
            } else {
                this.app.hideContextMenu();
            }
        });



        c.addEventListener('dblclick', (e) => {
            if (this.app.currentView !== 'map') return;
            if (e.button === 0) {
                if (this.app.activeTool !== 'pan' && this.app.activeTool !== 'draw') {
                    this.app.toolbar.selectTool('pan');
                    this.app.deselect();
                }
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
            const isPanDrag = this.app.activeTool === 'pan' ||
                (this.app.activeTool === 'transform' && !this.transformMode) ||
                (this.app.activeTool === 'vertex-edit' && this.dragVertexIndex === null) ||
                (this.app.activeTool === 'erase' && !this.wasHoveringOnDown);

            if (this.isDragging && isPanDrag) {
                const dx = e.clientX - this.lastX;
                const dy = e.clientY - this.lastY;
                this.lastX = e.clientX; this.lastY = e.clientY;
                this.renderer.transform.x += dx;
                this.renderer.transform.y += dy;
                this.app.render();
                return;
            }

            // Drawing mode cursor update
            if (this.app.activeTool === 'draw') {
                this.app.updateDraftCursor(wp);

                // Highlight first point for closing polygon
                if (this.app.draftPoints && this.app.draftPoints.length >= 2) {
                    const firstPt = this.app.draftPoints[0];
                    if (distance(wp, firstPt) < 10 / this.renderer.transform.k) {
                        this.app.isHoveringFirstDraftPoint = true;
                        c.style.cursor = 'pointer';

                        if (!this.app.isSelectionAnimating) {
                            this.app.isSelectionAnimating = true;
                            requestAnimationFrame(this.app._animationLoop);
                        }
                    } else {
                        this.app.isHoveringFirstDraftPoint = false;
                        c.style.cursor = 'crosshair';
                    }
                    this.app.render(); // Redraw immediately to show highlight
                } else {
                    this.app.isHoveringFirstDraftPoint = false;
                    c.style.cursor = 'crosshair';
                }

                return;
            }

            // CRITICAL FIX: Enable hover detection in pan mode when NOT dragging (unified Navigate tool)
            // Now expanded to other tools that rely on hover cursors
            if (!this.isDragging && this.app.activeTool !== 'draw') {
                const now = Date.now();

                if (now - this.hoverThrottle > 50) { // Increased throttle to 50ms
                    this.hoverThrottle = now;
                    try {
                        this.app.checkHover(wp);
                    } catch (err) {
                        console.error('checkHover failed:', err);
                        // Reset hover state on error
                        this.app.hoveredEntityId = null;
                    }
                }

                // Handle Vertex Hover Effect
                // Needs to be here so it takes precedence over the default hover cursor from checkHover
                if (this.app.activeTool === 'vertex-edit' && this.app.selectedEntityId && !this.isDragging) {
                    const ent = this.app.entitiesById.get(this.app.selectedEntityId);
                    if (ent && ent.currentGeometry) {
                        const hitIdx = ent.currentGeometry.findIndex(pt => distance(pt, wp) < 10 / this.renderer.transform.k);
                        this.app.highlightVertex(hitIdx !== -1 ? hitIdx : null);

                        if (hitIdx !== -1) {
                            c.style.cursor = 'pointer';
                        } else {
                            // Re-apply checkHover's intended cursor when not over a vertex
                            c.style.cursor = this.app.hoveredEntityId ? 'cell' : 'crosshair';
                        }
                    }
                }

                // Handled correctly by checkHover in main.js, EXCEPT for transform tool bounding box handling.
                // Move this outside the 50ms throttle to prevent hover cursor lag over transform handles.
                // Placed AFTER checkHover so that it takes precedence over the default pointer cursor.
                if (this.app.activeTool === 'transform' && this.app.selectedEntityId) {
                    const hoverMode = this._getTransformHoverMode(wp);
                    if (hoverMode) {
                        if (hoverMode === 'resize-tl' || hoverMode === 'resize-br') {
                            c.style.cursor = 'nwse-resize';
                        } else if (hoverMode === 'resize-tr' || hoverMode === 'resize-bl') {
                            c.style.cursor = 'nesw-resize';
                        } else if (hoverMode === 'move') {
                            c.style.cursor = 'move';
                        }
                    } else {
                        // Re-apply checkHover's intended cursor when not over a transform handle/box
                        c.style.cursor = this.app.hoveredEntityId ? 'pointer' : 'crosshair';
                    }
                }
            }
        });

        window.addEventListener('mouseup', (e) => {
            // Check for Right-Click Destruction Release
            if (e.button === 2 && this.app.activeTool === 'draw') {
                clearTimeout(this.app.rightClickDestructTimeout);

                const clickDuration = Date.now() - this.app.rightClickDownTime;

                if (clickDuration < 500) {
                    if (Date.now() - this.app.lastRightClickUpTime < 300) {
                        this.app.removeLastDraftPoint();
                    } else {
                        // Just a single quick right click, do nothing but reset highlight
                        this.app.isDestructingLastPoint = false;
                        this.app.render();
                    }
                }

                this.app.lastRightClickUpTime = Date.now();
            }

            // Check for Click-to-Deselect (if not dragged significantly)
            const deselectOnClickEmptyTools = ['pan', 'transform', 'vertex-edit', 'erase'];

            if (this.isDragging && deselectOnClickEmptyTools.includes(this.app.activeTool) && !this.wasHoveringOnDown) {
                const dist = distance({ x: e.clientX, y: e.clientY }, { x: this.interactionStartX, y: this.interactionStartY });
                if (dist < CONFIG.CLICK_DRAG_THRESHOLD) {
                    this.app.deselect();
                }
            }

            if (this.isDragging && (this.app.activeTool === 'vertex-edit' || this.app.activeTool === 'transform')) {
                // Finish Edit - Commit Keyframe
                this.app.finishVertexEdit();
            }

            this.isDragging = false;
            this.dragVertexIndex = null;
            this.transformMode = null;
            this.transformStart = null;
            this.originalGeometry = null;

            if (this.app.activeTool === 'pan') {
                const c = document.getElementById('map-canvas');
                if (c) c.style.cursor = 'grab';
            }
        });

        // Spacebar Handler
        window.addEventListener('keydown', (e) => {
            if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;

            // Spacebar handling moved to Timeline.js to avoid double-toggling

            // FOCUS KEYBIND
            if (e.code === 'KeyF') {
                this.app.focusSelectedEntity();
            }

            // LINKING KEYBIND
            if (e.code === 'KeyL' && this.app.currentView === 'timeline') {
                this.app.timeline.isLinking = !this.app.timeline.isLinking;
                this.app.timeline.linkSource = null;
                this.app.timeline.renderView();
            }

            if (this.app.activeTool === 'draw') {
                if (e.key === 'Enter') this.app.commitDraft();
                if (e.key === 'Escape') this.app.cancelDraft();
            }
        });

        // Global document click listener for reverting tools on UI/empty clicks
        const interactiveAreas = [
            'map-canvas',
            'view-timeline',
            'toolbar',
            'info-panel',
            'ontology-modal',
            'atlas-registry'
        ].map(id => document.getElementById(id)).filter(Boolean);

        document.addEventListener('dblclick', (e) => {
            if (this.app.activeTool === 'pan' || this.app.activeTool === 'draw') return; // Draw is exempt

            // Check if the click was inside an interactive area
            const clickedOnInteractiveArea = interactiveAreas.some(area => area.contains(e.target));

            // If click is outside interactive areas, revert tool to pan
            if (!clickedOnInteractiveArea) {
                this.app.toolbar.selectTool('pan');
                this.app.deselect();
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
                const ent = this.app.entitiesById.get(dragTarget);
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

            const ent = this.app.entitiesById.get(dragTarget);
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
                const targetId = dragTarget;
                isDraggingBar = false;
                dragTarget = null;

                // Invalidate or delete connections if range changed
                this.app.invalidateConnectionsFor(targetId);

                this.app.updateInfoPanel(); // Refresh UI if open
                this.app.render(); // Refresh map
            }
        });
    }
}
