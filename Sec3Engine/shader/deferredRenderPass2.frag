precision highp float;

#define DISPLAY_POS 0
#define DISPLAY_NORMAL 1
#define DISPLAY_COLOR 2
#define DISPLAY_DEPTH 3
#define BIAS 0.002
#define LIGHT_INTENSITY 40.0
//--------------------------------------------------------------VARIABLES:

uniform sampler2D u_positionTex;
uniform sampler2D u_normalTex;
uniform sampler2D u_colorTex;
uniform sampler2D u_depthTex;
uniform sampler2D u_shadowMap;

uniform float u_zFar;
uniform float u_zNear;
uniform int u_displayType;

uniform mat4 u_mlp;
uniform vec3 u_lPos;
uniform vec3 u_cPos;
uniform float u_shadowMapRes;

const float offset = 1.5;
const float increment = 1.0;

varying vec2 v_texcoord;
varying vec3 v_eyeRay;  // camera to frag direction vector 
//---------------------------------------------------------HELPER METHODS:

float linearize( float exp_depth, float near, float far ) {
	
	return ( 2.0 * near ) / ( far + near - exp_depth * ( far - near ) );
}

bool inLightFrustum( vec3 uv ) {
	return (uv.x <= 1.0 && uv.x >= 0.0 && uv.y <= 1.0 && uv.y >= 0.0 && uv.z <= 1.0 && uv.z >= 0.0);
}

float isOccluded(sampler2D shadowMap, float fragDepth, vec2 uv){ 
	vec2 spotUv = (uv - 0.5); 
	float radius = sqrt(dot(spotUv, spotUv)); 
	if( (radius) < 0.49){ 
		float shadowMapDepth = linearize(texture2D( shadowMap, uv).r, u_zNear, u_zFar); 
		// float shadowMapDepth = (texture2D( shadowMap, uv).r);
		return float(shadowMapDepth < fragDepth - BIAS); 
	} 
	return 1.0; 
}

//-------------------------------------------------------------------MAIN:

void main() {
	

	vec3 normal = normalize(texture2D( u_normalTex, v_texcoord ).xyz);
	vec4 color = texture2D( u_colorTex, v_texcoord );
	float depth = texture2D( u_depthTex, v_texcoord ).r;

	vec3 eyeRay = normalize(v_eyeRay - u_cPos);  // optimize
	vec3 position =( depth * (eyeRay) ) + u_cPos;

	vec4 fragLSpace = u_mlp * vec4(position, 1.0);
	vec4 biasedLightSpacePos = fragLSpace / fragLSpace.w;
	biasedLightSpacePos.xyz = (0.5 * biasedLightSpacePos.xyz) + vec3(0.5);
	float illumination = 0.0;
	float shadowing = 0.0;
	float sum = 0.0;
	if( inLightFrustum(biasedLightSpacePos.xyz) ) {
		illumination = 1.0;
		float fragmentDepth = 0.0 + biasedLightSpacePos.z;
		fragmentDepth = linearize( fragmentDepth, u_zNear, u_zFar);
		for( float y = -offset; y <= offset; y += increment ){
			for( float x = -offset; x <= offset; x += increment ){
				sum += isOccluded( u_shadowMap, fragmentDepth, biasedLightSpacePos.xy + (vec2(x,y) / u_shadowMapRes));
			}
		}
		shadowing += 1.0 - ( sum / 16.0 );
	}
	vec3 toLight = normalize(u_lPos - position); 
	float lambertTerm = max(dot(normal, toLight), 0.0);
	illumination = lambertTerm * shadowing * LIGHT_INTENSITY / pow( fragLSpace.z, 2.0 );

	// gl_FragData[0] = vec4((biasedLightSpacePos.xy * illumination), fragmentDepth, 1);
	// gl_FragData[0] = vec4(vec3(fragmentDepth), 1);
	// gl_FragData[0] = vec4(normalize(position.rgb), 1);
    // gl_FragData[0] = vec4(normalize(testPos.rgb), 1 );
    gl_FragData[0] = vec4(color.rgb * illumination, color.a);
}