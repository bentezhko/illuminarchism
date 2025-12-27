/**
 * Main Application Module
 * Orchestrates WebGL renderer, atlas management, and user interaction
 */

import WebGLRenderer from './renderer/WebGLRenderer.js';
import AtlasManager from './core/AtlasManager.js';
import AtlasExporter from './io/AtlasExporter.js';
import HistoricalEntity from './core/Entity.js';
import GeoMath from './core/GeoMath.js';
import InputController from './ui/InputController.js';
import Toolbar from './ui/Toolbar.js';
import Timeline from './ui/Timeline.js';
import InfoPanel from './ui/InfoPanel.js';

export default class IlluminarchismApp {
    constructor() {
        // Core components
        this.canvas = this.createCanvas();
        this.renderer = new WebGLRenderer(this.canvas);
        this.atlasManager = new AtlasManager();
        
        // UI controllers
        this.toolbar = new Toolbar(this);
        this.timeline = new Timeline(this);
        this.infoPanel = new InfoPanel(this);
        this.inputController = new InputController(this);
        
        // Application state
        this.entities = [];
        this.hoveredEntityId = null;
        this.selectedEntityId = null;
        this.currentYear = 1000;
        this.draftPoints = [];
        this.draftCursor = null;
        this.activeTool = 'pan';
        this.drawType = 'polity';
        
        // Layer visibility
        this.layerVisibility = {};
        
        // Animation state
        this.isPlaying = false;
        this.isDragging = false;
        
        // Initialize
        this.initUI();
        this.loadInitialAtlases();
        this.startRenderLoop();
        
        // Make globally accessible
        window.illuminarchismApp = this;
        
        console.log('✨ Illuminarchism initialized (WebGL mode)');
    }
    
    createCanvas() {
        const canvas = document.getElementById('map-canvas');
        if (!canvas) {
            throw new Error('Canvas element #map-canvas not found');
        }
        return canvas;
    }
    
    /**
     * Load initial atlas files
     */
    async loadInitialAtlases() {
        // Try to load example atlases from /atlases/ directory
        const defaultAtlases = [
            // Add paths to your atlas files here
            // 'atlases/political/holy_roman_empire_1200.json',
            // 'atlases/calendars/gregorian_1582.json',
        ];
        
        if (defaultAtlases.length > 0) {
            await this.atlasManager.loadMultiple(defaultAtlases);
            this.syncEntities();
        }
        
        // Update layer visibility toggles
        this.updateLayerToggles();
    }
    
    /**
     * Sync entities from atlas manager
     */
    syncEntities() {
        this.entities = this.atlasManager.entities;
        this.updateEntities();
        this.render();
    }
    
    /**
     * Initialize UI event handlers
     */
    initUI() {
        // Save button
        const btnSave = document.getElementById('btn-save');
        if (btnSave) {
            btnSave.addEventListener('click', () => this.saveCurrentDrawing());
        }
        
        // Load button
        const btnLoad = document.getElementById('btn-load');
        const fileInput = document.getElementById('file-input');
        
        if (btnLoad && fileInput) {
            btnLoad.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        }
        
        // Roughen button
        const btnRoughen = document.querySelector('[data-tool="roughen"]');
        if (btnRoughen) {
            btnRoughen.addEventListener('click', () => this.roughenSelected());
        }
        
        // Ink effect sliders
        const wobbleSlider = document.getElementById('sl-wobble');
        if (wobbleSlider) {
            wobbleSlider.addEventListener('input', (e) => {
                this.renderer.settings.wobble = parseFloat(e.target.value);
            });
        }
        
        const bleedSlider = document.getElementById('sl-bleed');
        if (bleedSlider) {
            bleedSlider.addEventListener('input', (e) => {
                this.renderer.settings.inkBleed = parseFloat(e.target.value) * 0.1;
            });
        }
        
        const paperSlider = document.getElementById('sl-paper');
        if (paperSlider) {
            paperSlider.addEventListener('input', (e) => {
                this.renderer.settings.paperRoughness = parseFloat(e.target.value);
            });
        }
        
        // Window resize
        window.addEventListener('resize', () => {
            this.renderer.resize();
            this.render();
        });
    }
    
    /**
     * Handle atlas file upload
     */
    async handleFileUpload(event) {
        const files = event.target.files;
        if (!files || files.length === 0) return;
        
        for (const file of files) {
            await this.atlasManager.loadAtlasFromFile(file);
        }
        
        this.syncEntities();
        this.updateLayerToggles();
        
        // Reset file input
        event.target.value = '';
    }
    
    /**
     * Save current drawing session
     */
    saveCurrentDrawing() {
        if (this.entities.length === 0) {
            alert('No entities to save!');
            return;
        }
        
        // Prompt for layer name
        const layerName = prompt('Enter layer name (e.g., "political", "calendars", "traffic"):', 'custom');
        if (!layerName) return;
        
        // Export entities that don't belong to loaded atlases
        const customEntities = this.entities.filter(e => !e.atlasId);
        
        if (customEntities.length === 0) {
            alert('No custom drawings to export!');
            return;
        }
        
        AtlasExporter.exportSession(customEntities, this.currentYear, layerName);
        console.log(`✓ Exported ${customEntities.length} entities to ${layerName} layer`);
    }
    
    /**
     * Update layer visibility toggles in UI
     */
    updateLayerToggles() {
        const layers = this.atlasManager.getLayerNames();
        layers.forEach(layer => {
            if (!(layer in this.layerVisibility)) {
                this.layerVisibility[layer] = true;
            }
        });
    }
    
    /**
     * Set active drawing/interaction tool
     */
    setActiveTool(toolName) {
        this.activeTool = toolName;
        this.cancelDraft();
    }
    
    /**
     * Add point to draft geometry
     */
    addDraftPoint(worldPos) {
        this.draftPoints.push(worldPos);
    }
    
    /**
     * Finish drawing and create entity
     */
    finishDraft() {
        if (this.draftPoints.length < 3) {
            alert('Need at least 3 points!');
            return;
        }
        
        const colors = ['#264e86', '#8a3324', '#3a5f3a', '#c5a059', '#5c3c92'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        
        const entity = new HistoricalEntity(
            crypto.randomUUID(),
            'New Entity',
            this.activeTool === 'draw_poly' ? 'polity' : 'river',
            randomColor
        );
        
        entity.addKeyframe(this.currentYear, [...this.draftPoints]);
        
        this.entities.push(entity);
        this.selectEntity(entity.id);
        this.cancelDraft();
    }
    
    /**
     * Cancel current draft
     */
    cancelDraft() {
        this.draftPoints = [];
        this.draftCursor = null;
    }
    
    /**
     * Select an entity
     */
    selectEntity(entityId) {
        this.selectedEntityId = entityId;
        const entity = this.entities.find(e => e.id === entityId);
        this.infoPanel.update(entity);
    }
    
    /**
     * Get currently selected entity
     */
    getSelectedEntity() {
        return this.entities.find(e => e.id === this.selectedEntityId);
    }
    
    /**
     * Delete an entity
     */
    deleteEntity(entityId) {
        this.entities = this.entities.filter(e => e.id !== entityId);
        
        if (this.selectedEntityId === entityId) {
            this.selectedEntityId = null;
            this.infoPanel.hide();
        }
    }
    
    /**
     * Apply fractal roughening to entity borders
     */
    roughenSelected() {
        if (!this.selectedEntityId) {
            alert('Select an entity first!');
            return;
        }
        
        const entity = this.entities.find(e => e.id === this.selectedEntityId);
        if (!entity) return;
        
        const currentGeo = entity.getGeometryAtYear(this.currentYear);
        if (!currentGeo || currentGeo.length < 3) return;
        
        const roughened = GeoMath.roughenPolygon(currentGeo, 3, 20);
        entity.addKeyframe(this.currentYear, roughened);
    }
    
    /**
     * Update all entity geometries for current year
     */
    updateEntities() {
        for (const entity of this.entities) {
            const geometry = entity.getGeometryAtYear(this.currentYear);
            entity.setCurrentGeometry(geometry);
        }
    }
    
    /**
     * Main render loop
     */
    startRenderLoop() {
        const loop = () => {
            this.render();
            requestAnimationFrame(loop);
        };
        loop();
    }
    
    /**
     * Render frame
     */
    render() {
        // Filter visible entities
        const visibleEntities = this.entities.filter(e => {
            if (e.layer && !this.layerVisibility[e.layer]) {
                return false;
            }
            return true;
        });
        
        this.renderer.render(visibleEntities, this.currentYear);
    }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new IlluminarchismApp();
    });
} else {
    new IlluminarchismApp();
}
