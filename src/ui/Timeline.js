/**
 * Timeline Module
 * Handles temporal controls, playback, and visualization (Gantt/Notches)
 */

export default class Timeline {
    constructor(app) {
        this.app = app;

        // UI Refs
        this.slider = document.getElementById('time-slider');
        this.yearDisplay = document.getElementById('year-display');
        this.playButton = document.getElementById('btn-play');
        this.epochStart = document.getElementById('epoch-start');
        this.epochEnd = document.getElementById('epoch-end');
        this.notchContainer = document.getElementById('keyframe-notches');
        this.viewContainer = document.getElementById('view-timeline');

        // State
        this.isPlaying = false;
        this.playInterval = null;
        this.isLinking = false;
        this.linkSource = null; // { id, side, year }

        this.init();
    }

    init() {
        if (this.slider) {
            this.slider.addEventListener('input', (e) => {
                const year = parseInt(e.target.value);
                this.setYear(year);
            });
        }

        if (this.playButton) {
            this.playButton.addEventListener('click', () => {
                this.togglePlayback();
            });
        }

        // Epoch inputs
        if (this.epochStart && this.epochEnd) {
            const updateBounds = () => this.updateBounds();
            this.epochStart.addEventListener('change', updateBounds);
            this.epochEnd.addEventListener('change', updateBounds);
        }

        // Add keyframe navigation buttons if they exist
        const prevBtn = document.getElementById('btn-prev-key');
        const nextBtn = document.getElementById('btn-next-key');
        if (prevBtn) prevBtn.addEventListener('click', () => this.jumpToKeyframe(-1));
        if (nextBtn) nextBtn.addEventListener('click', () => this.jumpToKeyframe(1));
    }

    updateBounds() {
        if (!this.epochStart || !this.epochEnd || !this.slider) return;
        const start = parseInt(this.epochStart.value);
        const end = parseInt(this.epochEnd.value);

        if (start < end) {
            this.slider.min = start;
            this.slider.max = end;

            // Clamp current year
            let current = this.app.currentYear;
            if (current < start) current = start;
            if (current > end) current = end;

            if (current !== this.app.currentYear) {
                this.setYear(current);
            } else {
                this.renderNotches();
                this.renderView();
            }
        }
    }

    setYear(year) {
        this.app.currentYear = year;

        if (this.yearDisplay) {
            this.yearDisplay.textContent = this.app.formatYear(year);
        }
        if (this.slider) {
            this.slider.value = year;
        }

        this.app.updateEntities();
        this.app.render();
        this.renderView(); // Update Gantt red line
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
        if (this.playButton) this.playButton.textContent = '⏸';

        this.playInterval = setInterval(() => {
            let newYear = this.app.currentYear + this.app.playbackSpeed;
            const min = parseInt(this.slider.min);
            const max = parseInt(this.slider.max);

            if (newYear > max) newYear = min;

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

        const ent = this.app.entities.find(e => e.id === this.app.selectedEntityId);
        if (!ent) return;

        const min = parseInt(this.slider.min);
        const max = parseInt(this.slider.max);
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
        const ent = this.app.entities.find(e => e.id === this.app.selectedEntityId);
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
            const min = parseInt(this.slider.min);
            const max = parseInt(this.slider.max);
            if (targetYear >= min && targetYear <= max) {
                this.setYear(targetYear);
            }
        }
    }

    renderView() {
        const container = this.viewContainer;
        if (!container || this.app.currentView !== 'timeline') return;

        container.innerHTML = ''; // Clear content

        // SVG Layer for connections
        const svgLayer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svgLayer.setAttribute('id', 'timeline-svg-layer');
        svgLayer.style.position = 'absolute';
        svgLayer.style.top = '0';
        svgLayer.style.left = '0';
        svgLayer.style.width = '100%';
        svgLayer.style.height = '100%';
        svgLayer.style.pointerEvents = 'none';
        svgLayer.style.zIndex = '1';

        // Define arrow marker
        const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
        const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
        marker.setAttribute('id', 'arrowhead');
        marker.setAttribute('markerWidth', '10');
        marker.setAttribute('markerHeight', '7');
        marker.setAttribute('refX', '9');
        marker.setAttribute('refY', '3.5');
        marker.setAttribute('orient', 'auto');
        const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        polygon.setAttribute('points', '0 0, 10 3.5, 0 7');
        polygon.setAttribute('fill', 'var(--rubric-red)');
        marker.appendChild(polygon);
        defs.appendChild(marker);

        // Define arrow marker for invalid
        const markerInvalid = document.createElementNS("http://www.w3.org/2000/svg", "marker");
        markerInvalid.setAttribute('id', 'arrowhead-invalid');
        markerInvalid.setAttribute('markerWidth', '10');
        markerInvalid.setAttribute('markerHeight', '7');
        markerInvalid.setAttribute('refX', '9');
        markerInvalid.setAttribute('refY', '3.5');
        markerInvalid.setAttribute('orient', 'auto');
        const polygonInvalid = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        polygonInvalid.setAttribute('points', '0 0, 10 3.5, 0 7');
        polygonInvalid.setAttribute('fill', '#ff0000');
        markerInvalid.appendChild(polygonInvalid);
        defs.appendChild(markerInvalid);

        svgLayer.appendChild(defs);
        container.appendChild(svgLayer);

        // Header
        const header = document.createElement('div');
        header.className = 'timeline-header';

        // Link Tool Button
        const linkBtn = document.createElement('button');
        linkBtn.className = `btn-text ${this.isLinking ? 'active' : ''}`;
        linkBtn.style.marginRight = '1rem';
        linkBtn.style.zIndex = '10';
        linkBtn.textContent = this.isLinking ? 'Linking...' : 'Link Entities';
        linkBtn.onclick = (e) => {
            e.stopPropagation();
            this.isLinking = !this.isLinking;
            this.linkSource = null;
            this.renderView();
        };
        header.appendChild(linkBtn);

        container.appendChild(header);

        // Draw ticks
        const epochStart = parseInt(this.epochStart.value);
        const epochEnd = parseInt(this.epochEnd.value);
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
            // We could persist open state if we wanted

            const groupHeader = document.createElement('div');
            groupHeader.className = 'timeline-group-header';
            groupHeader.innerHTML = `<span class="group-arrow">▼</span> ${domainLabel}`;
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
                    bar.dataset.id = ent.id;
                    bar.style.left = `${startP}%`;
                    bar.style.width = `${widthP}%`;
                    bar.style.backgroundColor = ent.color;

                    if (Number.isFinite(ent.validRange.start)) {
                        const handleL = document.createElement('div');
                        handleL.className = 'timeline-handle handle-l';
                        handleL.onclick = (e) => {
                            if (this.isLinking) {
                                e.stopPropagation();
                                this.handleTimelineClick(ent.id, 'start', ent.validRange.start);
                            }
                        };
                        bar.appendChild(handleL);
                    }
                    if (Number.isFinite(ent.validRange.end)) {
                        const handleR = document.createElement('div');
                        handleR.className = 'timeline-handle handle-r';
                        handleR.onclick = (e) => {
                            if (this.isLinking) {
                                e.stopPropagation();
                                this.handleTimelineClick(ent.id, 'end', ent.validRange.end);
                            }
                        };
                        bar.appendChild(handleR);
                    }

                    bar.onclick = (e) => {
                        if (this.isLinking) {
                            e.stopPropagation();
                            // If it's a target click (not source handle), or source click that isn't on a handle
                            this.handleTimelineClick(ent.id, 'mid', null); // year will be derived from linkSource if it's target
                        } else {
                            this.app.selectEntity(ent.id);
                        }
                    };
                    track.appendChild(bar);
                }
                row.appendChild(track);
                groupContent.appendChild(row);
            });

            groupDiv.appendChild(groupContent);
            container.appendChild(groupDiv);
        }

        // Red Line (Current Time)
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

        // Render Connections
        this.renderConnections(svgLayer);

        // Ensure SVG is tall enough to cover all content
        svgLayer.style.height = `${container.scrollHeight}px`;
    }

    handleTimelineClick(entityId, side, year) {
        if (!this.linkSource) {
            // Pick source (must be a boundary)
            if (side === 'mid') {
                alert("Please select a boundary (start or end) of an entity as the source of the connection.");
                return;
            }
            this.linkSource = { id: entityId, side, year };
            console.log("Link source selected:", this.linkSource);
            this.renderView();
        } else {
            // Pick target
            if (entityId === this.linkSource.id) {
                this.linkSource = null;
                this.renderView();
                return;
            }

            const sourceEnt = this.app.entities.find(e => e.id === this.linkSource.id);
            const targetEnt = this.app.entities.find(e => e.id === entityId);

            if (sourceEnt.domain !== targetEnt.domain) {
                alert("Connections can only be made between entities of the same domain.");
                this.linkSource = null;
                this.renderView();
                return;
            }

            // Create connection
            const conn = {
                id: 'conn_' + Date.now(),
                fromId: this.linkSource.id,
                fromSide: this.linkSource.side,
                targetId: entityId,
                toSide: side, // 'start', 'end', or 'mid'
                year: this.linkSource.year,
                confirmed: true
            };

            this.app.connections.push(conn);
            this.linkSource = null;
            this.isLinking = false;
            this.renderView();
        }
    }

    renderConnections(svg) {
        if (!this.app.connections) return;

        const containerRect = this.viewContainer.getBoundingClientRect();

        this.app.connections.forEach(conn => {
            const fromEl = this.viewContainer.querySelector(`.timeline-bar[data-id="${conn.fromId}"]`);
            const toEl = this.viewContainer.querySelector(`.timeline-bar[data-id="${conn.targetId}"]`);

            if (!fromEl || !toEl) return;

            const fromRect = fromEl.getBoundingClientRect();
            const toRect = toEl.getBoundingClientRect();

            // Calculate relative coordinates
            const epochStart = parseInt(this.epochStart.value);
            const epochEnd = parseInt(this.epochEnd.value);
            const totalYears = epochEnd - epochStart;

            const getYearX = (year) => {
                const percent = (year - epochStart) / totalYears;
                // The track starts at 232px from left? No, let's use the bar's position.
                // Wait, it's easier to just use the bar's boundaries.
                return null; // not used yet
            };

            let x1, y1, x2, y2;

            // Source point
            y1 = fromRect.top + fromRect.height / 2 - containerRect.top + this.viewContainer.scrollTop;
            if (conn.fromSide === 'start') {
                x1 = fromRect.left - containerRect.left;
            } else {
                x1 = fromRect.right - containerRect.left;
            }

            // Target point
            y2 = toRect.top + toRect.height / 2 - containerRect.top + this.viewContainer.scrollTop;

            const trackEl = toEl.parentElement;
            const trackRect = trackEl.getBoundingClientRect();

            const getXForYear = (y) => {
                const pct = (y - epochStart) / totalYears;
                return trackRect.left - containerRect.left + (pct * trackRect.width);
            };

            if (conn.toSide === 'start') {
                x2 = getXForYear(this.app.entities.find(e => e.id === conn.targetId).validRange.start);
            } else if (conn.toSide === 'end') {
                x2 = getXForYear(this.app.entities.find(e => e.id === conn.targetId).validRange.end);
            } else {
                x2 = getXForYear(conn.year);
            }

            // Re-calculate x1 correctly too
            if (conn.fromSide === 'start') {
                x1 = getXForYear(this.app.entities.find(e => e.id === conn.fromId).validRange.start);
            } else {
                x1 = getXForYear(this.app.entities.find(e => e.id === conn.fromId).validRange.end);
            }

            const isValid = this.app.isConnectionValid(conn);
            const isConfirmed = conn.confirmed;

            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");

            // Curved path
            const dx = Math.abs(x2 - x1);
            const dy = Math.abs(y2 - y1);
            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;

            // Draw a curve
            const cp1x = x1 + (x2 - x1) * 0.5;
            const cp1y = y1;
            const cp2x = x1 + (x2 - x1) * 0.5;
            const cp2y = y2;

            path.setAttribute('d', `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`);
            path.setAttribute('fill', 'none');

            const color = (isValid && isConfirmed) ? 'var(--rubric-red)' : '#ff0000';
            path.setAttribute('stroke', color);
            path.setAttribute('stroke-width', '2');

            if (!isValid || !isConfirmed) {
                path.setAttribute('stroke-dasharray', '4,4');
            }

            path.setAttribute('marker-end', (isValid && isConfirmed) ? 'url(#arrowhead)' : 'url(#arrowhead-invalid)');

            // Click to validate
            if (!isConfirmed || !isValid) {
                path.style.cursor = 'pointer';
                path.style.pointerEvents = 'auto';
                path.onclick = (e) => {
                    e.stopPropagation();
                    if (this.app.isConnectionValid(conn)) {
                        conn.confirmed = true;
                        this.renderView();
                    } else {
                        if (confirm("This connection is logically invalid. Delete it?")) {
                            this.app.connections = this.app.connections.filter(c => c.id !== conn.id);
                            this.renderView();
                        }
                    }
                };

                // Add title for tooltip
                const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
                title.textContent = !isValid ? "Invalid: Logic mismatch" : "Unconfirmed: Entity range changed";
                path.appendChild(title);
            }

            svg.appendChild(path);
        });
    }
}
