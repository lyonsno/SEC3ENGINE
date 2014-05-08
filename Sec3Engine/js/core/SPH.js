var SEC3 = SEC3 || {};

SEC3.SPH = function(specs) {

//-----------------------------------------------------------------CONSTANTS/FIELDS:
	
	this.isSrcIndex0 = true;
	this.srcIndex = 0;
	this.destIndex = 1;

	this.movementFBOs = [];
	// slot 0: position
	// slot 1: velocity
	
	this.indexFBO = {};
	this.densityFBO = {};

	this.viewDepth = false;
	this.viewNormals = false;
	this.viewGrid = false;
	this.naive = false;
	this.paused = false;
	this.currentProjector = 1;
	// this.textureResolution = SEC3.math.roundUpToPower( specs.numParticles, 2);
	this.textureSideLength = Math.sqrt( specs.numParticles );
	this.numParticles = specs.numParticles;
	this.gridTextureWidth = specs.gridTextureWidth;
	this.gridTextureHeight = specs.gridTextureHeight;

	this.projectors = [];

	this.RGBA = specs.RGBA;	
	this.particleSize = specs.particleSize;

	this.stepsPerFrame = specs.stepsPerFrame;
	this.h = specs.h;
	this.maxVelocity = specs.maxVelocity;
	this.mass = specs.mass;
	this.gravity = specs.gravity;
	this.pressureK = specs.pressureK;
	this.nearPressureK = specs.nearPressureK;
	this.restDensity = specs.restDensity;
	this.viscosityK = specs.viscosityK;
	this.viscosityLinearK = specs.viscosityLinearK;
	this.restPressure = specs.restPressure;
	this.surfaceTension = specs.surfaceTension;
	this.grid = {};

	this.ext = gl.getExtension("ANGLE_instanced_arrays"); // Vendor prefixes may apply!
	this.initFBOs();
	this.initShaders();

	this.pause = function() {
		this.paused = ! this.paused;
	};
	this.showDepth = function() {
		this.viewDepth = ! this.viewDepth;
		this.viewNormals = false;
		this.viewGrid = false;
	};
	this.showNormals = function() {
		this.viewNormals = ! this.viewNormals;
		this.viewDepth = false;
		this.viewGrid = false;
	};
	this.showGrid = function() {
		this.viewGrid = ! this.viewGrid;
		this.viewNormals = false;
		this.viewDepth = false;
	};
	this.showNextProjector = function() {
		this.currentProjector++;
		if( this.currentProjector >= this.projectors.length ) {
			this.currentProjector = 0;
		}
	};

};
//--------------------------------------------------------------------------METHODS:

SEC3.SPH.prototype = {

//------------------------------------------------------------------------PASSES YO:

	draw : function( scene, framebuffer ) {

	    if (framebuffer)  framebuffer.bind(gl);
	    else   gl.bindFramebuffer(gl.FRAMEBUFFER, null);

		var width = framebuffer != null ? framebuffer.getWidth() : SEC3.canvas.width;
		var height = framebuffer != null ? framebuffer.getWidth() : SEC3.canvas.height;
	    gl.viewport(0, 0, width, height );
	   
	   	// gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );
	    gl.enable(gl.DEPTH_TEST);
	    gl.disable(gl.BLEND);
	    // gl.blendFunc( gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA );
		gl.useProgram(this.renderProgram.ref());
	    gl.activeTexture(gl.TEXTURE0);
	    gl.bindTexture(gl.TEXTURE_2D, this.movementFBOs[this.srcIndex].texture(0));
	    gl.uniform1i( this.renderProgram.uPositionsLoc, 0);

	    gl.activeTexture(gl.TEXTURE1);
	    gl.bindTexture(gl.TEXTURE_2D, this.movementFBOs[this.srcIndex].texture(1));
	    // gl.bindTexture(gl.TEXTURE_2D, this.densityFBO.texture(0));
	    gl.uniform1i( this.renderProgram.uTestTexLoc, 1 );

	    gl.activeTexture(gl.TEXTURE2);
	    gl.bindTexture(gl.TEXTURE_2D, scene.gBuffer.texture(3));
	    gl.uniform1i( this.renderProgram.uDepthLoc, 2 );
	   
	   	gl.uniform2f( this.renderProgram.uScreenDimsLoc, SEC3.canvas.width, SEC3.canvas.height );
	   	gl.uniform3fv( this.renderProgram.uCamPosLoc, scene.getCamera().getPosition() );
	   	gl.uniform1f( this.renderProgram.uParticleSizeLoc, this.particleSize);
	    gl.uniformMatrix4fv(this.renderProgram.uMVPLoc, false, scene.getCamera().getMVP());

	   	//TODO eliminate
	    gl.bindBuffer(gl.ARRAY_BUFFER, this.renderProgram.indexBuffer);
	    gl.enableVertexAttribArray(this.renderProgram.aIndexLoc); 
	    gl.vertexAttribPointer(this.renderProgram.aIndexLoc, 2, gl.FLOAT, false, 0, 0); 
	    this.ext.vertexAttribDivisorANGLE(this.renderProgram.aIndexLoc, 1);

	    //----------------------------------------INSTANCE EXTENSION:

		// Bind the rest of the vertex attributes normally
		//----------------DRAW MODEL:

        gl.bindBuffer( gl.ARRAY_BUFFER, model_vertexVBOs[0] );
        gl.vertexAttribPointer( this.renderProgram.aGeometryVertsLoc, 3, gl.FLOAT, false, 0, 0 );
        gl.enableVertexAttribArray( this.renderProgram.aGeometryVertsLoc );

         //Bind vertex normal buffer
        gl.bindBuffer( gl.ARRAY_BUFFER, model_normalVBOs[0] );
        gl.vertexAttribPointer( this.renderProgram.aGeometryNormalsLoc, 3, gl.FLOAT, false, 0, 0 );
        gl.enableVertexAttribArray( this.renderProgram.aGeometryNormalsLoc );

        gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, model_indexVBOs[0] );
		this.ext.drawElementsInstancedANGLE(gl.TRIANGLES, model_indexVBOs[0].numIndex, gl.UNSIGNED_SHORT, 0, this.numParticles);
        // gl.drawElements( gl.TRIANGLES, model_indexVBOs[i].numIndex, gl.UNSIGNED_SHORT, 0 );

        gl.bindBuffer( gl.ARRAY_BUFFER, null );
        gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, null );    


		// gl.drawArrays( gl.POINTS, 0, this.numParticles );
		
		
		
	},

	updateBuckets : function () {
		if( this.naive ) return;
		gl.useProgram( this.bucketProgram.ref() );
		this.bucketFBO.bind(gl);
		// gl.bindFramebuffer(gl.FRAMEBUFFER, null); //TEMP

		gl.viewport(0, 0, this.gridTextureWidth, this.gridTextureHeight );
		// gl.viewport(0, 0, 1000, 700 ); //TEMP

		gl.bindBuffer( gl.ARRAY_BUFFER, this.bucketProgram.indexBuffer );
		gl.vertexAttribPointer(this.bucketProgram.aIndexLoc, 2, gl.FLOAT, false, 0, 0); 
	    gl.enableVertexAttribArray(this.bucketProgram.aIndexLoc);

		gl.activeTexture( gl.TEXTURE0 );
		gl.bindTexture( gl.TEXTURE_2D, this.movementFBOs[this.srcIndex].texture(0) );
		gl.uniform1i( this.bucketProgram.uPositionsLoc, 0 );

		gl.uniform1f( this.bucketProgram.uHLoc, this.h);
		gl.uniform1f( this.bucketProgram.uTextureLengthLoc, this.textureSideLength );
		// gl.uniform2f( this.bucketProgram.uGridTexDimsLoc, this.gridTextureWidth, this.gridTextureHeight);
		gl.uniform3f( this.bucketProgram.uGridDimsLoc, this.grid.xSpan, this.grid.ySpan, this.grid.zSpan );
		gl.clearColor( -1.0, -1.0, -1.0, -1.0 );
		if(this.viewGrid){
			gl.clearColor( 0.0, 0.0, 0.0, 1.0 ); // TEMP
		}
		

		gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );


		gl.disable( gl.BLEND );
		gl.enable( gl.DEPTH_TEST );
		gl.depthFunc(gl.ALWAYS);
		gl.enable( gl.STENCIL_TEST );

		//Pass 1
		gl.stencilFunc(gl.EQUAL, 0, 0xff );
		//set actions: Fail stencil // Fail Depth // Pass Depth
		gl.stencilOp( gl.INCR, gl.INCR, gl.INCR );
		gl.clear( gl.STENCIL_BUFFER_BIT );
		gl.colorMask( true, false, false, false );
		gl.drawArrays( gl.POINTS, 0, this.numParticles );

		//Pass 2

		gl.stencilFunc(gl.EQUAL, 1, 0xff );
		gl.colorMask( false, true, false, false );
		gl.clear( gl.STENCIL_BUFFER_BIT );
		gl.drawArrays( gl.POINTS, 0, this.numParticles );

		//Pass 3
		gl.stencilFunc(gl.EQUAL, 2, 0xff );
		gl.colorMask( false, false, true, false );
		gl.clear( gl.STENCIL_BUFFER_BIT );
		gl.drawArrays( gl.POINTS, 0, this.numParticles );

		//Pass 4
		gl.stencilFunc(gl.EQUAL, 3, 0xff );
		gl.colorMask( false, false, false, true );
		gl.clear( gl.STENCIL_BUFFER_BIT );
		gl.drawArrays( gl.POINTS, 0, this.numParticles );

		this.bucketFBO.unbind(gl);
		gl.depthFunc( gl.LESS );
		gl.colorMask( true, true, true, true );
		gl.disable(gl.STENCIL_TEST);
		gl.bindBuffer( gl.ARRAY_BUFFER, null );
		gl.clearColor( 0.2, 0.2, 0.2, 1.0 );

	},

	updatePositions : function () {

		gl.useProgram( this.positionProgram.ref() );
		SEC3.renderer.bindQuadBuffers( this.positionProgram );
		// gl.bindFramebuffer( gl.FRAMEBUFFER, null);
		this.movementFBOs[this.destIndex].bind(gl);
		gl.viewport(0, 0, this.textureSideLength, this.textureSideLength);
	    gl.disable(gl.DEPTH_TEST);
	    gl.disable(gl.BLEND);
	  	
	  	gl.uniform1f( this.positionProgram.uStepsLoc, this.stepsPerFrame);
	  	gl.uniform1f( this.positionProgram.uHLoc, this.h );
	    gl.uniform3f( this.positionProgram.uGridDimsLoc, this.grid.xSpan, this.grid.ySpan, this.grid.zSpan );
	    gl.uniform1f( this.positionProgram.uTextureSizeLoc, this.textureSideLength );
	    gl.uniform1f( this.positionProgram.uViscosityKLoc, this.viscosityK );
	    gl.uniform1f( this.positionProgram.uViscosityLinearKLoc, this.viscosityLinearK );
	    gl.uniform1f( this.positionProgram.uMaxVelocityLoc, this.maxVelocity );

	    gl.activeTexture(gl.TEXTURE0);
	    gl.bindTexture(gl.TEXTURE_2D, this.movementFBOs[this.srcIndex].texture(0));
	    gl.uniform1i(this.positionProgram.uPositionsLoc, 0);

	    gl.activeTexture(gl.TEXTURE1);
	    gl.bindTexture(gl.TEXTURE_2D, this.movementFBOs[this.srcIndex].texture(1));
	    gl.uniform1i(this.positionProgram.uVelocityLoc, 1);

	    gl.activeTexture(gl.TEXTURE2);
	    gl.bindTexture(gl.TEXTURE_2D, this.bucketFBO.texture(0));
	    gl.uniform1i(this.positionProgram.uVoxelGridLoc, 2);

	    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0); 
	    gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, null );
    	gl.bindBuffer( gl.ARRAY_BUFFER, null );
    	this.swapSrcDestIndices();

	},


	updateDensity : function () {

		gl.useProgram( this.densityProgram.ref() );
		SEC3.renderer.bindQuadBuffers( this.densityProgram );
		// gl.bindFramebuffer( gl.FRAMEBUFFER, null);
		this.movementFBOs[this.destIndex].bind(gl);
		gl.viewport(0, 0, this.textureSideLength, this.textureSideLength);
	    gl.disable(gl.DEPTH_TEST);
	    gl.disable(gl.BLEND);
	    
	    gl.uniform1f( this.densityProgram.uMassLoc, this.mass );
	    gl.uniform1f( this.densityProgram.uRestDensityLoc, this.restDensity);
	    gl.uniform1f( this.densityProgram.uHLoc, this.h );
	    gl.uniform3f( this.densityProgram.uGridDimsLoc, this.grid.xSpan, this.grid.ySpan, this.grid.zSpan );
	    gl.uniform1f( this.densityProgram.uTextureSizeLoc, this.textureSideLength );

	    gl.activeTexture(gl.TEXTURE0);
	    gl.bindTexture(gl.TEXTURE_2D, this.movementFBOs[this.srcIndex].texture(0));
	    gl.uniform1i(this.densityProgram.uPositionsLoc, 0);

	     gl.activeTexture(gl.TEXTURE1);
	    gl.bindTexture(gl.TEXTURE_2D, this.movementFBOs[this.srcIndex].texture(1));
	    gl.uniform1i(this.densityProgram.uVelocityLoc, 1);

	     gl.activeTexture(gl.TEXTURE2);
	    gl.bindTexture(gl.TEXTURE_2D, this.movementFBOs[this.srcIndex].texture(2));
	    gl.uniform1i(this.densityProgram.uPrevPosLoc, 2);

	    gl.activeTexture(gl.TEXTURE3);
	    gl.bindTexture(gl.TEXTURE_2D, this.bucketFBO.texture(0));
	    gl.uniform1i(this.densityProgram.uVoxelGridLoc, 3);

	    
	    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0); 
	    
	    gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, null );
    	gl.bindBuffer( gl.ARRAY_BUFFER, null );
    	this.swapSrcDestIndices();
	},

	updateVelocities : function () {

		gl.useProgram( this.velocityProgram.ref() );
		SEC3.renderer.bindQuadBuffers( this.velocityProgram );
		// gl.bindFramebuffer( gl.FRAMEBUFFER, null);
		this.movementFBOs[this.destIndex].bind(gl);
		gl.viewport(0, 0, this.textureSideLength, this.textureSideLength);
	    gl.disable(gl.DEPTH_TEST);
	    gl.disable(gl.BLEND);
	    
	   	// gl.uniform2f( this.velocityProgram.uGridTexDimsLoc, this.gridTextureWidth, this.gridTextureHeight);
	   	gl.uniform1f( this.velocityProgram.uSurfaceTensionLoc, this.surfaceTension );
	   	gl.uniform1f( this.velocityProgram.uMaxVelocityLoc, this.maxVelocity);
	    gl.uniform1f( this.velocityProgram.uMassLoc, this.mass );	   	
	   	gl.uniform1f( this.velocityProgram.uTextureSizeLoc, this.textureSideLength );
		gl.uniform3f( this.velocityProgram.uGridDimsLoc, this.grid.xSpan, this.grid.ySpan, this.grid.zSpan );
	    gl.uniform1f( this.velocityProgram.uRestDensityLoc, this.restDensity);
	    gl.uniform1f( this.velocityProgram.uViscosityKLoc, this.viscosityK);
	    gl.uniform1f( this.velocityProgram.uRestPressureLoc, this.restPressure);
	    gl.uniform1f( this.velocityProgram.uHLoc, this.h );
	    gl.uniform1f( this.velocityProgram.uKLoc, this.pressureK );
	    gl.uniform1f( this.velocityProgram.uKNearLoc, this.nearPressureK );
	    gl.uniform1f( this.velocityProgram.uStepsLoc, this.stepsPerFrame );
	    gl.uniformMatrix4fv( this.velocityProgram.uProjectorViewMatLoc0, 0, this.projectors[0].getViewTransform());
	    gl.uniformMatrix4fv( this.velocityProgram.uProjectorProjectionMatLoc0, 0, this.projectors[0].getProjectionMat());
	    gl.uniform3fv( this.velocityProgram.uProjectorPosLoc0, this.projectors[0].getPosition());
	    gl.uniformMatrix4fv( this.velocityProgram.uProjectorViewMatLoc1, 0, this.projectors[1].getViewTransform());
	    gl.uniformMatrix4fv( this.velocityProgram.uProjectorProjectionMatLoc1, 0, this.projectors[1].getProjectionMat());
	    gl.uniform3fv( this.velocityProgram.uProjectorPosLoc1, this.projectors[1].getPosition());
	    gl.uniformMatrix4fv( this.velocityProgram.uProjectorViewMatLoc2, 0, this.projectors[2].getViewTransform());
	    gl.uniformMatrix4fv( this.velocityProgram.uProjectorProjectionMatLoc2, 0, this.projectors[2].getProjectionMat());
	    gl.uniform3fv( this.velocityProgram.uProjectorPosLoc2, this.projectors[2].getPosition());
	    gl.uniformMatrix4fv( this.velocityProgram.uProjectorViewMatLoc3, 0, this.projectors[3].getViewTransform());
	    gl.uniformMatrix4fv( this.velocityProgram.uProjectorProjectionMatLoc3, 0, this.projectors[3].getProjectionMat());
	    gl.uniform3fv( this.velocityProgram.uProjectorPosLoc3, this.projectors[3].getPosition());
	    gl.activeTexture(gl.TEXTURE0);
	    gl.bindTexture(gl.TEXTURE_2D, this.movementFBOs[this.srcIndex].texture(0));
	    gl.uniform1i(this.velocityProgram.uPositionsLoc, 0);

	    gl.activeTexture(gl.TEXTURE1);
	    gl.bindTexture(gl.TEXTURE_2D, this.movementFBOs[this.srcIndex].texture(1));
	    gl.uniform1i(this.velocityProgram.uVelocityLoc, 1);

	    // gl.activeTexture(gl.TEXTURE2); //TODO pack with velocity
	    // gl.bindTexture(gl.TEXTURE_2D, this.densityFBO.texture(0));
	    // gl.uniform1i(this.velocityProgram.uDensitiesLoc, 2);
	    gl.activeTexture(gl.TEXTURE2);
	    gl.bindTexture(gl.TEXTURE_2D, this.movementFBOs[this.srcIndex].texture(2));
	    gl.uniform1i(this.velocityProgram.uVEvalLoc, 2);

	    gl.activeTexture(gl.TEXTURE3);
	    gl.bindTexture(gl.TEXTURE_2D, this.bucketFBO.texture(0));
	    gl.uniform1i(this.velocityProgram.uVoxelGridLoc, 3);

	    gl.activeTexture(gl.TEXTURE4); //scene normals
	    gl.bindTexture(gl.TEXTURE_2D, this.projectors[0].gBuffer.texture(1));
	    gl.uniform1i(this.velocityProgram.uSceneNormalsLoc0, 4);
	    
	    gl.activeTexture(gl.TEXTURE5); //scene depth
	    gl.bindTexture(gl.TEXTURE_2D, this.projectors[0].gBuffer.texture(3));
	    gl.uniform1i(this.velocityProgram.uSceneDepthLoc0, 5);

	     gl.activeTexture(gl.TEXTURE6); //scene normals
	    gl.bindTexture(gl.TEXTURE_2D, this.projectors[1].gBuffer.texture(1));
	    gl.uniform1i(this.velocityProgram.uSceneNormalsLoc1, 6);
	    
	    gl.activeTexture(gl.TEXTURE7); //scene depth
	    gl.bindTexture(gl.TEXTURE_2D, this.projectors[1].gBuffer.texture(3));
	    gl.uniform1i(this.velocityProgram.uSceneDepthLoc1, 7);

	      gl.activeTexture(gl.TEXTURE8); //scene normals
	    gl.bindTexture(gl.TEXTURE_2D, this.projectors[2].gBuffer.texture(1));
	    gl.uniform1i(this.velocityProgram.uSceneNormalsLoc2, 8);
	    
	    gl.activeTexture(gl.TEXTURE9); //scene depth
	    gl.bindTexture(gl.TEXTURE_2D, this.projectors[2].gBuffer.texture(3));
	    gl.uniform1i(this.velocityProgram.uSceneDepthLoc2, 9);

	     gl.activeTexture(gl.TEXTURE10); //scene normals
	    gl.bindTexture(gl.TEXTURE_2D, this.projectors[3].gBuffer.texture(1));
	    gl.uniform1i(this.velocityProgram.uSceneNormalsLoc3, 10);
	    
	    gl.activeTexture(gl.TEXTURE11); //scene depth
	    gl.bindTexture(gl.TEXTURE_2D, this.projectors[3].gBuffer.texture(3));
	    gl.uniform1i(this.velocityProgram.uSceneDepthLoc3, 11);


	    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0); 
	    gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, null );
    	gl.bindBuffer( gl.ARRAY_BUFFER, null );
    	this.swapSrcDestIndices();

	},

//----------------------------------------------------------------------------SETUP:

	addDetectorProjector : function( pos, azimuth, elevation, resolution, farClip ) {
		farClip = farClip || 10.0;
		var projector = new SEC3.OrthoProjector();
		projector.goHome ( pos ); 
	    projector.setAzimuth( azimuth );    
	    projector.setElevation( elevation);
	    // projector.setOrtho( this.grid.xSpan * this.h, this.grid.zSpan * this.h, 0.001, farClip );
	    projector.setOrtho(6.0, 6.0, 0.001, farClip );

	    projector.gBuffer = SEC3.createFBO();
	    if ( ! projector.gBuffer.initialize( gl, resolution, resolution )) {
	        console.log( "FBO initialization failed.");
	        return;
    	}
	    this.projectors.push(projector);
	},

	genStartPositions : function() {

		var startPositions = [];
		
    	for(var i = 0; i < this.numParticles; i++) {

       		var position = this.getUniformPointInSphere(1.0);

       		startPositions.push(position[0] + 2.0);
       		startPositions.push(position[1] + 2.0);
       		startPositions.push(position[2] + 2.0);
       		startPositions.push( 1.0 );
       	}
       	return startPositions;
    },

    genCubeStartPositions : function () {

    	var scale = 1 / 9; //TODO slider
    	var jitter = 0.0001;
    	var width = 32;
    	var height = 64;
    	var depth = 8;
   

		var startPositions = [];
    	for ( var i = 0; i < width; i++) {
    		for ( var j = 0; j < height; j++ ) {
    			for ( var k = 0; k < depth; k++ ) {
    				startPositions.push(i * scale + 2.4 + Math.random() * jitter);
    				startPositions.push(j * scale + 4.1 + Math.random() * jitter);
    				startPositions.push(k * scale + 0.4 + Math.random() * jitter);
    				startPositions.push( 1.0 );
    			}
    		}
    	}
    	return startPositions;	

    },

    genEvalVelocities : function() {

    	var startVelocities = [];
    	for( var i = 0; i < this.numParticles; i++ ) {
    		startVelocities.push( 0.0 );
    		startVelocities.push(0.0);
    		startVelocities.push( 0.0 );
    		startVelocities.push( 1.0 );
    	}
    	return startVelocities;
    },

     genStartVelocities : function() {

    	var startVelocities = [];
    	for( var i = 0; i < this.numParticles; i++ ) {
    		startVelocities.push( 0.0 );
    		startVelocities.push( 0.0 );
    		startVelocities.push( 0.0 );
    		startVelocities.push( 1.0 );
    	}
    	return startVelocities;
    },

    genParticleIndices : function() {

    	var indices = [];
    	var textureLength = this.textureSideLength;
    	for (var i = 0; i < this.numParticles; i++) {

       		var xIndex = Math.floor(i % textureLength) / textureLength;
	        var yIndex = Math.floor(i / textureLength) / textureLength; 
       		indices.push(xIndex);
       		indices.push(yIndex);
    	}
    	return indices;
    },

    genGridTexture : function() {

    	var xSpan = 49.0;
    	var ySpan = 81.0;
    	var zSpan = 25.0;
    	var sqrtY = Math.sqrt(ySpan);
    	this.grid.xSpan = xSpan;
    	this.grid.ySpan = ySpan;
    	this.grid.zSpan = zSpan;

    	this.gridTextureWidth = xSpan * sqrtY;
    	this.gridTextureHeight = zSpan * sqrtY;

    	
    	
    	var gridTexture = SEC3.generateTexture(this.gridTextureWidth, this.gridTextureHeight);
    	return gridTexture;
    }, 

	getUniformPointInSphere : function(radius) {

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
	},

	initFBOs : function() {

		var startPositions = this.genCubeStartPositions();
		var indices = this.genParticleIndices();
		var startVelocities = this.genStartVelocities();
		var evalVelocities = this.genEvalVelocities();

		var positionTextureA = SEC3.generateTexture(this.textureSideLength,
													this.textureSideLength,
													startPositions);
		var positionTextureB = SEC3.generateTexture(this.textureSideLength,
													this.textureSideLength,
													startPositions);

		var velocityTextureA = SEC3.generateTexture(this.textureSideLength,
													this.textureSideLength,
													startVelocities);
		var velocityTextureA2 = SEC3.generateTexture(this.textureSideLength,
													this.textureSideLength,
													evalVelocities);
		var velocityTextureB = SEC3.generateTexture(this.textureSideLength,
													this.textureSideLength,
													startVelocities);
		var velocityTextureB2 = SEC3.generateTexture(this.textureSideLength,
													this.textureSideLength,
													evalVelocities);



		this.movementFBOs = [];

		var movementFBOa = SEC3.createFBO();
		movementFBOa.initialize( gl, this.textureSideLength,
								this.textureSideLength,
								3,
								[ positionTextureA, 
								velocityTextureA,
								velocityTextureA2]);	
		this.movementFBOs.push(movementFBOa)

		var movementFBOb = SEC3.createFBO();
		movementFBOb.initialize( gl, this.textureSideLength,
								this.textureSideLength,
								3,
								[ positionTextureB, 
								velocityTextureB,
								velocityTextureB2]);	
		this.movementFBOs.push(movementFBOb)

		this.indexFBO = SEC3.createFBO();
		this.indexFBO.initialize( gl, this.textureSideLength,
								  this.textureSideLength,
								  1 );

		this.densityFBO = SEC3.createFBO();
		this.densityFBO.initialize( gl, this.textureSideLength,
								  this.textureSideLength,
								  1 );

		var gridTex = this.genGridTexture();
		this.bucketFBO = SEC3.createFBO();
		this.bucketFBO.initialize( gl, this.gridTextureWidth,
								this.gridTextureHeight,
								1 , [gridTex]);
		// this.bucketFBO.addStencil(gl);

	},

	initShaders : function() {
		var indices = this.genParticleIndices();
		var self = this;
		

		//--------------------------------------------------UPDATE POSITIONS
		var positionProgram = SEC3.createShaderProgram();
		positionProgram.loadShader(gl,
								 "Sec3Engine/shader/densitySPH.vert",
								 "Sec3Engine/shader/positionSPH.frag");
		positionProgram.addCallback( function() {
			positionProgram.aVertexPosLoc = gl.getAttribLocation( positionProgram.ref(), "a_pos" );
	        positionProgram.aVertexTexcoordLoc = gl.getAttribLocation( positionProgram.ref(), "a_texCoord" );
	        positionProgram.uPositionsLoc = gl.getUniformLocation( positionProgram.ref(), "u_positions" );
	        positionProgram.uVelocityLoc = gl.getUniformLocation( positionProgram.ref(), "u_velocity" );
	        positionProgram.uStepsLoc = gl.getUniformLocation( positionProgram.ref(), "u_steps");
	        positionProgram.uHLoc = gl.getUniformLocation( positionProgram.ref(), "u_h" );
	        positionProgram.uGridDimsLoc = gl.getUniformLocation( positionProgram.ref(), "u_gridDims" );
	        positionProgram.uVoxelGridLoc = gl.getUniformLocation( positionProgram.ref(), "u_voxelGrid" );
	        positionProgram.uTextureSizeLoc = gl.getUniformLocation( positionProgram.ref(), "u_textureSize");
	        positionProgram.uViscosityKLoc = gl.getUniformLocation( positionProgram.ref(), "u_viscosity");
	        positionProgram.uViscosityLinearKLoc = gl.getUniformLocation( positionProgram.ref(), "u_viscosityLinear");
	        positionProgram.uMaxVelocityLoc = gl.getUniformLocation( positionProgram.ref(), "u_maxVelocity");
		})
		SEC3.registerAsyncObj( gl, positionProgram );
		this.positionProgram = positionProgram;

		//--------------------------------------------------BUILD BUCKETS:)
		var bucketProgram = SEC3.createShaderProgram();
		bucketProgram.loadShader(gl,
								 "Sec3Engine/shader/bucketBuilderSPH.vert",
								 "Sec3Engine/shader/bucketBuilderSPH.frag");
		bucketProgram.addCallback( function() {
			bucketProgram.aIndexLoc = gl.getAttribLocation( bucketProgram.ref(), "a_index");
			bucketProgram.uPositionsLoc = gl.getUniformLocation( bucketProgram.ref(), "u_positions");
			bucketProgram.uTextureLengthLoc = gl.getUniformLocation( bucketProgram.ref(), "u_textureLength");
			bucketProgram.uGridDimsLoc = gl.getUniformLocation( bucketProgram.ref(), "u_gridDims");
			// bucketProgram.uGridTexDimsLoc = gl.getUniformLocation( bucketProgram.ref(), "u_gridTexDims");
			bucketProgram.uHLoc = gl.getUniformLocation( bucketProgram.ref(), "u_h");
			bucketProgram.indexBuffer = SEC3.createBuffer(2, //item size
	                          self.numParticles, //num items
	                          indices, //data
	                          bucketProgram.aIndexLoc); //location
		})
		SEC3.registerAsyncObj( gl, bucketProgram );
		this.bucketProgram = bucketProgram;
		//-------------------------------------------------UPDATE DENSITIES:
		var densityProgram = SEC3.createShaderProgram();
		densityProgram.loadShader(gl, 
								"Sec3Engine/shader/densitySPH.vert",
								"Sec3Engine/shader/densitySPH.frag");
		densityProgram.addCallback( function() {
			densityProgram.aVertexPosLoc = gl.getAttribLocation( densityProgram.ref(), "a_pos" );
	        densityProgram.aVertexTexcoordLoc = gl.getAttribLocation( densityProgram.ref(), "a_texCoord" );
	        densityProgram.uPositionsLoc = gl.getUniformLocation( densityProgram.ref(), "u_positions" );
	        densityProgram.uHLoc = gl.getUniformLocation( densityProgram.ref(), "u_h" );
	        densityProgram.uGridDimsLoc = gl.getUniformLocation( densityProgram.ref(), "u_gridDims" );
	        densityProgram.uVoxelGridLoc = gl.getUniformLocation( densityProgram.ref(), "u_voxelGrid" );
	        densityProgram.uTextureSizeLoc = gl.getUniformLocation( densityProgram.ref(), "u_textureSize");
	       	densityProgram.uMassLoc = gl.getUniformLocation( densityProgram.ref(), "u_mass");
	       	densityProgram.uRestDensityLoc = gl.getUniformLocation( densityProgram.ref(), "u_restDensity");
	       	densityProgram.uVelocityLoc = gl.getUniformLocation( densityProgram.ref(), "u_velocity");
	       	densityProgram.uPrevPosLoc = gl.getUniformLocation( densityProgram.ref(), "u_prevPos");

	        // densityProgram.uInvTextureLengthLoc = gl.getUniformLocation( densityProgram.ref(), "u_invTextureLength" );	        
	        // gl.useProgram( densityProgram.ref() );
	        // gl.uniform1f( densityProgram.uInvTextureLengthLoc, self.textureSideLength );

		} );
		SEC3.registerAsyncObj( gl, densityProgram );
		this.densityProgram = densityProgram;

		//-------------------------------------RECOMPUTE VELOCITY:
		var velocityProgram = SEC3.createShaderProgram();
		velocityProgram.loadShader(gl, 
										   "Sec3Engine/shader/densitySPH.vert",
								   		   "Sec3Engine/shader/velocitySPH.frag");
		velocityProgram.addCallback( function() {
			velocityProgram.aVertexPosLoc = gl.getAttribLocation( velocityProgram.ref(), "a_pos" );
	        velocityProgram.aVertexTexcoordLoc = gl.getAttribLocation( velocityProgram.ref(), "a_texCoord" );
			velocityProgram.uTextureSizeLoc = gl.getUniformLocation( velocityProgram.ref(), "u_textureSize");
	        velocityProgram.uPositionsLoc = gl.getUniformLocation( velocityProgram.ref(), "u_positions" );
	        velocityProgram.uVoxelGridLoc = gl.getUniformLocation( velocityProgram.ref(), "u_voxelGrid" );
	        velocityProgram.uVelocityLoc = gl.getUniformLocation( velocityProgram.ref(), "u_velocity" );
	        velocityProgram.uVEvalLoc = gl.getUniformLocation( velocityProgram.ref(), "u_prevPos" );
			velocityProgram.uHLoc = gl.getUniformLocation( velocityProgram.ref(), "u_h" );
			velocityProgram.uKLoc = gl.getUniformLocation( velocityProgram.ref(), "u_k");
			velocityProgram.uMaxVelocityLoc = gl.getUniformLocation( velocityProgram.ref(), "u_maxVelocity");
			velocityProgram.uKNearLoc = gl.getUniformLocation( velocityProgram.ref(), "u_kNear" );
			velocityProgram.uRestDensityLoc = gl.getUniformLocation( velocityProgram.ref(), "u_restDensity");			
			velocityProgram.uRestPressureLoc = gl.getUniformLocation( velocityProgram.ref(), "u_restPressure");			
			velocityProgram.uStepsLoc = gl.getUniformLocation( velocityProgram.ref(), "u_steps" );
			velocityProgram.uViscosityKLoc = gl.getUniformLocation( velocityProgram.ref(), "u_kViscosity");
			velocityProgram.uGridDimsLoc = gl.getUniformLocation( velocityProgram.ref(), "u_gridDims");
			velocityProgram.uSceneDepthLoc0 = gl.getUniformLocation( velocityProgram.ref(), "u_sceneDepth0");
			velocityProgram.uSceneNormalsLoc0 = gl.getUniformLocation( velocityProgram.ref(), "u_sceneNormals0");
			velocityProgram.uProjectorViewMatLoc0 = gl.getUniformLocation( velocityProgram.ref(), "u_projectorViewMat0");
			velocityProgram.uProjectorProjectionMatLoc0 = gl.getUniformLocation( velocityProgram.ref(), "u_projectorProjectionMat0");			
			velocityProgram.uProjectorPosLoc0 = gl.getUniformLocation( velocityProgram.ref(), "u_projectorPos0");						
			velocityProgram.uSceneDepthLoc1 = gl.getUniformLocation( velocityProgram.ref(), "u_sceneDepth1");
			velocityProgram.uSceneNormalsLoc1 = gl.getUniformLocation( velocityProgram.ref(), "u_sceneNormals1");
			velocityProgram.uProjectorViewMatLoc1 = gl.getUniformLocation( velocityProgram.ref(), "u_projectorViewMat1");
			velocityProgram.uProjectorProjectionMatLoc1 = gl.getUniformLocation( velocityProgram.ref(), "u_projectorProjectionMat1");			
			velocityProgram.uProjectorPosLoc1 = gl.getUniformLocation( velocityProgram.ref(), "u_projectorPos1");
			velocityProgram.uSceneDepthLoc2 = gl.getUniformLocation( velocityProgram.ref(), "u_sceneDepth2");
			velocityProgram.uSceneNormalsLoc2 = gl.getUniformLocation( velocityProgram.ref(), "u_sceneNormals2");
			velocityProgram.uProjectorViewMatLoc2 = gl.getUniformLocation( velocityProgram.ref(), "u_projectorViewMat2");
			velocityProgram.uProjectorProjectionMatLoc2 = gl.getUniformLocation( velocityProgram.ref(), "u_projectorProjectionMat2");			
			velocityProgram.uProjectorPosLoc2 = gl.getUniformLocation( velocityProgram.ref(), "u_projectorPos2");	
			velocityProgram.uSceneDepthLoc3 = gl.getUniformLocation( velocityProgram.ref(), "u_sceneDepth3");
			velocityProgram.uSceneNormalsLoc3 = gl.getUniformLocation( velocityProgram.ref(), "u_sceneNormals3");
			velocityProgram.uProjectorViewMatLoc3 = gl.getUniformLocation( velocityProgram.ref(), "u_projectorViewMat3");
			velocityProgram.uProjectorProjectionMatLoc3 = gl.getUniformLocation( velocityProgram.ref(), "u_projectorProjectionMat3");			
			velocityProgram.uProjectorPosLoc3 = gl.getUniformLocation( velocityProgram.ref(), "u_projectorPos3");	
			velocityProgram.uMassLoc = gl.getUniformLocation( velocityProgram.ref(), "u_mass");
			velocityProgram.uSurfaceTensionLoc = gl.getUniformLocation( velocityProgram.ref(), "u_surfaceTension");


			// velocityProgram.uGridTexDimsLoc = gl.getUniformLocation( velocityProgram.ref(), "u_gridTexDims");

	        // densityProgram.uInvTextureLengthLoc = gl.getUniformLocation( densityProgram.ref(), "u_invTextureLength" );	        
	        // gl.useProgram( densityProgram.ref() );
	        // gl.uniform1f( densityProgram.uInvTextureLengthLoc, self.textureSideLength );

		} );
		SEC3.registerAsyncObj( gl, velocityProgram );
		this.velocityProgram = velocityProgram;

		//-------------------------------------------------RENDER:
		var renderProgram = SEC3.createShaderProgram();
		renderProgram.loadShader(gl, 
								 "Sec3Engine/shader/renderSPH.vert",
								 "Sec3Engine/shader/renderSPH.frag");
		renderProgram.addCallback( function() {
	        renderProgram.aIndexLoc = gl.getAttribLocation(renderProgram.ref(), "a_index");
	        renderProgram.aGeometryVertsLoc = gl.getAttribLocation(renderProgram.ref(), "a_GeometryVerts");
	        renderProgram.aGeometryNormalsLoc = gl.getAttribLocation(renderProgram.ref(), "a_GeometryNormals");

	        renderProgram.uCamPosLoc = gl.getUniformLocation(renderProgram.ref(), "u_camPos");
	        renderProgram.uDepthLoc = gl.getUniformLocation(renderProgram.ref(), "u_depth");

	        renderProgram.uScreenDimsLoc = gl.getUniformLocation( renderProgram.ref(), "u_screenDims");
	        renderProgram.uParticleSizeLoc = gl.getUniformLocation(renderProgram.ref(), "u_particleSize");
	        renderProgram.uMVPLoc = gl.getUniformLocation(renderProgram.ref(), "u_MVP");
	        renderProgram.uPositionsLoc = gl.getUniformLocation(renderProgram.ref(), "u_positions");
	        renderProgram.uTestTexLoc = gl.getUniformLocation(renderProgram.ref(), "u_testTex");	        
	        gl.useProgram( renderProgram.ref() );
			renderProgram.indexBuffer = SEC3.createBuffer(2, //item size
	                          self.numParticles, //num items
	                          indices, //data
	                          renderProgram.aIndexLoc); //location

	    } );
		SEC3.registerAsyncObj( gl, renderProgram );
		this.renderProgram = renderProgram;
	},

//--------------------------------------------------------------------------HELPERS:
	
	/*
	 * Updates/toggles globals srcIndex and destIndex
	 */
	swapSrcDestIndices : function() {

	    this.isSrcIndex0 = ! this.isSrcIndex0;

	    if (this.isSrcIndex0) {
	        this.srcIndex = 0;
	        this.destIndex = 1;
	    }
	    else {
	        this.srcIndex = 1;
	        this.destIndex = 0;
	    }
	}

	
};


