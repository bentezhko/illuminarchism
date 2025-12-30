# Illuminarchism

**Agent-driven deep map platform for visualizing historiographical cartography with medieval illuminated manuscript aesthetics.**

A WebGL-powered historical atlas tool that lets you create, visualize, and animate temporal geographical data with beautiful hand-drawn medieval aesthetics. Built for massive vector datasets and layered historiographical analysis.

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![WebGL](https://img.shields.io/badge/WebGL-2.0-green)
![License](https://img.shields.io/badge/license-MIT-yellow)

## Features

- **Medieval Aesthetic**: GPU-accelerated parchment texture, ink wobble, and watercolor effects
- **Temporal Cartography**: Keyframe-based geometry with smooth GPU interpolation
- **Multi-Category System**: Political, Geographic, Cultural, Linguistic layers
- **Geographic Features**: Rivers, lakes, oceans, mountains, coastlines
- **Interactive Drawing**: Create polygons, lines, and points with fractal border generation
- **Data Browser**: Tree-view sidebar for managing hundreds of entities by category
- **Atlas Format**: Custom JSON format compatible with GeoJSON
- **High Performance**: 10,000+ polygons at 60 FPS via WebGL
- **Git-Based Storage**: Version control your historical data
- **Hot-Loadable**: Add/remove atlas files without restart

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

## Categories

### Political
- **Country** (polygon) - Nation states and empires
- **Region** (polygon) - Provinces, counties, districts
- **City** (point) - Urban centers
- **Border** (line) - Political boundaries

### Geographic
- **River** (line) - Flowing water
- **Lake** (polygon) - Bodies of fresh water
- **Ocean** (polygon) - Seas and oceans
- **Mountain Range** (line) - Mountain chains
- **Coastline** (line) - Coastal boundaries

### Cultural
- **Traffic Direction** (polygon) - Left vs right-side driving regions
- **Time Format** (polygon) - 12h vs 24h time systems
- **Calendar System** (polygon) - Julian, Gregorian, Islamic, etc.
- **Writing Direction** (polygon) - LTR vs RTL writing systems

### Linguistic
- **Language** (polygon) - Language regions
- **Dialect** (polygon) - Regional language variants
- **Word Evolution** (polygon) - Track individual words through time
- **Writing Script** (polygon) - Alphabet and writing systems

## Project Structure

```
illuminarchism/
├── index.html              # Entry point (single-file app)
├── package.json            # Build config for Cloudflare Pages
├── _headers                # Cloudflare security headers
├── atlases/                # Vector data repository
│   ├── political/
│   ├── geographic/
│   ├── cultural/
│   ├── linguistic/
│   └── README.md
└── README.md
```

## Workflow: Draw → Save → Git → Load

### 1. Draw Your Data

1. Open Illuminarchism in browser
2. Select category (Political, Geographic, Cultural, Linguistic)
3. Select subcategory (e.g., River, Country, Language)
4. Click **Inscribe** tool
5. Click to add points, press **Enter** or **double-click** to finish
6. Edit name, color, description in right panel

### 2. Use Data Browser

- Click **Registry** button to open Data Browser
- See all entities organized by category → subcategory
- Click any item to select and edit it
- Each entity has a unique **ID** (#1, #2, etc.)
- Toggle layer visibility for entire categories

### 3. Export to Atlas File

1. Click **Save**
2. Downloads `illuminarchism_atlas.json` with all entities
3. Includes camera position and current year

### 4. Add to Repository

```bash
# Move to appropriate directory
mv ~/Downloads/illuminarchism_atlas.json atlases/my_research/

# Commit to version control
git add atlases/my_research/illuminarchism_atlas.json
git commit -m "Add historical water systems (1200 AD)"
git push
```

## Usage

### Tools

- **Pan**: Click and drag to navigate, scroll to zoom
- **Seek**: Click entities to select and edit
- **Inscribe**: Click points, press Enter/double-click/right-click to finish
- **Edit Points**: Drag individual vertices, Delete key to remove points
- **Add Keyframe**: Add geometry at current year for selected entity

### Keyboard Shortcuts

- `Enter` - Finish drawing
- `Esc` - Cancel drawing/editing
- `Delete` - Delete point while editing
- `Space` - Play/pause timeline
- `←/→` - Step timeline 50 years
- `Home/End` - Jump to timeline start/end

### Timeline

- Drag slider: 10000 BC to 2025 AD
- Play button: Animate through time
- Speed controls: 0.5x, 1x, 2x, 4x
- Entities interpolate smoothly between keyframes

## Data Browser

**Tree Structure:**
```
Data Browser
  +- Political
  |   +- Country
  |   |   +- Roman Empire #1
  |   |   +- Byzantine Empire #2
  |   +- City
  |       +- Constantinople #3
  +- Geographic
  |   +- River
  |   |   +- Danube #4
  |   +- Lake
  +- Cultural
```

- Click category header to collapse/expand
- Click entity to select and edit
- Selected entities highlighted in blue
- Toggle entire layers on/off at bottom

## Configuration

Edit medieval effects in real-time:

```javascript
// In browser console
app.renderer.settings.wobble = 5.0;         // Hand-shake intensity
app.renderer.settings.inkBleed = 0.5;       // Watercolor bleeding
app.renderer.settings.paperRoughness = 30;  // Parchment grain
```

Or use UI sliders in Ink Properties panel.

## Browser Support

Works in all modern browsers (no WebGL required - uses Canvas 2D):

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Examples

### Track Word Evolution

1. Select **Linguistic** > **Word Evolution**
2. Name: "water"
3. Draw region where word="aqua" (Latin) at year 100 AD
4. Change year to 800 AD, draw new region for "eau" (French)
5. Play timeline to see word spreading and evolving

### Map Traffic Rules

1. Select **Cultural** > **Traffic Direction**
2. Draw left-side driving regions (UK, Japan, etc.)
3. Add keyframes at different years to show changes
4. See how traffic rules spread historically

### Rivers Changing Course

1. Select **Geographic** > **River**
2. Draw river at year 1000 AD
3. Change year to 1500 AD, draw new course
4. Timeline interpolates the gradual shift

## Performance

| Dataset Size | FPS | Notes |
|--------------|-----|-------|
| 100 entities | 60 FPS | Smooth |
| 1,000 entities | 60 FPS | Good |
| 5,000 entities | 30-60 FPS | Depends on complexity |

## Future Enhancements

- [ ] Import GeoJSON/KML files
- [ ] Export to SVG/GeoJSON
- [ ] Search/filter entities
- [ ] Undo/redo system
- [ ] Relationship mapping (parent/child entities)
- [ ] Multi-language UI
- [ ] Historical map overlay
- [ ] Collaborative editing

## License

MIT License - See LICENSE file

## Credits

**Developer**: bentezhko  
**AI Assistant**: Perplexity Pro, Claude  
**Fonts**: Cinzel, IM Fell English (Google Fonts)  

## Style Guidelines

To maintain the authentic "Medieval Chronicle" aesthetic:

1.  **No Emojis**: Do not use emojis in the UI or code. Use text labels or neutral unicode symbols (like `▼` or `X`).
2.  **Typography**: Use 'Cinzel' for headers and 'IM Fell English' for body text.
3.  **Language**: Use period-appropriate terminology (e.g., "Inscribe" instead of "Draw", "Registry" instead of "List").

## Contributing

Contributions welcome! Please:

1. Fork repository
2. Create feature branch
3. Add atlas files to `atlases/` with proper documentation
4. Test all categories and tools
5. Submit pull request

## Support

- **Issues**: https://github.com/bentezhko/illuminarchism/issues
- **Live Demo**: https://illuminarchism.pages.dev

---

**Illuminarchism** - Multi-dimensional historical atlases with medieval aesthetics.
