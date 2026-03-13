import { getCentroid } from '../core/math.js';
import {
    getTypology,
    POLITICAL_SUBTYPES,
    LINGUISTIC_SUBTYPES,
    RELIGIOUS_SUBTYPES,
    GEOGRAPHIC_SUBTYPES
} from '../core/Ontology.js';

export default class RegistryRenderer {
    constructor(app, containerId = 'registry-content') {
        this.app = app;
        this.containerId = containerId;
    }


    render() {
        const container = document.getElementById(this.containerId);
        if (!container) return;
        container.innerHTML = '';

        // Iterate OFFICIAL ONTOLOGY to build the reference tree
        const domainIds = Object.keys(this.app.ontologyTaxonomy);

        const domainSubtypesMap = {
            'political': POLITICAL_SUBTYPES,
            'linguistic': LINGUISTIC_SUBTYPES,
            'religious': RELIGIOUS_SUBTYPES,
            'geographic': GEOGRAPHIC_SUBTYPES,
            'cultural': POLITICAL_SUBTYPES // Cultural maps to political types mostly
        };

        domainIds.forEach(domainId => {
            const domainData = this.app.ontologyTaxonomy[domainId];
            if (!domainData) return;

            const domainLabel = domainData.domain.name;
            const domainAbbr = domainData.domain.abbr;
            const domainDesc = domainData.domain.description || '';

            const domainItem = document.createElement('div');
            domainItem.className = 'scroll-item scroll-item-has-submenu';
            domainItem.textContent = `${domainLabel} (${domainAbbr})`;

            const domainMenu = document.createElement('div');
            domainMenu.className = 'scroll-submenu scroll-menu';

            const domainContent = document.createElement('div');
            domainContent.className = 'scroll-content';

            if (domainData.types) {
                domainData.types.forEach(typeDef => {
                    const typeId = typeDef.value;
                    const typeLabel = typeDef.label;

                    // Retrieve full typology metadata from Ontology
                    const typologyObj = getTypology(domainId, typeId) || {};

                    const typeItem = document.createElement('div');
                    typeItem.className = 'scroll-item scroll-item-has-submenu';
                    typeItem.textContent = `${typeLabel}`;

                    // Submenu for Ranks/Subtypes
                    const typeMenu = document.createElement('div');
                    typeMenu.className = 'scroll-submenu scroll-menu';

                    const typeContent = document.createElement('div');
                    typeContent.className = 'scroll-content';

                    // --- ADD RANKS (SUBTYPES) HERE ---
                    const subtypesData = domainSubtypesMap[domainId];
                    if (subtypesData) {
                        Object.values(subtypesData).forEach(subDef => {
                            const subItem = document.createElement('div');
                            subItem.className = 'scroll-item scroll-item-has-submenu';
                            subItem.textContent = `${subDef.label} (${subDef.abbr})`;

                            if (subDef.description || subDef.examples) {
                                const subMenu = document.createElement('div');
                                subMenu.className = 'scroll-submenu scroll-menu';

                                const subContent = document.createElement('div');
                                subContent.className = 'scroll-content';

                                if (subDef.description) {
                                    const subDescDiv = document.createElement('div');
                                    subDescDiv.className = 'scroll-item';
                                    subDescDiv.style.fontStyle = 'italic';
                                    subDescDiv.style.color = 'var(--ink-primary)';
                                    subDescDiv.style.whiteSpace = 'normal';
                                    subDescDiv.style.paddingBottom = '0.5rem';
                                    subDescDiv.textContent = subDef.description;
                                    subContent.appendChild(subDescDiv);
                                }

                                if (subDef.examples) {
                                    const subExDiv = document.createElement('div');
                                    subExDiv.className = 'scroll-item';
                                    subExDiv.style.fontSize = '0.8em';
                                    subExDiv.style.whiteSpace = 'normal';
                                    subExDiv.innerHTML = `<strong>Ex:</strong> `;
                                    subExDiv.appendChild(document.createTextNode(subDef.examples));
                                    subContent.appendChild(subExDiv);
                                }

                                subMenu.appendChild(subContent);
                                subItem.appendChild(subMenu);
                            }

                            typeContent.appendChild(subItem);
                        });
                    }

                    typeMenu.appendChild(typeContent);
                    typeItem.appendChild(typeMenu);
                    domainContent.appendChild(typeItem);
                });
            }

            domainMenu.appendChild(domainContent);

            domainItem.appendChild(domainMenu);
            container.appendChild(domainItem);
        });
    }

}