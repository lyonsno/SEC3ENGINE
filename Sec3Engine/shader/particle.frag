precision highp float;

uniform sampler2D u_Sampler;

varying float v_Lifespan;

void main(void) {
    vec4 texColor = texture2D(u_Sampler, gl_PointCoord);

    gl_FragColor = vec4(texColor.rgb, texColor.a * v_Lifespan);
}