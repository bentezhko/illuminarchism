/**
 * Atlas Exporter Module
 * Exports drawn entities to the custom Illuminarchism atlas format
 */

export default class AtlasExporter {
    constructor(app) {
        this.app = app;
    }

    /**
     * Export current session to atlas JSON format (v2)
     */
    exportAtlas() {
        const meta = { ...this.app.atlasMeta };
        if (!meta.id) meta.id = AtlasExporter.generateId();
        meta.modified = new Date().toISOString();
        meta.version = '2.0';

        return {
            meta,
            entities: this.app.entities.map(e => e.toJSON()),
            connections: this.app.connections || []
        };
    }

    /**
     * Convert HistoricalEntity to JSON format (Legacy/GeoJSON snapshot)
     */
    static entityToJSON(entity, year) {
        const geometry = entity.getGeometryAtYear(year);

        return {
            id: entity.id,
            name: entity.name,
            type: entity.type,
            geometry: this.convertToGeoJSON(geometry, entity.type),
            properties: {
                description: entity.description,
                color: entity.color,
                parentId: entity.parentId
            }
        };
    }
    
    /**
     * Convert internal geometry to GeoJSON
     */
    static convertToGeoJSON(points, type) {
        if (!points || points.length === 0) {
            return null;
        }
        
        // Convert {x, y} to [lng, lat]
        const coordinates = points.map(p => [p.x, p.y]);
        
        switch (type) {
            case 'polity':
                // Close the polygon if not already closed
                if (coordinates[0][0] !== coordinates[coordinates.length - 1][0] ||
                    coordinates[0][1] !== coordinates[coordinates.length - 1][1]) {
                    coordinates.push([...coordinates[0]]);
                }
                // Ensure valid linear ring (at least 4 points: start, p2, p3, end=start)
                if (coordinates.length < 4) return null;

                return {
                    type: 'Polygon',
                    coordinates: [coordinates]
                };
                
            case 'river':
            case 'route':
                return {
                    type: 'LineString',
                    coordinates: coordinates
                };
                
            case 'city':
                return {
                    type: 'Point',
                    coordinates: coordinates[0]
                };
                
            default:
                return {
                    type: 'Polygon',
                    coordinates: [coordinates]
                };
        }
    }
    
    /**
     * Download current atlas as JSON file
     */
    downloadAtlas(filename) {
        const atlas = this.exportAtlas();
        const json = JSON.stringify(atlas, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = filename || `atlas_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Download atlas as JSON file (Static version)
     */
    static downloadAtlas(atlas, filename) {
        const json = JSON.stringify(atlas, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = filename || `${atlas.meta?.id || 'atlas'}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    /**
     * Export current drawing session
     */
    static exportSession(entities, currentYear, layerName = 'custom') {
        const metadata = {
            id: `${layerName}-${currentYear}`,
            year: currentYear,
            layer: layerName,
            description: `Manual drawing for ${layerName} layer at year ${currentYear}`,
            author: 'illuminarchism-user',
            created: new Date().toISOString()
        };
        
        const atlas = this.exportAtlas(entities, metadata);
        const filename = `atlas_${layerName}_${currentYear}.json`;
        
        this.downloadAtlas(atlas, filename);
        
        return atlas;
    }
    
    /**
     * Generate unique atlas ID (Static version)
     */
    static generateId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        return `atlas-${timestamp}-${random}`;
    }
    
    /**
     * Validate exported atlas structure
     */
    static validateExport(atlas) {
        const errors = [];
        
        if (!atlas.meta || typeof atlas.meta !== 'object') {
            errors.push('Missing or invalid meta section');
        } else {
            if (!atlas.meta.id) errors.push('Missing meta.id');
            if (!atlas.meta.layer) errors.push('Missing meta.layer');
            if (typeof atlas.meta.year !== 'number') errors.push('Invalid meta.year');
        }
        
        if (!Array.isArray(atlas.entities)) {
            errors.push('entities must be an array');
        } else {
            atlas.entities.forEach((entity, i) => {
                if (!entity.id) errors.push(`Entity ${i}: missing id`);
                if (!entity.geometry) errors.push(`Entity ${i}: missing geometry`);
            });
        }
        
        return {
            valid: errors.length === 0,
            errors: errors
        };
    }
    
    /**
     * Create example atlas for documentation
     */
    static createExample() {
        return {
            meta: {
                id: 'example-traffic-left',
                year: 1800,
                layer: 'traffic_rules',
                description: 'Regions with left-side driving in 1800',
                author: 'example',
                created: new Date().toISOString(),
                version: '1.0'
            },
            style: {
                color: '#264e86',
                strokeWidth: 2,
                fillOpacity: 0.4,
                decorative: 'medieval-border'
            },
            entities: [
                {
                    id: 'uk-left-driving',
                    name: 'United Kingdom',
                    type: 'polity',
                    geometry: {
                        type: 'Polygon',
                        coordinates: [[
                            [-5.0, 50.0],
                            [-5.0, 59.0],
                            [2.0, 59.0],
                            [2.0, 50.0],
                            [-5.0, 50.0]
                        ]]
                    },
                    properties: {
                        description: 'Left-side driving region',
                        color: '#264e86'
                    }
                }
            ]
        };
    }
}
