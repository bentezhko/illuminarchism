import { getCentroid } from '../core/math.js';

export default class RegistryRenderer {
    constructor(app, containerId = 'registry-content') {
        this.app = app;
        this.containerId = containerId;
    }

    render() {
        const container = document.getElementById(this.containerId);
        if (!container) return;
        container.innerHTML = '';

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

            const domainDiv = document.createElement('div');
            domainDiv.className = 'registry-category';

            // Domain Header
            const domainTitle = document.createElement('div');
            domainTitle.className = 'registry-cat-title';
            domainTitle.textContent = `▶ ${domainLabel} (${domainAbbr})`;
            domainTitle.onclick = () => {
                const content = domainTitle.nextElementSibling;
                content.classList.toggle('open');
                domainTitle.textContent = content.classList.contains('open') ? `▼ ${domainLabel} (${domainAbbr})` : `▶ ${domainLabel} (${domainAbbr})`;
            };
            domainDiv.appendChild(domainTitle);

            // Domain Content
            const domainContent = document.createElement('div');
            domainContent.className = 'registry-list';

            // Iterate Typologies defined in Ontology
            if (domainData.types) {
                domainData.types.forEach(typeDef => {
                    const typeId = typeDef.value;
                    const typeLabel = typeDef.label;
                    const existingEnts = (entityMap[domainId] && entityMap[domainId][typeId]) ? entityMap[domainId][typeId] : [];
                    const count = existingEnts.length;

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
                    typeTitle.style.color = count > 0 ? 'var(--ink-primary)' : 'var(--ink-faded)'; // Dim if empty
                    typeTitle.style.fontSize = '0.85rem';
                    typeTitle.textContent = `▶ ${typeLabel} (${count})`;

                    typeTitle.onclick = (e) => {
                        e.stopPropagation();
                        const typeList = typeTitle.nextElementSibling;
                        typeList.classList.toggle('open');
                        typeTitle.textContent = typeList.classList.contains('open') ? `▼ ${typeLabel} (${count})` : `▶ ${typeLabel} (${count})`;
                    };
                    typeDiv.appendChild(typeTitle);

                    // Entity List
                    const typeList = document.createElement('div');
                    typeList.className = 'registry-list';
                    typeList.style.marginLeft = '0.5rem';

                    if (count > 0) {
                        existingEnts.forEach(ent => {
                            const item = document.createElement('div');
                            item.className = 'registry-item';
                            if (ent.id === this.app.selectedEntityId) item.classList.add('selected'); // Highlight selected

                            const left = document.createElement('div');
                            left.style.display = 'flex';
                            left.style.alignItems = 'center';

                            const toggle = document.createElement('input');
                            toggle.type = 'checkbox';
                            toggle.className = 'toggle-vis';
                            toggle.checked = ent.visible;
                            toggle.onclick = (e) => {
                                e.stopPropagation();
                                ent.visible = toggle.checked;
                                this.app.render();
                            };
                            left.appendChild(toggle);

                            const nameSpan = document.createElement('span');
                            nameSpan.textContent = ent.name;
                            left.appendChild(nameSpan);

                            item.appendChild(left);

                            const goTo = document.createElement('span');
                            goTo.innerHTML = '⌖';
                            goTo.title = 'Go to location';
                            goTo.style.fontSize = '0.8rem';
                            goTo.style.cursor = 'pointer';

                            item.onclick = () => {
                                this.app.selectEntity(ent.id, true);
                            };

                            // Re-bind target click
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
                        // Empty state indicator
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
