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

            if (domainDesc) {
                const descDiv = document.createElement('div');
                descDiv.className = 'scroll-item';
                descDiv.style.fontStyle = 'italic';
                descDiv.style.color = 'var(--ink-faded)';
                descDiv.style.borderBottom = '1px solid var(--ink-faded)';
                descDiv.style.whiteSpace = 'normal';
                descDiv.style.paddingBottom = '0.5rem';
                descDiv.textContent = domainDesc;
                domainContent.appendChild(descDiv);
            }

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

                    // Add description text for the Form/Typology
                    if (typologyObj.description) {
                        const typDescDiv = document.createElement('div');
                        typDescDiv.className = 'scroll-item';
                        typDescDiv.style.fontStyle = 'italic';
                        typDescDiv.style.color = 'var(--ink-primary)';
                        typDescDiv.style.whiteSpace = 'normal';
                        typDescDiv.style.paddingBottom = '0.5rem';
                        typDescDiv.style.borderBottom = '1px dashed var(--ink-faded)';
                        typDescDiv.textContent = typologyObj.description;
                        typeContent.appendChild(typDescDiv);
                    }

                    // Add other metadata if available
                    if (typologyObj.historicalValidity) {
                        const validDiv = document.createElement('div');
                        validDiv.className = 'scroll-item';
                        validDiv.style.fontSize = '0.8em';
                        validDiv.style.whiteSpace = 'normal';
                        validDiv.innerHTML = `<strong>Era:</strong> ${typologyObj.historicalValidity}`;
                        typeContent.appendChild(validDiv);
                    }
                    if (typologyObj.population) {
                        const popDiv = document.createElement('div');
                        popDiv.className = 'scroll-item';
                        popDiv.style.fontSize = '0.8em';
                        popDiv.style.whiteSpace = 'normal';
                        popDiv.innerHTML = `<strong>Pop:</strong> ${typologyObj.population.min} - ${typologyObj.population.max}`;
                        typeContent.appendChild(popDiv);
                    }
                    if (typologyObj.examples) {
                        const exDiv = document.createElement('div');
                        exDiv.className = 'scroll-item';
                        exDiv.style.fontSize = '0.8em';
                        exDiv.style.whiteSpace = 'normal';
                        exDiv.innerHTML = `<strong>Ex:</strong> ${typologyObj.examples}`;
                        typeContent.appendChild(exDiv);
                    }

                    // --- ADD RANKS (SUBTYPES) HERE ---
                    const subtypesData = domainSubtypesMap[domainId];
                    if (subtypesData) {
                        const subtypesHeader = document.createElement('div');
                        subtypesHeader.className = 'scroll-item';
                        subtypesHeader.style.fontWeight = 'bold';
                        subtypesHeader.style.background = 'rgba(0,0,0,0.05)';
                        subtypesHeader.style.marginTop = '0.5rem';
                        subtypesHeader.textContent = 'Associated Ranks';
                        typeContent.appendChild(subtypesHeader);

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
                                    subExDiv.innerHTML = `<strong>Ex:</strong> ${subDef.examples}`;
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