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
        this.linkSource = null; // { id, year }

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

        // Link button in header
        const linkBtn = document.getElementById('btn-timeline-link');
        if (linkBtn) {
            linkBtn.addEventListener('click', () => {
                this.isLinking = !this.isLinking;
                this.linkSource = null;
                this.renderView();
            });
        }
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

        const ent = this.app.entitiesById.get(this.app.selectedEntityId);
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
        svgLayer.style.zIndex = '100'; // Above everything including bars and labels

        // Markers removed as per request (dropping visual arrow part)
        // container.appendChild(svgLayer); // Moved to end

        // Header
        const header = document.createElement('div');
        header.className = 'timeline-header';

        // Sync header L button state
        const linkBtn = document.getElementById('btn-timeline-link');
        if (linkBtn) {
            if (this.isLinking) linkBtn.classList.add('active');
            else linkBtn.classList.remove('active');
        }

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
                        handleL.style.zIndex = '30';
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
                        handleR.style.zIndex = '30';
                        handleR.addEventListener('mousedown', (e) => {
                            if (this.isLinking) {
                                e.stopPropagation();
                                e.preventDefault();
                                this.handleTimelineClick(ent.id, ent.validRange.end);
                            }
                        });
                        bar.appendChild(handleR);
                    }

                    // Use mousedown to be more responsive and avoid click-through issues
                    bar.addEventListener('mousedown', (e) => {
                        if (this.isLinking) {
                            e.stopPropagation();
                            e.preventDefault();
                            // Calculate year from click position
                            const rect = bar.getBoundingClientRect();
                            const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                            const year = Math.round(ent.validRange.start + pct * (ent.validRange.end - ent.validRange.start));
                            this.handleTimelineClick(ent.id, year);
                        } else {
                            this.app.selectEntity(ent.id);
                        }
                    });

                    // Real-time year indicator on hover
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
                        if (this.isLinking) {
                            this.hideLinkInfo();
                        }
                    });
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
        container.appendChild(svgLayer);
    }

    handleTimelineClick(entityId, year) {
        if (!this.linkSource) {
            // Pick source (can be anywhere now)
            this.linkSource = { id: entityId, year };
            this.renderView();
        } else {
            // Pick target
            if (entityId === this.linkSource.id) {
                // Prevent self-linking
                this.linkSource = null;
                this.isLinking = false;
                this.renderView();
                return;
            }

            const sourceEnt = this.app.entitiesById.get(this.linkSource.id);
            const targetEnt = this.app.entitiesById.get(entityId);

            if (!sourceEnt || !targetEnt) {
                this.linkSource = null;
                this.isLinking = false;
                this.renderView();
                return;
            }

            if (sourceEnt.domain !== targetEnt.domain) {
                this.app.showMessage("Connections can only be made between entities of the same domain.");
                this.linkSource = null;
                this.isLinking = false;
                this.renderView();
                return;
            }

            // Create connection with fromYear and toYear (enforced same year)
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

        // Cache timeline bar elements for performance
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

            // Calculate relative coordinates
            const epochStart = parseInt(this.epochStart.value);
            const epochEnd = parseInt(this.epochEnd.value);
            const totalYears = epochEnd - epochStart;

            let x1, y1, x2, y2;

            // Target track used for X mapping
            const trackEl = toEl.parentElement;
            const trackRect = trackEl.getBoundingClientRect();

            const getXForYear = (y) => {
                const pct = (y - epochStart) / totalYears;
                return trackRect.left - containerRect.left + (pct * trackRect.width);
            };

            // Source point
            y1 = fromRect.top + fromRect.height / 2 - containerRect.top + this.viewContainer.scrollTop;

            // Target point
            y2 = toRect.top + toRect.height / 2 - containerRect.top + this.viewContainer.scrollTop;

            const { fromYear, toYear } = this.app.getConnectionYears(conn);

            x1 = getXForYear(fromYear);
            x2 = getXForYear(toYear);

            const isValid = this.app.isConnectionValid(conn);
            const isConfirmed = conn.confirmed;

            // Curved path coordinates
            const dx = x2 - x1;
            const dy = y2 - y1;
            // Increased bow for better visibility and testing
            const bow = 60;
            const cp1x = x1 + dx * 0.5 + bow;
            const cp1y = y1;
            const cp2x = x1 + dx * 0.5 + bow;
            const cp2y = y2;
            const d = `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;

            // Hit area (invisible thick path)
            const hitPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
            hitPath.setAttribute('data-testid', 'connection-hit-path');
            hitPath.setAttribute('d', d);
            hitPath.setAttribute('fill', 'none');
            // Use almost-transparent stroke for better hit detection in some browsers
            hitPath.setAttribute('stroke', 'rgba(0,0,0,0.01)');
            hitPath.setAttribute('stroke-width', '15');
            hitPath.style.pointerEvents = 'auto';
            hitPath.style.cursor = 'pointer';

            // Visual path
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute('d', d);
            path.setAttribute('fill', 'none');
            const color = (isValid && isConfirmed) ? 'var(--rubric-red)' : '#ff0000';
            path.setAttribute('stroke', color);
            path.setAttribute('stroke-width', '2');
            if (!isValid || !isConfirmed) {
                path.setAttribute('stroke-dasharray', '4,4');
            }
            path.style.pointerEvents = 'none'; // Clicks go to hitPath

            // Interactions on hitPath
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
                            this.app.showConfirm("This connection is logically invalid. Delete it?", () => {
                                this.app.connections = this.app.connections.filter(c => c.id !== conn.id);
                                this.renderView();
                            });
                        }
                    }
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
                <strong>From:</strong> ${fromEnt.name} (${this.app.formatYear(fromYear)})<br>
                <strong>To:</strong> ${toEnt.name} (${this.app.formatYear(toYear)})
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
        const currentYear = fromYear; // They are forced same year anyway

        this.linkInfo.innerHTML = `
            <div class="tooltip-title">Edit Connection</div>
            <div class="tooltip-content" style="display:flex; flex-direction:column; gap:8px;">
                <div style="font-size:0.8rem;">
                    <strong>${fromEnt.name}</strong> ↔ <strong>${toEnt.name}</strong>
                </div>
                <div style="display:flex; align-items:center; gap:5px;">
                    <label>Year:</label>
                    <input type="number" id="link-year-input" value="${currentYear}" style="width:60px;">
                </div>
                <div class="snap-buttons" style="display:grid; grid-template-columns: 1fr 1fr; gap:4px;">
                    <button class="small-btn" id="snap-from-start">Src Start</button>
                    <button class="small-btn" id="snap-from-end">Src End</button>
                    <button class="small-btn" id="snap-to-start">Tgt Start</button>
                    <button class="small-btn" id="snap-to-end">Tgt End</button>
                </div>
                <div style="display:flex; gap:4px; margin-top:5px;">
                    <button class="small-btn" id="delete-link" style="background:var(--rubric-red); color:white; flex:1;">Delete</button>
                    <button class="small-btn" id="close-editor" style="flex:1;">Close</button>
                </div>
            </div>
        `;

        this.linkInfo.style.display = 'block';
        this.updateLinkInfoPos(e);

        // Bind events
        const input = document.getElementById('link-year-input');
        input.onchange = (ev) => {
            const val = parseInt(ev.target.value);
            if (!isNaN(val)) {
                conn.fromYear = val;
                conn.toYear = val;
                this.app.render();
                this.renderView();
            }
        };

        document.getElementById('snap-from-start').onclick = () => {
            const yr = fromEnt.validRange.start;
            if (Number.isFinite(yr)) {
                conn.fromYear = yr; conn.toYear = yr;
                this.app.render(); this.renderView();
            }
        };
        document.getElementById('snap-from-end').onclick = () => {
            const yr = fromEnt.validRange.end;
            if (Number.isFinite(yr)) {
                conn.fromYear = yr; conn.toYear = yr;
                this.app.render(); this.renderView();
            }
        };
        document.getElementById('snap-to-start').onclick = () => {
            const yr = toEnt.validRange.start;
            if (Number.isFinite(yr)) {
                conn.fromYear = yr; conn.toYear = yr;
                this.app.render(); this.renderView();
            }
        };
        document.getElementById('snap-to-end').onclick = () => {
            const yr = toEnt.validRange.end;
            if (Number.isFinite(yr)) {
                conn.fromYear = yr; conn.toYear = yr;
                this.app.render(); this.renderView();
            }
        };
        document.getElementById('delete-link').onclick = () => {
            this.app.showConfirm(`Delete connection between ${fromEnt.name} and ${toEnt.name}?`, () => {
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
