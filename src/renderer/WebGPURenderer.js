import { CONFIG } from '../config.js';
import {
    resampleGeometry,
    alignPolygonClosed,
    alignPolylineOpen,
} from '../core/math.js';
import { WGSL_SHADER } from './shaders/MedievalWGSL.js';

export default class WebGPURenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);

        // Rendering state
        this.transform = {
            x: this.canvas.clientWidth / 2,
            y: this.canvas.clientHeight / 2,
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

        // For compatibility with main.js
        this.worldLayerValid = false;

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

        shaderModule.getCompilationInfo().then((info) => {
            if (info.messages.length > 0) {
                console.error("WGSL Compilation Info:", info.messages);
            }
        });

        this.device.pushErrorScope('validation');

        // Geometry Pipeline
        const vertexBuffers = [{
            arrayStride: 44, // 11 floats * 4 bytes
            attributes: [
                { shaderLocation: 0, offset: 0, format: 'float32x2' }, // a_position
                { shaderLocation: 1, offset: 8, format: 'float32x2' }, // a_nextPosition
                { shaderLocation: 2, offset: 16, format: 'float32x3' }, // a_color
                { shaderLocation: 3, offset: 28, format: 'float32' },   // a_validStart
                { shaderLocation: 4, offset: 32, format: 'float32' },   // a_validEnd
                { shaderLocation: 5, offset: 36, format: 'float32' },   // a_yearStart
                { shaderLocation: 6, offset: 40, format: 'float32' }    // a_yearEnd
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
                }],
            },
            primitive: {
                topology: 'triangle-list',
            },
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

        this.parchmentBindGroup = this.device.createBindGroup({
            layout: this.parchmentPipeline.getBindGroupLayout(0),
            entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }]
        });

        this.geometryBindGroup = this.device.createBindGroup({
            layout: this.renderPipeline.getBindGroupLayout(0),
            entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }]
        });

        this.device.popErrorScope().then((error) => {
            if (error) {
                console.error("WebGPU Pipeline Validation Error:", error.message);
            }
        });

        this.initialized = true;
        this.resize();
        this.updateThemeColors();
        if (window.illuminarchismApp) {
            window.illuminarchismApp.render();
        }
    }

    resize() {
        if (!this.canvas) return;
        const displayWidth = this.canvas.clientWidth;
        const displayHeight = this.canvas.clientHeight;

        console.log("WebGPU resize: w=", displayWidth, "h=", displayHeight);

        if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
            this.canvas.width = displayWidth;
            this.canvas.height = displayHeight;

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
        const w = this.canvas.width;
        const h = this.canvas.height;
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

    buildStaticBuffer(entities) {
        if (!this.device) return 0;

        const YEAR_MIN = -1e9;
        const YEAR_MAX = 1e9;
        const vertices = [];

        for (const entity of entities) {
            if (!entity || !entity.timeline || entity.timeline.length === 0) continue;

            const isLineType = entity.type === 'river' ||
                             entity.typology === 'river' ||
                             entity.typology === 'coast';
            const isClosed = !isLineType;
            const color = this.hexToRgb(entity.color);
            const validStart = (entity.validRange && entity.validRange.start !== undefined) ? entity.validRange.start : -10000;
            const validEnd = (entity.validRange && entity.validRange.end !== undefined) ? entity.validRange.end : 10000;

            const t0 = entity.timeline[0];
            if (!t0.geometry) continue;
            this.addSegment(vertices, t0.geometry, t0.geometry, color, validStart, validEnd, YEAR_MIN, t0.year, isClosed);

            for (let i = 0; i < entity.timeline.length - 1; i++) {
                const cur = entity.timeline[i];
                const next = entity.timeline[i+1];
                if (!cur.geometry || !next.geometry) continue;
                this.addSegment(vertices, cur.geometry, next.geometry, color, validStart, validEnd, cur.year, next.year, isClosed);
            }

            const tn = entity.timeline[entity.timeline.length - 1];
            if (!tn.geometry) continue;
            this.addSegment(vertices, tn.geometry, tn.geometry, color, validStart, validEnd, tn.year, YEAR_MAX, isClosed);
        }


        const vertexData = new Float32Array(vertices);

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
        this.lastRenderState.vertexCount = vertices.length / 11;
        this.worldLayerValid = true;

        return this.lastRenderState.vertexCount;
    }

    addSegment(vertices, startGeoOriginal, endGeoOriginal, color, validStart, validEnd, yearStart, yearEnd, isClosed) {
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

        if (startGeo && startGeo.length >= 3 && endGeo && endGeo.length >= 3) {
             for (let i = 1; i < startGeo.length - 1; i++) {
                this.addTriangle(vertices,
                    startGeo[0], endGeo[0],
                    startGeo[i], endGeo[i],
                    startGeo[i+1], endGeo[i+1],
                    color,
                    validStart,
                    validEnd,
                    yearStart, yearEnd
                );
             }
        }
    }

    addTriangle(vertices, p1Start, p1End, p2Start, p2End, p3Start, p3End, color, validStart, validEnd, yearStart, yearEnd) {
        this.pushVertex(vertices, p1Start, p1End, color, validStart, validEnd, yearStart, yearEnd);
        this.pushVertex(vertices, p2Start, p2End, color, validStart, validEnd, yearStart, yearEnd);
        this.pushVertex(vertices, p3Start, p3End, color, validStart, validEnd, yearStart, yearEnd);
    }

    pushVertex(vertices, pStart, pEnd, color, validStart, validEnd, yearStart, yearEnd) {
        vertices.push(
            pStart.x, pStart.y,
            pEnd.x, pEnd.y,
            color[0], color[1], color[2],
            validStart,
            validEnd,
            yearStart,
            yearEnd
        );
    }

    hexToRgb(hex) {
        if (!hex) return [0,0,0];
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        return [r, g, b];
    }

    // draw signature used by main.js
    draw(entities, hoveredId, selectedId, activeTool, vertexHighlightIndex, layers = null) {
        if (!this.initialized || !this.device) return;

        // We sync transform.zoom with transform.k in MedievalRenderer
        this.transform.zoom = this.transform.k;

        const currentYear = window.illuminarchismApp ? window.illuminarchismApp.currentYear : 1000;

        const needsRebuild = this.lastRenderState.entities !== entities || !this.worldLayerValid;
        let vertexCount = this.lastRenderState.vertexCount;

        if (needsRebuild) {
             vertexCount = this.buildStaticBuffer(entities);
        }

        // Update Uniforms
        const matrix = this.createTransformMatrix();
        const time = (Date.now() - this.startTime) * 0.001;

        const parchmentColorRgb = this.hexToRgb(this.themeColors.parchmentBg || '#f3e9d2');
        const inkColorRgb = this.hexToRgb(this.themeColors.inkPrimary || '#2b2118');

        const uniformData = new Float32Array(32);
        uniformData.set(matrix, 0);          // 0-11
        uniformData[12] = currentYear;
        uniformData[13] = this.settings.wobble;
        uniformData[14] = time;
        uniformData[15] = this.settings.inkBleed;
        uniformData[16] = this.settings.paperRoughness;
        // padding
        uniformData.set(parchmentColorRgb, 20); // 20-22
        // padding
        uniformData.set(inkColorRgb, 24);    // 24-26

        console.log("Uniform data matrix:", Array.from(matrix));
        console.log("Uniform data flags:", currentYear, this.settings.wobble, time, this.settings.inkBleed, this.settings.paperRoughness);

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
        console.log("WebGPU draw: vertexCount=", vertexCount, "entities=", entities.length);
        if (vertexCount > 0 && this.geometryBuffer) {
            this.device.pushErrorScope('validation');
            passEncoder.setPipeline(this.renderPipeline);
            passEncoder.setBindGroup(0, this.geometryBindGroup);
            passEncoder.setVertexBuffer(0, this.geometryBuffer);
            passEncoder.draw(vertexCount, 1, 0, 0);

            // Note: popErrorScope cannot be called during a render pass
            // We must do it after end() and submit()
        }

        passEncoder.end();
        this.device.queue.submit([commandEncoder.finish()]);

        if (vertexCount > 0 && this.geometryBuffer) {
            this.device.popErrorScope().then((error) => {
                if (error) {
                    console.error("WebGPU Draw Validation Error:", error.message);
                }
            });
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
