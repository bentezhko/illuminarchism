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
                this.app.showMessage("Failed to load atlas file. Invalid JSON.");
            }
        };

        reader.readAsText(file);
    }

    /**
     * Parse and apply atlas data
     * @param {Object} json 
     */
    parseAtlasData(json) {
        // Handle input object or string
        if (typeof json === 'string') {
            try {
                json = JSON.parse(json);
            } catch (e) {
                console.error("Invalid JSON string:", e);
                return;
            }
        }

        if (!json.entities || !Array.isArray(json.entities)) {
            console.error("Invalid atlas format: 'entities' array missing");
            return;
        }

        // Clear existing
        this.app.entities = [];
        this.app.connections = [];
        this.app.selectedEntityId = null;
        this.app.hoveredEntityId = null;

        // Restore Metadata
        if (json.meta) {
            this.app.atlasMeta = json.meta;
        }

        // Restore Layers (Groups) if present
        if (json.layers && Array.isArray(json.layers)) {
            this.app.layers = json.layers;
        }
        // If no layers in JSON, we keep the defaults initialized in main.js,
        // which might result in entities being orphaned if their layerIds don't match.
        // However, defaults cover 'water', 'political', 'misc'.

        // Restore Entities
        let maxId = 0;
        json.entities.forEach(data => {
            const ent = HistoricalEntity.fromJSON(data);

            // Asynchronously load image if it exists
            if (ent.imageSrc) {
                const img = new Image();
                img.onload = () => {
                    ent.image = img;
                    if (this.app.renderer) this.app.renderer.invalidateWorldLayer();
                    this.app.render();
                };
                img.onerror = () => {
                    console.warn(`Failed to load image for entity ${ent.id}`);
                };
                img.src = ent.imageSrc;
            }

            this.app.entities.push(ent);

            // Track IDs to ensure uniqueness/counter
            const idNum = parseInt(ent.id);
            if (!isNaN(idNum) && idNum > maxId) maxId = idNum;
        });

        // Restore Connections
        if (json.connections && Array.isArray(json.connections)) {
            this.app.connections = json.connections;
        }

        // Initialize spatial index and renderer
        this.app.updateEntities();

        // Update Layer Manager UI
        if (this.app.layerManager) this.app.layerManager.render();

        this.app.render();

        // Update Registry UI
        if (this.app.registry) this.app.registry.render();
    }

}
