import { POLITICAL_SUBTYPES, LINGUISTIC_SUBTYPES, RELIGIOUS_SUBTYPES, GEOGRAPHIC_SUBTYPES } from '../core/Ontology.js';

export default class Dial {
    constructor(app) {
        this.app = app;
    }

    /**
     * Update the dial display based on current selection
     */
    updateDisplay() {
        const domainEl = document.getElementById('val-domain');
        const formEl = document.getElementById('val-form');
        const rankEl = document.getElementById('val-rank');

        if (!domainEl || !formEl || !rankEl) return;

        // 1. DOMAIN
        const domainData = this.app.ontologyTaxonomy[this.app.drawDomain];
        if (domainData && domainData.domain) {
            domainEl.textContent = domainData.domain.abbr;
        }

        // 2. FORM (Typology)
        if (domainData && domainData.types) {
            const typeData = domainData.types.find(t => t.value === this.app.drawTypology);
            if (typeData) {
                formEl.textContent = typeData.abbr;
            } else {
                formEl.textContent = "---";
            }
        }

        // 3. RANK (Subtype)
        const possibleSubtypes = this._getSubtypesForTypology(this.app.drawTypology);
        if (possibleSubtypes && possibleSubtypes.length > 0) {
            // Auto-select first if null
            if (!this.app.drawSubtype) {
                this.app.drawSubtype = possibleSubtypes[0].value;
            }
            const subData = possibleSubtypes.find(s => s.value === this.app.drawSubtype);
            rankEl.textContent = subData ? subData.abbr : "---";
            rankEl.parentElement.style.opacity = '1';
        } else {
            this.app.drawSubtype = null;
            rankEl.textContent = "___";
            rankEl.parentElement.style.opacity = '0.3';
        }
    }

    /**
     * Cycle the dial to the next option
     */
    cycle(wheel) {
        if (wheel === 'domain') {
            const domains = Object.keys(this.app.ontologyTaxonomy);
            let idx = domains.indexOf(this.app.drawDomain);
            idx = (idx + 1) % domains.length;
            this.app.drawDomain = domains[idx];

            // Reset Lower Levels
            const domainData = this.app.ontologyTaxonomy[this.app.drawDomain];
            if (domainData.types.length > 0) {
                this.app.drawTypology = domainData.types[0].value;
            }
            this.app.drawSubtype = null;

        } else if (wheel === 'form') {
            const domainData = this.app.ontologyTaxonomy[this.app.drawDomain];
            if (!domainData || !domainData.types) return;

            const types = domainData.types;
            let idx = types.findIndex(t => t.value === this.app.drawTypology);
            if (idx === -1) idx = 0;
            else idx = (idx + 1) % types.length;

            this.app.drawTypology = types[idx].value;
            this.app.drawSubtype = null;

        } else if (wheel === 'rank') {
            const subtypes = this._getSubtypesForTypology(this.app.drawTypology);
            if (!subtypes) return;

            if (!this.app.drawSubtype) {
                this.app.drawSubtype = subtypes[0].value;
            } else {
                let idx = subtypes.findIndex(s => s.value === this.app.drawSubtype);
                idx = (idx + 1) % subtypes.length;
                this.app.drawSubtype = subtypes[idx].value;
            }
        }

        this.updateDisplay();
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
