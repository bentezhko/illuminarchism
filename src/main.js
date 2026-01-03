import MedievalRenderer from './renderer/MedievalRenderer.js';
import InputController from './ui/InputController.js';
import HistoricalEntity from './core/Entity.js';
import { distance, getCentroid, distanceToSegment, isPointInPolygon, getBoundingBox } from './core/math.js';
import { DOMAINS, buildTaxonomyForUI, getTypologiesForDomain, POLITICAL_SUBTYPES, LINGUISTIC_SUBTYPES, RELIGIOUS_SUBTYPES, GEOGRAPHIC_SUBTYPES } from './core/Ontology.js';

export default class IlluminarchismApp {
    constructor() {
        // Build taxonomy from Ontology module (4-domain, 3-level hierarchy)
        this.ontologyTaxonomy = buildTaxonomyForUI();


        this.renderer = new MedievalRenderer('map-canvas');
        this.input = new InputController(this);
        this.entities = [];
        this.hoveredEntityId = null;
        this.selectedEntityId = null;
        this.currentYear = 1000;
        this.draftPoints = [];
        this.draftCursor = null;
        this.activeTool = 'pan';

        // New ontology-aware drawing state
        this.drawDomain = 'political';  // Level 1: Domain
        this.drawTypology = 'nation-state';  // Level 2: Typology
        this.drawSubtype = null;        // Level 3: Subtype/Admin level

        // Legacy aliases for backward compatibility
        this.drawCategory = 'political';
        this.drawType = 'polity';
        this.playbackSpeed = 10;
        this.playbackSpeed = 10;
        this.highlightedVertexIndex = null;
        this.currentView = 'map'; // map | timeline

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
        // Create entities using the new config-object format for constructor
        const seaNorth = new HistoricalEntity('sea_north', 'Mare Borealis', {
            domain: 'geographic',
            typology: 'aquatic',
            color: '#264e86',
            hatchStyle: 'waves',
            validRange: { start: -10000, end: 2050 }
        });
        seaNorth.addKeyframe(-10000, [{ x: 0, y: -400 }, { x: 500, y: -400 }, { x: 500, y: 0 }, { x: 0, y: 0 }], true);
        seaNorth.addKeyframe(2025, [{ x: -10, y: -410 }, { x: 510, y: -410 }, { x: 510, y: 10 }, { x: -10, y: 10 }], true);
        this.entities.push(seaNorth);

        const seaSouth = new HistoricalEntity('sea_south', 'Mare Australis', {
            domain: 'geographic',
            typology: 'aquatic',
            color: '#264e86',
            hatchStyle: 'waves',
            validRange: { start: -10000, end: 2050 }
        });
        seaSouth.addKeyframe(-10000, [{ x: 0, y: -100 }, { x: 500, y: -100 }, { x: 500, y: 300 }, { x: 0, y: 300 }], true);
        seaSouth.addKeyframe(2025, [{ x: -10, y: -110 }, { x: 510, y: -110 }, { x: 510, y: 310 }, { x: -10, y: 310 }], true);
        this.entities.push(seaSouth);

        const mainland = new HistoricalEntity('mainland', 'Regnum Magna', {
            domain: 'political',
            typology: 'nation-state',
            color: '#264e86',
            hatchStyle: 'diagonal-right'
        });
        mainland.addKeyframe(-2000, [{ x: -300, y: -100 }, { x: -100, y: -100 }, { x: -100, y: 100 }, { x: -300, y: 100 }], true);
        mainland.addKeyframe(2025, [{ x: -300, y: -100 }, { x: -100, y: -100 }, { x: -100, y: 100 }, { x: -300, y: 100 }], true);
        this.entities.push(mainland);

        const island = new HistoricalEntity('island', 'Insula Minor', {
            domain: 'political',
            typology: 'nation-state',
            color: '#264e86',
            hatchStyle: 'diagonal-left'
        });
        island.addKeyframe(-2000, [{ x: 200, y: -50 }, { x: 300, y: -50 }, { x: 300, y: 50 }, { x: 200, y: 50 }], true);
        island.addKeyframe(2025, [{ x: 200, y: -50 }, { x: 300, y: -50 }, { x: 300, y: 50 }, { x: 200, y: 50 }], true);
        this.entities.push(island);

        const bridge = new HistoricalEntity('bridge', 'The Causeway', {
            domain: 'political',
            typology: 'nation-state',
            color: '#8a3324',
            hatchStyle: 'vertical'
        });
        bridge.addKeyframe(-2000, [{ x: -100, y: -10 }, { x: 200, y: -10 }, { x: 200, y: 10 }, { x: -100, y: 10 }], true);
        bridge.addKeyframe(2025, [{ x: -100, y: -10 }, { x: 200, y: -10 }, { x: 200, y: 10 }, { x: -100, y: 10 }], true);
        this.entities.push(bridge);

        const city = new HistoricalEntity('city_capital', 'Urbs Aeterna', {
            domain: 'political',
            typology: 'archaic-state',
            subtype: 'sovereign',
            color: '#000000'
        });
        city.addKeyframe(-1000, [{ x: 0, y: 0 }]);
        this.entities.push(city);

        const oldTongue = new HistoricalEntity('lang_old', 'Lingua Antiqua', {
            domain: 'linguistic',
            typology: 'genealogical',
            subtype: 'language',
            color: '#5c3c92',
            hatchStyle: 'cross'
        });
        oldTongue.addKeyframe(800, [{ x: -280, y: -80 }, { x: -120, y: -80 }, { x: -120, y: 80 }, { x: -280, y: 80 }], true);
        this.entities.push(oldTongue);

        const thSound = new HistoricalEntity('sound_th', 'Theta Isogloss', {
            domain: 'linguistic',
            typology: 'typological',
            subtype: 'feature',
            color: '#800080',
            hatchStyle: 'stipple'
        });
        thSound.addKeyframe(1200, [{ x: -250, y: -50 }, { x: -150, y: -50 }, { x: -150, y: 50 }, { x: -250, y: 50 }], true);
        this.entities.push(thSound);

        const sodaWord = new HistoricalEntity('word_soda', 'Soda/Pop Line', {
            domain: 'linguistic',
            typology: 'typological',
            subtype: 'feature',
            color: '#FF4500',
            hatchStyle: 'stipple'
        });
        sodaWord.addKeyframe(1900, [{ x: -200, y: -100 }, { x: -100, y: -100 }, { x: -100, y: 0 }, { x: -200, y: 0 }], true);
        this.entities.push(sodaWord);

        const festivalZone = new HistoricalEntity('cult_fest', 'Solar Calendar Zone', {
            domain: 'political', // Mapped to Political/Band for "Shared Use" activity zone
            typology: 'band',
            color: '#c5a059',
            hatchStyle: 'vertical'
        });
        festivalZone.addKeyframe(900, [{ x: -290, y: -90 }, { x: 100, y: -90 }, { x: 100, y: 90 }, { x: -290, y: 90 }], true);
        this.entities.push(festivalZone);

        const paganEnclave = new HistoricalEntity('faith_pagan', 'Old Gods', {
            domain: 'religious',
            typology: 'ethnic',
            color: '#228B22',
            hatchStyle: 'stipple'
        });
        paganEnclave.addKeyframe(-500, [{ x: 250, y: -50 }, { x: 350, y: -50 }, { x: 350, y: 50 }, { x: 250, y: 50 }], true);
        this.entities.push(paganEnclave);

        // --- NEW CULTURAL DOMAIN ENTITY ---
        const biphasicSleep = new HistoricalEntity('cult_sleep', 'Biphasic Sleep Zone', {
            domain: 'political', // Mapped to Political/Band
            typology: 'band',
            color: '#3a5f3a',
            hatchStyle: 'horizontal',
            validRange: { start: -10000, end: 1900 }
        });
        // Represents the pre-industrial world, fading out by the early 20th century
        biphasicSleep.addKeyframe(-10000, [{ x: -50, y: -50 }, { x: 50, y: -50 }, { x: 50, y: 50 }, { x: -50, y: 50 }], true);
        biphasicSleep.addKeyframe(1900, [{ x: -50, y: -50 }, { x: 50, y: -50 }, { x: 50, y: 50 }, { x: -50, y: 50 }], true); // Fade out, keep low poly
        this.entities.push(biphasicSleep);
    }

    formatYear(year) {
        if (year < 0) return `${Math.abs(year)} BC`;
        return `${year} AD`;
    }


    // --- NEW: Helper to update the dial state using new ontology ---
    updateDialDisplay() {
        const domainEl = document.getElementById('val-domain');
        const formEl = document.getElementById('val-form');
        const rankEl = document.getElementById('val-rank');

        // 1. Get Domain abbreviation from ontology
        const domainData = this.ontologyTaxonomy[this.drawDomain];
        if (domainData && domainData.domain) {
            domainEl.textContent = domainData.domain.abbr;
        } else {
            // Fallback to legacy category map
            const catAbbrMap = {
                'political': 'POL', 'geographical': 'GEO', 'cultural': 'CUL',
                'linguistic': 'LIN', 'faith': 'FAI', 'religious': 'REL',
                'geographic': 'GEO'
            };
            domainEl.textContent = catAbbrMap[this.drawDomain] || catAbbrMap[this.drawCategory] || 'UNK';
        }

        // 2. Get Typology abbreviation
        if (domainData && domainData.types) {
            const currentTypology = domainData.types.find(t => t.value === this.drawTypology);
            if (currentTypology) {
                formEl.textContent = currentTypology.abbr;
            } else {
                // Fallback to the first available typology in the domain
                formEl.textContent = domainData.types.length > 0 ? domainData.types[0].abbr : '---';
            }
        } else {
            formEl.textContent = '---';
        }

        // 3. Rank/Subtype (Level 3) - Show admin levels when available
        const subtypes = this._getSubtypesForTypology(this.drawTypology);
        if (subtypes && subtypes.length > 0) {
            const currentSubtype = subtypes.find(s => s.value === this.drawSubtype);
            rankEl.textContent = currentSubtype ? currentSubtype.abbr : subtypes[0].abbr;
        } else {
            rankEl.textContent = '---';
        }

        // Sync legacy properties
        this.drawCategory = this._domainToCategory(this.drawDomain);
        this.drawType = this._typologyToType(this.drawTypology);
    }

    /**
     * Map domain ID to legacy category
     */
    _domainToCategory(domain) {
        const map = {
            'political': 'political',
            'linguistic': 'linguistic',
            'religious': 'faith',
            'geographic': 'geographical'
        };
        return map[domain] || domain;
    }

    /**
     * Map typology ID to legacy type
     */
    _typologyToType(typology) {
        // Most typologies map directly, but some need translation
        const map = {
            'nation-state': 'polity',
            'empire': 'polity',
            'chiefdom': 'polity',
            'archaic-state': 'polity',
            'band': 'polity',
            'tribe': 'polity',
            'supranational': 'polity',
            'aquatic': 'water',
            'word-isogloss': 'word',
            'sound-isogloss': 'sound',
            'universalizing': 'religion',
            'ethnic': 'religion'
        };
        return map[typology] || typology;
    }

    // --- Advance dial to next option (using new ontology) ---
    cycleDial(wheel) {
        if (wheel === 'domain') {
            // Cycle through domains from ontology
            const domains = Object.keys(this.ontologyTaxonomy);
            let idx = domains.indexOf(this.drawDomain);
            idx = (idx + 1) % domains.length;
            this.drawDomain = domains[idx];

            // Auto-select first typology of new domain
            const domainData = this.ontologyTaxonomy[this.drawDomain];
            if (domainData && domainData.types.length > 0) {
                this.drawTypology = domainData.types[0].value;
            }
        }
        else if (wheel === 'form') {
            // Cycle through typologies within current domain
            const domainData = this.ontologyTaxonomy[this.drawDomain];
            if (domainData && domainData.types) {
                let idx = domainData.types.findIndex(t => t.value === this.drawTypology);
                idx = (idx + 1) % domainData.types.length;
                this.drawTypology = domainData.types[idx].value;
            }
            this.drawSubtype = null; // Reset subtype when type changes
        }
        else if (wheel === 'rank') {
            const subtypes = this._getSubtypesForTypology(this.drawTypology);
            if (subtypes && subtypes.length > 0) {
                let idx = subtypes.findIndex(s => s.value === this.drawSubtype);
                idx = (idx + 1) % subtypes.length;
                this.drawSubtype = subtypes[idx].value;
            }
        }

        this.updateDialDisplay();
    }

    /**
     * Get available subtypes for a typology (admin levels, denominations, etc.)
     */
    _getSubtypesForTypology(typology) {
        // Political Levels
        const adminTypologies = ['empire', 'nation-state', 'supranational', 'archaic-state'];
        if (adminTypologies.includes(typology)) {
            return Object.values(POLITICAL_SUBTYPES).map(s => ({ value: s.id, label: s.label, abbr: s.abbr }));
        }

        // Religious Hierarchy
        if (typology === 'universalizing' || typology === 'ethnic' || typology === 'syncretic') {
            return Object.values(RELIGIOUS_SUBTYPES).map(s => ({ value: s.id, label: s.label, abbr: s.abbr }));
        }

        // Linguistic Hierarchy
        if (typology === 'genealogical') {
            return [
                LINGUISTIC_SUBTYPES.MACRO_PHYLUM,
                LINGUISTIC_SUBTYPES.FAMILY,
                LINGUISTIC_SUBTYPES.BRANCH,
                LINGUISTIC_SUBTYPES.LANGUAGE,
                LINGUISTIC_SUBTYPES.DIALECT
            ].map(s => ({ value: s.id, label: s.label, abbr: s.abbr }));
        }

        if (typology === 'typological' || typology === 'areal') {
            return [{ value: 'feature', label: 'Feature', abbr: 'FEA' }];
        }

        // Geographic
        if (typology === 'natural' || typology === 'bare') {
            return Object.values(GEOGRAPHIC_SUBTYPES).map(s => ({ value: s.id, label: s.label, abbr: s.abbr }));
        }

        return null;
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
                this.renderTimelineView(); // Update timeline if active
            });
        }

        // Add listeners for view switching
        this.safeAddListener('btn-view-map', 'click', () => this.switchView('map'));
        this.safeAddListener('btn-view-timeline', 'click', () => this.switchView('timeline'));

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
                this.renderTimelineView();
            }
        };

        this.safeAddListener('epoch-start', 'change', updateTimelineBounds);
        this.safeAddListener('epoch-end', 'change', updateTimelineBounds);

        // Toggle Timeline Panel
        this.safeAddListener('btn-toggle-time-panel', 'click', () => {
            document.body.classList.toggle('panel-collapsed');
        });

        // Speed Buttons
        document.querySelectorAll('.speed-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.playbackSpeed = parseInt(e.target.dataset.speed);
                document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
            });
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

        // --- NEW: Dial Rank (Level 3) Listener ---
        this.safeAddListener('dial-rank', 'mousedown', (e) => {
            e.preventDefault();
            this.cycleDial('rank');
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



        // Initial render of notches if anything selected (unlikely on load but good practice)
        this.renderTimelineNotches();
    }

    renderRegistry() {
        const container = document.getElementById('registry-content');
        if (!container) return;
        container.innerHTML = '';

        // 1. Group existing entities by Domain -> Typology
        const entityMap = {};
        this.entities.forEach(ent => {
            const d = ent.domain || 'unknown';
            const t = ent.typology || 'unknown';
            if (!entityMap[d]) entityMap[d] = {};
            if (!entityMap[d][t]) entityMap[d][t] = [];
            entityMap[d][t].push(ent);
        });

        // 2. Iterate OFFICIAL ONTOLOGY to build the tree (ensures empty cats show)
        // Sort domains by name if desired, or use defined order
        // Use keys from taxonomy (political, linguistic, etc.)
        const domainIds = Object.keys(this.ontologyTaxonomy);

        domainIds.forEach(domainId => {
            const domainData = this.ontologyTaxonomy[domainId];
            if (!domainData) return;

            const domainLabel = domainData.domain.name;
            const domainAbbr = domainData.domain.abbr;

            const domainDiv = document.createElement('div');
            domainDiv.className = 'registry-category';

            // Domain Header
            const domainTitle = document.createElement('div');
            domainTitle.className = 'registry-cat-title';
            domainTitle.textContent = `▶ ${domainLabel} (${domainAbbr})`;
            domainTitle.onclick = () => {
                const content = domainTitle.nextElementSibling;
                content.classList.toggle('open');
                domainTitle.textContent = content.classList.contains('open') ? `▼ ${domainLabel} (${domainAbbr})` : `▶ ${domainLabel} (${domainAbbr})`;
            };
            domainDiv.appendChild(domainTitle);

            // Domain Content
            const domainContent = document.createElement('div');
            domainContent.className = 'registry-list';

            // Iterate Typologies defined in Ontology
            if (domainData.types) {
                domainData.types.forEach(typeDef => {
                    const typeId = typeDef.value;
                    const typeLabel = typeDef.label;
                    const existingEnts = (entityMap[domainId] && entityMap[domainId][typeId]) ? entityMap[domainId][typeId] : [];
                    const count = existingEnts.length;

                    // Typology Header
                    const typeDiv = document.createElement('div');
                    typeDiv.className = 'registry-typology';
                    typeDiv.style.marginLeft = '0.5rem';
                    typeDiv.style.borderLeft = '1px solid var(--ink-faded)';
                    typeDiv.style.paddingLeft = '0.5rem';

                    const typeTitle = document.createElement('div');
                    typeTitle.className = 'registry-type-title';
                    typeTitle.style.cursor = 'pointer';
                    typeTitle.style.fontStyle = 'italic';
                    typeTitle.style.color = count > 0 ? 'var(--ink-primary)' : 'var(--ink-faded)'; // Dim if empty
                    typeTitle.style.fontSize = '0.85rem';
                    typeTitle.textContent = `▶ ${typeLabel} (${count})`;

                    typeTitle.onclick = (e) => {
                        e.stopPropagation();
                        const typeList = typeTitle.nextElementSibling;
                        typeList.classList.toggle('open');
                        typeTitle.textContent = typeList.classList.contains('open') ? `▼ ${typeLabel} (${count})` : `▶ ${typeLabel} (${count})`;
                    };
                    typeDiv.appendChild(typeTitle);

                    // Entity List
                    const typeList = document.createElement('div');
                    typeList.className = 'registry-list';
                    typeList.style.marginLeft = '0.5rem';

                    if (count > 0) {
                        existingEnts.forEach(ent => {
                            const item = document.createElement('div');
                            item.className = 'registry-item';

                            const left = document.createElement('div');
                            left.style.display = 'flex';
                            left.style.alignItems = 'center';

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
                            goTo.title = 'Go to location';
                            goTo.style.fontSize = '0.8rem';
                            goTo.style.cursor = 'pointer';

                            item.onclick = () => {
                                this.selectEntity(ent.id, false);
                                if (ent.currentGeometry && ent.currentGeometry.length > 0) {
                                    let c = { x: 0, y: 0 };
                                    if (ent.type === 'city' || ent.typology === 'city') {
                                        c = ent.currentGeometry[0];
                                    } else {
                                        c = getCentroid(ent.currentGeometry);
                                    }
                                    if (this.renderer && this.renderer.transform) {
                                        this.renderer.transform.x = this.renderer.width / 2 - c.x * this.renderer.transform.k;
                                        this.renderer.transform.y = this.renderer.height / 2 - c.y * this.renderer.transform.k;
                                        this.render();
                                    }
                                }
                            };
                            item.appendChild(goTo);
                            typeList.appendChild(item);
                        });
                    } else {
                        // Empty state indicator
                        const emptyMsg = document.createElement('div');
                        emptyMsg.style.fontStyle = 'italic';
                        emptyMsg.style.fontSize = '0.7rem';
                        emptyMsg.style.color = 'var(--ink-faded)';
                        emptyMsg.style.padding = '0.2rem 0.5rem';
                        emptyMsg.textContent = '(No entities)';
                        typeList.appendChild(emptyMsg);
                    }

                    typeDiv.appendChild(typeList);
                    domainContent.appendChild(typeDiv);
                });
            }

            domainDiv.appendChild(domainContent);
            container.appendChild(domainDiv);
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

    focusSelectedEntity() {
        if (!this.selectedEntityId) return;
        const ent = this.entities.find(e => e.id === this.selectedEntityId);
        if (ent && ent.currentGeometry && ent.currentGeometry.length > 0) {
            let c = { x: 0, y: 0 };
            if (ent.type === 'city') {
                c = ent.currentGeometry[0];
            } else {
                c = getCentroid(ent.currentGeometry);
            }
            // Animate or set transform
            this.renderer.transform.x = this.renderer.width / 2 - c.x * this.renderer.transform.k;
            this.renderer.transform.y = this.renderer.height / 2 - c.y * this.renderer.transform.k;
            this.render();
        }
    }

    switchView(viewName) {
        this.currentView = viewName;

        const mapCanvas = document.getElementById('map-canvas');
        const timelineDiv = document.getElementById('view-timeline');
        const toolbar = document.getElementById('toolbar');

        document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));

        if (viewName === 'map') {
            document.getElementById('btn-view-map').classList.add('active');
            if (mapCanvas) mapCanvas.style.display = 'block';
            if (timelineDiv) {
                timelineDiv.classList.remove('active');
                timelineDiv.style.display = 'none'; // Explicitly hide
            }
            if (toolbar) toolbar.style.display = 'flex';
            this.render();
        } else {
            document.getElementById('btn-view-timeline').classList.add('active');
            if (mapCanvas) mapCanvas.style.display = 'none';
            if (timelineDiv) {
                timelineDiv.classList.add('active');
                timelineDiv.style.display = 'block'; // Explicitly show
            }
            if (toolbar) toolbar.style.display = 'none';
            this.renderTimelineView();
        }
    }

    renderTimelineView() {
        const container = document.getElementById('view-timeline');
        if (!container || this.currentView !== 'timeline') return;

        container.innerHTML = ''; // Clear content

        // Header
        const header = document.createElement('div');
        header.className = 'timeline-header';
        container.appendChild(header);

        // Draw ticks
        const epochStart = parseInt(document.getElementById('epoch-start').value);
        const epochEnd = parseInt(document.getElementById('epoch-end').value);
        const totalYears = epochEnd - epochStart;

        for (let i = 0; i <= 10; i++) {
            const tick = document.createElement('div');
            tick.className = 'timeline-ruler-tick';
            tick.style.left = `${i * 10}%`;
            tick.textContent = Math.round(epochStart + (totalYears * (i / 10)));
            header.appendChild(tick);
        }

        const currentPercent = ((this.currentYear - epochStart) / totalYears) * 100;

        // Group by Domain using the new ontology
        const grouped = {};
        this.entities.forEach(ent => {
            const domainId = ent.domain || 'unknown';
            if (!grouped[domainId]) {
                grouped[domainId] = [];
            }
            grouped[domainId].push(ent);
        });

        const sortedDomains = Object.keys(grouped).sort((a, b) => {
            const nameA = this.ontologyTaxonomy[a]?.domain.name || a;
            const nameB = this.ontologyTaxonomy[b]?.domain.name || b;
            return nameA.localeCompare(nameB);
        });

        for (const domainId of sortedDomains) {
            const domainData = this.ontologyTaxonomy[domainId];
            const domainLabel = domainData ? domainData.domain.name : (domainId.charAt(0).toUpperCase() + domainId.slice(1));
            const entities = grouped[domainId];

            const groupDiv = document.createElement('div');
            groupDiv.className = 'timeline-group open'; // Default open

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
                    bar.dataset.id = ent.id;

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

        // Add Red Line
        const lineContainer = document.createElement('div');
        lineContainer.style.position = 'absolute';
        lineContainer.style.top = '70px';
        lineContainer.style.bottom = '20px';
        lineContainer.style.left = '232px';
        lineContainer.style.right = '32px';
        lineContainer.style.pointerEvents = 'none';
        lineContainer.style.zIndex = '10'; // Ensure it's above the content

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

        // Check if current typology requires specific geometry (e.g., city = point)
        const domainData = this.ontologyTaxonomy[this.drawDomain];
        const typologyData = domainData?.types?.find(t => t.value === this.drawTypology);
        const isPointGeometry = typologyData?.geometryType === 'Point' || this.drawTypology === 'city' || this.drawTypology === 'sacred-site';

        if (!isPointGeometry && this.draftPoints.length < 2) return;

        const isAnnex = this.drawTypology === 'vassal';

        if (this.selectedEntityId) {
            const ent = this.entities.find(e => e.id === this.selectedEntityId);
            if (ent) {
                if (isAnnex) {
                    const id = 'vassal_' + Date.now();
                    // Create vassal using new ontology config format
                    const newEnt = new HistoricalEntity(id, ent.name + " (Sub)", {
                        domain: this.drawDomain,
                        typology: this.drawTypology,
                        subtype: this.drawSubtype,
                        color: ent.color,
                        parentId: ent.id,
                        boundaryConfidence: 0.8
                    });
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

            // Generate descriptive name based on typology
            let name = "New Territory";
            if (this.drawTypology === 'city' || this.drawTypology === 'sacred-site') name = "New Settlement";
            else if (this.drawTypology === 'river' || this.drawTypology === 'coast') name = "New River";
            else if (this.drawTypology === 'aquatic') name = "New Sea/Lake";
            else if (this.drawDomain === 'linguistic') name = "New Language Zone";
            else if (this.drawDomain === 'religious') name = "New Faith Zone";
            else if (typologyData) name = `New ${typologyData.label}`;

            // Create entity using new ontology config format
            const newEnt = new HistoricalEntity(id, name, {
                domain: this.drawDomain,
                typology: this.drawTypology,
                subtype: this.drawSubtype,
                color: color,
                boundaryConfidence: typologyData?.boundaryType === 'fuzzy' ? 0.5 : 0.9
            });
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
            // --- SYNC DIAL ---
            // If the entity's domain is valid in current ontology, sync the dial
            if (this.ontologyTaxonomy[ent.domain]) {
                this.drawDomain = ent.domain;
                // If the typology exists in that domain (or maybe it was legacy), try to sync
                // If typology is valid:
                const domainData = this.ontologyTaxonomy[ent.domain];
                const typeExists = domainData.types.some(t => t.value === ent.typology);
                if (typeExists) {
                    this.drawTypology = ent.typology;
                } else {
                    // Fallback to first? Or leave as is if invalid?
                    // Better to just keep what we have or default
                    if (domainData.types.length > 0) this.drawTypology = domainData.types[0].value;
                }

                this.drawSubtype = ent.subtype || null;
                this.updateDialDisplay();
            }

            if (showPanel) {
                const p = document.getElementById('info-panel');
                p.style.display = 'block';
                document.getElementById('info-name-input').value = ent.name;
                document.getElementById('info-type').textContent = ent.typology; // updated to match property name
                document.getElementById('info-cat').textContent = ent.domain; // updated to match property name
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
