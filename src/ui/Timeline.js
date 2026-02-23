/**
 * Timeline Module
 * Handles temporal controls, playback, and visualization (Gantt/Notches)
 */

import { escapeHTML } from '../core/math.js';

const MIN_EPOCH_RANGE = 10;

export default class Timeline {
    constructor(app) {
        this.app = app;

        // UI Refs
        this.yearDisplay = document.getElementById('year-display');
        this.playButton = document.getElementById('btn-play');
        this.notchContainer = document.getElementById('keyframe-notches');
        this.viewContainer = document.getElementById('view-timeline');

        // Custom Track Refs
        this.trackContainer = document.getElementById('timeline-ui-track');
        this.handleStart = document.getElementById('ui-handle-start');
        this.handleEnd = document.getElementById('ui-handle-end');
        this.labelStart = document.getElementById('label-start');
        this.labelEnd = document.getElementById('label-end');
        this.playhead = document.getElementById('ui-playhead');
        this.ticksContainer = document.getElementById('ui-ticks');

        // State
        this.epochStartYear = -1000;
        this.epochEndYear = 2025;
        this.isPlaying = false;
        this.playInterval = null;
        this.isLinking = false;
        this.linkSource = null; // { id, year }

        // Drag State
        this.isDragging = false;
        this.dragTarget = null; // 'start', 'end', 'playhead'
        this.dragStartX = 0;
        this.dragStartYear = 0;
        this.dragStartEpoch = { start: 0, end: 0 };
        this.dragTrackRect = null; // Cached dimensions
        this.dragStartScale = 0;   // Cached scale

        // Edge Scroll State
        this.edgeScrollSpeed = 0;
        this.edgeScrollInterval = null;
        this.lastMouseX = 0;

        // Throttle State
        this.isUpdatePending = false;

        this.init();
    }

    init() {
        if (this.playButton) {
            this.playButton.addEventListener('click', () => {
                this.togglePlayback();
            });
        }

        // Add keyframe navigation buttons if they exist
        const prevBtn = document.getElementById('btn-prev-key');
        const nextBtn = document.getElementById('btn-next-key');
        if (prevBtn) prevBtn.addEventListener('click', () => this.jumpToKeyframe(-1));
        if (nextBtn) nextBtn.addEventListener('click', () => this.jumpToKeyframe(1));

        // Link button in header
        const linkBtn = document.getElementById('btn-timeline-link');
        if (linkBtn) {
            linkBtn.addEventListener('click', () => {
                this.isLinking = !this.isLinking;
                this.linkSource = null;
                this.renderView();
            });
        }

        // Custom Track Interactions
        this.initCustomTrack();

        // Global Keyboard Navigation for Time
        document.addEventListener('keydown', (e) => {
            // Ignore if input is focused
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

            if (e.key === 'ArrowLeft') {
                this.setYear(this.app.currentYear - 1);
            } else if (e.key === 'ArrowRight') {
                this.setYear(this.app.currentYear + 1);
            } else if (e.code === 'Space') {
                e.preventDefault();
                this.togglePlayback();
            }
        });

        // Initial Render
        this.renderCustomTrack();
    }

    _safeFormatYear(year) {
        const rounded = Math.floor(year);
        if (rounded < 0) return `${Math.abs(rounded)} BC`;
        return `${rounded} AD`;
    }

    initCustomTrack() {
        if (!this.trackContainer) return;

        const onMouseDown = (e, target) => {
            e.preventDefault();
            this.isDragging = true;
            this.dragTarget = target;
            this.dragStartX = e.clientX;
            this.dragStartYear = this.app.currentYear; // For playhead
            this.dragStartEpoch = { start: this.epochStartYear, end: this.epochEndYear };

            // Cache dimensions and scale
            this.dragTrackRect = this.trackContainer.getBoundingClientRect();
            const width = this.dragTrackRect.width;
            const range = this.dragStartEpoch.end - this.dragStartEpoch.start;
            this.dragStartScale = width > 0 ? range / width : 0;

            // Initial mouse X for edge scroll detection
            this.lastMouseX = e.clientX;

            document.body.style.cursor = target === 'playhead' ? 'grabbing' : 'col-resize';

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        };

        const onMouseMove = (e) => {
            if (!this.isDragging) return;
            this.lastMouseX = e.clientX;

            // Use cached rect
            const rect = this.dragTrackRect;
            const width = rect.width;
            const dx = e.clientX - this.dragStartX;

            // Handle Edge Scrolling for Zoom Out
            if (this.dragTarget === 'start' || this.dragTarget === 'end') {
                this.handleEdgeScroll(e.clientX, rect);
            }

            // Normal Drag Logic (Zoom In / Adjust)
            if (this.dragTarget === 'playhead') {
                const relX = e.clientX - rect.left;
                const pct = Math.max(0, Math.min(1, relX / width));
                const newYear = Math.round(this.epochStartYear + pct * (this.epochEndYear - this.epochStartYear));
                this.setYear(newYear);

            } else if (this.dragTarget === 'start') {
                // If edge scrolling is active, suppress normal drag to avoid fighting
                if (this.edgeScrollSpeed !== 0) return;

                // Use cached scale
                const deltaYears = Math.round(dx * this.dragStartScale);

                let newStart = this.dragStartEpoch.start + deltaYears;
                if (newStart >= this.epochEndYear - MIN_EPOCH_RANGE) newStart = this.epochEndYear - MIN_EPOCH_RANGE;

                this.epochStartYear = newStart;
                this.requestAppBoundsUpdate();

            } else if (this.dragTarget === 'end') {
                if (this.edgeScrollSpeed !== 0) return;

                const deltaYears = Math.round(dx * this.dragStartScale);

                let newEnd = this.dragStartEpoch.end + deltaYears;
                if (newEnd <= this.epochStartYear + MIN_EPOCH_RANGE) newEnd = this.epochStartYear + MIN_EPOCH_RANGE;

                this.epochEndYear = newEnd;
                this.requestAppBoundsUpdate();
            }
        };

        const onMouseUp = () => {
            this.stopEdgeScroll();
            this.isDragging = false;
            this.dragTarget = null;
            this.dragTrackRect = null;
            document.body.style.cursor = 'default';
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            this.renderCustomTrack();
        };

        // Bind events
        if (this.handleStart) this.handleStart.addEventListener('mousedown', (e) => onMouseDown(e, 'start'));
        if (this.handleEnd) this.handleEnd.addEventListener('mousedown', (e) => onMouseDown(e, 'end'));
        if (this.playhead) this.playhead.addEventListener('mousedown', (e) => onMouseDown(e, 'playhead'));

        // Click track to jump
        this.trackContainer.addEventListener('mousedown', (e) => {
             // Only if clicking background
             if (e.target.closest('.timeline-handle-control') || e.target.id === 'ui-playhead') return;

             const rect = this.trackContainer.getBoundingClientRect();
             const relX = e.clientX - rect.left;
             const pct = Math.max(0, Math.min(1, relX / rect.width));
             const newYear = Math.round(this.epochStartYear + pct * (this.epochEndYear - this.epochStartYear));
             this.setYear(newYear);

             // Start dragging playhead
             onMouseDown(e, 'playhead');
        });
    }

    handleEdgeScroll(mouseX, rect) {
        const threshold = 50; // px from edge

        let speed = 0;

        if (this.dragTarget === 'start') {
            // Left edge
            if (mouseX < rect.left + threshold) {
                const dist = (rect.left + threshold) - mouseX;
                speed = -Math.max(1, dist / 5); // Negative = Decrease Year
            }
        } else if (this.dragTarget === 'end') {
            // Right edge
            if (mouseX > rect.right - threshold) {
                const dist = mouseX - (rect.right - threshold);
                speed = Math.max(1, dist / 5); // Positive = Increase Year
            }
        }

        if (speed !== 0) {
            this.edgeScrollSpeed = speed;
            if (!this.edgeScrollInterval) {
                this.startEdgeScroll();
            }
        } else {
            if (this.edgeScrollSpeed !== 0 || this.edgeScrollInterval) {
                this.stopEdgeScroll();
            }
        }
    }

    startEdgeScroll() {
        if (this.edgeScrollInterval) return;

        const scroll = () => {
            if (!this.isDragging || this.edgeScrollSpeed === 0) {
                this.stopEdgeScroll();
                return;
            }

            // Apply speed
            const multiplier = 2;
            const delta = Math.round(this.edgeScrollSpeed * multiplier);

            if (this.dragTarget === 'start') {
                this.epochStartYear += delta;
                if (this.epochStartYear >= this.epochEndYear - MIN_EPOCH_RANGE) this.epochStartYear = this.epochEndYear - MIN_EPOCH_RANGE;
            } else if (this.dragTarget === 'end') {
                this.epochEndYear += delta;
                if (this.epochEndYear <= this.epochStartYear + MIN_EPOCH_RANGE) this.epochEndYear = this.epochStartYear + MIN_EPOCH_RANGE;
            }

            this.requestAppBoundsUpdate();

            this.edgeScrollInterval = requestAnimationFrame(scroll);
        };

        this.edgeScrollInterval = requestAnimationFrame(scroll);
    }

    stopEdgeScroll() {
        if (this.edgeScrollInterval) {
            cancelAnimationFrame(this.edgeScrollInterval);
            this.edgeScrollInterval = null;
        }
        this.edgeScrollSpeed = 0;

        if (this.isDragging && this.dragTrackRect) {
            const rect = this.dragTrackRect;
            const width = rect.width;
            const dx = this.lastMouseX - this.dragStartX;

            // We use the *initial* scale in onMouseMove.
            const initialScale = this.dragStartScale;

            if (this.dragTarget === 'start') {
                 this.dragStartEpoch.start = this.epochStartYear - Math.round(dx * initialScale);
            } else if (this.dragTarget === 'end') {
                 this.dragStartEpoch.end = this.epochEndYear - Math.round(dx * initialScale);
            }
        }
    }

    requestAppBoundsUpdate() {
        if (!this.isUpdatePending) {
            this.isUpdatePending = true;
            requestAnimationFrame(() => {
                this.renderCustomTrack(); // Fast
                this.updateAppBounds();   // Slow
                this.isUpdatePending = false;
            });
        }
    }

    updateAppBounds() {
        this.renderNotches();
        this.renderView();

        // Also ensure playhead is valid
        if (this.app.currentYear < this.epochStartYear) this.setYear(this.epochStartYear);
        if (this.app.currentYear > this.epochEndYear) this.setYear(this.epochEndYear);
    }

    renderCustomTrack() {
        if (!this.trackContainer) return;

        // Update Labels inside Handles
        if (this.labelStart) {
            // Safe DOM update: Clear and append elements
            this.labelStart.textContent = '';

            const titleSpan = document.createElement('span');
            titleSpan.style.display = 'block';
            titleSpan.style.fontSize = '0.7em';
            titleSpan.style.opacity = '0.7';
            titleSpan.textContent = 'START';

            const yearText = document.createTextNode(this._safeFormatYear(this.epochStartYear));

            this.labelStart.appendChild(titleSpan);
            this.labelStart.appendChild(yearText);
        }
        if (this.labelEnd) {
             this.labelEnd.textContent = '';

             const titleSpan = document.createElement('span');
             titleSpan.style.display = 'block';
             titleSpan.style.fontSize = '0.7em';
             titleSpan.style.opacity = '0.7';
             titleSpan.textContent = 'END';

             const yearText = document.createTextNode(this._safeFormatYear(this.epochEndYear));

             this.labelEnd.appendChild(titleSpan);
             this.labelEnd.appendChild(yearText);
        }

        // Update Playhead Position
        const range = this.epochEndYear - this.epochStartYear;
        const pct = ((this.app.currentYear - this.epochStartYear) / range) * 100;

        if (pct < 0 || pct > 100) {
            this.playhead.style.display = 'none';
        } else {
            this.playhead.style.display = 'block';
            this.playhead.style.left = `${pct}%`;
        }

        this.renderTicks();
    }

    renderTicks() {
        if (!this.ticksContainer) return;
        this.ticksContainer.innerHTML = '';

        const range = this.epochEndYear - this.epochStartYear;
        const rawInterval = range / 8; // aim for 8 ticks
        const magnitude = Math.pow(10, Math.floor(Math.log10(rawInterval)));
        let interval = magnitude;
        if (rawInterval / magnitude >= 5) interval = magnitude * 5;
        else if (rawInterval / magnitude >= 2) interval = magnitude * 2;

        const firstTick = Math.ceil(this.epochStartYear / interval) * interval;

        for (let y = firstTick; y < this.epochEndYear; y += interval) {
            const pct = ((y - this.epochStartYear) / range) * 100;
            if (pct < 10 || pct > 90) continue;

            const tick = document.createElement('div');
            tick.className = 'ui-tick';
            tick.style.left = `${pct}%`;

            const label = document.createElement('span');
            label.className = 'ui-tick-label';
            label.textContent = y;

            tick.appendChild(label);
            this.ticksContainer.appendChild(tick);
        }
    }

    setYear(year) {
        this.app.currentYear = year;

        if (this.yearDisplay) {
            this.yearDisplay.innerHTML = this.app.formatYear(year);
        }

        this.renderCustomTrack();

        this.app.updateEntities();
        this.app.render();
        this.renderView();
    }

    togglePlayback() {
        if (this.isPlaying) {
            this.stop();
        } else {
            this.play();
        }
    }

    play() {
        this.isPlaying = true;
        if (this.playButton) this.playButton.textContent = '||';

        this.playInterval = setInterval(() => {
            // New Standard: 1x = 2 years per second.
            let newYear = this.app.currentYear + (this.app.playbackSpeed / 10);

            if (newYear > this.epochEndYear) newYear = this.epochStartYear;

            this.setYear(newYear);
        }, 50);
    }

    stop() {
        this.isPlaying = false;
        if (this.playButton) this.playButton.textContent = '▶';
        if (this.playInterval) {
            clearInterval(this.playInterval);
            this.playInterval = null;
        }
    }

    // --- VISUALIZATION ---

    renderNotches() {
        if (!this.notchContainer) return;
        this.notchContainer.innerHTML = '';

        if (!this.app.selectedEntityId) return;

        const ent = this.app.entitiesById.get(this.app.selectedEntityId);
        if (!ent) return;

        const min = this.epochStartYear;
        const max = this.epochEndYear;
        const range = max - min;

        ent.timeline.forEach(kf => {
            if (kf.year >= min && kf.year <= max) {
                const percent = ((kf.year - min) / range) * 100;
                const notch = document.createElement('div');
                notch.className = 'keyframe-notch';
                notch.style.left = `${percent}%`;
                notch.title = `Keyframe: ${this.app.formatYear(kf.year)}`;
                this.notchContainer.appendChild(notch);
            }
        });
    }

    jumpToKeyframe(direction) {
        if (!this.app.selectedEntityId) return;
        const ent = this.app.entitiesById.get(this.app.selectedEntityId);
        if (!ent || ent.timeline.length === 0) return;

        let targetYear = null;
        const sortedTimeline = [...ent.timeline].sort((a, b) => a.year - b.year);

        if (direction === -1) { // Previous
            for (let i = sortedTimeline.length - 1; i >= 0; i--) {
                if (sortedTimeline[i].year < this.app.currentYear) {
                    targetYear = sortedTimeline[i].year;
                    break;
                }
            }
        } else { // Next
            for (let i = 0; i < sortedTimeline.length; i++) {
                if (sortedTimeline[i].year > this.app.currentYear) {
                    targetYear = sortedTimeline[i].year;
                    break;
                }
            }
        }

        if (targetYear !== null) {
            this.setYear(targetYear);

            // Auto-adjust epoch if out of bounds (zooming out to include)
            if (targetYear < this.epochStartYear) {
                this.epochStartYear = targetYear - MIN_EPOCH_RANGE;
                this.renderCustomTrack();
                this.updateAppBounds();
            } else if (targetYear > this.epochEndYear) {
                this.epochEndYear = targetYear + MIN_EPOCH_RANGE;
                this.renderCustomTrack();
                this.updateAppBounds();
            }
        }
    }

    renderView() {
        const container = this.viewContainer;
        if (!container || this.app.currentView !== 'timeline') return;

        container.innerHTML = '';

        // Link Info Tooltip
        this.linkInfo = document.getElementById('timeline-link-info');
        if (!this.linkInfo) {
            this.linkInfo = document.createElement('div');
            this.linkInfo.id = 'timeline-link-info';
            this.linkInfo.className = 'timeline-tooltip';
            this.linkInfo.style.display = 'none';
            this.linkInfo.style.position = 'fixed';
            this.linkInfo.style.zIndex = '10000';
            this.linkInfo.style.pointerEvents = 'none';
            document.body.appendChild(this.linkInfo);
        }

        // SVG Layer for connections
        const svgLayer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svgLayer.setAttribute('id', 'timeline-svg-layer');
        svgLayer.style.position = 'absolute';
        svgLayer.style.top = '0';
        svgLayer.style.left = '0';
        svgLayer.style.width = '100%';
        svgLayer.style.height = '100%';
        svgLayer.style.pointerEvents = 'none';
        svgLayer.style.zIndex = '100';

        const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
        const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
        marker.setAttribute("id", "arrowhead");
        marker.setAttribute("viewBox", "0 0 10 10");
        marker.setAttribute("refX", "8");
        marker.setAttribute("refY", "5");
        marker.setAttribute("markerWidth", "6");
        marker.setAttribute("markerHeight", "6");
        marker.setAttribute("orient", "auto-start-reverse");

        const arrowPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        arrowPath.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
        arrowPath.setAttribute("fill", "var(--rubric-red)");
        marker.appendChild(arrowPath);
        defs.appendChild(marker);
        svgLayer.appendChild(defs);

        const header = document.createElement('div');
        header.className = 'timeline-header';

        const linkBtn = document.getElementById('btn-timeline-link');
        if (linkBtn) {
            if (this.isLinking) linkBtn.classList.add('active');
            else linkBtn.classList.remove('active');
        }

        container.appendChild(header);

        // Draw ticks
        const epochStart = this.epochStartYear;
        const epochEnd = this.epochEndYear;
        const totalYears = epochEnd - epochStart;

        for (let i = 0; i <= 10; i++) {
            const tick = document.createElement('div');
            tick.className = 'timeline-ruler-tick';
            tick.style.left = `${i * 10}%`;
            tick.textContent = Math.round(epochStart + (totalYears * (i / 10)));
            header.appendChild(tick);
        }

        // Group by Domain
        const grouped = {};
        this.app.entities.forEach(ent => {
            const domainId = ent.domain || 'unknown';
            if (!grouped[domainId]) grouped[domainId] = [];
            grouped[domainId].push(ent);
        });

        const sortedDomains = Object.keys(grouped).sort((a, b) => {
            const nameA = this.app.ontologyTaxonomy[a]?.domain.name || a;
            const nameB = this.app.ontologyTaxonomy[b]?.domain.name || b;
            return nameA.localeCompare(nameB);
        });

        for (const domainId of sortedDomains) {
            const domainData = this.app.ontologyTaxonomy[domainId];
            const domainLabel = domainData ? domainData.domain.name : (domainId.charAt(0).toUpperCase() + domainId.slice(1));
            const entities = grouped[domainId];

            const groupDiv = document.createElement('div');
            groupDiv.className = 'timeline-group open';

            const groupHeader = document.createElement('div');
            groupHeader.className = 'timeline-group-header';
            groupHeader.innerHTML = `<span class="group-arrow">▼</span> ${escapeHTML(domainLabel)}`;
            groupHeader.onclick = () => {
                const isOpen = groupDiv.classList.toggle('open');
                const arrow = groupHeader.querySelector('.group-arrow');
                if (arrow) arrow.textContent = isOpen ? '▼' : '▶';
            };
            groupDiv.appendChild(groupHeader);

            const groupContent = document.createElement('div');
            groupContent.className = 'timeline-group-content';

            entities.sort((a, b) => a.name.localeCompare(b.name));

            entities.forEach(ent => {
                const row = document.createElement('div');
                row.className = 'timeline-row';

                const label = document.createElement('div');
                label.className = 'timeline-label';
                label.textContent = ent.name;
                row.appendChild(label);

                const track = document.createElement('div');
                track.className = 'timeline-bar-track';

                const startP = Math.max(0, ((ent.validRange.start - epochStart) / totalYears) * 100);
                const endP = Math.min(100, ((ent.validRange.end - epochStart) / totalYears) * 100);
                const widthP = endP - startP;

                if (widthP > 0) {
                    const bar = document.createElement('div');
                    bar.className = 'timeline-bar';
                    bar.style.zIndex = '20';
                    if (this.isLinking && this.linkSource && this.linkSource.id === ent.id) {
                        bar.classList.add('linking-source');
                    }
                    bar.dataset.id = ent.id;
                    bar.style.left = `${startP}%`;
                    bar.style.width = `${widthP}%`;
                    bar.style.backgroundColor = ent.color;

                    if (Number.isFinite(ent.validRange.start)) {
                        const handleL = document.createElement('div');
                        handleL.className = 'timeline-handle handle-l';
                        handleL.addEventListener('mousedown', (e) => {
                            if (this.isLinking) {
                                e.stopPropagation();
                                e.preventDefault();
                                this.handleTimelineClick(ent.id, ent.validRange.start);
                            }
                        });
                        bar.appendChild(handleL);
                    }
                    if (Number.isFinite(ent.validRange.end)) {
                        const handleR = document.createElement('div');
                        handleR.className = 'timeline-handle handle-r';
                        handleR.addEventListener('mousedown', (e) => {
                            if (this.isLinking) {
                                e.stopPropagation();
                                e.preventDefault();
                                this.handleTimelineClick(ent.id, ent.validRange.end);
                            }
                        });
                        bar.appendChild(handleR);
                    }

                    bar.addEventListener('mousedown', (e) => {
                        if (this.isLinking) {
                            e.stopPropagation();
                            e.preventDefault();
                            const rect = bar.getBoundingClientRect();
                            const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                            const year = Math.round(ent.validRange.start + pct * (ent.validRange.end - ent.validRange.start));
                            this.handleTimelineClick(ent.id, year);
                        } else {
                            this.app.selectEntity(ent.id);
                        }
                    });

                    // Context Menu
                    bar.addEventListener('contextmenu', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        this.app.selectEntity(ent.id, true);
                        this.app.showContextMenu(ent, e.clientX, e.clientY);
                    });

                    // Hover interactions
                    bar.addEventListener('mousemove', (e) => {
                        if (this.isLinking) {
                            if (this.linkInfo && this.linkInfo.classList.contains('editor-mode')) return;
                            const rect = bar.getBoundingClientRect();
                            const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                            const year = Math.round(ent.validRange.start + pct * (ent.validRange.end - ent.validRange.start));
                            if (this.linkInfo) {
                                this.linkInfo.innerHTML = `<div class="tooltip-year-hint">${this.app.formatYear(year)}</div>`;
                                this.linkInfo.style.display = 'block';
                                this.linkInfo.style.pointerEvents = 'none';
                                this.updateLinkInfoPos(e);
                            }
                        }
                    });

                    bar.addEventListener('mouseleave', () => {
                        if (this.isLinking) this.hideLinkInfo();
                    });

                    track.appendChild(bar);
                }
                row.appendChild(track);
                groupContent.appendChild(row);
            });

            groupDiv.appendChild(groupContent);
            container.appendChild(groupDiv);
        }

        // Red Line
        const currentPercent = ((this.app.currentYear - epochStart) / totalYears) * 100;
        const lineContainer = document.createElement('div');
        lineContainer.style.position = 'absolute';
        lineContainer.style.top = '70px';
        lineContainer.style.bottom = '20px';
        lineContainer.style.left = '232px';
        lineContainer.style.right = '32px';
        lineContainer.style.pointerEvents = 'none';
        lineContainer.style.zIndex = '10';

        const redLine = document.createElement('div');
        redLine.style.position = 'absolute';
        redLine.style.left = `${currentPercent}%`;
        redLine.style.top = '0';
        redLine.style.bottom = '0';
        redLine.style.width = '2px';
        redLine.style.backgroundColor = 'var(--rubric-red)';

        lineContainer.appendChild(redLine);
        container.appendChild(lineContainer);

        this.renderConnections(svgLayer);
        svgLayer.style.height = `${container.scrollHeight}px`;
        container.appendChild(svgLayer);
    }

    handleTimelineClick(entityId, year) {
        if (!this.linkSource) {
            this.linkSource = { id: entityId, year };
            this.renderView();
        } else {
            if (entityId === this.linkSource.id) {
                this.linkSource = null;
                this.isLinking = false;
                this.renderView();
                return;
            }
            const sourceEnt = this.app.entitiesById.get(this.linkSource.id);
            const targetEnt = this.app.entitiesById.get(entityId);
            if (!sourceEnt || !targetEnt) {
                 this.linkSource = null; this.isLinking = false; this.renderView(); return;
            }
            if (sourceEnt.domain !== targetEnt.domain) {
                this.app.showMessage("Connections can only be made between entities of the same domain.");
                this.linkSource = null; this.isLinking = false; this.renderView(); return;
            }
            const conn = {
                id: 'conn_' + Date.now(),
                fromId: this.linkSource.id,
                fromYear: this.linkSource.year,
                targetId: entityId,
                toYear: this.linkSource.year,
                confirmed: true
            };
            this.app.connections.push(conn);
            this.linkSource = null;
            this.isLinking = false;
            this.renderView();
        }
    }

    renderConnections(svg) {
        if (!this.app.connections || this.app.connections.length === 0) return;

        const containerRect = this.viewContainer.getBoundingClientRect();
        const barElements = new Map();
        this.viewContainer.querySelectorAll('.timeline-bar[data-id]').forEach(el => {
            barElements.set(el.dataset.id, el);
        });

        this.app.connections.forEach(conn => {
            const fromEnt = this.app.entitiesById.get(conn.fromId);
            const targetEnt = this.app.entitiesById.get(conn.targetId);
            if (!fromEnt || !targetEnt) return;
            const fromEl = barElements.get(conn.fromId);
            const toEl = barElements.get(conn.targetId);
            if (!fromEl || !toEl) return;
            const fromRect = fromEl.getBoundingClientRect();
            const toRect = toEl.getBoundingClientRect();
            const epochStart = this.epochStartYear;
            const epochEnd = this.epochEndYear;
            const totalYears = epochEnd - epochStart;
            let x1, y1, x2, y2;
            const trackEl = toEl.parentElement;
            const trackRect = trackEl.getBoundingClientRect();
            const getXForYear = (y) => {
                const pct = (y - epochStart) / totalYears;
                return trackRect.left - containerRect.left + (pct * trackRect.width);
            };
            y1 = fromRect.top + fromRect.height / 2 - containerRect.top + this.viewContainer.scrollTop;
            y2 = toRect.top + toRect.height / 2 - containerRect.top + this.viewContainer.scrollTop;
            const { fromYear, toYear } = this.app.getConnectionYears(conn);
            x1 = getXForYear(fromYear);
            x2 = getXForYear(toYear);
            const isValid = this.app.isConnectionValid(conn);
            const isConfirmed = conn.confirmed;
            const dy = y2 - y1;
            const bow = 30;
            const cp1x = x1 + bow;
            const cp1y = y1;
            const cp2x = x2;
            const cp2y = y2 - Math.sign(dy) * bow;
            const d = `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;

            const hitPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
            hitPath.setAttribute('d', d);
            hitPath.setAttribute('fill', 'none');
            hitPath.setAttribute('stroke', 'rgba(0,0,0,0.01)');
            hitPath.setAttribute('stroke-width', '15');
            hitPath.style.pointerEvents = 'auto';
            hitPath.style.cursor = 'pointer';

            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute('d', d);
            path.setAttribute('fill', 'none');
            const color = (isValid && isConfirmed) ? 'var(--rubric-red)' : '#ff0000';
            path.setAttribute('stroke', color);
            path.setAttribute('stroke-width', '2');
            if (!isValid || !isConfirmed) {
                path.setAttribute('stroke-dasharray', '4,4');
            } else {
                path.setAttribute('marker-end', 'url(#arrowhead)');
            }
            path.style.pointerEvents = 'none';

            const setupInteractions = (el) => {
                el.addEventListener('mouseenter', (e) => {
                    e.stopPropagation();
                    if (this.isLinking) {
                        this.showLinkEditor(e, conn, fromEnt, targetEnt);
                    } else {
                        this.showLinkInfo(e, conn, fromEnt, targetEnt);
                    }
                });
                el.addEventListener('mousemove', (e) => {
                    e.stopPropagation();
                    if (this.isLinking) return;
                    this.updateLinkInfoPos(e);
                });
                el.addEventListener('mouseleave', (e) => {
                    e.stopPropagation();
                    if (!this.linkInfo.classList.contains('editor-mode')) {
                        this.hideLinkInfo();
                    }
                });
                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (this.isLinking) {
                        this.showLinkEditor(e, conn, fromEnt, targetEnt);
                    } else if (!isConfirmed || !isValid) {
                        if (this.app.isConnectionValid(conn)) {
                            conn.confirmed = true;
                            this.renderView();
                        } else {
                            this.app.showConfirm("Delete this connection?", () => {
                                this.app.connections = this.app.connections.filter(c => c.id !== conn.id);
                                this.renderView();
                            });
                        }
                    }
                });
                el.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.showLinkEditor(e, conn, fromEnt, targetEnt);
                });
            };
            setupInteractions(hitPath);
            svg.appendChild(hitPath);
            svg.appendChild(path);
        });
    }

    showLinkInfo(e, conn, fromEnt, toEnt) {
        if (!this.linkInfo) return;
        this.linkInfo.classList.remove('editor-mode');
        this.linkInfo.style.pointerEvents = 'none';
        const { fromYear, toYear } = this.app.getConnectionYears(conn);
        this.linkInfo.innerHTML = `
            <div class="tooltip-title">Connection</div>
            <div class="tooltip-content">
                <strong>From:</strong> ${escapeHTML(fromEnt.name)} (${this.app.formatYear(fromYear)})<br>
                <strong>To:</strong> ${escapeHTML(toEnt.name)} (${this.app.formatYear(toYear)})
            </div>
        `;
        this.linkInfo.style.display = 'block';
        this.updateLinkInfoPos(e);
    }

    showLinkEditor(e, conn, fromEnt, toEnt) {
        if (!this.linkInfo) return;
        this.linkInfo.classList.add('editor-mode');
        this.linkInfo.style.pointerEvents = 'auto';
        const { fromYear, toYear } = this.app.getConnectionYears(conn);
        this.linkInfo.innerHTML = `
            <div class="tooltip-title">Edit Connection</div>
            <div class="tooltip-content" style="display:flex; flex-direction:column; gap:8px;">
                <div style="font-size:0.8rem;">
                    <strong>${escapeHTML(fromEnt.name)}</strong> ↔ <strong>${escapeHTML(toEnt.name)}</strong>
                </div>
                <div style="display:flex; gap:4px; margin-top:5px;">
                    <button class="small-btn" id="delete-link" style="background:var(--rubric-red); color:white; flex:1;">Delete</button>
                    <button class="small-btn" id="close-editor" style="flex:1;">Close</button>
                </div>
            </div>
        `;
        this.linkInfo.style.display = 'block';
        this.updateLinkInfoPos(e);

        document.getElementById('delete-link').onclick = () => {
            this.app.showConfirm(`Delete connection?`, () => {
                this.app.connections = this.app.connections.filter(c => c.id !== conn.id);
                this.hideLinkInfo();
                this.renderView();
            });
        };
        document.getElementById('close-editor').onclick = () => {
            this.hideLinkInfo();
        };
    }

    updateLinkInfoPos(e) {
        if (!this.linkInfo) return;
        this.linkInfo.style.left = (e.clientX + 15) + 'px';
        this.linkInfo.style.top = (e.clientY + 15) + 'px';
    }

    hideLinkInfo() {
        if (this.linkInfo) {
            this.linkInfo.style.display = 'none';
        }
    }
}
