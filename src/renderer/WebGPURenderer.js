import { CONFIG } from '../config.js';
import {
    resampleGeometry,
    alignPolygonClosed,
    alignPolylineOpen,
    getRepresentativePoint
} from '../core/math.js';
import { WGSL_SHADER } from './shaders/MedievalWGSL.js';

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

const GEOMETRY_CONFIG = {
    POINT_SIZE: 10,
    POLYLINE_STROKE_WIDTH: 3
};

const DEFAULT_VALID_START_YEAR = -10000;
const DEFAULT_VALID_END_YEAR = 10000;

export default class WebGPURenderer {
    constructor(canvasId, onNeedRedraw = null) {
        this.canvas = document.getElementById(canvasId);
        this.onNeedRedraw = onNeedRedraw;

        // Setup Overlay Canvas
        this.overlayCanvas = document.createElement('canvas');
        this.overlayCanvas.style.position = 'absolute';
        this.overlayCanvas.style.top = '0';
        this.overlayCanvas.style.left = '0';
        this.overlayCanvas.style.pointerEvents = 'none';
        this.overlayCanvas.style.zIndex = '10';
        this.canvas.parentNode.insertBefore(this.overlayCanvas, this.canvas.nextSibling);
        this.overlayCtx = this.overlayCanvas.getContext('2d');

        this.labelRegions = [];

        // Use actual layout dimensions if available, otherwise defer to first resize
        const w = this.canvas.clientWidth || window.innerWidth;
        const h = this.canvas.clientHeight || window.innerHeight;

        // Rendering state
        this.transform = {
            x: w / 2,
            y: h / 2,
            zoom: 1,
            k: 1
        };

        this.settings = {
            wobble: 2.0,
            inkBleed: 0.3,
            paperRoughness: 20.0
        };

        this.themeColors = {
            inkPrimary: '#2b2118',
            parchmentBg: '#f3e9d2'
        };

        this.scaleUnit = 'leagues';

        this.device = null;
        this.context = null;
        this.renderPipeline = null;
        this.parchmentPipeline = null;

        this.geometryBuffer = null;
        this.uniformBuffer = null;

        this.lastRenderState = {
            entities: null,
            vertexCount: 0
        };

        this.startTime = Date.now();
        this.initialized = false;
        this._transformInitialized = false;

        // For compatibility with main.js
        this.worldLayerValid = false;

        // GPU Cache for entities to avoid rebuilding unchanged geometry
        this._gpuCache = new Map();
        this._gpuCacheDirty = true;

        // Window resize handler
        this._onResize = () => {
            this.resize();
            if (this.initialized && this.onNeedRedraw) {
                this.onNeedRedraw();
            }
        };
        window.addEventListener('resize', this._onResize);

        // Start init process
        this.init();
    }

    async init() {
        if (!navigator.gpu) {
            console.error('WebGPU not supported on this browser.');
            return;
        }

        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
            console.error('No appropriate WebGPU adapter found.');
            return;
        }

        this.device = await adapter.requestDevice();
        this.context = this.canvas.getContext('webgpu');

        const presentationFormat = navigator.gpu.getPreferredCanvasFormat();

        this.context.configure({
            device: this.device,
            format: presentationFormat,
            alphaMode: 'premultiplied',
        });

        // Create Uniform Buffer
        // u_matrix (9 floats), u_currentYear (1), u_wobble (1), u_time (1), u_inkBleed (1), u_paperRough (1)
        // WGSL mat3x3 takes 12 floats (padded). Total 16 floats = 64 bytes.
        this.uniformBuffer = this.device.createBuffer({
            size: 128,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        const shaderModule = this.device.createShaderModule({
            code: WGSL_SHADER,
        });

        this._entityFloatIds = new Map();
        this._nextEntityFloatId = 1;

        // Geometry Pipeline
        const vertexBuffers = [{
            arrayStride: 48, // 12 floats * 4 bytes
            attributes: [
                { shaderLocation: 0, offset: 0, format: 'float32x2' }, // a_position
                { shaderLocation: 1, offset: 8, format: 'float32x2' }, // a_nextPosition
                { shaderLocation: 2, offset: 16, format: 'float32x3' }, // a_color
                { shaderLocation: 3, offset: 28, format: 'float32' },   // a_validStart
                { shaderLocation: 4, offset: 32, format: 'float32' },   // a_validEnd
                { shaderLocation: 5, offset: 36, format: 'float32' },   // a_yearStart
                { shaderLocation: 6, offset: 40, format: 'float32' },   // a_yearEnd
                { shaderLocation: 7, offset: 44, format: 'float32' }    // a_entityId
            ]
        }];

        this.renderPipeline = this.device.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module: shaderModule,
                entryPoint: 'vs_main',
                buffers: vertexBuffers,
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'fs_main',
                targets: [{
                    format: presentationFormat,
                    blend: {
                        color: {
                            srcFactor: 'one',
                            dstFactor: 'one-minus-src-alpha',
                            operation: 'add',
                        },
                        alpha: {
                            srcFactor: 'one',
                            dstFactor: 'one-minus-src-alpha',
                            operation: 'add',
                        },
                    },
                }],
            },
            primitive: {
                topology: 'triangle-list',
            },
        });

        this.imageUniformBindGroup = this.device.createBindGroup({
            layout: this.imagePipeline.getBindGroupLayout(0),
            entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }]
        });

        // Parchment Pipeline
        this.parchmentPipeline = this.device.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module: shaderModule,
                entryPoint: 'vs_parchment',
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'fs_parchment',
                targets: [{ format: presentationFormat }],
            },
            primitive: { topology: 'triangle-list' },
        });

        // Image Texture Pipeline
        const imageVertexBuffers = [{
            arrayStride: 20, // 5 floats * 4 bytes (x, y, u, v, opacity)
            attributes: [
                { shaderLocation: 0, offset: 0, format: 'float32x2' }, // a_position
                { shaderLocation: 1, offset: 8, format: 'float32x2' }, // a_uv
                { shaderLocation: 2, offset: 16, format: 'float32' },  // a_opacity
            ]
        }];

        this.imagePipeline = this.device.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module: shaderModule,
                entryPoint: 'vs_image',
                buffers: imageVertexBuffers,
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'fs_image',
                targets: [{
                    format: presentationFormat,
                    blend: {
                        color: {
                            srcFactor: 'one',
                            dstFactor: 'one-minus-src-alpha',
                            operation: 'add',
                        },
                        alpha: {
                            srcFactor: 'one',
                            dstFactor: 'one-minus-src-alpha',
                            operation: 'add',
                        },
                    },
                }],
            },
            primitive: {
                topology: 'triangle-list',
            },
        });

        this.imageSampler = this.device.createSampler({
            magFilter: 'linear',
            minFilter: 'linear',
            mipmapFilter: 'linear',
        });

        this.parchmentBindGroup = this.device.createBindGroup({
            layout: this.parchmentPipeline.getBindGroupLayout(0),
            entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }]
        });

        this.geometryBindGroup = this.device.createBindGroup({
            layout: this.renderPipeline.getBindGroupLayout(0),
            entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }]
        });

        this.initialized = true;
        this.resize();
        this.updateThemeColors();
        if (this.onNeedRedraw) {
            this.onNeedRedraw();
        }
    }

    resize() {
        if (!this.canvas) return;
        const displayWidth = this.canvas.clientWidth;
        const displayHeight = this.canvas.clientHeight;
        if (displayWidth === 0 || displayHeight === 0) return;

        const oldWidth = this.canvas.width;
        const oldHeight = this.canvas.height;

        if (oldWidth !== displayWidth || oldHeight !== displayHeight) {
            this.canvas.width = displayWidth;
            this.canvas.height = displayHeight;
            this.overlayCanvas.width = displayWidth;
            this.overlayCanvas.height = displayHeight;

            if (this.context && this.device) {
                this.context.configure({
                    device: this.device,
                    format: navigator.gpu.getPreferredCanvasFormat(),
                    alphaMode: 'premultiplied',
                });
            }
        }

        // On first resize (or if transform was never properly initialized),
        // center the view using real canvas dimensions
        if (!this._transformInitialized) {
            this.transform.x = displayWidth / 2;
            this.transform.y = displayHeight / 2;
            this._transformInitialized = true;
            this.invalidateWorldLayer();
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
        this.updateThemeColors();
    }

    createParchmentTexture() {
        // Handled by shader
    }

    createWaterTexture() {
        // Simplified for WebGPU MVP
    }

    invalidateWorldLayer() {
        this.worldLayerValid = false;
        this._gpuCacheDirty = true;
        // Trigger geometry rebuild
        this.lastRenderState.entities = null;
    }

    toWorld(sx, sy) {
        return {
            x: (sx - this.transform.x) / this.transform.k,
            y: (sy - this.transform.y) / this.transform.k
        };
    }

    screenToWorld(screenX, screenY) {
        return this.toWorld(screenX, screenY);
    }

    get width() { return this.canvas ? this.canvas.width : window.innerWidth; }
    set width(val) { if(this.canvas) this.canvas.width = val; }

    get height() { return this.canvas ? this.canvas.height : window.innerHeight; }
    set height(val) { if(this.canvas) this.canvas.height = val; }

    createTransformMatrix() {
        const w = this.canvas.width || this.canvas.clientWidth || window.innerWidth;
        const h = this.canvas.height || this.canvas.clientHeight || window.innerHeight;

        if (w === 0 || h === 0) {
            // Return identity-ish matrix that maps to center, prevents NaN
            return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0]);
        }

        const k = this.transform.k;
        const x = this.transform.x;
        const y = this.transform.y;

        // Orthographic projection matrix
        const scaleX = 2.0 / w * k;
        const scaleY = -2.0 / h * k; // Flip Y for WebGPU

        // Column-major for WGSL mat3x3 (padded to vec4 boundaries in uniform buffer)
        // WGSL mat3x3 memory layout:
        // [c0r0, c0r1, c0r2, pad]
        // [c1r0, c1r1, c1r2, pad]
        // [c2r0, c2r1, c2r2, pad]
        // Note: WGSL expects uniform arrays/structs to be 16-byte aligned.
        // A mat3x3 is treated as 3 vec3s, but each vec3 is padded to vec4 (16 bytes)
        // c0: scaleX, 0, 0, pad
        // c1: 0, scaleY, 0, pad
        // c2: tx, ty, 1, pad
        return new Float32Array([
            scaleX, 0, 0, 0,
            0, scaleY, 0, 0,
            (x * 2.0 / w) - 1.0, (y * -2.0 / h) + 1.0, 1, 0
        ]);
    }

    _getNumericId(id) {
        if (!this._entityFloatIds.has(id)) {
            this._entityFloatIds.set(id, this._nextEntityFloatId++);
        }
        return this._entityFloatIds.get(id);
    }

    async _getOrLoadImageTexture(entity) {
        if (!entity.image || entity.type !== 'image') return null;

        if (entity._gpuTextureBindGroup) {
            return entity._gpuTextureBindGroup;
        }

        try {
            // Draw image to an offscreen canvas to ensure it's a valid ImageBitmap source
            const canvas = document.createElement('canvas');
            canvas.width = entity.image.width;
            canvas.height = entity.image.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(entity.image, 0, 0);

            const bitmap = await createImageBitmap(canvas);

            const texture = this.device.createTexture({
                size: [bitmap.width, bitmap.height, 1],
                format: 'rgba8unorm',
                usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
            });

            this.device.queue.copyExternalImageToTexture(
                { source: bitmap },
                { texture: texture },
                [bitmap.width, bitmap.height]
            );

            const bindGroup = this.device.createBindGroup({
                layout: this.imagePipeline.getBindGroupLayout(1),
                entries: [
                    { binding: 0, resource: this.imageSampler },
                    { binding: 1, resource: texture.createView() }
                ]
            });

            entity._gpuTextureBindGroup = bindGroup;
            // Force redraw since texture just loaded asynchronously
            if (this.onNeedRedraw) this.onNeedRedraw();
            return bindGroup;
        } catch (e) {
            console.error('Failed to load WebGPU image texture', e);
            return null;
        }
    }

    buildStaticBuffer(entities, layers = null) {
        if (!this.device) return 0;

        const YEAR_MIN = -1e9;
        const YEAR_MAX = 1e9;

        let totalVertices = 0;
        const entityArrays = [];

        // Precompute layer visibility
        const layerMap = layers ? new Map(layers.map(l => [l.id, l])) : null;

        // Find which entity is currently being transformed
        const selectedId = window.illuminarchismApp ? window.illuminarchismApp.selectedEntityId : null;

        const currentEntityIds = new Set();

        for (const entity of entities) {
            if (!entity || !entity.timeline || entity.timeline.length === 0) continue;

            // Skip geometry generation for images
            if (entity.type === 'image') continue;

            // Check layer visibility
            if (layerMap) {
                const layer = layerMap.get(entity.layerId);
                if (layer && !layer.visible) continue;
            }

            currentEntityIds.add(entity.id);

            const isBeingEdited = entity.id === selectedId && entity.currentGeometry;

            // Check if we can reuse the cached Float32Array for this entity
            if (!this._gpuCacheDirty && !isBeingEdited && this._gpuCache.has(entity.id)) {
                const cachedArray = this._gpuCache.get(entity.id);
                entityArrays.push(cachedArray);
                totalVertices += cachedArray.length;
                continue;
            }

            // Generate vertices for this entity
            let entityVertices = [];

            const isLineType = entity.type === 'river' ||
                             entity.typology === 'river' ||
                             entity.typology === 'coast';
            const isClosed = !isLineType;
            const color = this.hexToRgb(entity.color);
            const validStart = (entity.validRange && entity.validRange.start !== undefined) ? entity.validRange.start : DEFAULT_VALID_START_YEAR;
            const validEnd = (entity.validRange && entity.validRange.end !== undefined) ? entity.validRange.end : DEFAULT_VALID_END_YEAR;

            const entityIdNum = this._getNumericId(entity.id);
            const t0 = entity.timeline[0];
            if (!t0.geometry) continue;

            let geoFn, isClosedForSegment;
            if (t0.geometry.length === 1) {
                // Point entity - expand to a small diamond quad
                const s = GEOMETRY_CONFIG.POINT_SIZE;
                const generatePointGeo = (pt) => {
                    if (!pt) return [];
                    return [
                        {x: pt.x, y: pt.y - s},
                        {x: pt.x + s, y: pt.y},
                        {x: pt.x, y: pt.y + s},
                        {x: pt.x - s, y: pt.y}
                    ];
                };
                geoFn = (geometry) => generatePointGeo(geometry[0]);
                isClosedForSegment = true;
            } else {
                geoFn = (geometry) => geometry;
                isClosedForSegment = isClosed;
            }

            this.addSegment(entityVertices, geoFn(t0.geometry), geoFn(t0.geometry), color, validStart, validEnd, YEAR_MIN, t0.year, isClosedForSegment, entityIdNum);

            for (let i = 0; i < entity.timeline.length - 1; i++) {
                const cur = entity.timeline[i];
                const next = entity.timeline[i+1];
                if (!cur.geometry || !next.geometry) continue;
                this.addSegment(entityVertices, geoFn(cur.geometry), geoFn(next.geometry), color, validStart, validEnd, cur.year, next.year, isClosedForSegment, entityIdNum);
            }

            const tn = entity.timeline[entity.timeline.length - 1];
            if (tn.geometry) {
                // If the entity is being dragged/modified, its currentGeometry reflects the drag state.
                // We use it as the final keyframe so the drag is visible dynamically in WebGPU.
                // In a real bitemporal model we'd build a dynamic buffer just for currentGeometry,
                // but for MVP this ensures the dragging polygon moves smoothly.
                const lastGeo = isBeingEdited ? entity.currentGeometry : tn.geometry;
                this.addSegment(entityVertices, geoFn(tn.geometry), geoFn(lastGeo), color, validStart, validEnd, tn.year, YEAR_MAX, isClosedForSegment, entityIdNum);
            }

            const floatArray = new Float32Array(entityVertices);

            // Only cache if we aren't actively editing it to avoid caching intermediate drag states
            if (!isBeingEdited) {
                this._gpuCache.set(entity.id, floatArray);
            }

            entityArrays.push(floatArray);
            totalVertices += floatArray.length;
        }

        // Cleanup deleted entities from cache
        for (const id of this._gpuCache.keys()) {
            if (!currentEntityIds.has(id)) {
                this._gpuCache.delete(id);
            }
        }

        this._gpuCacheDirty = false;

        const vertexData = new Float32Array(totalVertices);
        let offset = 0;
        for (const arr of entityArrays) {
            vertexData.set(arr, offset);
            offset += arr.length;
        }

        if (this.geometryBuffer) {
            this.geometryBuffer.destroy();
        }

        if (vertexData.length > 0) {
            this.geometryBuffer = this.device.createBuffer({
                size: vertexData.byteLength,
                usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            });
            this.device.queue.writeBuffer(this.geometryBuffer, 0, vertexData);
        }

        this.lastRenderState.entities = entities;
        this.lastRenderState.vertexCount = totalVertices / 12;
        this.worldLayerValid = true;

        return this.lastRenderState.vertexCount;
    }

    addSegment(vertices, startGeoOriginal, endGeoOriginal, color, validStart, validEnd, yearStart, yearEnd, isClosed, entityId) {
        let startGeo = startGeoOriginal;
        let endGeo = endGeoOriginal;

        if (startGeo.length !== endGeo.length) {
            startGeo = resampleGeometry(startGeo, CONFIG.RESAMPLE_COUNT, isClosed);
            endGeo = resampleGeometry(endGeo, CONFIG.RESAMPLE_COUNT, isClosed);
        }

        if (isClosed) {
            endGeo = alignPolygonClosed(startGeo, endGeo);
        } else {
            endGeo = alignPolylineOpen(startGeo, endGeo);
        }

        if (startGeo && startGeo.length >= 2 && endGeo && endGeo.length >= 2) {
            if (isClosed && startGeo.length >= 3 && endGeo.length >= 3) {
                for (let i = 1; i < startGeo.length - 1; i++) {
                    this.addTriangle(vertices,
                        startGeo[0], endGeo[0],
                        startGeo[i], endGeo[i],
                        startGeo[i+1], endGeo[i+1],
                        color,
                        validStart,
                        validEnd,
                        yearStart, yearEnd, entityId
                    );
                }
            } else if (!isClosed) {
                // Polylines (e.g., rivers) - stroke expansion
                const strokeWidth = GEOMETRY_CONFIG.POLYLINE_STROKE_WIDTH;
                for (let i = 0; i < startGeo.length - 1; i++) {
                    let s0 = startGeo[i];
                    let s1 = startGeo[i+1];
                    let e0 = endGeo[i];
                    let e1 = endGeo[i+1];

                    // Simple stroke expansion using normals
                    let dxS = s1.x - s0.x;
                    let dyS = s1.y - s0.y;
                    let lenS = Math.sqrt(dxS*dxS + dyS*dyS);
                    if (lenS === 0) continue;
                    let nxS = -dyS / lenS * strokeWidth;
                    let nyS = dxS / lenS * strokeWidth;

                    let dxE = e1.x - e0.x;
                    let dyE = e1.y - e0.y;
                    let lenE = Math.sqrt(dxE*dxE + dyE*dyE);
                    if (lenE === 0) continue;
                    let nxE = -dyE / lenE * strokeWidth;
                    let nyE = dxE / lenE * strokeWidth;

                    // Quad corners
                    let s0_a = {x: s0.x + nxS, y: s0.y + nyS};
                    let s0_b = {x: s0.x - nxS, y: s0.y - nyS};
                    let s1_a = {x: s1.x + nxS, y: s1.y + nyS};
                    let s1_b = {x: s1.x - nxS, y: s1.y - nyS};

                    let e0_a = {x: e0.x + nxE, y: e0.y + nyE};
                    let e0_b = {x: e0.x - nxE, y: e0.y - nyE};
                    let e1_a = {x: e1.x + nxE, y: e1.y + nyE};
                    let e1_b = {x: e1.x - nxE, y: e1.y - nyE};

                    // Triangle 1: s0_a, s1_a, s0_b
                    this.addTriangle(vertices,
                        s0_a, e0_a,
                        s1_a, e1_a,
                        s0_b, e0_b,
                        color, validStart, validEnd, yearStart, yearEnd, entityId
                    );

                    // Triangle 2: s1_a, s1_b, s0_b
                    this.addTriangle(vertices,
                        s1_a, e1_a,
                        s1_b, e1_b,
                        s0_b, e0_b,
                        color, validStart, validEnd, yearStart, yearEnd, entityId
                    );
                }
            }
        }
    }

    addTriangle(vertices, p1Start, p1End, p2Start, p2End, p3Start, p3End, color, validStart, validEnd, yearStart, yearEnd, entityId) {
        this.pushVertex(vertices, p1Start, p1End, color, validStart, validEnd, yearStart, yearEnd, entityId);
        this.pushVertex(vertices, p2Start, p2End, color, validStart, validEnd, yearStart, yearEnd, entityId);
        this.pushVertex(vertices, p3Start, p3End, color, validStart, validEnd, yearStart, yearEnd, entityId);
    }

    pushVertex(vertices, pStart, pEnd, color, validStart, validEnd, yearStart, yearEnd, entityId) {
        vertices.push(
            pStart.x, pStart.y,
            pEnd.x, pEnd.y,
            color[0], color[1], color[2],
            validStart,
            validEnd,
            yearStart,
            yearEnd,
            entityId
        );
    }

    hexToRgb(hex) {
        if (!hex) return [0,0,0];
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        return [r, g, b];
    }

    _isPointEntity(ent) {
        if (!ent || !ent.currentGeometry) return false;
        if (ent.currentGeometry.length === 1) return true;
        if (ent.typology === 'city' || ent.typology === 'sacred-site') return true;
        return false;
    }

    drawGrid() {
        const ctx = this.overlayCtx;
        if (!ctx) return;
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

    drawDraft(points, cursor, transform, type, options = {}) {
        if (!points || points.length === 0) return;
        const ctx = this.overlayCtx;
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

    drawLabel(ent, isSelected) {
        const ctx = this.overlayCtx;
        if (!ctx) return;
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

        ctx.font = font;
        ctx.textAlign = this._isPointEntity(ent) ? 'left' : 'center';

        // Collision Detection
        if (!isSelected && !this._isPointEntity(ent)) { // Always draw selected or points
            const metrics = ctx.measureText(ent.name);
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

        ctx.fillStyle = isSelected ? '#fff' : this.themeColors.inkPrimary;
        if (isSelected) ctx.shadowBlur = 4;
        ctx.shadowColor = isSelected ? '#000' : 'transparent';

        ctx.fillText(ent.name, cx, cy);
        ctx.shadowBlur = 0;
    }

    // draw signature used by main.js
    draw(entities, hoveredId, selectedId, activeTool, vertexHighlightIndex, layers = null) {
        if (!this.initialized || !this.device) return;

        this.resize();

        // We sync transform.zoom with transform.k in MedievalRenderer
        this.transform.zoom = this.transform.k;

        const currentYear = window.illuminarchismApp ? window.illuminarchismApp.currentYear : 1000;

        const needsRebuild = this.lastRenderState.entities !== entities || !this.worldLayerValid;
        let vertexCount = this.lastRenderState.vertexCount;

        if (needsRebuild) {
             vertexCount = this.buildStaticBuffer(entities, layers);
        }

        // Update Uniforms
        const matrix = this.createTransformMatrix();
        const time = (Date.now() - this.startTime) * 0.001;

        const parchmentColorRgb = this.hexToRgb(this.themeColors.parchmentBg || '#f3e9d2');
        const inkColorRgb = this.hexToRgb(this.themeColors.inkPrimary || '#2b2118');

        let hoveredNumericId = hoveredId ? this._getNumericId(hoveredId) : -1.0;
        let selectedNumericId = selectedId ? this._getNumericId(selectedId) : -1.0;

        const uniformData = new Float32Array(32);
        uniformData.set(matrix, 0);          // 0-11 (matCol0, matCol1, matCol2)
        uniformData[12] = currentYear;
        uniformData[13] = this.settings.wobble;
        uniformData[14] = time;
        uniformData[15] = this.settings.inkBleed;
        uniformData[16] = this.settings.paperRoughness;
        uniformData[17] = hoveredNumericId;
        uniformData[18] = selectedNumericId;
        // float 19 padding
        uniformData.set(parchmentColorRgb, 20); // 20-22
        uniformData[23] = 1.0;                  // parchmentColor.a
        uniformData.set(inkColorRgb, 24);       // 24-26
        uniformData[27] = 1.0;                  // inkColor.a

        this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);

        const commandEncoder = this.device.createCommandEncoder();
        const textureView = this.context.getCurrentTexture().createView();

        const renderPassDescriptor = {
            colorAttachments: [
                {
                    view: textureView,
                    clearValue: { r: parchmentColorRgb[0], g: parchmentColorRgb[1], b: parchmentColorRgb[2], a: 1.0 },
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
        };

        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);

        // 1. Draw Parchment
        passEncoder.setPipeline(this.parchmentPipeline);
        passEncoder.setBindGroup(0, this.parchmentBindGroup);
        passEncoder.draw(6, 1, 0, 0);

        // 2. Draw Geometry
        if (vertexCount > 0 && this.geometryBuffer) {
            passEncoder.setPipeline(this.renderPipeline);
            passEncoder.setBindGroup(0, this.geometryBindGroup);
            passEncoder.setVertexBuffer(0, this.geometryBuffer);
            passEncoder.draw(vertexCount, 1, 0, 0);
        }

        // 3. Draw Images
        if (entities) {
            // Need to bind the uniforms bindGroup (group 0) for the image pipeline as well
            // because vs_image uses uniforms.matColX to transform vertices
            let imageUniformsBound = false;

            for (const entity of entities) {
                if (!entity || !entity.visible || entity.type !== 'image' || !entity.currentGeometry || entity.currentGeometry.length < 4) continue;

                // Ensure texture is loading/loaded
                const bindGroup = entity._gpuTextureBindGroup;
                if (!bindGroup) {
                    this._getOrLoadImageTexture(entity);
                    continue;
                }

                if (!imageUniformsBound) {
                    passEncoder.setPipeline(this.imagePipeline);
                    passEncoder.setBindGroup(0, this.imageUniformBindGroup);
                    imageUniformsBound = true;
                }

                const opacity = entity.opacity !== undefined ? entity.opacity : 0.5;
                const pts = entity.currentGeometry;

                // Generate a 6-vertex quad for the image (two triangles)
                // Assuming points are TL, TR, BR, BL
                const quadVertices = new Float32Array([
                    pts[0].x, pts[0].y, 0, 0, opacity,
                    pts[1].x, pts[1].y, 1, 0, opacity,
                    pts[3].x, pts[3].y, 0, 1, opacity,

                    pts[1].x, pts[1].y, 1, 0, opacity,
                    pts[2].x, pts[2].y, 1, 1, opacity,
                    pts[3].x, pts[3].y, 0, 1, opacity
                ]);

                // Cache the quad buffer per entity to avoid creating a new buffer every frame
                if (!entity._gpuQuadBuffer) {
                    entity._gpuQuadBuffer = this.device.createBuffer({
                        size: quadVertices.byteLength,
                        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
                    });
                }
                this.device.queue.writeBuffer(entity._gpuQuadBuffer, 0, quadVertices);

                passEncoder.setBindGroup(1, bindGroup);
                passEncoder.setVertexBuffer(0, entity._gpuQuadBuffer);
                passEncoder.draw(6, 1, 0, 0);
            }
        }

        passEncoder.end();
        this.device.queue.submit([commandEncoder.finish()]);

        // --- OVERLAY RENDERING (Canvas 2D) ---
        if (this.overlayCtx) {
            this.overlayCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.labelRegions = []; // reset collision array

            this.overlayCtx.save();
            this.overlayCtx.translate(this.transform.x, this.transform.y);
            this.overlayCtx.scale(this.transform.k, this.transform.k);

            this.drawGrid();

            // Draw Labels
            if (entities) {
                entities.forEach(ent => {
                    if (ent && ent.currentGeometry && ent.visible !== false && ent.type !== 'image') {
                        if (ent.id === selectedId || ent.id === hoveredId || this.transform.k > 0.5) {
                            this.drawLabel(ent, ent.id === selectedId);
                        }
                    }
                });
            }
            this.overlayCtx.restore();
        }
    }

    pan(dx, dy) {
        this.transform.x += dx;
        this.transform.y += dy;
        this.invalidateWorldLayer();
    }

    zoom(scale, centerX, centerY) {
        const oldZoom = this.transform.k;
        this.transform.k = Math.max(
            CONFIG.MIN_ZOOM,
            Math.min(CONFIG.MAX_ZOOM, this.transform.k * scale)
        );
        this.transform.zoom = this.transform.k;

        if (centerX !== undefined && centerY !== undefined) {
            const newZoom = this.transform.k;
            this.transform.x = centerX - (centerX - this.transform.x) * (newZoom / oldZoom);
            this.transform.y = centerY - (centerY - this.transform.y) * (newZoom / oldZoom);
        }
        this.invalidateWorldLayer();
    }
}
