#extension GL_EXT_draw_buffers : require
precision highp float;

//--------------------------------------------------------GLOBALS:


#define TEXTURE_SIZE_NAIVE 256

const float PI = 3.14159265;

uniform vec3 u_gridDims;
uniform float u_h;
uniform float u_mass;
uniform float u_restDensity;
uniform float u_textureSize;
uniform sampler2D u_positions;
uniform sampler2D u_velocity;
uniform sampler2D u_prevPos;
uniform sampler2D u_voxelGrid;
varying vec2 v_texCoord;
float h2 = u_h * u_h;
float kDensity = 315.0 / ( 64.0 * PI * pow( u_h, 9.0));
float kNearNorm = 15.0 / ( PI * u_h * u_h * u_h);
float kNorm = 15.0 / ( 2.0 * PI * u_h * u_h * u_h );
float mass = pow(u_h, 3.0) * u_restDensity;


//-------------------------------------------------------HELPERS:
vec2 getVoxelUV( vec3 pos ) {

	pos /= u_h;
	float numColumns =  sqrt(u_gridDims.y);
	float yCompU = floor(mod(pos.y, numColumns)) / numColumns;//u_gridTexDims.x;
	float yCompV = floor(pos.y / numColumns) / numColumns;//u_gridTexDims.y;
	float xCompU = (pos.x / u_gridDims.x) / numColumns;
	float zCompV = (pos.z / u_gridDims.z) / numColumns;

	return vec2( yCompU + xCompU, yCompV + zCompV );
	
}

vec2 unpackIndex ( float packedIndex ) {
	float u = floor(mod(packedIndex, u_textureSize));
	float v = floor( packedIndex / u_textureSize );


	return vec2( u, v ) / u_textureSize;
}

vec2 calcNeighborDensity( vec3 position, vec3 neighborPos ) {
	float density = 0.0;
	float nearDensity = 0.0;
	vec3 fromNeighbor = position - neighborPos;
	float dist = length( fromNeighbor );

	if (dist < u_h ) {
		float sqrtDensity = ( 1.0 - (dist / u_h) );
		density += sqrtDensity * sqrtDensity;
		nearDensity += density * sqrtDensity;
		// density += pow( 1.0 - (dist / u_h), 3.0);
		// nearDensity += pow( 1.0 - (dist / u_h), 4.0);

	}

	return vec2(density, nearDensity);
}	


vec2 getDensity( vec3 position ) {

	vec2 density = vec2(0.0);

	vec3 offset = vec3(0.0);
	for (int x = -1; x < 2; x++ ) {
		for (int y = -1; y < 2; y++ ) {
			for (int z = -1; z < 2; z++ ) {
				vec3 offset = u_h * vec3( float(x), float(y), float(z) );
				vec2 voxelUV = getVoxelUV( position + offset );
				vec4 particleIndices = texture2D( u_voxelGrid, voxelUV);
				if( particleIndices.r >= 0.0 ) {
					vec3 neighborPos = texture2D( u_positions, unpackIndex( particleIndices.r )).rgb;
					density += calcNeighborDensity( position, neighborPos );
				}
				if( particleIndices.g >= 0.0 ) {
					vec3 neighborPos = texture2D( u_positions, unpackIndex( particleIndices.g )).rgb;
					density += calcNeighborDensity( position, neighborPos );
				}
				if( particleIndices.b >= 0.0 ) {
					vec3 neighborPos = texture2D( u_positions, unpackIndex( particleIndices.b )).rgb;
					density += calcNeighborDensity( position, neighborPos );
				}
				if( particleIndices.a >= 0.0 ) {
					vec3 neighborPos = texture2D( u_positions, unpackIndex( particleIndices.a )).rgb;
					density += calcNeighborDensity( position, neighborPos );
				}
			}
		}
	}

	return density;
}

vec2 getDensityNaive( vec3 position  ) {

	vec2 density = vec2(0.0);
	vec2 uv = vec2( 0.5 / float(TEXTURE_SIZE_NAIVE) );

	for (int u = 0; u < TEXTURE_SIZE_NAIVE; u++ ) {
		uv.x = float(u) / float(TEXTURE_SIZE_NAIVE);
		for ( int v = 0; v < TEXTURE_SIZE_NAIVE; v++ ) {
			uv.y = float(v) / float(TEXTURE_SIZE_NAIVE);
			vec3 neighborPos = texture2D( u_positions, uv).rgb;
			density += calcNeighborDensity( position, neighborPos );
		}
	}

	return density;
}

//-------------------------------------------------------MAIN:
void main() {
// Saves the new position and accelleration to location determined in vertex shader

	vec3 myPosition = texture2D(u_positions, v_texCoord).rgb;
	vec3 velocity = texture2D(u_velocity, v_texCoord).rgb;
	vec4 prevPos = texture2D( u_prevPos, v_texCoord);
	vec2 density = getDensity( myPosition );
	gl_FragData[0] = vec4( myPosition, density.x);
	gl_FragData[1] = vec4( velocity, density.y );
	gl_FragData[2] = prevPos;
}