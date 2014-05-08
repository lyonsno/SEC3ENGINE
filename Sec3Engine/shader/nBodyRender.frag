precision highp float;

const float EPSILON = 0.0005;
const vec3 color = vec3(0.4, 0.8, 1.0);
const vec3 shadowColor = vec3(0.004, 0.008, 0.01);

uniform sampler2D u_gDepth;
uniform vec2 u_screenSize;
uniform float uAlpha;
uniform sampler2D uShadowMap;
uniform vec3 uLightPosition;
uniform mat4 uShadowMapTransform;
uniform float uLuminence;
uniform float uScatterMultiply;
uniform float uShadowMultiply;
uniform float uScale;
uniform vec3 u_cPos;
varying vec3 worldPosition;

bool withinLightFrustum(vec3 coordinate) {
 	return coordinate.x > 0.0 && 
 		   coordinate.x < 1.0 &&
 		   coordinate.z > 0.0 && 
 		   coordinate.z < 1.0 && 
 		   coordinate.y > 0.0 && 
 		   coordinate.y < 1.0;

 }

float linearize( float exp_depth, float near, float far ) {
	
	return ( 2.0 * near ) / ( far + near - exp_depth * ( far - near ) );
}

void main(void) {
	
    float u = gl_FragCoord.x / u_screenSize.x;
    float v = gl_FragCoord.y / u_screenSize.y;
   	float gDepth = texture2D(u_gDepth, (vec2(u, v))).r;
   	float depth = gl_FragCoord.z;
   	vec4 v_color = vec4(u, v, 0.0, 0.06);

   	if( depth > gDepth ){
   		discard;
   	}
   	float distanceFade = pow((1.5 - linearize(depth, 0.6, 30.0)), 2.0);
   	float softenEdge = max(1.0 - length(2.0 * gl_PointCoord - 1.0), 0.0);
   	float alpha = uAlpha * distanceFade * softenEdge;
   	alpha = alpha * alpha;	
	vec4 lightSpacePos = uShadowMapTransform * vec4(worldPosition, 1.0);
	lightSpacePos /= lightSpacePos.w;

	lightSpacePos.xyz = 0.5 + (lightSpacePos.xyz * 0.5);
	
	float shadowDepth = linearize(texture2D(uShadowMap, lightSpacePos.xy).b, 0.6, 30.0);

 
   	// ---SET COLOR 	
   	
   	vec3 lightVector = worldPosition - uLightPosition;
    float lightDistance = length(lightVector);
   	float lightSquaredDistance = (lightDistance * lightDistance);
   	float luminence;
   	float amount;
   	// if point transformed into light space is inside of light view frustum, 
	if( ! withinLightFrustum(lightSpacePos.xyz)) {
		shadowDepth = 1.0 * lightDistance / 30.0;
		// luminence = uShadowMultiply;
		amount = 0.5;
		luminence = 0.023 * lightSquaredDistance;

	}
	else {
		v_color = vec4(shadowColor, alpha);
		vec2 spotUv = (lightSpacePos.xy - 0.5); 
		float radius = sqrt(dot(spotUv, spotUv));
		if( (radius) > 0.49){ 
			shadowDepth = 0.0;
		}
		vec3 cameraToPoint = normalize( u_cPos - worldPosition );
		vec3 lightToPoint = normalize(uLightPosition - worldPosition);
		amount = clamp((-0.2 * dot(cameraToPoint, lightToPoint)) + 0.4, 0.2, 0.5);
		luminence = (1.0 - amount) * uLuminence * 2.0;
	}
	vec3 lightFalloff = color / lightSquaredDistance;
	// amount = sqrt(amount);	
	if(EPSILON + shadowDepth < linearize(lightSpacePos.z, 0.6, 30.0)) {  // current particle is 
		
		float occluderDistance = (lightSpacePos.z - shadowDepth) * uScale;
		float occluderDistanceSquared = occluderDistance * occluderDistance;
		float falloff = luminence / ( occluderDistanceSquared * amount * amount);
		v_color = vec4( (( (uScatterMultiply - amount) * lightFalloff) * falloff) + (uShadowMultiply * shadowColor ), alpha);
		
		// v_color.a = (amount) * alpha + ((1.0 - amount) * length((v_color.rgb)));
		v_color.a += (0.9 - max(amount, 0.0)) * alpha * min( length(v_color.rgb), 1.0);
	}
	else {
		v_color = vec4( lightFalloff * luminence * (4.0 - (3.0 * amount)), alpha);// + (alpha * uLuminence * 0.06 / max(1.0, lightSquaredDistance) ));//	 + min((2.0/ lightSquaredDistance),alpha));
		// v_color.a += (0.9 - max(amount, 0.0)) * alpha * min( length(v_color.rgb), 1.0);
		
	}
	// v_color = vec4(0.1);
	// v_color.r = (amount);

	// v_color.a *= length(v_color.rgb);
	v_color.a = v_color.a;
	gl_FragData[0] = vec4(v_color);
	gl_FragData[1] = vec4(vec3(depth), 1.0);
	// float magnitude = length(gl_FragColor);
	// gl_FragColor.a = uAlpha * max(1.0, magnitude);
	// gl_FragColor.rgb += vec3(0.08);
	// gl_FragColor.rgb *= 0.8;

 } 

 