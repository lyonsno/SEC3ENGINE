SEC3 = SEC3 || {};

SEC3.postFx = {};

var demo = {};
demo.zNear = 0.1;
demo.zFar = 30.0;
/*
 *	create postFx shaders and register them as async objects.
 *	must be called before SEC3.postFx can be used
 */
SEC3.postFx.init = function() {

//----------------------------------------------------BLEND ADDITIVE:
	var blendAdditiveProg = SEC3.createShaderProgram();
	//Load the shader source asynchronously
	blendAdditiveProg.loadShader( gl, 
	                     "Sec3Engine/shader/blendAdditive.vert", 
	                     "Sec3Engine/shader/blendAdditive.frag" );

	blendAdditiveProg.addCallback( function() {
	    gl.useProgram( blendAdditiveProg.ref() );
	    //query the locations of shader parameters
	    blendAdditiveProg.aVertexPosLoc = gl.getAttribLocation( blendAdditiveProg.ref(), "a_pos" );
	    blendAdditiveProg.aVertexTexcoordLoc = gl.getAttribLocation( blendAdditiveProg.ref(), "a_texcoord" );
	    
	    blendAdditiveProg.uTexture1Loc = gl.getUniformLocation( blendAdditiveProg.ref(), "u_texture1");
	    blendAdditiveProg.uWeight1Loc = gl.getUniformLocation( blendAdditiveProg.ref(), "u_weight1");
	    blendAdditiveProg.uTexture2Loc = gl.getUniformLocation( blendAdditiveProg.ref(), "u_texture2");
	    blendAdditiveProg.uWeight2Loc = gl.getUniformLocation( blendAdditiveProg.ref(), "u_weight2");        
	    blendAdditiveProg.uDepthLoc = gl.getUniformLocation( blendAdditiveProg.ref(), "u_depth");
	    blendAdditiveProg.uDepthWriteLoc = gl.getUniformLocation( blendAdditiveProg.ref(), "u_depthWrite");
	} );
	SEC3.registerAsyncObj( gl, blendAdditiveProg );
	SEC3.postFx.blendAdditiveProg = blendAdditiveProg;

//---------------------------------------------------FINAL PASS:
    var backBufferWriteProg = SEC3.createShaderProgram();
    backBufferWriteProg.loadShader( gl, 
                               "Sec3Engine/shader/finalPass.vert", 
                               "Sec3Engine/shader/finalPass.frag" );

    backBufferWriteProg.addCallback( function(){
        //query the locations of shader parameters
        backBufferWriteProg.aVertexPosLoc = gl.getAttribLocation( backBufferWriteProg.ref(), "a_pos" );
        backBufferWriteProg.aVertexTexcoordLoc = gl.getAttribLocation( backBufferWriteProg.ref(), "a_texcoord" );
        
        backBufferWriteProg.uFinalImageLoc = gl.getUniformLocation( backBufferWriteProg.ref(), "u_colorTex");

    } );
    SEC3.registerAsyncObj( gl, backBufferWriteProg );
	SEC3.postFx.backBufferWriteProg = backBufferWriteProg;

//----------------------------------------------------BLUR PASS:
    var blurGaussianProg = SEC3.createShaderProgram();
    blurGaussianProg.loadShader( gl, 
                         "Sec3Engine/shader/texture.vert", 
                         "Sec3Engine/shader/gaussianBlur.frag" );

    blurGaussianProg.addCallback( function(){
        //query the locations of shader parameters
        blurGaussianProg.aVertexPosLoc = gl.getAttribLocation( blurGaussianProg.ref(), "a_pos" );
        blurGaussianProg.aVertexTexcoordLoc = gl.getAttribLocation( blurGaussianProg.ref(), "a_texcoord");
        blurGaussianProg.uSourceLoc = gl.getUniformLocation( blurGaussianProg.ref(), "u_source");
        blurGaussianProg.uBlurDirectionLoc = gl.getUniformLocation( blurGaussianProg.ref(), "u_blurDirection");
        blurGaussianProg.uLilSigLoc = gl.getUniformLocation( blurGaussianProg.ref(), "u_lilSig");
        blurGaussianProg.uPixDimLoc = gl.getUniformLocation( blurGaussianProg.ref(), "u_pixDim");
        gl.useProgram(blurGaussianProg.ref());
        var width = SEC3.canvas.width;
        var height = SEC3.canvas.height;
        gl.uniform2fv(blurGaussianProg.uPixDimLoc, vec2.fromValues(1.0 / width, 1.0 / height));
        gl.uniform1f(blurGaussianProg.uLilSigLoc, 4.0);
    } );

    SEC3.registerAsyncObj( gl, blurGaussianProg );
    SEC3.postFx.blurGaussianProg = blurGaussianProg;

//-------------------------------------------------DOFDOWNSAMPLE PASS:  
    var dofDownsampleProg = SEC3.createShaderProgram();
    dofDownsampleProg.loadShader( gl, 
                         "Sec3Engine/shader/finalPass.vert", 
                         "Sec3Engine/shader/dofDownsample.frag" );

    dofDownsampleProg.addCallback( function(){
        //query the locations of shader parameters
        dofDownsampleProg.aVertexPosLoc = gl.getAttribLocation( dofDownsampleProg.ref(), "a_pos" );
        dofDownsampleProg.aVertexTexcoordLoc = gl.getAttribLocation( dofDownsampleProg.ref(), "a_texcoord");
        dofDownsampleProg.uSourceLoc = gl.getUniformLocation( dofDownsampleProg.ref(), "u_source");
        dofDownsampleProg.uDepthLoc = gl.getUniformLocation( dofDownsampleProg.ref(), "u_depth");
        dofDownsampleProg.uPixDimLoc = gl.getUniformLocation( dofDownsampleProg.ref(), "u_pixDim");
        dofDownsampleProg.uNearLoc = gl.getUniformLocation( dofDownsampleProg.ref(), "u_near");
        dofDownsampleProg.uFarLoc = gl.getUniformLocation( dofDownsampleProg.ref(), "u_far");
        dofDownsampleProg.uDofEqLoc = gl.getUniformLocation( dofDownsampleProg.ref(), "u_dofEq");
        gl.useProgram(dofDownsampleProg.ref());
        var width = SEC3.canvas.width;
        var height = SEC3.canvas.height;
        gl.uniform2fv(dofDownsampleProg.uPixDimLoc, vec2.fromValues(1.0 / width, 1.0 / height));
        gl.uniform1f( dofDownsampleProg.uNearLoc, demo.zNear );
        gl.uniform1f( dofDownsampleProg.uFarLoc, demo.zFar );
        gl.uniform2fv( dofDownsampleProg.uDofEqLoc, vec2.fromValues(demo.nearSlope, demo.nearIntercept));
    } );

    SEC3.registerAsyncObj( gl, dofDownsampleProg );
    SEC3.postFx.dofDownsampleProg = dofDownsampleProg;

//-----------------------------------------------DOFCOMP PASS:
    var dofCompProg = SEC3.createShaderProgram();
    dofCompProg.loadShader( gl,
                            "Sec3Engine/shader/finalPass.vert",
                            "Sec3Engine/shader/dofComp.frag");

    dofCompProg.addCallback( function(){

        dofCompProg.aVertexPosLoc = gl.getAttribLocation( dofCompProg.ref(), "a_pos" );
        dofCompProg.aVertexTexcoordLoc = gl.getAttribLocation( dofCompProg.ref(), "a_texcoord" );
        dofCompProg.uBlurredForegroundLoc = gl.getUniformLocation( dofCompProg.ref(), "u_blurredForeground" );
        dofCompProg.uUnalteredImageLoc = gl.getUniformLocation( dofCompProg.ref(), "u_unalteredImage" );
        dofCompProg.uDownsampledLoc = gl.getUniformLocation( dofCompProg.ref(), "u_downsampled" );
        dofCompProg.uSmallBlurLoc = gl.getUniformLocation( dofCompProg.ref(), "u_smallBlur" );
        dofCompProg.uDepthLoc = gl.getUniformLocation( dofCompProg.ref(), "u_depth" );
        dofCompProg.uFarEqLoc = gl.getUniformLocation( dofCompProg.ref(), "u_farEq" );
        dofCompProg.uZNearLoc = gl.getUniformLocation( dofCompProg.ref(), "u_near" );
        dofCompProg.uZFarLoc = gl.getUniformLocation( dofCompProg.ref(), "u_far" );

    } );

    SEC3.registerAsyncObj( gl, dofCompProg );
    SEC3.postFx.dofCompProg = dofCompProg;

//-----------------------------------------------DOFCALCCOC PASS:
    var dofCalcCocProg = SEC3.createShaderProgram();
    dofCalcCocProg.loadShader( gl,
                               "Sec3Engine/shader/finalPass.vert",
                               "Sec3Engine/shader/dofCalcCoc.frag");

    dofCalcCocProg.addCallback( function(){

        dofCalcCocProg.aVertexPosLoc = gl.getAttribLocation( dofCalcCocProg.ref(), "a_pos" );
        dofCalcCocProg.aVertexTexcoordLoc = gl.getAttribLocation( dofCalcCocProg.ref(), "a_texcoord");
        dofCalcCocProg.uDownsampledLoc = gl.getUniformLocation( dofCalcCocProg.ref(), "u_downsampled" ); 
        dofCalcCocProg.uBlurredForegroundLoc = gl.getUniformLocation( dofCalcCocProg.ref(), "u_blurredForeground" );
    });

    SEC3.registerAsyncObj( gl, dofCalcCocProg );
    SEC3.postFx.dofCalcCocProg = dofCalcCocProg;

};


//------------------------------------------------------------------------POST PASSES:
/*
 * additively blend texture1 with texture2 according to their weights
 * write result into destBuffer.texture(0)
 * if depthTexture is specified, write it into destBuffer.texture(1)
 */
SEC3.postFx.blendAdditive = function( texture1, weight1, texture2, weight2, destBuffer, depthTexture ) {

    destBuffer.bind(gl);
    gl.viewport( 0, 0, destBuffer.getWidth(), destBuffer.getHeight() );
    gl.disable( gl.DEPTH_TEST );
    gl.disable( gl.BLEND );
    gl.useProgram( SEC3.postFx.blendAdditiveProg.ref() );
    gl.uniform1f( SEC3.postFx.blendAdditiveProg.uWeight1Loc, weight1 );
    gl.uniform1f( SEC3.postFx.blendAdditiveProg.uWeight2Loc, weight2 ); 


    gl.activeTexture( gl.TEXTURE0 );
    gl.bindTexture( gl.TEXTURE_2D, texture1);
    gl.uniform1i( SEC3.postFx.blendAdditiveProg.uTexture1Loc, 0);

    gl.activeTexture( gl.TEXTURE1 );
    gl.bindTexture( gl.TEXTURE_2D, texture2);
    gl.uniform1i( SEC3.postFx.blendAdditiveProg.uTexture2Loc, 1);
    
    if( depthTexture ) {
        gl.uniform1i( SEC3.postFx.blendAdditiveProg.uDepthWriteLoc, 1 );
        gl.activeTexture( gl.TEXTURE2 );
        gl.bindTexture( gl.TEXTURE_2D, depthTexture );
        gl.uniform1i( SEC3.postFx.blendAdditiveProg.uDepthLoc, 2 );
    }
    else {
        gl.uniform1i( SEC3.postFx.blendAdditiveProg.uDepthWriteLoc, 0 );
    }

    SEC3.renderer.bindQuadBuffers( SEC3.postFx.blendAdditiveProg );
    gl.drawElements( gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0 );
    destBuffer.unbind(gl);
    gl.useProgram( null );
};

/*
 * write contents of texture to BackBuffer, or other framebuffer if specified
 */
SEC3.postFx.finalPass = function(texture, framebuffer){

    gl.bindFramebuffer(gl.FRAMEBUFFER, null); 
    gl.useProgram(SEC3.postFx.backBufferWriteProg.ref());
    
    if(framebuffer) {
        gl.viewport( 0, 0, framebuffer.getWidth(), framebuffer.getHeight());
    }
    else {
        gl.viewport( 0, 0, SEC3.canvas.width, SEC3.canvas.height );
    }
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(SEC3.postFx.backBufferWriteProg.uFinalImageLoc, 0);

    gl.disable( gl.DEPTH_TEST );
    SEC3.renderer.bindQuadBuffers(SEC3.postFx.backBufferWriteProg);

    gl.drawElements( gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0 );


    gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, null );
    gl.bindBuffer( gl.ARRAY_BUFFER, null );
};

/*
 * Two passes, one to blur vertically and one to blur horizontally
 * write result into framebuffer
 */
SEC3.postFx.blurGaussian = function(srcTex, framebuffer, sigma) {
    var vertical = 1;
    var horizontal = 0;

    framebuffer.bind(gl);

    gl.viewport( 0, 0, framebuffer.getWidth(), framebuffer.getHeight());

    gl.useProgram( SEC3.postFx.blurGaussianProg.ref() );
    gl.uniform1f( SEC3.postFx.blurGaussianProg.uLilSigLoc, sigma * sigma);
    
    gl.uniform2fv(SEC3.postFx.blurGaussianProg.uPixDimLoc, vec2.fromValues(1.0 / framebuffer.getWidth(), 1.0 / framebuffer.getHeight()));

    gl.disable( gl.DEPTH_TEST );
    
     // first, texToDisplay texture is source
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture( gl.TEXTURE_2D, srcTex );
    gl.uniform1i( SEC3.postFx.blurGaussianProg.uSourceLoc, 0 );
    // workingFBO slot 0 will be written to with the vertical blur
    // making a vertical smear (1 = Vertical Pass)
    gl.uniform1i( SEC3.postFx.blurGaussianProg.uBlurDirectionLoc, vertical );
    // and draw!

    SEC3.renderer.bindQuadBuffers(SEC3.postFx.blurGaussianProg);

    gl.drawElements( gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0 );
    
    // then, vertically blured texture is source (old dest)
    
    framebuffer.swapBuffers(0, 1, gl);

    framebuffer.bind(gl);

    gl.activeTexture( gl.TEXTURE0 );
    gl.bindTexture( gl.TEXTURE_2D, framebuffer.texture(1) );
    gl.uniform1i( SEC3.postFx.blurGaussianProg.uSourceLoc, 0);

    gl.uniform1i( SEC3.postFx.blurGaussianProg.uBlurDirectionLoc, horizontal );

    SEC3.renderer.bindQuadBuffers(SEC3.postFx.blurGaussianProg);
    gl.drawElements( gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0 );
    // framebuffer.swapBuffers(0, 1, gl);
    
    gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, null );
    gl.bindBuffer( gl.ARRAY_BUFFER, null ); 
    
    framebuffer.unbind(gl); 
};

/*
 * applies depth of field to contents of finalFBO(0)
 * uses depth stored in finalFBO(1)
 */
SEC3.postFx.dofPass = function(){
   
    gl.useProgram( SEC3.postFx.dofDownsampleProg.ref() );
    lowResFBO.bind(gl);
    gl.viewport( 0, 0, lowResFBO.getWidth(), lowResFBO.getHeight() );
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable( gl.DEPTH_TEST );
    gl.disable( gl.BLEND);
    gl.activeTexture( gl.TEXTURE0 );
    gl.bindTexture( gl.TEXTURE_2D, finalFBO.texture(0) );
    gl.uniform1i( SEC3.postFx.dofDownsampleProg.uSourceLoc, 0);

    gl.activeTexture( gl.TEXTURE1 );
    gl.bindTexture( gl.TEXTURE_2D, finalFBO.texture(1) );
    gl.uniform1i( SEC3.postFx.dofDownsampleProg.uDepthLoc, 1);

    gl.uniform2fv( SEC3.postFx.dofDownsampleProg.uPixDimLoc, vec2.fromValues(1.0 / SEC3.canvas.width, 1.0 / SEC3.canvas.height) );
   
    SEC3.renderer.bindQuadBuffers(SEC3.postFx.dofDownsampleProg);

    gl.drawElements( gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, null);
    gl.bindBuffer( gl.ARRAY_BUFFER, null );
    // lowResFBO[0],[1]  both have downsampled color and coc

    lowResFBO.swapBuffers(0, 2, gl );
    lowResFBO.swapBuffers( 1, 3, gl );

    SEC3.postFx.blurGaussian(lowResFBO.texture(3), lowResFBO, demo.LARGE_BLUR); 
    lowResFBO.swapBuffers(0, 3, gl);
    // lowResFBO[3] now has large blurred downsampled color and coc
        
    //----------------------------------- Calculate Final Coc: 


    gl.useProgram( SEC3.postFx.dofCalcCocProg.ref() );
    lowResFBO.bind(gl);
    gl.activeTexture( gl.TEXTURE0 );
    gl.bindTexture(gl.TEXTURE_2D, lowResFBO.texture(3));
    gl.uniform1i( SEC3.postFx.dofCalcCocProg.uBlurredForegroundLoc, 0);

    gl.activeTexture( gl.TEXTURE1 );
    gl.bindTexture( gl.TEXTURE_2D, lowResFBO.texture(2));
    gl.uniform1i( SEC3.postFx.dofCalcCocProg.uDownsampledLoc, 1);

    
    gl.disable(gl.DEPTH_TEST);
    gl.viewport(0, 0, lowResFBO.getWidth(), lowResFBO.getHeight());
    SEC3.renderer.bindQuadBuffers( SEC3.postFx.dofCalcCocProg );

    gl.drawElements( gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, null);
    gl.bindBuffer( gl.ARRAY_BUFFER, null );
    // lowResFBO[0] now has downsampled color and proper coc

    //----------------------------------

    // lowResFBO.swapBuffers(1, 3, gl);
    lowResFBO.swapBuffers(0, 2, gl);
    // lowResFBO[2] has proper coc
    // lowResFBO[3] has blurred downsampled foreground

    SEC3.postFx.blurGaussian(lowResFBO.texture(2), lowResFBO, demo.MEDIUM_BLUR);
    // lowResFBO[0] has small blur on final near coc 

    SEC3.postFx.blurGaussian(finalFBO.texture( 0 ), workingFBO, demo.SMALL_BLUR);
    workingFBO.swapBuffers(0, 1, gl);
    

    //-------------------------- 

    gl.useProgram( SEC3.postFx.dofCompProg.ref() );

    workingFBO.bind(gl);
    gl.viewport( 0, 0, workingFBO.getWidth(), workingFBO.getHeight() );

    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.BLEND);

    gl.activeTexture( gl.TEXTURE0 );
    gl.bindTexture( gl.TEXTURE_2D, lowResFBO.texture(3) );
    gl.uniform1i( SEC3.postFx.dofCompProg.uBlurredForegroundLoc, 0 );

    gl.activeTexture( gl.TEXTURE1 );
    gl.bindTexture( gl.TEXTURE_2D, lowResFBO.texture(0) );
    gl.uniform1i( SEC3.postFx.dofCompProg.uDownsampledLoc, 1 );

    gl.activeTexture( gl.TEXTURE2 );
    gl.bindTexture( gl.TEXTURE_2D, workingFBO.texture(1) );
    gl.uniform1i( SEC3.postFx.dofCompProg.uSmallBlurLoc, 2);

    gl.activeTexture( gl.TEXTURE3 );
    gl.bindTexture( gl.TEXTURE_2D, finalFBO.texture( 0 ) );
    gl.uniform1i( SEC3.postFx.dofCompProg.uUnalteredImageLoc, 3 );

    gl.activeTexture( gl.TEXTURE4 );
    gl.bindTexture( gl.TEXTURE_2D, finalFBO.texture(1));
    gl.uniform1i( SEC3.postFx.dofCompProg.uDepthLoc, 4 );

    gl.uniform2fv( SEC3.postFx.dofCompProg.uFarEqLoc, vec2.fromValues( demo.farSlope, demo.farIntercept));
    gl.uniform1f( SEC3.postFx.dofCompProg.uZNearLoc, demo.zNear);
    gl.uniform1f( SEC3.postFx.dofCompProg.uZFarLoc, demo.zFar);

    SEC3.renderer.bindQuadBuffers( SEC3.postFx.dofCompProg );
    gl.disable(gl.DEPTH_TEST);
    gl.drawElements( gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

    gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, null);
    gl.bindBuffer( gl.ARRAY_BUFFER, null );
    workingFBO.unbind(gl);
    gl.disable(gl.BLEND);
};