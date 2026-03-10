import { getCentroid } from '../core/math.js';
import { getTypology } from '../core/Ontology.js';

export default class RegistryRenderer {
    constructor(app, containerId = 'registry-content') {
        this.app = app;
        this.containerId = containerId;
    }


    render() {
        const container = document.getElementById(this.containerId);
        if (!container) return;
        container.innerHTML = '';

        // --- MEASUREMENT SETTINGS ---
        const settingsDiv = document.createElement('div');
        settingsDiv.className = 'scroll-item scroll-item-has-submenu';
        settingsDiv.style.borderBottom = '1px solid var(--ink-faded)';
        settingsDiv.textContent = 'Scale Measurement ▶';

        const settingsMenu = document.createElement('div');
        settingsMenu.className = 'scroll-submenu scroll-menu';

        const settingsRollerTop = document.createElement('div');
        settingsRollerTop.className = 'scroll-roller';
        settingsMenu.appendChild(settingsRollerTop);

        const settingsContent = document.createElement('div');
        settingsContent.className = 'scroll-content';

        const units = [
            { val: 'leagues', label: 'Leagues (Base)' },
            { val: 'miles', label: 'Miles (3x)' },
            { val: 'km', label: 'Kilometers (4.8x)' },
            { val: 'stadia', label: 'Stadia (24x)' },
            { val: 'versts', label: 'Versts (4.5x)' }
        ];

        units.forEach(u => {
            const btn = document.createElement('button');
            btn.className = 'scroll-item';
            btn.textContent = u.label;
            if (this.app.renderer && this.app.renderer.scaleUnit === u.val) {
                btn.style.color = 'var(--rubric-red)';
                btn.style.fontWeight = 'bold';
            }
            btn.onclick = (e) => {
                e.stopPropagation(); // keep menu open or let it close depending on css hover
                if (this.app.renderer) {
                    this.app.renderer.scaleUnit = u.val;
                    this.app.renderer.invalidateWorldLayer();
                    this.app.render();
                    this.render(); // re-render registry to update selection
                }
            };
            settingsContent.appendChild(btn);
        });

        settingsMenu.appendChild(settingsContent);

        const settingsRollerBot = document.createElement('div');
        settingsRollerBot.className = 'scroll-roller bottom';
        settingsMenu.appendChild(settingsRollerBot);

        settingsDiv.appendChild(settingsMenu);
        container.appendChild(settingsDiv);
        // -----------------------------

        // Iterate OFFICIAL ONTOLOGY to build the reference tree
        const domainIds = Object.keys(this.app.ontologyTaxonomy);

        domainIds.forEach(domainId => {
            const domainData = this.app.ontologyTaxonomy[domainId];
            if (!domainData) return;

            const domainLabel = domainData.domain.name;
            const domainAbbr = domainData.domain.abbr;
            const domainDesc = domainData.domain.description || '';

            const domainItem = document.createElement('div');
            domainItem.className = 'scroll-item scroll-item-has-submenu';
            domainItem.textContent = `${domainLabel} (${domainAbbr}) ▶`;

            const domainMenu = document.createElement('div');
            domainMenu.className = 'scroll-submenu scroll-menu';

            const domRollerTop = document.createElement('div');
            domRollerTop.className = 'scroll-roller';
            domainMenu.appendChild(domRollerTop);

            const domainContent = document.createElement('div');
            domainContent.className = 'scroll-content scroll-submenu-entities';

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
                    typeItem.textContent = `${typeLabel} ▶`;

                    // Submenu for Typology Description
                    const typeMenu = document.createElement('div');
                    typeMenu.className = 'scroll-submenu scroll-menu';

                    const typRollerTop = document.createElement('div');
                    typRollerTop.className = 'scroll-roller';
                    typeMenu.appendChild(typRollerTop);

                    const typeContent = document.createElement('div');
                    typeContent.className = 'scroll-content scroll-submenu-entities';

                    // Add description text
                    if (typologyObj.description) {
                        const typDescDiv = document.createElement('div');
                        typDescDiv.className = 'scroll-item';
                        typDescDiv.style.fontStyle = 'italic';
                        typDescDiv.style.color = 'var(--ink-primary)';
                        typDescDiv.style.whiteSpace = 'normal';
                        typDescDiv.style.paddingBottom = '0.5rem';
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

                    typeMenu.appendChild(typeContent);

                    const typRollerBot = document.createElement('div');
                    typRollerBot.className = 'scroll-roller bottom';
                    typeMenu.appendChild(typRollerBot);

                    typeItem.appendChild(typeMenu);
                    domainContent.appendChild(typeItem);
                });
            }

            domainMenu.appendChild(domainContent);

            const domRollerBot = document.createElement('div');
            domRollerBot.className = 'scroll-roller bottom';
            domainMenu.appendChild(domRollerBot);

            domainItem.appendChild(domainMenu);
            container.appendChild(domainItem);
        });
    }

}