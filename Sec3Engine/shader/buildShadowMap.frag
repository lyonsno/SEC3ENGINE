


varying float v_depth;


float linearizeDepth( float exp_depth) {
	
	return ( 2.0 * NEAR ) / ( FAR + NEAR - exp_depth * ( FAR - NEAR ) );
}
//-------------------------------------------------------------------MAIN:

void main(void) {
	
	float depth = (v_depth);
	depth = linearizeDepth(depth);
	// depth = depth * depth;
	gl_FragData[0] = vec4(depth, depth, depth, 1.0);

}