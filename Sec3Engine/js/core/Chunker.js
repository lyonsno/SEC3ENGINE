var SEC3 = SEC3 || {};

SEC3.Chunker = {};
SEC3.Chunker.methods = {};
/*
 * Returns a method to convert log space between near and far values to linear between 0.0 and 1.0 
 */
 SEC3.Chunker.methods.linearize = function () {

	return "" +

	"float linearize( float exp_depth, float near, float far) { \n" +
		"return ( 2.0 * near ) / ( far + near - exp_depth * ( far - near ) ); \n" +
	"} \n";
 };


//
// Description : Array and textureless GLSL 2D simplex noise function.
//      Author : Ian McEwan, Ashima Arts.
//  Maintainer : ijm
//     Lastmod : 20110822 (ijm)
//     License : Copyright (C) 2011 Ashima Arts. All rights reserved.
//               Distributed under the MIT License. See LICENSE file.
//               https://github.com/ashima/webgl-noise
// 

SEC3.Chunker.methods.noise2D = function () {

	return "" +  

	"vec3 mod289(vec3 x) { \n" +
	"  return x - floor(x * (1.0 / 289.0)) * 289.0; \n" +
	"} \n" +

	"vec2 mod289(vec2 x) { \n" +
	"  return x - floor(x * (1.0 / 289.0)) * 289.0; \n" +
	"} \n" +

	"vec3 permute(vec3 x) { \n" +
	"  return mod289(((x*34.0)+1.0)*x); \n" +
	"} \n" +

	"float noise2D(vec2 v) \n" +
	"  { \n" +
	"  const vec4 C = vec4(0.211324865405187,\n" +  // (3.0-sqrt(3.0))/6.0
	"                      0.366025403784439,\n" +  // 0.5*(sqrt(3.0)-1.0)
	"                     -0.577350269189626,\n" +  // -1.0 + 2.0 * C
	"                      0.024390243902439);\n" + // 1.0 / 41.0
	// First corner
	"  vec2 i  = floor(v + dot(v, C.yy) ); \n" +
	"  vec2 x0 = v -   i + dot(i, C.xx); \n" +

	// Other corners
	"  vec2 i1; \n" +
	  //i1.x = step( x0.y, x0.x ); // x0.x > x0.y ? 1.0 : 0.0
	  //i1.y = 1.0 - i1.x;
	"  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0); \n" +
	  // x0 = x0 - 0.0 + 0.0 * C.xx ;
	  // x1 = x0 - i1 + 1.0 * C.xx ;
	  // x2 = x0 - 1.0 + 2.0 * C.xx ;
	"  vec4 x12 = x0.xyxy + C.xxzz; \n" +
	"  x12.xy -= i1; \n" +

	// Permutations
	"  i = mod289(i);\n" + // Avoid truncation effects in permutation 
	"  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))" +
	"		+ i.x + vec3(0.0, i1.x, 1.0 ));\n" +

	"  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0); \n" +
	"  m = m*m ; \n" +
	"  m = m*m ; \n" +

	// Gradients: 41 points uniformly over a line, mapped onto a diamond.
	// The ring size 17*17 = 289 is close to a multiple of 41 (41*7 = 287)

	"  vec3 x = 2.0 * fract(p * C.www) - 1.0; \n" +
	"  vec3 h = abs(x) - 0.5; \n" +
	"  vec3 ox = floor(x + 0.5); \n" +
	"  vec3 a0 = x - ox; \n" +

	// Normalise gradients implicitly by scaling m
	// Approximation of: m *= inversesqrt( a0*a0 + h*h );
	"  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h ); \n" +

	// Compute final noise value at P
	"  vec3 g; \n" +
	"  g.x  = a0.x  * x0.x  + h.x  * x0.y; \n" +
	"  g.yz = a0.yz * x12.xz + h.yz * x12.yw; \n" +
	"  return 130.0 * dot(m, g); \n" +
	"} \n";
};

/*
 * Returns a vertex shader program to render with cascaded shadow maps as a String
 */ 
SEC3.Chunker.renderCascadedShadowMapsVS = function (scene) {

//------------------------------------------------------DECLARATIONS:
	var declarations = "" +	
		"precision highp float; \n" +
		
		"attribute vec3 a_pos; \n" +
		"attribute vec3 a_normal; \n" +
		"attribute vec2 a_texcoord; \n" +

		"uniform mat4 u_mvp; \n" +
		
		"varying vec2 v_texcoord; \n" +
		"varying vec3 v_pos; \n" +
		"varying vec3 v_tSpaceNormal; \n";

	for( var i = 0; i < scene.getNumLights(); i++ ) {

		declarations +=	"varying vec4 v_fragLSpace" + i + "; \n" +
						"varying vec4 v_modelLightPos" + i + "; \n" +
						"uniform mat4 u_mlp" + i + "; \n" +
						"uniform mat4 u_modelLight" + i + "; \n";
	}

//--------------------------------------------------------------MAIN:

	var main = "" + 
		"void main(void) { \n" +

			"gl_Position = u_mvp * vec4( a_pos, 1.0 ); \n " +
			
			"v_tSpaceNormal = (a_normal); \n " +
			"v_texcoord = a_texcoord; \n ";

			for( var i = 0; i < scene.getNumLights(); i++ ) {

				main += "v_fragLSpace" + i + " = u_mlp" + i + " * vec4( a_pos, 1.0 ); \n " + 
					"v_modelLightPos" + i + " = u_modelLight" + i + " * vec4( a_pos, 1.0 ); \n ";
			}

	main += "" +
			"v_pos = a_pos; \n" +

		"}";

	return declarations + main;
}

/*
 * Returns a fragment shader program to render with cascaded shadow maps as a String
 */ 
SEC3.Chunker.renderCascadedShadowMapsFS = function (scene) {

	var light = scene.getLight(0); //TODO : Remove
	// size of box filter
	var kernSize = 1.5;
	// number of samples
	var numSamples = Math.pow((Math.ceil(kernSize) * 2), 2);
	numSamples = Math.max(numSamples, 1.0);
//------------------------------------------------------DECLARATIONS:
	var declarations = "" +
		"#extension GL_EXT_draw_buffers: require \n" +
		"precision highp float; \n" +

		"const float AMBIENT_INTENSITY = 0.03; \n" +
		"const float LIGHT_INTENSITY = 100.0; \n" +
		"const float SHADOW_FACTOR = 0.001; \n" +
		"const float BIAS = -0.0025; \n" +
	
		"const float zNear = float(" + scene.getCamera().zNear + "); \n" + 
		"const float zFar = float(" + scene.getCamera().zFar + "); \n" +
	
		"varying vec2 v_texcoord; \n" +
		"varying vec3 v_tSpaceNormal; \n" +
		"varying vec3 v_pos; \n" +

		"uniform sampler2D u_sampler; \n" +
		"uniform mat4 u_projection; \n" +
		"uniform vec3 u_cPos; \n" +

		// uniforms for selected light
		"uniform int u_numCascades; \n";

	for(var i =0; i < scene.getNumLights(); i++ ) {
		var light = scene.getLight(i);
		declarations += "uniform mat4 u_modelLight" + i + "; \n" +
						"varying vec4 v_modelLightPos" + i + "; \n" +
						"varying vec4 v_fragLSpace" + i + "; \n" +
						"uniform vec3 u_lPos" + i + "; \n";
				// TODO "const float zNear = " + light.zNear + "; \n" + 
				// TODO "const float zFar = " + light.zFar + "; \n" +
					

		for(var j = 0; j < light.numCascades; j++ ) {
			declarations += "uniform sampler2D u_shadowMap" + i + "_" + j + "; \n" +
							"uniform vec2 u_clipPlane" + i + "_" + j + "; \n" +
							"uniform mat4 u_cascadeMat" + i + "_" + j + "; \n" +

							"const float offset" + i + "_" + j + " = float(" + kernSize / light.cascadeFramebuffers[j].getWidth() + "); \n" + 
							"const float increment" + i + "_" + j + " = float(" + 1.0 / light.cascadeFramebuffers[j].getWidth() + "); \n";
		}

	}

//-----------------------------------------------------------METHODS:

	var methods = "" +

		SEC3.Chunker.methods.linearize() +

		SEC3.Chunker.methods.noise2D() +

		"bool isValid( vec3 uv ) { \n" +
			"return (uv.x <= 1.0 && uv.x >= 0.0 && uv.y <= 1.0 && uv.y >= 0.0 && uv.z <= 1.0 && uv.z >= 0.0);\n" +
		"} \n" +

		/* 
		 * Returns 1.0 if fragment is occluded, 0.0 if not 
		 */
		"float isOccludedSpot(sampler2D shadowMap, float fragDepth, vec2 uv){ \n" +
			"vec2 spotUv = (uv - 0.5); \n" +
			"float radius = sqrt(dot(spotUv, spotUv)); \n" +
			"if( (radius) < 0.49){ \n" +
				"float shadowMapDepth = linearize(texture2D( shadowMap, uv).r, zNear, zFar); \n" +
				"return float(shadowMapDepth < fragDepth + BIAS); \n" +
			"} \n" +
			"return 1.0; \n" +
		"}\n" +
		/* 
		 * Returns 1.0 if fragment is occluded, 0.0 if not 
		 */
		"float isOccluded(sampler2D shadowMap, float fragDepth, vec2 uv){ \n" +
			"vec2 spotUv = (uv - 0.5); \n" +
			"float shadowMapDepth = texture2D( shadowMap, uv).r; \n" +
			"return float(shadowMapDepth < fragDepth + BIAS); \n" +

			"return 1.0; \n" +
		"}\n" +

		/*
	 	 * Returns color of fragment's cascade in selected light
	 	 */

	 	"vec3 getCascadeColor(float depth) {\n" +
	 		"float red = noise2D( vec2( floor(mod( depth * float(u_numCascades), float(u_numCascades) )), 0.1));\n" +
			"float green = noise2D( vec2( floor(mod( depth * float(u_numCascades), float(u_numCascades) )), 0.3275));\n" +
			"float blue = noise2D( vec2( floor(mod( depth * float(u_numCascades), float(u_numCascades) )), 0.71));\n" +
			"return normalize(vec3( red, blue, green ));\n" +
	 	"}\n";

//--------------------------------------------------------------MAIN:

	var main = "" + 
		"void main(void) { \n" +
			"vec3 _tSpaceNormal = normalize(v_tSpaceNormal);\n" +
			"float linearDepth = linearize(gl_FragCoord.z, zNear, zFar); \n" +
			"vec4 color = texture2D( u_sampler, v_texcoord ); \n" +
			"color.rgb = (color.rgb * color.rgb); // gamma correct texture  \n" +
			"vec3 illuminence = vec3(0.0); \n" +
			"vec3 lColor;\n" +

			"float shadowing = 0.0;\n" +			
			"float lambertTerm = 0.0;\n" +	
			"vec4 biasedLightSpacePos;\n";

	for( var i = 0; i < scene.getNumLights(); i++ ) {
		var light = scene.getLight(i);
		main += "" +
			"lColor = getCascadeColor(float(" + (i) + "));\n" + // get random color
			"shadowing = 0.0;\n" +			
			"lambertTerm = 0.0;\n" +	
			"biasedLightSpacePos = v_fragLSpace" + i + " / v_fragLSpace" + i + ".w; \n" + //TODO move to vert?
			"biasedLightSpacePos.xyz = (0.5 * biasedLightSpacePos.xyz) + vec3(0.5); \n" +

			"if( isValid(biasedLightSpacePos.xyz) ){ \n" +
				"float fragmentDepth = (biasedLightSpacePos.z); \n" +
				//"occlusion += 1.0 - averageLookups(linearDepth, biasedLightSpacePos.xy ); \n" +

				"float shadowMapDepth; \n";
			
				// Create a switch statement to select the correct map based on depth

		for( var j = 0; j < light.numCascades; j++ ) {
			if(j > 0) {
				main += "else ";
			}
		
				main += "if(linearDepth < u_clipPlane" + i + "_" + j + ".y) { \n" + // branch on cascade
					"float sum = 0.0; \n" +
					"vec4 cascadePos = u_cascadeMat" + i + "_" + j + " * v_modelLightPos" + i +"; \n";

					if (light instanceof SEC3.SpotLight) {// find depth in light space	
						
						main += "cascadePos.xyz /= cascadePos.w; \n" +
						"cascadePos.xyz = (0.5 * cascadePos.xyz) + vec3(0.5); \n" +
						"float cascadeDepth = linearize(cascadePos.z, zNear, zFar); \n";
					}
					else if (light instanceof SEC3.DiLight) {

						main += "cascadePos.xyz /= cascadePos.w; \n" +
						"cascadePos.xyz = (0.5 * cascadePos.xyz) + vec3(0.5); \n" +
						"float cascadeDepth = cascadePos.z;\n";
					}
					main += "" +
					"for( float y = -offset" + i + "_" + j + "; y <= offset" + i + "_" + j + "; y += increment" + i + "_" + j + "){ \n" +
						"for( float x = -offset" + i + "_" + j + "; x <= offset" + i + "_" + j + "; x += increment" + i + "_" + j + "){ \n";
							if ( light instanceof SEC3.SpotLight) {
								main += "sum += isOccludedSpot( u_shadowMap" + i + "_" + j + ", cascadeDepth, biasedLightSpacePos.xy + vec2(x,y) ); \n";
							}
							else if ( light instanceof SEC3.DiLight ) {
								main += "sum += isOccluded( u_shadowMap" + i + "_" + j + ", cascadeDepth, biasedLightSpacePos.xy + vec2(x,y) ); \n";
							}
						main += "} \n" +	
					"} \n" +
					"shadowing = 1.0 - ( sum / float(" + numSamples + ")); \n" +
				"} \n";
		}

		main += (function(){
				
				var shadeSpot = "" +
				"vec3 toLight = normalize(u_lPos" + i + " - v_pos); \n " +
				"lambertTerm = max(dot(_tSpaceNormal, toLight), 0.0); \n" +
				"illuminence += lColor * lambertTerm * shadowing * LIGHT_INTENSITY / pow( v_fragLSpace" + i + ".z, 2.0 ); \n";

				var shadeDirectional = "" +
				"vec3 toLight = normalize(u_lPos" + i + "); \n " +
				"lambertTerm = max(dot(_tSpaceNormal, toLight), 0.0); \n" +
				"illuminence += lColor * lambertTerm * shadowing * LIGHT_INTENSITY / 80.0; \n";

				if(light instanceof SEC3.SpotLight) {
					return shadeSpot;
				}
				else if(light instanceof SEC3.DiLight) {
					return shadeDirectional;
				}
				else {
					console.log("CHUNKER ERROR: Not instance of known Light type");
				}

			})();

		main +=	"} \n";
	}
	main += "illuminence += vec3(AMBIENT_INTENSITY); \n" +
			"color.rgb *= illuminence; \n" +
			"vec3 cascadeColors = getCascadeColor(linearDepth);\n" +				
			"gl_FragData[0] = vec4(vec3(illuminence), 1.0); \n" + // diffuse illumination
			"gl_FragData[1] = vec4(vec3(_tSpaceNormal), 1.0); \n" +
			"gl_FragData[2] = sqrt(color); \n" + // reGamma correct result of our hokey forward shading
			"gl_FragData[3] = vec4( 2.0 * sqrt(cascadeColors * color.rgb),  sqrt(color.a) ); \n" +
		"} \n";
	var text = declarations + methods + main;
	console.log(text);
	return text;
}