/**
 * Atlas Manager Module
 * Manages loading, merging, and organizing multiple atlas files
 */

import HistoricalEntity from './Entity.js';

export default class AtlasManager {
    constructor() {
        this.atlases = new Map(); // id -> atlas data
        this.layers = new Map();  // layer name -> array of atlas IDs
        this.entities = [];
        this.loadedFiles = new Set();
    }

    /**
     * Load atlas from URL or file path
     */
    async loadAtlas(path) {
        if (this.loadedFiles.has(path)) {
            console.warn(`Atlas already loaded: ${path}`);
            return null;
        }

        try {
            const response = await fetch(path);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const atlasData = await response.json();
            return this.registerAtlas(atlasData, path);

        } catch (error) {
            console.error(`Failed to load atlas from ${path}:`, error);
            return null;
        }
    }

    /**
     * Load atlas from File object (user upload)
     */
    async loadAtlasFromFile(file) {
        try {
            const text = await file.text();
            const atlasData = JSON.parse(text);
            return this.registerAtlas(atlasData, file.name);

        } catch (error) {
            console.error(`Failed to parse atlas file ${file.name}:`, error);
            return null;
        }
    }

    /**
     * Register atlas data in the system
     */
    registerAtlas(atlasData, source) {
        // Validate atlas structure
        if (!this.validateAtlas(atlasData)) {
            console.error('Invalid atlas structure:', atlasData);
            return null;
        }

        const atlasId = atlasData.meta.id;

        // Store atlas
        this.atlases.set(atlasId, {
            data: atlasData,
            source: source,
            loaded: Date.now()
        });

        this.loadedFiles.add(source);

        // Register layer
        const layerName = atlasData.meta.layer;
        if (!this.layers.has(layerName)) {
            this.layers.set(layerName, []);
        }
        this.layers.get(layerName).push(atlasId);

        // Convert to entities
        this.addEntitiesFromAtlas(atlasData);

        console.log(`✓ Loaded atlas: ${atlasId} (${atlasData.entities.length} entities)`);
        return atlasId;
    }

    /**
     * Validate atlas JSON structure
     */
    validateAtlas(atlas) {
        if (!atlas.meta || !atlas.meta.id || !atlas.meta.layer) {
            return false;
        }
        if (!Array.isArray(atlas.entities)) {
            return false;
        }
        return true;
    }

    /**
     * Convert atlas entities to HistoricalEntity objects
     * Supports both legacy format and new ontology format
     */
    addEntitiesFromAtlas(atlasData) {
        const baseYear = atlasData.meta.year;
        const style = atlasData.style || {};
        const metaDomain = atlasData.meta.domain; // New: Domain from atlas meta

        for (const entityData of atlasData.entities) {
            let entity;

            // Detect format: new format has 'domain', legacy has 'type' without 'domain'
            if (entityData.domain || metaDomain) {
                // New ontology format
                entity = new HistoricalEntity(entityData.id, entityData.name, {
                    domain: entityData.domain || metaDomain,
                    typology: entityData.typology || entityData.type,
                    subtype: entityData.subtype,
                    color: entityData.color || style.color || '#264e86',
                    hatchStyle: entityData.hatchStyle,
                    parentId: entityData.parentId,
                    boundaryType: entityData.boundaryType,
                    boundaryConfidence: entityData.boundaryConfidence,
                    attributes: entityData.attributes,
                    externalRefs: entityData.externalRefs,
                    description: entityData.properties?.description || entityData.description
                });
            } else {
                // Legacy format - let Entity handle migration
                entity = new HistoricalEntity(
                    entityData.id,
                    entityData.name,
                    entityData.category || atlasData.meta.layer, // Fallback to layer
                    entityData.type,
                    entityData.color || style.color || '#264e86'
                );
            }

            // Convert GeoJSON to internal format
            const geometry = this.convertGeometry(entityData.geometry);
            if (geometry) {
                // Handle GeoJSON-T "when" timespans if present
                if (entityData.when && entityData.when.timespans) {
                    for (const span of entityData.when.timespans) {
                        const year = this.parseYear(span.start?.in) || baseYear;
                        entity.addKeyframe(year, geometry, true);
                    }
                } else {
                    entity.addKeyframe(baseYear, geometry, true);
                }
            }

            // Store atlas metadata
            entity.atlasId = atlasData.meta.id;
            entity.layer = atlasData.meta.layer;

            this.entities.push(entity);
        }
    }

    /**
     * Parse year from various formats (ISO8601, plain number, string)
     */
    parseYear(yearStr) {
        if (!yearStr) return null;
        if (typeof yearStr === 'number') return yearStr;
        // Handle "0117" format or "-500" format
        const parsed = parseInt(yearStr, 10);
        return isNaN(parsed) ? null : parsed;
    }

    /**
     * Convert GeoJSON geometry to internal point array format
     */
    convertGeometry(geojson) {
        if (!geojson || !geojson.coordinates) return null;

        switch (geojson.type) {
            case 'Polygon':
                // GeoJSON uses [lng, lat], we use {x, y}
                return geojson.coordinates[0].map(coord => ({
                    x: coord[0],
                    y: coord[1]
                }));

            case 'MultiPolygon':
                // Take first polygon for now
                return geojson.coordinates[0][0].map(coord => ({
                    x: coord[0],
                    y: coord[1]
                }));

            case 'LineString':
                return geojson.coordinates.map(coord => ({
                    x: coord[0],
                    y: coord[1]
                }));

            case 'Point':
                return [{
                    x: geojson.coordinates[0],
                    y: geojson.coordinates[1]
                }];

            default:
                console.warn(`Unsupported geometry type: ${geojson.type}`);
                return null;
        }
    }

    /**
     * Unload an atlas by ID
     */
    unloadAtlas(atlasId) {
        if (!this.atlases.has(atlasId)) return false;

        const atlas = this.atlases.get(atlasId);
        const layerName = atlas.data.meta.layer;

        // Remove from layer index
        if (this.layers.has(layerName)) {
            const layerAtlases = this.layers.get(layerName);
            const index = layerAtlases.indexOf(atlasId);
            if (index > -1) {
                layerAtlases.splice(index, 1);
            }
        }

        // Remove entities
        this.entities = this.entities.filter(e => e.atlasId !== atlasId);

        // Remove atlas
        this.atlases.delete(atlasId);
        this.loadedFiles.delete(atlas.source);

        console.log(`✗ Unloaded atlas: ${atlasId}`);
        return true;
    }

    /**
     * Get all entities for a specific layer
     */
    getEntitiesByLayer(layerName) {
        return this.entities.filter(e => e.layer === layerName);
    }

    /**
     * Get all entities at a specific year
     */
    getEntitiesAtYear(year) {
        return this.entities.filter(e => e.existsAtYear(year));
    }

    /**
     * Get all loaded layer names
     */
    getLayerNames() {
        return Array.from(this.layers.keys());
    }

    /**
     * Get atlas metadata
     */
    getAtlasInfo(atlasId) {
        const atlas = this.atlases.get(atlasId);
        if (!atlas) return null;

        return {
            id: atlasId,
            layer: atlas.data.meta.layer,
            year: atlas.data.meta.year,
            description: atlas.data.meta.description,
            author: atlas.data.meta.author,
            entityCount: atlas.data.entities.length,
            loaded: atlas.loaded,
            source: atlas.source
        };
    }

    /**
     * List all loaded atlases
     */
    listAtlases() {
        return Array.from(this.atlases.keys()).map(id => this.getAtlasInfo(id));
    }

    /**
     * Bulk load multiple atlases
     */
    async loadMultiple(paths) {
        const results = await Promise.allSettled(
            paths.map(path => this.loadAtlas(path))
        );

        const loaded = results.filter(r => r.status === 'fulfilled' && r.value !== null);
        const failed = results.filter(r => r.status === 'rejected' || r.value === null);

        console.log(`Loaded ${loaded.length}/${paths.length} atlases`);
        if (failed.length > 0) {
            console.warn(`Failed to load ${failed.length} atlases`);
        }

        return loaded.map(r => r.value);
    }

    /**
     * Clear all atlases
     */
    clear() {
        this.atlases.clear();
        this.layers.clear();
        this.entities = [];
        this.loadedFiles.clear();
        console.log('All atlases cleared');
    }
}
