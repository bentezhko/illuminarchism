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

}
