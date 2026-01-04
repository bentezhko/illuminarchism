/**
 * Illuminarchism Ontology Module
 * 
 * Defines the 4-domain, 3-level taxonomy for spatiotemporal atlas entities.
 * Based on CIDOC CRM, HRAF OCM, WALS, and FAO LCCS standards.
 * 
 * Hierarchy: Domain (L1) → Typology (L2) → Subtype (L3)
 */

// ============================================================================
// LEVEL 1: DOMAINS (4 Manifolds)
// ============================================================================

export const DOMAINS = {
    POLITICAL: {
        id: 'political',
        name: 'Political & Administrative',
        abbr: 'POL',
        description: 'Polities, states, administrative divisions, and governance structures',
        hatchDefault: 'diagonal-right'
    },
    LINGUISTIC: {
        id: 'linguistic',
        name: 'Linguistic',
        abbr: 'LIN',
        description: 'Language families, dialects, isoglosses, and typological features',
        hatchDefault: 'cross'
    },
    RELIGIOUS: {
        id: 'religious',
        name: 'Religious & Ideational',
        abbr: 'REL',
        description: 'Faiths, denominations, philosophical systems, and sacred geography',
        hatchDefault: 'stipple'
    },
    GEOGRAPHIC: {
        id: 'geographic',
        name: 'Geographic & Material',
        abbr: 'GEO',
        description: 'Land cover, hydrology, topography, and physical features',
        hatchDefault: 'waves'
    },
    CULTURAL: {
        id: 'cultural',
        name: 'Cultural & Social',
        abbr: 'CUL',
        description: 'Cultural practices, social norms, and material culture distributions.',
        hatchDefault: 'horizontal'
    }
};

// ============================================================================
// LEVEL 2: CULTURAL TYPOLOGY (HRAF-aligned)
// ============================================================================
export const CULTURAL_TYPOLOGY = {
    CUSTOM: {
        id: 'custom',
        label: 'Custom/Practice',
        abbr: 'CST',
        description: 'A shared social custom or practice (e.g., greeting, ritual).',
        boundaryType: 'fuzzy',
    },
    NORM: {
        id: 'norm',
        label: 'Social Norm',
        abbr: 'NRM',
        description: 'A widespread social norm or pattern (e.g., sleep patterns, calendar system).',
        boundaryType: 'fuzzy',
    },
    MATERIAL_CULTURE: {
        id: 'material-culture',
        label: 'Material Culture',
        abbr: 'MAT',
        description: 'Distribution of a specific artifact, technology, or style.',
        boundaryType: 'cluster',
    }
};


// ============================================================================
// LEVEL 2: POLITICAL TYPOLOGY (Service-Fried Model)
// ============================================================================

export const POLITICAL_TYPOLOGY = {
    // Pre-state formations
    BAND: {
        id: 'band',
        label: 'Band',
        abbr: 'BND',
        description: 'Egalitarian, mobile, kin-based groups (20-100 people)',
        boundaryType: 'fuzzy',
        historicalValidity: 'Paleolithic to Modern (e.g., San, Inuit)',
        population: { min: 20, max: 100 }
    },
    TRIBE: {
        id: 'tribe',
        label: 'Tribe (Acephalous)',
        abbr: 'TRB',
        description: 'Segmentary lineages, pan-tribal sodalities, no central office',
        boundaryType: 'cluster',
        historicalValidity: 'Neolithic to Modern (e.g., Nuer, Yanomami)'
    },
    CHIEFDOM: {
        id: 'chiefdom',
        label: 'Chiefdom',
        abbr: 'CHF',
        description: 'Ranked society, central chief, redistribution economy',
        boundaryType: 'centric',
        historicalValidity: 'Bronze Age, Pre-contact Americas, Iron Age Europe'
    },

    // State formations
    ARCHAIC_STATE: {
        id: 'archaic-state',
        label: 'Archaic State',
        abbr: 'ARC',
        description: 'Centralized government, monopoly on force, bureaucracy',
        boundaryType: 'hard',
        historicalValidity: 'Ancient Mesopotamia, Egypt, Shang China'
    },
    EMPIRE: {
        id: 'empire',
        label: 'Empire',
        abbr: 'EMP',
        description: 'Core polity exercising dominance over peripheral territories',
        boundaryType: 'container',
        historicalValidity: 'Roman, Mongol, British Empires'
    },
    NATION_STATE: {
        id: 'nation-state',
        label: 'Nation-State',
        abbr: 'NAT',
        description: 'Sovereign entity with fixed borders, international recognition',
        boundaryType: 'legal',
        historicalValidity: '1648 (Westphalia) to Modern'
    },
    SUPRANATIONAL: {
        id: 'supranational',
        label: 'Supranational',
        abbr: 'SUP',
        description: 'Aggregate of states pooling sovereignty',
        boundaryType: 'aggregate',
        historicalValidity: 'EU, NATO, Holy Roman Empire'
    },

    // Special types
    CITY: {
        id: 'city',
        label: 'Settlement/City',
        abbr: 'CIT',
        description: 'Urban center or significant settlement',
        boundaryType: 'point',
        geometryType: 'Point'
    },
    VASSAL: {
        id: 'vassal',
        label: 'Vassal/Subject',
        abbr: 'VSL',
        description: 'Dependent territory or client state',
        boundaryType: 'hard'
    },
    DISPUTED: {
        id: 'disputed',
        label: 'Disputed Zone',
        abbr: 'DSP',
        description: 'Territory with contested sovereignty',
        boundaryType: 'fuzzy'
    }
};

// ============================================================================
// LEVEL 2: LINGUISTIC TYPOLOGY (WALS-aligned)
// ============================================================================

// ============================================================================
// LEVEL 2: LINGUISTIC TYPOLOGY (WALS-aligned)
// ============================================================================

export const LINGUISTIC_TYPOLOGY = {
    GENEALOGICAL: {
        id: 'genealogical',
        label: 'Genealogical Unit',
        abbr: 'GEN',
        description: 'Unit defined by biological ancestry/descent'
    },
    AREAL: {
        id: 'areal',
        label: 'Areal Unit',
        abbr: 'ARL',
        description: 'Unit defined by contact and convergence (Sprachbund)'
    },
    TYPOLOGICAL: {
        id: 'typological',
        label: 'Typological Feature',
        abbr: 'TYP',
        description: 'Unit defined by shared structural features (Isogloss)'
    }
};

// ============================================================================
// LEVEL 2: RELIGIOUS TYPOLOGY
// ============================================================================

export const RELIGIOUS_TYPOLOGY = {
    UNIVERSALIZING: {
        id: 'universalizing',
        label: 'Universalizing Religion',
        abbr: 'UNV',
        description: 'Faiths that actively seek converts and transcend ethnic boundaries',
        examples: 'Christianity, Islam, Buddhism'
    },
    ETHNIC: {
        id: 'ethnic',
        label: 'Ethnic/Folk Religion',
        abbr: 'ETH',
        description: 'Faiths tied to specific kinship/geographic groups',
        examples: 'Judaism, Hinduism, Shinto, Indigenous Animism'
    },
    SYNCRETIC: {
        id: 'syncretic',
        label: 'Syncretic Movement',
        abbr: 'SYN',
        description: 'Blends of multiple religious traditions',
        examples: 'Cao Dai, Santería, Cargo Cults'
    },
    NEW_RELIGIOUS: {
        id: 'new-religious',
        label: 'New Religious Movement',
        abbr: 'NRM',
        description: 'Recent religious formations',
        examples: "Baháʼí, Falun Gong"
    },
    PHILOSOPHICAL: {
        id: 'philosophical',
        label: 'Philosophical System',
        abbr: 'PHI',
        description: 'Non-theistic ethical/philosophical systems',
        examples: 'Confucianism, Secular Humanism'
    },

    // Denominational hierarchy
    TRADITION: {
        id: 'tradition',
        label: 'Religious Tradition',
        abbr: 'TRD',
        description: 'Major religious tradition (e.g., Christianity)'
    },
    DENOMINATION: {
        id: 'denomination',
        label: 'Denomination/Branch',
        abbr: 'DEN',
        description: 'Subdivision of a tradition (e.g., Protestantism)'
    },
    SECT: {
        id: 'sect',
        label: 'Sect/Order',
        abbr: 'SCT',
        description: 'Specific sect or religious order'
    },
    DIASPORA: {
        id: 'diaspora',
        label: 'Diaspora Community',
        abbr: 'DAS',
        description: 'Dispersed religious community'
    },
    SACRED_SITE: {
        id: 'sacred-site',
        label: 'Sacred Site',
        abbr: 'SAC',
        description: 'Temple, shrine, pilgrimage site',
        geometryType: 'Point'
    }
};

// ============================================================================
// LEVEL 2: GEOGRAPHIC TYPOLOGY (FAO LCCS-aligned)
// ============================================================================

export const GEOGRAPHIC_TYPOLOGY = {
    CULTIVATED: {
        id: 'cultivated',
        label: 'Cultivated/Managed',
        abbr: 'CLT',
        description: 'Agriculture, forestry, managed lands',
        faoClass: 'A1'
    },
    NATURAL: {
        id: 'natural',
        label: 'Natural/Semi-Natural',
        abbr: 'NAT',
        description: 'Forests, grasslands, wetlands',
        faoClass: 'A2'
    },
    AQUATIC: {
        id: 'aquatic',
        label: 'Aquatic/Flooded',
        abbr: 'AQU',
        description: 'Water bodies, marshes, reefs',
        faoClass: 'A3',
        boundaryType: 'hard' // Default for water bodies
    },
    ARTIFICIAL: {
        id: 'artificial',
        label: 'Artificial/Urban',
        abbr: 'ART',
        description: 'Urban areas, roads, infrastructure',
        faoClass: 'A4'
    },
    BARE: {
        id: 'bare',
        label: 'Bare/Sparse',
        abbr: 'BAR',
        description: 'Deserts, glaciers, rock, bare soil',
        faoClass: 'A5'
    }
};

// ============================================================================
// LEVEL 3: ADMINISTRATIVE SUBDIVISIONS
// ============================================================================

export const ADMIN_LEVELS = {
    L3_1: {
        id: 'first-order',
        level: 1,
        label: 'First-Order Division',
        abbr: 'L3.1',
        examples: 'Province, State, Satrapy, Oblast, Région'
    },
    L3_2: {
        id: 'second-order',
        level: 2,
        label: 'Second-Order Division',
        abbr: 'L3.2',
        examples: 'County, District, Prefecture, Nome, Département'
    },
    L3_3: {
        id: 'third-order',
        level: 3,
        label: 'Third-Order Division',
        abbr: 'L3.3',
        examples: 'Municipality, Township, Parish, Commune'
    },
    L3_4: {
        id: 'fourth-order',
        level: 4,
        label: 'Fourth-Order Division',
        abbr: 'L3.4',
        examples: 'Neighborhood, Ward, Quarter'
    }
};

// ============================================================================
// BOUNDARY TYPES
// ============================================================================

export const BOUNDARY_TYPES = {
    FUZZY: {
        id: 'fuzzy',
        label: 'Fuzzy/Range',
        description: 'Approximate zone of influence, typical for bands and tribes',
        renderStyle: 'dashed',
        confidenceDefault: 0.5
    },
    CLUSTER: {
        id: 'cluster',
        label: 'Settlement Cluster',
        description: 'Distinct settlements with interstitial zones',
        renderStyle: 'dotted'
    },
    CENTRIC: {
        id: 'centric',
        label: 'Centric/Thiessen',
        description: 'Radiating from central place, typical for chiefdoms',
        renderStyle: 'gradient'
    },
    HARD: {
        id: 'hard',
        label: 'Hard Border',
        description: 'Demarcated line, typical for nation-states',
        renderStyle: 'solid',
        confidenceDefault: 0.9
    }
};

// ============================================================================
// LEVEL 3: POLITICAL SUBTYPES (Admin Levels)
// ============================================================================

export const POLITICAL_SUBTYPES = {
    SOVEREIGN: {
        id: 'sovereign',
        label: 'Sovereign Unit',
        abbr: 'SOV',
        description: 'Independent political entity'
    },
    ...ADMIN_LEVELS
};

// ============================================================================
// LEVEL 3: LINGUISTIC SUBTYPES (Specific Units)
// ============================================================================

export const LINGUISTIC_SUBTYPES = {
    MACRO_PHYLUM: {
        id: 'macro-phylum',
        label: 'Macro-Phylum',
        abbr: 'MPH'
    },
    FAMILY: {
        id: 'family',
        label: 'Language Family',
        abbr: 'FAM'
    },
    BRANCH: {
        id: 'branch',
        label: 'Language Branch',
        abbr: 'BRN'
    },
    LANGUAGE: {
        id: 'language',
        label: 'Language',
        abbr: 'LNG'
    },
    DIALECT: {
        id: 'dialect',
        label: 'Dialect',
        abbr: 'DIA'
    }
};

// ============================================================================
// LEVEL 3: RELIGIOUS SUBTYPES (Denominations)
// ============================================================================

export const RELIGIOUS_SUBTYPES = {
    TRADITION: { id: 'tradition', label: 'Tradition', abbr: 'TRD' },
    BRANCH: { id: 'branch', label: 'Branch', abbr: 'BRN' },
    DENOMINATION: { id: 'denomination', label: 'Denomination', abbr: 'DEN' },
    SECT: { id: 'sect', label: 'Sect', abbr: 'SCT' }
};

// ============================================================================
// LEVEL 3: GEOGRAPHIC SUBTYPES (Features)
// ============================================================================

export const GEOGRAPHIC_SUBTYPES = {
    RIVER: { id: 'river', label: 'River', abbr: 'RIV', geometryType: 'LineString' },
    LAKE: { id: 'lake', label: 'Lake', abbr: 'LAK' },
    OCEAN: { id: 'ocean', label: 'Ocean', abbr: 'OCN' },
    MOUNTAIN: { id: 'mountain', label: 'Mountain', abbr: 'MTN' },
    ISLAND: { id: 'island', label: 'Island', abbr: 'ISL' },
    DESERT: { id: 'desert', label: 'Desert', abbr: 'DST' }
};

// ============================================================================
// HRAF OCM CODES (Selected for Historical Atlas Use)
// ============================================================================

export const HRAF_OCM = {
    // Demographics (160s)
    '161': { code: '161', label: 'Population', category: 'demographics' },
    '164': { code: '164', label: 'Morbidity', category: 'demographics' },
    '165': { code: '165', label: 'Life Expectancy', category: 'demographics' },

    // Material Culture (200s-300s)
    '241': { code: '241', label: 'Tillage', category: 'subsistence' },
    '250': { code: '250', label: 'Leather/Textiles', category: 'material' },
    '310': { code: '310', label: 'Explorative Activities', category: 'subsistence' },
    '354': { code: '354', label: 'Lighting Appliances', category: 'material' },
    '373': { code: '373', label: 'Light Sources', category: 'material' },

    // Economy (430s)
    '430': {
        code: '430', label: 'Exchange', category: 'economy',
        values: ['reciprocity', 'redistribution', 'market']
    },
    '431': { code: '431', label: 'Gift Giving', category: 'economy' },
    '432': { code: '432', label: 'Barter', category: 'economy' },
    '434': { code: '434', label: 'Income and Wealth', category: 'economy' },
    '436': { code: '436', label: 'Medium of Exchange', category: 'economy' },
    '437': { code: '437', label: 'Credit', category: 'economy' },
    '438': { code: '438', label: 'Domestic Trade', category: 'economy' },
    '439': { code: '439', label: 'Foreign Trade', category: 'economy' },

    // Social Organization (500s)
    '513': {
        code: '513', label: 'Sleeping', category: 'domestic',
        values: ['monophasic', 'biphasic', 'polyphasic']
    },
    '560': { code: '560', label: 'Social Stratification', category: 'social' },
    '561': { code: '561', label: 'Age Stratification', category: 'social' },
    '562': { code: '562', label: 'Sex Differentiation', category: 'social' },
    '563': { code: '563', label: 'Ethnic Stratification', category: 'social' },
    '564': { code: '564', label: 'Castes', category: 'social' },
    '565': { code: '565', label: 'Classes', category: 'social' },
    '566': { code: '566', label: 'Slavery', category: 'social' },

    // Government (640s)
    '640': { code: '640', label: 'State', category: 'political' },
    '641': { code: '641', label: 'Citizenship', category: 'political' },
    '642': { code: '642', label: 'Constitution', category: 'political' },
    '643': { code: '643', label: 'Chief Executive', category: 'political' },
    '644': { code: '644', label: 'Executive Household', category: 'political' },
    '645': { code: '645', label: 'Cabinet', category: 'political' },
    '646': { code: '646', label: 'Administrative Agencies', category: 'political' },

    // Warfare (720s)
    '720': { code: '720', label: 'War', category: 'conflict' },
    '721': { code: '721', label: 'Instigation of War', category: 'conflict' },
    '722': { code: '722', label: 'Armed Forces', category: 'conflict' },
    '723': { code: '723', label: 'Strategy', category: 'conflict' },
    '724': { code: '724', label: 'Logistics', category: 'conflict' },
    '725': { code: '725', label: 'Tactics', category: 'conflict' },

    // Religion (770s-790s)
    '770': { code: '770', label: 'Religious Beliefs', category: 'religion' },
    '771': { code: '771', label: 'General Character of Religion', category: 'religion' },
    '773': { code: '773', label: 'Mythology', category: 'religion' },
    '775': { code: '775', label: 'Eschatology', category: 'religion' },
    '780': { code: '780', label: 'Religious Practices', category: 'religion' },
    '790': { code: '790', label: 'Ecclesiastical Organization', category: 'religion' }
};

// ============================================================================
// WALS FEATURE CODES (Selected)
// ============================================================================

export const WALS_FEATURES = {
    '81A': {
        id: '81A', label: 'Order of Subject, Object, and Verb',
        values: ['SOV', 'SVO', 'VSO', 'VOS', 'OVS', 'OSV', 'No dominant order']
    },
    '37A': {
        id: '37A', label: 'Definite Articles',
        values: ['Definite word distinct from demonstrative', 'Definite affix', 'No definite article']
    },
    '13A': {
        id: '13A', label: 'Tone',
        values: ['No tones', 'Simple tone system', 'Complex tone system']
    },
    '1A': {
        id: '1A', label: 'Consonant Inventories',
        values: ['Small', 'Moderately small', 'Average', 'Moderately large', 'Large']
    },
    '2A': {
        id: '2A', label: 'Vowel Quality Inventories',
        values: ['Small (2-4)', 'Average (5-6)', 'Large (7-14)']
    }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get all typologies for a given domain
 */
export function getTypologiesForDomain(domainId) {
    switch (domainId) {
        case 'political': return POLITICAL_TYPOLOGY;
        case 'linguistic': return LINGUISTIC_TYPOLOGY;
        case 'religious': return RELIGIOUS_TYPOLOGY;
        case 'geographic': return GEOGRAPHIC_TYPOLOGY;
        case 'cultural': return CULTURAL_TYPOLOGY;
        default: return {};
    }
}

/**
 * Get domain object by ID
 */
export function getDomain(domainId) {
    return Object.values(DOMAINS).find(d => d.id === domainId);
}

/**
 * Get typology object by domain and typology ID
 */
export function getTypology(domainId, typologyId) {
    const typologies = getTypologiesForDomain(domainId);
    return Object.values(typologies).find(t => t.id === typologyId);
}

/**
 * Get HRAF OCM code information
 */
export function getOCMCode(code) {
    const cleanCode = code.replace('OCM:', '');
    return HRAF_OCM[cleanCode];
}

/**
 * Build UI-ready taxonomy structure
 */
export function buildTaxonomyForUI() {
    const result = {};

    for (const [key, domain] of Object.entries(DOMAINS)) {
        const domainId = domain.id;
        const typologies = getTypologiesForDomain(domainId);

        result[domainId] = {
            domain: domain,
            types: Object.values(typologies).map(t => ({
                value: t.id,
                label: t.label,
                abbr: t.abbr,
                boundaryType: t.boundaryType,
                geometryType: t.geometryType || 'Polygon'
            }))
        };
    }

    return result;
}

/**
 * Validate entity against ontology
 */
export function validateEntity(entity) {
    const errors = [];

    // Check domain
    if (!getDomain(entity.domain)) {
        errors.push(`Invalid domain: ${entity.domain}`);
    }

    // Check typology
    if (!getTypology(entity.domain, entity.typology)) {
        errors.push(`Invalid typology '${entity.typology}' for domain '${entity.domain}'`);
    }

    // Check HRAF attributes
    if (entity.attributes) {
        for (const key of Object.keys(entity.attributes)) {
            if (key.startsWith('OCM:') && !getOCMCode(key)) {
                errors.push(`Unknown OCM code: ${key}`);
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Migrate legacy entity format to new ontology
 */
export function migrateFromLegacy(legacyEntity) {
    const categoryToomain = {
        'political': 'political',
        'geographical': 'geographic',
        'cultural': 'political', // Map to political with practice subtype
        'linguistic': 'linguistic',
        'faith': 'religious'
    };

    const typeToTypology = {
        // Political
        'polity': 'nation-state',
        'city': 'city',
        'vassal': 'vassal',
        // Geographic
        'water': 'aquatic',
        'river': 'river',
        // Linguistic
        'language': 'language',
        'word': 'word-isogloss',
        'sound': 'sound-isogloss',
        // Religious
        'religion': 'universalizing',
        'sect': 'sect',
        'diaspora': 'diaspora',
        // Cultural (mapped to political/practice)
        'practice': 'chiefdom'
    };

    return {
        domain: categoryToomain[legacyEntity.category] || 'political',
        typology: typeToTypology[legacyEntity.type] || legacyEntity.type,
        subtype: null,
        // Preserve other properties
        boundaryConfidence: legacyEntity.category === 'political' ? 0.9 : 0.7
    };
}

// Default export for convenience
export default {
    DOMAINS,
    POLITICAL_TYPOLOGY,
    LINGUISTIC_TYPOLOGY,
    RELIGIOUS_TYPOLOGY,
    GEOGRAPHIC_TYPOLOGY,
    ADMIN_LEVELS,
    BOUNDARY_TYPES,
    HRAF_OCM,
    WALS_FEATURES,
    getTypologiesForDomain,
    getDomain,
    getTypology,
    getOCMCode,
    buildTaxonomyForUI,
    validateEntity,
    migrateFromLegacy,
    POLITICAL_SUBTYPES,
    LINGUISTIC_SUBTYPES,
    RELIGIOUS_SUBTYPES,
    GEOGRAPHIC_SUBTYPES
};
