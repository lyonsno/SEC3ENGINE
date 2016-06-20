precision highp float;

//--------------------------------------------------------------VARIABLES:

uniform sampler2D u_colorTex;

varying vec2 v_texcoord;


//-------------------------------------------------------------------MAIN:

float LinearizeDepth(in vec2 uv)
{
    float zNear = 0.2;    // TODO: Replace by the zNear of your perspective projection
    float zFar  = 20.0; // TODO: Replace by the zFar  of your perspective projection
    float depth = texture2D(u_colorTex, uv).x;
    return (2.0 * zNear) / (zFar + zNear - depth * (zFar - zNear));
}

void main() {

	float c = LinearizeDepth(v_texcoord);
	gl_FragColor = vec4(c, c, c, 1.0);
}



