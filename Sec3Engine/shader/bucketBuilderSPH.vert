precision highp float;

attribute vec2 a_index;

uniform float u_h;
uniform sampler2D u_positions;
uniform float u_textureLength;
uniform vec3 u_gridDims;
//uniform vec2 u_gridTexDims;
float numColumns =  sqrt(u_gridDims.y);

varying float index;
float MAX_INDEX =  u_textureLength * (u_textureLength);
//---------------------------------------------------HELPERS:
vec2 worldToUV( vec3 pos ) {

	pos /= u_h;
	pos = abs(pos); //TODO
	float yCompU = floor(mod(pos.y, numColumns)) / numColumns;
	float yCompV = floor(pos.y / numColumns) / numColumns;
	float xCompU = (pos.x / u_gridDims.x) / numColumns;
	float zCompV = (pos.z / u_gridDims.z) / numColumns;

	return vec2( yCompU + xCompU, yCompV + zCompV );

}

float getID( vec2 particleIndex ) {

  	return (particleIndex.x * u_textureLength) + 
  		   (particleIndex.y * u_textureLength * (u_textureLength ));
}

//-----------------------------------------------------MAIN:
void main() {
	gl_PointSize = 1.0;
	float particleID = getID(a_index);
	vec3 worldPosition = texture2D(u_positions, a_index ).rgb;
	vec2 uv = worldToUV( worldPosition );
	uv = uv * 2.0 - 1.0;

	index = particleID;
	gl_Position = vec4( uv, particleID / MAX_INDEX, 1.0 );
	// gl_Position = vec4( worldPosition.x, worldPosition.y, worldPosition.z, 1.0 ); //TEMP

}