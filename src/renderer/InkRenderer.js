/**
 * InkRenderer Module
 * Handles Canvas 2D rendering with medieval manuscript aesthetics
 * Features: hand-drawn wobble, watercolor fills, parchment texture
 */

import { CONFIG } from '../core/Entity.js';

export default class InkRenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        
        // Viewport transformation
        this.transform = {
            x: this.width / 2,
            y: this.height / 2,
            k: 1 // zoom scale
        };
        
        this.noisePattern = null;
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.createParchmentTexture();
    }

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.createParchmentTexture();
        
        // Trigger re-render if app exists
        if (window.illuminarchismApp) {
            window.illuminarchismApp.render();
        }
    }

    /**
     * Generate parchment texture with grain
     */
    createParchmentTexture() {
        const size = 256;
        const c = document.createElement('canvas');
        c.width = size;
        c.height = size;
        const ctx = c.getContext('2d');
        
        ctx.fillStyle = CONFIG.BACKGROUND_COLOR;
        ctx.fillRect(0, 0, size, size);
        
        const imageData = ctx.getImageData(0, 0, size, size);
        const data = imageData.data;
        
        // Add grain noise
        for (let i = 0; i < data.length; i += 4) {
            const noise = (Math.random() - 0.5) * 20;
            data[i] = Math.min(255, Math.max(0, data[i] + noise));
            data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
            data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
        }
        
        ctx.putImageData(imageData, 0, 0);
        this.noisePattern = this.ctx.createPattern(c, 'repeat');
    }

    /**
     * Convert screen coordinates to world coordinates
     */
    toWorld(screenX, screenY) {
        return {
            x: (screenX - this.transform.x) / this.transform.k,
            y: (screenY - this.transform.y) / this.transform.k
        };
    }

    /**
     * Convert world coordinates to screen coordinates
     */
    toScreen(worldX, worldY) {
        return {
            x: worldX * this.transform.k + this.transform.x,
            y: worldY * this.transform.k + this.transform.y
        };
    }

    /**
     * Clear canvas with parchment texture
     */
    clear() {
        this.ctx.globalAlpha = 1;
        this.ctx.fillStyle = this.noisePattern || CONFIG.BACKGROUND_COLOR;
        this.ctx.fillRect(0, 0, this.width, this.height);
    }

    /**
     * Begin rendering frame with transformation
     */
    beginFrame() {
        this.clear();
        this.ctx.save();
        this.ctx.translate(this.transform.x, this.transform.y);
        this.ctx.scale(this.transform.k, this.transform.k);
    }

    /**
     * End rendering frame
     */
    endFrame() {
        this.ctx.restore();
    }

    /**
     * Draw polygon with watercolor fill effect
     */
    drawWatercolorFill(points, color, alpha = 0.3) {
        if (points.length < 3) return;
        
        const ctx = this.ctx;
        ctx.globalCompositeOperation = 'multiply';
        
        // Multiple passes for depth
        for (let pass = 0; pass < CONFIG.WATERCOLOR_PASSES; pass++) {
            ctx.fillStyle = this.hexToRgba(color, alpha / CONFIG.WATERCOLOR_PASSES);
            ctx.beginPath();
            
            // Add slight jitter for organic feel
            const jitter = CONFIG.WATERCOLOR_JITTER / this.transform.k;
            ctx.moveTo(
                points[0].x + (Math.random() - 0.5) * jitter,
                points[0].y + (Math.random() - 0.5) * jitter
            );
            
            for (let i = 1; i < points.length; i++) {
                ctx.lineTo(
                    points[i].x + (Math.random() - 0.5) * jitter,
                    points[i].y + (Math.random() - 0.5) * jitter
                );
            }
            
            ctx.closePath();
            ctx.fill();
        }
        
        ctx.globalCompositeOperation = 'source-over';
    }

    /**
     * Draw polygon outline with hand-drawn wobble effect
     */
    drawInkedStroke(points, color = '#2b2118', lineWidth = 1.5, isClosed = true, wobble = 2) {
        if (points.length < 2) return;
        
        const ctx = this.ctx;
        const adjustedWobble = wobble / this.transform.k;
        const adjustedWidth = lineWidth / this.transform.k;
        
        ctx.strokeStyle = color;
        ctx.lineWidth = adjustedWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        ctx.beginPath();
        
        // Apply wobble to each vertex
        points.forEach((p, i) => {
            const wx = p.x + (Math.random() - 0.5) * adjustedWobble;
            const wy = p.y + (Math.random() - 0.5) * adjustedWobble;
            
            if (i === 0) {
                ctx.moveTo(wx, wy);
            } else {
                ctx.lineTo(wx, wy);
            }
        });
        
        if (isClosed && points.length > 2) {
            const first = points[0];
            ctx.lineTo(
                first.x + (Math.random() - 0.5) * adjustedWobble,
                first.y + (Math.random() - 0.5) * adjustedWobble
            );
        }
        
        ctx.stroke();
    }

    /**
     * Draw complete entity with fill and stroke
     */
    drawEntity(entity, year, isSelected = false) {
        const geometry = entity.getGeometryAtYear(year);
        if (!geometry || geometry.length === 0) return;
        
        const isFilled = entity.type === 'polity';
        const isClosed = entity.type === 'polity';
        
        // Draw fill
        if (isFilled) {
            const alpha = isSelected ? 0.6 : 0.3;
            this.drawWatercolorFill(geometry, entity.color, alpha);
        }
        
        // Draw stroke
        const strokeColor = isSelected ? '#8a3324' : '#2b2118';
        const strokeWidth = isSelected ? 3 : 1.5;
        this.drawInkedStroke(geometry, strokeColor, strokeWidth, isClosed);
        
        // Draw city marker if city type
        if (entity.type === 'city' && geometry.length > 0) {
            this.drawCityMarker(geometry[0], entity.color, isSelected);
        }
    }

    /**
     * Draw city marker icon
     */
    drawCityMarker(point, color, isSelected = false) {
        const ctx = this.ctx;
        const size = (isSelected ? 8 : 5) / this.transform.k;
        
        ctx.fillStyle = color;
        ctx.strokeStyle = '#2b2118';
        ctx.lineWidth = 1 / this.transform.k;
        
        // Draw castle icon
        ctx.beginPath();
        ctx.arc(point.x, point.y, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Add battlements for selected
        if (isSelected) {
            const battlementSize = size * 0.3;
            ctx.fillRect(point.x - size, point.y - size - battlementSize, battlementSize, battlementSize);
            ctx.fillRect(point.x, point.y - size - battlementSize, battlementSize, battlementSize);
            ctx.fillRect(point.x + size - battlementSize, point.y - size - battlementSize, battlementSize, battlementSize);
        }
    }

    /**
     * Draw draft/construction lines
     */
    drawDraft(points, color = '#8a3324') {
        if (points.length === 0) return;
        
        const ctx = this.ctx;
        const adjustedWidth = 2 / this.transform.k;
        const dashSize = 5 / this.transform.k;
        
        ctx.strokeStyle = color;
        ctx.lineWidth = adjustedWidth;
        ctx.setLineDash([dashSize, dashSize]);
        
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Draw vertices
        const vertexSize = 3 / this.transform.k;
        ctx.fillStyle = color;
        
        for (let p of points) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, vertexSize, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    /**
     * Convert hex color to rgba
     */
    hexToRgba(hex, alpha) {
        const r = parseInt(hex.substr(1, 2), 16);
        const g = parseInt(hex.substr(3, 2), 16);
        const b = parseInt(hex.substr(5, 2), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    /**
     * Pan the viewport
     */
    pan(dx, dy) {
        this.transform.x += dx;
        this.transform.y += dy;
    }

    /**
     * Zoom the viewport
     */
    zoom(scale, centerX, centerY) {
        const oldK = this.transform.k;
        this.transform.k = Math.max(CONFIG.MIN_ZOOM, Math.min(CONFIG.MAX_ZOOM, this.transform.k * scale));
        
        // Zoom towards cursor position
        const newK = this.transform.k;
        if (centerX !== undefined && centerY !== undefined) {
            this.transform.x = centerX - (centerX - this.transform.x) * (newK / oldK);
            this.transform.y = centerY - (centerY - this.transform.y) * (newK / oldK);
        }
    }
}
