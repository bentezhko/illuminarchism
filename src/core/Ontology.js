
/**
 * Ontology.js
 * Centralized definition of the application's domain/typology hierarchy.
 * Follows a 4-domain, 3-level model:
 * Level 1: Domain (Political, Linguistic, Religious, Geographic)
 * Level 2: Typology (The primary 'form' of an entity)
 * Level 3: Subtype/Admin Level (Refined classifications)
 */

export const DOMAINS = {
    POLITICAL: {
        id: 'POLITICAL',
        label: 'Political',
        abbr: 'POL',
        TYPOLOGIES: {
            NATION_STATE: { id: 'nation-state', label: 'Nation State', abbr: 'NAT', isLand: true },
            BAND: { id: 'band', label: 'Band', abbr: 'BND', isLand: true },
            EMPIRE: { id: 'empire', label: 'Empire', abbr: 'EMP', isLand: true },
            CHIEFDOM: { id: 'chiefdom', label: 'Chiefdom', abbr: 'CHF', isLand: true },
            ARCHAIC_STATE: { id: 'archaic-state', label: 'Archaic State', abbr: 'ARC', isLand: true },
            SUPRANATIONAL: { id: 'supranational', label: 'Supranational Org', abbr: 'SUP', isLand: true },
            TRIBE: { id: 'tribe', label: 'Tribe', abbr: 'TRB', isLand: true }
        },
        SUBTYPES: {
            SOVEREIGN: { id: 'sovereign', label: 'Sovereign Entity', abbr: 'SOV' },
            VASSAL: { id: 'vassal', label: 'Vassal/Statelet', abbr: 'VAS' },
            COLONY: { id: 'colony', label: 'Colony/Territory', abbr: 'COL' },
            OCCUPIED: { id: 'occupied', label: 'Occupied Zone', abbr: 'OCC' }
        }
    },
    LINGUISTIC: {
        id: 'LINGUISTIC',
        label: 'Linguistic',
        abbr: 'LIN',
        TYPOLOGIES: {
            GENEALOGICAL: { id: 'genealogical', label: 'Language Family/Group', abbr: 'GEN' },
            TYPOLOGICAL: { id: 'typological', label: 'Typological Isogloss', abbr: 'TYP' },
            CONTACT: { id: 'contact', label: 'Contact/Pidgin Area', abbr: 'CON' }
        },
        SUBTYPES: {
            FAMILY: { id: 'family', label: 'Language Family', abbr: 'FAM' },
            LANGUAGE: { id: 'language', label: 'Specific Language', abbr: 'LNG' },
            DIALECT: { id: 'dialect', label: 'Dialect/Variant', abbr: 'DIA' },
            FEATURE: { id: 'feature', label: 'Isogloss Feature', abbr: 'FTR' }
        }
    },
    RELIGIOUS: {
        id: 'RELIGIOUS',
        label: 'Religious/Faith',
        abbr: 'REL',
        TYPOLOGIES: {
            UNIVERSALIZING: { id: 'universalizing', label: 'Universalizing Religion', abbr: 'UNI' },
            ETHNIC: { id: 'ethnic', label: 'Ethnic/Folk Religion', abbr: 'ETH' },
            SYNCRETIC: { id: 'syncretic', label: 'Syncretic/New Movement', abbr: 'SYN' }
        },
        SUBTYPES: {
            DENOMINATION: { id: 'denomination', label: 'Denomination', abbr: 'DEN' },
            SECT: { id: 'sect', label: 'Sect/Order', abbr: 'SCT' },
            CULTUS: { id: 'cultus', label: 'Local Cultus', abbr: 'CLT' }
        }
    },
    GEOGRAPHIC: {
        id: 'GEOGRAPHIC',
        label: 'Geographical',
        abbr: 'GEO',
        TYPOLOGIES: {
            AQUATIC: { id: 'aquatic', label: 'Aquatic/Water', abbr: 'AQU' },
            ISLAND: { id: 'island', label: 'Island', abbr: 'ISL', isLand: true },
            LANDMASS: { id: 'landmass', label: 'Landmass', abbr: 'LND', isLand: true },
            CONTINENT: { id: 'continent', label: 'Continent', abbr: 'CON', isLand: true },
            MOUNTAIN: { id: 'mountain', label: 'Mountain/Range', abbr: 'MTN', isLand: true },
            DESERT: { id: 'desert', label: 'Desert', abbr: 'DSR', isLand: true }
        },
        SUBTYPES: {
            CITY: { id: 'city', label: 'City/Settlement', abbr: 'CTY' },
            RIVER: { id: 'river', label: 'River/Watercourse', abbr: 'RIV' },
            SACRED_SITE: { id: 'sacred-site', label: 'Sacred/Natural Site', abbr: 'SCR' }
        }
    }
};

/**
 * Global Subtypes (shared across domains)
 */
export const POLITICAL_SUBTYPES = DOMAINS.POLITICAL.SUBTYPES;
export const LINGUISTIC_SUBTYPES = DOMAINS.LINGUISTIC.SUBTYPES;
export const RELIGIOUS_SUBTYPES = DOMAINS.RELIGIOUS.SUBTYPES;
export const GEOGRAPHIC_SUBTYPES = {
    ...DOMAINS.GEOGRAPHIC.SUBTYPES,
    ISLAND: { id: 'island', label: 'Island', isLand: true },
    CONTINENT: { id: 'continent', label: 'Continent', isLand: true },
    LANDMASS: { id: 'landmass', label: 'Landmass', isLand: true },
};

/**
 * Pre-calculated registry of "land" typologies for high-performance lookup.
 * @private
 */
const LAND_REGISTRY = new Set();

/**
 * Internal helper to populate the land registry from the ontology.
 * @private
 */
function updateLandRegistry() {
    LAND_REGISTRY.clear();
    Object.values(DOMAINS).forEach(domain => {
        const domainId = domain.id.toLowerCase();

        // Index Level 2 Typologies
        if (domain.TYPOLOGIES) {
            Object.values(domain.TYPOLOGIES).forEach(typ => {
                if (typ.isLand) LAND_REGISTRY.add(`${domainId}:${typ.id}`);
            });
        }

        // Index Level 3 Subtypes (merged with global geographic subtypes)
        const combinedSubtypes = { ...(domain.SUBTYPES || {}), ...GEOGRAPHIC_SUBTYPES };
        Object.values(combinedSubtypes).forEach(st => {
            if (st.isLand) LAND_REGISTRY.add(`${domainId}:${st.id}`);
        });
    });
}

// Initial population
updateLandRegistry();

/**
 * Helper to check if a domain/typology combination constitutes "land".
 * This is used to determine where to draw coastline ripples.
 * @param {string} domainId
 * @param {string} typologyId
 * @returns {boolean}
 */
export function isLandTypology(domainId, typologyId) {
    if (!domainId || !typologyId) return false;
    // We use a colon-separated key to avoid collisions across domains
    return LAND_REGISTRY.has(`${domainId.toLowerCase()}:${typologyId.toLowerCase()}`);
}

/**
 * Helper to flatten the ontology for UI consumption (e.g. Dials/Selects)
 */
export function buildTaxonomyForUI() {
    const taxonomy = {};
    Object.keys(DOMAINS).forEach(dKey => {
        const domain = DOMAINS[dKey];
        taxonomy[domain.id.toLowerCase()] = {
            domain: { label: domain.label, abbr: domain.abbr, value: domain.id.toLowerCase() },
            types: Object.values(domain.TYPOLOGIES).map(t => ({
                label: t.label,
                abbr: t.abbr,
                value: t.id
            }))
        };
    });
    return taxonomy;
}

/**
 * Helper to get all typologies for a specific domain
 */
export function getTypologiesForDomain(domainId) {
    const domain = DOMAINS[domainId.toUpperCase()];
    return domain ? Object.values(domain.TYPOLOGIES) : [];
}
