export const WGSL_SHADER = `
struct Uniforms {
    matCol0: vec4<f32>,
    matCol1: vec4<f32>,
    matCol2: vec4<f32>,
    currentYear: f32,
    wobble: f32,
    time: f32,
    inkBleed: f32,
    paperRoughness: f32,
    hoveredId: f32,
    selectedId: f32,
    parchmentColor: vec4<f32>,
    inkColor: vec4<f32>,
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
    @location(4) validEnd: f32,
    @location(5) yearStart: f32,
    @location(6) yearEnd: f32,
    @location(7) entityId: f32,
};

struct VertexOutput {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) color: vec3<f32>,
    @location(1) visibility: f32,
    @location(2) texCoord: vec2<f32>,
    @location(3) entityId: f32,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
    var out: VertexOutput;

    // Smooth fade in and out based on validRange
    let cy = uniforms.currentYear;
    let fadeMargin = 100.0;

    var vis = 1.0;
    if (cy < input.validStart) {
        vis = smoothstep(input.validStart - fadeMargin, input.validStart, cy);
    } else if (cy > input.validEnd) {
        vis = smoothstep(input.validEnd + fadeMargin, input.validEnd, cy);
    }
    out.visibility = vis;

    if (uniforms.currentYear < input.yearStart || uniforms.currentYear >= input.yearEnd || vis < 0.01) {
        // Discarding geometry outside of the current valid frame timeline
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

    // 2D affine transformation with matCol vectors.
    // uniforms.matCol0.xyz is (scaleX, 0, 0)
    // uniforms.matCol1.xyz is (0, scaleY, 0)
    // uniforms.matCol2.xyz is (tx, ty, 1)
    let transformedX = uniforms.matCol0.x * position.x + uniforms.matCol1.x * position.y + uniforms.matCol2.x;
    let transformedY = uniforms.matCol0.y * position.x + uniforms.matCol1.y * position.y + uniforms.matCol2.y;

    out.clip_position = vec4<f32>(transformedX, transformedY, 0.0, 1.0);
    out.texCoord = basePosition;
    out.color = input.color;
    out.entityId = input.entityId;

    return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    if (in.visibility < 0.01) {
        discard;
    }

    let PARCHMENT = uniforms.parchmentColor.rgb;

    // Use the per-entity color directly as the ink color.
    // For entities with black (#000000), fall back to the theme ink color.
    let entityBrightness = dot(in.color, vec3<f32>(0.299, 0.587, 0.114));
    let inkColor = select(in.color, uniforms.inkColor.rgb, entityBrightness < 0.01);

    let bleed = noise(in.texCoord.x * 10.0, in.texCoord.y * 10.0) * uniforms.inkBleed * 0.1;

    // Blend ink over parchment with opacity for the medieval manuscript look
    let INK_OPACITY: f32 = 0.7;
    var baseColor = mix(PARCHMENT, inkColor, INK_OPACITY);

    // Highlight logic
    if (abs(in.entityId - uniforms.hoveredId) < 0.1) {
        baseColor = baseColor * 1.2; // Boost brightness
    }
    if (abs(in.entityId - uniforms.selectedId) < 0.1) {
        baseColor = mix(baseColor, vec3<f32>(0.54, 0.20, 0.14), 0.5); // Tint with #8a3324 highlight red
    }

    var finalColor = baseColor + vec3<f32>(bleed * 0.05);

    // Output premultiplied alpha: (color.rgb * alpha, alpha)
    return vec4<f32>(finalColor * in.visibility, in.visibility);
}

// ------------------------------------
// Image Texture Pipeline
// ------------------------------------

@group(1) @binding(0) var imgSampler: sampler;
@group(1) @binding(1) var imgTexture: texture_2d<f32>;

struct ImageVertexInput {
    @location(0) position: vec2<f32>,
    @location(1) uv: vec2<f32>,
    @location(2) opacity: f32,
};

struct ImageVertexOutput {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) uv: vec2<f32>,
    @location(1) opacity: f32,
};

@vertex
fn vs_image(input: ImageVertexInput) -> ImageVertexOutput {
    var out: ImageVertexOutput;
    let transformedX = uniforms.matCol0.x * input.position.x + uniforms.matCol1.x * input.position.y + uniforms.matCol2.x;
    let transformedY = uniforms.matCol0.y * input.position.x + uniforms.matCol1.y * input.position.y + uniforms.matCol2.y;
    out.clip_position = vec4<f32>(transformedX, transformedY, 0.0, 1.0);
    out.uv = input.uv;
    out.opacity = input.opacity;
    return out;
}

@fragment
fn fs_image(in: ImageVertexOutput) -> @location(0) vec4<f32> {
    let color = textureSample(imgTexture, imgSampler, in.uv);
    return vec4<f32>(color.rgb * in.opacity, color.a * in.opacity);
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
    let parchment = uniforms.parchmentColor.rgb;
    let uv = in.uv * 1000.0;

    var grain = noise(uv.x * 1.0, uv.y * 1.0) * 0.5;
    grain = grain + noise(uv.x * 2.0, uv.y * 2.0) * 0.25;
    grain = (grain - 0.5) * uniforms.paperRoughness * 0.1;

    let finalColor = parchment + vec3<f32>(grain);
    return vec4<f32>(finalColor, 1.0);
}
`;
