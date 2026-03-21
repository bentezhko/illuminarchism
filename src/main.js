import WebGPURenderer from './renderer/WebGPURenderer.js';
import MedievalRenderer from './renderer/MedievalRenderer.js'; // Fallback if needed
import InputController from './ui/InputController.js';
import HistoricalEntity from './core/Entity.js';
import { distance, getCentroid, getRepresentativePoint, distanceToSegment, isPointInPolygon, getBoundingBox } from './core/math.js';

import { buildTaxonomyForUI, isRenderedAsPoint } from './core/Ontology.js';
import { Quadtree } from './core/SpatialIndex.js';
import RegistryRenderer from './ui/RegistryRenderer.js';
import Timeline from './ui/Timeline.js';
import InfoPanel from './ui/InfoPanel.js';
import Dial from './ui/Dial.js';
import Toolbar from './ui/Toolbar.js';
import LayerManager from './ui/LayerManager.js';
import AtlasLoader from './io/AtlasLoader.js';
import AtlasExporter from './io/AtlasExporter.js';
import { initialEntities } from './data/initialEntities.js';
import DrawTool from './tools/DrawTool.js';

export default class IlluminarchismApp {
    static async create() {
        const app = new IlluminarchismApp();
        await app._init();
        return app;
    }

    constructor() {
        // Build taxonomy from Ontology module (4-domain, 3-level hierarchy)
        this.ontologyTaxonomy = buildTaxonomyForUI();

        // Initialization deferred to async _init
    }

    async _init() {
        if (navigator.gpu) {
            this.renderer = new WebGPURenderer('map-canvas');
        } else {
            console.warn("WebGPU not supported, falling back to MedievalRenderer");
            this.renderer = await MedievalRenderer.create('map-canvas');
        }

        this.input = new InputController(this);

        // Modules
        this.registry = new RegistryRenderer(this);
        this.timeline = new Timeline(this);
        this.infoPanel = new InfoPanel(this);
        this.dial = new Dial(this);
        this.toolbar = new Toolbar(this);
        this.layerManager = new LayerManager(this);
        this.loader = new AtlasLoader(this);
        this.exporter = new AtlasExporter(this);
        this.drawTool = new DrawTool(this);

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

        // Layer State
        this.layers = [];
        this.activeLayerId = null;

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

        this.newAreaCounter = 1;
        this.isSelectionAnimating = false;

        // New drawing state variables for edge cases
        this.isHoveringFirstDraftPoint = false;
        this.isDestructingLastPoint = false;
        this.rightClickDownTime = 0;
        this.lastRightClickUpTime = 0;
        this.rightClickDestructTimeout = null;

        // Generate robust IDs for new entities
        this.nextEntityId = 1;

        // Initial setup for toolbar sliding based on view
        document.body.classList.add('view-map');

        // Note: the rest of initialization is handled by async _init()
    }

    initAnimation() {
        const titleText = "ILLUMINARCHISM";
        const rubricStartIndex = "ILLUMIN".length;
        const animationDurationSeconds = 1.5;
        const overlapSeconds = 0.5;
        const drawPhaseRatio = 0.3; // percentage of duration spent drawing the letter
        const fadePhaseRatio = 0.7; // percentage of duration spent holding before fade out starts

        const titleEl = document.getElementById("animated-title");

        if (!titleEl) return;

        const letters = [];
        for (let i = 0; i < titleText.length; i++) {
            const span = document.createElement("span");
            span.textContent = titleText[i];
            span.className = "animated-letter";
            if (i >= rubricStartIndex) {
                span.classList.add("rubric");
            }
            titleEl.appendChild(span);
            letters.push(span);
        }

        const totalDuration = titleText.length * (animationDurationSeconds - overlapSeconds);

        const styleSheet = document.createElement("style");
        let cssText = "";

        letters.forEach((letter, index) => {
            const startPct = (index * (animationDurationSeconds - overlapSeconds) / totalDuration) * 100;
            const drawEndPct = startPct + ((animationDurationSeconds * drawPhaseRatio) / totalDuration) * 100;
            const fadeStartPct = startPct + ((animationDurationSeconds * fadePhaseRatio) / totalDuration) * 100;
            const endPct = startPct + (animationDurationSeconds / totalDuration) * 100;

            // To handle animations that wrap around the end of the timeline
            let keyframes = "";
            if (endPct <= 100) {
                keyframes = `
                @keyframes animateLetter${index} {
                    0%, ${Math.max(0, startPct - 0.01)}% { opacity: 0; clip-path: polygon(0 0, 100% 0, 100% 0, 0 0); }
                    ${startPct}% { opacity: 1; }
                    ${drawEndPct}% { clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%); opacity: 1; }
                    ${fadeStartPct}% { opacity: 1; clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%); }
                    ${endPct}% { opacity: 0; clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%); }
                    ${Math.min(100, endPct + 0.01)}%, 100% { opacity: 0; clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%); }
                }`;
            } else {
                // If it wraps, we need to split it
                const wrappedDrawEnd = drawEndPct % 100;
                const wrappedFadeStart = fadeStartPct % 100;
                const wrappedEnd = endPct % 100;

                // When we wrap, the end of the timeline (100%) and the beginning (0%)
                // fall somewhere between startPct and endPct.

                // For the last letter "M", startPct is ~93%, drawEndPct is ~96%,
                // fadeStartPct is ~100.0%, and endPct is ~103%.
                // So at 0%, it should be fading out.

                // Calculate opacity at 0%
                let opacityAtZero = 0;
                let clipPathAtZero = "polygon(0 0, 100% 0, 100% 0, 0 0)";

                if (startPct > 100) {
                    // Start hasn't happened yet in the current wrap logic context
                    // This is for very long overlap loops
                    opacityAtZero = 0;
                } else if (fadeStartPct <= 100) {
                    // Fading starts before 100, finishes after 0
                    opacityAtZero = 1 - (100 - fadeStartPct) / (endPct - fadeStartPct);
                    clipPathAtZero = "polygon(0 0, 100% 0, 100% 100%, 0 100%)";
                } else if (drawEndPct <= 100) {
                    // Drawing finished before 100, fading starts after 0
                    opacityAtZero = 1;
                    clipPathAtZero = "polygon(0 0, 100% 0, 100% 100%, 0 100%)";
                } else {
                    // Drawing finishes after 0
                    opacityAtZero = 1;
                    const drawProgress = (100 - startPct) / (drawEndPct - startPct);
                    clipPathAtZero = `polygon(0 0, 100% 0, 100% ${drawProgress * 100}%, 0 ${drawProgress * 100}%)`;
                }

                const frames = [
                    `0% { opacity: ${opacityAtZero}; clip-path: ${clipPathAtZero}; }`,
                    `${wrappedEnd}% { opacity: 0; clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%); }`,
                    `${Math.min(100, wrappedEnd + 0.01)}%, ${Math.max(0, startPct - 0.01)}% { opacity: 0; clip-path: polygon(0 0, 100% 0, 100% 0, 0 0); }`,
                    `${startPct}% { opacity: 1; clip-path: polygon(0 0, 100% 0, 100% 0, 0 0); }`
                ];

                if (drawEndPct > 100) {
                    frames.push(`100% { opacity: 1; clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%); }`);
                    frames.push(`${wrappedDrawEnd}% { clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%); opacity: 1; }`);
                } else {
                    frames.push(`${drawEndPct}% { clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%); opacity: 1; }`);
                }

                if (fadeStartPct > 100) {
                    frames.push(`${wrappedFadeStart}% { opacity: 1; clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%); }`);
                } else {
                    frames.push(`${fadeStartPct}% { opacity: 1; clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%); }`);
                }

                if (endPct > 100 && startPct <= 100) {
                    frames.push(`100% { opacity: 1; clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%); }`);
                }

                keyframes = `
                @keyframes animateLetter${index} {
                    ${frames.join('\n                    ')}
                }`;
            }
            cssText += keyframes;
            letter.style.animation = `animateLetter${index} ${totalDuration}s infinite linear`;
        });
        styleSheet.textContent = cssText;
        document.head.appendChild(styleSheet);
    }

    _animationLoop = () => {
        if (this.selectedEntityId || this.isHoveringFirstDraftPoint || this.isDestructingLastPoint) {
            this.render();
            requestAnimationFrame(this._animationLoop);
        } else {
            this.isSelectionAnimating = false;
        }
    }

    generateEntityId(prefix = 'ent') {
        return `${prefix}_${Date.now()}_${this.nextEntityId++}`;
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
                const s = Math.max(Math.abs(scaleX), Math.abs(scaleY));
                scaleX = scaleX < 0 ? -s : s;
                scaleY = scaleY < 0 ? -s : s;
            }

            ent.currentGeometry = originalGeo.map(p => ({
                x: anchorX + (p.x - anchorX) * scaleX,
                y: anchorY + (p.y - anchorY) * scaleY
            }));
        }

        this.render();
    }

    initData() {
        // Initialize Default Groups (formerly Layers)
        this.layers = [
            { id: 'layer_water', name: 'Water', visible: true, locked: true, order: 0, expanded: true },
            { id: 'layer_political', name: 'Political', visible: true, locked: false, order: 1, expanded: true },
            { id: 'layer_misc', name: 'Misc', visible: true, locked: false, order: 2, expanded: true },
            { id: 'default', name: 'Default', visible: true, locked: false, order: 3, expanded: true }
        ];
        this.activeLayerId = 'layer_political';
        if (this.layerManager) this.layerManager.render();

        // Create entities from the canonical initialEntities definition.
        // initialEntities.js is the single source of truth for seed data.
        initialEntities.forEach(def => {
            const ent = new HistoricalEntity(def.id, def.name, def.config);
            def.keyframes.forEach(kf => {
                ent.addKeyframe(kf.year, kf.geometry, kf.preventResampling || false);
            });
            this.entities.push(ent);
        });

        // Update Layer Manager to show entities
        if (this.layerManager) this.layerManager.render();
    }

    formatYear(year) {
        const rounded = Math.floor(year);
        // Returns HTML to separate Year and Era for styling
        if (rounded < 0) return `<span>${Math.abs(rounded)}</span><span style="font-size:0.8em; color:var(--ink-faded);">BC</span>`;
        return `<span>${rounded}</span><span style="font-size:0.8em; color:var(--ink-faded);">AD</span>`;
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
            this.uiRefs.display.innerHTML = this.formatYear(this.currentYear); // Use innerHTML for HTML formatting
        }

        if (this.uiRefs.slider) {
            // Slider input handled by Timeline.js
        }

        // Add listeners for view switching
        this.safeAddListener('btn-view-toggle', 'click', () => {
            if (this.currentView === 'map') {
                this.switchView('timeline');
            } else {
                this.switchView('map');
            }
        });

        this.safeAddListener('btn-theme-toggle', 'click', () => {
            document.body.classList.toggle('dark-mode');
            const toggleBtn = document.getElementById('btn-theme-toggle');
            if (document.body.classList.contains('dark-mode')) {
                toggleBtn.textContent = '☀';
                toggleBtn.title = 'Toggle Light Mode';
            } else {
                toggleBtn.textContent = '☾';
                toggleBtn.title = 'Toggle Dark Mode';
            }
            if (this.renderer) {
                this.renderer.updateThemeColors();
                if (typeof this.renderer.onThemeUpdate === 'function') {
                    this.renderer.onThemeUpdate();
                }
                this.renderer.invalidateWorldLayer();
                this.render();
            }
        });

        // Toggle Chronographer Panel
        this.safeAddListener('btn-toggle-chronographer', 'click', () => {
            const panel = document.getElementById('temporal-controls');
            const btn = document.getElementById('btn-toggle-chronographer');
            if (panel) {
                const isClosed = panel.classList.contains('closed');
                if (isClosed) {
                    panel.classList.remove('closed');
                    if (btn) btn.textContent = '\u25bc'; // Show "Down" when open (to hide)
                } else {
                    panel.classList.add('closed');
                    if (btn) btn.textContent = '\u25b2'; // Show "Up" when closed (to pull up)
                }
            }
        });

        // Speed Dial Logic
        this.speedOptions = [-16, -8, -4, -2, -1, -0.5, 0, 0.5, 1, 2, 4, 8, 16];
        this.playbackSpeed = 1; // Default
        this.initSpeedDial();

        // Initialize Dial
        this.dial.updateDisplay();

        // Add Dial Listeners
        this.safeAddListener('val-domain', 'wheel', (e) => { e.preventDefault(); this.dial.cycle('domain'); });
        this.safeAddListener('val-domain', 'click', () => { this.dial.cycle('domain'); });
        this.safeAddListener('dial-domain', 'mouseenter', () => { this.dial.setHover('domain'); });
        this.safeAddListener('dial-domain', 'mouseleave', () => { this.dial.setHover(null); });

        this.safeAddListener('val-form', 'wheel', (e) => { e.preventDefault(); this.dial.cycle('form'); });
        this.safeAddListener('val-form', 'click', () => { this.dial.cycle('form'); });
        this.safeAddListener('dial-form', 'mouseenter', () => { this.dial.setHover('form'); });
        this.safeAddListener('dial-form', 'mouseleave', () => { this.dial.setHover(null); });

        this.safeAddListener('val-rank', 'wheel', (e) => { e.preventDefault(); this.dial.cycle('rank'); });
        this.safeAddListener('val-rank', 'click', () => { this.dial.cycle('rank'); });
        this.safeAddListener('dial-rank', 'mouseenter', () => { this.dial.setHover('rank'); });
        this.safeAddListener('dial-rank', 'mouseleave', () => { this.dial.setHover(null); });

                // Info Panel Close Button
        this.safeAddListener('modal-close', 'click', () => {
            const modal = document.getElementById('ontology-modal');
            if (modal) modal.classList.remove('visible');
        });

        // Scale Measurement Unit Buttons in Modal
        this.uiRefs.scaleButtons = Array.from(document.querySelectorAll('.scale-unit-btn'));
        this.uiRefs.scaleButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const unit = e.target.dataset.unit;
                if (this.renderer) {
                    this.renderer.scaleUnit = unit;
                    this.renderer.invalidateWorldLayer();
                    this.render();
                    if (this.registry) this.registry.render();
                }

                // Update UI active state
                this.uiRefs.scaleButtons.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
            });
        });

        // Initialize active scale unit button on load
        const initScaleBtn = this.uiRefs.scaleButtons.find(b => b.dataset.unit === 'leagues');
        if (initScaleBtn) {
             initScaleBtn.classList.add('active');
        }

        // Ontology Button — toggles modal open/closed
        this.safeAddListener('btn-ontology', 'click', () => {
            const modal = document.getElementById('ontology-modal');
            if (modal) modal.classList.toggle('visible');
        });


        this.safeAddListener('btn-deselect', 'click', () => this.deselect());
        this.safeAddListener('btn-update-meta', 'click', () => this.updateSelectedMetadata());

        // HATCH INPUT LISTENER
        this.safeAddListener('info-hatch-input', 'change', () => this.updateSelectedMetadata());

        // OPACITY INPUT LISTENER
        this.safeAddListener('info-opacity-input', 'input', () => this.updateSelectedMetadata());

        // Year INPUT LISTENERS
        this.safeAddListener('info-start-input', 'change', () => this.updateSelectedMetadata());
        this.safeAddListener('info-end-input', 'change', () => this.updateSelectedMetadata());

        // Save/Load
        this.btnFileMenu = document.getElementById('btn-file-menu');
        this.fileScrollMenu = document.getElementById('file-scroll-menu');

        const closeFileMenu = () => {
            if (this.fileScrollMenu) this.fileScrollMenu.classList.remove('open');
            if (this.btnFileMenu) this.btnFileMenu.classList.remove('active');
        };

        this.safeAddListener('btn-save', 'click', () => {
            this.exporter.downloadAtlas();
            closeFileMenu();
        });

        const fileInput = document.getElementById('file-input');
        this.safeAddListener('btn-load', 'click', () => {
            if (fileInput) fileInput.click();
            closeFileMenu();
        });

        const imageInput = document.getElementById('image-input');
        this.safeAddListener('btn-load-image', 'click', () => {
            if (imageInput) imageInput.click();
            closeFileMenu();
        });

        this.safeAddListener('btn-file-menu', 'click', (e) => {
            e.stopPropagation();
            this.fileScrollMenu.classList.toggle('open');
            this.btnFileMenu.classList.toggle('active');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (this.fileScrollMenu && this.btnFileMenu) {
                if (!this.fileScrollMenu.contains(e.target) && e.target !== this.btnFileMenu) {
                    closeFileMenu();
                }
            }
        });

        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.loader.loadFromJSON(e));
        }

        if (imageInput) {
            imageInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = (event) => {
                    const img = new Image();
                    img.onload = () => {
                        const IMAGE_WIDTH_RATIO = 0.5;
                        const IMAGE_OPACITY = 0.5;

                        // Calculate where to place the image
                        const t = this.renderer.transform;
                        // Place image centered in the current view
                        const centerX = (this.renderer.width / 2 - t.x) / t.k;
                        const centerY = (this.renderer.height / 2 - t.y) / t.k;

                        // Default size (scale it so it fits reasonably in the current view)
                        const viewWidthInWorld = this.renderer.width / t.k;
                        const targetWidth = viewWidthInWorld * IMAGE_WIDTH_RATIO;
                        const scale = targetWidth / img.width;
                        const targetHeight = img.height * scale;

                        const imgX = centerX - targetWidth / 2;
                        const imgY = centerY - targetHeight / 2;

                        // Create entity geometry (4 corners of the image)
                        const geometry = [
                            { x: imgX, y: imgY },
                            { x: imgX + targetWidth, y: imgY },
                            { x: imgX + targetWidth, y: imgY + targetHeight },
                            { x: imgX, y: imgY + targetHeight }
                        ];

                        const entId = this.generateEntityId('image');
                        const imageEntity = new HistoricalEntity(entId, file.name, {
                            domain: 'misc',
                            typology: 'image',
                            opacity: IMAGE_OPACITY,
                            imageSrc: event.target.result,
                            image: img,
                            layerId: this.activeLayerId || 'default'
                        });

                        imageEntity.addKeyframe(-10000, geometry, true); // Add for entire timeline
                        imageEntity.validRange = { start: -10000, end: 10000 };

                        this.entities.push(imageEntity);
                        this.updateEntities();

                        this.renderer.invalidateWorldLayer();
                        if (this.layerManager) this.layerManager.render();
                        this.render();

                        this.selectEntity(entId, true);
                        this.showMessage("Image overlay loaded.");
                    };
                    img.onerror = () => {
                        this.showMessage("Failed to load image. Please use a valid PNG or JPEG file.", 5000);
                    };
                    img.src = event.target.result;
                };
                reader.onerror = () => {
                    this.showMessage("Error reading the selected file.", 5000);
                };
                reader.readAsDataURL(file);

                // Clear input so same file can be uploaded again if needed
                e.target.value = '';
            });
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
        this.safeAddListener('btn-ctx-focus', 'click', () => this.focusSelectedEntity());

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

    initSpeedDial() {
        const dial = document.getElementById('speed-control-clock');
        const hand = document.getElementById('speed-dial-hand');
        const display = document.getElementById('speed-display');

        if (!dial || !hand || !display) return;

        let currentIndex = this.speedOptions.indexOf(this.playbackSpeed);
        if (currentIndex === -1) currentIndex = 8; // Default to 1x (index 8)

        const updateVisuals = () => {
            const pct = 5 + (currentIndex / (this.speedOptions.length - 1)) * 90;
            hand.style.left = `${pct}%`;
            const hub = document.querySelector('.speed-dial-hub');
            if (hub) hub.style.left = `${pct}%`;
            hand.style.transform = 'translateX(-50%)';
            const val = this.speedOptions[currentIndex];
            display.textContent = `${val}x`;
            this.playbackSpeed = val;
        };

        updateVisuals();

        let isDragging = false;
        let startX = 0;
        let startIndex = 0;

        dial.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startIndex = currentIndex;
            document.body.style.cursor = 'ew-resize';
            e.preventDefault();

            const rect = dial.getBoundingClientRect();
            const relX = e.clientX - rect.left;
            const pct = Math.max(0, Math.min(1, relX / rect.width));
            const newIndex = Math.round(pct * (this.speedOptions.length - 1));

            if (newIndex !== currentIndex) {
                currentIndex = newIndex;
                startIndex = newIndex;
                updateVisuals();
            }

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });

        const onMouseMove = (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const SENSITIVITY = 15;
            const steps = Math.round(dx / SENSITIVITY);
            let newIndex = startIndex + steps;
            newIndex = Math.max(0, Math.min(newIndex, this.speedOptions.length - 1));
            if (newIndex !== currentIndex) {
                currentIndex = newIndex;
                updateVisuals();
            }
        };

        const onMouseUp = () => {
            if (isDragging) {
                isDragging = false;
                document.body.style.cursor = 'default';
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            }
        };

        dial.addEventListener('wheel', (e) => {
            e.preventDefault();
            const direction = e.deltaY < 0 ? 1 : -1;
            const newIndex = Math.max(0, Math.min(currentIndex + direction, this.speedOptions.length - 1));
            if (newIndex !== currentIndex) {
                currentIndex = newIndex;
                updateVisuals();
            }
        });
    }

    showContextMenu(ent, x, y) {
        if (!this.ctxMenu) return;
        this.selectedEntityId = ent.id;
        if (this.ctxHeader) this.ctxHeader.textContent = ent.name || "Entity Details";
        if (this.ctxNameInput) this.ctxNameInput.value = ent.name || "";
        if (this.ctxType) this.ctxType.textContent = ent.type === 'polity' ? (ent.typology || 'Polity') : ent.type;
        const start = ent.validRange ? ent.validRange.start : -10000;
        const end = ent.validRange ? ent.validRange.end : 2025;
        if (this.ctxStartYear) this.ctxStartYear.value = Number.isFinite(start) ? start : -10000;
        if (this.ctxEndYear) this.ctxEndYear.value = Number.isFinite(end) ? end : 2025;
        if (this.ctxColorInput) this.ctxColorInput.value = ent.color || '#000000';
        if (this.ctxHatchInput) this.ctxHatchInput.value = ent.hatchStyle || 'solid';

        const ctxStyleRow = document.getElementById('ctx-style-row');
        if (ctxStyleRow) {
            ctxStyleRow.style.display = ent.type === 'image' ? 'none' : 'flex';
        }

        this.ctxMenu.style.display = 'block';
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
            let c = getRepresentativePoint(ent.currentGeometry);
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
        const toggleBtn = document.getElementById('btn-view-toggle');

        if (viewName === 'map') {
            if (toggleBtn) toggleBtn.textContent = 'Timeline';
            document.body.classList.remove('view-timeline');
            document.body.classList.add('view-map');

            if (this.activeTool === 'link') {
                this.toolbar.selectTool('pan');
            }

            if (mapCanvas) mapCanvas.style.display = 'block';
            if (timelineDiv) {
                timelineDiv.classList.remove('active');
                timelineDiv.style.display = 'none';
            }
            if (toolbar) toolbar.style.display = 'flex';
            this.render();
        } else {
            if (toggleBtn) toggleBtn.textContent = 'Map';
            document.body.classList.remove('view-map');
            document.body.classList.add('view-timeline');

            const mapTools = ['draw', 'vertex-edit', 'warp', 'transform'];
            if (mapTools.includes(this.activeTool)) {
                this.toolbar.selectTool('pan');
            }

            if (mapCanvas) mapCanvas.style.display = 'none';
            if (timelineDiv) {
                timelineDiv.classList.add('active');
                timelineDiv.style.display = 'block';
            }
            if (toolbar) toolbar.style.display = 'flex';
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

        if (entFrom.domain !== entTo.domain) return false;

        const { fromYear, toYear } = this.getConnectionYears(conn);

        if (fromYear < entFrom.validRange.start || fromYear > entFrom.validRange.end) return false;
        if (toYear < entTo.validRange.start || toYear > entTo.validRange.end) return false;

        return true;
    }

    renderTimelineView() {
        this.timeline.renderView();
    }

    renderTimelineNotches() {
        this.timeline.renderNotches();
    }

    jumpToKeyframe(direction) {
        this.timeline.jumpToKeyframe(direction);
    }

    togglePlay() {
        this.timeline.togglePlayback();
    }

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
                if (this.drawTypology === 'city' || this.drawTypology === 'sacred-site') hint.textContent = "Click once to place Settlement.";
                else hint.textContent = `Click to draw new ${this.drawCategory} ${this.drawType}. Double-click to finish.`;
            }
        } else if (name === 'transform') {
            hint.classList.add('visible');
            hint.textContent = "TRANSFORM: Drag corners to Resize (Hold Shift for Aspect Ratio). Drag center to Move.";
        } else if (name === 'link') {
            hint.classList.add('visible');
            hint.textContent = "LINK: Click a timeline bar to start linking, then click another bar of the same domain to connect.";
        } else {
            hint.classList.remove('visible');
        }

        const c = this.renderer.canvas;
        c.style.cursor = 'default';

        if (name === 'pan') c.style.cursor = 'grab';
        else if (name === 'draw') c.style.cursor = 'crosshair';
        else if (name === 'erase') c.style.cursor = 'not-allowed';
        else if (name === 'vertex-edit' || name === 'warp') c.style.cursor = 'crosshair';
        else if (name === 'transform') c.style.cursor = 'crosshair';
        else if (name === 'link') c.style.cursor = 'crosshair';

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
        this.drawTool.commit();
        this.updateEntities();
        this.render();
    }

    removeLastDraftPoint() {
        if (this.draftPoints && this.draftPoints.length > 0) {
            this.draftPoints.pop();
            this.isDestructingLastPoint = false;
            this.render();
        }
    }

    cancelDraft() {
        this.isHoveringFirstDraftPoint = false;
        this.isDestructingLastPoint = false;
        if (this.drawTool) {
            this.drawTool.cancel();
        } else {
            this.draftPoints = [];
            this.draftCursor = null;
            this.render();
        }
    }

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

        const btnToolVertex = document.getElementById('btn-tool-vertex');
        const btnToolWarp = document.getElementById('btn-tool-warp');
        if (btnToolVertex) btnToolVertex.style.display = 'inline-block';
        if (btnToolWarp) btnToolWarp.style.display = 'none';
        if (this.activeTool === 'warp') this.setActiveTool('pan');

        this.hideContextMenu();
        this.renderTimelineNotches();
        if (this.activeTool === 'draw') this.setActiveTool('draw');
        this.render();
    }

    selectEntity(id, showPanel = true) {
        this.selectedEntityId = id;
        const ent = this.entitiesById.get(id);
        if (ent) {
            if (ent.type !== 'image' && this.ontologyTaxonomy[ent.domain]) {
                this.drawDomain = ent.domain;
                const domainData = this.ontologyTaxonomy[ent.domain];
                const typeExists = domainData.types.some(t => t.value === ent.typology);
                if (typeExists) {
                    this.drawTypology = ent.typology;
                } else {
                    if (domainData.types.length > 0) this.drawTypology = domainData.types[0].value;
                }

                this.drawSubtype = ent.subtype || null;
                this.updateDialDisplay();
            }

            const p = document.getElementById('info-panel');
            const isVisible = p && p.style.display === 'block';

            if (showPanel || isVisible) {
                if (showPanel) p.style.display = 'block';
                document.getElementById('info-name-input').value = ent.name;
                document.getElementById('info-type').textContent = ent.typology;
                document.getElementById('info-cat').textContent = ent.domain;
                document.getElementById('info-color-input').value = ent.color;
                document.getElementById('info-hatch-input').value = ent.hatchStyle;
                document.getElementById('info-start-input').value = ent.validRange.start;
                document.getElementById('info-end-input').value = ent.validRange.end;

                const opacityRow = document.getElementById('info-opacity-row');
                const opacityInput = document.getElementById('info-opacity-input');
                const pigmentRow = document.getElementById('info-pigment-row');
                const textureRow = document.getElementById('info-texture-row');
                const entityDial = document.getElementById('entity-dial');

                const btnToolVertex = document.getElementById('btn-tool-vertex');
                const btnToolWarp = document.getElementById('btn-tool-warp');

                if (ent.type === 'image') {
                    opacityRow.style.display = 'flex';
                    opacityInput.value = ent.opacity !== undefined ? ent.opacity : 0.5;
                    if (pigmentRow) pigmentRow.style.display = 'none';
                    if (textureRow) textureRow.style.display = 'none';
                    if (entityDial) entityDial.style.display = 'none';

                    if (btnToolVertex) btnToolVertex.style.display = 'none';
                    if (btnToolWarp) btnToolWarp.style.display = 'inline-block';

                    if (this.activeTool === 'vertex-edit') {
                        this.setActiveTool('warp');
                    }
                } else {
                    opacityRow.style.display = 'none';
                    if (pigmentRow) pigmentRow.style.display = 'flex';
                    if (textureRow) textureRow.style.display = 'flex';
                    if (entityDial) entityDial.style.display = 'flex';

                    if (btnToolVertex) btnToolVertex.style.display = 'inline-block';
                    if (btnToolWarp) btnToolWarp.style.display = 'none';

                    if (this.activeTool === 'warp') {
                        this.setActiveTool('vertex-edit');
                    }
                }

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

            if (!this.isSelectionAnimating) {
                this.isSelectionAnimating = true;
                requestAnimationFrame(this._animationLoop);
            }

            this.renderTimelineNotches();
        }
        this.render();
    }

    updateSelectedMetadata() {
        this._withSelectedEntity(ent => {
            ent.name = document.getElementById('info-name-input').value;
            ent.color = document.getElementById('info-color-input').value;
            ent.hatchStyle = document.getElementById('info-hatch-input').value;

            if (ent.type === 'image') {
                ent.opacity = parseFloat(document.getElementById('info-opacity-input').value);
            }

            const startYear = parseInt(document.getElementById('info-start-input').value, 10);
            const endYear = parseInt(document.getElementById('info-end-input').value, 10);
            if (!isNaN(startYear) && !isNaN(endYear) && startYear <= endYear) {
                ent.validRange.start = startYear;
                ent.validRange.end = endYear;
            }

            if (this.renderer) this.renderer.worldLayerValid = false;

            this.renderRegistry();
            this.render();
            if (this.timelineAPI) this.timelineAPI.renderCustomTrack();
        });
    }


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
            ent.addKeyframe(this.currentYear, [...ent.currentGeometry], true);
            this.invalidateConnectionsFor(ent.id);
            this.updateInfoPanel(ent);
            this.renderTimelineNotches();
        }
    }

    updateInfoPanel(ent) {
        const list = document.getElementById('keyframe-list');
        if (!list) return;

        list.innerHTML = '';
        ent.timeline.forEach(kf => {
            const div = document.createElement('div');
            div.textContent = `\u2022 ${kf.year} AD`;
            div.style.borderBottom = '1px solid rgba(0,0,0,0.1)';
            list.appendChild(div);
        });
    }

    checkHover(wp) {
        if (!wp || typeof wp.x !== 'number' || typeof wp.y !== 'number') return;

        try {
            let fid = null;

            const searchSize = 25 / (this.renderer.transform.k || 1);
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
                    candidates = this.entities.filter(e => e && e.visible);
                }
            } else {
                candidates = this.entities.filter(e => e && e.visible);
            }

            if (this.layers) {
                const layerMap = new Map(this.layers.map(l => [l.id, l]));
                candidates = candidates.filter(e => {
                    const layer = layerMap.get(e.layerId);
                    if (!layer) return true;
                    return layer.visible && !layer.locked;
                });
            }

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

                const isPointRendered = e.currentGeometry.length === 1 || isRenderedAsPoint(e, this.renderer.transform.k);

                if (isPointRendered) {
                    const pt = getRepresentativePoint(e.currentGeometry);
                    if (distance(wp, pt) < 25 / (this.renderer.transform.k || 1)) hit = true;
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
                this.render();
            }

            if (this.activeTool !== 'draw') {
                if (this.activeTool === 'pan') {
                    this.renderer.canvas.style.cursor = fid ? 'pointer' : 'grab';
                } else if (this.activeTool === 'erase') {
                    this.renderer.canvas.style.cursor = fid ? 'pointer' : 'not-allowed';
                } else if (this.activeTool === 'transform') {
                    if (!this.selectedEntityId) {
                        this.renderer.canvas.style.cursor = fid ? 'pointer' : 'crosshair';
                    }
                } else if (this.activeTool === 'vertex-edit' || this.activeTool === 'warp') {
                    if (!this.selectedEntityId) {
                        this.renderer.canvas.style.cursor = fid ? 'cell' : 'crosshair';
                    }
                } else if (this.activeTool === 'link') {
                    this.renderer.canvas.style.cursor = fid ? 'alias' : 'crosshair';
                }
            }
        } catch (error) {
            console.error('Hover check failed:', error);
            this.hoveredEntityId = null;
        }
    }

    updateEntities() {
        this.entitiesById = new Map(this.entities.map(e => [e.id, e]));

        if (this.renderer) this.renderer.worldLayerValid = false;

        let cnt = 0;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        const validEntities = [];

        this.entities.forEach(ent => {
            ent.currentGeometry = ent.getGeometryAtYear(this.currentYear);
            if (ent.currentGeometry && ent.currentGeometry.length > 0) {
                cnt++;
                try {
                    const bbox = getBoundingBox(ent.currentGeometry);

                    if (Math.abs(bbox.w) < 0.001) bbox.w = 0.001;
                    if (Math.abs(bbox.h) < 0.001) bbox.h = 0.001;

                    ent.bbox = bbox;

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
            this.spatialIndex = null;
        }

        const d = document.querySelector('.debug-info');
        if (d) d.innerHTML = `Year: ${this.formatYear(this.currentYear)} | Active: ${cnt}`;
    }

    render() {
        let entitiesToDraw = this.entities;

        if (this.spatialIndex && this.renderer.width > 0) {
            try {
                const tl = this.renderer.toWorld(0, 0);
                const br = this.renderer.toWorld(this.renderer.width, this.renderer.height);
                const viewportBox = {
                    x: tl.x,
                    y: tl.y,
                    w: br.x - tl.x,
                    h: br.y - tl.y
                };

                const visibleNodes = this.spatialIndex.retrieve(viewportBox);
                entitiesToDraw = visibleNodes.map(n => n.entity).filter(e => e);
            } catch (e) {
                console.warn('Viewport culling failed, rendering all entities:', e);
            }
        }

        this.renderer.draw(entitiesToDraw, this.hoveredEntityId, this.selectedEntityId, this.activeTool, this.highlightedVertexIndex, this.layers);

        if (this.activeTool === 'draw' && this.draftPoints.length > 0) {
            if (typeof this.renderer.drawDraft === 'function') {
                try {
                    this.renderer.drawDraft(this.draftPoints, this.draftCursor, this.renderer.transform, this.drawType, {
                        isHoveringFirstDraftPoint: this.isHoveringFirstDraftPoint,
                        isDestructingLastPoint: this.isDestructingLastPoint
                    });
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

            const fromOutside = fromYear < entFrom.validRange.start || fromYear > entFrom.validRange.end;
            const toOutside = toYear < entTo.validRange.start || toYear > entTo.validRange.end;

            if (fromOutside || toOutside) {
                return false;
            }

            conn.confirmed = false;
            return true;
        });

        if (this.currentView === 'timeline') {
            this.timeline.renderView();
        }
    }
}

// Global hook
if (typeof window !== 'undefined') {
    window.onload = async () => {
        try {
            window.illuminarchismApp = await IlluminarchismApp.create();
            const overlay = document.getElementById('loading-overlay');
            if (overlay) overlay.style.display = 'none';
        } catch (e) {
            console.error("Initialization Failed:", e);
            alert("App Initialization Failed: " + e.message + "\nCheck console for details.");
        }
    };
}
