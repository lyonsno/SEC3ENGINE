#extension GL_EXT_draw_buffers: require

precision highp float;

//--------------------------------------------------------------VARIABLES:

uniform sampler2D u_sampler;
// uniform sampler2D u_shadowMap;
varying vec4 v_pos;
// varying vec4 v_lightSpacePos;
varying vec3 v_normal;
varying vec2 v_texcoord;
varying float v_depth;

//-------------------------------------------------------------------MAIN:

void main(void) {
    vec4 color = texture2D( u_sampler, v_texcoord );		
	// float shadowMapDepth = texture2D( u_shadowMap, v_lightPos.xy );
	// float fragmentDepth = v_lightSpacePos.z;

	if ( shadowMapDepth < fragmentDepth ) {
		// color.rgb *= 0.3;
	}


	gl_FragData[0] = v_pos;
	gl_FragData[1] = vec4( normalize(v_normal), 1.0 );
	gl_FragData[2] = color;
	gl_FragData[3] = vec4( v_depth, 0, 0, 0 );
}