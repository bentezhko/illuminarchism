/**
 * Main Application Module
 * Orchestrates all components and manages application state
 */

import InkRenderer from './renderer/InkRenderer.js';
import HistoricalEntity, { EntityManager } from './core/Entity.js';
import GeoMath from './core/GeoMath.js';
import InputController from './ui/InputController.js';
import Toolbar from './ui/Toolbar.js';
import Timeline from './ui/Timeline.js';
import InfoPanel from './ui/InfoPanel.js';

export default class IlluminarchismApp {
    constructor() {
        // Core components
        this.renderer = new InkRenderer('map-canvas');
        this.entityManager = new EntityManager();
        
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
        
        // Playback state
        this.isPlaying = false;
        this.layerVisibility = {
            polity: true,
            river: true,
            city: true
        };
        
        // Initialize
        this.initData();
        this.initUI();
        this.updateEntities();
        this.render();
        
        // Make globally accessible for debugging
        window.illuminarchismApp = this;
    }
    
    /**
     * Initialize demo data
     */
    initData() {
        // Create sample kingdom
        const kingdom = new HistoricalEntity(
            crypto.randomUUID(),
            'Regnum Caeruleum',
            'polity',
            '#264e86'
        );
        
        kingdom.addKeyframe(800, [
            {x: -100, y: -100},
            {x: 100, y: -100},
            {x: 100, y: 100},
            {x: -100, y: 100}
        ]);
        
        kingdom.addKeyframe(1200, [
            {x: -200, y: -150},
            {x: 250, y: -120},
            {x: 200, y: 200},
            {x: -180, y: 180}
        ]);
        
        this.entities.push(kingdom);
        this.entityManager.addEntity(kingdom);
    }
    
    /**
     * Initialize UI event handlers
     */
    initUI() {
        // Save/Load buttons
        const btnSave = document.getElementById('btn-save');
        const btnLoad = document.getElementById('btn-load');
        const fileInput = document.getElementById('file-input');
        
        if (btnSave) {
            btnSave.addEventListener('click', () => this.saveAtlas());
        }
        
        if (btnLoad) {
            btnLoad.addEventListener('click', () => {
                if (fileInput) fileInput.click();
            });
        }
        
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) this.loadAtlas(file);
            });
        }
        
        // Roughen button
        const btnRoughen = document.querySelector('[data-tool="roughen"]');
        if (btnRoughen) {
            btnRoughen.addEventListener('click', () => {
                if (this.selectedEntityId) {
                    this.roughenEntity(this.selectedEntityId);
                } else {
                    alert('Please select a realm first!');
                }
            });
        }
    }
    
    /**
     * Set active drawing/interaction tool
     */
    setActiveTool(toolName) {
        this.activeTool = toolName;
        this.cancelDraft();
        this.render();
    }
    
    /**
     * Add point to draft geometry
     */
    addDraftPoint(worldPos) {
        this.draftPoints.push(worldPos);
        this.render();
    }
    
    /**
     * Finish drawing and create entity
     */
    finishDraft() {
        if (this.draftPoints.length < 3) {
            alert('Need at least 3 points to create a realm!');
            return;
        }
        
        const isClosed = this.activeTool === 'draw_poly';
        const entityType = isClosed ? 'polity' : 'river';
        
        const colors = ['#264e86', '#8a3324', '#3a5f3a', '#c5a059', '#5c3c92'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        
        const entity = new HistoricalEntity(
            crypto.randomUUID(),
            'New Realm',
            entityType,
            randomColor
        );
        
        entity.addKeyframe(this.currentYear, [...this.draftPoints]);
        
        this.entities.push(entity);
        this.entityManager.addEntity(entity);
        
        this.cancelDraft();
        this.selectEntity(entity.id);
    }
    
    /**
     * Cancel current draft
     */
    cancelDraft() {
        this.draftPoints = [];
        this.draftCursor = null;
        this.render();
    }
    
    /**
     * Select an entity
     */
    selectEntity(entityId) {
        this.selectedEntityId = entityId;
        this.entityManager.selectEntity(entityId);
        
        const entity = this.entities.find(e => e.id === entityId);
        this.infoPanel.update(entity);
        
        this.render();
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
        this.entityManager.removeEntity(entityId);
        
        if (this.selectedEntityId === entityId) {
            this.selectedEntityId = null;
            this.infoPanel.hide();
        }
        
        this.render();
    }
    
    /**
     * Apply fractal roughening to entity borders
     */
    roughenEntity(entityId) {
        const entity = this.entities.find(e => e.id === entityId);
        if (!entity) return;
        
        const currentGeo = entity.getGeometryAtYear(this.currentYear);
        if (!currentGeo || currentGeo.length < 3) return;
        
        const roughened = GeoMath.roughenPolygon(currentGeo, 3, 20);
        entity.addKeyframe(this.currentYear, roughened);
        
        this.render();
    }
    
    /**
     * Update all entity geometries for current year
     */
    updateEntities() {
        for (let entity of this.entities) {
            const geometry = entity.getGeometryAtYear(this.currentYear);
            entity.setCurrentGeometry(geometry);
        }
    }
    
    /**
     * Main render loop
     */
    render() {
        this.renderer.beginFrame();
        
        // Draw all entities
        for (let entity of this.entities) {
            if (!this.layerVisibility[entity.type]) continue;
            
            const isSelected = entity.id === this.selectedEntityId;
            this.renderer.drawEntity(entity, this.currentYear, isSelected);
        }
        
        // Draw draft
        if (this.draftPoints.length > 0) {
            const draftWithCursor = [...this.draftPoints];
            if (this.draftCursor) {
                draftWithCursor.push(this.draftCursor);
            }
            this.renderer.drawDraft(draftWithCursor);
        }
        
        this.renderer.endFrame();
    }
    
    /**
     * Save atlas to JSON file
     */
    saveAtlas() {
        const data = {
            version: '0.1',
            year: this.currentYear,
            entities: this.entities.map(e => ({
                id: e.id,
                name: e.name,
                type: e.type,
                color: e.color,
                description: e.description,
                parentId: e.parentId,
                timeline: e.timeline
            }))
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], {
            type: 'application/json'
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `illuminarchism_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
    
    /**
     * Load atlas from JSON file
     */
    async loadAtlas(file) {
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            
            this.entities = [];
            this.entityManager = new EntityManager();
            
            for (let entityData of data.entities) {
                const entity = new HistoricalEntity(
                    entityData.id,
                    entityData.name,
                    entityData.type,
                    entityData.color,
                    entityData.parentId
                );
                
                entity.description = entityData.description;
                entity.timeline = entityData.timeline;
                
                this.entities.push(entity);
                this.entityManager.addEntity(entity);
            }
            
            if (data.year) {
                this.currentYear = data.year;
                this.timeline.setYear(data.year);
            }
            
            this.updateEntities();
            this.render();
            
        } catch (error) {
            console.error('Failed to load atlas:', error);
            alert('Failed to load atlas file!');
        }
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
