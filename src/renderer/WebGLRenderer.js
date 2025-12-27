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
import { CONFIG } from '../core/Entity.js';

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
    
    uploadGeometry(entities, currentYear) {
        const gl = this.gl;
        const vertices = [];
        
        // Convert entities to vertex data
        for (const entity of entities) {
            const geometry = entity.getGeometryAtYear(currentYear);
            if (!geometry || geometry.length < 3) continue;
            
            // Parse color
            const color = this.hexToRgb(entity.color);
            
            // Triangulate polygon (simple fan triangulation)
            for (let i = 1; i < geometry.length - 1; i++) {
                // Triangle: p0, pi, pi+1
                this.addVertex(vertices, geometry[0], color, entity.validRange.start);
                this.addVertex(vertices, geometry[i], color, entity.validRange.start);
                this.addVertex(vertices, geometry[i + 1], color, entity.validRange.start);
            }
        }
        
        if (vertices.length === 0) return 0;
        
        // Upload to GPU
        if (!this.geometryBuffer) {
            this.geometryBuffer = gl.createBuffer();
        }
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.geometryBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);
        
        return vertices.length / 8; // 8 floats per vertex
    }
    
    addVertex(vertices, point, color, year) {
        vertices.push(
            point.x, point.y,           // position
            point.x, point.y,           // texCoord
            color[0], color[1], color[2], // color
            year                         // year attribute
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
        
        // Upload and render geometry
        const vertexCount = this.uploadGeometry(entities, currentYear);
        
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
            const stride = 8 * 4; // 8 floats * 4 bytes
            const positionLocation = gl.getAttribLocation(this.mainProgram, 'a_position');
            const texCoordLocation = gl.getAttribLocation(this.mainProgram, 'a_texCoord');
            const colorLocation = gl.getAttribLocation(this.mainProgram, 'a_color');
            const yearAttrLocation = gl.getAttribLocation(this.mainProgram, 'a_year');
            
            gl.bindBuffer(gl.ARRAY_BUFFER, this.geometryBuffer);
            
            gl.enableVertexAttribArray(positionLocation);
            gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, stride, 0);
            
            gl.enableVertexAttribArray(texCoordLocation);
            gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, stride, 8);
            
            gl.enableVertexAttribArray(colorLocation);
            gl.vertexAttribPointer(colorLocation, 3, gl.FLOAT, false, stride, 16);
            
            gl.enableVertexAttribArray(yearAttrLocation);
            gl.vertexAttribPointer(yearAttrLocation, 1, gl.FLOAT, false, stride, 28);
            
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
