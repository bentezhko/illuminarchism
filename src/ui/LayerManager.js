export default class LayerManager {
    constructor(app) {
        this.app = app;
        this.container = null;
        this.listContainer = null;
        this.isOpen = true;
        this.dragSource = null;

        this.init();
    }

    init() {
        // Main Container
        this.container = document.createElement('div');
        this.container.id = 'layer-manager';
        this.container.className = 'pointer-events-auto';
        document.body.appendChild(this.container);

        // Toggle Button
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'btn-toggle-layers';
        toggleBtn.title = 'Toggle Layer Manager';
        toggleBtn.textContent = '▶';
        toggleBtn.onclick = () => this.toggle();
        this.container.appendChild(toggleBtn);

        // Header
        const header = document.createElement('div');
        header.className = 'layer-manager-header';
        header.textContent = 'Layers';
        this.container.appendChild(header);

        // List Container
        this.listContainer = document.createElement('div');
        this.listContainer.id = 'layer-list';
        this.container.appendChild(this.listContainer);

        // Tools
        const tools = document.createElement('div');
        tools.className = 'layer-tools';

        const addBtn = document.createElement('button');
        addBtn.className = 'small-btn';
        addBtn.textContent = '+ New Layer';
        addBtn.style.width = '100%';
        addBtn.onclick = () => this.addLayer();
        tools.appendChild(addBtn);

        this.container.appendChild(tools);

        // Initial Render
        this.render();
    }

    toggle() {
        this.isOpen = !this.isOpen;
        this.container.classList.toggle('closed', !this.isOpen);
        const btn = document.getElementById('btn-toggle-layers');
        if (btn) {
             btn.textContent = this.isOpen ? '▶' : '◀';
        }
    }

    render() {
        if (!this.listContainer) return;
        this.listContainer.innerHTML = '';

        if (!this.app.layers) return;

        // UI shows Top layer (highest order) at TOP. Descending sort.
        const layers = [...this.app.layers].sort((a, b) => b.order - a.order);

        layers.forEach(layer => {
            const item = document.createElement('div');
            item.className = 'layer-item';
            item.draggable = true;
            item.dataset.id = layer.id;

            // Active Class
            if (this.app.activeLayerId === layer.id) {
                item.classList.add('active');
            }

            // Click to set active
            item.onclick = () => this.setActiveLayer(layer.id);

            // Drag Events
            item.ondragstart = (e) => {
                this.dragSource = layer;
                e.dataTransfer.effectAllowed = 'move';
                item.classList.add('dragging');
            };
            item.ondragend = () => {
                this.dragSource = null;
                item.classList.remove('dragging');
                document.querySelectorAll('.layer-item').forEach(el => el.classList.remove('over'));
            };
            item.ondragover = (e) => {
                e.preventDefault(); // Necessary to allow dropping
                item.classList.add('over');
            };
            item.ondragleave = () => {
                item.classList.remove('over');
            };
            item.ondrop = (e) => {
                e.preventDefault();
                item.classList.remove('over');
                if (this.dragSource && this.dragSource.id !== layer.id) {
                    this.reorderLayer(this.dragSource.id, layer.id);
                }
            };

            // 1. Visibility Toggle
            const visBtn = document.createElement('span');
            visBtn.className = 'layer-icon visible-icon';
            visBtn.innerHTML = layer.visible ? '👁' : '✕';
            visBtn.title = layer.visible ? 'Hide Layer' : 'Show Layer';
            if (!layer.visible) visBtn.style.opacity = '0.5';
            visBtn.onclick = (e) => {
                e.stopPropagation();
                this.toggleVisibility(layer.id);
            };
            item.appendChild(visBtn);

            // 2. Name
            const nameSpan = document.createElement('span');
            nameSpan.className = 'layer-name';
            nameSpan.textContent = layer.name;
            if (layer.locked) nameSpan.style.color = 'var(--ink-faded)';
            item.appendChild(nameSpan);

            // 3. Lock Toggle
            const lockBtn = document.createElement('span');
            lockBtn.className = 'layer-icon lock-icon';
            lockBtn.innerHTML = layer.locked ? '🔒' : '🔓';
            lockBtn.title = layer.locked ? 'Unlock Layer' : 'Lock Layer';
            lockBtn.onclick = (e) => {
                e.stopPropagation();
                this.toggleLock(layer.id);
            };
            item.appendChild(lockBtn);

            this.listContainer.appendChild(item);
        });
    }

    addLayer() {
        const name = prompt("Layer Name:", "New Layer");
        if (!name) return;
        const id = 'layer_' + Date.now();
        const maxOrder = this.app.layers.reduce((max, l) => Math.max(max, l.order), 0);

        this.app.layers.push({
            id: id,
            name: name,
            visible: true,
            locked: false,
            order: maxOrder + 1
        });
        this.render();
        // Assume empty layer doesn't need re-render of map immediately, but good practice
    }

    toggleVisibility(layerId) {
        const layer = this.app.layers.find(l => l.id === layerId);
        if (layer) {
            layer.visible = !layer.visible;
            this.render();
            if (this.app.renderer) this.app.renderer.invalidateWorldLayer();
            this.app.render();
        }
    }

    toggleLock(layerId) {
        const layer = this.app.layers.find(l => l.id === layerId);
        if (layer) {
            layer.locked = !layer.locked;
            this.render();
        }
    }

    setActiveLayer(layerId) {
        this.app.activeLayerId = layerId;
        this.render();
    }

    reorderLayer(srcId, targetId) {
        // Swap logic
        const srcLayer = this.app.layers.find(l => l.id === srcId);
        const tgtLayer = this.app.layers.find(l => l.id === targetId);

        if (srcLayer && tgtLayer) {
            const temp = srcLayer.order;
            srcLayer.order = tgtLayer.order;
            tgtLayer.order = temp;

            // Re-normalize just in case
            this.app.layers.sort((a, b) => a.order - b.order);
            this.app.layers.forEach((l, i) => l.order = i);

            this.render();
            if (this.app.renderer) this.app.renderer.invalidateWorldLayer();
            this.app.render();
        }
    }
}
