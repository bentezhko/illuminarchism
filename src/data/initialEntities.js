
const COMMON_COLORS = {
    SEA_BLUE: '#264e86',
    LAND_RED: '#8a3324',
    CITY_BLACK: '#000000',
    LANG_PURPLE: '#5c3c92',
    SOUND_MAGENTA: '#800080',
    WORD_ORANGE: '#FF4500',
    CULT_GOLD: '#c5a059',
    FAITH_GREEN: '#228B22',
    SLEEP_GREEN: '#3a5f3a'
};

const COMMON_RANGES = {
    DEFAULT: { start: -2000, end: 2050 },
    CITY_ETERNAL: { start: -1000, end: 2050 },
    LANG_OLD: { start: 800, end: 2050 },
    SOUND_TH: { start: 1200, end: 2050 },
    WORD_SODA: { start: 1900, end: 2050 },
    CULT_FEST: { start: 900, end: 2050 },
    FAITH_PAGAN: { start: -500, end: 2050 },
    SLEEP_BIPHASIC: { start: -10000, end: 1900 }
};

export const initialEntities = [
    {
        id: 'sea_north',
        name: 'Mare Borealis',
        config: {
            domain: 'geographic',
            typology: 'aquatic',
            color: COMMON_COLORS.SEA_BLUE,
            hatchStyle: 'waves',
            layerId: 'layer_water',
            validRange: COMMON_RANGES.DEFAULT
        },
        keyframes: [
            { year: -2000, geometry: [{ x: 0, y: -400 }, { x: 500, y: -400 }, { x: 500, y: 0 }, { x: 0, y: 0 }], preventResampling: true },
            { year: 2025, geometry: [{ x: -10, y: -410 }, { x: 510, y: -410 }, { x: 510, y: 10 }, { x: -10, y: 10 }], preventResampling: true }
        ]
    },
    {
        id: 'sea_south',
        name: 'Mare Australis',
        config: {
            domain: 'geographic',
            typology: 'aquatic',
            color: COMMON_COLORS.SEA_BLUE,
            hatchStyle: 'waves',
            layerId: 'layer_water',
            validRange: COMMON_RANGES.DEFAULT
        },
        keyframes: [
            { year: -2000, geometry: [{ x: 0, y: -100 }, { x: 500, y: -100 }, { x: 500, y: 300 }, { x: 0, y: 300 }], preventResampling: true },
            { year: 2025, geometry: [{ x: -10, y: -110 }, { x: 510, y: -110 }, { x: 510, y: 310 }, { x: -10, y: 310 }], preventResampling: true }
        ]
    },
    {
        id: 'mainland',
        name: 'Regnum Magna',
        config: {
            domain: 'political',
            typology: 'nation-state',
            color: COMMON_COLORS.SEA_BLUE,
            hatchStyle: 'diagonal-right',
            layerId: 'layer_political',
            validRange: COMMON_RANGES.DEFAULT
        },
        keyframes: [
            { year: -2000, geometry: [{ x: -300, y: -100 }, { x: -100, y: -100 }, { x: -100, y: 100 }, { x: -300, y: 100 }], preventResampling: true },
            { year: 2025, geometry: [{ x: -300, y: -100 }, { x: -100, y: -100 }, { x: -100, y: 100 }, { x: -300, y: 100 }], preventResampling: true }
        ]
    },
    {
        id: 'island',
        name: 'Insula Minor',
        config: {
            domain: 'political',
            typology: 'nation-state',
            color: COMMON_COLORS.SEA_BLUE,
            hatchStyle: 'diagonal-left',
            layerId: 'layer_political',
            validRange: COMMON_RANGES.DEFAULT
        },
        keyframes: [
            { year: -2000, geometry: [{ x: 200, y: -50 }, { x: 300, y: -50 }, { x: 300, y: 50 }, { x: 200, y: 50 }], preventResampling: true },
            { year: 2025, geometry: [{ x: 200, y: -50 }, { x: 300, y: -50 }, { x: 300, y: 50 }, { x: 200, y: 50 }], preventResampling: true }
        ]
    },
    {
        id: 'bridge',
        name: 'The Causeway',
        config: {
            domain: 'political',
            typology: 'nation-state',
            color: COMMON_COLORS.LAND_RED,
            hatchStyle: 'vertical',
            layerId: 'layer_political',
            validRange: COMMON_RANGES.DEFAULT
        },
        keyframes: [
            { year: -2000, geometry: [{ x: -100, y: -10 }, { x: 200, y: -10 }, { x: 200, y: 10 }, { x: -100, y: 10 }], preventResampling: true },
            { year: 2025, geometry: [{ x: -100, y: -10 }, { x: 200, y: -10 }, { x: 200, y: 10 }, { x: -100, y: 10 }], preventResampling: true }
        ]
    },
    {
        id: 'city_capital',
        name: 'Urbs Aeterna',
        config: {
            domain: 'political',
            typology: 'archaic-state',
            subtype: 'sovereign',
            color: COMMON_COLORS.CITY_BLACK,
            layerId: 'layer_misc',
            validRange: COMMON_RANGES.CITY_ETERNAL
        },
        keyframes: [
            { year: -1000, geometry: [{ x: 0, y: 0 }], preventResampling: false }
        ]
    },
    {
        id: 'lang_old',
        name: 'Lingua Antiqua',
        config: {
            domain: 'linguistic',
            typology: 'genealogical',
            subtype: 'language',
            color: COMMON_COLORS.LANG_PURPLE,
            hatchStyle: 'cross',
            layerId: 'layer_misc',
            validRange: COMMON_RANGES.LANG_OLD
        },
        keyframes: [
            { year: 800, geometry: [{ x: -280, y: -80 }, { x: -120, y: -80 }, { x: -120, y: 80 }, { x: -280, y: 80 }], preventResampling: true }
        ]
    },
    {
        id: 'sound_th',
        name: 'Theta Isogloss',
        config: {
            domain: 'linguistic',
            typology: 'typological',
            subtype: 'feature',
            color: COMMON_COLORS.SOUND_MAGENTA,
            hatchStyle: 'stipple',
            layerId: 'layer_misc',
            validRange: COMMON_RANGES.SOUND_TH
        },
        keyframes: [
            { year: 1200, geometry: [{ x: -250, y: -50 }, { x: -150, y: -50 }, { x: -150, y: 50 }, { x: -250, y: 50 }], preventResampling: true }
        ]
    },
    {
        id: 'word_soda',
        name: 'Soda/Pop Line',
        config: {
            domain: 'linguistic',
            typology: 'typological',
            subtype: 'feature',
            color: COMMON_COLORS.WORD_ORANGE,
            hatchStyle: 'stipple',
            layerId: 'layer_misc',
            validRange: COMMON_RANGES.WORD_SODA
        },
        keyframes: [
            { year: 1900, geometry: [{ x: -200, y: -100 }, { x: -100, y: -100 }, { x: -100, y: 0 }, { x: -200, y: 0 }], preventResampling: true }
        ]
    },
    {
        id: 'cult_fest',
        name: 'Solar Calendar Zone',
        config: {
            domain: 'political',
            typology: 'band',
            color: COMMON_COLORS.CULT_GOLD,
            hatchStyle: 'vertical',
            layerId: 'layer_political',
            validRange: COMMON_RANGES.CULT_FEST
        },
        keyframes: [
            { year: 900, geometry: [{ x: -290, y: -90 }, { x: 100, y: -90 }, { x: 100, y: 90 }, { x: -290, y: 90 }], preventResampling: true }
        ]
    },
    {
        id: 'faith_pagan',
        name: 'Old Gods',
        config: {
            domain: 'religious',
            typology: 'ethnic',
            color: COMMON_COLORS.FAITH_GREEN,
            hatchStyle: 'stipple',
            layerId: 'layer_misc',
            validRange: COMMON_RANGES.FAITH_PAGAN
        },
        keyframes: [
            { year: -500, geometry: [{ x: 250, y: -50 }, { x: 350, y: -50 }, { x: 350, y: 50 }, { x: 250, y: 50 }], preventResampling: true }
        ]
    },
    {
        id: 'cult_sleep',
        name: 'Biphasic Sleep Zone',
        config: {
            domain: 'political',
            typology: 'band',
            color: COMMON_COLORS.SLEEP_GREEN,
            hatchStyle: 'horizontal',
            layerId: 'layer_political',
            validRange: COMMON_RANGES.SLEEP_BIPHASIC
        },
        keyframes: [
            { year: -10000, geometry: [{ x: -50, y: -50 }, { x: 50, y: -50 }, { x: 50, y: 50 }, { x: -50, y: 50 }], preventResampling: true },
            { year: 1900, geometry: [{ x: -50, y: -50 }, { x: 50, y: -50 }, { x: 50, y: 50 }, { x: -50, y: 50 }], preventResampling: true }
        ]
    }
];
