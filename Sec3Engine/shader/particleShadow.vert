precision highp float;

//attribute vec3 aVertexVelocities; //rename aParticleVelocities
attribute vec2 aParticleIndex; 


uniform sampler2D uParticlePositions;  //rename uParticlePositions
uniform mat4 uMVPMatrix;

varying vec4 v_color;
	
void main(void) {

	// Index into the buffer uParticlePositions with aParticleIndex 
	vec4 oldPosition = texture2D(uParticlePositions, aParticleIndex);
	// vec3 oldVelocity = 0.2 + 3.0 * texture2D(uParticleVelocities, aParticleIndex).rgb;	    		
   	gl_Position = uMVPMatrix * vec4(oldPosition.rgb, 1.0);//write 
   	//gl_Position =0c4(aParticleIndex,0.0,1.0);

   	gl_PointSize = 1.0;
	
}