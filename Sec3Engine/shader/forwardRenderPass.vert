precision highp float;

//--------------------------------------------------------------VARIABLES:

attribute vec3 a_pos;
attribute vec3 a_normal;
attribute vec2 a_texcoord;

// uniform mat4 u_projection;
uniform mat4 u_modelLight;
uniform mat4 u_modelview;
uniform mat4 u_mvp;
uniform mat4 u_mlp;
uniform mat4 u_normalMat;

varying vec4 v_pos;
varying vec3 v_normal;
varying vec2 v_texcoord;
varying float v_depth;
varying vec4 v_lightSpacePos;

//-------------------------------------------------------------------MAIN:

void main(void) {

	gl_Position = u_mvp * vec4( a_pos, 1.0 );

	// gl_Position = u_mlp * vec4( a_pos, 1.0 );

	v_pos = u_modelview * vec4( a_pos, 1.0 );

	 v_lightSpacePos = u_mlp * vec4( a_pos, 1.0 );
	// v_lightSpaceDepth = ( v_lightSpacePos.z / gl_Position.w + 1.0) /2.0;
	// v_lightSpacePos.xy = 0.5 + v_lightSpacePos.xy * 0.5; 

	v_normal = vec3( u_normalMat * vec4(a_normal,0.0) );

	v_texcoord = a_texcoord;

	v_depth = ( gl_Position.z / gl_Position.w + 1.0 ) / 2.0;
}