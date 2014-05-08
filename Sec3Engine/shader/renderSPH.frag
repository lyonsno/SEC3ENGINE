precision highp float;

uniform vec2 u_screenDims;
uniform vec3 u_camPos;
uniform sampler2D u_depth;
varying vec3 worldPosition;
varying vec4 testColor;
varying vec3 normal;

void main(void) {
	float camDistance = length( worldPosition - u_camPos );
	vec2 uv = gl_FragCoord.xy / u_screenDims;
	float depth = texture2D( u_depth, uv ).r;
	if( depth > 0.0 && camDistance > depth ) {
		discard;
	}
	vec3 u_lPos = vec3( 0.1, 5.0, 1.0);
	vec3 toLight = (u_lPos - worldPosition); 
	float falloff = 40.0 / (dot(toLight, toLight));
	toLight = normalize(toLight);
	float lambertTerm = max(dot(normalize(normal), toLight), 0.0);
	lambertTerm *= falloff;
	lambertTerm = clamp( lambertTerm, 0.6, 1.0);
	// float softenEdge = max(1.0 - length(2.0 * gl_PointCoord - 1.0), 0.0);
	// gl_FragData[0] = testColor;
	// gl_FragData[0] = vec4(testColor.r, testColor.g, 0.0, 1.0);
	// gl_FragData[0] = sqrt(vec4( lambertTerm * 0.2 * (length(testColor.rgb)) * normalize(testColor.rgb), 1.0));
	// gl_FragData[0] = vec4(0.00001 * testColor.r, 0.0, 0.2, 1.0);
	// gl_FragData[0] = vec4(testColor.r, 0.0, 0.2, 1.0);
	gl_FragData[0] = vec4(lambertTerm * mix(vec3(0.1, 0.3, 0.4), vec3(1.0), length(testColor.rgb) * length(testColor.rgb) / 40.0), 1.0);
 } 

 