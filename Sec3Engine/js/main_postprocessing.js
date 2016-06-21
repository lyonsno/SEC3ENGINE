
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
var model_texcoordVBOs = []; //buffer object for loaded model (normal)

var passProg;                 //shader program passing data to FBO
var renderQuadProg;               //shader program showing the FBO buffers

var fbo;              //Framebuffer object storing information for postprocessing effects

var zFar = 30;
var zNear = 0.1;
var texToDisplay = 1;

var drawModel = function(){

    gl.useProgram( passProg.ref() );
    
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
/////////Draw model////////////////////////////////////////////////
    //Bind vertex pos buffer
    for( var i = 0; i < model_vertexVBOs.length; ++i ){
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

        //Bind texture
        if( model_texcoordVBOs[i].texture ){
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

//Deferred render pass 1: 
// render the geometry and output color, normal, depth information
var deferredRenderPass1 = function(){

    gl.bindTexture( gl.TEXTURE_2D, null );
    fbo.bind(gl);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );
    gl.enable( gl.DEPTH_TEST );

    drawModel();

    fbo.unbind(gl);
}; 

//Deferred render pass 2: 
// do post-processing effect using the data obtained in part 1
var deferredRenderPass2 = function(){
    gl.useProgram( renderQuadProg.ref() );
    gl.disable( gl.DEPTH_TEST );

    gl.uniform1f( renderQuadProg.uZNearLoc, zNear );
    gl.uniform1f( renderQuadProg.uZFarLoc, zFar );
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

    gl.bindBuffer( gl.ARRAY_BUFFER, quad_vertexVBO );
    gl.vertexAttribPointer( renderQuadProg.aVertexPosLoc, 3, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( renderQuadProg.aVertexPosLoc );

    //Bind vertex texcoord buffer
    gl.bindBuffer( gl.ARRAY_BUFFER, quad_texcoordVBO );
    gl.vertexAttribPointer( renderQuadProg.aVertexTexcoordLoc, 2, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( renderQuadProg.aVertexTexcoordLoc );

    gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, quad_indexVBO );
    gl.drawElements( gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0 );

    gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, null );
    gl.bindBuffer( gl.ARRAY_BUFFER, null );
};

var myRender = function(){
    deferredRenderPass1();
    deferredRenderPass2();
};

// Customized looping function
var myRenderLoop = function(){
    window.requestAnimationFrame( myRenderLoop );
    myRender();
};


var main = function( canvasId, messageId ){
    "use strict"
    var canvas;
    var msg;

    //get WebGL context
    canvas = document.getElementById( canvasId );
    msg = document.getElementById( messageId );
	gl = CIS700WEBGLCORE.getWebGLContext( canvas, msg );
    if( !gl ){
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
    mat4.perspective( persp, 60*3.1415926/180, canvas.width/canvas.height, zNear, zFar );
    //Create a camera, and attach it to the interactor
    camera = CIS700WEBGLCORE.createCamera(CAMERA_TRACKING_TYPE);
    camera.goHome( [-1, 4,0] ); //initial camera posiiton
    interactor = CIS700WEBGLCORE.CameraInteractor( camera, canvas );
    //Add some key-input controls
    window.onkeydown = function(ev){
        interactor.onKeyDown(ev);
        switch( ev.keyCode ){
          case 49: texToDisplay = 1; break; //show position texture
          case 50: texToDisplay = 2; break;//show position texture
          case 51: texToDisplay = 3; break;//show position texture
          case 52: texToDisplay = 4; break;//show position texture
        }
    };    

    //Load a OBJ model from file
    var objLoader = CIS700WEBGLCORE.createOBJLoader();
    // objLoader.loadFromFile( gl, 'models/coke/coke.obj', 'models/coke/coke.mtl');
    // objLoader.loadFromFile( gl, 'models/buddha_new/buddha_scaled_.obj', 'models/buddha_new/buddha_new.mtl');
    objLoader.loadFromFile( gl, 'models/dabrovic-sponza/sponza.obj', 'models/dabrovic-sponza/sponza.mtl');

    //Register a callback function that extracts vertex and normal 
    //and put it in our VBO
    objLoader.addCallback( function(){
         
        //There might be multiple geometry groups in the model
        for( var i = 0; i < objLoader.numGroups(); ++i ){
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

            if( objLoader.texture(i) ){
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

    //Create a FBO
    //Attachment 1: vertex position
    //Attachment 2: vertex normal
    //Attachment 3: vertex color
    //Attachment 4: vertex depth (currently useless, the depth are obtained from detph attachment)

    fbo = CIS700WEBGLCORE.createFBO();
    if( !fbo.initialize( gl, canvas.width, canvas.height ) ){
        console.log( "FBO initialization failed.");
        return;
    }

    //Create a screen-sized quad
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

    //Create a shader program for output scene data to FB
    passProg = CIS700WEBGLCORE.createShaderProgram();

    //Load the shader source asynchronously
    passProg.loadShader( gl, "shader/deferredRenderPass1.vert", "shader/deferredRenderPass1.frag" );
    
    //prog1 might not be ready even after loadShader returned
   
    //Register necessary callback functions, like querying attrib and uniform indices  
    passProg.addCallback( function(){
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

    //Create a shader program for displaying FBO contents
    renderQuadProg = CIS700WEBGLCORE.createShaderProgram();
    renderQuadProg.loadShader( gl, "shader/deferredRenderPass2.vert", "shader/deferredRenderPass2.frag" );

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
    } );
    CIS700WEBGLCORE.registerAsyncObj( gl, renderQuadProg );


    //Attach our custom rendering functions
    CIS700WEBGLCORE.render = myRender;
    CIS700WEBGLCORE.renderLoop = myRenderLoop;

    //Start rendering loop
    //This function will iterately check if asynchronously-requested resources are ready
    //before starting the rendering loop
    CIS700WEBGLCORE.run(gl);
    
};
