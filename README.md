# Illuminarchism

**Agent-driven deep map platform for visualizing historiographical cartography with medieval illuminated manuscript aesthetics.**

A WebGL-powered historical atlas tool that lets you create, visualize, and animate temporal geographical data with beautiful hand-drawn medieval aesthetics. Built for massive vector datasets and layered historiographical analysis.

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![WebGL](https://img.shields.io/badge/WebGL-2.0-green)
![License](https://img.shields.io/badge/license-MIT-yellow)

## Features

- ✨ **Medieval Aesthetic**: GPU-accelerated parchment texture, ink wobble, and watercolor effects
- 🗺️ **Temporal Cartography**: Keyframe-based geometry with smooth GPU interpolation
- 📋 **Multi-Layer System**: Independent vector layers (calendars, traffic rules, political boundaries)
- 🎨 **Interactive Drawing**: Create polygons and lines with fractal border generation
- 💾 **Atlas Format**: Custom JSON format compatible with GeoJSON
- 🚀 **High Performance**: 10,000+ polygons at 60 FPS via WebGL
- 📁 **Git-Based Storage**: Version control your historical data
- ⚡ **Hot-Loadable**: Add/remove atlas files without restart

## Quick Start

```bash
# Clone repository
git clone https://github.com/bentezhko/illuminarchism.git
cd illuminarchism

# Serve with any static file server
python -m http.server 8000
# or
npx http-server

# Open browser
open http://localhost:8000
```

## Project Structure

```
illuminarchism/
├── index.html              # Entry point
├── src/
│   ├── core/
│   │   ├── Entity.js        # Historical entity data model
│   │   ├── GeoMath.js       # Geometric utilities
│   │   └── AtlasManager.js  # Multi-file atlas loader
│   ├── renderer/
│   │   ├── WebGLRenderer.js # GPU rendering engine
│   │   └── shaders/
│   │       └── MedievalShader.js # GLSL effects
│   ├── ui/
│   │   ├── Toolbar.js       # Tool selection
│   │   ├── Timeline.js      # Temporal controls
│   │   ├── InfoPanel.js     # Entity editor
│   │   └── InputController.js # Input handling
│   ├── io/
│   │   └── AtlasExporter.js # Export to JSON
│   ├── main.js              # Application entry
│   └── style.css            # Medieval styling
├── atlases/                 # Vector data repository
│   ├── political/
│   ├── calendars/
│   ├── traffic/
│   ├── examples/
│   └── README.md
├── MIGRATION.md            # Canvas 2D → WebGL guide
└── README.md
```

## Workflow: Draw → Save → Git → Load

### 1. Draw Your Data

1. Open Illuminarchism in browser
2. Select drawing tool (🏰 Polygon or 〰️ Line)
3. Click to add points
4. Press **Enter** to finish
5. Edit name, color, description in info panel

### 2. Export to Atlas File

1. Click **💾 Save Atlas**
2. Enter layer name (e.g., `calendars`, `traffic`, `political`)
3. File downloads as `atlas_{layer}_{year}.json`

### 3. Add to Repository

```bash
# Move to appropriate directory
mv ~/Downloads/atlas_calendars_1582.json atlases/calendars/

# Commit to version control
git add atlases/calendars/atlas_calendars_1582.json
git commit -m "Add Gregorian calendar adoption regions (1582)"
git push
```

### 4. Auto-Load on Startup

```javascript
// Edit src/main.js
const defaultAtlases = [
    'atlases/calendars/atlas_calendars_1582.json',
    'atlases/traffic/left_driving_1800.json'
];
```

### 5. Toggle Layers

```javascript
// In browser console or UI
app.layerVisibility['calendars'] = true;  // Show
app.layerVisibility['traffic'] = false;   // Hide
```

## Atlas Format

Custom JSON format compatible with GeoJSON:

```json
{
  "meta": {
    "id": "gregorian-calendar-1582",
    "year": 1582,
    "layer": "calendars",
    "description": "Regions adopting Gregorian calendar",
    "author": "bentezhko"
  },
  "style": {
    "color": "#264e86",
    "strokeWidth": 2,
    "fillOpacity": 0.4
  },
  "entities": [
    {
      "id": "papal-states-gregorian",
      "name": "Papal States",
      "type": "polity",
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [12.0, 42.0],
          [13.0, 42.0],
          [13.0, 43.0],
          [12.0, 43.0],
          [12.0, 42.0]
        ]]
      }
    }
  ]
}
```

See `atlases/README.md` for complete format specification.

## Usage

### Tools

- **✋ Pan**: Click and drag to navigate
- **🔍 Select**: Click entities to select and edit
- **🏰 Draw Polygon**: Click points, press Enter to finish
- **〰️ Draw Line**: Draw rivers, routes, borders
- **⚡ Roughen**: Apply fractal algorithm to borders

### Keyboard Shortcuts

- `P` - Pan tool
- `S` - Select tool
- `D` - Draw polygon
- `Enter` - Finish drawing
- `Esc` - Cancel drawing
- `Delete` - Delete selected entity

### Timeline

- Drag slider to change year
- Entities interpolate smoothly between keyframes
- GPU handles temporal blending automatically

## Configuration

Edit medieval effects in real-time:

```javascript
// In browser console
app.renderer.settings.wobble = 5.0;         // Hand-shake intensity
app.renderer.settings.inkBleed = 0.5;       // Watercolor bleeding
app.renderer.settings.paperRoughness = 30;  // Parchment grain
```

Or use UI sliders in Ink Properties panel.

## Performance

| Dataset Size | Canvas 2D | WebGL |
|--------------|-----------|-------|
| 100 polygons | 60 FPS | 60 FPS |
| 1,000 polygons | 30 FPS | 60 FPS |
| 10,000 polygons | 5 FPS | 60 FPS |

WebGL uses GPU parallelization and geometry batching for consistent performance.

## Browser Support

Requires WebGL2 support:

- ✅ Chrome 56+
- ✅ Firefox 51+
- ✅ Safari 15+
- ✅ Edge 79+

Check compatibility: https://get.webgl.org/webgl2/

## Examples

### Load Multiple Atlases

```javascript
const atlases = [
    'atlases/political/ottoman_1453.json',
    'atlases/calendars/gregorian_1582.json',
    'atlases/traffic/left_driving_1800.json'
];

await app.atlasManager.loadMultiple(atlases);
app.syncEntities();
```

### Export Custom Layer

```javascript
const customEntities = app.entities.filter(e => !e.atlasId);
AtlasExporter.exportSession(customEntities, 1453, 'my-research');
// Downloads: atlas_my-research_1453.json
```

### Toggle Layer Visibility

```javascript
// Show only political boundaries
app.layerVisibility = {
    political: true,
    calendars: false,
    traffic: false
};
```

## Technical Details

### WebGL Rendering Pipeline

1. **Geometry Upload**: Entities → GPU buffers
2. **Vertex Shader**: Apply wobble, transform coordinates
3. **Fragment Shader**: Parchment texture, ink bleeding
4. **Blending**: Alpha compositing for transparency

### Shader Effects

**Parchment Texture**:
```glsl
float grain = perlinNoise(uv * 1000.0);
vec3 parchment = vec3(0.953, 0.914, 0.824) + vec3(grain);
```

**Ink Wobble**:
```glsl
vec2 wobble = (noise(position) - 0.5) * u_wobble;
position += wobble;
```

**Watercolor Bleed**:
```glsl
for (int i = 0; i < 3; i++) {
    bleed += perlinNoise(uv * 10.0 + offset);
}
color = mix(parchment, ink, bleed);
```

## Migration from Canvas 2D

See `MIGRATION.md` for complete guide. Key changes:

- Renderer now uses WebGL2 instead of Canvas 2D
- Performance: 10x improvement for large datasets
- Atlas system: Multi-file support with layers
- Same visual effects maintained via shaders

## Future Enhancements

- [ ] PostGIS backend for massive datasets
- [ ] TimescaleDB for temporal queries
- [ ] Tile-based rendering for continent-scale maps
- [ ] SVG export
- [ ] Collaborative multi-user editing
- [ ] QGIS/ArcGIS import
- [ ] Historical map overlay (georeferenced scans)

## License

MIT License - See LICENSE file

## Credits

**Developer**: bentezhko  
**AI Assistant**: Gemini Pro 2.0 Experimental, Claude  
**Fonts**: Cinzel, IM Fell English (Google Fonts)  

## Contributing

Contributions welcome! Please:

1. Fork repository
2. Create feature branch
3. Add atlas files to `atlases/` with proper documentation
4. Test WebGL rendering
5. Submit pull request

## Support

- **Issues**: https://github.com/bentezhko/illuminarchism/issues
- **WebGL Check**: https://get.webgl.org/webgl2/
- **Documentation**: See `atlases/README.md` and `MIGRATION.md`

---

**Illuminarchism** - Where historiography meets GPU acceleration.
