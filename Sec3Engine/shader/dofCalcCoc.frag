
precision highp float;

//--------------------------------------------------------------VARIABLES:

//uniform sampler2D u_blurredBackground;
uniform sampler2D u_blurredForeground;
uniform sampler2D u_downsampled;
varying vec2 v_texcoord;

//----------------------------------------------------------------METHODS:


//-------------------------------------------------------------------MAIN:

void main() {

	vec4 nearBlurredTexel = texture2D( u_blurredForeground, v_texcoord );
	vec4 lowResTexel = texture2D( u_downsampled, v_texcoord );

	float coc = 2.0 * max(lowResTexel.a, nearBlurredTexel.a) - lowResTexel.a;

	gl_FragData[0] = vec4(lowResTexel.rgb, coc);

}
