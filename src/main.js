import MedievalRenderer from './renderer/MedievalRenderer.js';
import InputController from './ui/InputController.js';
import HistoricalEntity from './core/Entity.js';
import { distance, getCentroid, distanceToSegment, isPointInPolygon, getBoundingBox } from './core/math.js';

export default class IlluminarchismApp {
    constructor() {
        // FORCE TAXONOMY DEFINITION FIRST
        this.taxonomy = {
            'political': [
                { value: 'polity', label: 'Realm/Polity', abbr: 'RLM' },
                { value: 'city', label: 'Settlement/City', abbr: 'CIT' },
                { value: 'vassal', label: 'Vassal/Subject', abbr: 'VSL' }
            ],
            'geographical': [
                { value: 'water', label: 'Water Body', abbr: 'SEA' },
                { value: 'river', label: 'River', abbr: 'RIV' }
            ],
            'cultural': [
                { value: 'practice', label: 'Custom/Practice', abbr: 'CST' }
            ],
            'linguistic': [
                { value: 'language', label: 'Language Area', abbr: 'LNG' },
                { value: 'word', label: 'Word/Lexicon', abbr: 'WRD' },
                { value: 'sound', label: 'Sound/Phoneme', abbr: 'SND' }
            ],
            'faith': [
                { value: 'religion', label: 'Religion', abbr: 'REL' },
                { value: 'sect', label: 'Sect', abbr: 'SCT' },
                { value: 'diaspora', label: 'Diaspora', abbr: 'DSP' }
            ]
        };

        this.renderer = new MedievalRenderer('map-canvas');
        this.input = new InputController(this);
        this.entities = [];
        this.hoveredEntityId = null;
        this.selectedEntityId = null;
        this.currentYear = 1000;
        this.draftPoints = [];
        this.draftCursor = null;
        this.activeTool = 'pan';
        this.drawCategory = 'political';
        this.drawType = 'polity';
        this.playbackSpeed = 10;
        this.highlightedVertexIndex = null;

        this.uiRefs = {}; // Store UI elements here

        this.isPlaying = false;
        this.playInterval = null;

        this.initData();
        this.initUI();
        this.updateEntities();
        this.renderRegistry();
        this.render();
    }

    // --- TRANSFORM LOGIC ---
    applyTransform(mode, originalGeo, startMouse, currentMouse, keepAspect) {
        if (!this.selectedEntityId) return;
        const ent = this.entities.find(e => e.id === this.selectedEntityId);
        if (!ent) return;

        // Calculate Delta
        const dx = currentMouse.x - startMouse.x;
        const dy = currentMouse.y - startMouse.y;

        if (mode === 'move') {
            // Simple Translation
            ent.currentGeometry = originalGeo.map(p => ({
                x: p.x + dx,
                y: p.y + dy
            }));
        } else if (mode.startsWith('resize')) {
            // Scaling Logic
            const bbox = getBoundingBox(originalGeo);
            let scaleX = 1, scaleY = 1;
            let anchorX = 0, anchorY = 0;

            // Determine Anchor based on handle
            if (mode === 'resize-tl') { anchorX = bbox.maxX; anchorY = bbox.maxY; }
            else if (mode === 'resize-tr') { anchorX = bbox.minX; anchorY = bbox.maxY; }
            else if (mode === 'resize-bl') { anchorX = bbox.maxX; anchorY = bbox.minY; }
            else if (mode === 'resize-br') { anchorX = bbox.minX; anchorY = bbox.minY; }

            const originalW = Math.max(0.1, bbox.maxX - bbox.minX);
            const originalH = Math.max(0.1, bbox.maxY - bbox.minY);

            // Calculate Scale Factors
            // Note: Logic simplifies depending on quadrant. 
            // For BR handle: newW = origW + dx.
            if (mode === 'resize-br') {
                scaleX = (originalW + dx) / originalW;
                scaleY = (originalH + dy) / originalH;
            } else if (mode === 'resize-tl') {
                scaleX = (originalW - dx) / originalW;
                scaleY = (originalH - dy) / originalH;
            } else if (mode === 'resize-tr') {
                scaleX = (originalW + dx) / originalW;
                scaleY = (originalH - dy) / originalH;
            } else if (mode === 'resize-bl') {
                scaleX = (originalW - dx) / originalW;
                scaleY = (originalH + dy) / originalH;
            }

            if (keepAspect) {
                // Take the larger scale factor
                const s = Math.max(Math.abs(scaleX), Math.abs(scaleY));
                scaleX = scaleX < 0 ? -s : s;
                scaleY = scaleY < 0 ? -s : s;
            }

            // Apply Scale relative to Anchor
            ent.currentGeometry = originalGeo.map(p => ({
                x: anchorX + (p.x - anchorX) * scaleX,
                y: anchorY + (p.y - anchorY) * scaleY
            }));
        }

        this.render();
    }

    initData() {
        // Geographical
        const seaNorth = new HistoricalEntity('sea_north', 'Mare Borealis', 'geographical', 'water', '#264e86', null, 'waves');
        seaNorth.addKeyframe(-10000, [{ x: 0, y: -400 }, { x: 500, y: -400 }, { x: 500, y: 0 }, { x: 0, y: 0 }], true);
        seaNorth.addKeyframe(2025, [{ x: -10, y: -410 }, { x: 510, y: -410 }, { x: 510, y: 10 }, { x: -10, y: 10 }], true);
        this.entities.push(seaNorth);

        const seaSouth = new HistoricalEntity('sea_south', 'Mare Australis', 'geographical', 'water', '#264e86', null, 'waves');
        seaSouth.addKeyframe(-10000, [{ x: 0, y: -100 }, { x: 500, y: -100 }, { x: 500, y: 300 }, { x: 0, y: 300 }], true);
        seaSouth.addKeyframe(2025, [{ x: -10, y: -110 }, { x: 510, y: -110 }, { x: 510, y: 310 }, { x: -10, y: 310 }], true);
        this.entities.push(seaSouth);

        // Political
        const mainland = new HistoricalEntity('mainland', 'Regnum Magna', 'political', 'polity', '#264e86', null, 'diagonal-right');
        mainland.addKeyframe(-2000, [{ x: -300, y: -100 }, { x: -100, y: -100 }, { x: -100, y: 100 }, { x: -300, y: 100 }], true);
        mainland.addKeyframe(2025, [{ x: -300, y: -100 }, { x: -100, y: -100 }, { x: -100, y: 100 }, { x: -300, y: 100 }], true);
        this.entities.push(mainland);

        const island = new HistoricalEntity('island', 'Insula Minor', 'political', 'polity', '#264e86', null, 'diagonal-left');
        island.addKeyframe(-2000, [{ x: 200, y: -50 }, { x: 300, y: -50 }, { x: 300, y: 50 }, { x: 200, y: 50 }], true);
        island.addKeyframe(2025, [{ x: 200, y: -50 }, { x: 300, y: -50 }, { x: 300, y: 50 }, { x: 200, y: 50 }], true);
        this.entities.push(island);

        const bridge = new HistoricalEntity('bridge', 'The Causeway', 'political', 'polity', '#8a3324', null, 'vertical');
        bridge.addKeyframe(-2000, [{ x: -100, y: -10 }, { x: 200, y: -10 }, { x: 200, y: 10 }, { x: -100, y: 10 }], true);
        bridge.addKeyframe(2025, [{ x: -100, y: -10 }, { x: 200, y: -10 }, { x: 200, y: 10 }, { x: -100, y: 10 }], true);
        this.entities.push(bridge);

        const city = new HistoricalEntity('city_capital', 'Urbs Aeterna', 'political', 'city', '#000000');
        city.addKeyframe(-1000, [{ x: 0, y: 0 }]);
        this.entities.push(city);

        // Linguistic
        const oldTongue = new HistoricalEntity('lang_old', 'Lingua Antiqua', 'linguistic', 'language', '#5c3c92', null, 'cross');
        oldTongue.addKeyframe(800, [{ x: -280, y: -80 }, { x: -120, y: -80 }, { x: -120, y: 80 }, { x: -280, y: 80 }], true);
        this.entities.push(oldTongue);

        // NEW ENTITIES FROM SNIPPET
        const thSound = new HistoricalEntity('sound_th', 'Theta Isogloss', 'linguistic', 'sound', '#800080', null, 'stipple');
        thSound.addKeyframe(1200, [{ x: -250, y: -50 }, { x: -150, y: -50 }, { x: -150, y: 50 }, { x: -250, y: 50 }], true);
        this.entities.push(thSound);

        const sodaWord = new HistoricalEntity('word_soda', 'Soda/Pop Line', 'linguistic', 'word', '#FF4500', null, 'stipple');
        sodaWord.addKeyframe(1900, [{ x: -200, y: -100 }, { x: -100, y: -100 }, { x: -100, y: 0 }, { x: -200, y: 0 }], true);
        this.entities.push(sodaWord);


        // Cultural
        const festivalZone = new HistoricalEntity('cult_fest', 'Solar Calendar Zone', 'cultural', 'practice', '#c5a059', null, 'vertical');
        festivalZone.addKeyframe(900, [{ x: -290, y: -90 }, { x: 100, y: -90 }, { x: 100, y: 90 }, { x: -290, y: 90 }], true);
        this.entities.push(festivalZone);

        // Faith
        const paganEnclave = new HistoricalEntity('faith_pagan', 'Old Gods', 'faith', 'religion', '#228B22', null, 'stipple');
        paganEnclave.addKeyframe(-500, [{ x: 250, y: -50 }, { x: 350, y: -50 }, { x: 350, y: 50 }, { x: 250, y: 50 }], true);
        this.entities.push(paganEnclave);
    }

    formatYear(year) {
        if (year < 0) return `${Math.abs(year)} BC`;
        return `${year} AD`;
    }

    // --- NEW: Helper to update the dial state ---
    updateDialDisplay() {
        const domainEl = document.getElementById('val-domain');
        const formEl = document.getElementById('val-form');
        const rankEl = document.getElementById('val-rank');

        // 1. Get Abbr for current category
        let catKey = this.drawCategory;
        const catAbbrMap = {
            'political': 'POL', 'geographical': 'GEO', 'cultural': 'CUL',
            'linguistic': 'LIN', 'faith': 'FAI'
        };

        domainEl.textContent = catAbbrMap[catKey] || 'UNK';

        // 2. Get Abbr for current type
        const types = this.taxonomy[catKey];
        const currentTypeObj = types.find(t => t.value === this.drawType);

        if (currentTypeObj) {
            formEl.textContent = currentTypeObj.abbr;
        } else {
            // Fallback if type mismatch (e.g. switching category)
            formEl.textContent = '---';
        }

        // 3. Rank is placeholder for now
        rankEl.textContent = '---';
    }

    // --- NEW: Advance dial to next option ---
    cycleDial(wheel) {
        if (wheel === 'domain') {
            const cats = Object.keys(this.taxonomy);
            let idx = cats.indexOf(this.drawCategory);
            idx = (idx + 1) % cats.length;
            this.drawCategory = cats[idx];

            // Auto-select first type of new category
            this.drawType = this.taxonomy[this.drawCategory][0].value;
        }
        else if (wheel === 'form') {
            const types = this.taxonomy[this.drawCategory];
            let idx = types.findIndex(t => t.value === this.drawType);
            idx = (idx + 1) % types.length;
            this.drawType = types[idx].value;
        }

        this.updateDialDisplay();
        // If draw tool active, reset logic? Not strictly needed as we read state directly
    }

    // NEW HELPER: Safe Add Listener
    safeAddListener(id, event, handler) {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener(event, handler);
        } else {
            console.warn(`Element with ID '${id}' not found. Event '${event}' not bound.`);
        }
    }

    // Moved updateTypeDropdown here for clarity and safety
    updateTypeDropdown() {
        // No longer used, but kept for logic consistency if referenced
        const cat = this.drawCategory;
        const select = document.getElementById('draw-type-select');
        if (!select) return; // Guard clause
        select.innerHTML = ''; // Clear existing

        const options = this.taxonomy[cat];
        options.forEach(opt => {
            const el = document.createElement('option');
            el.value = opt.value;
            el.textContent = opt.label;
            select.appendChild(el);
        });

        // Reset current type to the first option of the new category
        this.drawType = options[0].value;
        select.value = this.drawType;
    }

    initUI() {
        // Store refs with defensive check
        this.uiRefs.slider = document.getElementById('time-slider');
        this.uiRefs.display = document.getElementById('year-display');
        this.uiRefs.playBtn = document.getElementById('btn-play');

        if (this.uiRefs.display) {
            this.uiRefs.display.textContent = this.formatYear(this.currentYear);
        }

        if (this.uiRefs.slider) {
            this.uiRefs.slider.addEventListener('input', (e) => {
                this.currentYear = parseInt(e.target.value);
                if (this.uiRefs.display) this.uiRefs.display.textContent = this.formatYear(this.currentYear);
                this.updateEntities();
                this.render();
            });
        }

        // Add keyframe navigation buttons safely
        this.safeAddListener('btn-prev-key', 'click', () => this.jumpToKeyframe(-1));
        this.safeAddListener('btn-next-key', 'click', () => this.jumpToKeyframe(1));

        const epochStart = document.getElementById('epoch-start');
        const epochEnd = document.getElementById('epoch-end');

        const updateTimelineBounds = () => {
            if (!epochStart || !epochEnd) return;
            const start = parseInt(epochStart.value);
            const end = parseInt(epochEnd.value);

            if (start < end && this.uiRefs.slider) {
                this.uiRefs.slider.min = start;
                this.uiRefs.slider.max = end;
                // Clamp current value
                if (this.currentYear < start) {
                    this.currentYear = start;
                    this.uiRefs.slider.value = start;
                }
                if (this.currentYear > end) {
                    this.currentYear = end;
                    this.uiRefs.slider.value = end;
                }
                if (this.uiRefs.display) this.uiRefs.display.textContent = this.formatYear(this.currentYear);
                this.updateEntities();
                this.renderTimelineNotches(); // Update notches on bound change
                this.render();
            }
        };

        this.safeAddListener('epoch-start', 'change', updateTimelineBounds);
        this.safeAddListener('epoch-end', 'change', updateTimelineBounds);

        this.safeAddListener('speed-slider', 'input', (e) => {
            this.playbackSpeed = parseInt(e.target.value);
        });

        if (this.uiRefs.playBtn) {
            this.uiRefs.playBtn.addEventListener('click', () => this.togglePlay());
        }

        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.tool-btn').forEach(t => t.classList.remove('active'));
                e.currentTarget.classList.add('active');
                this.setTool(e.currentTarget.dataset.tool);
            });
        });

        // --- DIAL LISTENERS ---
        this.safeAddListener('dial-domain', 'mousedown', (e) => {
            e.preventDefault(); // Prevent text selection
            this.cycleDial('domain');
        });
        this.safeAddListener('dial-form', 'mousedown', (e) => {
            e.preventDefault();
            this.cycleDial('form');
        });

        // Initialize Dial
        this.updateDialDisplay();

        // Registry Toggle
        this.safeAddListener('btn-toggle-registry', 'click', () => {
            const registry = document.getElementById('atlas-registry');
            if (registry) {
                registry.classList.toggle('open');
                this.renderRegistry(); // Refresh
            }
        });

        // Info Panel Close Button
        this.safeAddListener('modal-close', 'click', () => {
            const modal = document.getElementById('ontology-modal');
            if (modal) modal.classList.remove('visible');
        });

        // Ontology Button
        this.safeAddListener('btn-ontology', 'click', () => {
            const modal = document.getElementById('ontology-modal');
            if (modal) modal.classList.add('visible');
        });


        this.safeAddListener('btn-deselect', 'click', () => this.deselect());
        this.safeAddListener('btn-update-meta', 'click', () => this.updateSelectedMetadata());

        // HATCH INPUT LISTENER
        this.safeAddListener('info-hatch-input', 'change', () => this.updateSelectedMetadata());


        this.safeAddListener('btn-save', 'click', () => this.saveAtlas());

        const fileInput = document.getElementById('file-input');
        this.safeAddListener('btn-load', 'click', () => { if (fileInput) fileInput.click(); });

        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.loadAtlas(e));
        }

        this.safeAddListener('btn-reset-view', 'click', () => {
            this.renderer.transform = { x: this.renderer.width / 2, y: this.renderer.height / 2, k: 1 };
            this.render();
        });

        // Initial render of notches if anything selected (unlikely on load but good practice)
        this.renderTimelineNotches();
    }

    renderRegistry() {
        const container = document.getElementById('registry-content');
        container.innerHTML = '';

        const grouped = {};
        this.entities.forEach(ent => {
            if (!grouped[ent.category]) grouped[ent.category] = [];
            grouped[ent.category].push(ent);
        });

        for (const cat in grouped) {
            const catDiv = document.createElement('div');
            catDiv.className = 'registry-category';

            const title = document.createElement('div');
            title.className = 'registry-cat-title';
            title.textContent = `▶ ${cat.charAt(0).toUpperCase() + cat.slice(1)}`;
            title.onclick = () => {
                const list = title.nextElementSibling;
                list.classList.toggle('open');
                title.textContent = list.classList.contains('open') ? `▼ ${cat.charAt(0).toUpperCase() + cat.slice(1)}` : `▶ ${cat.charAt(0).toUpperCase() + cat.slice(1)}`;
            };
            catDiv.appendChild(title);

            const list = document.createElement('div');
            list.className = 'registry-list';

            grouped[cat].forEach(ent => {
                const item = document.createElement('div');
                item.className = 'registry-item';

                const left = document.createElement('div');
                left.style.display = 'flex'; left.style.alignItems = 'center';

                const toggle = document.createElement('input');
                toggle.type = 'checkbox';
                toggle.className = 'toggle-vis';
                toggle.checked = ent.visible;
                toggle.onclick = (e) => {
                    e.stopPropagation();
                    ent.visible = toggle.checked;
                    this.render();
                };
                left.appendChild(toggle);

                const nameSpan = document.createElement('span');
                nameSpan.textContent = ent.name;
                left.appendChild(nameSpan);

                item.appendChild(left);

                const goTo = document.createElement('span');
                goTo.innerHTML = '⌖';
                goTo.title = "Go to location";
                goTo.style.fontSize = '0.8rem';

                item.onclick = () => {
                    this.selectEntity(ent.id, false); // Jump to it, don't open panel
                    // Pan to entity
                    if (ent.currentGeometry && ent.currentGeometry.length > 0) {
                        let c = { x: 0, y: 0 };
                        if (ent.type === 'city') {
                            c = ent.currentGeometry[0];
                        } else {
                            c = getCentroid(ent.currentGeometry);
                        }
                        this.renderer.transform.x = this.renderer.width / 2 - c.x * this.renderer.transform.k;
                        this.renderer.transform.y = this.renderer.height / 2 - c.y * this.renderer.transform.k;
                        this.render();
                    }
                };
                item.appendChild(goTo);
                list.appendChild(item);
            });

            catDiv.appendChild(list);
            container.appendChild(catDiv);
        }
    }

    renderTimelineNotches() {
        const container = document.getElementById('keyframe-notches');
        container.innerHTML = '';

        if (!this.selectedEntityId) return;

        const ent = this.entities.find(e => e.id === this.selectedEntityId);
        if (!ent) return;

        const min = parseInt(this.uiRefs.slider.min);
        const max = parseInt(this.uiRefs.slider.max);
        const range = max - min;

        ent.timeline.forEach(kf => {
            if (kf.year >= min && kf.year <= max) {
                const percent = ((kf.year - min) / range) * 100;
                const notch = document.createElement('div');
                notch.className = 'keyframe-notch';
                notch.style.left = `${percent}%`;
                notch.title = `Keyframe: ${this.formatYear(kf.year)}`;
                container.appendChild(notch);
            }
        });
    }

    jumpToKeyframe(direction) {
        if (!this.selectedEntityId) return;
        const ent = this.entities.find(e => e.id === this.selectedEntityId);
        if (!ent || ent.timeline.length === 0) return;

        let targetYear = null;

        // Sort timeline just in case
        const sortedTimeline = [...ent.timeline].sort((a, b) => a.year - b.year);

        if (direction === -1) { // Previous
            // Find largest year strictly less than current
            for (let i = sortedTimeline.length - 1; i >= 0; i--) {
                if (sortedTimeline[i].year < this.currentYear) {
                    targetYear = sortedTimeline[i].year;
                    break;
                }
            }
        } else { // Next
            // Find smallest year strictly greater than current
            for (let i = 0; i < sortedTimeline.length; i++) {
                if (sortedTimeline[i].year > this.currentYear) {
                    targetYear = sortedTimeline[i].year;
                    break;
                }
            }
        }

        if (targetYear !== null) {
            // Update State
            this.currentYear = targetYear;

            // Update UI (Slider + Display)
            // Check bounds first to avoid weird UI states
            const min = parseInt(this.uiRefs.slider.min);
            const max = parseInt(this.uiRefs.slider.max);
            if (targetYear >= min && targetYear <= max) {
                this.uiRefs.slider.value = targetYear;
                this.uiRefs.display.textContent = this.formatYear(this.currentYear);
                this.updateEntities();
                this.render();
            }
        }
    }

    togglePlay() {
        if (this.isPlaying) {
            this.isPlaying = false;
            clearInterval(this.playInterval);
            this.uiRefs.playBtn.textContent = '▶';
        } else {
            this.isPlaying = true;
            this.uiRefs.playBtn.textContent = '⏸';
            this.playInterval = setInterval(() => {
                let y = parseInt(this.uiRefs.slider.value) + this.playbackSpeed;

                // Loop within EPOCH BOUNDS not slider bounds
                const min = parseInt(this.uiRefs.slider.min);
                const max = parseInt(this.uiRefs.slider.max);

                if (y > max) y = min;

                this.uiRefs.slider.value = y;
                this.currentYear = y;
                this.uiRefs.display.textContent = this.formatYear(y);
                this.updateEntities();
                this.render();
            }, 50);
        }
    }

    saveAtlas() {
        const data = JSON.stringify(this.entities, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `atlas_backup_${new Date().toISOString().slice(0, 10)}.atlas`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    loadAtlas(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const rawData = JSON.parse(e.target.result);
                this.entities = rawData.map(obj => HistoricalEntity.fromJSON(obj));
                this.updateEntities();
                this.renderRegistry();
                this.render();
                alert('Atlas loaded successfully.');
            } catch (err) { console.error(err); alert('Failed to parse atlas file.'); }
        };
        reader.readAsText(file);
        event.target.value = '';
    }

    setTool(name) {
        this.activeTool = name;
        this.cancelDraft();

        const hint = document.getElementById('draw-hint');
        const isAnnex = this.drawType === 'vassal'; // Implicit annex mode for vassals

        if (name === 'draw') {
            hint.classList.add('visible');
            if (this.selectedEntityId && isAnnex) {
                const ent = this.entities.find(e => e.id === this.selectedEntityId);
                hint.textContent = `VASSAL MODE: Create NEW ${this.drawCategory} entity linked to ${ent.name}.`;
            } else if (this.selectedEntityId) {
                const ent = this.entities.find(e => e.id === this.selectedEntityId);
                hint.textContent = `EDITING: Redrawing geometry for ${ent.name} in ${this.currentYear}.`;
            } else {
                if (this.drawType === 'city') hint.textContent = "Click once to place City.";
                else hint.textContent = `Click to draw new ${this.drawCategory} ${this.drawType}. Double-click to finish.`;
            }
        } else if (name === 'transform') {
            hint.classList.add('visible');
            hint.textContent = "TRANSFORM: Drag corners to Resize (Hold Shift for Aspect Ratio). Drag center to Move.";
        } else {
            hint.classList.remove('visible');
        }

        const c = this.renderer.canvas;
        c.style.cursor = 'default';
        if (name === 'pan') c.style.cursor = 'grab';
        else if (name === 'draw') c.style.cursor = 'crosshair';
        else if (name === 'erase') c.style.cursor = 'not-allowed';
        else if (name === 'vertex-edit') c.style.cursor = 'alias';

        this.render();
    }

    addDraftPoint(p) {
        const last = this.draftPoints[this.draftPoints.length - 1];
        if (last && Math.abs(last.x - p.x) < 2 && Math.abs(last.y - p.y) < 2) return;
        this.draftPoints.push(p);
        this.render();
    }

    updateDraftCursor(p) { this.draftCursor = p; this.render(); }

    commitDraft() {
        if (this.draftPoints.length === 0) return;
        if (this.drawType !== 'city' && this.draftPoints.length < 2) return;

        const isAnnex = this.drawType === 'vassal';

        if (this.selectedEntityId) {
            const ent = this.entities.find(e => e.id === this.selectedEntityId);
            if (ent) {
                if (isAnnex) {
                    const id = 'vassal_' + Date.now();
                    const newEnt = new HistoricalEntity(id, ent.name + " (Sub)", this.drawCategory, this.drawType, ent.color, ent.id);
                    // New shape creation (no resampling)
                    newEnt.addKeyframe(this.currentYear, [...this.draftPoints], true);
                    newEnt.validRange.start = this.currentYear;
                    newEnt.validRange.end = this.currentYear + 200;
                    this.entities.push(newEnt);
                    this.selectEntity(id);
                    this.renderRegistry();
                } else {
                    // Updating existing shape (no resampling to preserve corners)
                    ent.addKeyframe(this.currentYear, [...this.draftPoints], true);
                    this.updateInfoPanel(ent);
                }
            }
        } else {
            const id = 'ent_' + Date.now();
            const colors = ['#8a3324', '#264e86', '#c5a059', '#3a5f3a', '#5c3c92'];
            const color = colors[Math.floor(Math.random() * colors.length)];
            let name = "New Territory";
            if (this.drawType === 'city') name = "New Settlement";
            if (this.drawType === 'river') name = "New River";
            if (this.drawType === 'water') name = "New Sea/Lake";

            const newEnt = new HistoricalEntity(id, name, this.drawCategory, this.drawType, color);
            // New shape creation (no resampling)
            newEnt.addKeyframe(this.currentYear, [...this.draftPoints], true);
            newEnt.validRange.start = this.currentYear - 200;
            newEnt.validRange.end = this.currentYear + 200;

            this.entities.push(newEnt);
            this.selectEntity(id);
            this.renderRegistry();
        }

        this.draftPoints = [];
        this.draftCursor = null;
        this.updateEntities();
        this.render();
        if (this.activeTool === 'draw') this.setTool('draw');
    }

    cancelDraft() { this.draftPoints = []; this.draftCursor = null; this.render(); }

    deleteEntity(id) {
        this.entities = this.entities.filter(e => e.id !== id);
        if (this.selectedEntityId === id) this.deselect();
        this.hoveredEntityId = null;
        this.updateEntities();
        this.renderRegistry();
        this.render();
    }

    deselect() {
        this.selectedEntityId = null;
        document.getElementById('info-panel').style.display = 'none';
        this.renderTimelineNotches(); // Clear notches
        if (this.activeTool === 'draw') this.setTool('draw');
        this.render();
    }

    selectEntity(id, showPanel = true) {
        this.selectedEntityId = id;
        const ent = this.entities.find(e => e.id === id);
        if (ent) {
            if (showPanel) {
                const p = document.getElementById('info-panel');
                p.style.display = 'block';
                document.getElementById('info-name-input').value = ent.name;
                document.getElementById('info-type').textContent = ent.type;
                document.getElementById('info-cat').textContent = ent.category;
                document.getElementById('info-color-input').value = ent.color;
                document.getElementById('info-hatch-input').value = ent.hatchStyle; // SYNC DROPDOWN
                document.getElementById('info-span').textContent = `${ent.validRange.start} - ${ent.validRange.end}`;

                const parentRow = document.getElementById('info-parent-row');
                if (ent.parentId) {
                    const parent = this.entities.find(e => e.id === ent.parentId) || { name: 'Unknown' };
                    document.getElementById('info-parent').textContent = parent.name;
                    parentRow.style.display = 'flex';
                } else {
                    parentRow.style.display = 'none';
                }

                this.updateInfoPanel(ent);
            }
            this.renderTimelineNotches(); // Update timeline notches for selected entity
        }
        this.render();
    }

    updateSelectedMetadata() {
        if (!this.selectedEntityId) return;
        const ent = this.entities.find(e => e.id === this.selectedEntityId);
        if (ent) {
            ent.name = document.getElementById('info-name-input').value;
            ent.color = document.getElementById('info-color-input').value;
            ent.hatchStyle = document.getElementById('info-hatch-input').value; // UPDATE HATCH
            this.renderRegistry();
            this.render();
        }
    }

    // Vertex Editing Logic
    editVertex(index, newPos) {
        if (!this.selectedEntityId) return;
        const ent = this.entities.find(e => e.id === this.selectedEntityId);
        if (ent && ent.currentGeometry && ent.currentGeometry[index]) {
            ent.currentGeometry[index] = newPos;
            this.render();
        }
    }

    highlightVertex(index) {
        this.highlightedVertexIndex = index;
        this.render();
    }

    finishVertexEdit() {
        if (!this.selectedEntityId) return;
        const ent = this.entities.find(e => e.id === this.selectedEntityId);
        if (ent) {
            // Commit change to timeline (preventResampling = true)
            ent.addKeyframe(this.currentYear, [...ent.currentGeometry], true);
            this.updateInfoPanel(ent);
            this.renderTimelineNotches(); // Update notches as keyframes changed
        }
    }

    updateInfoPanel(ent) {
        const list = document.getElementById('keyframe-list');
        if (!list) return; // Safety check for missing element

        list.innerHTML = '';
        ent.timeline.forEach(kf => {
            const div = document.createElement('div');
            div.textContent = `• ${kf.year} AD`;
            div.style.borderBottom = '1px solid rgba(0,0,0,0.1)';
            list.appendChild(div);
        });
    }

    checkHover(wp) {
        if (this.activeTool !== 'inspect' && this.activeTool !== 'erase') return;
        let fid = null;

        const visibleEntities = this.entities.filter(e => e.visible);

        // Reverse Sort (Top -> Bottom)
        const sorted = [...visibleEntities].sort((a, b) => {
            // Cities > Overlays (Cult/Ling) > Water > Land
            const typeScore = (type) => {
                if (type === 'city') return 100;
                if (type === 'water') return 50;
                return 0;
            };
            const catScore = (cat) => {
                if (cat === 'linguistic' || cat === 'cultural') return 80;
                return 0;
            };
            return (catScore(a.category) + typeScore(a.type)) - (catScore(b.category) + typeScore(b.type));
        });

        for (let i = sorted.length - 1; i >= 0; i--) {
            const e = sorted[i];
            if (!e.currentGeometry) continue;

            let hit = false;
            if (e.type === 'city') {
                if (distance(wp, e.currentGeometry[0]) < 10 / this.renderer.transform.k) hit = true;
            } else if (e.type === 'river') {
                const pts = e.currentGeometry;
                for (let j = 0; j < pts.length - 1; j++) {
                    if (distanceToSegment(wp, pts[j], pts[j + 1]) < 5 / this.renderer.transform.k) { hit = true; break; }
                }
            } else {
                if (isPointInPolygon(wp, e.currentGeometry)) hit = true;
            }

            if (hit) { fid = e.id; break; }
        }

        if (fid !== this.hoveredEntityId) {
            this.hoveredEntityId = fid;
            this.renderer.canvas.style.cursor = (this.activeTool === 'erase') ? (fid ? 'pointer' : 'not-allowed') : (fid ? 'pointer' : 'default');
            this.render();
        }
    }

    updateEntities() {
        let cnt = 0;
        this.entities.forEach(ent => {
            ent.currentGeometry = ent.getGeometryAtYear(this.currentYear);
            if (ent.currentGeometry) cnt++;
        });
        const d = document.querySelector('.debug-info');
        if (d) d.textContent = `Year: ${this.formatYear(this.currentYear)} | Active: ${cnt}`;
    }

    render() {
        this.renderer.draw(this.entities, this.hoveredEntityId, this.selectedEntityId, this.activeTool, this.highlightedVertexIndex);

        // Add safety check for drawDraft function existence
        if (this.activeTool === 'draw' && this.draftPoints.length > 0) {
            if (typeof this.renderer.drawDraft === 'function') {
                this.renderer.drawDraft(this.draftPoints, this.draftCursor, this.renderer.transform, this.drawType);
            }
        }
    }
}

// Global hook
window.onload = () => {
    window.illuminarchismApp = new IlluminarchismApp();
};
