precision highp float;


#define TEXTURE 0
#define DEPTH 1

//--------------------------------------------------------------VARIABLES:
 
uniform sampler2D u_source; 
uniform vec2 u_pixDim;
uniform int u_writeSlot;

varying vec2 v_texcoord;


//----------------------------------------------------------------METHODS:
vec2 getTexelUv( vec2 offset) {
	return offset * u_pixDim + v_texcoord;
}

// returns the average of four nearest texels 
vec4 averageTexels() { 

	vec4 summedTexels = texture2D( u_source, getTexelUv(vec2(-0.5, 0.5)) );
	summedTexels += texture2D( u_source, getTexelUv(vec2(0.5,0.5)));
	summedTexels += texture2D( u_source, getTexelUv(vec2(0.5,-0.5)));
	summedTexels += texture2D( u_source, getTexelUv(vec2(-0.5,-0.5)));

	return summedTexels / 4.0;
}

float linearizeDepth( float exp_depth, float near, float far ) {
	
	return ( 2.0 * near ) / ( far + near - exp_depth * ( far - near ) );
}
//-------------------------------------------------------------------MAIN:

void main() {
	
	if( u_writeSlot == TEXTURE) {
		gl_FragData[TEXTURE] = averageTexels();
	}

	else if( u_writeSlot == DEPTH ) {
		
		gl_FragData[DEPTH] = averageTexels();
	}
}
