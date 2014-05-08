precision highp float;

attribute vec3 a_pos;
attribute vec2 a_texCoord;

varying vec2 v_texCoord;

void main(void) {
	// scale vertex attribute to [0-1] range
	v_texCoord = a_texCoord * 0.5 + vec2(0.5);
   	gl_Position = vec4(a_pos, 1.0);
}