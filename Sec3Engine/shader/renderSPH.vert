precision highp float;

attribute vec2 a_index; 
attribute vec3 a_GeometryVerts;
attribute vec3 a_GeometryNormals;

uniform sampler2D u_testTex;
uniform sampler2D u_positions; 
uniform mat4 u_MVP;
uniform float u_particleSize;

varying vec3 worldPosition;
varying vec4 testColor;
varying vec3 normal;

void main(void) {
	vec4 pos =  texture2D(u_positions, a_index).rgba;
	worldPosition = a_GeometryVerts * u_particleSize;
	worldPosition += pos.xyz;
	normal = a_GeometryNormals;
	testColor = texture2D(u_testTex, a_index).rgba;
   	gl_Position = u_MVP * vec4(worldPosition, 1.0);
}