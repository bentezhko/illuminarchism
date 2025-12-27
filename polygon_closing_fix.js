// POLYGON CLOSING FIX FOR ILLUMINARCHISM
// Add this code to your IlluminarchismApp class

// ============================================
// ADD THESE METHODS TO YOUR CLASS
// ============================================

finishDrawing() {
    if (this.draftPoints.length < 2) {
        alert('Need at least 2 points to create a shape');
        return;
    }
    
    // Create new entity if none selected
    if (!this.selectedEntityId) {
        const type = document.getElementById('entity-type').value;
        const name = document.getElementById('entity-name').value || `New ${type} ${this.nextId}`;
        const color = document.getElementById('entity-color').value;
        const parentId = document.getElementById('parent-id').value || null;
        
        const newEntity = new HistoricalEntity(this.nextId++, name, type, color, parentId);
        this.entities.push(newEntity);
        this.selectedEntityId = newEntity.id;
        this.populatePanel(newEntity);
        console.log(`Created new entity: ${name} (ID: ${newEntity.id})`);
    }

    const ent = this.entities.find(e => e.id === this.selectedEntityId);
    if (ent) {
        ent.addKeyframe(this.currentYear, [...this.draftPoints]);
        console.log(`Added keyframe for ${ent.name} at year ${this.currentYear} with ${this.draftPoints.length} points`);
        this.draftPoints = [];
        this.draftCursor = null;
        
        // Switch to select tool
        this.activeTool = 'select';
        document.querySelectorAll('.btn-tool').forEach(b => b.classList.remove('active'));
        document.querySelector('[data-tool="select"]').classList.add('active');
        
        this.updateEntities();
        this.render();
        
        alert(`✓ Shape completed for ${ent.name} at year ${this.currentYear}`);
    }
}

cancelDrawing() {
    console.log('Drawing cancelled');
    this.draftPoints = [];
    this.draftCursor = null;
    this.render();
}

// ============================================
// ADD TO setupCanvas() METHOD
// ============================================

// Double-click to finish
this.canvas.addEventListener('dblclick', (e) => {
    e.preventDefault();
    if (this.activeTool === 'draw' && this.draftPoints.length >= 2) {
        console.log('Double-click detected - finishing drawing');
        this.finishDrawing();
    }
});

// Right-click to finish
this.canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (this.activeTool === 'draw' && this.draftPoints.length >= 2) {
        console.log('Right-click detected - finishing drawing');
        this.finishDrawing();
    }
});

// ============================================
// ADD AS NEW METHOD setupKeyboard()
// CALL IT IN constructor() after setupCanvas()
// ============================================

setupKeyboard() {
    document.addEventListener('keydown', (e) => {
        if (this.activeTool === 'draw' && this.draftPoints.length > 0) {
            if (e.key === 'Enter') {
                console.log('Enter key pressed - finishing drawing');
                if (this.draftPoints.length >= 2) {
                    this.finishDrawing();
                } else {
                    alert('Need at least 2 points to finish');
                }
            } else if (e.key === 'Escape') {
                console.log('Escape key pressed - cancelling drawing');
                this.cancelDrawing();
            }
        }
    });
}

// ============================================
// INSTRUCTIONS
// ============================================
/*

1. Add the finishDrawing() and cancelDrawing() methods to your IlluminarchismApp class

2. Add the double-click and right-click event listeners to your setupCanvas() method

3. Add the setupKeyboard() method to your class

4. Call this.setupKeyboard() in your constructor, right after this.setupCanvas()

5. NOW YOU CAN:
   - Double-click to finish/close polygon
   - Right-click to finish/close polygon
   - Press Enter to finish/close polygon
   - Press Escape to cancel drawing

6. The fix will automatically:
   - Create a new entity if none is selected
   - Add the shape as a keyframe at the current year
   - Clear the draft points
   - Switch back to select tool
   - Show a confirmation message

*/