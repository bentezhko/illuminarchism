/**
 * InfoPanel Module
 * Handles entity information display and editing
 */

export default class InfoPanel {
    constructor(app) {
        this.app = app;
        this.panel = null;
        this.nameInput = null;
        this.colorInput = null;
        this.descInput = null;
        this.init();
    }

    init() {
        this.panel = document.getElementById('info-panel');
        this.nameInput = document.getElementById('entity-name');
        this.colorInput = document.getElementById('entity-color');
        this.descInput = document.getElementById('entity-desc');
        
        // Setup input handlers
        if (this.nameInput) {
            this.nameInput.addEventListener('input', (e) => {
                const entity = this.app.getSelectedEntity();
                if (entity) {
                    entity.name = e.target.value;
                    this.app.render();
                }
            });
        }
        
        if (this.colorInput) {
            this.colorInput.addEventListener('input', (e) => {
                const entity = this.app.getSelectedEntity();
                if (entity) {
                    entity.color = e.target.value;
                    this.app.render();
                }
            });
        }
        
        if (this.descInput) {
            this.descInput.addEventListener('input', (e) => {
                const entity = this.app.getSelectedEntity();
                if (entity) {
                    entity.description = e.target.value;
                }
            });
        }
        
        this.hide();
    }

    show() {
        if (this.panel) {
            this.panel.style.display = 'block';
        }
    }

    hide() {
        if (this.panel) {
            this.panel.style.display = 'none';
        }
    }

    update(entity) {
        if (!entity) {
            this.hide();
            return;
        }
        
        this.show();
        
        if (this.nameInput) {
            this.nameInput.value = entity.name || '';
        }
        
        if (this.colorInput) {
            this.colorInput.value = entity.color || '#264e86';
        }
        
        if (this.descInput) {
            this.descInput.value = entity.description || '';
        }
    }
}
