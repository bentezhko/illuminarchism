import { getCentroid, getBoundingBox } from '../core/math.js';
import { fbm, perturbPoint } from './filters.js';

const GRID_CONFIG = {
    CELL_SIZE: 100,
    EXTENT: 30,
    COLOR: 'rgba(138, 51, 36, 0.05)'
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

        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.createParchmentTexture();
        this.createWaterTexture();

        // Measurement Units (1 League = Base Unit)
        this.scaleUnit = 'leagues';
        this.unitConversions = {
            'leagues': 1.0,
            'miles': 3.0,
            'km': 4.8,
            'stadia': 24.0,
            'versts': 4.5
        };
    }

    _isPointEntity(ent) {
        return !!(ent && ent.currentGeometry && ent.currentGeometry.length === 1);
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

        this.createParchmentTexture();
        this.createWaterTexture();
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
        const size = 512;
        const c = document.createElement('canvas');
        c.width = size; c.height = size;
        const ctx = c.getContext('2d');

        const imageData = ctx.createImageData(size, size);
        const data = imageData.data;

        const baseColor = { r: 243, g: 233, b: 210 }; // #f3e9d2

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
        this.noisePattern = this.ctx.createPattern(c, 'repeat');
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
        this.ctx.fillStyle = this.noisePattern || '#f3e9d2';
        this.ctx.fillRect(0, 0, this.width, this.height);
        this.labelRegions = []; // Reset label collision registry
    }

    draw(entities, hoveredId, selectedId, activeTool, vertexHighlightIndex) {
        if (this.width === 0 || this.height === 0) return;

        // FIXED: Safety check for entities input
        if (!entities || !Array.isArray(entities)) {
            // console.warn('Renderer received invalid entities, using empty array'); // Uncomment for debugging
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

        // FIXED: Grid should be drawn relative to world transform
        ctx.save();
        ctx.translate(t.x, t.y);
        ctx.scale(t.k, t.k);
        this.drawGrid();
        ctx.restore();


        // --- LAYER CACHING LOGIC ---
        // If the cache is invalid (or first run), re-render the static world
        if (!this.worldLayerValid) {
            this.renderWorldLayer(entities, t);
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

        entities.forEach(ent => {
            if (!ent || !ent.currentGeometry || !ent.visible) return;
            const isHovered = ent.id === hoveredId;
            const isSelected = ent.id === selectedId;

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
        ctx.strokeStyle = '#2b2118';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.font = 'bold 14px "Cinzel"';
        ctx.fillStyle = '#2b2118';
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
        ctx.strokeStyle = '#2b2118';
        ctx.lineWidth = 1 / t.k;
        ctx.setLineDash([5 / t.k, 5 / t.k]);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
        ctx.stroke();

        // Small "move" indicator handles
        const hSize = 4 / t.k;
        ctx.fillStyle = '#fff';
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
        ctx.strokeStyle = '#2b2118';
        ctx.lineWidth = 1 / t.k;
        ctx.setLineDash([5 / t.k, 5 / t.k]);
        ctx.strokeRect(bbox.x, bbox.y, bbox.w, bbox.h);

        // Draw Handles (Corners)
        const handleSize = 6 / t.k;
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#2b2118';
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
            // Use rough path for "natural" look on Polities and Rivers, smooth for others?
            // Actually, cultural borders often straight. But "ink" implied roughness.
            // Let's roughness everything except maybe very specific things.
            // For performance, maybe only roughness if k > X?
            // But consistent look is better.
            // But consistent look is better.
            // FIX: Rough path causing invisibility. Reverting to simple path.
            this.tracePathOnCtx(ctx, pts, true);

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
            ctx.fillStyle = pattern;
            ctx.beginPath();
            this.tracePathOnCtx(ctx, pts, true);
            ctx.fill();
        }

        ctx.beginPath();
        this.tracePathOnCtx(ctx, pts, true);
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
        const pt = ent.currentGeometry[0];
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
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, size * 1.5, 0, Math.PI * 2);
            ctx.strokeStyle = '#8a3324';
            ctx.lineWidth = 1 / this.transform.k;
            ctx.stroke();
        }
    }

    drawLabel(ent, isSelected) {
        let cx, cy;
        if (this._isPointEntity(ent)) {
            cx = ent.currentGeometry[0].x + 10 / this.transform.k;
            cy = ent.currentGeometry[0].y + 2 / this.transform.k;
        } else {
            const c = getCentroid(ent.currentGeometry);
            cx = c.x; cy = c.y;
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

        this.ctx.fillStyle = isSelected ? '#fff' : '#2b2118';
        if (isSelected) this.ctx.shadowBlur = 4;

        this.ctx.fillText(ent.name, cx, cy);
        this.ctx.shadowBlur = 0;
    }

    drawDraft(points, cursor, transform, type) {
        if (!points || points.length === 0) return;
        const ctx = this.ctx;
        ctx.save();
        ctx.translate(transform.x, transform.y);
        ctx.scale(transform.k, transform.k);

        points.forEach(p => {
            ctx.beginPath(); ctx.arc(p.x, p.y, 3 / transform.k, 0, Math.PI * 2);
            ctx.fillStyle = '#8a3324'; ctx.fill();
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
            if (cursor) ctx.lineTo(cursor.x, cursor.y);
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
            if (useRough) {
                const pp = perturbPoint(p.x, p.y, 0.5, 2 / this.transform.k);
                ctx.moveTo(pp.x, pp.y);
            } else {
                ctx.moveTo(p.x, p.y);
            }
        };

        const lineTo = (p) => {
            if (useRough) {
                const pp = perturbPoint(p.x, p.y, 0.5, 2 / this.transform.k);
                ctx.lineTo(pp.x, pp.y);
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


    renderWorldLayer(sortedEntities, t) {
        // This renders the "Static" world: Land, Rivers, Water, Ripples.
        // Selection highlights are NOT part of this, they are dynamic.
        // So we render the "Base State" of entities.

        const ctx = this.worldCtx;
        ctx.clearRect(0, 0, this.width, this.height);

        // Draw Background
        ctx.save();
        ctx.fillStyle = this.noisePattern || '#f3e9d2';
        ctx.fillRect(0, 0, this.width, this.height);
        ctx.restore();

        ctx.save();
        ctx.translate(t.x, t.y);
        ctx.scale(t.k, t.k);

        const waterEntities = this._cachedWaterEntities;
        waterEntities.length = 0;
        const worldEntities = this._cachedWorldEntities;
        worldEntities.length = 0;

        for (let i = 0; i < sortedEntities.length; i++) {
            const e = sortedEntities[i];
            if (!e || !e.visible) continue;
            if (e.type === 'water') {
                if (e.currentGeometry) {
                    waterEntities.push(e);
                }
            } else {
                worldEntities.push(e);
            }
        }

        // Sort
        worldEntities.sort((a, b) => this._getEntityScore(a) - this._getEntityScore(b));

        // 1. Draw Land & Rivers
        worldEntities.forEach(ent => {
            if (!ent.currentGeometry) return;
            if (this._isPointEntity(ent)) {
                this.drawPointMarker(ent, false, false, ctx);
            } else if (ent.type === 'river') {
                this.drawRiver(ent, false, false, ctx);
            } else {
                this.drawPolygon(ent, false, false, ctx);
            }
        });

        // 2. Draw Water (Uses its own offscreen buffering, but now we composite it onto worldLayer)
        if (waterEntities.length > 0 && this.waterLayer.width > 0) {
            this.waterCtx.clearRect(0, 0, this.width, this.height);
            this.waterCtx.save();
            this.waterCtx.translate(t.x, t.y);
            this.waterCtx.scale(t.k, t.k);
            this.waterCtx.fillStyle = '#000000';
            this.waterCtx.beginPath();
            waterEntities.forEach(ent => this.tracePathOnCtx(this.waterCtx, ent.currentGeometry, true));
            this.waterCtx.fill();
            this.waterCtx.restore();

            this.waterCtx.save();
            this.waterCtx.globalCompositeOperation = 'source-in';
            this.waterCtx.fillStyle = this.waterPattern;
            this.waterCtx.fillRect(0, 0, this.width, this.height);
            this.waterCtx.restore();

            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            // SHADOW REMOVED: Was causing floating artifact due to transparency
            // TRANSPARENCY: Allow land to be seen through water if they overlap
            ctx.globalAlpha = 0.5;
            ctx.drawImage(this.waterLayer, 0, 0);
            ctx.restore();
        }

        // 3. Draw Ripples (On top of water, onto worldLayer)
        // worldCtx already has transform applied from lines 702-703
        this.drawCoastlineRipples(worldEntities, ctx);

        ctx.restore();
    }
}
