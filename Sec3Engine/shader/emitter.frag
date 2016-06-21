

#extension GL_EXT_draw_buffers : require
precision highp float;

uniform sampler2D uParticleVelocities;
uniform sampler2D uParticlePositions; 


varying vec2 textureCoord;

void main(void) {
// Saves the new position and accelleration to location determined in vertex shader
	
	vec4 oldVelocity = texture2D(uParticleVelocities, textureCoord);
	if(oldVelocity.a == 0.0) discard;

	vec4 oldPosition = texture2D(uParticlePositions, textureCoord);

	// forces from other particles
	float uvStep = 1.0 / float(uInteractions);
	vec3 accellerationFinal = accumulateAcceleration(oldPosition,uvStep); 

	// particle interactor 
	vec3 attractorPos = vec3(uAttractor.xy,0.0);
	vec3 distance = attractorPos - oldPosition.rgb;
	float distanceSquared = dot(distance, distance);
	accellerationFinal += uPointerPower * distanceSquared * distance * uAttractor.z * 0.00002; // anti-diffusion
	accellerationFinal += uPointerPower * (uAttractor.z * normalize(distance)) * (0.0006/ distanceSquared);

	vec3 newVelocity = (oldVelocity.rgb + accellerationFinal) * (2.0 - uDamping);
	vec4 newPosition = vec4(oldPosition.rgb + newVelocity,oldPosition.a);
		
	gl_FragData[0] = (newPosition);
	gl_FragData[1] = vec4(newVelocity,oldVelocity.a - life);
}