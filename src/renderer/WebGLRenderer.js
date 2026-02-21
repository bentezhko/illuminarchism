/**
 * WebGL Renderer Module
 * GPU-accelerated rendering with medieval manuscript effects
 */

import { 
    VERTEX_SHADER, 
    FRAGMENT_SHADER,
    PARCHMENT_VERTEX_SHADER,
    PARCHMENT_FRAGMENT_SHADER 
} from './shaders/MedievalShader.js';
import { CONFIG } from '../config.js';
import {
    resampleGeometry,
    alignPolygonClosed,
    alignPolylineOpen,
    getCentroid,
    lerp
} from '../core/math.js';

export default class WebGLRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl2', {
            alpha: false,
            antialias: true,
            depth: true
        });
        
        if (!this.gl) {
            throw new Error('WebGL2 not supported');
        }
        
        // Rendering state
        this.transform = {
            x: 0,
            y: 0,
            zoom: 1
        };
        
        this.settings = {
            wobble: 2.0,
            inkBleed: 0.3,
            paperRoughness: 20.0
        };
        
        // Shader programs
        this.mainProgram = null;
        this.parchmentProgram = null;
        this.lineProgram = null; // For draft lines
        
        // Buffers
        this.geometryBuffer = null;
        this.parchmentBuffer = null;
        this.lineBuffer = null;
        
        // Cache state for optimization
        this.lastRenderState = {
            validRange: { start: -Infinity, end: -Infinity },
            entities: null,
            vertexCount: 0
        };

        // Animation
        this.startTime = Date.now();
        
        this.init();
        
        console.log('✓ WebGL Renderer initialized');
    }
    
    init() {
        const gl = this.gl;
        
        // Enable blending for transparency
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        
        // Create shader programs
        this.mainProgram = this.createProgram(VERTEX_SHADER, FRAGMENT_SHADER);
        this.parchmentProgram = this.createProgram(PARCHMENT_VERTEX_SHADER, PARCHMENT_FRAGMENT_SHADER);
        this.lineProgram = this.createSimpleLineProgram();
        
        // Create parchment background (full-screen quad)
        this.createParchmentBuffer();
        
        this.resize();
    }
    
    createProgram(vertexSource, fragmentSource) {
        const gl = this.gl;
        
        const vertexShader = this.compileShader(gl.VERTEX_SHADER, vertexSource);
        const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fragmentSource);
        
        if (!vertexShader || !fragmentShader) return null;
        
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Program link error:', gl.getProgramInfoLog(program));
            return null;
        }
        
        return program;
    }
    
    compileShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader compile error:', gl.getShaderInfoLog(shader));
            console.error('Source:', source);
            gl.deleteShader(shader);
            return null;
        }
        
        return shader;
    }
    
    createSimpleLineProgram() {
        const vertexShader = `#version 300 es
        precision highp float;
        
        in vec2 a_position;
        uniform mat3 u_matrix;
        
        void main() {
            vec3 transformed = u_matrix * vec3(a_position, 1.0);
            gl_Position = vec4(transformed.xy, 0.0, 1.0);
        }`;
        
        const fragmentShader = `#version 300 es
        precision highp float;
        
        uniform vec4 u_color;
        out vec4 outColor;
        
        void main() {
            outColor = u_color;
        }`;
        
        return this.createProgram(vertexShader, fragmentShader);
    }
    
    createParchmentBuffer() {
        const gl = this.gl;
        
        // Full-screen quad
        const positions = new Float32Array([
            -1, -1,
             1, -1,
            -1,  1,
            -1,  1,
             1, -1,
             1,  1
        ]);
        
        this.parchmentBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.parchmentBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    }
    
    resize() {
        const displayWidth = this.canvas.clientWidth;
        const displayHeight = this.canvas.clientHeight;
        
        if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
            this.canvas.width = displayWidth;
            this.canvas.height = displayHeight;
            this.gl.viewport(0, 0, displayWidth, displayHeight);
        }
    }
    
    createTransformMatrix() {
        const w = this.canvas.width;
        const h = this.canvas.height;
        const z = this.transform.zoom;
        const x = this.transform.x;
        const y = this.transform.y;
        
        // Orthographic projection matrix
        const scaleX = 2.0 / w * z;
        const scaleY = 2.0 / h * z;
        
        return new Float32Array([
            scaleX, 0, 0,
            0, scaleY, 0,
            x * scaleX, y * scaleY, 1
        ]);
    }
    
    clear() {
        const gl = this.gl;
        gl.clearColor(0.953, 0.914, 0.824, 1.0); // Parchment color
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }
    
    renderParchment() {
        const gl = this.gl;
        
        gl.useProgram(this.parchmentProgram);
        
        // Set uniforms
        const timeLocation = gl.getUniformLocation(this.parchmentProgram, 'u_time');
        const roughnessLocation = gl.getUniformLocation(this.parchmentProgram, 'u_paperRoughness');
        
        gl.uniform1f(timeLocation, (Date.now() - this.startTime) * 0.001);
        gl.uniform1f(roughnessLocation, this.settings.paperRoughness);
        
        // Bind buffer
        const positionLocation = gl.getAttribLocation(this.parchmentProgram, 'a_position');
        gl.bindBuffer(gl.ARRAY_BUFFER, this.parchmentBuffer);
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
        
        // Draw
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    
    rebuildBuffer(entities, currentYear) {
        const gl = this.gl;
        const vertices = [];
        
        // Calculate global valid range for this buffer
        let validStart = -Infinity;
        let validEnd = Infinity;

        // Convert entities to vertex data
        for (const entity of entities) {
            // Find active keyframes
            if (entity.timeline.length === 0) continue;

            let prev = null, next = null;
            let pIndex = -1;

            for (let i = 0; i < entity.timeline.length; i++) {
                const frame = entity.timeline[i];
                if (frame.year <= currentYear) {
                    prev = frame;
                    pIndex = i;
                }
                if (frame.year >= currentYear && !next) {
                    next = frame;
                }
            }

            if (!prev && !next) continue;
            if (!prev) prev = next;
            if (!next) next = prev;

            // Determine the validity of this segment
            let entityStart, entityEnd;

            if (prev !== next) {
                // Between keyframes
                entityStart = prev.year;
                entityEnd = next.year;
            } else {
                // On or outside keyframes (clamped)
                if (currentYear < prev.year) {
                    entityStart = -Infinity;
                    entityEnd = prev.year;
                } else if (currentYear > prev.year) {
                    entityStart = prev.year;
                    entityEnd = Infinity;
                } else {
                    // Exact match
                    entityStart = prev.year;
                    entityEnd = prev.year;
                }
            }

            validStart = Math.max(validStart, entityStart);
            validEnd = Math.min(validEnd, entityEnd);

            // Prepare geometry
            let startGeo = prev.geometry;
            let endGeo = next.geometry;

            const isLineType = entity.type === 'river' ||
                             entity.typology === 'river' ||
                             entity.typology === 'coast';
            const isClosed = !isLineType;

            // Align geometries
            if (startGeo.length !== endGeo.length) {
                startGeo = resampleGeometry(startGeo, CONFIG.RESAMPLE_COUNT, isClosed);
                endGeo = resampleGeometry(endGeo, CONFIG.RESAMPLE_COUNT, isClosed);
            }

            if (!isLineType) {
                endGeo = alignPolygonClosed(startGeo, endGeo);
            } else {
                endGeo = alignPolylineOpen(startGeo, endGeo);
            }

            // Pre-calculate centroids for alignment (similar to Entity.js but we apply it to vertices)
            // Wait, Entity.js morphs by interpolating centroid AND offset.
            // Linear interpolation of points `mix(p1, p2, t)` IS mathematically equivalent
            // to `mix(c1+off1, c2+off2, t)` IF points correspond.
            // The alignment ensures points correspond.
            // So we don't need explicit centroid logic here if startGeo and endGeo are aligned.
            
            // Parse color
            const color = this.hexToRgb(entity.color);
            
            // Triangulate
            if (startGeo.length >= 3) {
                 for (let i = 1; i < startGeo.length - 1; i++) {
                    this.addVertex(vertices,
                        startGeo[0], endGeo[0],
                        startGeo[i], endGeo[i],
                        startGeo[i+1], endGeo[i+1],
                        color,
                        entity.validRange.start,
                        prev.year, next.year
                    );
                 }
            }
        }
        
        // Handle case where validStart/End are still default
        if (validStart === -Infinity) validStart = currentYear; // No constraints?
        if (validEnd === Infinity) validEnd = currentYear;

        // Ensure buffer range is reasonable
        // If we found NO entities, vertices is empty.
        
        // Upload to GPU
        if (!this.geometryBuffer) {
            this.geometryBuffer = gl.createBuffer();
        }
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.geometryBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);
        
        // Update cache state
        this.lastRenderState.validRange = { start: validStart, end: validEnd };
        this.lastRenderState.entities = entities; // Store reference
        this.lastRenderState.vertexCount = vertices.length / 12; // 12 floats per vertex

        return this.lastRenderState.vertexCount;
    }

    addVertex(vertices, p1Start, p1End, p2Start, p2End, p3Start, p3End, color, validStart, yearStart, yearEnd) {
        // Triangle 1
        this.pushVertex(vertices, p1Start, p1End, color, validStart, yearStart, yearEnd);
        this.pushVertex(vertices, p2Start, p2End, color, validStart, yearStart, yearEnd);
        this.pushVertex(vertices, p3Start, p3End, color, validStart, yearStart, yearEnd);
    }
    
    pushVertex(vertices, pStart, pEnd, color, validStart, yearStart, yearEnd) {
        vertices.push(
            pStart.x, pStart.y,     // a_position (Start)
            pEnd.x, pEnd.y,         // a_nextPosition (End)
            pStart.x, pStart.y,     // a_texCoord
            color[0], color[1], color[2], // a_color
            validStart,             // a_validStart
            yearStart,              // a_yearStart
            yearEnd                 // a_yearEnd
        );
    }
    
    hexToRgb(hex) {
        const r = parseInt(hex.substr(1, 2), 16) / 255;
        const g = parseInt(hex.substr(3, 2), 16) / 255;
        const b = parseInt(hex.substr(5, 2), 16) / 255;
        return [r, g, b];
    }
    
    /**
     * Render draft lines (when drawing)
     */
    renderDraft(draftPoints, draftCursor) {
        if (!draftPoints || draftPoints.length === 0) return;
        
        const gl = this.gl;
        const points = [...draftPoints];
        if (draftCursor) {
            points.push(draftCursor);
        }
        
        if (points.length < 2) return;
        
        // Create line vertices
        const vertices = [];
        for (const point of points) {
            vertices.push(point.x, point.y);
        }
        
        // Upload to GPU
        if (!this.lineBuffer) {
            this.lineBuffer = gl.createBuffer();
        }
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);
        
        // Use line program
        gl.useProgram(this.lineProgram);
        
        // Set uniforms
        const matrixLocation = gl.getUniformLocation(this.lineProgram, 'u_matrix');
        const colorLocation = gl.getUniformLocation(this.lineProgram, 'u_color');
        
        gl.uniformMatrix3fv(matrixLocation, false, this.createTransformMatrix());
        gl.uniform4f(colorLocation, 0.541, 0.2, 0.141, 1.0); // Rubric red
        
        // Set vertex attributes
        const positionLocation = gl.getAttribLocation(this.lineProgram, 'a_position');
        gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuffer);
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
        
        // Draw line strip
        gl.lineWidth(2.0);
        gl.drawArrays(gl.LINE_STRIP, 0, points.length);
        
        // Draw vertices as points
        for (let i = 0; i < draftPoints.length; i++) {
            const point = draftPoints[i];
            this.renderPoint(point.x, point.y, 5, [0.541, 0.2, 0.141, 1.0]);
        }
    }
    
    /**
     * Render a single point
     */
    renderPoint(x, y, size, color) {
        const gl = this.gl;
        
        // Create small quad
        const s = size / this.transform.zoom;
        const vertices = new Float32Array([
            x - s, y - s,
            x + s, y - s,
            x - s, y + s,
            x - s, y + s,
            x + s, y - s,
            x + s, y + s
        ]);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
        
        gl.useProgram(this.lineProgram);
        
        const matrixLocation = gl.getUniformLocation(this.lineProgram, 'u_matrix');
        const colorLocation = gl.getUniformLocation(this.lineProgram, 'u_color');
        
        gl.uniformMatrix3fv(matrixLocation, false, this.createTransformMatrix());
        gl.uniform4f(colorLocation, color[0], color[1], color[2], color[3]);
        
        const positionLocation = gl.getAttribLocation(this.lineProgram, 'a_position');
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
        
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    
    render(entities, currentYear, draftPoints = null, draftCursor = null) {
        const gl = this.gl;
        
        this.clear();
        this.renderParchment();
        
        // Check if we need to rebuild geometry buffer
        // Rebuild if:
        // 1. Entities list reference changed (new entities)
        // 2. Current year is outside the valid range of the current buffer
        // 3. Buffer is empty (first run)

        // Note: checking entities reference is fast, but if content of entities changed (e.g. keyframe added),
        // the reference might be same. Ideally we need a dirty flag.
        // For now assuming immutable entities list or reference change on update.
        // If an entity is modified, the caller should probably pass a new array or we need a version.

        // To be safe, if we don't have a versioning system, we might miss updates if only inner properties change.
        // But the task assumes optimization of the render loop where entities are mostly static.

        const needsRebuild =
            this.lastRenderState.entities !== entities ||
            currentYear < this.lastRenderState.validRange.start ||
            currentYear > this.lastRenderState.validRange.end ||
            !this.geometryBuffer;

        let vertexCount = this.lastRenderState.vertexCount;

        if (needsRebuild) {
             vertexCount = this.rebuildBuffer(entities, currentYear);
        }
        
        if (vertexCount > 0) {
            // Use main program
            gl.useProgram(this.mainProgram);
            
            // Set uniforms
            const matrixLocation = gl.getUniformLocation(this.mainProgram, 'u_matrix');
            const yearLocation = gl.getUniformLocation(this.mainProgram, 'u_currentYear');
            const wobbleLocation = gl.getUniformLocation(this.mainProgram, 'u_wobble');
            const timeLocation = gl.getUniformLocation(this.mainProgram, 'u_time');
            const bleedLocation = gl.getUniformLocation(this.mainProgram, 'u_inkBleed');
            const paperLocation = gl.getUniformLocation(this.mainProgram, 'u_paperRough');
            
            gl.uniformMatrix3fv(matrixLocation, false, this.createTransformMatrix());
            gl.uniform1f(yearLocation, currentYear);
            gl.uniform1f(wobbleLocation, this.settings.wobble);
            gl.uniform1f(timeLocation, (Date.now() - this.startTime) * 0.001);
            gl.uniform1f(bleedLocation, this.settings.inkBleed);
            gl.uniform1f(paperLocation, this.settings.paperRoughness);
            
            // Set vertex attributes
            const stride = 12 * 4; // 12 floats * 4 bytes
            const positionLocation = gl.getAttribLocation(this.mainProgram, 'a_position');
            const nextPosLocation = gl.getAttribLocation(this.mainProgram, 'a_nextPosition');
            const texCoordLocation = gl.getAttribLocation(this.mainProgram, 'a_texCoord');
            const colorLocation = gl.getAttribLocation(this.mainProgram, 'a_color');
            const validStartLocation = gl.getAttribLocation(this.mainProgram, 'a_validStart');
            const yearStartLocation = gl.getAttribLocation(this.mainProgram, 'a_yearStart');
            const yearEndLocation = gl.getAttribLocation(this.mainProgram, 'a_yearEnd');
            
            gl.bindBuffer(gl.ARRAY_BUFFER, this.geometryBuffer);
            
            gl.enableVertexAttribArray(positionLocation);
            gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, stride, 0);
            
            gl.enableVertexAttribArray(nextPosLocation);
            gl.vertexAttribPointer(nextPosLocation, 2, gl.FLOAT, false, stride, 8);

            gl.enableVertexAttribArray(texCoordLocation);
            gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, stride, 16);
            
            gl.enableVertexAttribArray(colorLocation);
            gl.vertexAttribPointer(colorLocation, 3, gl.FLOAT, false, stride, 24);

            gl.enableVertexAttribArray(validStartLocation);
            gl.vertexAttribPointer(validStartLocation, 1, gl.FLOAT, false, stride, 36);

            gl.enableVertexAttribArray(yearStartLocation);
            gl.vertexAttribPointer(yearStartLocation, 1, gl.FLOAT, false, stride, 40);
            
            gl.enableVertexAttribArray(yearEndLocation);
            gl.vertexAttribPointer(yearEndLocation, 1, gl.FLOAT, false, stride, 44);
            
            // Draw
            gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
        }
        
        // Render draft
        if (draftPoints && draftPoints.length > 0) {
            this.renderDraft(draftPoints, draftCursor);
        }
    }
    
    pan(dx, dy) {
        this.transform.x += dx;
        this.transform.y += dy;
    }
    
    zoom(scale, centerX, centerY) {
        const oldZoom = this.transform.zoom;
        this.transform.zoom = Math.max(
            CONFIG.MIN_ZOOM,
            Math.min(CONFIG.MAX_ZOOM, this.transform.zoom * scale)
        );
        
        // Zoom towards cursor
        if (centerX !== undefined && centerY !== undefined) {
            const newZoom = this.transform.zoom;
            this.transform.x = centerX - (centerX - this.transform.x) * (newZoom / oldZoom);
            this.transform.y = centerY - (centerY - this.transform.y) * (newZoom / oldZoom);
        }
    }
    
    screenToWorld(screenX, screenY) {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        
        return {
            x: (screenX - centerX - this.transform.x) / this.transform.zoom,
            y: (screenY - centerY - this.transform.y) / this.transform.zoom
        };
    }
}
