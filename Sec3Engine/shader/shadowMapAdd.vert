precision highp float;


attribute vec2 aParticleIndex; 

uniform sampler2D uParticlePositions;  //rename uParticlePositions
uniform mat4 uLightMatrix;
uniform float u_size;
	
void main(void) {


	vec4 oldPosition = texture2D(uParticlePositions, aParticleIndex);

   	gl_Position = uLightMatrix * vec4(oldPosition.rgb, 1.0);//write 

   	gl_PointSize = u_size;
   	
}	