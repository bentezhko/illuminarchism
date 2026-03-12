export default class LayerManager {
    constructor(app) {
        this.app = app;
        this.container = null;
        this.treeView = null;
        this.dragSource = null;
        this.dragType = null; // 'group' | 'entity'

        // States: 'closed', 'agitated', 'extended'
        this.uiState = 'closed';
        // Pinned States: 'unpinned', 'pinned-extended', 'pinned-closed'
        this.pinnedState = 'unpinned';

        this.init();
    }

    init() {
        // Container
        this.container = document.createElement('div');
        this.container.id = 'layer-manager';
        document.body.appendChild(this.container);

        // Toggle Button (attached to container)
        const toggleBtn = document.createElement('div');
        toggleBtn.id = 'btn-toggle-layers';
        toggleBtn.textContent = '📌';
        toggleBtn.title = 'Pin Panel';
        this.container.appendChild(toggleBtn);
        this.toggleBtn = toggleBtn;

        // Hover interaction logic
        document.addEventListener('mousemove', (e) => {
            if (this.pinnedState !== 'unpinned') return;

            const triggerWidth = window.innerWidth * 0.05;
            const isNearRightEdge = e.clientX >= window.innerWidth - triggerWidth;
            const isOverContainer = this.container.contains(e.target);

            if (isOverContainer) {
                this.setUiState('extended');
            } else if (isNearRightEdge) {
                this.setUiState('agitated');
            } else {
                this.setUiState('closed');
            }
        });

        // Pin Toggle Click
        this.toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // prevent bubling
            if (this.pinnedState === 'unpinned') {
                this.pinnedState = 'pinned-extended';
            } else if (this.pinnedState === 'pinned-extended') {
                this.pinnedState = 'pinned-closed';
            } else {
                this.pinnedState = 'unpinned';
            }
            this.updateUIClasses();
        });

        // Tree View
        this.treeView = document.createElement('div');
        this.treeView.className = 'tree-view';
        this.container.appendChild(this.treeView);

        // Context Menu
        this.ctxMenu = document.createElement('div');
        this.ctxMenu.id = 'layer-context-menu';
        document.body.appendChild(this.ctxMenu);

        // Global Click to close context menu
        document.addEventListener('click', () => this.hideContextMenu());

        this.render();

        this.updateUIClasses();
    }

    setUiState(newState) {
        if (this.uiState !== newState) {
            this.uiState = newState;
            this.updateUIClasses();
        }
    }

    updateUIClasses() {
        this.container.classList.remove('closed', 'agitated', 'extended');

        let effectiveState = this.uiState;
        if (this.pinnedState === 'pinned-extended') {
            effectiveState = 'extended';
        } else if (this.pinnedState === 'pinned-closed') {
            effectiveState = 'closed';
        }

        this.container.classList.add(effectiveState);

        if (this.pinnedState !== 'unpinned') {
            this.toggleBtn.style.color = 'var(--ink-red)'; // Visual indicator for pinned
            this.toggleBtn.textContent = '📍'; // Pinned down symbol
        } else {
            this.toggleBtn.style.color = 'var(--ink-primary)';
            this.toggleBtn.textContent = '📌'; // Ready to pin symbol
        }

        // Handle registry closing if extended
        if (effectiveState === 'extended') {
            const registry = document.getElementById('atlas-registry');
            if (registry && registry.classList.contains('open')) {
                registry.classList.remove('open');
                if (this.app && this.app.renderRegistry) this.app.renderRegistry();
            }
        }
    }

    render() {
        if (!this.treeView || !this.app.layers) return;
        this.treeView.innerHTML = '';

        // Sort Layers (Groups) by order (ascending for list?)
        // Renderer uses order ascending (0 at bottom).
        // In UI list, usually 0 is at bottom, Top is at top.
        // So we render in REVERSE order of 'order' property?
        // Renderer: Order 0 (Water) -> Order 1 (Land).
        // UI: Top (Land), Bottom (Water).
        // Actually, users usually expect Top of list = Top of stack (Painter's Algorithm).
        // So highest order first.
        const sortedLayers = [...this.app.layers].sort((a, b) => b.order - a.order);

        sortedLayers.forEach(layer => {
            const groupEl = this.createGroupElement(layer);
            this.treeView.appendChild(groupEl);
        });

        // Background context menu
        this.treeView.oncontextmenu = (e) => {
            if (e.target === this.treeView) {
                e.preventDefault();
                this.showContextMenu(e.clientX, e.clientY, 'background');
            }
        };
    }

    createGroupElement(layer) {
        const groupEl = document.createElement('div');
        groupEl.className = 'tree-group';
        groupEl.draggable = true;
        groupEl.dataset.id = layer.id;

        // --- Drag Events (Group) ---
        groupEl.ondragstart = (e) => {
            e.stopPropagation();
            this.dragSource = layer;
            this.dragType = 'group';
            e.dataTransfer.effectAllowed = 'move';
            groupEl.style.opacity = '0.5';
        };
        groupEl.ondragend = (e) => {
            groupEl.style.opacity = '1';
            this.dragSource = null;
            this.dragType = null;
            this.clearDropIndicators();
        };
        groupEl.ondragover = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (this.dragType === 'group') {
                groupEl.classList.add('drop-target');
            } else if (this.dragType === 'entity') {
                // Dragging entity into group
                groupEl.querySelector('.group-children').classList.add('drop-target-child');
            }
        };
        groupEl.ondragleave = (e) => {
            groupEl.classList.remove('drop-target');
            groupEl.querySelector('.group-children').classList.remove('drop-target-child');
        };
        groupEl.ondrop = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (this.dragType === 'group' && this.dragSource.id !== layer.id) {
                this.reorderGroup(this.dragSource.id, layer.id);
            } else if (this.dragType === 'entity') {
                // Move entity to this group
                this.moveEntityToGroup(this.dragSource.id, layer.id);
            }
        };

        // Header
        const header = document.createElement('div');
        header.className = `group-header ${this.app.activeLayerId === layer.id ? 'active-layer' : ''}`;

        // Toggle Icon
        const toggle = document.createElement('span');
        toggle.className = 'icon-btn';
        toggle.textContent = layer.expanded ? '▼' : '▶';
        toggle.onclick = (e) => {
            e.stopPropagation();
            layer.expanded = !layer.expanded;
            this.render();
        };
        header.appendChild(toggle);

        // Name (Click to activate layer for new drawing)
        const name = document.createElement('span');
        name.className = 'spacer';
        name.textContent = layer.name;
        name.onclick = () => {
            this.app.activeLayerId = layer.id;
            this.render();
        };
        header.appendChild(name);

        // Vis
        const vis = document.createElement('span');
        vis.className = 'icon-btn';
        vis.textContent = layer.visible ? '👁' : '✕';
        vis.onclick = (e) => {
            e.stopPropagation();
            layer.visible = !layer.visible;
            if (this.app.renderer) this.app.renderer.invalidateWorldLayer();
            this.app.render();
            this.render();
        };
        header.appendChild(vis);

        // Lock
        const lock = document.createElement('span');
        lock.className = 'icon-btn';
        lock.textContent = layer.locked ? '🔒' : '🔓';
        lock.onclick = (e) => {
            e.stopPropagation();
            layer.locked = !layer.locked;
            this.render();
        };
        header.appendChild(lock);

        // Context Menu
        header.oncontextmenu = (e) => {
            e.preventDefault();
            this.showContextMenu(e.clientX, e.clientY, 'group', layer);
        };

        groupEl.appendChild(header);

        // Children Container
        const childrenContainer = document.createElement('div');
        childrenContainer.className = `group-children ${layer.expanded ? 'open' : ''}`;

        // Render Entities
        const entities = this.app.entities.filter(e => e.layerId === layer.id);
        // Sort entities? Currently just creation order (array order).
        // If we want manual sort, we need an index.
        // For now, render in array order.

        entities.forEach(ent => {
            const item = this.createEntityElement(ent, layer);
            childrenContainer.appendChild(item);
        });

        groupEl.appendChild(childrenContainer);

        return groupEl;
    }

    createEntityElement(ent, layer) {
        const item = document.createElement('div');
        item.className = `tree-item ${this.app.selectedEntityId === ent.id ? 'selected' : ''}`;
        item.draggable = true;
        item.dataset.id = ent.id;

        // --- Drag Events (Entity) ---
        item.ondragstart = (e) => {
            e.stopPropagation();
            this.dragSource = ent;
            this.dragType = 'entity';
            e.dataTransfer.effectAllowed = 'move';
            item.style.opacity = '0.5';
        };
        item.ondragend = (e) => {
            item.style.opacity = '1';
            this.dragSource = null;
            this.dragType = null;
            this.clearDropIndicators();
        };
        // Reordering entities
        item.ondragover = (e) => {
             e.preventDefault();
             e.stopPropagation();
             if (this.dragType === 'entity' && this.dragSource.id !== ent.id) {
                 item.style.borderTop = '2px solid var(--ink-red)';
             }
        };
        item.ondragleave = () => {
             item.style.borderTop = 'none';
        };
        item.ondrop = (e) => {
             e.preventDefault();
             e.stopPropagation();
             item.style.borderTop = 'none';
             if (this.dragType === 'entity' && this.dragSource.id !== ent.id) {
                 this.reorderEntity(this.dragSource.id, ent.id);
             } else if (this.dragType === 'group') {
                 // Ignore group drop on entity? Or move group?
             }
        };


        // Icon
        const icon = document.createElement('span');
        icon.className = 'drag-handle';
        icon.textContent = this.getEntityIcon(ent);
        item.appendChild(icon);

        // Visibility Toggle
        const vis = document.createElement('span');
        vis.className = 'icon-btn';
        vis.textContent = ent.visible ? '👁' : '✕';
        vis.title = ent.visible ? 'Hide' : 'Show';
        vis.onclick = (e) => {
            e.stopPropagation();
            ent.visible = !ent.visible;
            if (this.app.renderer) this.app.renderer.invalidateWorldLayer();
            this.app.render();
            this.render(); // Re-render this item (or whole tree) to update icon
        };
        item.appendChild(vis);

        // Name
        const name = document.createElement('span');
        name.className = 'spacer';
        name.textContent = ent.name || 'Unnamed';
        item.appendChild(name);

        // Click to Select
        item.onclick = (e) => {
            this.app.selectEntity(ent.id, true);
            this.render(); // Update selection highlight
        };

        // Context Menu
        item.oncontextmenu = (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Select without opening panel immediately, so "Properties" has a purpose
            this.app.selectEntity(ent.id, false);
            this.showContextMenu(e.clientX, e.clientY, 'entity', ent);
        };

        return item;
    }

    getEntityIcon(ent) {
        if (ent.type === 'water') return '🌊';
        if (ent.type === 'river') return '〰️';
        if (ent.type === 'polity') return '🏰'; // Or specific icon based on typology
        if (ent.domain === 'linguistic') return '🗣';
        if (ent.domain === 'religious') return '⛩';
        return '📍';
    }

    clearDropIndicators() {
        document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
        document.querySelectorAll('.drop-target-child').forEach(el => el.classList.remove('drop-target-child'));
        document.querySelectorAll('.tree-item').forEach(el => el.style.borderTop = 'none');
    }

    // --- Logic ---

    addGroup() {
        const name = prompt("New Group Name:", "New Group");
        if (!name) return;
        const id = 'layer_' + Date.now();
        const maxOrder = this.app.layers.length > 0 ? Math.max(...this.app.layers.map(l => l.order)) : -1;
        this.app.layers.push({
            id: id,
            name: name,
            visible: true,
            locked: false,
            order: maxOrder + 1,
            expanded: true
        });
        this.render();
    }

    reorderGroup(srcId, targetId) {
        const srcIndex = this.app.layers.findIndex(l => l.id === srcId);
        const tgtIndex = this.app.layers.findIndex(l => l.id === targetId);

        if (srcIndex === -1 || tgtIndex === -1) return;

        // Swap orders? No, move to position.
        // We need to re-assign orders to ALL layers based on the new sequence.
        // Currently layers are sorted by order descending in UI.

        // Let's just swap 'order' values for simple swap, OR insert.
        // For standard Drag/Drop list behavior:
        const srcLayer = this.app.layers[srcIndex];
        const tgtLayer = this.app.layers[tgtIndex];

        // If I drag A onto B, A should go above B (or below).
        // Let's implement simple swap for now as it's robust.
        const temp = srcLayer.order;
        srcLayer.order = tgtLayer.order;
        tgtLayer.order = temp;

        this.render();
        if (this.app.renderer) this.app.renderer.invalidateWorldLayer();
        this.app.render();
    }

    moveEntityToGroup(entId, groupId) {
        const ent = this.app.entities.find(e => e.id === entId);
        if (ent && ent.layerId !== groupId) {
            ent.layerId = groupId;
            this.render();
            if (this.app.renderer) this.app.renderer.invalidateWorldLayer();
            this.app.render();
        }
    }

    reorderEntity(srcId, targetId) {
        // This effectively changes the array order in app.entities
        const srcIndex = this.app.entities.findIndex(e => e.id === srcId);
        const tgtIndex = this.app.entities.findIndex(e => e.id === targetId);

        if (srcIndex === -1 || tgtIndex === -1) return;

        const [movedEnt] = this.app.entities.splice(srcIndex, 1);
        // If moving down, index might shift
        // Re-find target index
        const newTgtIndex = this.app.entities.findIndex(e => e.id === targetId);
        this.app.entities.splice(newTgtIndex, 0, movedEnt);

        // Also ensure layer match if we dragged across groups (though this handler is usually within list)
        // If target is in a different group, update source layerId
        const tgtEnt = this.app.entities.find(e => e.id === targetId);
        if (tgtEnt && movedEnt.layerId !== tgtEnt.layerId) {
            movedEnt.layerId = tgtEnt.layerId;
        }

        this.render();
        if (this.app.renderer) this.app.renderer.invalidateWorldLayer();
        this.app.render();
    }

    // --- Context Menu ---

    showContextMenu(x, y, type, target) {
        this.ctxMenu.innerHTML = '';

        if (type === 'background') {
            this.addCtxItem('New Group', () => this.addGroup());
        } else if (type === 'group') {
            this.addCtxItem('Rename', () => {
                const n = prompt('Rename Group:', target.name);
                if (n) { target.name = n; this.render(); }
            });
            this.addCtxItem('Delete Group', () => {
                if (confirm(`Delete group "${target.name}"? Entities inside will be moved to Default.`)) {
                    this.deleteGroup(target.id);
                }
            });
        } else if (type === 'entity') {
            this.addCtxItem('Rename', () => {
                const n = prompt('Rename Entity:', target.name);
                if (n) {
                    target.name = n;
                    this.render();
                    if (this.app.renderer) this.app.renderer.invalidateWorldLayer();
                    this.app.render();
                }
            });
            this.addCtxItem('Delete', () => {
                if (confirm(`Delete entity "${target.name}"?`)) {
                    this.app.deleteEntity(target.id);
                    this.render();
                }
            });
            this.addCtxItem('Properties', () => {
                this.app.selectEntity(target.id, true);
            });
        }

        this.ctxMenu.style.left = `${x}px`;
        this.ctxMenu.style.top = `${y}px`;
        this.ctxMenu.style.display = 'block';
    }

    addCtxItem(text, onClick) {
        const item = document.createElement('div');
        item.className = 'ctx-item';
        item.textContent = text;
        item.onclick = () => {
            onClick();
            this.hideContextMenu();
        };
        this.ctxMenu.appendChild(item);
    }

    hideContextMenu() {
        this.ctxMenu.style.display = 'none';
    }

    deleteGroup(groupId) {
        // Move entities to default or first available layer
        const defaultLayer = this.app.layers.find(l => l.id !== groupId) || { id: 'default' };

        this.app.entities.forEach(e => {
            if (e.layerId === groupId) e.layerId = defaultLayer.id;
        });

        this.app.layers = this.app.layers.filter(l => l.id !== groupId);

        if (this.app.activeLayerId === groupId) {
            this.app.activeLayerId = defaultLayer.id;
        }

        this.render();
        if (this.app.renderer) this.app.renderer.invalidateWorldLayer();
        this.app.render();
    }
}
