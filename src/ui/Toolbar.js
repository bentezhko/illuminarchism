/**
 * Toolbar Module
 * Handles tool selection UI
 */

export default class Toolbar {
    constructor(app) {
        this.app = app;
        this.buttons = {};
        this.init();
    }

    init() {
        // Tool buttons
        document.querySelectorAll('[data-tool]').forEach(btn => {
            const toolName = btn.dataset.tool;
            this.buttons[toolName] = btn;
            
            btn.addEventListener('click', () => {
                this.selectTool(toolName);
            });
        });
        
        // Set initial tool
        this.selectTool('pan');
    }

    selectTool(toolName) {
        // Update button states
        Object.values(this.buttons).forEach(btn => {
            btn.classList.remove('active');
        });
        
        if (this.buttons[toolName]) {
            this.buttons[toolName].classList.add('active');
        }
        
        // Notify app
        this.app.setActiveTool(toolName);
    }

    getActiveTool() {
        return this.app.activeTool;
    }
}
