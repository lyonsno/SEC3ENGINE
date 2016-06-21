#extension GL_EXT_draw_buffers: require

precision highp float;
//--------------------------------------------------------------VARIABLES:

uniform sampler2D u_sampler;

varying vec4 v_pos;
varying vec3 v_normal;
varying vec2 v_texcoord;
varying float v_depth;


float linearizeDepth( float exp_depth) {
	
	return ( 2.0 * 0.6 ) / ( 30.0 + 0.6 - exp_depth * ( 30.0 - 0.6 ) );
}

//-------------------------------------------------------------------MAIN:

void main(void) {
	vec4 normal = vec4( normalize(v_normal).rgb, 1.0);
    vec4 color = texture2D( u_sampler, v_texcoord );
    color.rgb = (color.rgb * color.rgb); // gamma correct texture 
	
	gl_FragData[0] = vec4( v_pos.rgb, 1.0);
	gl_FragData[1] = normal;
	gl_FragData[2] = color;
	gl_FragData[3] = vec4( length(v_pos.xyz), 0, 0, 0 );
}