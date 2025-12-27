# Build & Deployment Guide

## Architecture Decision

**We use modular ES6 + Vite bundler** for ChronosCarto because:

1. **Scale**: Massive temporal vector datasets require code splitting
2. **Custom Format**: Your .atlas format (not GeoJSON) needs flexible parsing
3. **WebGL Shaders**: Hot reload during shader development
4. **Lazy Loading**: Import atlas layers on-demand by spatiotemporal query
5. **Hand-drawn Maps**: Custom basemap integration without format constraints

## Local Development

```bash
npm install
npm run dev
```

Opens at http://localhost:3000 with hot module replacement.

## Production Build

```bash
npm run build
```

Outputs to `dist/` directory (bundled, minified, ready for deployment).

## Cloudflare Pages Configuration

**Build Settings:**
- Build command: `npm run build`
- Build output directory: `dist`
- Node version: 20 (set via .node-version file)

**Deploy:**
- Push to `main` branch → auto-deploys to illuminarchism.pages.dev
- Vite bundles all ES6 modules into optimized JavaScript
- No MIME type issues - single bundled file

## Custom Data Format

### .atlas JSON Structure

Your custom format for temporal vector data:

```json
{
  "id": "polity_byzantine_1000",
  "name": "Byzantine Empire",
  "type": "polity",
  "color": "#8a3324",
  "timeline": [
    {
      "year": 1000,
      "geometry": [{"x": 100, "y": 200}, ...]
    }
  ],
  "validRange": {"start": 800, "end": 1453}
}
```

### Custom Basemap

Place your hand-drawn map in `public/maps/basemap.png`.
Reference in renderer without format constraints.

## Scaling for ChronosCarto

### Current Modules
- `src/core/` - Entity, GeoMath, AtlasManager
- `src/renderer/` - WebGL, Shaders, Viewport
- `src/ui/` - Toolbar, Timeline, InfoPanel
- `src/io/` - AtlasExporter (your custom format)

### Future Expansion
- `src/workers/` - Offload geometry processing
- `src/loaders/` - Spatial chunking for massive datasets
- `src/agents/` - SASE AI data generation hooks
- `src/queries/` - Temporal/spatial filtering

## Why Not Single-File?

The old working version (Dec 23) was ~15KB of embedded JavaScript.

For ChronosCarto scale:
- 100+ atlas layers
- Custom dialectical data
- Multi-year empire morphing
- Architectural diffusion tracking

Single file would be 500KB+ and unmaintainable.
Modular + bundler = optimal.
