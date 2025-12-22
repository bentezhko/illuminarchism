<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Illuminarchism | The Living Atlas</title>
    
    <!-- Google Fonts for Medieval Aesthetic -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=IM+Fell+English:ital@0;1&display=swap" rel="stylesheet">

    <style>
        :root {
            /* Palette: Medieval Manuscript */
            --parchment-bg: #f3e9d2;
            --parchment-dark: #e0d0b0;
            --ink-primary: #2b2118;
            --ink-faded: #5c4d3c;
            --rubric-red: #8a3324; /* For highlighting headers/capitals */
            --gold-leaf: #c5a059;  /* For borders/accents */
            --lapis-lazuli: #264e86; /* For royal regions */
            
            --ui-shadow: 0 4px 6px rgba(43, 33, 24, 0.2);
            --border-width: 2px;
        }

        * {
            box-sizing: border-box;
            user-select: none; /* Prevent selection while panning map */
        }

        body, html {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
            background-color: var(--parchment-bg);
            font-family: 'IM Fell English', serif;
            color: var(--ink-primary);
        }

        /* --- UI Overlay Layer --- */
        #ui-layer {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none; /* Let clicks pass through to canvas */
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            z-index: 10;
        }

        .pointer-events-auto {
            pointer-events: auto;
        }

        /* Header / Title Block */
        header {
            padding: 1rem 2rem;
            background: linear-gradient(to bottom, var(--parchment-bg) 80%, transparent);
            border-bottom: 1px solid var(--gold-leaf);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        h1 {
            font-family: 'Cinzel', serif;
            font-weight: 700;
            margin: 0;
            font-size: 2rem;
            color: var(--ink-primary);
            text-shadow: 1px 1px 0px var(--parchment-dark);
            letter-spacing: 2px;
        }

        h1 span {
            color: var(--rubric-red);
        }

        /* Toolbar (Left) */
        #toolbar {
            position: absolute;
            left: 1rem;
            top: 50%;
            transform: translateY(-50%);
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            background: rgba(243, 233, 210, 0.95);
            padding: 0.5rem;
            border: var(--border-width) solid var(--ink-primary);
            border-radius: 4px;
            box-shadow: var(--ui-shadow);
        }

        .tool-btn {
            width: 44px;
            height: 44px;
            background: var(--parchment-dark);
            border: 1px solid var(--ink-faded);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: 'Cinzel', serif;
            font-weight: bold;
            transition: all 0.2s ease;
            font-size: 1.4rem;
            color: var(--ink-primary);
            position: relative;
        }

        .tool-btn:hover {
            background: var(--gold-leaf);
            color: white;
            border-color: var(--ink-primary);
        }

        .tool-btn.active {
            background: var(--rubric-red);
            color: white;
            border-color: var(--ink-primary);
            box-shadow: inset 2px 2px 4px rgba(0,0,0,0.4);
        }
        
        /* Tooltip hack */
        .tool-btn:hover::after {
            content: attr(title);
            position: absolute;
            left: 110%;
            top: 50%;
            transform: translateY(-50%);
            background: var(--ink-primary);
            color: var(--parchment-bg);
            padding: 0.25rem 0.5rem;
            font-size: 0.8rem;
            font-family: 'IM Fell English', serif;
            white-space: nowrap;
            border-radius: 2px;
            pointer-events: none;
            opacity: 1;
        }

        /* Temporal Controls (Bottom) */
        #temporal-controls {
            width: 100%;
            padding: 1rem 2rem;
            background: linear-gradient(to top, var(--parchment-bg) 80%, transparent);
            border-top: 1px solid var(--gold-leaf);
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0.5rem;
        }

        #year-display {
            font-family: 'Cinzel', serif;
            font-size: 2rem;
            font-weight: bold;
            color: var(--rubric-red);
        }

        /* Custom Range Slider */
        input[type=range] {
            -webkit-appearance: none;
            width: 80%;
            max-width: 800px;
            background: transparent;
        }

        input[type=range]::-webkit-slider-thumb {
            -webkit-appearance: none;
            height: 24px;
            width: 24px;
            border-radius: 50%;
            background: var(--rubric-red);
            border: 2px solid var(--ink-primary);
            cursor: pointer;
            margin-top: -10px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        }

        input[type=range]::-webkit-slider-runnable-track {
            width: 100%;
            height: 4px;
            cursor: pointer;
            background: var(--ink-faded);
            border-radius: 2px;
        }

        /* Info Panel (Right - New) */
        #info-panel {
            position: absolute;
            right: 1rem;
            top: 6rem;
            width: 280px;
            background: rgba(243, 233, 210, 0.95);
            border: var(--border-width) solid var(--ink-primary);
            padding: 1rem;
            box-shadow: var(--ui-shadow);
            display: none; /* Hidden by default */
        }
        
        #info-panel h2 {
            font-family: 'Cinzel', serif;
            font-size: 1.4rem;
            margin-top: 0;
            border-bottom: 1px solid var(--ink-faded);
            padding-bottom: 0.5rem;
            color: var(--rubric-red);
        }

        /* --- Canvas Layer --- */
        #map-canvas {
            position: absolute;
            top: 0;
            left: 0;
            z-index: 1;
            cursor: grab;
        }

        #map-canvas:active {
            cursor: grabbing;
        }

        /* Utility classes */
        .debug-info {
            position: absolute;
            bottom: 1rem;
            right: 1rem;
            font-size: 0.7rem;
            color: var(--ink-faded);
            background: rgba(255,255,255,0.3);
            padding: 0.2rem 0.5rem;
            border-radius: 4px;
        }

    </style>
</head>
<body>

    <div id="ui-layer">
        <header class="pointer-events-auto">
            <h1>Illumin<span>archism</span></h1>
            <div style="font-size: 0.9rem; font-style: italic;">
                Proprietary Medieval Cartographic Engine v0.3
            </div>
        </header>

        <div id="toolbar" class="pointer-events-auto">
            <button class="tool-btn active" data-tool="pan" title="Pan Hand">✋</button>
            <button class="tool-btn" data-tool="inspect" title="Inspect Region">🔍</button>
            <button class="tool-btn" data-tool="draw" title="Quill (Draw)">✎</button>
            <button class="tool-btn" data-tool="erase" title="Scrape (Erase)">⌫</button>
        </div>

        <div id="info-panel" class="pointer-events-auto">
            <h2 id="info-title">Region Name</h2>
            <p id="info-desc">Historical description goes here.</p>
            <div style="font-size: 0.8rem; color: var(--ink-faded); border-top: 1px solid rgba(0,0,0,0.1); padding-top: 0.5rem;">
                <strong>Established:</strong> <span id="info-start"></span><br>
                <strong>Dissolved:</strong> <span id="info-end"></span>
            </div>
        </div>

        <div id="temporal-controls" class="pointer-events-auto">
            <div id="year-display">1000 AD</div>
            <!-- Range: 800 to 1300 for this demo -->
            <input type="range" id="time-slider" min="800" max="1300" value="1000" step="1">
            <div style="font-size: 0.8rem; color: var(--ink-faded);">Drag the timeline to shift the borders</div>
        </div>
        
        <div class="debug-info pointer-events-auto">
            Render: Canvas 2D | Mode: Interactive | Entities: Loading...
        </div>
    </div>

    <canvas id="map-canvas"></canvas>

    <script>
        /**
         * ILLUMINARCHISM ENGINE v0.3
         * * Core Features:
         * 1. Vector Morphing: Linear interpolation between historical keyframes.
         * 2. Procedural Rendering: Ink simulation and parchment texture.
         * 3. Entity Component System: Data driven regions.
         * 4. Interaction: Tool state management (Pan/Inspect/Draw).
         */

        // --- 1. Configuration & Utils ---
        const CONFIG = {
            ZOOM_SENSITIVITY: 0.001,
            MIN_ZOOM: 0.1,
            MAX_ZOOM: 5,
            BACKGROUND_COLOR: '#f3e9d2',
            INK_JITTER: 1.5, // How "wobbly" the lines are
            DEBUG: true
        };

        // Linear Interpolation
        const lerp = (start, end, t) => start * (1 - t) + end * t;

        // Point in Polygon (Ray Casting algorithm)
        function isPointInPolygon(point, vs) {
            // point = {x, y}, vs = array of points [{x, y}, ...]
            let x = point.x, y = point.y;
            let inside = false;
            for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
                let xi = vs[i].x, yi = vs[i].y;
                let xj = vs[j].x, yj = vs[j].y;
                
                let intersect = ((yi > y) !== (yj > y)) &&
                    (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
                if (intersect) inside = !inside;
            }
            return inside;
        }

        // --- 2. Data Structures ---

        class HistoricalEntity {
            constructor(id, name, type, color) {
                this.id = id;
                this.name = name;
                this.type = type; // 'polity', 'river', 'city'
                this.color = color;
                this.description = "A distinct historical region.";
                
                // Timeline: Array of Keyframes
                // { year: 1000, geometry: [{x,y}, ...] }
                this.timeline = []; 
                this.validRange = { start: -Infinity, end: Infinity };
                this.currentGeometry = null;
            }

            addKeyframe(year, geometry) {
                this.timeline.push({ year, geometry });
                this.timeline.sort((a, b) => a.year - b.year);
                // Update range based on data
                this.validRange.start = Math.min(this.validRange.start, year);
                this.validRange.end = Math.max(this.validRange.end, year);
            }

            // The core "Running Reality" logic
            getGeometryAtYear(targetYear) {
                // 1. Check existence
                if (targetYear < this.validRange.start || targetYear > this.validRange.end) {
                    return null; // Entity doesn't exist
                }

                // 2. Find surrounding keyframes
                let prev = null, next = null;
                for (let frame of this.timeline) {
                    if (frame.year <= targetYear) prev = frame;
                    if (frame.year >= targetYear && !next) next = frame;
                }

                if (!prev) return next.geometry;
                if (!next) return prev.geometry;
                if (prev === next) return prev.geometry;

                // 3. Interpolate (Morph)
                // Note: This requires congruent topology (same # of points). 
                // Advanced versions would use Ear Clipping if counts differ.
                const t = (targetYear - prev.year) / (next.year - prev.year);
                const morphedPoly = [];
                
                const count = Math.min(prev.geometry.length, next.geometry.length);
                for(let i = 0; i < count; i++) {
                    morphedPoly.push({
                        x: lerp(prev.geometry[i].x, next.geometry[i].x, t),
                        y: lerp(prev.geometry[i].y, next.geometry[i].y, t)
                    });
                }
                return morphedPoly;
            }
        }

        // --- 3. The Renderer (The "Illuminator") ---
        class MedievalRenderer {
            constructor(canvasId) {
                this.canvas = document.getElementById(canvasId);
                this.ctx = this.canvas.getContext('2d'); 
                this.width = window.innerWidth;
                this.height = window.innerHeight;
                
                // Coordinate System
                this.transform = { x: this.width/2, y: this.height/2, k: 1 };
                
                // Texture cache
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
                this.createParchmentTexture(); // Recreate pattern
                // Trigger render via app if available
                if(window.illuminarchismApp) window.illuminarchismApp.render();
            }

            createParchmentTexture() {
                // Procedural noise for that "old paper" feel
                const size = 256;
                const canvas = document.createElement('canvas');
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d');
                
                ctx.fillStyle = CONFIG.BACKGROUND_COLOR;
                ctx.fillRect(0,0,size,size);
                
                // Add noise
                const imageData = ctx.getImageData(0,0,size,size);
                const data = imageData.data;
                for(let i=0; i < data.length; i+=4) {
                    const noise = (Math.random() - 0.5) * 20;
                    data[i] = Math.min(255, Math.max(0, data[i] + noise));
                    data[i+1] = Math.min(255, Math.max(0, data[i+1] + noise));
                    data[i+2] = Math.min(255, Math.max(0, data[i+2] + noise));
                }
                ctx.putImageData(imageData, 0, 0);
                this.noisePattern = this.ctx.createPattern(canvas, 'repeat');
            }

            toWorld(screenX, screenY) {
                return {
                    x: (screenX - this.transform.x) / this.transform.k,
                    y: (screenY - this.transform.y) / this.transform.k
                };
            }

            clear() {
                // Use the procedural texture instead of flat color
                this.ctx.fillStyle = this.noisePattern || CONFIG.BACKGROUND_COLOR;
                this.ctx.fillRect(0, 0, this.width, this.height);
            }

            draw(entities, hoveredEntityId, activeTool) {
                this.clear();
                const ctx = this.ctx;
                const t = this.transform;

                ctx.save();
                ctx.translate(t.x, t.y);
                ctx.scale(t.k, t.k);

                // Draw Grid (faint)
                this.drawGrid();

                // Draw Entities
                entities.forEach(ent => {
                    if (!ent.currentGeometry) return;

                    const isHovered = ent.id === hoveredEntityId;
                    
                    // Fill
                    ctx.beginPath();
                    this.tracePath(ent.currentGeometry);
                    ctx.closePath();
                    
                    if (isHovered && activeTool === 'inspect') {
                        ctx.fillStyle = this.hexToRgba(ent.color, 0.5); // Stronger Highlight
                        ctx.shadowColor = ent.color;
                        ctx.shadowBlur = 15;
                    } else {
                        ctx.fillStyle = this.hexToRgba(ent.color, 0.2); // Normal
                        ctx.shadowBlur = 0;
                    }
                    ctx.fill();

                    // Stroke (Ink Style)
                    ctx.strokeStyle = '#2b2118';
                    ctx.lineWidth = isHovered ? 3 / t.k : 1.5 / t.k; 
                    
                    ctx.lineJoin = 'round';
                    ctx.lineCap = 'round';
                    ctx.stroke();

                    // Label
                    if (t.k > 0.5) { 
                        this.drawLabel(ent);
                    }
                });

                ctx.restore();
            }

            tracePath(points) {
                if (points.length === 0) return;
                this.ctx.moveTo(points[0].x, points[0].y);
                for (let i = 1; i < points.length; i++) {
                    this.ctx.lineTo(points[i].x, points[i].y);
                }
            }

            drawLabel(entity) {
                let sx = 0, sy = 0;
                entity.currentGeometry.forEach(p => { sx += p.x; sy += p.y; });
                const cx = sx / entity.currentGeometry.length;
                const cy = sy / entity.currentGeometry.length;

                this.ctx.fillStyle = '#8a3324'; // Rubric Red
                this.ctx.font = '14px "Cinzel"';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(entity.name, cx, cy);
            }

            drawGrid() {
                const ctx = this.ctx;
                const gridSize = 100;
                const count = 30; // Render range

                ctx.beginPath();
                ctx.strokeStyle = 'rgba(138, 51, 36, 0.05)';
                ctx.lineWidth = 1 / this.transform.k; // Keep hairlines thin

                for(let i = -count; i <= count; i++) {
                    ctx.moveTo(i * gridSize, -count * gridSize);
                    ctx.lineTo(i * gridSize, count * gridSize);
                    ctx.moveTo(-count * gridSize, i * gridSize);
                    ctx.lineTo(count * gridSize, i * gridSize);
                }
                ctx.stroke();
            }

            hexToRgba(hex, alpha) {
                const r = parseInt(hex.slice(1, 3), 16);
                const g = parseInt(hex.slice(3, 5), 16);
                const b = parseInt(hex.slice(5, 7), 16);
                return `rgba(${r}, ${g}, ${b}, ${alpha})`;
            }
        }

        // --- 4. Input & Interaction ---
        class InputController {
            constructor(app) {
                this.app = app;
                this.renderer = app.renderer;
                this.isDragging = false;
                this.lastX = 0;
                this.lastY = 0;
                this.hoverThrottle = 0;

                this.initListeners();
            }

            initListeners() {
                const canvas = this.renderer.canvas;

                // Zoom
                canvas.addEventListener('wheel', (e) => {
                    e.preventDefault();
                    const delta = -Math.sign(e.deltaY);
                    const scaleMult = 1 + (delta * 0.1);
                    const t = this.renderer.transform;
                    
                    const mouseX = e.offsetX;
                    const mouseY = e.offsetY;
                    const worldPos = this.renderer.toWorld(mouseX, mouseY);

                    t.k *= scaleMult;
                    t.k = Math.max(CONFIG.MIN_ZOOM, Math.min(CONFIG.MAX_ZOOM, t.k));

                    t.x = mouseX - (worldPos.x * t.k);
                    t.y = mouseY - (worldPos.y * t.k);

                    this.app.render();
                });

                // Mouse Down
                canvas.addEventListener('mousedown', (e) => {
                    this.isDragging = true;
                    this.lastX = e.clientX;
                    this.lastY = e.clientY;
                    
                    // Interaction depends on active tool
                    if (this.app.activeTool === 'pan') {
                        canvas.style.cursor = 'grabbing';
                    } else if (this.app.activeTool === 'inspect' && this.app.hoveredEntityId) {
                        this.app.selectEntity(this.app.hoveredEntityId);
                    }
                    
                    this.app.closeInfoPanel();
                });

                // Mouse Move (Pan & Hover)
                window.addEventListener('mousemove', (e) => {
                    // Pan Logic
                    if (this.isDragging && this.app.activeTool === 'pan') {
                        const dx = e.clientX - this.lastX;
                        const dy = e.clientY - this.lastY;
                        this.lastX = e.clientX;
                        this.lastY = e.clientY;
                        this.renderer.transform.x += dx;
                        this.renderer.transform.y += dy;
                        this.app.render();
                        return;
                    }

                    // Hover Logic (Only for Inspect Tool)
                    if (this.app.activeTool === 'inspect') {
                        const now = Date.now();
                        if (now - this.hoverThrottle > 30) {
                            this.hoverThrottle = now;
                            const worldPos = this.renderer.toWorld(e.offsetX, e.offsetY);
                            this.app.checkHover(worldPos);
                        }
                    }
                });

                // Mouse Up
                window.addEventListener('mouseup', () => {
                    this.isDragging = false;
                    if(this.app.activeTool === 'pan') {
                        canvas.style.cursor = 'grab';
                    }
                });
            }
        }

        // --- 5. Main Application Logic ---
        class IlluminarchismApp {
            constructor() {
                this.renderer = new MedievalRenderer('map-canvas');
                this.input = new InputController(this);
                
                this.entities = [];
                this.hoveredEntityId = null;
                this.selectedEntityId = null;
                this.currentYear = 1000;
                
                // State: 'pan', 'inspect', 'draw', 'erase'
                this.activeTool = 'pan'; 

                this.initData();
                this.initUI();
                this.updateEntities();
                this.render();
            }

            initData() {
                // -- Mock Historical Data --
                const blueKingdom = new HistoricalEntity('blue_kg', 'Regnum Caeruleum', 'polity', '#264e86');
                blueKingdom.addKeyframe(800, [
                    {x: -100, y: -100}, {x: 100, y: -100}, {x: 100, y: 100}, {x: -100, y: 100}
                ]);
                blueKingdom.addKeyframe(1200, [
                    {x: -200, y: -150}, {x: 250, y: -120}, {x: 200, y: 200}, {x: -180, y: 180}
                ]);
                blueKingdom.addKeyframe(1300, [
                    {x: -50, y: -50}, {x: 50, y: -50}, {x: 50, y: 50}, {x: -50, y: 50}
                ]);
                blueKingdom.description = "An ancient maritime power known for its deep blue dyes. Its borders expanded aggressively during the Middle Period.";
                this.entities.push(blueKingdom);

                const goldDuchy = new HistoricalEntity('gold_du', 'Ducatus Aureus', 'polity', '#c5a059');
                goldDuchy.addKeyframe(900, [
                    {x: -300, y: -50}, {x: -200, y: -50}, {x: -200, y: 50}, {x: -300, y: 50}
                ]);
                goldDuchy.addKeyframe(1100, [
                    {x: 300, y: -50}, {x: 400, y: -50}, {x: 400, y: 50}, {x: 300, y: 50}
                ]);
                goldDuchy.description = "A migratory merchant republic constantly seeking new markets. Note the complete relocation between 900 and 1100 AD.";
                this.entities.push(goldDuchy);
            }

            initUI() {
                const slider = document.getElementById('time-slider');
                const display = document.getElementById('year-display');

                slider.addEventListener('input', (e) => {
                    this.currentYear = parseInt(e.target.value);
                    display.textContent = `${this.currentYear} AD`;
                    this.updateEntities();
                    this.render();
                });

                // Tool Switching Logic
                const tools = document.querySelectorAll('.tool-btn');
                tools.forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        // Reset all
                        tools.forEach(t => t.classList.remove('active'));
                        // Set active
                        const target = e.currentTarget; // use currentTarget to handle icon clicks
                        target.classList.add('active');
                        
                        this.setTool(target.dataset.tool);
                    });
                });
            }

            setTool(toolName) {
                this.activeTool = toolName;
                this.hoveredEntityId = null; // Clear hover state on switch
                
                // Cursor Management
                const canvas = this.renderer.canvas;
                switch(toolName) {
                    case 'pan':
                        canvas.style.cursor = 'grab';
                        break;
                    case 'inspect':
                        canvas.style.cursor = 'default';
                        break;
                    case 'draw':
                        canvas.style.cursor = 'crosshair';
                        break;
                    case 'erase':
                        canvas.style.cursor = 'not-allowed';
                        break;
                }
                this.render();
            }

            updateEntities() {
                let activeCount = 0;
                this.entities.forEach(ent => {
                    ent.currentGeometry = ent.getGeometryAtYear(this.currentYear);
                    if (ent.currentGeometry) activeCount++;
                });

                const debugEl = document.querySelector('.debug-info');
                if(debugEl) {
                    debugEl.textContent = `Year: ${this.currentYear} | Tool: ${this.activeTool.toUpperCase()} | Active Polities: ${activeCount}`;
                }
            }

            checkHover(worldPos) {
                let foundId = null;
                
                // Only inspect works for hovering right now
                if (this.activeTool !== 'inspect') return;

                for (let i = this.entities.length - 1; i >= 0; i--) {
                    const ent = this.entities[i];
                    if (!ent.currentGeometry) continue;
                    
                    if (isPointInPolygon(worldPos, ent.currentGeometry)) {
                        foundId = ent.id;
                        break;
                    }
                }

                if (foundId !== this.hoveredEntityId) {
                    this.hoveredEntityId = foundId;
                    // Change cursor if we found something to inspect
                    this.renderer.canvas.style.cursor = foundId ? 'pointer' : 'default';
                    this.render();
                }
            }

            selectEntity(id) {
                this.selectedEntityId = id;
                const ent = this.entities.find(e => e.id === id);
                if (ent) {
                    // Populate Info Panel
                    const p = document.getElementById('info-panel');
                    p.style.display = 'block';
                    document.getElementById('info-title').textContent = ent.name;
                    document.getElementById('info-desc').textContent = ent.description;
                    document.getElementById('info-start').textContent = ent.validRange.start + " AD";
                    document.getElementById('info-end').textContent = ent.validRange.end + " AD";
                }
            }

            closeInfoPanel() {
                document.getElementById('info-panel').style.display = 'none';
                this.selectedEntityId = null;
            }

            render() {
                this.renderer.draw(this.entities, this.hoveredEntityId, this.activeTool);
            }
        }

        // --- Bootstrap ---
        window.onload = () => {
            window.illuminarchismApp = new IlluminarchismApp();
        };

    </script>
</body>
</html>
