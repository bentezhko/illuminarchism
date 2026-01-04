export default class RegistryRenderer {
    constructor(app, containerId = 'registry-content') {
        this.app = app;
        this.containerId = containerId;
    }

    render() {
        const reg = document.getElementById(this.containerId);
        if (!reg) return;

        reg.innerHTML = '';

        // Group Entities: Domain -> Typology
        const entityMap = {};

        this.app.entities.forEach(ent => {
            const d = ent.domain || 'unknown';
            const t = ent.typology || 'unknown';

            if (!entityMap[d]) entityMap[d] = {};
            if (!entityMap[d][t]) entityMap[d][t] = [];
            entityMap[d][t].push(ent);
        });

        // Iterate Configured Taxonomy (to keep order)
        const domainIds = Object.keys(this.app.ontologyTaxonomy);

        domainIds.forEach(domainId => {
            const domainData = this.app.ontologyTaxonomy[domainId];

            // Domain Header
            const dHeader = document.createElement('div');
            dHeader.className = 'registry-domain-header';
            dHeader.textContent = domainData.domain.name;
            reg.appendChild(dHeader);

            const dContent = document.createElement('div');
            dContent.className = 'registry-domain-content';

            if (domainData.types) {
                domainData.types.forEach(typeDef => {
                    const typeId = typeDef.value;
                    const entities = entityMap[domainId] ? entityMap[domainId][typeId] : [];

                    if (entities && entities.length > 0) {
                        const tHeader = document.createElement('div');
                        tHeader.className = 'registry-type-header';
                        tHeader.textContent = `${typeDef.label} (${entities.length})`;
                        dContent.appendChild(tHeader);

                        entities.forEach(ent => {
                            const row = document.createElement('div');
                            row.className = 'registry-row';
                            row.dataset.id = ent.id;
                            if (ent.id === this.app.selectedEntityId) row.classList.add('selected');

                            // Color Dot
                            const dot = document.createElement('div');
                            dot.className = 'color-dot';
                            dot.style.backgroundColor = ent.color;
                            row.appendChild(dot);

                            // Name
                            const nameSpan = document.createElement('span');
                            nameSpan.textContent = ent.name;
                            row.appendChild(nameSpan);

                            // Target Icon
                            const target = document.createElement('span');
                            target.className = 'target-icon';
                            target.textContent = '⌖';
                            target.onclick = (e) => {
                                e.stopPropagation();
                                this.app.focusSelectedEntity(ent.id);
                            };
                            row.appendChild(target);

                            row.onclick = () => {
                                this.app.selectEntity(ent.id, true);
                            };

                            dContent.appendChild(row);
                        });
                    }
                });
            }
            reg.appendChild(dContent);
        });

        // Handle Unknown/Legacy
        // (Optional: Add logic here if needed for entities not in current ontology)
    }
}
