
/*

	float duration; 		 The duration of the particle system in seconds
	emissionRate			// The rate of emission.
	enableEmission			When set to false, the particle system will not emit particles.
	gravityModifier			Scale being applied to the gravity defined by Physics.gravity.
	isPaused				Is the particle system paused right now ?
	isPlaying				Is the particle system playing right now ?
	isStopped				Is the particle system stopped right now ?
	maxParticles			The maximum number of particles to emit.
	particleCount			The current number of particles (Read Only).
	randomSeed				Random seed used for the particle system emission. If set to 0, it will be assigned a random value on awake.
	startColor				The initial color of particles when emitted.
	startDelay				Start delay in seconds.
	startLifetime			The total lifetime in seconds that particles will have when emitted. When using curves, values acts as a scale on the curve. This value is set in the particle when it is create by the particle system.
	startRotation			The initial rotation of particles when emitted. When using curves, values acts as a scale on the curve.
	startSize				The initial size of particles when emitted. When using curves, values acts as a scale on the curve.
	startSpeed				The initial speed of particles when emitted. When using curves, values acts as a scale on the curve.
	time					Playback position in seconds.

*/

var SHADOWMAP_SIZE = 256;

var SEC3 = SEC3 || {};

SEC3.createParticleSystem = function(specs) {

//-------------------------------------------------------CONSTANTS/FIELDS:

	var frameTurn = true;
	var srcIndex, destIndex;
	var positionTextures = [];
	var velocityTextures = [];	

	var velocities = [];
	var accelerations = []; // TODO kill
	var startPositions = [];
	var textureMemoryLocation = [];

	var systemCycles = 0.0;
	
	var renderProgram;
	var stepProgram;
	var interactor = {};
	interactor.attractor = [ -13.0, 6.0, 1.0, 1.0 ];
	var self = {};

//----------------------------------------------------------------METHODS:
	

	var update = function() {

	    stepParticles();
	    updateShadowMap(scene.getLight(0));
	};

	var draw = function( light ) {
		renderParticles( light );
		systemCycles++;
	};
	
	/*
	 * Updates locations and velocities of all particles in system
	 */
	var stepParticles = function () {
		swapSrcDestIndices();	
	    // disble depth testing and update the state in texture memory
	    gl.disable(gl.DEPTH_TEST);
	    gl.disable(gl.BLEND);
	    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);

	    gl.useProgram(stepProgram.ref());
	    gl.bindFramebuffer(gl.FRAMEBUFFER, fboPositions); 
	    gl.viewport(0, 0, self.textureSideLength, self.textureSideLength);
	    // set the texture to which the fboPositions will save updated state
	    gl.framebufferTexture2D(gl.FRAMEBUFFER, 
	                            SEC3.extensions.drawBuffers(gl).COLOR_ATTACHMENT0_WEBGL, 
	                            gl.TEXTURE_2D, 
	                            positionTextures[destIndex], 
	                            0); 
	    gl.framebufferTexture2D(gl.FRAMEBUFFER, 
	                            SEC3.extensions.drawBuffers(gl).COLOR_ATTACHMENT1_WEBGL, 
	                            gl.TEXTURE_2D, 
	                            velocityTextures[destIndex], 
	                            0); 

	    gl.activeTexture(gl.TEXTURE0);
	    gl.bindTexture(gl.TEXTURE_2D, positionTextures[srcIndex]);
	    gl.uniform1i(stepProgram.uParticlePositions, 0);

	    gl.activeTexture(gl.TEXTURE1);
	    gl.bindTexture(gl.TEXTURE_2D, velocityTextures[srcIndex]);
	    gl.uniform1i(stepProgram.uParticleVelocities, 1);

	    gl.vertexAttribPointer(stepProgram.aVertexPosition, 2, gl.FLOAT, false, 0, 0); 
	    gl.enableVertexAttribArray(stepProgram.aVertexPosition);
	    var center = vec3.clone(scene.getCamera().getPosition());
	    var offset = vec3.clone(camera.normal);
	    vec3.scale(offset, offset, -8.0);
	    vec3.add(center, center, offset);
	    gl.uniform4f(stepProgram.uAttractor, center[0], center[1], center[2], interactor.attractor[3]);

	    gl.drawArrays(gl.TRIANGLES, 0, 6); 
	}

	/*
	 * draws current scene into shadow map
	 */
	var updateShadowMap = function ( light ) {

		var fbo = light.cascadeFramebuffers[0];
		gl.colorMask(false,false,false,false);
	    gl.useProgram(self.shadowProgram.ref());
	    gl.viewport(0, 0, fbo.getWidth(), fbo.getHeight());

	    gl.activeTexture(gl.TEXTURE0);
	    gl.bindTexture(gl.TEXTURE_2D, positionTextures[srcIndex]);
	    gl.uniform1i(shadowProgram.uParticlePositions, 0);

	    gl.uniform1f( shadowProgram.uSizeLoc, self.particleSize )
	    gl.uniformMatrix4fv(shadowProgram.uLightMatrix, false, light.getMVP());
	    gl.enable(gl.DEPTH_TEST);
	    gl.disable(gl.BLEND);

	    //enable particle index and draw particles to the screen
	    gl.bindBuffer(gl.ARRAY_BUFFER, indexBuffer);
	    gl.vertexAttribPointer(shadowProgram.particleIndexAttribute, 2, gl.FLOAT, false, 0, 0); 
	    gl.enableVertexAttribArray(shadowProgram.particleIndexAttribute); 
	   			
	    fbo.bind(gl);
	   	// gl.clear(gl.DEPTH_BUFFER_BIT);
	    gl.drawArrays(gl.POINTS, 0, self.limit); 
	    fbo.unbind(gl);
	    gl.colorMask(true,true,true,true);
	}

	/*
	 * Draws all particles in system
	 */
	var renderParticles = function ( light ) {

	    gl.useProgram(self.renderProgram.ref());
	    gl.viewport(0, 0, SEC3.canvas.width, SEC3.canvas.height );

		
	    gl.uniform3fv(renderProgram.uLightPosition, light.getPosition());
	    gl.uniform3fv(renderProgram.uCPosLoc, scene.getCamera().getPosition());

	    gl.activeTexture(gl.TEXTURE0);
	    gl.bindTexture(gl.TEXTURE_2D, positionTextures[srcIndex]);
	    gl.uniform1i( renderProgram.uParticlePositions, 0);

	    gl.activeTexture( gl.TEXTURE1 );
	    gl.bindTexture( gl.TEXTURE_2D, SEC3.gBuffer.depthTexture() );
	    gl.uniform1i( renderProgram.uGDepthLoc, 1 );

	    gl.activeTexture(gl.TEXTURE2);
	    gl.bindTexture(gl.TEXTURE_2D, light.cascadeFramebuffers[0].depthTexture() );
	    gl.uniform1i(renderProgram.uShadowMap, 2);
	   	
	   	gl.uniformMatrix4fv(renderProgram.uShadowMapTransform, false, light.getMVP() );
	    gl.uniformMatrix4fv(renderProgram.uCameraTransform, false, scene.getCamera().getMVP());
	    gl.uniform3fv(renderProgram.uLightPosition, light.getPosition() );
	    //bind the default frame buffer, disable depth testing and enable alpha blending
	    finalFBO.bind(gl);

	    // gl.bindFramebuffer(gl.FRAMEBUFFER, null); //bind the default frame buffer
	    gl.enable(gl.DEPTH_TEST);
	    gl.depthFunc(gl.ALWAYS);
	    gl.enable(gl.BLEND);
	    // gl.blendFunc( gl.ONE, gl.ONE_MINUS_SRC_ALPHA );
	    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.SRC_ALPHA, gl.ONE);
	    // gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	    //enable particle index and draw particles to the screen
	    gl.bindBuffer(gl.ARRAY_BUFFER, indexBuffer);
	    gl.vertexAttribPointer(renderProgram.particleIndexAttribute, 2, gl.FLOAT, false, 0, 0); 
	    gl.enableVertexAttribArray(renderProgram.particleIndexAttribute); 
	   	// gl.enable(0x0B10);
	    gl.drawArrays(gl.POINTS, 0, self.limit); 
	    gl.disable(gl.BLEND);
	    gl.depthFunc(gl.LESS);

	}


    var createBuffer = function(itemSize, numItems, content, location) {
    	// TODO move to webgl-util.js
	    var newBuffer = gl.createBuffer();  
	    newBuffer.itemSize = itemSize;
	    newBuffer.numItems = numItems;
	    gl.bindBuffer(gl.ARRAY_BUFFER, newBuffer);
	    var vert32Array = new Float32Array(content);
	    gl.bufferData(gl.ARRAY_BUFFER, vert32Array, gl.STATIC_DRAW);
	    gl.vertexAttribPointer(location, itemSize, gl.FLOAT, false, 0, 0);  
	    gl.bindBuffer(gl.ARRAY_BUFFER, null);
	    return newBuffer;
	};

	var init = function() {

		var len = SEC3.math.roundUpToPower(Math.sqrt(specs.maxParticles), 2);
		self.textureSideLength = len;
		self.maxParticles = len * len;
		self.limit = specs.maxParticles;
		self.gravityModifier = specs.gravityModifier;

		self.activeBodies = specs.activeBodies;
		self.particleSize = specs.particleSize;
		self.damping = specs.damping;
		self.RGBA = specs.RGBA;	

		self.luminence = specs.luminence;
		self.scatterMultiply = specs.scatterMultiply;
		self.shadowMultiply = specs.shadowMultiply;
		self.scale = specs.scale;
		
    };

    var initBuffers = function() {

	    // create attribute buffer
	    indexBuffer = createBuffer(2, //item size
	                               self.maxParticles, //num items
	                               textureMemoryLocation, //data
	                               renderProgram.particleIndexAttribute); //location
	    // create fullScreen Quad buffer
	    quadBuffer = createBuffer(2, 
	                 6,
	                 SEC3.geometry.fullScreenQuad(),
	                 stepProgram.aVeretexPosition);
	    
	    positionTextures.length = 0;
	    positionTextures.push(generateTexture(startPositions, self.textureSideLength));
	    positionTextures.push(generateTexture(startPositions, self.textureSideLength));

	    velocityTextures.length = 0;
	    velocityTextures.push(generateTexture(velocities, self.textureSideLength));
	    velocityTextures.push(generateTexture(velocities, self.textureSideLength));

	    fboPositions = gl.createFramebuffer();
	    gl.bindFramebuffer(gl.FRAMEBUFFER,fboPositions);
	    fboPositions.width = self.textureSideLength;	
	    fboPositions.height = self.textureSideLength;

	    var ext = SEC3.extensions.drawBuffers(gl);

	    ext.drawBuffersWEBGL([
	        ext.COLOR_ATTACHMENT0_WEBGL,
	        ext.COLOR_ATTACHMENT1_WEBGL,
	    ]);

	};

	var generateTexture = function(values, size) { // TODO must change for emitter
		values = values || size * size * 4;
	    var texture = gl.createTexture();

	    gl.bindTexture(gl.TEXTURE_2D, texture);
	    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA,
	                    size, size, 
	                    0, gl.RGBA, gl.FLOAT, new Float32Array(values)); //TODO will initialize empty array

	    gl.bindTexture(gl.TEXTURE_2D, null);
	    return texture;
	};

	var initShaders = function() {

	    SEC3.extensions.drawBuffers(gl);

	    shadowProgram = SEC3.createShaderProgram();
	    shadowProgram.loadShader(gl, "Sec3Engine/shader/shadowMapAdd.vert", "Sec3Engine/shader/shadowMapAdd.frag");
	    shadowProgram.addCallback( function() {
	        shadowProgram.particleIndexAttribute = gl.getAttribLocation(shadowProgram.ref(), "aParticleIndex");
	        shadowProgram.uLightMatrix = gl.getUniformLocation(shadowProgram.ref(), "uLightMatrix");
	        shadowProgram.uParticlePositions = gl.getUniformLocation(shadowProgram.ref(), "uParticlePositions");
	        shadowProgram.uSizeLoc = gl.getUniformLocation(shadowProgram.ref(), "u_size");

	        self.shadowProgram = shadowProgram;
	    });

	    SEC3.registerAsyncObj(gl, shadowProgram);

	    renderProgram = SEC3.createShaderProgram();
	    renderProgram.loadShader(gl, "Sec3Engine/shader/nBodyRender.vert", "Sec3Engine/shader/nBodyRender.frag");
	    renderProgram.addCallback( function() {
	        renderProgram.particleIndexAttribute = gl.getAttribLocation(renderProgram.ref(), "aParticleIndex");
	        renderProgram.uCameraTransform = gl.getUniformLocation(renderProgram.ref(), "uCameraTransform");
	        renderProgram.uParticlePositions = gl.getUniformLocation(renderProgram.ref(), "uParticlePositions");
	        renderProgram.uGDepthLoc = gl.getUniformLocation( renderProgram.ref(), "u_gDepth");
	        renderProgram.uScreenSizeLoc = gl.getUniformLocation( renderProgram.ref(), "u_screenSize");
	        renderProgram.uAlpha = gl.getUniformLocation(renderProgram.ref(), "uAlpha");
	        renderProgram.uSize = gl.getUniformLocation(renderProgram.ref(), "uSize");
	        renderProgram.uShadowMap = gl.getUniformLocation(renderProgram.ref(), "uShadowMap");
	        renderProgram.uShadowMapTransform = gl.getUniformLocation(renderProgram.ref(), "uShadowMapTransform")
			renderProgram.uLightPosition = gl.getUniformLocation(renderProgram.ref(), "uLightPosition");
			renderProgram.uCPosLoc = gl.getUniformLocation(renderProgram.ref(), "u_cPos");
			renderProgram.uLuminence = gl.getUniformLocation(renderProgram.ref(), "uLuminence");
			renderProgram.uScatterMultiply = gl.getUniformLocation(renderProgram.ref(), "uScatterMultiply");
			renderProgram.uShadowMultiply = gl.getUniformLocation(renderProgram.ref(), "uShadowMultiply");
			renderProgram.uScale = gl.getUniformLocation(renderProgram.ref(), "uScale");
	        gl.useProgram(renderProgram.ref());
	        gl.uniformMatrix4fv(renderProgram.uShadowMapTransform, false, scene.getLight(0).getMVP());
    		gl.uniformMatrix4fv(renderProgram.uCameraTransform, false, scene.getCamera().getMVP());
    		gl.uniform2fv( renderProgram.uScreenSizeLoc, vec2.fromValues(SEC3.canvas.width, SEC3.canvas.height ));
    		gl.uniform1f(renderProgram.uLuminence, self.luminence);	
   	        gl.uniform1f(renderProgram.uAlpha, self.RGBA[3]);
	        gl.uniform1f(renderProgram.uSize, self.particleSize);
	        gl.uniform1f(renderProgram.uShadowMultiply, self.shadowMultiply);
	        gl.uniform1f(renderProgram.uScatterMultiply, self.scatterMultiply);
	        gl.uniform1f(renderProgram.uScale, self.scale);

	        // var lightPosition = self.light.getPosition();
	        // gl.uniform3f(renderProgram.uLightPosition, lightPosition[0], lightPosition[1], lightPosition[2]);
	        self.renderProgram = renderProgram;
	    });

	    SEC3.registerAsyncObj(gl, renderProgram);

	    stepProgram = SEC3.createShaderProgram();
	    stepProgram.loadShader(gl, "Sec3Engine/shader/nBodyUpdate.vert", "Sec3Engine/shader/nBodyUpdate.frag");
	    stepProgram.addCallback( function() {
	        gl.useProgram(stepProgram.ref());
	        stepProgram.aVeretexPosition = gl.getAttribLocation(stepProgram.ref(),"aVertexPosition");
	        stepProgram.uParticlePositions = gl.getUniformLocation(stepProgram.ref(), "uParticlePositions");
	        stepProgram.uParticleVelocities = gl.getUniformLocation(stepProgram.ref(), "uParticleVelocities");
	        stepProgram.uGravityModifier = gl.getUniformLocation(stepProgram.ref(), "uGravityModifier");
	        stepProgram.uAttractor = gl.getUniformLocation(stepProgram.ref(), "uAttractor");
	        stepProgram.uDamping = gl.getUniformLocation(stepProgram.ref(), "uDamping");
	        stepProgram.uInteractions = gl.getUniformLocation(stepProgram.ref(), "uInteractions");
	        initBuffers();
	        gl.uniform1f(stepProgram.uGravityModifier, self.gravityModifier);
	        gl.uniform1f(stepProgram.uDamping, self.damping);
	        gl.uniform1f(stepProgram.uInteractions, self.activeBodies);
			self.stepProgram = stepProgram;
	    });

	    SEC3.registerAsyncObj( gl, stepProgram );
	};

	/*
	 * Updates/toggles globals srcIndex and destIndex
	 */
	var swapSrcDestIndices = function() {

	    frameTurn = ! frameTurn;

	    if (frameTurn) {
	        srcIndex = 0;
	        destIndex = 1;
	    }
	    else {
	        srcIndex = 1;
	        destIndex = 0;
	    }
	};

	var restart = function() { // PUBLIC

		positionTextures = [];
		velocityTextures = [];	
		// velocities = [];
		// accelerations = []; 
		// startPositions = [];
		// textureMemoryLocation = [];

		// createParticlesInSphere();
		initBuffers();
	};

	//------------------FOR PARTICLE DEMO:

	var getRandomVec3 = function() {

		var x = (Math.random() - 0.5) * 0.5;
		var y = (Math.random() - 0.5) * 0.5;
		var z = (Math.random() - 0.5) * 0.5;

		return vec3.fromValues(x,y,z);

	};

	var getUniformPointOnSphere = function(radius) {

		var x = (Math.random() - 0.5) * 0.5;
		var y = (Math.random() - 0.5) * 0.5;
		var z = (Math.random() - 0.5) * 0.5;
		var vec = vec3.fromValues(x,y,z);
		vec3.normalize(vec, vec);
		vec3.scale(vec, vec, radius);
		return vec;
	};

	var getUniformPointInSphere = function(radius) {
		var radiusSquared = radius * radius;
		var squareLength = radiusSquared + 1;
		var x, y, z, vec;

		while(squareLength > radiusSquared) {
			x = (Math.random() - 0.5) * 2.0;
			y = (Math.random() - 0.5) * 2.0;
			z = (Math.random() - 0.5) * 2.0;
			vec = vec3.fromValues(x,y,z);
			vec3.scale(vec, vec, radius); 
			squareLength = vec3.dot(vec, vec);
		}
		return vec;
	};

    var createParticlesInSphere = function() {

		var i, max_parts = self.maxParticles;

    	for(i = 0; i < max_parts; i++) {

       		var startingVelocity = getUniformPointInSphere(0.8);
       		// var startingVelocity = getUniformPointOnSphere(0.5);
            
       		velocities.push(0.0);
       		velocities.push(0.0);
       		velocities.push(0.0);
       		velocities.push(1.0);

       		startPositions.push(startingVelocity[0] - 13.5);
       		startPositions.push(startingVelocity[1] + 7.0);
       		startPositions.push(startingVelocity[2]);
       		startPositions.push(Math.random());

       		var xIndex = Math.floor(i % self.textureSideLength) / self.textureSideLength ;
	        var yIndex = i / self.maxParticles; 

       		textureMemoryLocation.push(xIndex);
       		textureMemoryLocation.push(yIndex);
       	}
    };

	//------------------

	// Assign public methods
	self.restart = restart;
	self.draw = draw;
	self.update = update;
	self.stepParticles = stepParticles;
	self.updateShadowMap = updateShadowMap;

	// run setup
	init(); 
	createParticlesInSphere();
	initShaders();

	return self;
};
	

	