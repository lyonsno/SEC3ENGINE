precision highp float;

#define VERTICAL 1
#define HORIZONTAL 0
const int NUM_WEIGHTS = 15;
const int PIXELS_SAMPLED_PER_DIR = 15;
const float PIXELS_PER_WEIGHT = float(PIXELS_SAMPLED_PER_DIR) / float(NUM_WEIGHTS);
//--------------------------------------------------------------VARIABLES:

//uniform sampler2D u_positionTex;


uniform sampler2D u_source; // texture unit 0
uniform int u_blurDirection;
uniform vec2 u_pixDim;

varying float v_weight[NUM_WEIGHTS];
varying vec2 v_texcoord;


//----------------------------------------------------------------METHODS:
vec2 getTexelUv( vec2 offset) {
	return offset * u_pixDim + v_texcoord;
}

vec4 getPixelColor(vec2 direction) {
	vec4 color = texture2D( u_source, v_texcoord ) * v_weight[0];

	for( int i = 1; i < int(PIXELS_PER_WEIGHT) * NUM_WEIGHTS; i++) {

			// float bias = mod(float(i), PIXELS_PER_WEIGHT) / PIXELS_PER_WEIGHT; 
			// float largeWeight = v_weight[1 + ( (i / int(PIXELS_PER_WEIGHT)))];
			// float smallWeight = v_weight[i / int(PIXELS_PER_WEIGHT)];
			// float weight = (1.0 - bias) * smallWeight + bias * largeWeight;

			float weight = v_weight[i];
			vec2 uv = getTexelUv(direction * float(i));
			vec4 weightedColorAbove = texture2D( u_source, uv) * weight;
			color += weightedColorAbove;

			uv = getTexelUv(direction * float(-i));
			vec4 weightedColorBelow = texture2D( u_source, uv) * weight;

			color += weightedColorBelow;

	}
	return color;
}
//-------------------------------------------------------------------MAIN:

void main() {
	
	vec4 color;
	if( u_blurDirection == VERTICAL) {
	    color = getPixelColor(vec2(0.0, 1.0));
	    
	}

	else if ( u_blurDirection == HORIZONTAL ) {
	    color = getPixelColor(vec2(1.0, 0.0));
	}
	    gl_FragData[0] = color;
	
}