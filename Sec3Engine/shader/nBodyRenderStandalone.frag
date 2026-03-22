precision highp float;

const vec3 particleColor = vec3(0.35, 0.78, 1.0);

uniform float uAlpha;
uniform float uLuminence;
uniform float uScatterMultiply;
uniform float uShadowMultiply;
uniform float uScale;

float linearize(float exp_depth, float near, float far) {
    return (2.0 * near) / (far + near - exp_depth * (far - near));
}

void main(void) {
    float depth = linearize(gl_FragCoord.z, 0.6, 30.0);
    float edge = max(1.0 - length((2.0 * gl_PointCoord) - 1.0), 0.0);
    float edgeGlow = edge * edge;
    float distanceFade = clamp(1.35 - depth, 0.35, 1.35);
    float brightness = (0.3 + (0.02 * uLuminence)) * (0.7 + (0.15 * uScatterMultiply));
    brightness += 0.02 * sqrt(max(uScale, 1.0));
    brightness += 0.08 * uShadowMultiply;
    float alpha = max(uAlpha, 0.001) * distanceFade * edgeGlow;

    gl_FragColor = vec4(particleColor * brightness, alpha);
}
