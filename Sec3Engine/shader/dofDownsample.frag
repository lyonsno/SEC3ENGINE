precision highp float;


#define TEXTURE 0
#define DEPTH 1


//--------------------------------------------------------------VARIABLES:
uniform vec2 u_dofEq;
uniform sampler2D u_depth;
uniform sampler2D u_source; 
uniform vec2 u_pixDim;
uniform float u_near;
uniform float u_far;

varying vec2 v_texcoord;

//----------------------------------------------------------------METHODS:
float linearizeDepth( float exp_depth ) {
	
	return ( 2.0 * u_near ) / ( u_far + u_near - exp_depth * ( u_far - u_near ) );
}

vec2 getTexelUv( vec2 offset) {
	return offset * u_pixDim + v_texcoord;
}

//-------------------------------------------------------------------MAIN:

void main() {
	
	vec4 summedTexels = vec4(0.0);

	summedTexels += texture2D( u_source, getTexelUv(vec2(-0.5, 0.5)));
	summedTexels += texture2D( u_source, getTexelUv(vec2(0.5, 0.5)));
	summedTexels += texture2D( u_source, getTexelUv(vec2(0.5, -0.5)));
	summedTexels += texture2D( u_source, getTexelUv(vec2(-0.5, -0.5)));

	vec4 texelDepths;
	texelDepths.r = linearizeDepth(texture2D( u_depth, getTexelUv(vec2(-0.5, 0.5))).x);
	texelDepths.g = linearizeDepth(texture2D( u_depth, getTexelUv(vec2(0.5, 0.5))).x);
	texelDepths.b = linearizeDepth(texture2D( u_depth, getTexelUv(vec2(0.5, -0.5))).x);
	texelDepths.a = linearizeDepth(texture2D( u_depth, getTexelUv(vec2(-0.5, -0.5))).x);

	// vec4 farCocs 0.7 * texelDepths + vec4()
	vec4 cocs = u_dofEq.x * texelDepths + vec4(u_dofEq.y);
	vec4 clampedCoc = clamp(cocs, 0.0, 1.0);
	
	float averageCoc = ( clampedCoc.r + clampedCoc.g + clampedCoc.b + clampedCoc.a ) / 4.0;
	float largestCoc = max(max(clampedCoc.r, clampedCoc.g), max(clampedCoc.b, clampedCoc.a));
	gl_FragData[0] = vec4( summedTexels.rgb / 4.0, clamp( max( averageCoc, largestCoc ), 0.0, 1.0) );
	gl_FragData[1] = vec4( summedTexels.rgb / 4.0, clamp( max( averageCoc, largestCoc ), 0.0, 1.0) );

	/*
		depth[0] = tex2D( depthSampler, pixel.tcDepth0.xy + rowOfs[0] ).r;  
		depth[1] = tex2D( depthSampler, pixel.tcDepth1.xy + rowOfs[0] ).r;  
		depth[2] = tex2D( depthSampler, pixel.tcDepth2.xy + rowOfs[0] ).r;  
		depth[3] = tex2D( depthSampler, pixel.tcDepth3.xy + rowOfs[0] ).r;  

		curCoc = saturate( dofEqWorld.x * depth + dofEqWorld.y );  

		coc = curCoc;  
		depth[0] = tex2D( depthSampler, pixel.tcDepth0.xy + rowOfs[1] ).r;  
		depth[1] = tex2D( depthSampler, pixel.tcDepth1.xy + rowOfs[1] ).r;  
		depth[2] = tex2D( depthSampler, pixel.tcDepth2.xy + rowOfs[1] ).r;  
		depth[3] = tex2D( depthSampler, pixel.tcDepth3.xy + rowOfs[1] ).r;  

		curCoc = saturate( dofEqWorld.x * depth + dofEqWorld.y );  

		coc = max( coc, curCoc );  
		depth[0] = tex2D( depthSampler, pixel.tcDepth0.xy + rowOfs[2] ).r;  
		depth[1] = tex2D( depthSampler, pixel.tcDepth1.xy + rowOfs[2] ).r;  
		depth[2] = tex2D( depthSampler, pixel.tcDepth2.xy + rowOfs[2] ).r;  
		depth[3] = tex2D( depthSampler, pixel.tcDepth3.xy + rowOfs[2] ).r;  

		curCoc = saturate( dofEqWorld.x * depth + vec4(dofEqWorld.y) );  

		coc = max( coc, curCoc );  
		depth[0] = tex2D( depthSampler, pixel.tcDepth0.xy + rowOfs[3] ).r;  
		depth[1] = tex2D( depthSampler, pixel.tcDepth1.xy + rowOfs[3] ).r;  
		depth[2] = tex2D( depthSampler, pixel.tcDepth2.xy + rowOfs[3] ).r;  
		depth[3] = tex2D( depthSampler, pixel.tcDepth3.xy + rowOfs[3] ).r;  

		curCoc = saturate( dofEqWorld.x * depth + dofEqWorld.y );  

		coc = max( coc, curCoc );  
		maxCoc = max( max( coc[0], coc[1] ), max( coc[2], coc[3] ) );  
		return half4( color, maxCoc );  
	*/
}
