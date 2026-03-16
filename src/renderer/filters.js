// Simple Value Noise implementation for organic textures

// PNRG
function mulberry32(a) {
    return function () {
        var t = a += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

const rand = mulberry32(1337);

// Initialize Permutation Table
const PERM = new Uint8Array(512);
const P = new Uint8Array(256);
for (let i = 0; i < 256; i++) P[i] = i;
for (let i = 0; i < 256; i++) {
    const r = Math.floor(rand() * (256 - i)) + i;
    const t = P[i]; P[i] = P[r]; P[r] = t;
}
for (let i = 0; i < 512; i++) PERM[i] = P[i & 255];

function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(t, a, b) { return a + t * (b - a); }
function grad(hash, x, y, z) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

// 2D Perlin Noise
export function noise2D(x, y) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    const u = fade(x);
    const v = fade(y);
    const A = PERM[X] + Y, AA = PERM[A], AB = PERM[A + 1];
    const B = PERM[X + 1] + Y, BA = PERM[B], BB = PERM[B + 1];

    return lerp(v, lerp(u, grad(PERM[AA], x, y, 0), grad(PERM[BA], x - 1, y, 0)),
        lerp(u, grad(PERM[AB], x, y - 1, 0), grad(PERM[BB], x - 1, y - 1, 0)));
}

// Fractal Brownian Motion (FBM) for clouds/roughness
export function fbm(x, y, octaves, persistence = 0.5, lacunarity = 2) {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;  // Used for normalizing result to 0.0 - 1.0
    for (let i = 0; i < octaves; i++) {
        total += noise2D(x * frequency, y * frequency) * amplitude;
        maxValue += amplitude;
        amplitude *= persistence;
        frequency *= lacunarity;
    }
    return total / maxValue;
}

// Ink Bleed Simulation (Rough Edges)
// Returns a perturbed point based on noise
export function perturbPoint(x, y, scale = 10, magnitude = 2) {
    const nx = noise2D(x * scale, y * scale);
    const ny = noise2D(y * scale + 100, x * scale + 100);
    return {
        x: x + nx * magnitude,
        y: y + ny * magnitude
    };
}
