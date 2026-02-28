import { POLITICAL_SUBTYPES, LINGUISTIC_SUBTYPES, RELIGIOUS_SUBTYPES, GEOGRAPHIC_SUBTYPES } from '../core/Ontology.js';

export default class Dial {
    constructor(app) {
        this.app = app;
        this.hoveredWheel = null;
    }

    /**
     * Set the currently hovered wheel to update the main tooltip
     * @param {string|null} wheel 'domain', 'form', 'rank', or null
     */
    setHover(wheel) {
        this.hoveredWheel = wheel;
        this.updateTooltip();
    }

    /**
     * Update the main dial container tooltip based on hover state
     */
    updateTooltip() {
        const dialEl = document.getElementById('entity-dial');
        if (!dialEl) return;

        // Default state
        if (!this.hoveredWheel) {
            dialEl.title = "Ontology: Domain - Form - Rank";
            return;
        }

        const ent = this.app.selectedEntityId ? this.app.entitiesById.get(this.app.selectedEntityId) : null;
        if (!ent) return;

        // Get current data
        const domainData = this.app.ontologyTaxonomy[ent.domain];
        if (!domainData) return;

        if (this.hoveredWheel === 'domain') {
            dialEl.title = domainData.domain ? domainData.domain.name : "";
        } else if (this.hoveredWheel === 'form') {
            if (domainData.types) {
                const typeData = domainData.types.find(t => t.value === ent.typology);
                dialEl.title = typeData ? typeData.label : "";
            } else {
                dialEl.title = "";
            }
        } else if (this.hoveredWheel === 'rank') {
            const possibleSubtypes = this._getSubtypesForTypology(ent.typology);
            if (possibleSubtypes && possibleSubtypes.length > 0) {
                const subData = possibleSubtypes.find(s => s.value === ent.subtype);
                // If subtype is null but subtypes exist, subData is undefined -> ""
                dialEl.title = subData ? subData.label : "";
            } else {
                dialEl.title = ""; // Void rank
            }
        }
    }

    /**
     * Update the dial display based on current selection
     */
    updateDisplay() {
        const domainEl = document.getElementById('val-domain');
        const formEl = document.getElementById('val-form');
        const rankEl = document.getElementById('val-rank');

        if (!domainEl || !formEl || !rankEl) return;

        const ent = this.app.selectedEntityId ? this.app.entitiesById.get(this.app.selectedEntityId) : null;
        if (!ent) {
            domainEl.textContent = "---";
            formEl.textContent = "---";
            rankEl.textContent = "---";
            return;
        }

        // 1. DOMAIN
        const domainData = this.app.ontologyTaxonomy[ent.domain];
        if (domainData && domainData.domain) {
            domainEl.textContent = domainData.domain.abbr;
        } else {
            domainEl.textContent = "---";
        }

        // 2. FORM (Typology)
        if (domainData && domainData.types) {
            const typeData = domainData.types.find(t => t.value === ent.typology);
            if (typeData) {
                formEl.textContent = typeData.abbr;
            } else {
                formEl.textContent = "---";
            }
        }

        // 3. RANK (Subtype)
        const possibleSubtypes = this._getSubtypesForTypology(ent.typology);
        if (possibleSubtypes && possibleSubtypes.length > 0) {
            // Auto-select first if null
            if (!ent.subtype) {
                ent.subtype = possibleSubtypes[0].value;
                if (this.app.layerManager) this.app.layerManager.render();
            }
            const subData = possibleSubtypes.find(s => s.value === ent.subtype);
            rankEl.textContent = subData ? subData.abbr : "---";
            rankEl.parentElement.style.opacity = '1';
        } else {
            ent.subtype = null;
            rankEl.textContent = "___";
            rankEl.parentElement.style.opacity = '0.3';
        }

        // Also update tooltip in case selection changed while hovering
        if (this.hoveredWheel) {
            this.updateTooltip();
        }
    }

    /**
     * Cycle the dial to the next option
     */
    cycle(wheel) {
        const ent = this.app.selectedEntityId ? this.app.entitiesById.get(this.app.selectedEntityId) : null;
        if (!ent) return;

        let changed = false;

        if (wheel === 'domain') {
            const domains = Object.keys(this.app.ontologyTaxonomy);
            let idx = domains.indexOf(ent.domain);
            idx = (idx + 1) % domains.length;
            ent.domain = domains[idx];
            changed = true;

            // Reset Lower Levels
            const domainData = this.app.ontologyTaxonomy[ent.domain];
            if (domainData.types.length > 0) {
                ent.typology = domainData.types[0].value;
            } else {
                ent.typology = null;
            }
            ent.subtype = null;

        } else if (wheel === 'form') {
            const domainData = this.app.ontologyTaxonomy[ent.domain];
            if (!domainData || !domainData.types) return;

            const types = domainData.types;
            let idx = types.findIndex(t => t.value === ent.typology);
            if (idx === -1) idx = 0;
            else idx = (idx + 1) % types.length;

            ent.typology = types[idx].value;
            ent.subtype = null;
            changed = true;

        } else if (wheel === 'rank') {
            const subtypes = this._getSubtypesForTypology(ent.typology);
            if (!subtypes) return;

            if (!ent.subtype) {
                ent.subtype = subtypes[0].value;
            } else {
                let idx = subtypes.findIndex(s => s.value === ent.subtype);
                idx = (idx + 1) % subtypes.length;
                ent.subtype = subtypes[idx].value;
            }
            changed = true;
        }

        if (changed) {
            // Update legacy derived properties via the entity class
            ent.updateDerivedProperties();

            // Re-infer boundary type
            ent.boundaryType = ent._inferBoundaryType();

            this.updateDisplay();

            // Notify app to update views
            this.app.updateEntities();
            if (this.app.registry) this.app.renderRegistry();
            if (this.app.layerManager) this.app.layerManager.render();
            if (this.app.renderer) this.app.renderer.invalidateWorldLayer();
            this.app.render();
        }
    }

    /**
     * Get available subtypes for a typology
     */
    _getSubtypesForTypology(typology) {
        // Political Levels
        const adminTypologies = ['empire', 'nation-state', 'supranational', 'archaic-state', 'chiefdom', 'tribe', 'band']; // Added all political types that might have subtypes
        // Note: Band/Tribe might not have subtypes in this generic logic unless defined in ontology, 
        // but for now we follow the pattern specific in Ontology.js

        // Check if typology belongs to domains to map to subtypes

        // We can do a reverse lookup or just checks based on known IDs

        // Political
        if (Object.values(POLITICAL_SUBTYPES).length > 0 &&
            (typology === 'empire' || typology === 'nation-state' || typology === 'supranational' || typology === 'archaic-state')) {
            return Object.values(POLITICAL_SUBTYPES).map(s => ({ value: s.id, label: s.label, abbr: s.abbr }));
        }

        // Religious Hierarchy
        if (typology === 'universalizing' || typology === 'ethnic' || typology === 'syncretic') {
            return Object.values(RELIGIOUS_SUBTYPES).map(s => ({ value: s.id, label: s.label, abbr: s.abbr }));
        }

        // Linguistic Hierarchy
        if (typology === 'genealogical') {
            return [
                LINGUISTIC_SUBTYPES.MACRO_PHYLUM,
                LINGUISTIC_SUBTYPES.FAMILY,
                LINGUISTIC_SUBTYPES.BRANCH,
                LINGUISTIC_SUBTYPES.LANGUAGE,
                LINGUISTIC_SUBTYPES.DIALECT
            ].map(s => ({ value: s.id, label: s.label, abbr: s.abbr }));
        }

        // Geographic
        if (typology === 'natural' || typology === 'bare' || typology === 'aquatic') {
            return Object.values(GEOGRAPHIC_SUBTYPES).map(s => ({ value: s.id, label: s.label, abbr: s.abbr }));
        }

        return null;
    }
}
