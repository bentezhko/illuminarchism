/**
 * Medieval Shader Module
 * GLSL shaders for parchment texture, ink wobble, and watercolor effects
 */

export const VERTEX_SHADER = `#version 300 es
precision highp float;

// Attributes
in vec2 a_position;      // Start position (Keyframe 1)
in vec2 a_nextPosition;  // End position (Keyframe 2)
in vec2 a_texCoord;
in vec3 a_color;
in float a_validStart;   // Entity valid start year (for visibility)
in float a_yearStart;    // Keyframe 1 year
in float a_yearEnd;      // Keyframe 2 year

// Uniforms
uniform mat3 u_matrix;        // Transform matrix (pan, zoom)
uniform float u_currentYear;  // Current timeline position
uniform float u_wobble;       // Hand-drawn wobble intensity
uniform float u_time;         // Animation time for effects

// Outputs to fragment shader
out vec2 v_texCoord;
out vec3 v_color;
out float v_visibility;       // Fade in/out based on year
out vec2 v_wobbleOffset;

// Simple noise function for wobble
float noise(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
    // Calculate visibility based on temporal range
    float yearDiff = abs(u_currentYear - a_validStart);
    v_visibility = smoothstep(100.0, 0.0, yearDiff);
    
    // Interpolate position based on year
    float t = 0.0;
    float duration = a_yearEnd - a_yearStart;
    if (duration > 0.001) {
        t = clamp((u_currentYear - a_yearStart) / duration, 0.0, 1.0);
    }

    vec2 basePosition = mix(a_position, a_nextPosition, t);

    // Apply hand-drawn wobble effect
    vec2 wobble = vec2(
        (noise(basePosition + vec2(u_time * 0.001)) - 0.5) * u_wobble,
        (noise(basePosition + vec2(u_time * 0.002 + 100.0)) - 0.5) * u_wobble
    );
    v_wobbleOffset = wobble;
    
    // Transform position
    vec2 position = basePosition + wobble * 0.001; // Apply subtle wobble
    vec3 transformed = u_matrix * vec3(position, 1.0);
    
    gl_Position = vec4(transformed.xy, 0.0, 1.0);
    
    v_texCoord = a_texCoord;
    v_color = a_color;
}
`;

export const FRAGMENT_SHADER = `#version 300 es
precision highp float;

// Inputs from vertex shader
in vec2 v_texCoord;
in vec3 v_color;
in float v_visibility;
in vec2 v_wobbleOffset;

// Uniforms
uniform float u_time;
uniform float u_inkBleed;     // Ink bleeding effect intensity
uniform float u_paperRough;   // Paper texture roughness
uniform sampler2D u_noiseTexture;

// Output
out vec4 outColor;

// Parchment color
const vec3 PARCHMENT = vec3(0.953, 0.914, 0.824);
const vec3 INK_BASE = vec3(0.169, 0.125, 0.094);

// Noise function for texture
float noise(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

// Perlin-like noise for paper texture
float perlinNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    
    float a = noise(i);
    float b = noise(i + vec2(1.0, 0.0));
    float c = noise(i + vec2(0.0, 1.0));
    float d = noise(i + vec2(1.0, 1.0));
    
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Watercolor bleeding effect
float watercolorBleed(vec2 uv, float intensity) {
    float bleed = 0.0;
    for (int i = 0; i < 3; i++) {
        float offset = float(i) * 0.1;
        bleed += perlinNoise(uv * 10.0 + offset) * (1.0 - float(i) * 0.3);
    }
    return bleed * intensity;
}

void main() {
    // Early discard for invisible fragments
    if (v_visibility < 0.01) {
        discard;
    }
    
    // Paper texture
    vec2 paperUV = gl_FragCoord.xy * 0.5;
    float paperNoise = perlinNoise(paperUV) * u_paperRough * 0.02;
    
    // Ink color with bleeding
    vec3 inkColor = v_color * INK_BASE;
    float bleed = watercolorBleed(v_texCoord, u_inkBleed * 0.1);
    
    // Mix ink with paper texture
    vec3 finalColor = mix(PARCHMENT, inkColor, v_visibility * 0.4);
    finalColor += vec3(paperNoise);
    finalColor += vec3(bleed * 0.05);
    
    // Add slight vignette for medieval feel
    float dist = length(v_texCoord - 0.5);
    float vignette = 1.0 - smoothstep(0.3, 0.8, dist);
    finalColor *= 0.7 + vignette * 0.3;
    
    outColor = vec4(finalColor, v_visibility);
}
`;

// Background parchment shader (full-screen quad)
export const PARCHMENT_VERTEX_SHADER = `#version 300 es
precision highp float;

in vec2 a_position;
out vec2 v_uv;

void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_uv = a_position * 0.5 + 0.5;
}
`;

export const PARCHMENT_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform float u_time;
uniform float u_paperRoughness;

// Noise function
float noise(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

float perlinNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    
    float a = noise(i);
    float b = noise(i + vec2(1.0, 0.0));
    float c = noise(i + vec2(0.0, 1.0));
    float d = noise(i + vec2(1.0, 1.0));
    
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void main() {
    // Base parchment color
    vec3 parchment = vec3(0.953, 0.914, 0.824);
    
    // Multi-scale paper grain
    vec2 uv = v_uv * 1000.0;
    float grain = 0.0;
    grain += perlinNoise(uv * 1.0) * 0.5;
    grain += perlinNoise(uv * 2.0) * 0.25;
    grain += perlinNoise(uv * 4.0) * 0.125;
    grain = (grain - 0.5) * u_paperRoughness * 0.1;
    
    // Add subtle aging spots
    float spots = perlinNoise(v_uv * 50.0 + u_time * 0.0001);
    spots = smoothstep(0.7, 0.9, spots) * 0.05;
    
    vec3 finalColor = parchment + vec3(grain) - vec3(spots);
    
    outColor = vec4(finalColor, 1.0);
}
`;
