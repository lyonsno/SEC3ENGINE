#extension GL_EXT_draw_buffers : require
precision highp float;

#define TEXTURE_SIZE_NAIVE 256

const float PI = 3.14159265;
uniform sampler2D u_positions;
uniform sampler2D u_velocity;
uniform float u_steps;
uniform vec3 u_gridDims;
uniform float u_h;
uniform float u_viscosity;
uniform float u_viscosityLinear;
uniform float u_maxVelocity;

uniform float u_textureSize;
uniform sampler2D u_voxelGrid;

varying vec2 v_texCoord;

float dT = 1.0 / (60.0 * u_steps);
float kNorm = 3.0 / ( PI * u_h * u_h * u_h );

struct Particle {

	vec3 position;
	vec3 velocity;
};

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

Particle lookupParticle( vec2 index ) {

	vec3 position = texture2D( u_positions, index ).rgb;
	vec3 velocity = texture2D( u_velocity, index ).rgb;

	
	return Particle( position, velocity );
}

vec3 calcNeighborViscosity( Particle p, Particle neighbor ) {
	vec3 impulse = vec3(0.0);
	vec3 toNeighbor =  neighbor.position - p.position;
	float dist = length( toNeighbor );
	vec3 toNeighborNorm = normalize( toNeighbor );

	if( dist < u_h && dist > 0.0000001 ) {
			float q = (dist / u_h);
			float u = dot((p.velocity - neighbor.velocity), toNeighborNorm );
			if( u > 0.0 ) {
				impulse -= dT * ( 1.0 - q ) * ( u_viscosity * u * u + u_viscosityLinear * u) * toNeighborNorm;
			}
	}
	return impulse;

}

vec3 getViscosityImpulses( Particle p ){
	vec3 position = p.position;
	vec3 viscosity = vec3(0.0);

	vec3 offset = vec3(0.0);
	for (int x = -1; x < 2; x++ ) {
		for (int y = -1; y < 2; y++ ) {
			for (int z = -1; z < 2; z++ ) {
				vec3 offset = u_h * vec3( float(x), float(y), float(z) );
				vec2 voxelUV = getVoxelUV( position + offset );
				vec4 particleIndices = texture2D( u_voxelGrid, voxelUV);
				if( particleIndices.r >= 0.0 ) {
					Particle neighbor = lookupParticle( unpackIndex( particleIndices.r ));
					viscosity += calcNeighborViscosity( p, neighbor );
				}
				if( particleIndices.g >= 0.0 ) {
					Particle neighbor = lookupParticle( unpackIndex( particleIndices.g ));
					viscosity += calcNeighborViscosity( p, neighbor );
				}
				if( particleIndices.b >= 0.0 ) {
					Particle neighbor = lookupParticle( unpackIndex( particleIndices.b ));
					viscosity += calcNeighborViscosity( p, neighbor );
				}
				if( particleIndices.a >= 0.0 ) {
					Particle neighbor = lookupParticle( unpackIndex( particleIndices.a ));
					viscosity += calcNeighborViscosity( p, neighbor );
				}
			}
		}
	}

	return viscosity;
}

vec3 getViscosityImpulsesNaive( Particle p ){
	vec3 position = p.position;
	vec3 viscosity = vec3(0.0);

	vec2 uv = vec2( 0.5 / float(TEXTURE_SIZE_NAIVE) );

	for (int u = 0; u < TEXTURE_SIZE_NAIVE; u++ ) {
		uv.x = float(u) / float(TEXTURE_SIZE_NAIVE);
		for ( int v = 0; v < TEXTURE_SIZE_NAIVE; v++ ) {
			uv.y = float(v) / float(TEXTURE_SIZE_NAIVE);
			Particle neighbor = lookupParticle( uv );
			viscosity += calcNeighborViscosity( p, neighbor );



		}
	}

	return viscosity;
}


void main() {

	// TODO collisions here?
	Particle particle = lookupParticle( v_texCoord );
	particle.velocity = particle.velocity + dT * vec3( 0.0, -9.8, 0.0 );
	particle.velocity += getViscosityImpulses( particle );
	float speed = length(particle.velocity);
	if(speed > u_maxVelocity) {
		particle.velocity =  u_maxVelocity * particle.velocity / speed;
	}
	vec3 prevPos = particle.position;
	particle.position = particle.position + particle.velocity * dT;
	gl_FragData[0] = vec4( particle.position, 1.0 );
	gl_FragData[1] = vec4( particle.velocity, 1.0 );
	gl_FragData[2] = vec4( prevPos, 1.0 );
}