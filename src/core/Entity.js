import { CONFIG } from '../config.js';
import { resampleGeometry, alignPolygonClosed, alignPolylineOpen, getCentroid, lerp } from './math.js';

export default class HistoricalEntity {
    constructor(id, name, category, type, color, parentId = null, hatchStyle = null) {
        this.id = id;
        this.name = name;
        this.category = category;
        this.type = type;
        this.color = color;
        this.parentId = parentId;
        this.description = "A mapped entity.";
        this.timeline = [];
        this.validRange = { start: -Infinity, end: Infinity };
        this.currentGeometry = null;
        this.visible = true;
        this.hatchStyle = hatchStyle;

        // Default styles based on category if not set
        if (!this.hatchStyle) {
            if (this.category === 'political') this.hatchStyle = 'diagonal-right';
            else if (this.category === 'linguistic') this.hatchStyle = 'cross';
            else if (this.category === 'cultural') this.hatchStyle = 'vertical';
            else if (this.category === 'faith') this.hatchStyle = 'stipple';
            else this.hatchStyle = 'solid';
        }
    }

    addKeyframe(year, geometry, preventResampling = false) {
        this.timeline = this.timeline.filter(k => k.year !== year);
        let finalGeo;
        if (this.type === 'city') {
            finalGeo = geometry;
        } else {
            const isClosed = (this.type !== 'river');
            if (preventResampling) {
                // Deep copy to prevent reference issues, but KEEP exact points
                finalGeo = geometry.map(p => ({ ...p }));
            } else {
                // Standard drawing behavior
                finalGeo = resampleGeometry(geometry, CONFIG.RESAMPLE_COUNT, isClosed);
            }
        }
        this.timeline.push({ year, geometry: finalGeo });
        this.timeline.sort((a, b) => a.year - b.year);
        if (this.timeline.length > 0) {
            this.validRange.start = Math.min(this.timeline[0].year - 100, this.validRange.start);
            this.validRange.end = Math.max(this.timeline[this.timeline.length - 1].year + 100, this.validRange.end);
        }
    }

    getGeometryAtYear(targetYear) {
        if (targetYear < this.validRange.start || targetYear > this.validRange.end || this.timeline.length === 0) return null;
        if (this.timeline.length === 1) return this.timeline[0].geometry;

        let prev = null, next = null;
        for (let frame of this.timeline) {
            if (frame.year <= targetYear) prev = frame;
            if (frame.year >= targetYear && !next) next = frame;
        }

        if (!prev) return next.geometry;
        if (!next) return prev.geometry;
        if (prev === next) return prev.geometry;

        let startGeo = prev.geometry;
        let endGeo = next.geometry;

        // --- SMART MORPHING ---
        if (startGeo.length !== endGeo.length) {
            const isClosed = (this.type !== 'river');
            startGeo = resampleGeometry(startGeo, CONFIG.RESAMPLE_COUNT, isClosed);
            endGeo = resampleGeometry(endGeo, CONFIG.RESAMPLE_COUNT, isClosed);
        }

        if (this.type !== 'river') {
            endGeo = alignPolygonClosed(startGeo, endGeo);
        } else {
            endGeo = alignPolylineOpen(startGeo, endGeo);
        }

        const t = (targetYear - prev.year) / (next.year - prev.year);
        const morphed = [];
        const count = startGeo.length;
        const c1 = getCentroid(startGeo);
        const c2 = getCentroid(endGeo);
        const curC = { x: lerp(c1.x, c2.x, t), y: lerp(c1.y, c2.y, t) };

        for (let i = 0; i < count; i++) {
            const off1 = { x: startGeo[i].x - c1.x, y: startGeo[i].y - c1.y };
            const off2 = { x: endGeo[i].x - c2.x, y: endGeo[i].y - c2.y };
            const curOffX = lerp(off1.x, off2.x, t);
            const curOffY = lerp(off1.y, off2.y, t);
            morphed.push({ x: curC.x + curOffX, y: curC.y + curOffY });
        }
        return morphed;
    }

    static fromJSON(data) {
        const ent = new HistoricalEntity(data.id, data.name, data.category, data.type, data.color, data.parentId, data.hatchStyle);
        Object.assign(ent, data);
        return ent;
    }
}
