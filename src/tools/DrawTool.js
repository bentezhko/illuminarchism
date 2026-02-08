import HistoricalEntity from '../core/Entity.js';

export default class DrawTool {
    constructor(app) {
        this.app = app;
    }

    addPoint(p) {
        const last = this.app.draftPoints[this.app.draftPoints.length - 1];
        if (last && Math.abs(last.x - p.x) < 2 && Math.abs(last.y - p.y) < 2) return;
        this.app.draftPoints.push(p);
        this.app.render();
    }

    updateCursor(p) {
        this.app.draftCursor = p;
        this.app.render();
    }

    commit() {
        if (this.app.draftPoints.length === 0) return;

        // Check if current typology requires specific geometry (e.g., city = point)
        const domainData = this.app.ontologyTaxonomy[this.app.drawDomain];
        const typologyData = domainData?.types?.find(t => t.value === this.app.drawTypology);
        const isPointGeometry = typologyData?.geometryType === 'Point' || this.app.drawTypology === 'city' || this.app.drawTypology === 'sacred-site';

        if (!isPointGeometry && this.app.draftPoints.length < 2) return;

        const isAnnex = this.app.drawTypology === 'vassal';

        if (this.app.selectedEntityId) {
            const ent = this.app.entitiesById.get(this.app.selectedEntityId);
            if (ent) {
                if (isAnnex) {
                    const id = 'vassal_' + Date.now();
                    // Create vassal using new ontology config format
                    const newEnt = new HistoricalEntity(id, ent.name + " (Sub)", {
                        domain: this.app.drawDomain,
                        typology: this.app.drawTypology,
                        subtype: this.app.drawSubtype,
                        color: ent.color,
                        parentId: ent.id,
                        boundaryConfidence: 0.8
                    });
                    // New shape creation (no resampling)
                    newEnt.addKeyframe(this.app.currentYear, [...this.app.draftPoints], true);
                    newEnt.validRange.start = this.app.currentYear;
                    newEnt.validRange.end = this.app.currentYear + 200;
                    this.app.entities.push(newEnt);
                    this.app.selectEntity(id);
                    this.app.renderRegistry();
                } else {
                    // Updating existing shape (no resampling to preserve corners)
                    ent.addKeyframe(this.app.currentYear, [...this.app.draftPoints], true);
                    this.app.updateInfoPanel(ent);
                }
            }
        } else {
            const id = 'ent_' + Date.now();
            const colors = ['#8a3324', '#264e86', '#c5a059', '#3a5f3a', '#5c3c92'];
            const color = colors[Math.floor(Math.random() * colors.length)];

            // Generate descriptive name based on typology
            let name = "New Territory";
            if (this.app.drawTypology === 'city' || this.app.drawTypology === 'sacred-site') name = "New Settlement";

            const newEnt = new HistoricalEntity(id, name, {
                domain: this.app.drawDomain,
                typology: this.app.drawTypology,
                subtype: this.app.drawSubtype,
                color: color
            });

            newEnt.addKeyframe(this.app.currentYear, [...this.app.draftPoints]); // Standard drawing resamples
            newEnt.validRange.start = this.app.currentYear;
            newEnt.validRange.end = this.app.currentYear + 100;

            this.app.entities.push(newEnt);
            this.app.selectEntity(id);
            this.app.renderRegistry();
        }

        this.app.draftPoints = [];
        this.app.draftCursor = null;
        this.app.setTool('pan'); // Reset to pan after draw
    }

    cancel() {
        this.app.draftPoints = [];
        this.app.draftCursor = null;
        this.app.render();
    }
}
