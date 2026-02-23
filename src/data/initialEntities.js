export const initialEntities = [
    {
        id: 'sea_north',
        name: 'Mare Borealis',
        config: {
            domain: 'geographic',
            typology: 'aquatic',
            color: '#264e86',
            hatchStyle: 'waves',
            validRange: { start: -2000, end: 2050 }
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
            color: '#264e86',
            hatchStyle: 'waves',
            validRange: { start: -2000, end: 2050 }
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
            color: '#264e86',
            hatchStyle: 'diagonal-right',
            validRange: { start: -2000, end: 2050 }
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
            color: '#264e86',
            hatchStyle: 'diagonal-left',
            validRange: { start: -2000, end: 2050 }
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
            color: '#8a3324',
            hatchStyle: 'vertical',
            validRange: { start: -2000, end: 2050 }
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
            color: '#000000',
            validRange: { start: -1000, end: 2050 }
        },
        keyframes: [
            { year: -1000, geometry: [{ x: 0, y: 0 }], preventResampling: false } // No preventResampling: true in original code
        ]
    },
    {
        id: 'lang_old',
        name: 'Lingua Antiqua',
        config: {
            domain: 'linguistic',
            typology: 'genealogical',
            subtype: 'language',
            color: '#5c3c92',
            hatchStyle: 'cross',
            validRange: { start: 800, end: 2050 }
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
            color: '#800080',
            hatchStyle: 'stipple',
            validRange: { start: 1200, end: 2050 }
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
            color: '#FF4500',
            hatchStyle: 'stipple',
            validRange: { start: 1900, end: 2050 }
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
            color: '#c5a059',
            hatchStyle: 'vertical',
            validRange: { start: 900, end: 2050 }
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
            color: '#228B22',
            hatchStyle: 'stipple',
            validRange: { start: -500, end: 2050 }
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
            color: '#3a5f3a',
            hatchStyle: 'horizontal',
            validRange: { start: -10000, end: 1900 }
        },
        keyframes: [
            { year: -10000, geometry: [{ x: -50, y: -50 }, { x: 50, y: -50 }, { x: 50, y: 50 }, { x: -50, y: 50 }], preventResampling: true },
            { year: 1900, geometry: [{ x: -50, y: -50 }, { x: 50, y: -50 }, { x: 50, y: 50 }, { x: -50, y: 50 }], preventResampling: true }
        ]
    }
];
