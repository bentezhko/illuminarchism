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

        // Edit Button
        this.editBtn = document.getElementById('btn-edit-entity');
        // If not found in DOM, create it dynamically or user must add it to HTML.
        // Assuming user wants me to add logic if element exists.
        // OR I can append it to the panel if it doesn't exist?
        // Let's assume there is a button or I inject one into the panel.
        if (!this.editBtn && this.panel) {
            this.editBtn = document.createElement('button');
            this.editBtn.id = 'btn-edit-entity';
            this.editBtn.textContent = 'Edit Geometry';
            this.editBtn.className = 'btn-main';
            this.editBtn.style.marginTop = '1rem';
            this.editBtn.style.width = '100%';
            this.panel.appendChild(this.editBtn);
        }

        if (this.editBtn) {
            this.editBtn.addEventListener('click', () => {
                const entity = this.app.getSelectedEntity();
                if (entity) {
                    this.app.startEditing(entity.id);
                    this.hide(); // Hide panel to focus on editing? Or keep it open?
                    // User said "change from just panning/seeking into specifically editing"
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
