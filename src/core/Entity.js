import { CONFIG } from '../config.js';
import { resampleGeometry, alignPolygonClosed, alignPolylineOpen, getCentroid, lerp } from './math.js';
import { DOMAINS, getTypology, migrateFromLegacy, getDomain } from './Ontology.js';

/**
 * HistoricalEntity - Core data model for spatiotemporal atlas entities
 * 
 * Supports the Illuminarchism 3-level taxonomy:
 *   Level 1: Domain (political, linguistic, religious, geographic)
 *   Level 2: Typology (band, tribe, chiefdom, state, empire, etc.)
 *   Level 3: Subtype/Admin level (first-order division, etc.)
 * 
 * Also supports:
 *   - HRAF OCM attribute codes for cultural/economic data
 *   - Boundary confidence for fuzzy pre-modern boundaries
 *   - Bitemporal modeling (valid time + transaction time)
 *   - External references (Getty TGN, Wikidata, etc.)
 */
export default class HistoricalEntity {
    /**
     * Constructor with backward compatibility for legacy format
     * 
     * New format: constructor(id, name, config)
     * Legacy format: constructor(id, name, category, type, color, parentId, hatchStyle)
     */
    constructor(id, name, arg3, arg4, arg5, arg6, arg7) {
        this.id = id;
        this.name = name;

        // Detect if using legacy format (arg3 is a string category) or new format (arg3 is config object)
        if (typeof arg3 === 'string') {
            // Legacy format: category, type, color, parentId, hatchStyle
            this._initLegacy(arg3, arg4, arg5, arg6, arg7);
        } else if (typeof arg3 === 'object' && arg3 !== null) {
            // New format: config object
            this._initFromConfig(arg3);
        } else {
            // Default initialization
            this._initFromConfig({});
        }

        // Common properties
        this.description = this.description || "A mapped entity.";
        this.timeline = this.timeline || [];
        this.currentGeometry = null;
        this.visible = this.visible !== undefined ? this.visible : true;

        // Ensure validRange is set (if not already set by _initFromConfig)
        if (!this.validRange) {
            this.validRange = { start: -Infinity, end: Infinity };
        }

        // Set default hatch style based on domain if not set
        if (!this.hatchStyle) {
            this._setDefaultHatchStyle();
        }
    }

    /**
     * Initialize from legacy category/type format
     */
    _initLegacy(category, type, color, parentId, hatchStyle) {
        // Store legacy properties for backward compatibility
        this.category = category;
        this.type = type;
        this.color = color || '#264e86';
        this.parentId = parentId || null;
        this.hatchStyle = hatchStyle;

        // Migrate to new ontology format
        const migrated = migrateFromLegacy({ category, type });
        this.domain = migrated.domain;
        this.typology = migrated.typology;
        this.subtype = migrated.subtype;
        this.boundaryConfidence = migrated.boundaryConfidence;

        // Initialize new properties with defaults
        this.boundaryType = this._inferBoundaryType();
        this.attributes = {};
        this.externalRefs = {};
        this.validTime = null;
        this.transactionTime = { created: Date.now(), modified: Date.now() };
        this.children = [];
    }

    /**
     * Initialize from new config object format
     */
    _initFromConfig(config) {
        // Level 1: Domain
        this.domain = config.domain || 'political';

        // Level 2: Typology
        this.typology = config.typology || 'nation-state';

        // Level 3: Subtype / Admin level
        this.subtype = config.subtype || null;
        this.adminLevel = config.adminLevel || null;

        // Backward compatibility: derive category/type from domain/typology
        this.category = this._deriveCategoryFromDomain(this.domain);
        this.type = this._deriveTypeFromTypology(this.typology);

        // Styling
        this.color = config.color || '#264e86';
        this.hatchStyle = config.hatchStyle || null;

        // Hierarchy
        this.parentId = config.parentId || null;
        this.children = config.children || [];

        // Boundary properties
        this.boundaryType = config.boundaryType || this._inferBoundaryType();
        this.boundaryConfidence = config.boundaryConfidence !== undefined
            ? config.boundaryConfidence
            : this._getDefaultConfidence();

        // HRAF OCM Attributes
        this.attributes = config.attributes || {};

        // Temporal modeling
        this.validRange = config.validRange || null; // FIXED: Initialize validRange from config
        this.validTime = config.validTime || null; // { start: ISO8601, end: ISO8601 }
        this.transactionTime = config.transactionTime || {
            created: Date.now(),
            modified: Date.now()
        };

        // External references
        this.externalRefs = config.externalRefs || {};
        // e.g., { getty_tgn: "7012155", wikidata: "Q12548", pleiades: "..." }

        // Metadata
        this.description = config.description || null;
        this.visible = config.visible !== undefined ? config.visible : true;
    }

    /**
     * Derive legacy category from domain
     */
    _deriveCategoryFromDomain(domain) {
        const mapping = {
            'political': 'political',
            'linguistic': 'linguistic',
            'religious': 'faith',
            'geographic': 'geographical'
        };
        return mapping[domain] || 'political';
    }

    /**
     * Derive legacy type from typology
     */
    _deriveTypeFromTypology(typology) {
        // Map new typologies to legacy types for rendering compatibility
        const mapping = {
            // Political
            'band': 'polity',
            'tribe': 'polity',
            'chiefdom': 'polity',
            'archaic-state': 'polity',
            'empire': 'polity',
            'nation-state': 'polity',
            'supranational': 'polity',
            'city': 'city',
            'vassal': 'vassal',
            'disputed': 'polity',
            // Linguistic
            'macro-phylum': 'language',
            'family': 'language',
            'branch': 'language',
            'language': 'language',
            'dialect': 'language',
            'sprachbund': 'language',
            'isogloss': 'language',
            'word-isogloss': 'word',
            'sound-isogloss': 'sound',
            // Religious
            'universalizing': 'religion',
            'ethnic': 'religion',
            'syncretic': 'religion',
            'new-religious': 'religion',
            'philosophical': 'religion',
            'tradition': 'religion',
            'denomination': 'sect',
            'sect': 'sect',
            'diaspora': 'diaspora',
            'sacred-site': 'city',
            // Geographic
            'cultivated': 'polity',
            'natural': 'polity',
            'aquatic': 'water',
            'artificial': 'polity',
            'bare': 'polity',
            'river': 'river',
            'mountain': 'polity',
            'coast': 'river',
            'island': 'polity'
        };
        return mapping[typology] || 'polity';
    }

    /**
     * Infer boundary type from typology
     */
    _inferBoundaryType() {
        const typologyInfo = getTypology(this.domain, this.typology);
        if (typologyInfo && typologyInfo.boundaryType) {
            return typologyInfo.boundaryType;
        }
        // Default based on domain
        if (this.domain === 'political') return 'hard';
        if (this.domain === 'linguistic') return 'fuzzy';
        if (this.domain === 'religious') return 'fuzzy';
        if (this.domain === 'geographic') return 'hard';
        return 'hard';
    }

    /**
     * Get default confidence based on boundary type
     */
    _getDefaultConfidence() {
        switch (this.boundaryType) {
            case 'legal': return 1.0;
            case 'hard': return 0.9;
            case 'centric': return 0.7;
            case 'cluster': return 0.6;
            case 'fuzzy': return 0.5;
            default: return 0.8;
        }
    }

    /**
     * Set default hatch style based on domain
     */
    _setDefaultHatchStyle() {
        const domainInfo = getDomain(this.domain);
        if (domainInfo && domainInfo.hatchDefault) {
            this.hatchStyle = domainInfo.hatchDefault;
        } else {
            // Fallback based on category for legacy compatibility
            if (this.category === 'political') this.hatchStyle = 'diagonal-right';
            else if (this.category === 'linguistic') this.hatchStyle = 'cross';
            else if (this.category === 'cultural') this.hatchStyle = 'vertical';
            else if (this.category === 'faith') this.hatchStyle = 'stipple';
            else if (this.category === 'geographical') this.hatchStyle = 'waves';
            else this.hatchStyle = 'solid';
        }
    }

    // ========================================================================
    // ATTRIBUTE MANAGEMENT (HRAF OCM)
    // ========================================================================

    /**
     * Set an attribute using HRAF OCM code or custom key
     * @param {string} key - OCM code (e.g., 'OCM:430') or custom key
     * @param {*} value - Attribute value
     */
    setAttribute(key, value) {
        this.attributes[key] = value;
        this.transactionTime.modified = Date.now();
    }

    /**
     * Get an attribute value
     * @param {string} key - OCM code or custom key
     * @returns {*} Attribute value or undefined
     */
    getAttribute(key) {
        return this.attributes[key];
    }

    /**
     * Remove an attribute
     * @param {string} key - OCM code or custom key
     */
    removeAttribute(key) {
        delete this.attributes[key];
        this.transactionTime.modified = Date.now();
    }

    /**
     * Get all attributes as array of {key, value} objects
     */
    getAttributesList() {
        return Object.entries(this.attributes).map(([key, value]) => ({ key, value }));
    }

    // ========================================================================
    // HIERARCHY MANAGEMENT
    // ========================================================================

    /**
     * Add a child entity ID to this entity's children list
     */
    addChild(childId) {
        if (!this.children.includes(childId)) {
            this.children.push(childId);
            this.transactionTime.modified = Date.now();
        }
    }

    /**
     * Remove a child entity ID
     */
    removeChild(childId) {
        const idx = this.children.indexOf(childId);
        if (idx > -1) {
            this.children.splice(idx, 1);
            this.transactionTime.modified = Date.now();
        }
    }

    /**
     * Check if this entity contains another (for nesting validation)
     * @param {Array} childGeometry - Geometry of potential child
     * @returns {boolean}
     */
    containsGeometry(childGeometry) {
        if (!this.currentGeometry || !childGeometry) return false;
        // Simplified check: verify all child points are inside parent
        // Full implementation would use proper polygon containment algorithm
        // For now, return true (flexible nesting as per design decision)
        return true;
    }

    // ========================================================================
    // TIMELINE / KEYFRAME METHODS
    // ========================================================================

    addKeyframe(year, geometry, preventResampling = false) {
        this.timeline = this.timeline.filter(k => k.year !== year);
        let finalGeo;

        const typologyInfo = getTypology(this.domain, this.typology);
        const isPointType = (typologyInfo && typologyInfo.geometryType === 'Point') ||
            (Array.isArray(geometry) && geometry.length === 1);

        if (isPointType) {
            // Deep copy to prevent reference issues, but keep as a single point
            finalGeo = geometry.map(p => ({ ...p }));
        } else {
            const isLineType = this.type === 'river' ||
                this.typology === 'river' ||
                this.typology === 'coast';
            const isClosed = !isLineType;

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

        // Auto-expand range ONLY if it's currently finite or default unset?
        // Logic: If range was set manually (finite), we should expand it to fit keyframes if they fall outside.
        // If range is infinite, it remains infinite.
        // But if range is finite, and we add a keyframe, we expand.
        if (this.timeline.length > 0) {
            if (Number.isFinite(this.validRange.start)) {
                this.validRange.start = Math.min(this.timeline[0].year - 100, this.validRange.start);
            }
            if (Number.isFinite(this.validRange.end)) {
                this.validRange.end = Math.max(this.timeline[this.timeline.length - 1].year + 100, this.validRange.end);
            }
        }

        this.transactionTime.modified = Date.now();
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
        const isLineType = this.type === 'river' ||
            this.typology === 'river' ||
            this.typology === 'coast';

        if (startGeo.length !== endGeo.length) {
            const isClosed = !isLineType;
            startGeo = resampleGeometry(startGeo, CONFIG.RESAMPLE_COUNT, isClosed);
            endGeo = resampleGeometry(endGeo, CONFIG.RESAMPLE_COUNT, isClosed);
        }

        if (!isLineType) {
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

    // ========================================================================
    // SERIALIZATION
    // ========================================================================

    /**
     * Convert to JSON for atlas export (new format)
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,

            // Ontology (L1, L2, L3)
            domain: this.domain,
            typology: this.typology,
            subtype: this.subtype,
            adminLevel: this.adminLevel,

            // Legacy compatibility
            category: this.category,
            type: this.type,

            // Styling
            color: this.color,
            hatchStyle: this.hatchStyle,

            // Boundary
            boundaryType: this.boundaryType,
            boundaryConfidence: this.boundaryConfidence,

            // Hierarchy
            parentId: this.parentId,
            children: this.children,

            // Attributes
            attributes: this.attributes,

            // Temporal
            timeline: this.timeline,
            validRange: this.validRange,
            validTime: this.validTime,
            transactionTime: this.transactionTime,

            // External refs
            externalRefs: this.externalRefs,

            // Metadata
            description: this.description,
            visible: this.visible
        };
    }

    /**
     * Create entity from JSON data (supports both legacy and new format)
     */
    static fromJSON(data) {
        // Detect format: new format has 'domain', legacy has 'category' without 'domain'
        if (data.domain) {
            // New format
            const ent = new HistoricalEntity(data.id, data.name, {
                domain: data.domain,
                typology: data.typology,
                subtype: data.subtype,
                adminLevel: data.adminLevel,
                color: data.color,
                hatchStyle: data.hatchStyle,
                parentId: data.parentId,
                children: data.children,
                boundaryType: data.boundaryType,
                boundaryConfidence: data.boundaryConfidence,
                attributes: data.attributes,
                validTime: data.validTime,
                transactionTime: data.transactionTime,
                externalRefs: data.externalRefs,
                description: data.description,
                visible: data.visible
            });

            // Restore timeline and valid range
            ent.timeline = data.timeline || [];
            if (data.validRange) {
                ent.validRange = {
                    start: data.validRange.start !== null ? data.validRange.start : -Infinity,
                    end: data.validRange.end !== null ? data.validRange.end : Infinity
                };
            } else {
                ent.validRange = { start: -Infinity, end: Infinity };
            }

            return ent;
        } else {
            // Legacy format
            const ent = new HistoricalEntity(
                data.id,
                data.name,
                data.category,
                data.type,
                data.color,
                data.parentId,
                data.hatchStyle
            );
            Object.assign(ent, data);
            return ent;
        }
    }

    /**
     * Get display info for UI
     */
    getDisplayInfo() {
        const domainInfo = getDomain(this.domain);
        const typologyInfo = getTypology(this.domain, this.typology);

        return {
            domainLabel: domainInfo ? domainInfo.name : this.domain,
            domainAbbr: domainInfo ? domainInfo.abbr : this.domain.substring(0, 3).toUpperCase(),
            typologyLabel: typologyInfo ? typologyInfo.label : this.typology,
            typologyAbbr: typologyInfo ? typologyInfo.abbr : this.typology.substring(0, 3).toUpperCase(),
            subtypeLabel: this.subtype || '—',
            confidencePercent: Math.round(this.boundaryConfidence * 100)
        };
    }
}
