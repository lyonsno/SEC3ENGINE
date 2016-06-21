
precision highp float;

//--------------------------------------------------------------VARIABLES:

//uniform sampler2D u_blurredBackground;
uniform sampler2D u_blurredForeground;
uniform sampler2D u_unalteredImage; // keep? could already have this in one of the framebuffers 
uniform sampler2D u_downsampled;
uniform sampler2D u_smallBlur;
uniform sampler2D u_depth;
uniform vec2 u_farEq;

uniform float u_near;
uniform float u_far;

varying vec2 v_texcoord;

//----------------------------------------------------------------METHODS:

float linearizeDepth( float exp_depth ) {
	
	return ( 2.0 * u_near ) / ( u_far + u_near - exp_depth * ( u_far - u_near ) );
}

//-------------------------------------------------------------------MAIN:

void main() {
	vec4 finalCoc = texture2D( u_downsampled, v_texcoord );
	float farSceneDepth = linearizeDepth(texture2D( u_depth, v_texcoord ).r);
	float farCoc = clamp( farSceneDepth * u_farEq.x + u_farEq.y, 0.0, 1.0);
	float coc = max(finalCoc.a, farCoc * 0.8);
	vec3 colorTest = vec3(0.0);
	// Calc texel colors to interpolate between

	vec3 interpolatedTexel = vec3(0.0);

	if( coc > 0.66666 ) {

		vec3 maxBlurColor = texture2D( u_blurredForeground, v_texcoord ).rgb;
		vec3 midBlurColor = 3.0 * (1.0 - coc) * finalCoc.rgb;
		maxBlurColor = 3.0 * (coc - 0.666 ) * maxBlurColor;
		interpolatedTexel = midBlurColor + maxBlurColor;
		colorTest.r = 1.0;
	}
	
	else if ( coc > 0.33333) {
		vec3 smallBlur = texture2D( u_smallBlur, v_texcoord ).rgb;
		vec3 midBlurColor = 3.0 * (0.666 - coc) * smallBlur;
		vec3 maxBlurColor = 3.0 * (coc - 0.333) * finalCoc.rgb;
		interpolatedTexel = midBlurColor + maxBlurColor;
		colorTest.g = 1.0;
	}

	else {
		vec3 smallBlur = texture2D( u_smallBlur, v_texcoord ).rgb;
		vec3 fullResTexel = texture2D( u_unalteredImage, v_texcoord ).rgb;
		vec3 biasedLow = 3.0 * (0.333 - coc) * fullResTexel;
		vec3 biasedHigh = 3.0 * coc * smallBlur;
		interpolatedTexel = biasedLow + biasedHigh;
		colorTest.b = 1.0;
	}
	
	gl_FragData[0] = vec4(interpolatedTexel.rgb, 1.0);

}
