import { getCentroid, getBoundingBox } from '../core/math.js';

export default class MedievalRenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.transform = { x: this.width / 2, y: this.height / 2, k: 1 };

        this.waterLayer = document.createElement('canvas');
        this.waterCtx = this.waterLayer.getContext('2d');

        this.noisePattern = null;
        this.waterPattern = null;
        this.patternCache = {};

        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.createParchmentTexture();
        this.createWaterTexture();
    }

    resize() {
        this.width = Math.max(1, Math.floor(window.innerWidth));
        this.height = Math.max(1, Math.floor(window.innerHeight));

        this.canvas.width = this.width;
        this.canvas.height = this.height;

        this.waterLayer.width = this.width;
        this.waterLayer.height = this.height;

        this.createParchmentTexture();
        this.createWaterTexture();
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
        const size = 256;
        const c = document.createElement('canvas');
        c.width = size; c.height = size;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#f3e9d2';
        ctx.fillRect(0, 0, size, size);
        const id = ctx.getImageData(0, 0, size, size);
        const d = id.data;
        for (let i = 0; i < d.length; i += 4) {
            const n = (Math.random() - 0.5) * 15;
            d[i] = Math.min(255, Math.max(0, d[i] + n));
            d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + n));
            d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + n));
        }
        ctx.putImageData(id, 0, 0);
        this.noisePattern = this.ctx.createPattern(c, 'repeat');
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
    }

    draw(entities, hoveredId, selectedId, activeTool, vertexHighlightIndex) {
        if (this.width === 0 || this.height === 0) return;

        // FIXED: Safety check for entities input
        if (!entities || !Array.isArray(entities)) {
            // console.warn('Renderer received invalid entities, using empty array'); // Uncomment for debugging
            entities = [];
        }

        this.clear();
        const ctx = this.ctx;
        const t = this.transform;

        ctx.save();
        ctx.translate(t.x, t.y);
        ctx.scale(t.k, t.k);

        this.drawGrid();

        // FIXED: Safe spread and sort
        const sorted = [...entities].sort((a, b) => {
            // Sorting only affects visual stacking relative to each other, not the render pipeline phase
            return 0; // Maintain insertion/natural sort roughly
        });

        const waterEntities = sorted.filter(e => e && e.type === 'water' && e.currentGeometry && e.visible);

        // 1. DRAW EVERYTHING THAT IS NOT WATER (The "World" Layer)
        const worldEntities = sorted.filter(e => e && e.type !== 'water' && e.visible);

        // Sort within world layer: Polities < Rivers < Cities < Overlays
        worldEntities.sort((a, b) => {
            const typeScore = (e) => {
                if (e.type === 'polity') return 1;
                if (e.type === 'river') return 2;
                if (e.type === 'city') return 3;
                if (['linguistic', 'cultural', 'faith'].includes(e.category)) return 4;
                return 5;
            }
            return typeScore(a) - typeScore(b);
        });

        worldEntities.forEach(ent => {
            if (!ent.currentGeometry) return;

            const isHovered = ent.id === hoveredId;
            const isSelected = ent.id === selectedId;

            if (ent.type === 'city') {
                this.drawCityMarker(ent, isHovered, isSelected);
            } else if (ent.type === 'river') {
                this.drawRiver(ent, isHovered, isSelected);
            } else {
                this.drawPolygon(ent, isHovered, isSelected);
            }
        });

        // 2. DRAW WATER MASK (Opaque)
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
            ctx.shadowColor = 'rgba(43, 33, 24, 0.5)';
            ctx.shadowBlur = 10;
            try { ctx.drawImage(this.waterLayer, 0, 0); } catch (e) { }
            ctx.restore();
        }

        // 3. DRAW LABELS & UI OVERLAYS (Must be visible on top of water)
        sorted.forEach(ent => {
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
                this.tracePath(ent.currentGeometry, true);
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
            if (ent && ent.currentGeometry && ent.type !== 'city') this.drawTransformBox(ent.currentGeometry);
        }

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

    drawPolygon(ent, isHovered, isSelected) {
        const ctx = this.ctx;
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
            let alpha = (isSelected || isHovered) ? 0.4 : 0.15;
            ctx.fillStyle = this.hexToRgba(ent.color, alpha);
        }

        // Get Pattern
        const pattern = this.getHatchPattern(ent.color, ent.hatchStyle);

        if (ent.category !== 'cultural') {
            ctx.beginPath();
            this.tracePath(pts, true);
            ctx.fill();
        }

        // Apply Pattern on top of wash
        if (pattern && ent.category !== 'cultural') {
            ctx.fillStyle = pattern;
            ctx.beginPath();
            this.tracePath(pts, true);
            ctx.fill();
        }

        ctx.beginPath();
        this.tracePath(pts, true);
        if (isSelected) {
            ctx.shadowColor = '#000'; ctx.shadowBlur = 10;
            ctx.lineWidth *= 1.5;
        }
        ctx.stroke();

        ctx.restore();
    }

    drawRiver(ent, isHovered, isSelected) {
        const ctx = this.ctx;
        const pts = ent.currentGeometry;
        if (!pts.length) return;

        ctx.beginPath();
        this.tracePath(pts, false);
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

    drawCityMarker(ent, isHovered, isSelected) {
        const ctx = this.ctx;
        const pt = ent.currentGeometry[0];
        if (!pt) return;
        const size = 6 / this.transform.k;

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
        if (ent.type === 'city') {
            cx = ent.currentGeometry[0].x + 10 / this.transform.k;
            cy = ent.currentGeometry[0].y + 2 / this.transform.k;
        } else {
            const c = getCentroid(ent.currentGeometry);
            cx = c.x; cy = c.y;
        }

        this.ctx.fillStyle = isSelected ? '#fff' : '#2b2118';
        if (isSelected) this.ctx.shadowBlur = 4;

        if (ent.category === 'linguistic') this.ctx.font = `italic ${14 / this.transform.k}px "Cinzel"`;
        else if (ent.category === 'faith') this.ctx.font = `italic bold ${13 / this.transform.k}px "Cinzel"`;
        else if (ent.type === 'city') this.ctx.font = `bold ${12 / this.transform.k}px "Cinzel"`;
        else this.ctx.font = `${14 / this.transform.k}px "Cinzel"`;

        this.ctx.textAlign = ent.type === 'city' ? 'left' : 'center';
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

    tracePath(pts, close) {
        if (!pts.length) return;
        this.ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) this.ctx.lineTo(pts[i].x, pts[i].y);
        if (close) this.ctx.closePath();
    }

    tracePathOnCtx(ctx, pts, close) {
        if (!pts.length) return;
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        if (close) ctx.closePath();
    }

    drawGrid() {
        const ctx = this.ctx;
        const sz = 100; const cnt = 30;
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(138, 51, 36, 0.05)';
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
}
