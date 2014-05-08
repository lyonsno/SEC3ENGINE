SEC3 = SEC3 || {};
SEC3.renderer = {};

/*
 *  create renderer shaders and register them as async objects.
 *  must be called before SEC3.renderer can be used
 */
SEC3.renderer.init = function () {

//----------------------------------------------------FILL GBUFFER PASS:
    //Create a shader program for output scene data to FB
    var fillGProg = SEC3.createShaderProgram();
    //Load the shader source asynchronously
    fillGProg.loadShader( gl, 
                         "Sec3Engine/shader/deferredRenderPass1.vert", 
                         "Sec3Engine/shader/deferredRenderPass1.frag" );
    
    fillGProg.addCallback( function() {
        gl.useProgram( fillGProg.ref() );
        //query the locations of shader parameters
        fillGProg.aVertexPosLoc = gl.getAttribLocation( fillGProg.ref(), "a_pos" );
        fillGProg.aVertexNormalLoc = gl.getAttribLocation( fillGProg.ref(), "a_normal" );
        fillGProg.aVertexTexcoordLoc = gl.getAttribLocation( fillGProg.ref(), "a_texcoord" );

        fillGProg.uPerspLoc = gl.getUniformLocation( fillGProg.ref(), "u_projection" );
        fillGProg.uModelViewLoc = gl.getUniformLocation( fillGProg.ref(), "u_modelview" );
        fillGProg.uMVPLoc = gl.getUniformLocation( fillGProg.ref(), "u_mvp" );
        fillGProg.uNormalMatLoc = gl.getUniformLocation( fillGProg.ref(), "u_normalMat");
        fillGProg.uSamplerLoc = gl.getUniformLocation( fillGProg.ref(), "u_sampler");
        fillGProg.uCPosLoc = gl.getUniformLocation( fillGProg.ref(), "u_cPos");

    } );

    //Register the asynchronously-requested resources with the engine core
    //asynchronously-requested resources are loaded using AJAX 
    SEC3.registerAsyncObj( gl, fillGProg );
    SEC3.renderer.fillGProg = fillGProg;

//----------------------------------------------------Deferred Render:
    //Create a shader program for displaying FBO contents
    deferredRenderProg = SEC3.createShaderProgram();
    deferredRenderProg.loadShader( gl, 
                               "Sec3Engine/shader/deferredRenderPass2.vert", 
                               "Sec3Engine/shader/deferredRenderPass2.frag" );

    deferredRenderProg.addCallback( function(){
        //query the locations of shader parameters
        deferredRenderProg.aVertexPosLoc = gl.getAttribLocation( deferredRenderProg.ref(), "a_pos" );
        deferredRenderProg.aVertexTexcoordLoc = gl.getAttribLocation( deferredRenderProg.ref(), "a_texcoord" );
        deferredRenderProg.aVertexEyeRayLoc = gl.getAttribLocation( deferredRenderProg.ref(), "a_eyeRay" );        

        deferredRenderProg.uPosSamplerLoc = gl.getUniformLocation( deferredRenderProg.ref(), "u_positionTex");
        deferredRenderProg.uNormalSamplerLoc = gl.getUniformLocation( deferredRenderProg.ref(), "u_normalTex");
        deferredRenderProg.uColorSamplerLoc = gl.getUniformLocation( deferredRenderProg.ref(), "u_colorTex");
        deferredRenderProg.uDepthSamplerLoc = gl.getUniformLocation( deferredRenderProg.ref(), "u_depthTex");
        deferredRenderProg.uShadowMapLoc = gl.getUniformLocation( deferredRenderProg.ref(), "u_shadowMap");
        deferredRenderProg.uMLPLoc = gl.getUniformLocation( deferredRenderProg.ref(), "u_mlp");
        deferredRenderProg.uLPosLoc = gl.getUniformLocation( deferredRenderProg.ref(), "u_lPos");
        deferredRenderProg.uCPosLoc = gl.getUniformLocation( deferredRenderProg.ref(), "u_cPos");

        deferredRenderProg.uZNearLoc = gl.getUniformLocation( deferredRenderProg.ref(), "u_zNear" );
        deferredRenderProg.uZFarLoc = gl.getUniformLocation( deferredRenderProg.ref(), "u_zFar" );
        deferredRenderProg.uShadowMapResLoc = gl.getUniformLocation( deferredRenderProg.ref(), "u_shadowMapRes" );

        gl.useProgram( deferredRenderProg.ref() );
        gl.uniform1f( deferredRenderProg.uZNearLoc, scene.getCamera().zNear );
        gl.uniform1f( deferredRenderProg.uZFarLoc, scene.getCamera().zFar );

    } );
    SEC3.registerAsyncObj( gl, deferredRenderProg );
    SEC3.renderer.deferredRenderProg = deferredRenderProg;

//----------------------------------------------------DEBUG VIEW Deferred Render:
    //Create a shader program for displaying FBO contents
    debugGProg = SEC3.createShaderProgram();
    debugGProg.loadShader( gl, 
                               "Sec3Engine/shader/deferredRenderPass2.vert", 
                               "Sec3Engine/shader/debugGBuffer.frag" );

    debugGProg.addCallback( function(){
        //query the locations of shader parameters
        debugGProg.aVertexPosLoc = gl.getAttribLocation( debugGProg.ref(), "a_pos" );
        debugGProg.aVertexTexcoordLoc = gl.getAttribLocation( debugGProg.ref(), "a_texcoord" );

        debugGProg.uPosSamplerLoc = gl.getUniformLocation( debugGProg.ref(), "u_positionTex");
        debugGProg.uNormalSamplerLoc = gl.getUniformLocation( debugGProg.ref(), "u_normalTex");
        debugGProg.uColorSamplerLoc = gl.getUniformLocation( debugGProg.ref(), "u_colorTex");
        debugGProg.uDepthSamplerLoc = gl.getUniformLocation( debugGProg.ref(), "u_depthTex");
       
        debugGProg.uZNearLoc = gl.getUniformLocation( debugGProg.ref(), "u_zNear" );
        debugGProg.uZFarLoc = gl.getUniformLocation( debugGProg.ref(), "u_zFar" );
       
        gl.useProgram( debugGProg.ref() );
        gl.uniform1f( debugGProg.uZNearLoc, scene.getCamera().zNear);
        gl.uniform1f( debugGProg.uZFarLoc, scene.getCamera().zFar );

    } );
    SEC3.registerAsyncObj( gl, debugGProg );
    SEC3.renderer.debugGProg = debugGProg;

    //SEC3.renderer.buildShadowMapProg = SEC3.ShaderCreator.buildShadowMapPrograms(gl, scene);

    //SEC3.renderer.renderWithCascadesProg = SEC3.ShaderCreator.renderCascShadowProg(gl, scene);

};

//-------------------------------------------------------------------RENDERING METHODS:
/*
 *  fills the gBuffer 
 */
SEC3.renderer.fillGPass = function( framebuffer, camera ) {

    gl.useProgram( SEC3.renderer.fillGProg.ref() );
    framebuffer.bind(gl);
    gl.viewport( 0, 0, framebuffer.getWidth(), framebuffer.getHeight() );
    gl.enable( gl.DEPTH_TEST );
    gl.clearColor( 0.0, 0.0, 0.0, 1.0 );
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );
     //update the model-view matrix
    var mvpMat = mat4.create();
    mat4.multiply( mvpMat, camera.getViewTransform(), demo.sphereModelMatrix );
    mat4.multiply( mvpMat, camera.getProjectionMat(), mvpMat );
    var mvMat = mat4.create();
    mat4.multiply( mvMat, camera.getViewTransform(), demo.sphereModelMatrix );
    gl.uniformMatrix4fv( SEC3.renderer.fillGProg.uModelViewLoc, false, mvMat);
    gl.uniformMatrix4fv( SEC3.renderer.fillGProg.uMVPLoc, false, mvpMat ); 
    gl.uniform3fv( SEC3.renderer.fillGProg.uCPosLoc, camera.getPosition() );
    SEC3.renderer.drawModel( SEC3.renderer.fillGProg, 0, camera );
    framebuffer.unbind(gl);
    gl.useProgram( null );
};

/*
 *  re draws shadow maps for each cascade for each lights in scene
 */
SEC3.renderer.updateShadowMaps = function(scene){

    var light;

    for(var i = 0; i < scene.getNumLights(); i++ ) {
            
        light = scene.getLight(i);
        
        for( var ii = 0; ii < light.numCascades; ii++ ) {
            SEC3.renderer.drawShadowMap(light, ii);
        }
    }
};

/*
 *  draws scene geometry into light's cascade(index) shadow map
 */
SEC3.renderer.drawShadowMap = function(light, index){

    if(index === undefined ){
        index = 0;
    }

    var shadowFbo = light.cascadeFramebuffers[index];
    var lMat = light.getViewTransform();
    // var pMat = light.getProjectionMat();
    var pMat = light.cascadeMatrices[index];
    var resolution = shadowFbo.getWidth();

    gl.bindTexture( gl.TEXTURE_2D, null );
    shadowFbo.bind(gl);
   
    gl.viewport(0, 0, resolution, resolution );
    gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT );
    if ( demo.secondPass != "buildShadowMapProg") {
         gl.colorMask(false,false,false,false);
    }
    gl.enable( gl.DEPTH_TEST );
    // gl.cullFace(gl.BACK);
    gl.useProgram(SEC3.renderer.buildShadowMapProg.ref());
    var mlpMat = mat4.create();
    mat4.multiply( mlpMat, pMat, lMat );
    gl.uniformMatrix4fv( SEC3.renderer.buildShadowMapProg.uMLPLoc, false, mlpMat );

    //----------------DRAW MODEL:

    for ( var i = 1; i < model_vertexVBOs.length; ++i ){
        //Bind vertex pos buffer
        gl.bindBuffer( gl.ARRAY_BUFFER, model_vertexVBOs[i] );
        gl.vertexAttribPointer( SEC3.renderer.buildShadowMapProg.aVertexPosLoc, 3, gl.FLOAT, false, 0, 0 );
        gl.enableVertexAttribArray( SEC3.renderer.buildShadowMapProg.aVertexPosLoc );

        gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, model_indexVBOs[i] );
        gl.drawElements( gl.TRIANGLES, model_indexVBOs[i].numIndex, gl.UNSIGNED_SHORT, 0 );

        gl.bindBuffer( gl.ARRAY_BUFFER, null );
        gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, null );    
    }
    if ( demo.secondPass != "buildShadowMapProg") {
        gl.colorMask(true,true,true,true);
    }
    shadowFbo.unbind(gl);
    // gl.cullFace(gl.BACK);
};

/*
 *  binds scene geometry vbos and draws into currently bound FBO
 */
SEC3.renderer.drawModel = function (program, textureOffset, camera) {

    textureOffset = textureOffset || 0;

    //update the normal matrix
    var nmlMat = mat4.create();
    mat4.invert( nmlMat, camera.getViewTransform() );
    mat4.transpose( nmlMat, nmlMat);

    gl.uniformMatrix4fv( program.uNormalMatLoc, false, nmlMat)

    //------------------DRAW MODEL:
    
    for ( var i = 1; i < model_vertexVBOs.length; ++i ){
        //Bind vertex pos buffer
        gl.bindBuffer( gl.ARRAY_BUFFER, model_vertexVBOs[i] );
        gl.vertexAttribPointer( program.aVertexPosLoc, 3, gl.FLOAT, false, 0, 0 );
        gl.enableVertexAttribArray( program.aVertexPosLoc );

        //Bind vertex normal buffer
        gl.bindBuffer( gl.ARRAY_BUFFER, model_normalVBOs[i] );
        gl.vertexAttribPointer( program.aVertexNormalLoc, 3, gl.FLOAT, false, 0, 0 );
        gl.enableVertexAttribArray( program.aVertexNormalLoc );

        //Bind vertex texcoord buffer
        gl.bindBuffer( gl.ARRAY_BUFFER, model_texcoordVBOs[i] );
        gl.vertexAttribPointer( program.aVertexTexcoordLoc, 2, gl.FLOAT, false, 0, 0 );
        gl.enableVertexAttribArray( program.aVertexTexcoordLoc );
        
        if ( model_texcoordVBOs[i].texture ) {
            //Bind texture
            gl.activeTexture( gl.TEXTURE0 + textureOffset );
            gl.bindTexture( gl.TEXTURE_2D, model_texcoordVBOs[i].texture );
            gl.uniform1i( program.uSamplerLoc, textureOffset );
        }
        gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, model_indexVBOs[i] );
        gl.drawElements( gl.TRIANGLES, model_indexVBOs[i].numIndex, gl.UNSIGNED_SHORT, 0 );
    }
};

/*
 *  adds contribution from light to lightAccumulation FBO
 */
SEC3.renderer.deferredRenderSpotLight = function( light, textureUnit ) {

    // var lightPersp = light.getProjectionMat();
    var mlpMat = mat4.create();
    mat4.multiply( mlpMat, light.getProjectionMat(), light.getViewTransform() );
    gl.uniformMatrix4fv( SEC3.renderer.deferredRenderProg.uMLPLoc, false, mlpMat);
    gl.uniform3fv( SEC3.renderer.deferredRenderProg.uLPosLoc, light.getPosition());
    gl.uniform1f( SEC3.renderer.deferredRenderProg.uShadowMapResLoc, light.cascadeFramebuffers[0].getWidth() );
    // var invModelView = camera.getViewTransform();
    // mat4.invert( invModelView, invModelView );
    // mat4.multiply( mlpMat, mlpMat, camera.matrix ); // put light in camera space

    gl.activeTexture( gl.TEXTURE0 + textureUnit );
    gl.bindTexture( gl.TEXTURE_2D, light.cascadeFramebuffers[0].depthTexture() );
    gl.uniform1i( SEC3.renderer.deferredRenderProg.uShadowMapLoc, textureUnit )
    

    gl.drawElements( gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0 );
};

/*
 *  renders scene from gBuffer data into finalFBO
 */
SEC3.renderer.deferredRender = function(scene, gBuffer) {

    
    gl.useProgram( SEC3.renderer.deferredRenderProg.ref() );

    // gl.uniform1i( SEC3.renderer.deferredRenderProg.uDisplayTypeLoc, demo.texToDisplay );
    gl.uniform1f( SEC3.renderer.deferredRenderProg.uZNearLoc, demo.zNear );
    gl.uniform1f( SEC3.renderer.deferredRenderProg.uZFarLoc, demo.zFar );

    gl.uniform3fv( SEC3.renderer.deferredRenderProg.uCPosLoc, scene.getCamera().getPosition() );
    SEC3.renderer.bindGBufferTextures( SEC3.renderer.deferredRenderProg, gBuffer );
    SEC3.renderer.bindQuadBuffers( SEC3.renderer.deferredRenderProg, scene.getCamera().getEyeRays());

    lightFBO.bind(gl);
    gl.viewport( 0, 0, lightFBO.getWidth(), lightFBO.getHeight() );
    gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );
    gl.disable( gl.DEPTH_TEST );
    gl.enable( gl.BLEND );
    gl.blendFunc( gl.SRC_ALPHA, gl.ONE );

    for( var i = 0; i < scene.getNumLights(); i++ ){

        // SEC3.renderer.deferredRenderSpotLight( scene.getLight(i), 4 );
    }
    gl.disable( gl.BLEND );
  

    SEC3.postFx.blendAdditive(gBuffer.texture(2), demo.AMBIENT_INTENSITY,
                  lightFBO.texture(0), 1.0, 
                  finalFBO, gBuffer.depthTexture() );

    // debugFBO.bind(gl);
    // gl.viewport( 0, 0, debugFBO.getWidth(), debugFBO.getHeight() );
    // gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );
    // gl.disable( gl.BLEND );


    gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, null );
    gl.bindBuffer( gl.ARRAY_BUFFER, null );
};

//----------------------------------------------------------------------HELPER METHODS:
/*
 *  sends gBuffer data to program uniforms
 *  program must have: 
 *      uPosSamplerLoc, uNormalSamplerLoc, uColorSamplerLoc, uDepthSamplerLoc
 */
SEC3.renderer.bindGBufferTextures = function( program, gBuffer ) {

    gl.activeTexture( gl.TEXTURE0);  //position
    gl.bindTexture( gl.TEXTURE_2D, gBuffer.texture(0) );
    gl.uniform1i( program.uPosSamplerLoc, 0 );
    
    gl.activeTexture( gl.TEXTURE1);  //normal
    gl.bindTexture( gl.TEXTURE_2D, gBuffer.texture(1) );
    gl.uniform1i( program.uNormalSamplerLoc, 1 );
    
    gl.activeTexture( gl.TEXTURE2);  //Color
    gl.bindTexture( gl.TEXTURE_2D, gBuffer.texture(2) );
    gl.uniform1i( program.uColorSamplerLoc, 2 );
    
    gl.activeTexture( gl.TEXTURE3);  //depth
    gl.bindTexture( gl.TEXTURE_2D, gBuffer.texture(3) );
    gl.uniform1i( program.uDepthSamplerLoc, 3 );
};

/*
 *  binds buffers for fullscreen quad rendering, farPlaneVerts optional
 */
SEC3.renderer.bindQuadBuffers = function ( program, farPlaneVerts ) {

    if( ! SEC3.fullScreenQuad ) {
        SEC3.renderer.createScreenSizedQuad();
    }
    gl.bindBuffer( gl.ARRAY_BUFFER, SEC3.fullScreenQuad.vertexVBO );
    gl.vertexAttribPointer( program.aVertexPosLoc, 3, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( program.aVertexPosLoc );

    gl.bindBuffer( gl.ARRAY_BUFFER, SEC3.fullScreenQuad.texcoordVBO );
    gl.vertexAttribPointer( program.aVertexTexcoordLoc, 2, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( program.aVertexTexcoordLoc );

    if( farPlaneVerts ) {
        gl.bindBuffer( gl.ARRAY_BUFFER, SEC3.fullScreenQuad.eyeRayVBO );
        gl.bufferData( gl.ARRAY_BUFFER, new Float32Array(farPlaneVerts), gl.STREAM_DRAW );
        gl.vertexAttribPointer( program.aVertexEyeRayLoc, 3, gl.FLOAT, false, 0, 0 );
        gl.enableVertexAttribArray( program.aVertexEyeRayLoc );
    }

    gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, SEC3.fullScreenQuad.indexVBO );  
};

/*
 *  initializes fullscreen quad rendering vbos
 */
SEC3.renderer.createScreenSizedQuad = function () {

    //screen quad geometry

    var screenQuad ={
        vertices: [
            -1.0, 1.0, 0.0,
            -1.0, -1.0, 0.0,
            1.0, -1.0, 0.0,
            1.0, 1.0, 0.0
            ],
        texcoords:[
                -1.0,1.0,
                -1.0, -1.0,
                1.0, -1.0,
                1.0, 1.0
            ],
        indices: [0,1,2,0,2,3]

    };

    SEC3.fullScreenQuad = {};

    SEC3.fullScreenQuad.vertexVBO = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, SEC3.fullScreenQuad.vertexVBO );
    gl.bufferData( gl.ARRAY_BUFFER, new Float32Array(screenQuad.vertices), gl.STATIC_DRAW );
 
    SEC3.fullScreenQuad.texcoordVBO = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, SEC3.fullScreenQuad.texcoordVBO );
    gl.bufferData( gl.ARRAY_BUFFER, new Float32Array(screenQuad.texcoords), gl.STATIC_DRAW );   
    gl.bindBuffer( gl.ARRAY_BUFFER, null );

    SEC3.fullScreenQuad.indexVBO = gl.createBuffer();
    gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, SEC3.fullScreenQuad.indexVBO );
    gl.bufferData( gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(screenQuad.indices), gl.STATIC_DRAW );
    gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, null );

    SEC3.fullScreenQuad.eyeRayVBO = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, SEC3.fullScreenQuad.eyeRayVBO );
    gl.bufferData( gl.ARRAY_BUFFER, new Float32Array(), gl.STREAM_DRAW );
    gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, null );   
};
