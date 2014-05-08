
precision highp float;

attribute vec3 a_vpos;

uniform mat4 u_persp;
uniform mat4 u_mv;

void main(void){
	gl_Position = u_persp * u_mv * vec4( a_vpos, 1.0 );
}