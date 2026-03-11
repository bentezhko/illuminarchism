import { getCentroid, getRepresentativePoint, getBoundingBox } from '../core/math.js';
import { fbm, perturbPoint } from './filters.js';
import { isRenderedAsPoint } from '../core/Ontology.js';

const GRID_CONFIG = {
    CELL_SIZE: 100,
    EXTENT: 30,
    COLOR: 'rgba(138, 51, 36, 0.05)'
};

const ANIMATION_CONFIG = {
    HOVER_FLASH_PERIOD: 150,
    HOVER_FLASH_RADIUS_AMP: 2,
    DESTRUCT_FLASH_PERIOD: 100,
    DESTRUCT_FLASH_RADIUS_AMP: 3,
    FLASH_OPACITY_BASE: 0.5,
    FLASH_OPACITY_AMP: 0.5
};

export default class MedievalRenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.transform = { x: this.width / 2, y: this.height / 2, k: 1 };

        this.waterLayer = document.createElement('canvas');
        this.waterCtx = this.waterLayer.getContext('2d');

        this.worldLayer = document.createElement('canvas');
        this.worldCtx = this.worldLayer.getContext('2d');
        this.worldLayerValid = false;

        this.noisePattern = null;
        this.waterPattern = null;
        this.patternCache = {};

        this._cachedWaterEntities = [];
        this._cachedWorldEntities = [];

        // Measurement Units (1 League = Base Unit)
        this.scaleUnit = 'leagues';
        this.unitConversions = {
            'leagues': 1.0,
            'miles': 3.0,
            'km': 4.8,
            'stadia': 24.0,
            'versts': 4.5
        };

        this.themeColors = {
            inkPrimary: '#2b2118',
            parchmentBg: '#f3e9d2'
        };
        this.updateThemeColors();

        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.createParchmentTexture();
        this.createWaterTexture();
    }

    updateThemeColors() {
        if (typeof document !== 'undefined' && typeof getComputedStyle !== 'undefined') {
            const style = getComputedStyle(document.body || document.documentElement);
            this.themeColors.inkPrimary = style.getPropertyValue('--ink-primary').trim() || '#2b2118';
            this.themeColors.parchmentBg = style.getPropertyValue('--parchment-bg').trim() || '#f3e9d2';
        }
    }

    _getPatternTransformMatrix(transform) {
        const { x, y, k } = transform;
        return new DOMMatrix().translate(x, y).scale(1 / k, 1 / k);
    }

    _isPointEntity(ent) {
        if (!ent || !ent.currentGeometry) return false;
        if (ent.currentGeometry.length === 1) return true;
        // Check if it's a zoom-dependent point entity
        return isRenderedAsPoint(ent, this.transform.k);
    }

    _getEntityScore(e) {
        if (e.type === 'polity') return 1;
        if (e.type === 'river') return 2;
        if (this._isPointEntity(e)) return 3;
        return 4;
    }

    resize() {
        this.width = Math.max(1, Math.floor(window.innerWidth));
        this.height = Math.max(1, Math.floor(window.innerHeight));

        this.canvas.width = this.width;
        this.canvas.height = this.height;

        this.waterLayer.width = this.width;
        this.waterLayer.height = this.height;

        this.worldLayer.width = this.width;
        this.worldLayer.height = this.height;
        this.worldLayerValid = false;

        this.worldLayerValid = false; // Invalidate cache on resize
        if (window.illuminarchismApp) window.illuminarchismApp.render();
    }

    getHatchPattern(color, type) {
        if (type === 'solid') return null;

        const key = `${color}-${type}`;
        if (this.patternCache[key]) return this.patternCache[key];

        const size = 16;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.fillStyle = color;

        if (type === 'diagonal-right') {
            ctx.beginPath();
            ctx.moveTo(-4, size + 4); ctx.lineTo(size + 4, -4); ctx.stroke();
            ctx.moveTo(size - 4, size + 4); ctx.lineTo(size + 4 + size - 4, -4); ctx.stroke();
            ctx.moveTo(-4 - size, size + 4); ctx.lineTo(4, -4); ctx.stroke();
        } else if (type === 'diagonal-left') {
            ctx.beginPath();
            ctx.moveTo(size + 4, size + 4); ctx.lineTo(-4, -4); ctx.stroke();
            ctx.moveTo(4, size + 4); ctx.lineTo(-4 - size, -4); ctx.stroke();
            ctx.moveTo(size + 4 + size, size + 4); ctx.lineTo(size - 4, -4); ctx.stroke();
        } else if (type === 'vertical') {
            ctx.beginPath();
            ctx.moveTo(size / 2, 0); ctx.lineTo(size / 2, size); ctx.stroke();
        } else if (type === 'horizontal') {
            ctx.beginPath();
            ctx.moveTo(0, size / 2); ctx.lineTo(size, size / 2); ctx.stroke();
        } else if (type === 'cross') {
            ctx.beginPath();
            ctx.moveTo(-4, size + 4); ctx.lineTo(size + 4, -4); ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(-4, -4); ctx.lineTo(size + 4, size + 4); ctx.stroke();
        } else if (type === 'saltire') {
            ctx.beginPath(); ctx.moveTo(size / 2, 0); ctx.lineTo(size / 2, size); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, size / 2); ctx.lineTo(size, size / 2); ctx.stroke();
        } else if (type === 'stipple') {
            for (let i = 0; i < 6; i++) {
                ctx.beginPath(); ctx.arc(Math.random() * size, Math.random() * size, 0.8, 0, Math.PI * 2); ctx.fill();
            }
        } else if (type === 'waves') {
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, size / 2);
            ctx.quadraticCurveTo(size / 4, size / 4, size / 2, size / 2);
            ctx.quadraticCurveTo(3 * size / 4, 3 * size / 4, size, size / 2);
            ctx.stroke();
        }

        const pattern = this.ctx.createPattern(canvas, 'repeat');
        this.patternCache[key] = pattern;
        return pattern;
    }

    createParchmentTexture() {
        if (!MedievalRenderer.cachedParchmentCanvas) {
            const size = 512;
            const c = document.createElement('canvas');
            c.width = size; c.height = size;
            const ctx = c.getContext('2d');

            const imageData = ctx.createImageData(size, size);
            const data = imageData.data;

            let baseColor = { r: 243, g: 233, b: 210 };
            const val = this.themeColors.parchmentBg;
            if (val.startsWith('#') && val.length === 7) {
                baseColor = {
                    r: parseInt(val.slice(1, 3), 16),
                    g: parseInt(val.slice(3, 5), 16),
                    b: parseInt(val.slice(5, 7), 16)
                };
            }

            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    // Generate FBM noise for "cloudy" paper texture
                    // Scale coordinate to get good frequency
                    const n = fbm(x / 150, y / 150, 4, 0.5, 2);

                    // Map noise -1..1 to brightness variation
                    const brightness = 1 + (n * 0.15); // +/- 15% variation

                    // Add some high-frequency grain
                    const grain = (Math.random() - 0.5) * 0.05;

                    const i = (y * size + x) * 4;
                    const mod = brightness + grain;

                    data[i] = Math.min(255, Math.max(0, baseColor.r * mod));
                    data[i + 1] = Math.min(255, Math.max(0, baseColor.g * mod));
                    data[i + 2] = Math.min(255, Math.max(0, baseColor.b * mod));
                    data[i + 3] = 255;
                }
            }

            ctx.putImageData(imageData, 0, 0);
            MedievalRenderer.cachedParchmentCanvas = c;
        }

        this.noisePattern = this.ctx.createPattern(MedievalRenderer.cachedParchmentCanvas, 'repeat');
    }

    invalidateWorldLayer() {
        this.worldLayerValid = false;
    }

    createWaterTexture() {
        const size = 64;
        const c = document.createElement('canvas');
        c.width = size; c.height = size;
        const ctx = c.getContext('2d');

        // OPAQUE base color to mask land
        ctx.fillStyle = 'rgba(150, 180, 200, 1.0)';
        ctx.fillRect(0, 0, size, size);

        const rows = 4, cols = 4;
        const cellW = size / cols;
        const cellH = size / rows;

        ctx.strokeStyle = '#264e86';
        ctx.lineWidth = 1.2;
        ctx.lineCap = 'round';
        ctx.globalAlpha = 0.6;

        for (let y = 0; y <= rows; y++) {
            for (let x = 0; x <= cols; x++) {
                let offsetX = (y % 2 === 0) ? 0 : cellW / 2;
                let px = (x * cellW) + offsetX;
                let py = y * cellH;
                ctx.beginPath();
                ctx.moveTo(px - 4, py);
                ctx.quadraticCurveTo(px, py - 3, px + 4, py);
                ctx.stroke();
            }
        }

        this.waterPattern = this.ctx.createPattern(c, 'repeat');
    }

    toWorld(sx, sy) { return { x: (sx - this.transform.x) / this.transform.k, y: (sy - this.transform.y) / this.transform.k }; }

    clear() {
        this.ctx.globalCompositeOperation = 'source-over';
        if (this.noisePattern) {
            this.noisePattern.setTransform(this._getPatternTransformMatrix(this.transform));
        }
        this.ctx.fillStyle = this.noisePattern || this.themeColors.parchmentBg;
        this.ctx.fillRect(0, 0, this.width, this.height);
        this.labelRegions = []; // Reset label collision registry
    }

    draw(entities, hoveredId, selectedId, activeTool, vertexHighlightIndex, layers = null) {
        if (this.width === 0 || this.height === 0) return;

        if (!entities || !Array.isArray(entities)) {
            entities = [];
        }

        const t = this.transform;

        // --- CACHE INVALIDATION ---
        // If transform changed, the cached world layer is no longer valid
        if (!this.lastTransform ||
            this.lastTransform.x !== t.x ||
            this.lastTransform.y !== t.y ||
            this.lastTransform.k !== t.k) {
            this.worldLayerValid = false;
            this.lastTransform = { ...t };
        }

        this.clear();
        const ctx = this.ctx;

        ctx.save();
        ctx.translate(t.x, t.y);
        ctx.scale(t.k, t.k);
        this.drawGrid();
        ctx.restore();


        // --- LAYER CACHING LOGIC ---
        // If the cache is invalid (or first run), re-render the static world
        if (!this.worldLayerValid) {
            this.renderWorldLayer(entities, t, layers);
            this.worldLayerValid = true;
        }

        // Draw Cached World Layer
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform to draw screen-aligned canvas
        ctx.drawImage(this.worldLayer, 0, 0);
        ctx.restore();

        // 4. DRAW LABELS & UI OVERLAYS (Dynamic)
        ctx.save();
        ctx.translate(t.x, t.y);
        ctx.scale(t.k, t.k);

        // Optimize Layer Lookup for Draw loop
        const layerMap = layers ? new Map(layers.map(l => [l.id, l])) : new Map();

        entities.forEach(ent => {
            if (!ent || !ent.currentGeometry || !ent.visible) return;

            if (layers) {
                const layer = layerMap.get(ent.layerId);
                if (layer && !layer.visible) return;
            }

            const isHovered = ent.id === hoveredId;
            const isSelected = ent.id === selectedId;

            // Dynamically redraw hovered or selected entities so their highlight is animated
            if (isSelected || isHovered) {
                if (this._isPointEntity(ent)) {
                    this.drawPointMarker(ent, isHovered, isSelected, ctx);
                } else if (ent.type === 'river') {
                    this.drawRiver(ent, isHovered, isSelected, ctx);
                } else if (ent.type !== 'water') {
                    this.drawPolygon(ent, isHovered, isSelected, ctx);
                }
            }

            // Draw Label (for all types, including water)
            if (isSelected || isHovered || t.k > 0.5) {
                this.drawLabel(ent, isSelected);
            }

            // Draw Water Selection Highlight (Outline) on top of water mask
            if (ent.type === 'water' && (isSelected || isHovered)) {
                ctx.save();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.lineWidth = 2 / t.k;
                ctx.setLineDash([10 / t.k, 5 / t.k]);
                ctx.beginPath();
                this.tracePathOnCtx(ctx, ent.currentGeometry, true);
                ctx.stroke();
                ctx.restore();
            }
        });

        // Editor Overlays
        if (activeTool === 'vertex-edit' && selectedId) {
            const ent = entities.find(e => e && e.id === selectedId);
            if (ent && ent.currentGeometry) this.drawVertices(ent.currentGeometry, vertexHighlightIndex);
        }
        if (activeTool === 'transform' && selectedId) {
            const ent = entities.find(e => e && e.id === selectedId);
            if (ent && ent.currentGeometry) {
                if (this._isPointEntity(ent)) {
                    this.drawPointTransform(ent.currentGeometry[0]);
                } else {
                    this.drawTransformBox(ent.currentGeometry);
                }
            }
        }

        ctx.restore();

        // Draw Scale
        this.drawScale();
    }

    drawScale() {
        const ctx = this.ctx;
        const k = this.transform.k;

        // Target screen width for the scale bar (approx 150px)
        const targetWidth = 150;

        // Calculate world units corresponding to target width
        const worldUnits = targetWidth / k;

        // Unit Conversion
        const unit = this.scaleUnit || 'leagues';
        const factor = this.unitConversions[unit] || 1.0;

        // Convert world units (always 1.0 = 1 League internally) to display units
        const displayWorldUnits = worldUnits * factor;

        // Round to a nice number in display units
        const magnitude = Math.pow(10, Math.floor(Math.log10(displayWorldUnits)));
        const residual = displayWorldUnits / magnitude;

        let displayValue;
        if (residual >= 5) displayValue = 5 * magnitude;
        else if (residual >= 2) displayValue = 2 * magnitude;
        else displayValue = 1 * magnitude;

        // Convert back to internal world units for drawing width
        const internalValue = displayValue / factor;
        const pixelWidth = internalValue * k;

        // Position: Top Left (below header, safe from timeline)
        // Header height is approx 80px.
        const x = 30;
        const y = 110;

        ctx.save();
        ctx.strokeStyle = this.themeColors.inkPrimary;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.font = 'bold 14px "Cinzel"';
        ctx.fillStyle = this.themeColors.inkPrimary;
        ctx.textAlign = 'center';

        // Draw Main Line with slight perturbation for ink effect
        ctx.beginPath();
        // Dynamic steps based on width for consistent wobble density (1 step per 15px)
        const steps = Math.max(2, Math.floor(pixelWidth / 15));
        for (let i = 0; i <= steps; i++) {
            const px = x + (pixelWidth * i / steps);
            const py = y;
            // Perturb slightly (scale 0.05 for smooth wobble, mag 1.5)
            const pp = perturbPoint(px, py, 0.05, 1.5);
            if (i === 0) ctx.moveTo(pp.x, pp.y);
            else ctx.lineTo(pp.x, pp.y);
        }
        ctx.stroke();

        // Draw Ticks (Vertical)
        // Left Tick
        ctx.beginPath();
        const t1_start = perturbPoint(x, y - 5, 0.05, 1);
        const t1_end = perturbPoint(x, y + 5, 0.05, 1);
        ctx.moveTo(t1_start.x, t1_start.y);
        ctx.lineTo(t1_end.x, t1_end.y);
        ctx.stroke();

        // Right Tick
        ctx.beginPath();
        const t2_start = perturbPoint(x + pixelWidth, y - 5, 0.05, 1);
        const t2_end = perturbPoint(x + pixelWidth, y + 5, 0.05, 1);
        ctx.moveTo(t2_start.x, t2_start.y);
        ctx.lineTo(t2_end.x, t2_end.y);
        ctx.stroke();

        // Label (capitalize first letter)
        const unitLabel = unit.charAt(0).toUpperCase() + unit.slice(1);
        ctx.fillText(`${displayValue} ${unitLabel}`, x + pixelWidth / 2, y - 10);

        ctx.restore();
    }

    drawPointTransform(pt) {
        const ctx = this.ctx;
        const t = this.transform;
        const r = 10 / t.k;

        ctx.save();
        ctx.strokeStyle = this.themeColors.inkPrimary;
        ctx.lineWidth = 1 / t.k;
        ctx.setLineDash([5 / t.k, 5 / t.k]);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
        ctx.stroke();

        // Small "move" indicator handles
        const hSize = 4 / t.k;
        ctx.fillStyle = this.themeColors.parchmentBg;
        ctx.setLineDash([]);
        ctx.fillRect(pt.x - hSize / 2, pt.y - hSize / 2, hSize, hSize);
        ctx.strokeRect(pt.x - hSize / 2, pt.y - hSize / 2, hSize, hSize);
        ctx.restore();
    }

    drawTransformBox(geometry) {
        const ctx = this.ctx;
        const bbox = getBoundingBox(geometry);
        const t = this.transform;

        // Draw Dashed Box
        ctx.save();
        ctx.strokeStyle = this.themeColors.inkPrimary;
        ctx.lineWidth = 1 / t.k;
        ctx.setLineDash([5 / t.k, 5 / t.k]);
        ctx.strokeRect(bbox.x, bbox.y, bbox.w, bbox.h);

        // Draw Handles (Corners)
        const handleSize = 6 / t.k;
        ctx.fillStyle = this.themeColors.parchmentBg;
        ctx.strokeStyle = this.themeColors.inkPrimary;
        ctx.setLineDash([]);

        const corners = [
            { x: bbox.minX, y: bbox.minY }, // TL
            { x: bbox.maxX, y: bbox.minY }, // TR
            { x: bbox.maxX, y: bbox.maxY }, // BR
            { x: bbox.minX, y: bbox.maxY }  // BL
        ];

        corners.forEach(c => {
            ctx.fillRect(c.x - handleSize / 2, c.y - handleSize / 2, handleSize, handleSize);
            ctx.strokeRect(c.x - handleSize / 2, c.y - handleSize / 2, handleSize, handleSize);
        });

        ctx.restore();
    }

    drawVertices(geometry, activeIndex) {
        const ctx = this.ctx;
        const r = 5 / this.transform.k; // Handle radius
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#8a3324';
        ctx.lineWidth = 2 / this.transform.k;

        geometry.forEach((pt, i) => {
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            if (i === activeIndex) {
                ctx.save();
                ctx.fillStyle = '#8a3324';
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, r * 0.6, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        });
    }

    drawPolygon(ent, isHovered, isSelected, targetCtx = null) {
        const ctx = targetCtx || this.ctx;
        const pts = ent.currentGeometry;
        if (!pts.length) return;

        ctx.save();

        if (ent.category === 'linguistic') {
            ctx.setLineDash([15 / this.transform.k, 10 / this.transform.k]);
            ctx.strokeStyle = ent.color;
            ctx.lineWidth = 2 / this.transform.k;
            ctx.fillStyle = this.hexToRgba(ent.color, 0.1);
        } else if (ent.category === 'cultural') {
            ctx.setLineDash([2 / this.transform.k, 6 / this.transform.k]);
            ctx.strokeStyle = ent.color;
            ctx.lineWidth = 3 / this.transform.k;
            ctx.fillStyle = 'transparent';
        } else if (ent.category === 'faith') {
            ctx.setLineDash([2 / this.transform.k, 2 / this.transform.k, 6 / this.transform.k, 2 / this.transform.k]); // Dash-dot-dot
            ctx.strokeStyle = ent.color;
            ctx.lineWidth = 2 / this.transform.k;
            ctx.fillStyle = this.hexToRgba(ent.color, 0.05); // Very faint wash
        } else {
            ctx.setLineDash([]);
            ctx.strokeStyle = '#2b2118';
            ctx.lineWidth = 1.5 / this.transform.k;
            // STRONG OPACITY: 0.6 base, 0.8 hover/select
            let alpha = (isSelected || isHovered) ? 0.8 : 0.6;
            ctx.fillStyle = this.hexToRgba(ent.color, alpha);
        }

        // Get Pattern

        const pattern = this.getHatchPattern(ent.color, ent.hatchStyle);

        if (ent.category !== 'cultural') {
            ctx.beginPath();
            this.traceRoughPath(pts, true, ctx);

            // Land Shadow / Glow
            if (ent.type === 'polity') {
                ctx.shadowColor = 'rgba(0,0,0,0.3)';
                ctx.shadowBlur = 10;
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;
            }

            ctx.fill();

            // Reset shadow
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
        }

        // Apply Pattern on top of wash
        if (pattern && ent.category !== 'cultural') {
            pattern.setTransform(this._getPatternTransformMatrix(this.transform));
            ctx.fillStyle = pattern;
            ctx.beginPath();
            this.traceRoughPath(pts, true, ctx);
            ctx.fill();
        }

        ctx.beginPath();
        this.traceRoughPath(pts, true, ctx);

        if (isSelected) {
            // Animated highlight drawn UNDER the main border
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 215, 0, 0.8)'; // Bright gold
            ctx.lineWidth = (ctx.lineWidth || (1.5 / this.transform.k)) * 4; // Thicker than main border
            ctx.lineCap = 'round';
            ctx.setLineDash([15 / this.transform.k, 15 / this.transform.k]);
            ctx.lineDashOffset = -(performance.now() / 40) % (30 / this.transform.k);
            ctx.stroke();
            ctx.restore();
        }

        if (isSelected) {
            ctx.shadowColor = '#000'; ctx.shadowBlur = 10;
            ctx.lineWidth *= 1.5;
        }
        ctx.stroke();

        ctx.restore();
    }

    drawRiver(ent, isHovered, isSelected, targetCtx = null) {
        const ctx = targetCtx || this.ctx;
        const pts = ent.currentGeometry;
        if (!pts.length) return;

        ctx.beginPath();
        this.traceRoughPath(pts, false, ctx);

        if (isSelected) {
            // Animated highlight underneath
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 215, 0, 0.8)';
            ctx.lineWidth = (4 / this.transform.k) * 2;
            ctx.lineCap = 'round';
            ctx.setLineDash([15 / this.transform.k, 15 / this.transform.k]);
            ctx.lineDashOffset = -(performance.now() / 40) % (30 / this.transform.k);
            ctx.stroke();
            ctx.restore();
        }

        ctx.strokeStyle = isSelected ? '#8a3324' : ent.color;
        ctx.lineWidth = (isSelected ? 4 : 2.5) / this.transform.k;
        ctx.lineCap = 'round';
        ctx.stroke();

        if (!isSelected) {
            ctx.strokeStyle = 'rgba(255,255,255,0.4)';
            ctx.lineWidth = 1 / this.transform.k;
            ctx.stroke();
        }
    }

    drawPointMarker(ent, isHovered, isSelected, targetCtx = null) {
        const ctx = targetCtx || this.ctx;
        if (!ent.currentGeometry || ent.currentGeometry.length === 0) return;

        const pt = getRepresentativePoint(ent.currentGeometry);
        if (!pt) return;

        const size = 6 / this.transform.k;

        // Decorative diamond marker (same as legacy city marker for now)
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y - size);
        ctx.lineTo(pt.x + size, pt.y);
        ctx.lineTo(pt.x, pt.y + size);
        ctx.lineTo(pt.x - size, pt.y);
        ctx.closePath();

        ctx.fillStyle = isSelected ? '#8a3324' : ent.color;
        ctx.fill();

        if (isSelected || isHovered) {
            if (isSelected) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, size * 1.5, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(255, 215, 0, 0.8)';
                ctx.lineWidth = 3 / this.transform.k;
                ctx.setLineDash([8 / this.transform.k, 8 / this.transform.k]);
                ctx.lineDashOffset = -(performance.now() / 40) % (16 / this.transform.k);
                ctx.stroke();
                ctx.restore();
            }

            ctx.beginPath();
            ctx.arc(pt.x, pt.y, size * 1.5, 0, Math.PI * 2);
            ctx.strokeStyle = '#8a3324';
            ctx.lineWidth = 1 / this.transform.k;
            ctx.stroke();
        }
    }

    drawLabel(ent, isSelected) {
        let cx, cy;
        const pt = getRepresentativePoint(ent.currentGeometry);

        if (this._isPointEntity(ent)) {
            cx = pt.x + 10 / this.transform.k;
            cy = pt.y + 2 / this.transform.k;
        } else {
            cx = pt.x;
            cy = pt.y;
        }

        let fontSize;
        let font;
        let baseSize = 14;
        let style = '';

        if (ent.category === 'faith') {
            baseSize = 13;
            style = 'italic bold';
        } else if (this._isPointEntity(ent)) {
            baseSize = 12;
            style = 'bold';
        } else if (ent.category === 'linguistic') {
            style = 'italic';
        }

        fontSize = baseSize / this.transform.k;
        font = `${style} ${fontSize}px "Cinzel"`.trim();

        this.ctx.font = font;
        this.ctx.textAlign = this._isPointEntity(ent) ? 'left' : 'center';

        // Collision Detection
        if (!isSelected && !this._isPointEntity(ent)) { // Always draw selected or points (points have icons)
            const metrics = this.ctx.measureText(ent.name);
            const w = metrics.width;
            const h = fontSize; // approx height
            const x = cx - w / 2; // centered
            const y = cy - h / 2;

            // Padding
            const pad = 5;
            const bbox = { x: x - pad, y: y - pad, w: w + pad * 2, h: h + pad * 2 };

            // Check collision
            for (const r of this.labelRegions) {
                if (bbox.x < r.x + r.w && bbox.x + bbox.w > r.x &&
                    bbox.y < r.y + r.h && bbox.y + bbox.h > r.y) {
                    return; // Skip drawing
                }
            }
            this.labelRegions.push(bbox);
        }

        this.ctx.fillStyle = isSelected ? '#fff' : this.themeColors.inkPrimary;
        if (isSelected) this.ctx.shadowBlur = 4;

        this.ctx.fillText(ent.name, cx, cy);
        this.ctx.shadowBlur = 0;
    }

    drawDraft(points, cursor, transform, type, options = {}) {
        if (!points || points.length === 0) return;
        const ctx = this.ctx;
        const { isHoveringFirstDraftPoint, isDestructingLastPoint } = options;

        ctx.save();
        ctx.translate(transform.x, transform.y);
        ctx.scale(transform.k, transform.k);

        points.forEach((p, index) => {
            ctx.beginPath();
            let radius = 3 / transform.k;
            let fillStyle = '#8a3324';

            if (isHoveringFirstDraftPoint && index === 0) {
                const flash = (Math.sin(performance.now() / ANIMATION_CONFIG.HOVER_FLASH_PERIOD) + 1) / 2;
                radius = (3 + flash * ANIMATION_CONFIG.HOVER_FLASH_RADIUS_AMP) / transform.k;
                fillStyle = `rgba(138, 51, 36, ${ANIMATION_CONFIG.FLASH_OPACITY_BASE + flash * ANIMATION_CONFIG.FLASH_OPACITY_AMP})`;
            } else if (isDestructingLastPoint && index === points.length - 1) {
                const flash = (Math.sin(performance.now() / ANIMATION_CONFIG.DESTRUCT_FLASH_PERIOD) + 1) / 2;
                radius = (3 + flash * ANIMATION_CONFIG.DESTRUCT_FLASH_RADIUS_AMP) / transform.k;
                fillStyle = `rgba(255, 0, 0, ${ANIMATION_CONFIG.FLASH_OPACITY_BASE + flash * ANIMATION_CONFIG.FLASH_OPACITY_AMP})`;
            }

            ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
            ctx.fillStyle = fillStyle;
            ctx.fill();
        });

        if (type === 'city') {
            const p = points[0];
            ctx.beginPath();
            ctx.moveTo(p.x, p.y - 5); ctx.lineTo(p.x + 5, p.y);
            ctx.lineTo(p.x, p.y + 5); ctx.lineTo(p.x - 5, p.y);
            ctx.fillStyle = '#8a3324'; ctx.fill();
        } else {
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
            if (cursor) {
                ctx.lineTo(cursor.x, cursor.y);
                if (isHoveringFirstDraftPoint) {
                    ctx.lineTo(points[0].x, points[0].y);
                }
            }
            ctx.strokeStyle = '#8a3324';
            ctx.lineWidth = 2 / transform.k;
            ctx.setLineDash([5 / transform.k, 5 / transform.k]);
            ctx.stroke();
        }
        ctx.restore();
    }



    tracePathOnCtx(ctx, pts, close) {
        if (!pts.length) return;
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        if (close) ctx.closePath();
    }

    drawGrid() {
        const ctx = this.ctx;
        const sz = GRID_CONFIG.CELL_SIZE;
        const cnt = GRID_CONFIG.EXTENT;
        ctx.beginPath();
        ctx.strokeStyle = GRID_CONFIG.COLOR;
        ctx.lineWidth = 1 / this.transform.k;
        for (let i = -cnt; i <= cnt; i++) {
            ctx.moveTo(i * sz, -cnt * sz); ctx.lineTo(i * sz, cnt * sz);
            ctx.moveTo(-cnt * sz, i * sz); ctx.lineTo(cnt * sz, i * sz);
        }
        ctx.stroke();
    }

    hexToRgba(hex, a) {
        const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r},${g},${b},${a})`;
    }

    drawCoastlineRipples(landEntities, targetCtx = null) {
        if (!landEntities || landEntities.length === 0) return;
        const ctx = targetCtx || this.ctx;
        ctx.save();

        // Settings for ripples
        const rippleCount = 3;
        const baseDist = 4 / this.transform.k;
        const spacing = 3 / this.transform.k;

        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        landEntities.forEach(ent => {
            // Only draw ripples for Polities (Land), not rivers/points
            if (ent.type !== 'polity' && !['nation-state', 'island', 'continent', 'landmass', 'band', 'tribe'].includes(ent.typology)) return;
            // Using currentGeometry
            if (!ent.currentGeometry || ent.currentGeometry.length < 2) return;

            const isClosed = true; // Landmasses are polygons

            for (let i = 0; i < rippleCount; i++) {
                ctx.beginPath();
                const offset = baseDist + (i * spacing);

                this.tracePathOnCtx(ctx, ent.currentGeometry, isClosed);

                ctx.lineWidth = offset * 2;
                // Opacity fades out
                ctx.strokeStyle = `rgba(40, 60, 80, ${0.15 - (i * 0.04)})`;
                ctx.stroke();
            }
        });

        ctx.restore();
    }

    traceRoughPath(pts, close, targetCtx = null) {
        if (!pts.length) return;

        const ctx = targetCtx || this.ctx;

        // Don't roughen if zoomed out too far (optimization + visual noise reduction)
        const useRough = this.transform.k > 0.2;

        const moveTo = (p) => {
            if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
            if (useRough) {
                const pp = perturbPoint(p.x, p.y, 0.5, 2 / this.transform.k);
                if (Number.isFinite(pp.x) && Number.isFinite(pp.y)) {
                    ctx.moveTo(pp.x, pp.y);
                } else {
                    // Fallback to original point if perturbed point is not finite
                    ctx.moveTo(p.x, p.y);
                }
            } else {
                ctx.moveTo(p.x, p.y);
            }
        };

        const lineTo = (p) => {
            if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
            if (useRough) {
                const pp = perturbPoint(p.x, p.y, 0.5, 2 / this.transform.k);
                if (Number.isFinite(pp.x) && Number.isFinite(pp.y)) {
                    ctx.lineTo(pp.x, pp.y);
                } else {
                    // Fallback to original point if perturbed point is not finite
                    ctx.lineTo(p.x, p.y);
                }
            } else {
                ctx.lineTo(p.x, p.y);
            }
        };

        moveTo(pts[0]);
        for (let i = 1; i < pts.length; i++) lineTo(pts[i]);

        if (close) {
            ctx.closePath();
        }
    }


    renderWaterBatch(waterEnts, t, targetCtx) {
        if (!waterEnts || waterEnts.length === 0 || this.waterLayer.width === 0) return;

        // Draw to Offscreen Water Buffer
        this.waterCtx.clearRect(0, 0, this.width, this.height);
        this.waterCtx.save();
        this.waterCtx.translate(t.x, t.y);
        this.waterCtx.scale(t.k, t.k);
        this.waterCtx.fillStyle = '#000000';
        this.waterCtx.beginPath();
        waterEnts.forEach(ent => this.tracePathOnCtx(this.waterCtx, ent.currentGeometry, true));
        this.waterCtx.fill();
        this.waterCtx.restore();

        // Apply Pattern
        this.waterCtx.save();
        this.waterCtx.globalCompositeOperation = 'source-in';
        if (this.waterPattern) {
            this.waterPattern.setTransform(this._getPatternTransformMatrix(t));
        }
        this.waterCtx.fillStyle = this.waterPattern;
        this.waterCtx.fillRect(0, 0, this.width, this.height);
        this.waterCtx.restore();

        // Composite back to World Layer
        targetCtx.save();
        targetCtx.setTransform(1, 0, 0, 1, 0, 0); // Reset for direct canvas copy
        targetCtx.globalAlpha = 1.0;
        targetCtx.drawImage(this.waterLayer, 0, 0);
        targetCtx.restore();
    }

    renderWorldLayer(entities, t, layers = null) {
        const ctx = this.worldCtx;
        ctx.clearRect(0, 0, this.width, this.height);

        // Draw Background
        ctx.save();
        if (this.noisePattern) {
            this.noisePattern.setTransform(this._getPatternTransformMatrix(t));
        }
        ctx.fillStyle = this.noisePattern || '#f3e9d2';
        ctx.fillRect(0, 0, this.width, this.height);
        ctx.restore();

        // 0. Optimize Layer Lookup
        const layerMap = layers ? new Map(layers.map(l => [l.id, l])) : new Map();

        // 1. Group entities by Layer ID to respect Group Order
        const layerGroups = {};
        layerGroups['_default'] = [];

        entities.forEach(e => {
            if (!e.visible) return;
            const lid = e.layerId || '_default';
            if (!layerGroups[lid]) layerGroups[lid] = [];
            layerGroups[lid].push(e);
        });

        // 2. Determine Layer Execution Order
        let sortedLayerIds = Object.keys(layerGroups);
        if (layers) {
            sortedLayerIds.sort((a, b) => {
                const lA = layerMap.get(a);
                const lB = layerMap.get(b);
                const oA = lA ? lA.order : (a === '_default' ? -999 : 999);
                const oB = lB ? lB.order : (b === '_default' ? -999 : 999);
                return oA - oB;
            });
        }

        // 3. Render Loop (Painter's Algorithm by Layer)
        ctx.save();
        ctx.translate(t.x, t.y);
        ctx.scale(t.k, t.k);

        sortedLayerIds.forEach(lid => {
            const groupEntities = layerGroups[lid];
            if (!groupEntities || groupEntities.length === 0) return;

            // Check visibility from Layer Manager
            if (layers) {
                 const l = layerMap.get(lid);
                 if (l && !l.visible) return;
            }

            // Split into Water (for batching) and Others
            // We use batching to maintain the seamless water texture look
            const waterEnts = groupEntities.filter(e => e.type === 'water' || e.typology === 'aquatic');
            const otherEnts = groupEntities.filter(e => !(e.type === 'water' || e.typology === 'aquatic'));

            // Render Water Batch for this layer
            if (waterEnts.length > 0) {
                 this.renderWaterBatch(waterEnts, t, ctx);
            }

            // Render Others (Land, Details, Rivers)
            otherEnts.forEach(ent => {
                 if (!ent.currentGeometry) return;
                 if (this._isPointEntity(ent)) this.drawPointMarker(ent, false, false, ctx);
                 else if (ent.type === 'river') this.drawRiver(ent, false, false, ctx);
                 else this.drawPolygon(ent, false, false, ctx);
            });

            // Draw Coastline Ripples for this layer's land entities
            if (otherEnts.length > 0) {
                this.drawCoastlineRipples(otherEnts, ctx);
            }
        });

        ctx.restore();
    }
}
