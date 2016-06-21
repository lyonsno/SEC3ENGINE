precision highp float;

//--------------------------------------------------------------VARIABLES:

attribute vec3 a_pos;
attribute vec2 a_texcoord;
attribute vec3 a_eyeRay;

// uniform vec3 u_cPos;

varying vec2 v_texcoord;
varying vec3 v_eyeRay;

//-------------------------------------------------------------------MAIN:

void main(void) {
	
    v_texcoord = a_texcoord * 0.5 + vec2(0.5);
    v_eyeRay = a_eyeRay;
    gl_Position = vec4( a_pos, 1.0 );
}



