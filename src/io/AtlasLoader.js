import HistoricalEntity from '../core/Entity.js';

export default class AtlasLoader {
    constructor(app) {
        this.app = app;
    }

    /**
     * Load atlas data from a JSON file
     * @param {Event} event - File input change event
     */
    loadFromJSON(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target.result);
                this.parseAtlasData(json);
            } catch (err) {
                console.error("Error loading atlas:", err);
                alert("Failed to load atlas file. Invalid JSON.");
            }
        };

        reader.readAsText(file);
    }

    /**
     * Parse and apply atlas data
     * @param {Object} json 
     */
    parseAtlasData(json) {
        if (!json.entities || !Array.isArray(json.entities)) {
            console.error("Invalid atlas format: 'entities' array missing");
            return;
        }

        // Clear existing
        this.app.entities = [];
        this.app.selectedEntityId = null;
        this.app.hoveredEntityId = null;

        // Restore Metadata
        if (json.meta) {
            console.log("Loading Atlas Meta:", json.meta);
        }

        // Restore Entities
        let maxId = 0;
        json.entities.forEach(data => {
            const ent = HistoricalEntity.fromJSON(data);
            this.app.entities.push(ent);

            // Track IDs to ensure uniqueness/counter
            const idNum = parseInt(ent.id);
            if (!isNaN(idNum) && idNum > maxId) maxId = idNum;
        });

        // Initialize spatial index and renderer
        this.app.updateEntities();
        this.app.render();

        // Update Registry UI
        if (this.app.registry) this.app.registry.render();

        console.log(`Loaded ${this.app.entities.length} entities.`);
    }

    /**
     * Load reference GeoJSON
     * @param {Event} event 
     */
    loadReferenceFromJSON(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target.result);
                this.parseGeoJSON(json);
            } catch (err) {
                console.error("Error loading GeoJSON:", err);
                alert("Failed to load reference file. Invalid JSON.");
            }
        };
        reader.readAsText(file);
    }

    parseGeoJSON(json) {
        const shapes = [];

        // Helper to process a single geometry object
        const processGeometry = (geom) => {
            if (!geom) return;

            if (geom.type === 'LineString') {
                shapes.push({
                    type: 'LineString',
                    geometry: geom.coordinates.map(c => ({ x: c[0], y: c[1] }))
                });
            } else if (geom.type === 'Polygon') {
                // GeoJSON Polygons are arrays of rings. The first is outer, others are holes.
                // For reference, we just draw lines for all rings.
                geom.coordinates.forEach(ring => {
                    shapes.push({
                        type: 'Polygon',
                        geometry: ring.map(c => ({ x: c[0], y: c[1] }))
                    });
                });
            } else if (geom.type === 'MultiPolygon') {
                geom.coordinates.forEach(poly => {
                    poly.forEach(ring => {
                        shapes.push({
                            type: 'Polygon',
                            geometry: ring.map(c => ({ x: c[0], y: c[1] }))
                        });
                    });
                });
            } else if (geom.type === 'MultiLineString') {
                geom.coordinates.forEach(line => {
                    shapes.push({
                        type: 'LineString',
                        geometry: line.map(c => ({ x: c[0], y: c[1] }))
                    });
                });
            } else if (geom.type === 'Point') {
                shapes.push({
                    type: 'Point',
                    geometry: [{ x: geom.coordinates[0], y: geom.coordinates[1] }]
                });
            }
        };

        // Handle FeatureCollection, Feature, or Geometry
        if (json.type === 'FeatureCollection' && Array.isArray(json.features)) {
            json.features.forEach(f => processGeometry(f.geometry));
        } else if (json.type === 'Feature') {
            processGeometry(json.geometry);
        } else if (json.type === 'GeometryCollection') {
            json.geometries.forEach(processGeometry);
        } else {
            // Try treating it as a raw geometry
            processGeometry(json);
        }

        console.log(`Loaded ${shapes.length} reference shapes.`);
        this.app.setReferenceShapes(shapes);
    }
}
