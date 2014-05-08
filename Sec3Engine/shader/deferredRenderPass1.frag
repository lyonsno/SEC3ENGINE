#extension GL_EXT_draw_buffers: require

precision highp float;
//--------------------------------------------------------------VARIABLES:

uniform sampler2D u_sampler;
uniform vec3 u_cPos;

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
    // color.rgb = (color.rgb * color.rgb); // gamma correct texture TODO uncomment
    vec3 toLight = normalize( vec3( 0.1, 10.0, 1.0) - (u_cPos + v_pos.rgb) ); // TODO temp
	float lambertTerm = clamp(dot(normal.rgb, toLight), 0.2, 1.0); // TODO temp
	// color = (normal + 1.0) * 0.5; // TODO temp
	color = vec4( 0.3, 0.2, 0.1, 1.0 );
	color.rgb *= lambertTerm * 1.0; // TODO temp
	// color.rgb = clamp( color.rgb, 0.0, 1.9); // TODO temp
	float distance = length(v_pos.xyz);
	float distColor = (distance - 7.0) / 6.0; // TODO temp
	distColor = distColor * distColor; // TODO temp
	gl_FragData[0] = vec4( distColor, distColor, distColor, 1.0); // TODO replace with gl_FragData[0] = vec4( v_pos.rgb, 1.0);
	gl_FragData[1] = normal;
	gl_FragData[2] = vec4(color.rgb, 1.0);
	gl_FragData[3] = vec4( distance, 0, 0, 1.0 );
}