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

        // 1. Group existing entities by Domain -> Typology
        const entityMap = {};
        this.app.entities.forEach(ent => {
            const d = ent.domain || 'unknown';
            const t = ent.typology || 'unknown';
            if (!entityMap[d]) entityMap[d] = {};
            if (!entityMap[d][t]) entityMap[d][t] = [];
            entityMap[d][t].push(ent);
        });

        // 2. Iterate OFFICIAL ONTOLOGY to build the tree (ensures empty cats show)
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
            if (domainDesc) {
                domainItem.title = domainDesc;
            }

            const domainMenu = document.createElement('div');
            domainMenu.className = 'scroll-submenu scroll-menu';

            const domRollerTop = document.createElement('div');
            domRollerTop.className = 'scroll-roller';
            domainMenu.appendChild(domRollerTop);

            const domainContent = document.createElement('div');
            domainContent.className = 'scroll-content';

            if (domainData.types) {
                domainData.types.forEach(typeDef => {
                    const typeId = typeDef.value;
                    const typeLabel = typeDef.label;

                    // Retrieve full typology metadata from Ontology
                    const typologyObj = getTypology(domainId, typeId) || {};
                    let tooltipParts = [];
                    if (typologyObj.description) tooltipParts.push(`Description: ${typologyObj.description}`);
                    if (typologyObj.historicalValidity) tooltipParts.push(`Historical Validity: ${typologyObj.historicalValidity}`);
                    if (typologyObj.population) tooltipParts.push(`Population: ${typologyObj.population.min} - ${typologyObj.population.max}`);

                    const existingEnts = (entityMap[domainId] && entityMap[domainId][typeId])
                        ? entityMap[domainId][typeId] : [];
                    const count = existingEnts.length;

                    const typeItem = document.createElement('div');
                    typeItem.className = 'scroll-item scroll-item-has-submenu';
                    typeItem.style.color = count > 0 ? 'var(--ink-primary)' : 'var(--ink-faded)';
                    typeItem.textContent = `${typeLabel} (${count}) ${count > 0 ? '▶' : ''}`;
                    if (tooltipParts.length > 0) {
                        typeItem.title = tooltipParts.join('\n');
                    }

                    if (count > 0) {
                        const typeMenu = document.createElement('div');
                        typeMenu.className = 'scroll-submenu scroll-menu';

                        const typRollerTop = document.createElement('div');
                        typRollerTop.className = 'scroll-roller';
                        typeMenu.appendChild(typRollerTop);

                        const typeContent = document.createElement('div');
                        typeContent.className = 'scroll-content scroll-submenu-entities';

                        existingEnts.forEach(ent => {
                            const entBtn = document.createElement('button');
                            entBtn.className = 'scroll-item';
                            entBtn.textContent = ent.name;
                            if (ent.id === this.app.selectedEntityId) {
                                entBtn.style.color = 'var(--rubric-red)';
                                entBtn.style.fontWeight = 'bold';
                            }

                            entBtn.onclick = (e) => {
                                e.stopPropagation();
                                this.app.selectEntity(ent.id, true);
                                // Optional: center view on entity
                                if (ent.currentGeometry && ent.currentGeometry.length > 0) {
                                    let c = { x: 0, y: 0 };
                                    if (ent.type === 'city' || ent.typology === 'city') {
                                        c = ent.currentGeometry[0];
                                    } else {
                                        c = getCentroid(ent.currentGeometry);
                                    }
                                    if (this.app.renderer && this.app.renderer.transform) {
                                        this.app.renderer.transform.x = this.app.renderer.width / 2 - c.x * this.app.renderer.transform.k;
                                        this.app.renderer.transform.y = this.app.renderer.height / 2 - c.y * this.app.renderer.transform.k;
                                        this.app.render();
                                    }
                                }
                            };
                            typeContent.appendChild(entBtn);
                        });

                        typeMenu.appendChild(typeContent);

                        const typRollerBot = document.createElement('div');
                        typRollerBot.className = 'scroll-roller bottom';
                        typeMenu.appendChild(typRollerBot);

                        typeItem.appendChild(typeMenu);
                    }

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