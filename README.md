# Illuminarchism

**Agent-driven deep map platform for visualizing historiographical cartography with medieval illuminated manuscript aesthetics.**

A web-based historical atlas tool that lets you create, visualize, and animate temporal geographical data with beautiful hand-drawn medieval aesthetics.

## Features

- ✨ **Medieval Aesthetic**: Hand-drawn wobble effects, watercolor fills, and parchment textures
- 🗺️ **Temporal Cartography**: Keyframe-based geometry that morphs smoothly over time
- 🎨 **Interactive Drawing**: Create realms, routes, and rivers with intuitive tools
- ⚡ **Fractal Coastlines**: Apply procedural roughening for realistic borders
- 💾 **Import/Export**: Save and load your historical atlases as JSON
- 🔍 **Hierarchical Entities**: Support for parent-child relationships (empires, vassals, colonies)

## Project Structure

```
illuminarchism/
├── index.html              # Entry point
├── src/
│   ├── core/
│   │   ├── Entity.js        # Historical entity data model with temporal geometry
│   │   └── GeoMath.js       # Geometric utilities (distance, interpolation, fractals)
│   ├── renderer/
│   │   ├── InkRenderer.js   # Canvas rendering with medieval ink effects
│   │   └── Viewport.js      # Camera/zoom transformation logic
│   ├── ui/
│   │   ├── Toolbar.js       # Tool selection UI controller
│   │   ├── Timeline.js      # Temporal slider and playback controls
│   │   ├── InfoPanel.js     # Entity attribute editor
│   │   └── InputController.js # Mouse/keyboard input handling
│   ├── main.js              # Application bootstrap and orchestration
│   └── style.css            # Medieval manuscript styling
├── package.json
└── README.md
```

## Architecture

### Core Layer

**Entity.js** - Data model for historical entities
- `HistoricalEntity` class with temporal keyframes
- `EntityManager` for collection management
- Geometry resampling for smooth morphing
- Helper utilities (lerp, resampleGeometry, etc.)

**GeoMath.js** - Pure geometric functions
- Point-in-polygon detection
- Distance calculations
- Polygon roughening (midpoint displacement)
- Centroid and bounding box calculations

### Renderer Layer

**InkRenderer.js** - Canvas 2D rendering engine
- Parchment texture generation with grain
- Watercolor fill effect (multiple translucent passes)
- Hand-drawn wobble stroke effect
- Coordinate transformations (screen ↔ world)

**Viewport.js** - Camera management
- Pan and zoom transformations
- Screen/world coordinate conversion
- Bounds fitting

### UI Layer

**Toolbar.js** - Tool selection
- Pan, Select, Draw Polygon, Draw Line, Roughen

**Timeline.js** - Temporal controls
- Year slider
- Playback animation
- Year display

**InfoPanel.js** - Entity editing
- Name, color, description
- Shows/hides based on selection

**InputController.js** - Input handling
- Mouse events (pan, zoom, draw, select)
- Keyboard shortcuts (Enter, Escape, Delete)
- Hover detection

### Main Application

**main.js** - Application orchestrator
- Initializes all components
- Manages application state
- Coordinates rendering loop
- Save/load functionality

## Getting Started

### Local Development

1. Clone the repository:
```bash
git clone https://github.com/bentezhko/illuminarchism.git
cd illuminarchism
```

2. Serve with any static file server:
```bash
# Python 3
python -m http.server 8000

# Node.js (with http-server)
npx http-server
```

3. Open `http://localhost:8000` in your browser

### Usage

**Tools**
- ✋ **Pan**: Click and drag to navigate the map
- 🔍 **Select**: Click entities to select and edit
- 🏰 **Draw Polygon**: Click to add points, press Enter to finish
- 〰️ **Draw Line**: Draw rivers or routes
- ⚡ **Roughen**: Apply fractal algorithm to selected entity's borders

**Timeline**
- Drag the year slider to see entities morph over time
- Entities interpolate smoothly between keyframes

**Editing**
- Select an entity to edit its name, color, and description
- Delete selected entity with Delete/Backspace key

**Save/Load**
- Click "Save Atlas" to export as JSON
- Click "Load Atlas" to import from JSON

## Configuration

Edit `src/core/Entity.js` to adjust:

```javascript
export const CONFIG = {
    ZOOM_SENSITIVITY: 0.001,    // Mouse wheel zoom speed
    MIN_ZOOM: 0.1,              // Minimum zoom level
    MAX_ZOOM: 5,                // Maximum zoom level
    RESAMPLE_COUNT: 100,        // Points for morphing geometry
    WATERCOLOR_PASSES: 3,       // Fill transparency layers
    WATERCOLOR_JITTER: 3,       // Fill edge randomness
    ANIMATION_SPEED: 200        // Timeline playback (ms)
};
```

## Technical Details

### Temporal Geometry System

Entities store geometry as keyframes:
```javascript
entity.addKeyframe(year, [{x, y}, {x, y}, ...]);
```

Interpolation happens automatically when rendering:
```javascript
const geometry = entity.getGeometryAtYear(currentYear);
```

### Hand-Drawn Effect

The "wobble" effect adds random displacement to vertices:
```javascript
const wx = point.x + (Math.random() - 0.5) * wobble;
const wy = point.y + (Math.random() - 0.5) * wobble;
```

### Watercolor Fill

Multiple translucent passes with slight jitter:
```javascript
for (let pass = 0; pass < WATERCOLOR_PASSES; pass++) {
    ctx.fillStyle = rgba(color, alpha / WATERCOLOR_PASSES);
    // Draw with random jitter...
}
```

### Fractal Coastlines

Midpoint displacement algorithm:
1. Find midpoint of each edge
2. Displace perpendicular to edge
3. Repeat recursively
4. Reduce displacement each iteration

## Browser Compatibility

Requires modern browser with:
- ES6 modules support
- Canvas 2D API
- CSS Grid/Flexbox

Tested on:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Future Enhancements

- [ ] Backend database for persistence
- [ ] Multi-user collaboration
- [ ] Export to SVG/PNG
- [ ] More entity types (battles, trade routes)
- [ ] Label rendering (cities, regions)
- [ ] Undo/redo system
- [ ] Bezier curve editing
- [ ] Import from GeoJSON

## License

MIT License - See LICENSE file for details

## Credits

Developed with assistance from Gemini Pro 2.0 Experimental

**Fonts**
- Cinzel (headers) - Google Fonts
- IM Fell English (body) - Google Fonts

## Contributing

Contributions welcome! Please open an issue or pull request.

---

**Illuminarchism** - Where history meets art meets code.
