# Illuminarchism Atlas Repository

This directory contains vector atlas files in the Illuminarchism custom JSON format.

## Directory Structure

```
atlases/
├── political/          # Political boundaries and territories
├── calendars/         # Calendar system adoption regions
├── traffic/           # Traffic rules (left/right driving)
├── timekeeping/       # Time measurement systems
├── base/              # Base geography (rivers, coastlines)
└── custom/            # User-created custom layers
```

## Atlas Format

Each atlas file follows this structure:

```json
{
  "meta": {
    "id": "unique-atlas-identifier",
    "year": 1453,
    "layer": "political",
    "description": "Ottoman Empire at the fall of Constantinople",
    "author": "bentezhko",
    "created": "2025-12-27T13:00:00Z",
    "version": "1.0"
  },
  "style": {
    "color": "#8a3324",
    "strokeWidth": 2,
    "fillOpacity": 0.4,
    "decorative": "medieval-border"
  },
  "entities": [
    {
      "id": "ottoman-empire-1453",
      "name": "Ottoman Empire",
      "type": "polity",
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [26.0, 41.0],
          [29.0, 41.0],
          [29.0, 37.0],
          [26.0, 37.0],
          [26.0, 41.0]
        ]]
      },
      "properties": {
        "description": "Territory controlled by Ottoman Sultanate",
        "color": "#8a3324"
      }
    }
  ]
}
```

## Creating Atlas Files

### Method 1: Manual Drawing in Browser

1. Open Illuminarchism in browser
2. Select drawing tool (polygon/line)
3. Draw your entities
4. Click "Save Atlas"
5. Choose layer name
6. File downloads automatically
7. Move to appropriate directory
8. Commit to git

### Method 2: Manual JSON Creation

1. Copy the template above
2. Fill in metadata
3. Define geometry using GeoJSON format
4. Save as `atlases/{layer}/{name}_{year}.json`
5. Commit to git

## Geometry Types

### Polygon (for regions, territories)
```json
"geometry": {
  "type": "Polygon",
  "coordinates": [[
    [lng1, lat1],
    [lng2, lat2],
    [lng3, lat3],
    [lng1, lat1]
  ]]
}
```

### LineString (for rivers, routes)
```json
"geometry": {
  "type": "LineString",
  "coordinates": [
    [lng1, lat1],
    [lng2, lat2],
    [lng3, lat3]
  ]
}
```

### Point (for cities)
```json
"geometry": {
  "type": "Point",
  "coordinates": [lng, lat]
}
```

## Loading Atlases

Atlases can be loaded:

1. **Automatically** - Add path to `src/main.js` defaultAtlases array
2. **Upload** - Use "Load Atlas" button in UI
3. **Programmatically** - `app.atlasManager.loadAtlas(path)`

## Layer System

Each atlas belongs to a layer. Layers can be toggled on/off independently.

**Suggested layers:**
- `political` - Borders, empires, kingdoms
- `calendars` - Calendar system adoption
- `traffic` - Driving side rules
- `timekeeping` - Hour systems
- `trade` - Trade routes
- `religion` - Religious influence zones
- `language` - Linguistic regions

## Versioning

Atlas files are version controlled with git. Use descriptive commit messages:

```bash
git add atlases/political/ottoman_empire_1453.json
git commit -m "Add Ottoman Empire territory at fall of Constantinople (1453)"
```

## Best Practices

1. **One year per file** - Each atlas represents a specific year
2. **Descriptive IDs** - Use format `{entity}-{year}`
3. **Accurate metadata** - Fill all meta fields
4. **Source attribution** - Cite historical sources in description
5. **Consistent naming** - Follow pattern `{layer}/{entity}_{year}.json`

## Example Files

See `atlases/examples/` for reference implementations.
