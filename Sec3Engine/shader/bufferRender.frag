precision highp float;

#define DISPLAY_POS 0
#define DISPLAY_NORMAL 1
#define DISPLAY_COLOR 2
#define DISPLAY_DEPTH 3

//--------------------------------------------------------------VARIABLES:

uniform sampler2D u_positionTex;
uniform sampler2D u_normalTex;
uniform sampler2D u_colorTex;
uniform sampler2D u_depthTex;

uniform float u_zFar;
uniform float u_zNear;
uniform int u_displayType;

varying vec2 v_texcoord;

//---------------------------------------------------------HELPER METHODS:

float linearizeDepth( float exp_depth, float near, float far ) {
	
	return ( 2.0 * near ) / ( far + near - exp_depth * ( far - near ) );
}

//-------------------------------------------------------------------MAIN:

void main() {

	vec3 normal = texture2D( u_normalTex, v_texcoord ).xyz;
	vec3 position = texture2D( u_positionTex, v_texcoord ).xyz;
	vec4 color = texture2D( u_colorTex, v_texcoord );
	vec3 cascadeCols = texture2D( u_depthTex, v_texcoord ).rgb;

    if( u_displayType == DISPLAY_DEPTH )
	    gl_FragData[0] = vec4( cascadeCols, 1 );
	else if( u_displayType == DISPLAY_COLOR )
	    gl_FragData[0] = color;
	else if( u_displayType == DISPLAY_NORMAL )
	    gl_FragData[0] = vec4( normal, 1 );
	else
	    gl_FragData[0] = vec4( position, 1 );
}