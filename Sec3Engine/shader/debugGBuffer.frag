precision highp float;
//--------------------------------------------------------------VARIABLES:

uniform sampler2D u_positionTex;
uniform sampler2D u_normalTex;
uniform sampler2D u_colorTex;
uniform sampler2D u_depthTex;

uniform float u_zFar;
uniform float u_zNear;

varying vec2 v_texcoord;
//---------------------------------------------------------HELPER METHODS:

float linearize( float exp_depth, float near, float far ) {
	
	return ( 2.0 * near ) / ( far + near - exp_depth * ( far - near ) );
}

//-------------------------------------------------------------------MAIN:

void main() {

	vec3 normal = normalize(texture2D( u_normalTex, v_texcoord ).xyz);
	vec3 position = texture2D( u_positionTex, v_texcoord ).xyz;
	float depth = texture2D( u_depthTex, v_texcoord ).r;
	depth = linearize( depth, u_zNear, u_zFar );

	gl_FragData[0] = vec4(position, 1);
    gl_FragData[1] = vec4( vec3(depth), 1 );
    gl_FragData[2] = vec4( normal, 1 );

}