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
    static FALLBACK_HIGHLIGHT_RGB = '255, 215, 0';

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
        // initialization deferred to async create()
    }

    static async create(canvasId) {
        const renderer = new MedievalRenderer(canvasId);
        await renderer._initWebGPU();
        await renderer.createParchmentTexture();
        renderer.createWaterTexture();
        return renderer;
    }

    async _initWebGPU() {
        if (!navigator.gpu) {
            this.gpuDevice = null;
            return;
        }
        try {
            const adapter = await navigator.gpu.requestAdapter();
            if (!adapter) {
                this.gpuDevice = null;
                return;
            }
            this.gpuDevice = await adapter.requestDevice();
        } catch (e) {
            console.warn("WebGPU initialization failed:", e);
            this.gpuDevice = null;
        }
    }

    updateThemeColors() {
        if (typeof document !== 'undefined' && typeof getComputedStyle !== 'undefined') {
            const style = getComputedStyle(document.body || document.documentElement);
            this.themeColors.inkPrimary = style.getPropertyValue('--ink-primary').trim() || '#2b2118';
            this.themeColors.parchmentBg = style.getPropertyValue('--parchment-bg').trim() || '#f3e9d2';
        }
    }

    onThemeUpdate() {
        MedievalRenderer.cachedParchmentCanvas = null;
        this.createParchmentTexture();
        this.createWaterTexture();
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

    async createParchmentTexture() {
        if (!MedievalRenderer.cachedParchmentCanvas) {
            if (this.gpuDevice) {
                await this._generateParchmentGPU();
            } else {
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
        }

        this.noisePattern = this.ctx.createPattern(MedievalRenderer.cachedParchmentCanvas, 'repeat');
    }

    async _generateParchmentGPU() {
        const size = 512;
        const c = document.createElement('canvas');
        c.width = size;
        c.height = size;
        const ctx = c.getContext('2d');

        let baseColor = [243 / 255, 233 / 255, 210 / 255];
        const val = this.themeColors.parchmentBg;
        if (val.startsWith('#') && val.length === 7) {
            baseColor = [
                parseInt(val.slice(1, 3), 16) / 255,
                parseInt(val.slice(3, 5), 16) / 255,
                parseInt(val.slice(5, 7), 16) / 255
            ];
        }

        const wgslCode = `
struct Uniforms {
    baseColor: vec3<f32>,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var outTexture: texture_storage_2d<rgba8unorm, write>;

// Simple pseudo-random hash for value noise
fn hash(p: vec2<f32>) -> f32 {
    let p3 = fract(vec3<f32>(p.xyx) * 0.1313);
    let dp = dot(p3, p3.yzx + 3.333);
    return fract((dp + p3.x) * p3.y);
}

// 2D Value Noise
fn valueNoise(p: vec2<f32>) -> f32 {
    let i = floor(p);
    let f = fract(p);

    // quintic interpolation
    let u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);

    let a = hash(i + vec2<f32>(0.0, 0.0));
    let b = hash(i + vec2<f32>(1.0, 0.0));
    let c = hash(i + vec2<f32>(0.0, 1.0));
    let d = hash(i + vec2<f32>(1.0, 1.0));

    // Maps 0..1 to -1..1 to match the JS perlin noise behavior approximately
    let res = mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
    return res * 2.0 - 1.0;
}

fn fbm(p: vec2<f32>, octaves: u32, persistence: f32, lacunarity: f32) -> f32 {
    var total = 0.0;
    var frequency = 1.0;
    var amplitude = 1.0;
    var maxValue = 0.0;
    for (var i = 0u; i < octaves; i = i + 1u) {
        total = total + valueNoise(p * frequency) * amplitude;
        maxValue = maxValue + amplitude;
        amplitude = amplitude * persistence;
        frequency = frequency * lacunarity;
    }
    return total / maxValue;
}

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let x = global_id.x;
    let y = global_id.y;
    if (x >= 512u || y >= 512u) { return; }

    let coords = vec2<f32>(f32(x), f32(y));
    let n = fbm(coords / 150.0, 4u, 0.5, 2.0);

    let brightness = 1.0 + (n * 0.15);

    var color = uniforms.baseColor * brightness;
    color = clamp(color, vec3<f32>(0.0), vec3<f32>(1.0));

    textureStore(outTexture, vec2<i32>(i32(x), i32(y)), vec4<f32>(color, 1.0));
}
        `;

        const device = this.gpuDevice;
        const texture = device.createTexture({
            size: [size, size, 1],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC
        });

        // 16 bytes for a vec3
        const uniformBuffer = device.createBuffer({
            size: 16,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        const uniformData = new Float32Array([...baseColor, 0]);
        device.queue.writeBuffer(uniformBuffer, 0, uniformData);

        const shaderModule = device.createShaderModule({ code: wgslCode });
        const pipeline = device.createComputePipeline({
            layout: 'auto',
            compute: { module: shaderModule, entryPoint: 'main' }
        });

        const bindGroup = device.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: uniformBuffer } },
                { binding: 1, resource: texture.createView() }
            ]
        });

        // Copy buffer needs to be a multiple of 256 bytes per row
        const bytesPerPixel = 4;
        const bytesPerRow = size * bytesPerPixel; // 512 * 4 = 2048, which is multiple of 256
        const readBuffer = device.createBuffer({
            size: bytesPerRow * size,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
        });

        const encoder = device.createCommandEncoder();
        const pass = encoder.beginComputePass();
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.dispatchWorkgroups(Math.ceil(size / 16), Math.ceil(size / 16));
        pass.end();

        encoder.copyTextureToBuffer(
            { texture },
            { buffer: readBuffer, bytesPerRow },
            [size, size, 1]
        );

        device.queue.submit([encoder.finish()]);

        await readBuffer.mapAsync(GPUMapMode.READ);
        const arrayBuffer = readBuffer.getMappedRange();
        const uint8Array = new Uint8ClampedArray(arrayBuffer);
        const imageData = new ImageData(uint8Array, size, size);

        ctx.putImageData(imageData, 0, 0);
        MedievalRenderer.cachedParchmentCanvas = c;

        readBuffer.unmap();
        texture.destroy();
        uniformBuffer.destroy();
        readBuffer.destroy();
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

        if (!Array.isArray(entities)) {
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
                } else if (ent.type === 'image') {
                    this.drawImageEntity(ent, isHovered, isSelected, ctx);
                } else if (ent.type !== 'water') {
                    this.drawPolygon(ent, isHovered, isSelected, ctx);
                }
            }

            // Draw Label (for all types, including water)
            // Skip labels for images
            if (ent.type !== 'image' && (isSelected || isHovered || t.k > 0.5)) {
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
        if ((activeTool === 'vertex-edit' || activeTool === 'warp') && selectedId) {
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

    _getAffineTransform(x0, y0, x1, y1, x2, y2, u0, v0, u1, v1, u2, v2) {
        const det = x0 * (y1 - y2) - y0 * (x1 - x2) + x1 * y2 - x2 * y1;
        if (Math.abs(det) < 1e-6) return null;

        const a = (u0 * (y1 - y2) - y0 * (u1 - u2) + u1 * y2 - u2 * y1) / det;
        const c = (x0 * (u1 - u2) - u0 * (x1 - x2) + x1 * u2 - x2 * u1) / det;
        const e = (x0 * (y1 * u2 - y2 * u1) - y0 * (x1 * u2 - x2 * u1) + u0 * (x1 * y2 - x2 * y1)) / det;

        const b = (v0 * (y1 - y2) - y0 * (v1 - v2) + v1 * y2 - v2 * y1) / det;
        const d = (x0 * (v1 - v2) - v0 * (x1 - x2) + x1 * v2 - x2 * v1) / det;
        const f = (x0 * (y1 * v2 - y2 * v1) - y0 * (x1 * v2 - x2 * v1) + v0 * (x1 * y2 - x2 * y1)) / det;

        return [a, b, c, d, e, f];
    }

    _drawAffineTriangle(ctx, img, sx0, sy0, sx1, sy1, sx2, sy2, dx0, dy0, dx1, dy1, dx2, dy2) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(dx0, dy0);
        ctx.lineTo(dx1, dy1);
        ctx.lineTo(dx2, dy2);
        ctx.closePath();
        ctx.clip();

        const transform = this._getAffineTransform(sx0, sy0, sx1, sy1, sx2, sy2, dx0, dy0, dx1, dy1, dx2, dy2);
        if (transform) {
            ctx.transform(transform[0], transform[1], transform[2], transform[3], transform[4], transform[5]);
            ctx.drawImage(img, 0, 0);
        }
        ctx.restore();
    }

    drawImageEntity(ent, isHovered, isSelected, targetCtx = null) {
        const ctx = targetCtx || this.ctx;
        if (!ent.currentGeometry || ent.currentGeometry.length < 4 || !ent.image) return;

        const pts = ent.currentGeometry;
        const img = ent.image;
        const w = img.width;
        const h = img.height;

        ctx.save();
        ctx.globalAlpha = ent.opacity !== undefined ? ent.opacity : 0.5;

        // Draw image using a 2-triangle affine warp to support individual corner movement
        // Triangle 1: Top-Left, Top-Right, Bottom-Left
        this._drawAffineTriangle(ctx, img,
            0, 0, w, 0, 0, h,
            pts[0].x, pts[0].y, pts[1].x, pts[1].y, pts[3].x, pts[3].y
        );

        // Triangle 2: Bottom-Right, Bottom-Left, Top-Right
        this._drawAffineTriangle(ctx, img,
            w, h, 0, h, w, 0,
            pts[2].x, pts[2].y, pts[3].x, pts[3].y, pts[1].x, pts[1].y
        );

        // Selection/Hover outline
        if (isSelected || isHovered) {
            ctx.globalAlpha = 1.0;
            ctx.strokeStyle = isSelected ? '#8a3324' : 'rgba(138, 51, 36, 0.5)';
            ctx.lineWidth = (isSelected ? 2 : 1) / this.transform.k;
            ctx.setLineDash([5 / this.transform.k, 5 / this.transform.k]);

            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) {
                ctx.lineTo(pts[i].x, pts[i].y);
            }
            ctx.closePath();
            ctx.stroke();
        }

        ctx.restore();
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
            ctx.strokeStyle = this.getInvertedColor(ent.color, 0.8);
            ctx.lineWidth = (ctx.lineWidth || (1.5 / this.transform.k)) * 4; // Thicker than main border
            ctx.lineCap = 'round';
            ctx.setLineDash([15 / this.transform.k, 15 / this.transform.k]);
            ctx.lineDashOffset = -((performance.now() / 40) / this.transform.k) % (30 / this.transform.k);
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
            ctx.strokeStyle = this.getInvertedColor(ent.color, 0.8);
            ctx.lineWidth = (4 / this.transform.k) * 2;
            ctx.lineCap = 'round';
            ctx.setLineDash([15 / this.transform.k, 15 / this.transform.k]);
            ctx.lineDashOffset = -((performance.now() / 40) / this.transform.k) % (30 / this.transform.k);
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
                ctx.strokeStyle = this.getInvertedColor(ent.color, 0.8);
                ctx.lineWidth = 3 / this.transform.k;
                ctx.setLineDash([8 / this.transform.k, 8 / this.transform.k]);
                ctx.lineDashOffset = -((performance.now() / 40) / this.transform.k) % (16 / this.transform.k);
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

    getInvertedColor(hex, alpha) {
        if (!hex || !hex.startsWith('#')) return `rgba(${MedievalRenderer.FALLBACK_HIGHLIGHT_RGB},${alpha})`;
        let h = hex.slice(1);
        if (h.length === 3) h = h.split('').map(c => c + c).join('');
        if (h.length !== 6) return `rgba(${MedievalRenderer.FALLBACK_HIGHLIGHT_RGB},${alpha})`;
        const r = 255 - parseInt(h.slice(0, 2), 16);
        const g = 255 - parseInt(h.slice(2, 4), 16);
        const b = 255 - parseInt(h.slice(4, 6), 16);
        return `rgba(${r},${g},${b},${alpha})`;
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
                 else if (ent.type === 'image') this.drawImageEntity(ent, false, false, ctx);
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
