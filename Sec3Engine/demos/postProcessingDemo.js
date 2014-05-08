

//--------------------------------------------------------------------------GLOBALS:
//Global variables
//Bad practice, but let's just leave them here
var gl;    //GL context object
var persp; //perspective matrix
var view;  //viewing matrix
var norml; //normal matrix

var camera; //camera object
var interactor; //camera interactor

var quad_vertexVBO;
var quad_indexVBO;
var quad_texcoordVBO;

var model_vertexVBOs = [];   //buffer object for loaded model (vertex)
var model_indexVBOs = [];    //buffer object for loaded model (index)
var model_normalVBOs = [];   //buffer object for loaded model (normal)
var model_texcoordVBOs = []; //buffer object for loaded model (texture)

var passProg;           //shader program passing data to FBO
var renderQuadProg;     //shader program showing the FBO buffers
var blurProg;
var downsampleProg;
var dofProg;

var fbo;    //Framebuffer object storing data for postprocessing effects
var lowResFBO; //Framebuffer object for storing unprocessed image
var workingFBO;

var zFar = 30;
var zNear = 0.1;
var texToDisplay = 2;
var secondPass;

var nearSlope = -6.6;
var nearIntercept = 2.0;

var farSlope = 0.6;
var farIntercept = -0.2

var blurSigma = 2.0;

var SMALL_BLUR = 1.4;
var MEDIUM_BLUR = 1.6;
var LARGE_BLUR = 5.6;

//--------------------------------------------------------------------------METHODS:

/*
 * Creates shader programs and sets uniforms
 */
var createShaders = function() {
    //----------------------------------------------------FIRST PASS:
    //Create a shader program for output scene data to FB
    passProg = CIS700WEBGLCORE.createShaderProgram();
    //Load the shader source asynchronously
    passProg.loadShader( gl, 
                         "/../shader/deferredRenderPass1.vert", 
                         "/../shader/deferredRenderPass1.frag" );
    
    passProg.addCallback( function() {
        gl.useProgram( passProg.ref() );
        //query the locations of shader parameters
        passProg.aVertexPosLoc = gl.getAttribLocation( passProg.ref(), "a_pos" );
        passProg.aVertexNormalLoc = gl.getAttribLocation( passProg.ref(), "a_normal" );
        passProg.aVertexTexcoordLoc = gl.getAttribLocation( passProg.ref(), "a_texcoord" );

        passProg.uPerspLoc = gl.getUniformLocation( passProg.ref(), "u_projection" );
        passProg.uModelViewLoc = gl.getUniformLocation( passProg.ref(), "u_modelview" );
        passProg.uMVPLoc = gl.getUniformLocation( passProg.ref(), "u_mvp" );
        passProg.uNormalMatLoc = gl.getUniformLocation( passProg.ref(), "u_normalMat");
        passProg.uSamplerLoc = gl.getUniformLocation( passProg.ref(), "u_sampler");
    } );

    //Register the asynchronously-requested resources with the engine core
    //asynchronously-requested resources are loaded using AJAX 
    CIS700WEBGLCORE.registerAsyncObj( gl, passProg );

    //----------------------------------------------------SECOND PASS:
    //Create a shader program for displaying FBO contents
    renderQuadProg = CIS700WEBGLCORE.createShaderProgram();
    renderQuadProg.loadShader( gl, 
                               "/../shader/deferredRenderPass2.vert", 
                               "/../shader/deferredRenderPass2.frag" );

    renderQuadProg.addCallback( function(){
        //query the locations of shader parameters
        renderQuadProg.aVertexPosLoc = gl.getAttribLocation( renderQuadProg.ref(), "a_pos" );
        renderQuadProg.aVertexTexcoordLoc = gl.getAttribLocation( renderQuadProg.ref(), "a_texcoord" );

        renderQuadProg.uPosSamplerLoc = gl.getUniformLocation( renderQuadProg.ref(), "u_positionTex");
        renderQuadProg.uNormalSamplerLoc = gl.getUniformLocation( renderQuadProg.ref(), "u_normalTex");
        renderQuadProg.uColorSamplerLoc = gl.getUniformLocation( renderQuadProg.ref(), "u_colorTex");
        renderQuadProg.uDepthSamplerLoc = gl.getUniformLocation( renderQuadProg.ref(), "u_depthTex");

        renderQuadProg.uZNearLoc = gl.getUniformLocation( renderQuadProg.ref(), "u_zNear" );
        renderQuadProg.uZFarLoc = gl.getUniformLocation( renderQuadProg.ref(), "u_zFar" );
        renderQuadProg.uDisplayTypeLoc = gl.getUniformLocation( renderQuadProg.ref(), "u_displayType" );

        gl.useProgram( renderQuadProg.ref() );
        gl.uniform1f( renderQuadProg.uZNearLoc, zNear );
        gl.uniform1f( renderQuadProg.uZFarLoc, zFar );

        secondPass = dofProg;
    } );
    CIS700WEBGLCORE.registerAsyncObj( gl, renderQuadProg );

    //---------------------------------------------------FINAL PASS:

    finalPassProg = CIS700WEBGLCORE.createShaderProgram();
    finalPassProg.loadShader( gl, 
                               "/../shader/finalPass.vert", 
                               "/../shader/finalPass.frag" );

    finalPassProg.addCallback( function(){
        //query the locations of shader parameters
        finalPassProg.aVertexPosLoc = gl.getAttribLocation( finalPassProg.ref(), "a_pos" );
        finalPassProg.aVertexTexcoordLoc = gl.getAttribLocation( finalPassProg.ref(), "a_texcoord" );
        
        finalPassProg.uFinalImageLoc = gl.getUniformLocation( finalPassProg.ref(), "u_colorTex");

    } );
    CIS700WEBGLCORE.registerAsyncObj( gl, finalPassProg );

    //----------------------------------------------------BLUR PASS:
    //Create a shader program for displaying FBO contents
    blurProg = CIS700WEBGLCORE.createShaderProgram();
    blurProg.loadShader( gl, 
                         "/../shader/texture.vert", 
                         "/../shader/gaussianBlur.frag" );

    blurProg.addCallback( function(){
        //query the locations of shader parameters
        blurProg.aVertexPosLoc = gl.getAttribLocation( blurProg.ref(), "a_pos" );
        blurProg.aVertexTexcoordLoc = gl.getAttribLocation( blurProg.ref(), "a_texcoord");
        blurProg.uSourceLoc = gl.getUniformLocation( blurProg.ref(), "u_source");
        blurProg.uBlurDirectionLoc = gl.getUniformLocation( blurProg.ref(), "u_blurDirection");
        blurProg.uLilSigLoc = gl.getUniformLocation( blurProg.ref(), "u_lilSig");
        blurProg.uPixDimLoc = gl.getUniformLocation( blurProg.ref(), "u_pixDim");
        gl.useProgram(blurProg.ref());
        var width = CIS700WEBGLCORE.canvas.width;
        var height = CIS700WEBGLCORE.canvas.height;
        gl.uniform2fv(blurProg.uPixDimLoc, vec2.fromValues(1.0 / width, 1.0 / height));
        gl.uniform1f(blurProg.uLilSigLoc, 4.0);
        initBlurButtons(); //TODO: awful : (
    } );

    CIS700WEBGLCORE.registerAsyncObj( gl, blurProg );

    //----------------------------------------------------DOWNSAMPLE PASS:
    //Create a shader program for displaying FBO contents
    downsampleProg = CIS700WEBGLCORE.createShaderProgram();
    downsampleProg.loadShader( gl, 
                         "/../shader/finalPass.vert", 
                         "/../shader/downSample.frag" );

    downsampleProg.addCallback( function(){
        //query the locations of shader parameters
        downsampleProg.aVertexPosLoc = gl.getAttribLocation( downsampleProg.ref(), "a_pos" );
        downsampleProg.aVertexTexcoordLoc = gl.getAttribLocation( downsampleProg.ref(), "a_texcoord");
        downsampleProg.uSourceLoc = gl.getUniformLocation( downsampleProg.ref(), "u_source");
        downsampleProg.uPixDimLoc = gl.getUniformLocation( downsampleProg.ref(), "u_pixDim");
        downsampleProg.uWriteSlotLoc = gl.getUniformLocation( downsampleProg.ref(), "u_writeSlot");
        gl.useProgram(downsampleProg.ref());
        var width = CIS700WEBGLCORE.canvas.width;
        var height = CIS700WEBGLCORE.canvas.height;
        gl.uniform2fv(downsampleProg.uPixDimLoc, vec2.fromValues(1.0 / width, 1.0 / height));

    } );

    CIS700WEBGLCORE.registerAsyncObj( gl, downsampleProg );

    //-------------------------------------------------DOFDOWNSAMPLE PASS:
  
    dofDownsampleProg = CIS700WEBGLCORE.createShaderProgram();
    dofDownsampleProg.loadShader( gl, 
                         "/../shader/finalPass.vert", 
                         "/../shader/dofDownSample.frag" );

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
        var width = CIS700WEBGLCORE.canvas.width;
        var height = CIS700WEBGLCORE.canvas.height;
        gl.uniform2fv(dofDownsampleProg.uPixDimLoc, vec2.fromValues(1.0 / width, 1.0 / height));
        gl.uniform1f( dofDownsampleProg.uNearLoc, zNear );
        gl.uniform1f( dofDownsampleProg.uFarLoc, zFar );
        gl.uniform2fv( dofDownsampleProg.uDofEqLoc, vec2.fromValues(nearSlope, nearIntercept));
        initDofButtons();
    } );

    CIS700WEBGLCORE.registerAsyncObj( gl, dofDownsampleProg );

    //-----------------------------------------------DOFCOMP PASS:
    
    dofCompProg = CIS700WEBGLCORE.createShaderProgram();
    dofCompProg.loadShader( gl,
                            "/../shader/finalPass.vert",
                            "/../shader/dofComp.frag");

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

    CIS700WEBGLCORE.registerAsyncObj( gl, dofCompProg );

     //-----------------------------------------------DOFCOMP PASS:

    dofCalcCocProg = CIS700WEBGLCORE.createShaderProgram();
    dofCalcCocProg.loadShader( gl,
                               "/../shader/finalPass.vert",
                               "/../shader/dofCalcCoc.frag");

    dofCalcCocProg.addCallback( function(){

        dofCalcCocProg.aVertexPosLoc = gl.getAttribLocation( dofCalcCocProg.ref(), "a_pos" );
        dofCalcCocProg.aVertexTexcoordLoc = gl.getAttribLocation( dofCalcCocProg.ref(), "a_texcoord")
        dofCalcCocProg.uDownsampledLoc = gl.getUniformLocation( dofCalcCocProg.ref(), "u_downsampled" ); 
        dofCalcCocProg.uBlurredForegroundLoc = gl.getUniformLocation( dofCalcCocProg.ref(), "u_blurredForeground" );
    });

    CIS700WEBGLCORE.registerAsyncObj( gl, dofCalcCocProg );

}

var drawModel = function(){
    
    //update the model-view matrix
    var mvpMat = mat4.create();
    mat4.multiply( mvpMat, persp, camera.getViewTransform() );

    //update the normal matrix
    var nmlMat = mat4.create();
    mat4.invert( nmlMat, camera.getViewTransform() );
    mat4.transpose( nmlMat, nmlMat);

    gl.uniformMatrix4fv( passProg.uModelViewLoc, false, camera.getViewTransform());        
    gl.uniformMatrix4fv( passProg.uMVPLoc, false, mvpMat );        
    gl.uniformMatrix4fv( passProg.uNormalMatLoc, false, nmlMat );       

    //------------------DRAW MODEL:
    
    for ( var i = 0; i < model_vertexVBOs.length; ++i ){
        //Bind vertex pos buffer
        gl.bindBuffer( gl.ARRAY_BUFFER, model_vertexVBOs[i] );
        gl.vertexAttribPointer( passProg.aVertexPosLoc, 3, gl.FLOAT, false, 0, 0 );
        gl.enableVertexAttribArray( passProg.aVertexPosLoc );

        //Bind vertex normal buffer
        gl.bindBuffer( gl.ARRAY_BUFFER, model_normalVBOs[i] );
        gl.vertexAttribPointer( passProg.aVertexNormalLoc, 3, gl.FLOAT, false, 0, 0 );
        gl.enableVertexAttribArray( passProg.aVertexNormalLoc );

        //Bind vertex texcoord buffer
        gl.bindBuffer( gl.ARRAY_BUFFER, model_texcoordVBOs[i] );
        gl.vertexAttribPointer( passProg.aVertexTexcoordLoc, 2, gl.FLOAT, false, 0, 0 );
        gl.enableVertexAttribArray( passProg.aVertexTexcoordLoc );
        
        if ( model_texcoordVBOs[i].texture ) {
            //Bind texture    
            gl.activeTexture( gl.TEXTURE0 );
            gl.bindTexture( gl.TEXTURE_2D, model_texcoordVBOs[i].texture );
            gl.uniform1i( passProg.uSamplerLoc, 0 );
        }

        gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, model_indexVBOs[i] );
        gl.drawElements( gl.TRIANGLES, model_indexVBOs[i].numIndex, gl.UNSIGNED_SHORT, 0 );

        gl.bindBuffer( gl.ARRAY_BUFFER, null );
        gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, null );    
    } 
};

function initBlurButtons() {
    
    CIS700WEBGLCORE.ui = CIS700WEBGLCORE.ui || new UI("uiWrapper");

    var lilSigCallback = function(e) {

        var newSliderVal = e.target.value;
        blurSigma = newSliderVal;
        var sigmaSquared = blurSigma * blurSigma;
        gl.useProgram(blurProg.ref());
        gl.uniform1f(blurProg.uLilSigLoc, sigmaSquared);

        return "Sigma: " + blurSigma;
    };

    CIS700WEBGLCORE.ui.addSlider("Sigma: " + blurSigma,
                 lilSigCallback,
                 blurSigma * blurSigma,
                 0.1, 40.0,
                 0.1);
}

function initDofButtons() {

    CIS700WEBGLCORE.ui = CIS700WEBGLCORE.ui || new UI("uiWrapper");

    var slopeCallback = function(e) {

        var newSliderVal = e.target.value;
        gl.useProgram(dofDownsampleProg.ref());
        nearSlope = newSliderVal;
        gl.uniform2fv(dofDownsampleProg.uDofEqLoc, vec2.fromValues( nearSlope, nearIntercept ));

        return nearSlope + " :Near slope";
    };

    CIS700WEBGLCORE.ui.addSlider(nearSlope + " :Near slope" ,
                 slopeCallback,
                 nearSlope,
                 -10.0, -1.0,
                 0.01);

    var interceptCallback = function(e) {

        var newSliderVal = e.target.value;
        gl.useProgram(dofDownsampleProg.ref());
        nearIntercept = newSliderVal;
        gl.uniform2fv(dofDownsampleProg.uDofEqLoc, vec2.fromValues( nearSlope, nearIntercept ));

        return nearIntercept + " :Near intercept";
    };

    CIS700WEBGLCORE.ui.addSlider(nearIntercept + " :Near intercept",
                 interceptCallback,
                 nearIntercept,
                 1.0, 3.0,
                 0.01);

    var largeBlurrCallback = function(e) {

        LARGE_BLUR = e.target.value;
        return LARGE_BLUR + " :Large blur";
    }
    CIS700WEBGLCORE.ui.addSlider(LARGE_BLUR + " :Large blur",
                                 largeBlurrCallback,
                                 LARGE_BLUR,
                                 2.0, 16.0,
                                 0.1);

    var mediumBlurrCallback = function(e) {

        MEDIUM_BLUR = e.target.value;
        return MEDIUM_BLUR + " :Medium blur";
    }
    CIS700WEBGLCORE.ui.addSlider(MEDIUM_BLUR + " :Medium blur",
                                 mediumBlurrCallback,
                                 MEDIUM_BLUR,
                                 1.0, 8.0,
                                 0.1);

    var smallBlurrCallback = function(e) {

        SMALL_BLUR = e.target.value;
        return SMALL_BLUR + " :Small blur";
    }
    CIS700WEBGLCORE.ui.addSlider(SMALL_BLUR + " :Small blur",
                                 smallBlurrCallback,
                                 SMALL_BLUR,
                                 0.0, 3.0,
                                 0.1);
}

/*
 * Renders the geometry and output color, normal, depth information
 */
var deferredRenderPass1 = function(){

    gl.bindTexture( gl.TEXTURE_2D, null );
    fbo.bind(gl);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );
    gl.enable( gl.DEPTH_TEST );

    gl.useProgram( passProg.ref() );

    drawModel();

    fbo.unbind(gl);
}; 

/* 
 * Does post-processing effect using the data obtained in part 1 
 */
var deferredRenderPass2 = function(framebuffer) {

    framebuffer.bind(gl);

    gl.viewport(0, 0, framebuffer.getWidth(), framebuffer.getHeight() )
    gl.useProgram( renderQuadProg.ref() );
    gl.disable( gl.DEPTH_TEST );

    gl.uniform1i( renderQuadProg.uDisplayTypeLoc, texToDisplay );

    gl.activeTexture( gl.TEXTURE0 );  //position
    gl.bindTexture( gl.TEXTURE_2D, fbo.texture(0) );
    gl.uniform1i( renderQuadProg.uPosSamplerLoc, 0 );

    gl.activeTexture( gl.TEXTURE1 );  //normal
    gl.bindTexture( gl.TEXTURE_2D, fbo.texture(1) );
    gl.uniform1i( renderQuadProg.uNormalSamplerLoc, 1 );

    gl.activeTexture( gl.TEXTURE2 );  //Color
    gl.bindTexture( gl.TEXTURE_2D, fbo.texture(2) );
    gl.uniform1i( renderQuadProg.uColorSamplerLoc, 2 );

    gl.activeTexture( gl.TEXTURE3 );  //depth
    gl.bindTexture( gl.TEXTURE_2D, fbo.depthTexture() );
    gl.uniform1i( renderQuadProg.uDepthSamplerLoc, 3 );

    bindQuadBuffers(renderQuadProg);

    gl.drawElements( gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0 );

    gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, null );
    gl.bindBuffer( gl.ARRAY_BUFFER, null );

    framebuffer.unbind(gl);
};


/*
 * Two passes, one to blur vertically and one to blur horizontally
 */

 var blurPasses = function(srcTex, framebuffer, sigma) {
    var vertical = 1;
    var horizontal = 0;

    framebuffer.bind(gl);

    gl.viewport( 0, 0, framebuffer.getWidth(), framebuffer.getHeight());

    gl.useProgram( blurProg.ref() );
    gl.uniform1f( blurProg.uLilSigLoc, sigma * sigma);
    
    gl.uniform2fv(blurProg.uPixDimLoc, vec2.fromValues(1.0 / framebuffer.getWidth(), 1.0 / framebuffer.getHeight()));

    gl.disable( gl.DEPTH_TEST );
    
     // first, texToDisplay texture is source
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture( gl.TEXTURE_2D, srcTex );
    gl.uniform1i( blurProg.uSourceLoc, 0 );
    // workingFBO slot 0 will be written to with the vertical blur
    // making a vertical smear (1 = Vertical Pass)
    gl.uniform1i( blurProg.uBlurDirectionLoc, vertical );
    // and draw!

    bindQuadBuffers(blurProg);

    gl.drawElements( gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0 );
    
    // then, vertically blured texture is source (old dest)
    
    framebuffer.swapBuffers(0, 1, gl);

    framebuffer.bind(gl);

    gl.activeTexture( gl.TEXTURE0 );
    gl.bindTexture( gl.TEXTURE_2D, framebuffer.texture(1) );
    gl.uniform1i( blurProg.uSourceLoc, 0);

    gl.uniform1i( blurProg.uBlurDirectionLoc, horizontal );

    bindQuadBuffers(blurProg);
    gl.drawElements( gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0 );
    // framebuffer.swapBuffers(0, 1, gl);
    
    gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, null );
    gl.bindBuffer( gl.ARRAY_BUFFER, null ); 
    
    framebuffer.unbind(gl);
   
};

var dofPass = function(){
   
    gl.useProgram( dofDownsampleProg.ref() );
    lowResFBO.bind(gl);
    gl.viewport( 0, 0, lowResFBO.getWidth(), lowResFBO.getHeight() );
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable( gl.DEPTH_TEST );
    gl.disable( gl.BLEND);
    gl.activeTexture( gl.TEXTURE0 );
    gl.bindTexture( gl.TEXTURE_2D, fbo.texture(texToDisplay) );
    gl.uniform1i( dofDownsampleProg.uSourceLoc, 0);

    gl.activeTexture( gl.TEXTURE1 );
    gl.bindTexture( gl.TEXTURE_2D, fbo.depthTexture() );
    gl.uniform1i( dofDownsampleProg.uDepthLoc, 1);

    gl.uniform2fv( dofDownsampleProg.uPixDimLoc, vec2.fromValues(1.0 / CIS700WEBGLCORE.canvas.width, 1.0 / CIS700WEBGLCORE.canvas.height) );
   
    bindQuadBuffers(dofDownsampleProg);

    gl.drawElements( gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, null);
    gl.bindBuffer( gl.ARRAY_BUFFER, null );
    // lowResFBO[0],[1]  both have downsampled color and coc

    lowResFBO.swapBuffers(0, 2, gl );
    lowResFBO.swapBuffers( 1, 3, gl );

    blurPasses(lowResFBO.texture(3), lowResFBO, LARGE_BLUR); 
    lowResFBO.swapBuffers(0, 3, gl);
    // lowResFBO[3] now has large blurred downsampled color and coc
        
    //----------------------------------- Calculate Final Coc: 


    gl.useProgram( dofCalcCocProg.ref() );
    lowResFBO.bind(gl);
    gl.activeTexture( gl.TEXTURE0 );
    gl.bindTexture(gl.TEXTURE_2D, lowResFBO.texture(3));
    gl.uniform1i( dofCalcCocProg.uBlurredForegroundLoc, 0);

    gl.activeTexture( gl.TEXTURE1 );
    gl.bindTexture( gl.TEXTURE_2D, lowResFBO.texture(2));
    gl.uniform1i( dofCalcCocProg.uDownsampledLoc, 1);

    
    gl.disable(gl.DEPTH_TEST);
    gl.viewport(0, 0, lowResFBO.getWidth(), lowResFBO.getHeight());
    bindQuadBuffers( dofCalcCocProg );

    gl.drawElements( gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, null);
    gl.bindBuffer( gl.ARRAY_BUFFER, null );
    // lowResFBO[0] now has downsampled color and proper coc

    //----------------------------------

    // lowResFBO.swapBuffers(1, 3, gl);
     lowResFBO.swapBuffers(0, 2, gl);
    // lowResFBO[2] has proper coc
    // lowResFBO[3] has blurred downsampled foreground

     blurPasses(lowResFBO.texture(2), lowResFBO, MEDIUM_BLUR);
    // lowResFBO[0] has small blur on final near coc 

    blurPasses(fbo.texture(texToDisplay), workingFBO, SMALL_BLUR);
    workingFBO.swapBuffers(0, 1, gl);
    

    //-------------------------- 

    gl.useProgram( dofCompProg.ref() );

    workingFBO.bind(gl);
    gl.viewport( 0, 0, workingFBO.getWidth(), workingFBO.getHeight() );

    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.BLEND);

    gl.activeTexture( gl.TEXTURE0 );
    gl.bindTexture( gl.TEXTURE_2D, lowResFBO.texture(3) );
    gl.uniform1i( dofCompProg.uBlurredForegroundLoc, 0 );

    gl.activeTexture( gl.TEXTURE1 );
    gl.bindTexture( gl.TEXTURE_2D, lowResFBO.texture(0) );
    gl.uniform1i( dofCompProg.uDownsampledLoc, 1 );

    gl.activeTexture( gl.TEXTURE2 );
    gl.bindTexture( gl.TEXTURE_2D, workingFBO.texture(1) );
    gl.uniform1i( dofCompProg.uSmallBlurLoc, 2);

    gl.activeTexture( gl.TEXTURE3 );
    gl.bindTexture( gl.TEXTURE_2D, fbo.texture(texToDisplay) );
    gl.uniform1i( dofCompProg.uUnalteredImageLoc, 3 );

    gl.activeTexture( gl.TEXTURE4 );
    gl.bindTexture( gl.TEXTURE_2D, fbo.depthTexture());
    gl.uniform1i( dofCompProg.uDepthLoc, 4 );

    gl.uniform2fv( dofCompProg.uFarEqLoc, vec2.fromValues(farSlope, farIntercept));
    gl.uniform1f( dofCompProg.uZNearLoc, zNear);
    gl.uniform1f( dofCompProg.uZFarLoc, zFar);

    bindQuadBuffers( dofCompProg );
    gl.disable(gl.DEPTH_TEST);
    gl.drawElements( gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

    gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, null);
    gl.bindBuffer( gl.ARRAY_BUFFER, null );
    workingFBO.unbind(gl);
    gl.disable(gl.BLEND);
}



var downsamplePass = function(hiResTex, writeSlot){

    gl.useProgram( downsampleProg.ref() );
    workingFBO.bind(gl);

    gl.activeTexture( gl.TEXTURE0 );
    gl.bindTexture( gl.TEXTURE_2D, hiResTex );
    gl.uniform1i( downsampleProg.uSourceLoc, 0 );

    gl.uniform1i( downsampleProg.uWriteSlotLoc, writeSlot);

    gl.disable( gl.DEPTH_TEST );
    bindQuadBuffers(downsampleProg);

    gl.drawElements( gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

    gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, null );
    gl.bindBuffer( gl.ARRAY_BUFFER, null );

}

var finalPass = function(texture, framebuffer){

    gl.bindFramebuffer(gl.FRAMEBUFFER, null); 
    gl.useProgram(finalPassProg.ref());
    
    gl.viewport( 0, 0, CIS700WEBGLCORE.canvas.width, CIS700WEBGLCORE.canvas.height );
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(finalPassProg.uFinalImageLoc, 0);

    gl.disable( gl.DEPTH_TEST );
    bindQuadBuffers(finalPassProg);

    gl.drawElements( gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0 );


    gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, null );
    gl.bindBuffer( gl.ARRAY_BUFFER, null );

}

var myRender = function() {

    var canvasResolution = [CIS700WEBGLCORE.canvas.width, CIS700WEBGLCORE.canvas.height];
    deferredRenderPass1();

    if (secondPass === renderQuadProg) {
        deferredRenderPass2(workingFBO);
        finalPass(workingFBO.texture(0), workingFBO);
    }
    else if (secondPass === blurProg) {
        blurPasses(fbo.texture(texToDisplay),workingFBO, blurSigma);
        finalPass(workingFBO.texture(0), workingFBO);
    }
    else if (secondPass === dofProg) {
        dofPass();
        finalPass(workingFBO.texture(0), workingFBO);
    }
    
}

// Customized looping function
var myRenderLoop = function() {

    window.requestAnimationFrame( myRenderLoop );
    myRender();
};

var main = function( canvasId, messageId ){
    "use strict"

    setupScene(canvasId, messageId);

    loadObjects();

    setKeyInputs();
        //'1' = Attachment 1: vertex position
        //'2' = Attachment 2: vertex normal
        //'3' = Attachment 3: vertex color
        //'4' = Attachment 4: vertex depth 

    createScreenSizedQuad();

    createShaders();

    //Attach our custom rendering functions
    CIS700WEBGLCORE.render = myRender;
    CIS700WEBGLCORE.renderLoop = myRenderLoop;

    //Start rendering loop (when all resources are finished loading asynchronously)
    CIS700WEBGLCORE.run(gl);
    
};

//-----------------------------------------------------------STANDARD SETUP METHODS:

var createScreenSizedQuad = function() {

    quad_vertexVBO = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, quad_vertexVBO );
    gl.bufferData( gl.ARRAY_BUFFER, new Float32Array(screenQuad.vertices), gl.STATIC_DRAW );
 
    quad_texcoordVBO = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, quad_texcoordVBO );
    gl.bufferData( gl.ARRAY_BUFFER, new Float32Array(screenQuad.texcoords), gl.STATIC_DRAW );   
    gl.bindBuffer( gl.ARRAY_BUFFER, null );

    quad_indexVBO = gl.createBuffer();
    gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, quad_indexVBO );
    gl.bufferData( gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(screenQuad.indices), gl.STATIC_DRAW );
    gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, null );   
};

/*
 * Loads objects from obj files into the model_VBOs
 */
var loadObjects = function() {
    //Load a OBJ model from file
    var objLoader = CIS700WEBGLCORE.createOBJLoader();
    // objLoader.loadFromFile( gl, 'models/coke/coke.obj', 'models/coke/coke.mtl');
    // objLoader.loadFromFile( gl, '/../models/buddha_new/buddha_scaled_.obj', '/../models/buddha_new/buddha_scaled_.mtl');
    objLoader.loadFromFile( gl, '/../models/dabrovic-sponza/sponza.obj', '/../models/dabrovic-sponza/sponza.mtl');
    
       
    //Register a callback function that extracts vertex and normal 
    //and put it in our VBO
    objLoader.addCallback( function(){
         
        //There might be multiple geometry groups in the model
        for (var i = 0; i < objLoader.numGroups(); ++i) {

            model_vertexVBOs[i] = gl.createBuffer();
            gl.bindBuffer( gl.ARRAY_BUFFER, model_vertexVBOs[i] );
            gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( objLoader.vertices(i) ), gl.STATIC_DRAW );

            model_normalVBOs[i] = gl.createBuffer();
            gl.bindBuffer( gl.ARRAY_BUFFER, model_normalVBOs[i] );
            gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( objLoader.normals(i) ), gl.STATIC_DRAW ); 

            model_texcoordVBOs[i] = gl.createBuffer();
            gl.bindBuffer( gl.ARRAY_BUFFER, model_texcoordVBOs[i] );
            gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( objLoader.texcoords(i) ), gl.STATIC_DRAW ); 
            gl.bindBuffer( gl.ARRAY_BUFFER, null );

            if (objLoader.texture(i)) {

                model_texcoordVBOs[i].texture = objLoader.texture(i);    
            }
            

            model_indexVBOs[i] = gl.createBuffer();
            gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, model_indexVBOs[i] );
            gl.bufferData( gl.ELEMENT_ARRAY_BUFFER, new Uint16Array( objLoader.indices(i) ), gl.STATIC_DRAW );
            model_indexVBOs[i].numIndex = objLoader.indices(i).length;

            gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, null );
        }
    });
    CIS700WEBGLCORE.registerAsyncObj( gl, objLoader );    
}

var setKeyInputs = function() {
    
    window.onkeydown = function(ev) {

        interactor.onKeyDown(ev);
        switch( ev.keyCode ){
          case 49: texToDisplay = 0; break;     //show position texture
          case 50: texToDisplay = 1; break;     //show normal texture
          case 51: texToDisplay = 2; break;     //show texture texture
          case 52: texToDisplay = 3; break;     //show depth texture

          case 53: secondPass = blurProg; break;
          case 54: secondPass = renderQuadProg; break;
          case 55: secondPass = dofProg; break;
        }
    }; 
}

/*
 * Sets up basics of scene; camera, viewport, projection matrix, fbo
 */
var setupScene = function(canvasId, messageId ) {
    var canvas;
    var msg;
    //----SETUP SCENE
    //get WebGL context
    canvas = document.getElementById( canvasId );
    CIS700WEBGLCORE.canvas = canvas;
    msg = document.getElementById( messageId );
    gl = CIS700WEBGLCORE.getWebGLContext( canvas, msg );
    if (! gl) {
        console.log("Bad GL Context!");
        return;
    }
    
    gl.viewport( 0, 0, canvas.width, canvas.height );
    gl.clearColor( 0.3, 0.3, 0.3, 1.0 );

    gl.enable( gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);
    //gl.blendFunc(gl.SRC_ALPHA,gl.ONE);
    //Setup camera
    view = mat4.create();
    mat4.identity( view );

    persp = mat4.create();

    //mat4.perspective use radiance
    mat4.perspective( persp, 60 * 3.1415926 / 180, 
                      canvas.width / canvas.height, zNear, zFar );
    //Create a camera, and attach it to the interactor
    camera = CIS700WEBGLCORE.createCamera(CAMERA_TRACKING_TYPE);
    camera.goHome( [-1, 4,0] ); //initial camera posiiton
    interactor = CIS700WEBGLCORE.CameraInteractor( camera, canvas );

    //Create a FBO
    fbo = CIS700WEBGLCORE.createFBO();
    if (! fbo.initialize( gl, canvas.width, canvas.height )) {
        console.log( "FBO initialization failed.");
        return;
    }

    lowResFBO = CIS700WEBGLCORE.createFBO();
    if (! lowResFBO.initialize( gl, 512.0, 512.0 )) {
        console.log( "display FBO initialization failed.");
        return;
    }


    workingFBO = CIS700WEBGLCORE.createFBO();
    if (! workingFBO.initialize( gl, canvas.width, canvas.height )) {
        console.log( "workingFBO initialization failed.");
        return;
    }
};

//--------------------------------------------------------------------------HELPERS:

var bindQuadBuffers = function(program) {

    gl.bindBuffer( gl.ARRAY_BUFFER, quad_vertexVBO );
    gl.vertexAttribPointer( program.aVertexPosLoc, 3, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( program.aVertexPosLoc );

    gl.bindBuffer( gl.ARRAY_BUFFER, quad_texcoordVBO );
    gl.vertexAttribPointer( program.aVertexTexcoordLoc, 2, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( program.aVertexTexcoordLoc );

    gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, quad_indexVBO );  
}

var setActiveTexture = function(gl, texNum) {
    
    switch (texNum) {
        case 0:
            gl.activeTexture( gl.TEXTURE0 );
            break;
        case 1:
            gl.activeTexture( gl.TEXTURE1 );
            break;
        case 2:
            gl.activeTexture( gl.TEXTURE2 );
            break;
        case 3:
            gl.activeTexture( gl.TEXTURE3 );
            break;

    }
}
