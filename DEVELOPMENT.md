# Illuminarchism Development Guide

## Current Status: ✅ COMPLETE

The modular architecture migration is **complete**. All core systems are implemented and functional.

## Architecture Overview

### Rendering Engine: Canvas 2D (NOT WebGL)

We deliberately chose **Canvas 2D** over WebGL for several reasons:

1. **Medieval Aesthetics**: Canvas 2D is perfect for hand-drawn effects, wobble, and watercolor
2. **Simplicity**: No shader compilation, easier debugging
3. **Browser Compatibility**: Works everywhere, no WebGL2 requirement
4. **Performance**: Sufficient for historical maps (not real-time 3D)

### System Components

#### ✅ Core Layer (Data)
- `Entity.js` - Temporal entity model with keyframe interpolation
- `GeoMath.js` - Pure geometric utilities (no rendering)
- `CONFIG` - Global configuration constants

#### ✅ Renderer Layer (Presentation)
- `InkRenderer.js` - Canvas 2D with medieval ink effects
- `Viewport.js` - Camera transformation utilities

#### ✅ UI Layer (Interaction)
- `Toolbar.js` - Tool selection buttons
- `Timeline.js` - Temporal slider with playback
- `InfoPanel.js` - Entity attribute editor
- `InputController.js` - Mouse/keyboard event handling

#### ✅ Application
- `main.js` - Orchestrates all modules, manages state
- `style.css` - Medieval manuscript styling
- `index.html` - Clean HTML structure with ES6 modules

## Running the Application

### Method 1: Python HTTP Server
```bash
cd illuminarchism
python -m http.server 8000
# Open http://localhost:8000
```

### Method 2: Node.js http-server
```bash
npx http-server
# Open http://localhost:8080
```

### Method 3: VS Code Live Server
1. Install "Live Server" extension
2. Right-click `index.html`
3. Select "Open with Live Server"

## Verification Checklist

When you load the app, you should see:

- [ ] Parchment-colored background with grain texture
- [ ] Header with "Illuminarchism" title
- [ ] Toolbar on left side (Pan, Select, Draw tools)
- [ ] Ink Properties panel on right
- [ ] Timeline slider at bottom of panel
- [ ] One demo kingdom (blue square) that morphs when you drag the timeline
- [ ] Ability to pan (hand tool) and zoom (mouse wheel)
- [ ] Ability to draw new realms (castle tool + click points + Enter)

## Current Features

### ✅ Implemented

**Rendering**
- Parchment texture generation
- Hand-drawn wobble effect
- Watercolor fill (multiple translucent passes)
- Pan and zoom with smooth transforms
- Entity-specific rendering (polity, river, city)

**Temporal System**
- Keyframe-based geometry storage
- Linear interpolation between keyframes
- Timeline slider with year display
- Playback animation (play/pause)

**Interaction**
- Pan tool (click-drag)
- Select tool (click entity)
- Draw polygon tool (click points, Enter to finish)
- Draw line tool (for rivers/routes)
- Roughen tool (apply fractal to borders)
- Keyboard shortcuts (Enter, Escape, Delete)

**Data Management**
- Save atlas to JSON
- Load atlas from JSON
- Entity CRUD operations
- Hierarchical relationships (parentId)

### 🔨 Next Features (Future)

**Enhancement Ideas**
- [ ] Undo/redo system
- [ ] Label rendering (entity names on map)
- [ ] Export to PNG/SVG
- [ ] Import from GeoJSON
- [ ] Bezier curve editing for smoother borders
- [ ] More entity types (battles, trade routes)
- [ ] Backend persistence (PostgreSQL + PostGIS)
- [ ] Multi-user collaboration (WebSocket)
- [ ] AI agent integration for historical research

## Debugging

### Check Console

Open browser DevTools (F12) and check for:
- Module import errors
- Missing DOM elements
- Failed event listeners

### Common Issues

**Issue**: Blank screen
- **Fix**: Check console for module import errors
- **Fix**: Verify you're serving via HTTP (not file://)

**Issue**: Can't draw
- **Fix**: Ensure toolbar buttons are clickable (pointer-events-auto class)
- **Fix**: Check if canvas is receiving mouse events

**Issue**: Timeline doesn't work
- **Fix**: Verify HTML has `id="time-slider"` and `id="year-display"`
- **Fix**: Check Timeline.js is properly imported in main.js

### Inspect Global State

In browser console, type:
```javascript
window.illuminarchismApp
```

You should see:
```javascript
{
  renderer: InkRenderer,
  entityManager: EntityManager,
  toolbar: Toolbar,
  timeline: Timeline,
  infoPanel: InfoPanel,
  entities: Array,
  currentYear: 1000,
  // ... etc
}
```

## Code Style Guidelines

### Module Structure
```javascript
/**
 * Module Name
 * Brief description of purpose
 */

import Dependencies from './path.js';

export default class ModuleName {
    constructor() {
        // Initialize
    }
    
    /**
     * Method with JSDoc comment
     */
    methodName() {
        // Implementation
    }
}
```

### Naming Conventions
- Classes: `PascalCase`
- Functions/Methods: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Private methods: `_leadingUnderscore`

### File Organization
- One class per file
- Named exports for utilities
- Default export for main class

## Performance Considerations

### Current Optimizations
- Resampling geometry to fixed point count (smooth morphing)
- Throttled hover detection (every 5 frames)
- Pattern caching for parchment texture
- RequestAnimationFrame for render loop

### Performance Targets
- 60 FPS for basic rendering
- < 100ms for entity creation
- < 50ms for timeline scrubbing

## Testing Strategy

### Manual Testing
1. Open app in browser
2. Test each tool in toolbar
3. Draw a realm, select it, edit it
4. Drag timeline slider
5. Save and reload

### Future: Automated Testing
- Unit tests for GeoMath utilities
- Integration tests for Entity timeline
- E2E tests for user workflows

## Deployment

### GitHub Pages
```bash
git push origin main
# Enable GitHub Pages in repository settings
# Point to root or /docs folder
```

### Cloudflare Pages
1. Connect repository to Cloudflare Pages
2. Build command: (none - static site)
3. Output directory: `/`

### Netlify
1. Connect repository
2. Build command: (none)
3. Publish directory: `/`

## Contributing

### Adding a New Entity Type

1. Add to Entity.js type validation
2. Add rendering logic to InkRenderer.js
3. Add UI button to Toolbar
4. Update documentation

### Adding a New Tool

1. Add button to index.html toolbar
2. Add handler in Toolbar.js
3. Add logic in InputController.js
4. Update cursor style in style.css

## Resources

### External Libraries (None!)
We use **zero external dependencies** - pure vanilla JavaScript.

### Fonts
- [Cinzel](https://fonts.google.com/specimen/Cinzel) - Headers
- [IM Fell English](https://fonts.google.com/specimen/IM+Fell+English) - Body

### Inspiration
- Medieval illuminated manuscripts
- Historical atlases (Spruner, Shepherd)
- XKCD hand-drawn aesthetic

## Questions?

Check:
1. This guide
2. README.md for overview
3. Code comments for implementation details
4. Browser console for runtime errors

---

**Status**: System is complete and functional. Ready for testing and feature additions.
