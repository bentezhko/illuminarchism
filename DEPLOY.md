# Deployment Instructions

## ⚠️ CRITICAL: Configure Cloudflare Pages Build

Your site will remain black until you configure the build settings.

### Step 1: Go to Cloudflare Pages Dashboard

1. Visit https://dash.cloudflare.com/
2. Navigate to **Workers & Pages** → **illuminarchism**
3. Click **Settings** → **Builds & deployments**

### Step 2: Configure Build Settings

Set these EXACT values:

```
Framework preset: Vite

Build command:
npm run build

Build output directory:
dist

Root directory:
(leave empty)

Node version:
20
```

### Step 3: Trigger Redeploy

1. Go to **Deployments** tab
2. Click **Manage deployments**
3. Click **Retry deployment** on the latest one
4. OR just push any commit to trigger new build

### Step 4: Verify Build Logs

After deployment starts, check the build log:
- Should see `npm install`
- Should see `vite build`
- Should see `dist/` directory created
- Should show **success** at the end

## Expected Result

After successful build (3-5 minutes):

✅ **https://illuminarchism.pages.dev** will show:
- Parchment background (beige/cream color)
- Medieval UI overlay (header, toolbar, panels)
- Canvas with demo kingdoms:
  - Blue Kingdom (Regnum Caeruleum) - center
  - Red Duchy (Ducatus Rubrum) - right side
  - River (Fluvius Magnus) - diagonal
  - Capital city point

✅ **Interactive features:**
- Mouse wheel to zoom
- Click-drag to pan
- Timeline slider (800-1400 AD)
- Kingdoms morph as you change years

## Troubleshooting

### Still Black Screen?

1. **Check build logs** - look for errors
2. **Browser console** (F12) - check for JavaScript errors
3. **Verify build command ran** - logs should show Vite bundling

### Build Fails?

```bash
# Test locally first:
npm install
npm run build

# Should create dist/ folder with:
# - index.html
# - assets/main-[hash].js
# - assets/style-[hash].css
```

### Module Errors?

If you see "Failed to resolve module":
- All modules are now bundled by Vite
- ES6 imports work in dev mode (`npm run dev`)
- Production builds to single file

## Development vs Production

**Local Development:**
```bash
npm run dev
# Opens http://localhost:3000
# Hot reload on file changes
```

**Production Build:**
```bash
npm run build
# Creates optimized bundle in dist/
# Upload dist/ to any static host
```

## Next Steps After Working

Once you see the demo kingdoms:

1. **Add your hand-drawn map** → `public/maps/basemap.png`
2. **Create custom .atlas files** → `atlases/political/`
3. **Implement ChronosCarto features** → See BUILD.md
4. **Connect to PostGIS backend** → For massive datasets

## Architecture Overview

```
Your Code (ES6 Modules)
    ↓
Vite Bundler (on Cloudflare Pages)
    ↓
Optimized JavaScript Bundle
    ↓
Browser Loads Single File
    ↓
WebGL Renders Your Medieval Map!
```
