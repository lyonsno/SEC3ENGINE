#extension GL_EXT_draw_buffers : require
precision highp float;

const float PI = 3.14159265;
const float deltaT = 0.00027777777;
const float densityWeight = 1.0;
const float h = 4.3; // effective radius

const float kPressure = 45.0 / (PI * h * h * h * h * h * h);
const float kVis = kPressure;

uniform sampler2D u_positions;
// uniform float u_invTextureLength; 

varying vec2 v_texCoord;



vec2 assembleForces( vec3 position ) {

	// x = density // y = pressure // z = viscosity
	vec2 forces = vec2(0.0);
	vec2 uv = vec2( 0.0 );
	for (int i = 0; i < 32; i++) {
		for (int j = 0; j < 32; j++){

			vec3 neighborPos = texture2D( u_positions, uv ) ).xyz;
			 // TODO: pack density into position texture
			vec3 fromNeighbor = position - neighborPos;
			float dist = length( position - neighborPos);
			if( dist < h ) {
				float neighborDensity = texture2D( u_densities, uv ).r;
				float dist2 = dist * dist;
			}	



			uv.x += 1.0 / 32.0;
		}
		uv.y += 1.0 / 32.0;
	}
	return density;
}

void main() {
// Saves the new position and accelleration to location determined in vertex shader

	vec3 myPosition = texture2D(u_positions, v_texCoord).rgb;
	vec3 triForce = assembleForces( myPosition );

	gl_FragData[0] = vec4( position );
	gl_FragData[1] = vec4( velocity );
}