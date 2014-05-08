

attribute vec4 a_Particle;

uniform mat4 u_mv;
uniform mat4 u_persp;
uniform float u_PointSize;

varying float v_Lifespan;

void main(void) {
    gl_Position = u_persp * u_mv * vec4(a_Particle.xyz, 1.0);
    v_Lifespan = a_Particle.w;
    gl_PointSize = 14.0 * v_Lifespan;
}