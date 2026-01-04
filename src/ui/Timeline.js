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

        // If structure is not built, build it. 
        // Note: For performance, we might want to only update the red line if structure is there.
        // But for now, let's just perform partial rebuild or check content.
        // Assuming naive rebuild for safety as per original code.

        container.innerHTML = ''; // Clear content

        // Header
        const header = document.createElement('div');
        header.className = 'timeline-header';
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
                    bar.style.left = `${startP}%`;
                    bar.style.width = `${widthP}%`;
                    bar.style.backgroundColor = ent.color;

                    if (Number.isFinite(ent.validRange.start)) {
                        const handleL = document.createElement('div');
                        handleL.className = 'timeline-handle handle-l';
                        bar.appendChild(handleL);
                    }
                    if (Number.isFinite(ent.validRange.end)) {
                        const handleR = document.createElement('div');
                        handleR.className = 'timeline-handle handle-r';
                        bar.appendChild(handleR);
                    }
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
    }
}
