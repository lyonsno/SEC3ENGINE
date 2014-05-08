precision highp float;

//--------------------------------------------------------------VARIABLES:

attribute vec3 a_pos;

uniform mat4 u_mlp;

varying float v_depth;

//-------------------------------------------------------------------MAIN:

void main(void) {

	gl_Position = u_mlp * vec4( a_pos, 1.0 );

	v_depth = ( gl_Position.z / gl_Position.w + 1.0 ) / 2.0;
	// v_depth = gl_Position.z;
	
}