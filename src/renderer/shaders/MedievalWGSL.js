export const WGSL_SHADER = `
struct Uniforms {
    matrix: mat3x3<f32>,
    currentYear: f32,
    wobble: f32,
    time: f32,
    inkBleed: f32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

// Noise function
fn hash(n: f32) -> f32 {
    return fract(sin(n) * 43758.5453123);
}

fn noise(x: f32, y: f32) -> f32 {
    let p = vec2<f32>(floor(x), floor(y));
    let f = vec2<f32>(fract(x), fract(y));
    let n = p.x + p.y * 57.0;
    return mix(mix(hash(n + 0.0), hash(n + 1.0), f.x),
               mix(hash(n + 57.0), hash(n + 58.0), f.x), f.y);
}

// ------------------------------------
// Main Geometry Pipeline
// ------------------------------------

struct VertexInput {
    @location(0) position: vec2<f32>,
    @location(1) nextPosition: vec2<f32>,
    @location(2) color: vec3<f32>,
    @location(3) validStart: f32,
    @location(4) yearStart: f32,
    @location(5) yearEnd: f32,
};

struct VertexOutput {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) color: vec3<f32>,
    @location(1) visibility: f32,
    @location(2) texCoord: vec2<f32>,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
    var out: VertexOutput;

    let yearDiff = abs(uniforms.currentYear - input.validStart);
    out.visibility = smoothstep(100.0, 0.0, yearDiff);

    if (uniforms.currentYear < input.yearStart || uniforms.currentYear >= input.yearEnd) {
        out.clip_position = vec4<f32>(0.0, 0.0, 2.0, 1.0);
        return out;
    }

    var t = 0.0;
    let duration = input.yearEnd - input.yearStart;
    if (duration > 0.001) {
        t = clamp((uniforms.currentYear - input.yearStart) / duration, 0.0, 1.0);
    }

    let basePosition = mix(input.position, input.nextPosition, t);

    let wobbleX = (noise(basePosition.x + uniforms.time * 0.001, basePosition.y) - 0.5) * uniforms.wobble;
    let wobbleY = (noise(basePosition.x, basePosition.y + uniforms.time * 0.002 + 100.0) - 0.5) * uniforms.wobble;
    let wobble = vec2<f32>(wobbleX, wobbleY);

    let position = basePosition + wobble * 0.001;
    let transformed = uniforms.matrix * vec3<f32>(position, 1.0);

    out.clip_position = vec4<f32>(transformed.x, transformed.y, 0.0, 1.0);
    out.texCoord = basePosition;
    out.color = input.color;

    return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    if (in.visibility < 0.01) {
        discard;
    }

    let PARCHMENT = vec3<f32>(0.953, 0.914, 0.824);
    let INK_BASE = vec3<f32>(0.169, 0.125, 0.094);

    let inkColor = in.color * INK_BASE;
    let bleed = noise(in.texCoord.x * 10.0, in.texCoord.y * 10.0) * uniforms.inkBleed * 0.1;

    var finalColor = mix(PARCHMENT, inkColor, in.visibility * 0.4);
    finalColor = finalColor + vec3<f32>(bleed * 0.05);

    return vec4<f32>(finalColor, in.visibility);
}

// ------------------------------------
// Parchment Background Pipeline
// ------------------------------------

struct ParchmentOutput {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

@vertex
fn vs_parchment(@builtin(vertex_index) vertex_index: u32) -> ParchmentOutput {
    var out: ParchmentOutput;

    // Full screen quad generator without vertex buffer
    var pos = array<vec2<f32>, 6>(
        vec2<f32>(-1.0, -1.0),
        vec2<f32>( 1.0, -1.0),
        vec2<f32>(-1.0,  1.0),
        vec2<f32>(-1.0,  1.0),
        vec2<f32>( 1.0, -1.0),
        vec2<f32>( 1.0,  1.0)
    );

    out.clip_position = vec4<f32>(pos[vertex_index], 0.0, 1.0);
    out.uv = pos[vertex_index] * 0.5 + 0.5;

    return out;
}

@fragment
fn fs_parchment(in: ParchmentOutput) -> @location(0) vec4<f32> {
    let parchment = vec3<f32>(0.953, 0.914, 0.824);
    let uv = in.uv * 1000.0;

    var grain = noise(uv.x * 1.0, uv.y * 1.0) * 0.5;
    grain = grain + noise(uv.x * 2.0, uv.y * 2.0) * 0.25;
    grain = (grain - 0.5) * 20.0 * 0.1; // u_paperRoughness hardcoded for MVP

    let finalColor = parchment + vec3<f32>(grain);
    return vec4<f32>(finalColor, 1.0);
}
`;
