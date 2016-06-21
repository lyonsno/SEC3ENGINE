precision highp float;

const vec2 madd = vec2(0.5, 0.5);

attribute vec2 aVertexPosition;

varying vec2 textureCoord;

void main(void) {
	// scale vertex attribute to [0-1] range
	textureCoord = aVertexPosition.xy * madd + madd; 

   	gl_Position = vec4(aVertexPosition, 0.0, 1.0);
}