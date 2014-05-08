precision highp float;

//--------------------------------------------------------------VARIABLES:
const int NUM_WEIGHTS = 15;
const float PI = 3.14159265358979;
attribute vec3 a_pos;
attribute vec2 a_texcoord;
uniform float u_lilSig;

varying vec2 v_texcoord;
varying float v_weight[NUM_WEIGHTS];

//-------------------------------------------------------------------MAIN:

   void normalizeWeights() {

      float sum = 0.0;

      for (int i = 0; i < NUM_WEIGHTS; i++) {

         sum += v_weight[i];      
      }

      sum *= 2.0;

      sum -= v_weight[0];

      for (int i = 0; i < NUM_WEIGHTS; i++) {

         v_weight[i] /= sum;      }
   }

//--------------------------------------
void main(void) {

	float gauss = 1.0 / sqrt(2.0 * PI * (u_lilSig));
   	
	float denom = 2.0 * (u_lilSig);
   float exponent;
   float finalGauss;
	for(int i = 0; i < NUM_WEIGHTS; i++){
		
		exponent = float(-i) * float(i) / denom;
		finalGauss = gauss * exp(exponent);
      v_weight[i] = finalGauss;
      
	}
   
   normalizeWeights();

	v_texcoord = a_texcoord * 0.5 + vec2(0.5);

    gl_Position = vec4( a_pos, 1.0 );
}