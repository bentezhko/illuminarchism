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
        settingsDiv.className = 'registry-category';
        settingsDiv.style.borderBottom = '1px solid var(--ink-faded)';
        settingsDiv.style.marginBottom = '1rem';
        settingsDiv.style.paddingBottom = '0.5rem';

        const settingsTitle = document.createElement('div');
        settingsTitle.className = 'registry-cat-title';
        settingsTitle.textContent = 'Scale Measurement';
        settingsTitle.style.fontWeight = 'bold';
        settingsTitle.style.color = 'var(--rubric-red)';
        settingsDiv.appendChild(settingsTitle);

        const unitSelect = document.createElement('select');
        unitSelect.style.width = '100%';
        unitSelect.style.marginTop = '0.5rem';
        unitSelect.style.padding = '4px';
        unitSelect.style.fontFamily = 'Cinzel, serif';
        unitSelect.style.background = 'var(--parchment-bg)';
        unitSelect.style.border = '1px solid var(--ink-faded)';
        unitSelect.style.color = 'var(--ink-primary)';

        const units = [
            { val: 'leagues', label: 'Leagues (Base)' },
            { val: 'miles', label: 'Miles (3x)' },
            { val: 'km', label: 'Kilometers (4.8x)' },
            { val: 'stadia', label: 'Stadia (24x)' },
            { val: 'versts', label: 'Versts (4.5x)' }
        ];

        units.forEach(u => {
            const opt = document.createElement('option');
            opt.value = u.val;
            opt.textContent = u.label;
            if (this.app.renderer.scaleUnit === u.val) opt.selected = true;
            unitSelect.appendChild(opt);
        });

        unitSelect.addEventListener('change', (e) => {
            this.app.renderer.scaleUnit = e.target.value;
            this.app.renderer.invalidateWorldLayer();
            this.app.render();
        });

        settingsDiv.appendChild(unitSelect);
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
            const domainDescription = domainData.domain.description || null;

            const domainDiv = document.createElement('div');
            domainDiv.className = 'registry-category';

            // Domain Header
            const domainTitle = document.createElement('div');
            domainTitle.className = 'registry-cat-title';
            domainTitle.textContent = `\u25b6 ${domainLabel} (${domainAbbr})`;
            domainTitle.onclick = () => {
                const content = domainTitle.nextElementSibling;
                content.classList.toggle('open');
                domainTitle.textContent = content.classList.contains('open')
                    ? `\u25bc ${domainLabel} (${domainAbbr})`
                    : `\u25b6 ${domainLabel} (${domainAbbr})`;
            };
            domainDiv.appendChild(domainTitle);

            // Domain Content
            const domainContent = document.createElement('div');
            domainContent.className = 'registry-list';

            // Domain wiki description — shown at top of expanded domain section
            if (domainDescription) {
                const domainDescDiv = document.createElement('div');
                domainDescDiv.style.fontSize = '0.75rem';
                domainDescDiv.style.color = 'var(--ink-faded)';
                domainDescDiv.style.fontStyle = 'italic';
                domainDescDiv.style.padding = '0.3rem 0.4rem 0.5rem';
                domainDescDiv.style.borderBottom = '1px solid var(--ink-faded)';
                domainDescDiv.style.marginBottom = '0.4rem';
                domainDescDiv.style.lineHeight = '1.4';
                domainDescDiv.textContent = domainDescription;
                domainContent.appendChild(domainDescDiv);
            }

            // Iterate Typologies defined in Ontology
            if (domainData.types) {
                domainData.types.forEach(typeDef => {
                    const typeId = typeDef.value;
                    const typeLabel = typeDef.label;
                    const existingEnts = (entityMap[domainId] && entityMap[domainId][typeId])
                        ? entityMap[domainId][typeId] : [];
                    const count = existingEnts.length;

                    // Pull full typology object from Ontology for wiki content
                    const fullTypology = getTypology(domainId, typeId);

                    // Typology Header
                    const typeDiv = document.createElement('div');
                    typeDiv.className = 'registry-typology';
                    typeDiv.style.marginLeft = '0.5rem';
                    typeDiv.style.borderLeft = '1px solid var(--ink-faded)';
                    typeDiv.style.paddingLeft = '0.5rem';

                    const typeTitle = document.createElement('div');
                    typeTitle.className = 'registry-type-title';
                    typeTitle.style.cursor = 'pointer';
                    typeTitle.style.fontStyle = 'italic';
                    typeTitle.style.color = count > 0 ? 'var(--ink-primary)' : 'var(--ink-faded)';
                    typeTitle.style.fontSize = '0.85rem';
                    typeTitle.textContent = `\u25b6 ${typeLabel} (${count})`;

                    typeTitle.onclick = (e) => {
                        e.stopPropagation();
                        const typeList = typeTitle.nextElementSibling;
                        typeList.classList.toggle('open');
                        typeTitle.textContent = typeList.classList.contains('open')
                            ? `\u25bc ${typeLabel} (${count})`
                            : `\u25b6 ${typeLabel} (${count})`;
                    };
                    typeDiv.appendChild(typeTitle);

                    // Typology Content
                    const typeList = document.createElement('div');
                    typeList.className = 'registry-list';
                    typeList.style.marginLeft = '0.5rem';

                    // --- Typology wiki block ---
                    if (fullTypology) {
                        // Description
                        if (fullTypology.description) {
                            const typeDescDiv = document.createElement('div');
                            typeDescDiv.style.fontSize = '0.72rem';
                            typeDescDiv.style.color = 'var(--ink-faded)';
                            typeDescDiv.style.fontStyle = 'italic';
                            typeDescDiv.style.padding = '0.25rem 0.3rem 0.15rem';
                            typeDescDiv.style.lineHeight = '1.35';
                            typeDescDiv.textContent = fullTypology.description;
                            typeList.appendChild(typeDescDiv);
                        }

                        // Metadata line: boundary type, historical validity, population, examples
                        const metaItems = [];
                        if (fullTypology.boundaryType) {
                            metaItems.push(`Boundary\u00a0type: ${fullTypology.boundaryType}`);
                        }
                        if (fullTypology.historicalValidity) {
                            metaItems.push(fullTypology.historicalValidity);
                        }
                        if (fullTypology.population) {
                            metaItems.push(`Pop.\u00a0${fullTypology.population.min}\u2013${fullTypology.population.max}`);
                        }
                        if (fullTypology.examples) {
                            metaItems.push(`e.g.\u00a0${fullTypology.examples}`);
                        }

                        if (metaItems.length > 0) {
                            const metaDiv = document.createElement('div');
                            metaDiv.style.fontSize = '0.65rem';
                            metaDiv.style.color = 'var(--rubric-red)';
                            metaDiv.style.padding = '0.05rem 0.3rem 0.3rem';
                            metaDiv.style.fontVariant = 'small-caps';
                            metaDiv.style.lineHeight = '1.4';
                            metaDiv.textContent = metaItems.join(' \u00b7 ');
                            typeList.appendChild(metaDiv);
                        }

                        // Divider before entity instances
                        if (count > 0) {
                            const divider = document.createElement('div');
                            divider.style.borderTop = '1px solid var(--ink-faded)';
                            divider.style.margin = '0.2rem 0.3rem 0.25rem';
                            divider.style.opacity = '0.4';
                            typeList.appendChild(divider);
                        }
                    }

                    // --- Entity instances (name + go-to only) ---
                    if (count > 0) {
                        existingEnts.forEach(ent => {
                            const item = document.createElement('div');
                            item.className = 'registry-item';
                            if (ent.id === this.app.selectedEntityId) item.classList.add('selected');

                            item.onclick = () => {
                                this.app.selectEntity(ent.id, true);
                            };

                            const nameSpan = document.createElement('span');
                            nameSpan.textContent = ent.name;
                            item.appendChild(nameSpan);

                            const goTo = document.createElement('span');
                            goTo.innerHTML = '&#8982;';
                            goTo.title = 'Go to location';
                            goTo.style.fontSize = '0.8rem';
                            goTo.style.cursor = 'pointer';

                            goTo.onclick = (e) => {
                                e.stopPropagation();
                                this.app.selectEntity(ent.id, false);
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
                            item.appendChild(goTo);
                            typeList.appendChild(item);
                        });
                    } else {
                        const emptyMsg = document.createElement('div');
                        emptyMsg.style.fontStyle = 'italic';
                        emptyMsg.style.fontSize = '0.7rem';
                        emptyMsg.style.color = 'var(--ink-faded)';
                        emptyMsg.style.padding = '0.2rem 0.5rem';
                        emptyMsg.textContent = '(No entities)';
                        typeList.appendChild(emptyMsg);
                    }

                    typeDiv.appendChild(typeList);
                    domainContent.appendChild(typeDiv);
                });
            }

            domainDiv.appendChild(domainContent);
            container.appendChild(domainDiv);
        });
    }
}
