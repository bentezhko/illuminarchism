
import MedievalRenderer from './renderer/MedievalRenderer.js';
import InputController from './ui/InputController.js';
import HistoricalEntity from './core/Entity.js';
import { distance, getCentroid, distanceToSegment, isPointInPolygon, getBoundingBox } from './core/math.js';

import { DOMAINS, buildTaxonomyForUI, getTypologiesForDomain, POLITICAL_SUBTYPES, LINGUISTIC_SUBTYPES, RELIGIOUS_SUBTYPES, GEOGRAPHIC_SUBTYPES } from './core/Ontology.js';
import { Quadtree } from './core/SpatialIndex.js';
import RegistryRenderer from './ui/RegistryRenderer.js';
import Timeline from './ui/Timeline.js';
import InfoPanel from './ui/InfoPanel.js';
import Dial from './ui/Dial.js';
import Toolbar from './ui/Toolbar.js';
import AtlasLoader from './io/AtlasLoader.js';
import AtlasExporter from './io/AtlasExporter.js';

export default class IlluminarchismApp {
    constructor() {
        // Build taxonomy from Ontology module (4-domain, 3-level hierarchy)
        this.ontologyTaxonomy = buildTaxonomyForUI();


        this.renderer = new MedievalRenderer('map-canvas');
        this.input = new InputController(this);

        // Modules
        this.registry = new RegistryRenderer(this);
        this.timeline = new Timeline(this);
        this.infoPanel = new InfoPanel(this);
        this.dial = new Dial(this);
        this.toolbar = new Toolbar(this);
        this.loader = new AtlasLoader(this);
        this.exporter = new AtlasExporter(this);

        this.entities = [];
        this.entitiesById = new Map();
        this.connections = []; // { id, fromId, fromSide, targetId, toSide, year, confirmed }
        this.atlasMeta = { version: '2.0', created: new Date().toISOString() };
        this.spatialIndex = null; // Quadtree instance
        this.currentWorldBounds = { x: -5000, y: -5000, w: 10000, h: 10000 };
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
        this.playbackSpeed = 1;
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
        const ent = this.entitiesById.get(this.selectedEntityId);
        if (!ent) return;

        // Invalidate cache during transform
        if (this.renderer) this.renderer.invalidateWorldLayer();

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
            validRange: { start: -2000, end: 2050 } // FIXED: Finite range for editing
        });
        seaNorth.addKeyframe(-2000, [{ x: 0, y: -400 }, { x: 500, y: -400 }, { x: 500, y: 0 }, { x: 0, y: 0 }], true);
        seaNorth.addKeyframe(2025, [{ x: -10, y: -410 }, { x: 510, y: -410 }, { x: 510, y: 10 }, { x: -10, y: 10 }], true);
        this.entities.push(seaNorth);

        const seaSouth = new HistoricalEntity('sea_south', 'Mare Australis', {
            domain: 'geographic',
            typology: 'aquatic',
            color: '#264e86',
            hatchStyle: 'waves',
            validRange: { start: -2000, end: 2050 } // FIXED: Finite range for editing
        });
        seaSouth.addKeyframe(-2000, [{ x: 0, y: -100 }, { x: 500, y: -100 }, { x: 500, y: 300 }, { x: 0, y: 300 }], true);
        seaSouth.addKeyframe(2025, [{ x: -10, y: -110 }, { x: 510, y: -110 }, { x: 510, y: 310 }, { x: -10, y: 310 }], true);
        this.entities.push(seaSouth);

        const mainland = new HistoricalEntity('mainland', 'Regnum Magna', {
            domain: 'political',
            typology: 'nation-state',
            color: '#264e86',
            hatchStyle: 'diagonal-right',
            validRange: { start: -2000, end: 2050 } // FIXED: Finite range for editing
        });
        mainland.addKeyframe(-2000, [{ x: -300, y: -100 }, { x: -100, y: -100 }, { x: -100, y: 100 }, { x: -300, y: 100 }], true);
        mainland.addKeyframe(2025, [{ x: -300, y: -100 }, { x: -100, y: -100 }, { x: -100, y: 100 }, { x: -300, y: 100 }], true);
        this.entities.push(mainland);

        const island = new HistoricalEntity('island', 'Insula Minor', {
            domain: 'political',
            typology: 'nation-state',
            color: '#264e86',
            hatchStyle: 'diagonal-left',
            validRange: { start: -2000, end: 2050 } // FIXED: Finite range for editing
        });
        island.addKeyframe(-2000, [{ x: 200, y: -50 }, { x: 300, y: -50 }, { x: 300, y: 50 }, { x: 200, y: 50 }], true);
        island.addKeyframe(2025, [{ x: 200, y: -50 }, { x: 300, y: -50 }, { x: 300, y: 50 }, { x: 200, y: 50 }], true);
        this.entities.push(island);

        const bridge = new HistoricalEntity('bridge', 'The Causeway', {
            domain: 'political',
            typology: 'nation-state',
            color: '#8a3324',
            hatchStyle: 'vertical',
            validRange: { start: -2000, end: 2050 } // FIXED: Finite range for editing
        });
        bridge.addKeyframe(-2000, [{ x: -100, y: -10 }, { x: 200, y: -10 }, { x: 200, y: 10 }, { x: -100, y: 10 }], true);
        bridge.addKeyframe(2025, [{ x: -100, y: -10 }, { x: 200, y: -10 }, { x: 200, y: 10 }, { x: -100, y: 10 }], true);
        this.entities.push(bridge);

        const city = new HistoricalEntity('city_capital', 'Urbs Aeterna', {
            domain: 'political',
            typology: 'archaic-state',
            subtype: 'sovereign',
            color: '#000000',
            validRange: { start: -1000, end: 2050 } // FIXED: Finite range for editing
        });
        city.addKeyframe(-1000, [{ x: 0, y: 0 }]);
        this.entities.push(city);

        const oldTongue = new HistoricalEntity('lang_old', 'Lingua Antiqua', {
            domain: 'linguistic',
            typology: 'genealogical',
            subtype: 'language',
            color: '#5c3c92',
            hatchStyle: 'cross',
            validRange: { start: 800, end: 2050 } // FIXED: Finite range for editing
        });
        oldTongue.addKeyframe(800, [{ x: -280, y: -80 }, { x: -120, y: -80 }, { x: -120, y: 80 }, { x: -280, y: 80 }], true);
        this.entities.push(oldTongue);

        const thSound = new HistoricalEntity('sound_th', 'Theta Isogloss', {
            domain: 'linguistic',
            typology: 'typological',
            subtype: 'feature',
            color: '#800080',
            hatchStyle: 'stipple',
            validRange: { start: 1200, end: 2050 } // FIXED: Finite range for editing
        });
        thSound.addKeyframe(1200, [{ x: -250, y: -50 }, { x: -150, y: -50 }, { x: -150, y: 50 }, { x: -250, y: 50 }], true);
        this.entities.push(thSound);

        const sodaWord = new HistoricalEntity('word_soda', 'Soda/Pop Line', {
            domain: 'linguistic',
            typology: 'typological',
            subtype: 'feature',
            color: '#FF4500',
            hatchStyle: 'stipple',
            validRange: { start: 1900, end: 2050 } // FIXED: Finite range for editing
        });
        sodaWord.addKeyframe(1900, [{ x: -200, y: -100 }, { x: -100, y: -100 }, { x: -100, y: 0 }, { x: -200, y: 0 }], true);
        this.entities.push(sodaWord);

        const festivalZone = new HistoricalEntity('cult_fest', 'Solar Calendar Zone', {
            domain: 'political', // Mapped to Political/Band for "Shared Use" activity zone
            typology: 'band',
            color: '#c5a059',
            hatchStyle: 'vertical',
            validRange: { start: 900, end: 2050 } // FIXED: Finite range for editing
        });
        festivalZone.addKeyframe(900, [{ x: -290, y: -90 }, { x: 100, y: -90 }, { x: 100, y: 90 }, { x: -290, y: 90 }], true);
        this.entities.push(festivalZone);

        const paganEnclave = new HistoricalEntity('faith_pagan', 'Old Gods', {
            domain: 'religious',
            typology: 'ethnic',
            color: '#228B22',
            hatchStyle: 'stipple',
            validRange: { start: -500, end: 2050 } // FIXED: Finite range for editing
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
        const rounded = Math.floor(year);
        if (rounded < 0) return `${Math.abs(rounded)} BC`;
        return `${rounded} AD`;
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

    // Dial Logic Delegated to Dial.js
    updateDialDisplay() {
        this.dial.updateDisplay();
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

    /**
     * Helper to execute logic only if an entity is selected
     */
    _withSelectedEntity(callback) {
        if (!this.selectedEntityId) return;
        const ent = this.entities.find(en => en.id === this.selectedEntityId);
        if (ent) {
            callback(ent);
        }
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
            // Slider input handled by Timeline.js
        }

        // Add listeners for view switching
        this.safeAddListener('btn-view-map', 'click', () => this.switchView('map'));
        this.safeAddListener('btn-view-timeline', 'click', () => this.switchView('timeline'));

        // Add keyframe navigation buttons safely
        this.safeAddListener('btn-prev-key', 'click', () => this.jumpToKeyframe(-1));
        this.safeAddListener('btn-next-key', 'click', () => this.jumpToKeyframe(1));

        // Epoch listeners moved to Timeline.js, but keeping DOM Refs logic here is fine if not conflicting.
        // Timeline.js handles 'change' on epoch-start/end to update bounds.
        // We can remove the logic here to avoid double binding.

        // Toggle Timeline Panel
        this.safeAddListener('btn-toggle-time-panel', 'click', () => {
            document.body.classList.toggle('panel-collapsed');
        });

        // Speed Buttons
        document.querySelectorAll('.speed-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.playbackSpeed = parseFloat(e.target.dataset.speed);
                document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
            });
        });
        // Play button listener moved to Timeline.js but we can keep it here if ref undefined or do nothing.
        // Timeline.js captures it by ID 'btn-play'.



        // Initialize Dial
        this.dial.updateDisplay();

        // Add Dial Listeners
        this.safeAddListener('val-domain', 'wheel', (e) => { e.preventDefault(); this.dial.cycle('domain'); });
        this.safeAddListener('val-domain', 'click', () => { this.dial.cycle('domain'); });

        this.safeAddListener('val-form', 'wheel', (e) => { e.preventDefault(); this.dial.cycle('form'); });
        this.safeAddListener('val-form', 'click', () => { this.dial.cycle('form'); });

        this.safeAddListener('val-rank', 'wheel', (e) => { e.preventDefault(); this.dial.cycle('rank'); });
        this.safeAddListener('val-rank', 'click', () => { this.dial.cycle('rank'); });

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

        // Save/Load
        this.safeAddListener('btn-save', 'click', () => this.exporter.downloadAtlas());

        const fileInput = document.getElementById('file-input');
        this.safeAddListener('btn-load', 'click', () => { if (fileInput) fileInput.click(); });

        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.loader.loadFromJSON(e));
        }


        // Context Menu elements
        this.ctxMenu = document.getElementById('context-menu');
        this.ctxHeader = document.getElementById('ctx-header');
        this.ctxNameInput = document.getElementById('ctx-name-input');
        this.ctxType = document.getElementById('ctx-type');
        this.ctxStartYear = document.getElementById('ctx-start-year');
        this.ctxEndYear = document.getElementById('ctx-end-year');
        this.ctxColorInput = document.getElementById('ctx-color-input');
        this.ctxHatchInput = document.getElementById('ctx-hatch-input');

        // Context Menu Listeners
        this.safeAddListener('ctx-name-input', 'input', (e) => {
            this._withSelectedEntity(ent => {
                ent.name = e.target.value;
                if (this.ctxHeader) this.ctxHeader.textContent = ent.name;
                if (this.renderer) this.renderer.invalidateWorldLayer();
                this.render();
            });
        });

        this.safeAddListener('ctx-name-input', 'change', () => {
            this.renderRegistry();
        });

        this.safeAddListener('ctx-color-input', 'input', (e) => {
            this._withSelectedEntity(ent => {
                ent.color = e.target.value;
                if (this.renderer) this.renderer.invalidateWorldLayer();
                this.render();
            });
        });

        this.safeAddListener('ctx-hatch-input', 'change', (e) => {
            this._withSelectedEntity(ent => {
                ent.hatchStyle = e.target.value;
                if (this.renderer) this.renderer.invalidateWorldLayer();
                this.render();
            });
        });

        this.safeAddListener('ctx-start-year', 'change', (e) => {
            this._withSelectedEntity(ent => {
                if (ent.validRange) {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val)) {
                        ent.validRange.start = val;
                        this.invalidateConnectionsFor(ent.id);
                        this.updateEntities();
                        this.render();
                    }
                }
            });
        });

        this.safeAddListener('ctx-end-year', 'change', (e) => {
            this._withSelectedEntity(ent => {
                if (ent.validRange) {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val)) {
                        ent.validRange.end = val;
                        this.invalidateConnectionsFor(ent.id);
                        this.updateEntities();
                        this.render();
                    }
                }
            });
        });

        // Initial render of notches
        if (this.timeline) this.timeline.renderNotches();
    }

    showContextMenu(ent, x, y) {
        if (!this.ctxMenu) return;

        // Ensure the entity is selected for the listeners to work on the correct one
        this.selectedEntityId = ent.id;

        // Populate Data
        if (this.ctxHeader) this.ctxHeader.textContent = ent.name || "Entity Details";
        if (this.ctxNameInput) this.ctxNameInput.value = ent.name || "";
        if (this.ctxType) this.ctxType.textContent = ent.type === 'polity' ? (ent.typology || 'Polity') : ent.type;

        // Span
        const start = ent.validRange ? ent.validRange.start : -10000;
        const end = ent.validRange ? ent.validRange.end : 2025;
        if (this.ctxStartYear) this.ctxStartYear.value = Number.isFinite(start) ? start : -10000;
        if (this.ctxEndYear) this.ctxEndYear.value = Number.isFinite(end) ? end : 2025;

        // Color
        if (this.ctxColorInput) this.ctxColorInput.value = ent.color || '#000000';

        // Texture
        if (this.ctxHatchInput) this.ctxHatchInput.value = ent.hatchStyle || 'solid';

        // Position and Show
        this.ctxMenu.style.display = 'block';

        // Adjust position if out of bounds
        const rect = this.ctxMenu.getBoundingClientRect();
        let posX = x;
        let posY = y;

        if (posX + rect.width > window.innerWidth) posX = x - rect.width;
        if (posY + rect.height > window.innerHeight) posY = y - rect.height;

        this.ctxMenu.style.left = `${posX}px`;
        this.ctxMenu.style.top = `${posY}px`;
    }

    hideContextMenu() {
        if (this.ctxMenu) {
            this.ctxMenu.style.display = 'none';
        }
    }


    renderRegistry() {
        this.registry.render();
    }

    focusSelectedEntity() {
        if (!this.selectedEntityId) return;
        const ent = this.entitiesById.get(this.selectedEntityId);
        if (ent && ent.currentGeometry && ent.currentGeometry.length > 0) {
            let c = { x: 0, y: 0 };
            if (ent.currentGeometry.length === 1) {
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
        const linkBtn = document.getElementById('btn-timeline-link');

        document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));

        if (viewName === 'map') {
            document.getElementById('btn-view-map').classList.add('active');
            if (mapCanvas) mapCanvas.style.display = 'block';
            if (timelineDiv) {
                timelineDiv.classList.remove('active');
                timelineDiv.style.display = 'none'; // Explicitly hide
            }
            if (toolbar) toolbar.style.display = 'flex';
            if (linkBtn) linkBtn.style.display = 'none';
            this.render();
        } else {
            document.getElementById('btn-view-timeline').classList.add('active');
            if (mapCanvas) mapCanvas.style.display = 'none';
            if (timelineDiv) {
                timelineDiv.classList.add('active');
                timelineDiv.style.display = 'block'; // Explicitly show
            }
            if (toolbar) toolbar.style.display = 'none';
            if (linkBtn) linkBtn.style.display = 'inline-block';
            this.timeline.renderView();
        }
    }

    getConnectionYears(conn) {
        const fromYear = conn.fromYear !== undefined ? conn.fromYear : conn.year;
        const toYear = conn.toYear !== undefined ? conn.toYear : (conn.year !== undefined ? conn.year : fromYear);
        return { fromYear, toYear };
    }

    isConnectionValid(conn) {
        const entFrom = this.entitiesById.get(conn.fromId);
        const entTo = this.entitiesById.get(conn.targetId);

        if (!entFrom || !entTo) return false;

        // Domain check
        if (entFrom.domain !== entTo.domain) return false;

        // Check temporal validity
        const { fromYear, toYear } = this.getConnectionYears(conn);

        // Ensure both ends exist in their respective entities' timelines
        if (fromYear < entFrom.validRange.start || fromYear > entFrom.validRange.end) return false;
        if (toYear < entTo.validRange.start || toYear > entTo.validRange.end) return false;

        return true;
    }

    // Timeline View now handled by Timeline.js
    renderTimelineView() {
        this.timeline.renderView();
    }

    // Timeline Notches handled by Timeline.js
    renderTimelineNotches() {
        this.timeline.renderNotches();
    }

    jumpToKeyframe(direction) {
        this.timeline.jumpToKeyframe(direction);
    }

    togglePlay() {
        this.timeline.togglePlayback();
    }

    // Persistence methods moved to io/* modules
    setActiveTool(name) {
        this.activeTool = name;
        this.cancelDraft();

        const hint = document.getElementById('draw-hint');
        const isAnnex = this.drawType === 'vassal';

        if (name === 'draw') {
            hint.classList.add('visible');
            if (this.selectedEntityId && isAnnex) {
                const ent = this.entitiesById.get(this.selectedEntityId);
                hint.textContent = `VASSAL MODE: Create NEW ${this.drawCategory} entity linked to ${ent.name}.`;
            } else if (this.selectedEntityId) {
                const ent = this.entitiesById.get(this.selectedEntityId);
                hint.textContent = `EDITING: Redrawing geometry for ${ent.name} in ${this.currentYear}.`;
            } else {
                if (this.drawTypology === 'city') hint.textContent = "Click once to place City.";
                else hint.textContent = `Click to draw new ${this.drawCategory} ${this.drawType}. Double-click to finish.`;
            }
        } else if (name === 'transform') {
            hint.classList.add('visible');
            hint.textContent = "TRANSFORM: Drag corners to Resize (Hold Shift for Aspect Ratio). Drag center to Move.";
        } else {
            hint.classList.remove('visible');
        }

        // Update Cursor
        const c = this.renderer.canvas;
        c.style.cursor = 'default';
        if (name === 'pan') c.style.cursor = 'grab';
        else if (name === 'draw') c.style.cursor = 'crosshair';
        else if (name === 'erase') c.style.cursor = 'not-allowed';
        else if (name === 'vertex-edit') c.style.cursor = 'alias';
        else if (name === 'transform') c.style.cursor = 'default'; // managed by InputController hover

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
            const ent = this.entitiesById.get(this.selectedEntityId);
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
                    this.invalidateConnectionsFor(ent.id);
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
        if (this.activeTool === 'draw') this.setActiveTool('draw');
        this.render();
    }

    selectEntity(id, showPanel = true) {
        this.selectedEntityId = id;
        const ent = this.entitiesById.get(id);
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
                    const parent = this.entitiesById.get(ent.parentId) || { name: 'Unknown' };
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
        this._withSelectedEntity(ent => {
            ent.name = document.getElementById('info-name-input').value;
            ent.color = document.getElementById('info-color-input').value;
            ent.hatchStyle = document.getElementById('info-hatch-input').value; // UPDATE HATCH

            // Invalidate cache as styling changed
            if (this.renderer) this.renderer.worldLayerValid = false;

            this.renderRegistry();
            this.render();
        });
    }


    // Vertex Editing Logic
    editVertex(index, newPos) {
        if (!this.selectedEntityId) return;
        const ent = this.entitiesById.get(this.selectedEntityId);
        if (ent && ent.currentGeometry && ent.currentGeometry[index]) {
            ent.currentGeometry[index] = newPos;
            if (this.renderer) this.renderer.invalidateWorldLayer();
            this.render();
        }
    }

    highlightVertex(index) {
        this.highlightedVertexIndex = index;
        this.render();
    }

    finishVertexEdit() {
        if (!this.selectedEntityId) return;
        const ent = this.entitiesById.get(this.selectedEntityId);
        if (ent) {
            // Commit change to timeline (preventResampling = true)
            ent.addKeyframe(this.currentYear, [...ent.currentGeometry], true);
            this.invalidateConnectionsFor(ent.id);
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

    // FIXED: Single optimized checkHover with safety checks - NOW WORKS IN PAN MODE
    checkHover(wp) {
        // Safety checks to prevent crashes
        if (!wp || typeof wp.x !== 'number' || typeof wp.y !== 'number') return;

        // We still want to know what's under the mouse for deselection logic,
        // but we might skip cursor updates or heavy rendering in certain tools.
        const isModalTool = this.activeTool === 'draw' || this.activeTool === 'vertex-edit' || this.activeTool === 'transform';

        try {
            let fid = null;

            // Use Spatial Index for Hit Testing
            const searchSize = 25 / (this.renderer.transform.k || 1); // Prevent division by zero
            const searchBox = {
                x: wp.x - searchSize / 2,
                y: wp.y - searchSize / 2,
                w: searchSize,
                h: searchSize
            };

            let candidates = [];
            if (this.spatialIndex) {
                try {
                    const results = this.spatialIndex.retrieve(searchBox);
                    candidates = results.map(r => r.entity).filter(e => e && e.visible);
                } catch (e) {
                    console.warn('Spatial index query failed:', e);
                    // Fallback to full entity list
                    candidates = this.entities.filter(e => e && e.visible);
                }
            } else {
                // Fallback if index not ready
                candidates = this.entities.filter(e => e && e.visible);
            }

            // Sort candidates for Z-order
            const sorted = candidates.sort((a, b) => {
                const typeScore = (ent) => {
                    if (!ent) return 0;
                    if (ent.currentGeometry && ent.currentGeometry.length === 1) return 100;
                    if (ent.type === 'water') return 50;
                    return 0;
                };
                const catScore = (ent) => {
                    if (!ent || !ent.category) return 0;
                    if (ent.category === 'linguistic' || ent.category === 'cultural') return 80;
                    return 0;
                };
                return (catScore(a) + typeScore(a)) - (catScore(b) + typeScore(b));
            });

            for (let i = sorted.length - 1; i >= 0; i--) {
                const e = sorted[i];
                if (!e || !e.currentGeometry || e.currentGeometry.length === 0) continue;

                let hit = false;
                if (e.currentGeometry.length === 1) {
                    if (distance(wp, e.currentGeometry[0]) < 25 / (this.renderer.transform.k || 1)) hit = true;
                } else if (e.type === 'river') {
                    const pts = e.currentGeometry;
                    for (let j = 0; j < pts.length - 1; j++) {
                        if (distanceToSegment(wp, pts[j], pts[j + 1]) < 5 / (this.renderer.transform.k || 1)) {
                            hit = true;
                            break;
                        }
                    }
                } else {
                    if (isPointInPolygon(wp, e.currentGeometry)) hit = true;
                }

                if (hit) {
                    fid = e.id;
                    break;
                }
            }

            if (fid !== this.hoveredEntityId) {
                this.hoveredEntityId = fid;

                // Only update cursor if not in a modal tool that manages its own cursor
                if (!isModalTool) {
                    this.renderer.canvas.style.cursor = (this.activeTool === 'erase') ?
                        (fid ? 'pointer' : 'not-allowed') :
                        (fid ? 'pointer' : (this.activeTool === 'pan' ? 'grab' : 'default'));
                }
                this.render();
            }
        } catch (error) {
            console.error('Hover check failed:', error);
            this.hoveredEntityId = null;
        }
    }

    updateEntities() {
        // Update lookup map
        this.entitiesById = new Map(this.entities.map(e => [e.id, e]));

        // Invalidate renderer cache as geometry or visibility might have changed
        if (this.renderer) this.renderer.worldLayerValid = false;

        let cnt = 0;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        const validEntities = [];

        this.entities.forEach(ent => {
            ent.currentGeometry = ent.getGeometryAtYear(this.currentYear);
            if (ent.currentGeometry && ent.currentGeometry.length > 0) {
                cnt++;
                try {
                    // Calculate BBox for Indexing with safety checks
                    const bbox = getBoundingBox(ent.currentGeometry);

                    // Ensure valid dimensions for spatial indexing
                    if (Math.abs(bbox.w) < 0.001) bbox.w = 0.001;
                    if (Math.abs(bbox.h) < 0.001) bbox.h = 0.001;

                    ent.bbox = bbox; // Store for reuse

                    // Track World Bounds
                    if (bbox.minX < minX) minX = bbox.minX;
                    if (bbox.minY < minY) minY = bbox.minY;
                    if (bbox.maxX > maxX) maxX = bbox.maxX;
                    if (bbox.maxY > maxY) maxY = bbox.maxY;

                    validEntities.push(ent);
                } catch (e) {
                    console.warn(`Failed to calculate bbox for entity ${ent.id}:`, e);
                }
            }
        });

        // Rebuild Quadtree with safety checks
        if (minX === Infinity) {
            minX = -1000; maxX = 1000; minY = -1000; maxY = 1000;
        }

        const margin = 100;
        this.currentWorldBounds = {
            x: minX - margin,
            y: minY - margin,
            w: (maxX - minX) + margin * 2,
            h: (maxY - minY) + margin * 2
        };

        try {
            this.spatialIndex = new Quadtree(this.currentWorldBounds);
            validEntities.forEach(ent => {
                if (ent.bbox) {
                    this.spatialIndex.insert({
                        x: ent.bbox.x,
                        y: ent.bbox.y,
                        w: ent.bbox.w,
                        h: ent.bbox.h,
                        entity: ent
                    });
                }
            });
        } catch (e) {
            console.error('Failed to rebuild spatial index:', e);
            this.spatialIndex = null; // Fallback to no index
        }

        const d = document.querySelector('.debug-info');
        if (d) d.textContent = `Year: ${this.formatYear(this.currentYear)} | Active: ${cnt}`;
    }

    render() {
        // VIEWPORT CULLING
        let entitiesToDraw = this.entities; // Default to all if check fails

        if (this.spatialIndex && this.renderer.width > 0) {
            try {
                // Inverse transform: screen (0,0) -> world TL, screen (w,h) -> world BR
                const tl = this.renderer.toWorld(0, 0);
                const br = this.renderer.toWorld(this.renderer.width, this.renderer.height);
                const viewportBox = {
                    x: tl.x,
                    y: tl.y,
                    w: br.x - tl.x,
                    h: br.y - tl.y
                };

                // Retrieve only visible entities
                const visibleNodes = this.spatialIndex.retrieve(viewportBox);
                entitiesToDraw = visibleNodes.map(n => n.entity).filter(e => e);
            } catch (e) {
                console.warn('Viewport culling failed, rendering all entities:', e);
            }
        }

        this.renderer.draw(entitiesToDraw, this.hoveredEntityId, this.selectedEntityId, this.activeTool, this.highlightedVertexIndex);

        // Draw draft with safety check
        if (this.activeTool === 'draw' && this.draftPoints.length > 0) {
            if (typeof this.renderer.drawDraft === 'function') {
                try {
                    this.renderer.drawDraft(this.draftPoints, this.draftCursor, this.renderer.transform, this.drawType);
                } catch (e) {
                    console.warn('Draft rendering failed:', e);
                }
            }
        }
    }

    openInfoPanel() {
        if (!this.selectedEntityId) return;
        const ent = this.entitiesById.get(this.selectedEntityId);
        if (ent) {
            this.infoPanel.update(ent);
            this.infoPanel.show();
        }
    }

    startEditing(id) {
        this.selectEntity(id, true);
        this.setActiveTool('transform');
    }

    showMessage(message, duration = 3000) {
        const container = document.getElementById('notification-container');
        if (!container) return;

        const el = document.createElement('div');
        el.className = 'notification';
        el.textContent = message;
        container.appendChild(el);

        setTimeout(() => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(-10px)';
            el.style.transition = 'all 0.3s ease-out';
            setTimeout(() => el.remove(), 300);
        }, duration);
    }

    showConfirm(message, onConfirm) {
        const modal = document.getElementById('confirm-modal');
        const msgEl = document.getElementById('confirm-message');
        const yesBtn = document.getElementById('confirm-yes');
        const noBtn = document.getElementById('confirm-no');

        if (!modal || !msgEl || !yesBtn || !noBtn) {
            // Fallback
            if (confirm(message)) onConfirm();
            return;
        }

        msgEl.textContent = message;
        modal.style.display = 'flex';

        const close = () => {
            modal.style.display = 'none';
            yesBtn.onclick = null;
            noBtn.onclick = null;
        };

        yesBtn.onclick = () => {
            close();
            onConfirm();
        };

        noBtn.onclick = () => {
            close();
        };
    }

    invalidateConnectionsFor(entityId) {
        if (!this.connections) return;

        this.connections = this.connections.filter(conn => {
            if (conn.fromId !== entityId && conn.targetId !== entityId) return true;

            const entFrom = this.entitiesById.get(conn.fromId);
            const entTo = this.entitiesById.get(conn.targetId);

            if (!entFrom || !entTo) return false;

            const { fromYear, toYear } = this.getConnectionYears(conn);

            // Auto-delete if strictly outside the new range
            const fromOutside = fromYear < entFrom.validRange.start || fromYear > entFrom.validRange.end;
            const toOutside = toYear < entTo.validRange.start || toYear > entTo.validRange.end;

            if (fromOutside || toOutside) {
                return false; // Remove connection
            }

            // Otherwise mark as unconfirmed to draw attention
            conn.confirmed = false;
            return true;
        });

        if (this.currentView === 'timeline') {
            this.timeline.renderView();
        }
    }
}

// Global hook
window.onload = () => {
    try {
        window.illuminarchismApp = new IlluminarchismApp();
        // Remove loading overlay if successful
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.style.display = 'none';
    } catch (e) {
        console.error("Initialization Failed:", e);
        alert("App Initialization Failed: " + e.message + "\nCheck console for details.");
    }
};
