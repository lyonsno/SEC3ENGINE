

//--------------------------------------------------------------------------GLOBALS:
//Global variables
//Bad practice, but let's just leave them here
var gl;    //GL context object
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

var fillGProg;           //shader program passing data to FBO
var bufferRenderProg;     //shader program showing the FBO buffers
var showShadowMap;

var fbo;    //Framebuffer object storing data for postprocessing effects
var lowResFBO; //Framebuffer object for storing unprocessed image
var workingFBO;

var demo = (function () {

    var demo = [];
    demo.zFar = 30.0;
    demo.zNear = 0.6;
    demo.selectedLight = 0;
    demo.MAX_LIGHTS = 8;
    demo.MAX_CASCADES = 6;
    demo.AMBIENT_INTENSITY = 0.03;

    demo.texToDisplay = 2;
    demo.secondPass;

    demo.nearSlope = -6.6;
    demo.nearIntercept = 1.39;

    demo.farSlope = 1.4;
    demo.farIntercept = -0.28;

    demo.blurSigma = 2.0;

    demo.SMALL_BLUR = 1.8;
    demo.MEDIUM_BLUR = 3.4;
    demo.LARGE_BLUR = 11.6;

    demo.SHADOWMAP_SIZE = 1024.0;
    demo.FAR_CASCADE_SIZE = 256;
    demo.NEAR_CASCADE_SIZE = 1024;
    return demo;

})();



//--------------------------------------------------------------------------METHODS:

/*
 * Renders the geometry and output color, normal, depth information
 */
var forwardRenderPass = function(scene, index){

    // SEC3.postFx.blurGaussian(shadowFBO.texture(0), shadowFBO, demo.blurSigma);
    //Now render from the camera

    gl.bindTexture( gl.TEXTURE_2D, null );
    fbo.bind(gl);
    gl.viewport(0, 0, SEC3.canvas.width, SEC3.canvas.height );
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );
    gl.enable( gl.DEPTH_TEST );

    gl.useProgram( renderWithCascadesProg.ref() );
    var textureUnit = 0;

    //update the model-view matrix
    var mvpMat = mat4.create();
    mat4.multiply( mvpMat, camera.getProjectionMat(), camera.getViewTransform() );
    gl.uniform3fv( renderWithCascadesProg.uCPosLoc, camera.getPosition());
    gl.uniformMatrix4fv( renderWithCascadesProg.uMVPLoc, false, mvpMat ); 

    //--------------------UPDATE LIGHT UNIFORMS:

    //for selected light
    var thisLight = scene.getLight(demo.selectedLight);
    gl.uniform1i( renderWithCascadesProg.uNumCascades, thisLight.numCascades);

    for( var i = 0; i < scene.getNumLights(); i++ ) { // for each light
        var light = scene.getLight(i);
        var lightLoc = renderWithCascadesProg.lights[i];
        var lightPersp = light.getProjectionMat();
        var mlpMat = mat4.create();
        mat4.multiply( mlpMat, lightPersp, light.getViewTransform() );
        gl.uniform3fv( lightLoc.uLPosLoc, light.getPosition());
        gl.uniformMatrix4fv( lightLoc.uModelLightLoc, false, light.getViewTransform());      
        gl.uniformMatrix4fv( lightLoc.uMLPLoc, false, mlpMat);

        for(var j = 0; j < light.numCascades; j++ ){ // for each cascade
            gl.activeTexture( gl.TEXTURE0 + textureUnit);
            gl.bindTexture( gl.TEXTURE_2D, light.cascadeFramebuffers[j].depthTexture());
            gl.uniform1i( lightLoc.uCascadeLocs[j], textureUnit);
            textureUnit++;
        }
    }

    drawModel(renderWithCascadesProg, textureUnit);
    fbo.unbind(gl);
}; 


var moveLight = function(light) {
    elCounter++;
    // if(elCounter % 200 == 1.0) particleSystem.restart();
    if(elCounter % 500 < 250) {
        // light.changeAzimuth(0.14);
        light.changeElevation(0.05);
        light.moveRight(0.01);        
        // light.changeElevation(1.5);        
        // light.moveUp(0.02);
    }
    else {
        // light.changeAzimuth(-0.14);
        light.changeElevation(-0.05);
        light.moveLeft(0.01);
        // light.changeElevation(1.5);                
        // light.moveDown(0.02);
    }
    light.update();
};

var myRender = function() {
    if(SEC3.isWaiting) {
        return;
    }
    particleSystem.stepParticles();
    
    var light = scene.getLight( demo.selectedLight );

    moveLight(light);
    var canvasResolution = [SEC3.canvas.width, SEC3.canvas.height];

    SEC3.renderer.updateShadowMaps(scene);
    particleSystem.updateShadowMap(scene.getLight(demo.selectedLight));
    // particleSystem.update();
    // forwardRenderPass(scene, demo.selectedLight );
    SEC3.renderer.fillGPass( SEC3.gBuffer );
    SEC3.renderer.deferredRender( scene, SEC3.gBuffer, SEC3.gBuffer );
    
    if ( demo.secondPass === "bufferRenderProg") {
        particleSystem.draw(light);
        SEC3.postFx.finalPass(finalFBO.texture(0));
    }
    else if ( demo.secondPass === "blurProg") {
        particleSystem.draw(light);
        SEC3.postFx.blurGaussian(finalFBO.texture( 0 ), workingFBO, demo.blurSigma);
        SEC3.postFx.finalPass(workingFBO.texture(0));
    }
    else if ( demo.secondPass === "dofProg") {
        particleSystem.draw(light);
        SEC3.postFx.dofPass();
        SEC3.postFx.finalPass(workingFBO.texture(0));
    }
    else if ( demo.secondPass === "buildShadowMapProg") {
        SEC3.postFx.finalPass(light.cascadeFramebuffers[demo.cascadeToDisplay].depthTexture());
    }
};

// Customized looping function
var myRenderLoop = function() {

    if(!SEC3.setup) {
        
        initLightUi();
        initBlurButtons();
        initDofButtons();
        demo.secondPass = "bufferRenderProg";
        
        SEC3.setup = true;
    }

    window.requestAnimationFrame( myRenderLoop );
    myRender();
    // particleSystem.draw();
};

var main = function( canvasId, messageId ){
    "use strict"

    setupScene(canvasId, messageId);

    setKeyInputs();
        //'1' = Attachment 1: vertex position
        //'2' = Attachment 2: vertex normal
        //'3' = Attachment 3: vertex color
        //'4' = Attachment 4: vertex depth 

    SEC3.renderer.init();
    SEC3.postFx.init();
    //Attach our custom rendering functions
    SEC3.render = myRender;
    SEC3.renderLoop = myRenderLoop;

    //Start rendering loop (when all resources are finished loading asynchronously)
    SEC3.run(gl);
    
};

//-----------------------------------------------------------STANDARD SETUP METHODS:


/*
 * Loads objects from obj files into the model_VBOs
 */
var loadObjects = function() {
    //Load a OBJ model from file
    var objLoader = SEC3.createOBJLoader(scene);
    // objLoader.loadFromFile( gl, 'models/coke/coke.obj', 'models/coke/coke.mtl');
    // objLoader.loadFromFile( gl, 'Sec3Engine/models/buddha_new/buddha_scaled_.obj', 'Sec3Engine/models/buddha_new/buddha_scaled_.mtl');
    objLoader.loadFromFile( gl, 'Sec3Engine/models/dabrovic-sponza/sponza3.obj', 'Sec3Engine/models/dabrovic-sponza/sponza.mtl');
    // objLoader.loadFromFile( gl, 'Sec3Engine/models/cubeworld/cubeworld.obj', 'Sec3Engine/models/cubeworld/cubeworld.mtl');
    
       
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
    SEC3.registerAsyncObj( gl, objLoader );    
};

var setKeyInputs = function() {
    
    window.onkeydown = function(ev) {

        interactor.onKeyDown(ev);
        switch( ev.keyCode ){
          case 49: demo.texToDisplay = 0; break;     //show position texture
          case 50: demo.texToDisplay = 1; break;     //show normal texture
          case 51: demo.texToDisplay = 2; break;     //show texture texture
          case 52: demo.texToDisplay = 3; break;     //show depth texture

          case 53: demo.secondPass = "blurProg"; break;
          case 54: demo.secondPass = "bufferRenderProg"; break;
          case 55: demo.secondPass = "dofProg"; break;
          case 56: 
            demo.secondPass = "buildShadowMapProg"; 
            demo.cascadeToDisplay = Math.floor(( demo.cascadeToDisplay + 1 ) % (scene.getLight(demo.selectedLight).numCascades));
            break;

        }
    };
};

var initLightUi = function() {

    SEC3.ui = SEC3.ui || new UI("uiWrapper");


    var numCascadesCallback = function(e) {

        var newSliderVal = e.target.value;

        var light = scene.getLight(demo.selectedLight);
        light.setupCascades(newSliderVal, light.nearResolution, gl, scene);

        buildShadowMapProg.dispose(gl);
        buildShadowMapProg = SEC3.ShaderCreator.buildShadowMapPrograms(gl, scene);
        renderWithCascadesProg.dispose(gl);
        renderWithCascadesProg = SEC3.ShaderCreator.renderCascShadowProg(gl, scene);
        SEC3.run(gl);
        return newSliderVal + " :Cascades";
    };

    SEC3.ui.addSlider( scene.getLight(demo.selectedLight).numCascades + " :Cascades" ,
                 numCascadesCallback,
                 scene.getLight(demo.selectedLight).numCascades,
                 1, demo.MAX_CASCADES,
                 1);

    var numLightsCallback = function(e) {

        var newSliderVal = e.target.value;

        updateLightCount(newSliderVal);
       

        return newSliderVal + " :Lights";
    };

    SEC3.ui.addSlider( scene.getNumLights() + " :Lights" ,
                 numLightsCallback,
                 scene.getNumLights(),
                 1, demo.MAX_LIGHTS,
                 1);

    var selectedLightCallback = function(e) {

        var newSliderVal = e.target.value;

        demo.selectedLight = Math.min( newSliderVal, scene.getNumLights() - 1 );
        
        return ( demo.selectedLight + 1 ) + " :Selected light";
    };

    SEC3.ui.addSlider( (demo.selectedLight + 1) + " :Selected light" ,
                 selectedLightCallback,
                 demo.selectedLight,
                 0, demo.MAX_LIGHTS - 1,
                 1);
};

function initDofButtons() {

    SEC3.ui = SEC3.ui || new UI("uiWrapper");

    var slopeCallback = function(e) {

        var newSliderVal = e.target.value;
        gl.useProgram(dofDownsampleProg.ref());
        demo.nearSlope = newSliderVal;
        gl.uniform2fv(dofDownsampleProg.uDofEqLoc, vec2.fromValues( demo.nearSlope, demo.nearIntercept ));

        return demo.nearSlope + " :Near slope";
    };

    SEC3.ui.addSlider( demo.nearSlope + " :Near slope" ,
                 slopeCallback,
                 demo.nearSlope,
                 -10.0, -1.0,
                 0.01);

    var interceptCallback = function(e) {

        var newSliderVal = e.target.value;
        gl.useProgram(dofDownsampleProg.ref());
        demo.nearIntercept = newSliderVal;
        gl.uniform2fv(dofDownsampleProg.uDofEqLoc, vec2.fromValues( demo.nearSlope, demo.nearIntercept ));

        return demo.nearIntercept + " :Near intercept";
    };

    SEC3.ui.addSlider( demo.nearIntercept + " :Near intercept",
                 interceptCallback,
                 demo.nearIntercept,
                 1.0, 3.0,
                 0.01);

    var largeBlurrCallback = function(e) {

        demo.LARGE_BLUR = e.target.value;
        return demo.LARGE_BLUR + " :Large blur";
    }
    SEC3.ui.addSlider( demo.LARGE_BLUR + " :Large blur",
                                 largeBlurrCallback,
                                 demo.LARGE_BLUR,
                                 2.0, 16.0,
                                 0.1);

    var mediumBlurrCallback = function(e) {

        demo.MEDIUM_BLUR = e.target.value;
        return demo.MEDIUM_BLUR + " :Medium blur";
    }
    SEC3.ui.addSlider( demo.MEDIUM_BLUR + " :Medium blur",
                                 mediumBlurrCallback,
                                 demo.MEDIUM_BLUR,
                                 1.0, 8.0,
                                 0.1);

    var smallBlurrCallback = function(e) {

        demo.SMALL_BLUR = e.target.value;
        return demo.SMALL_BLUR + " :Small blur";
    }
    SEC3.ui.addSlider( demo.SMALL_BLUR + " :Small blur",
                                 smallBlurrCallback,
                                 demo.SMALL_BLUR,
                                 0.0, 3.0,
                                 0.1);
};

function initBlurButtons() {
    
    SEC3.ui = SEC3.ui || new UI("uiWrapper");

    var lilSigCallback = function(e) {

        var newSliderVal = e.target.value;
        demo.blurSigma = newSliderVal;
        var sigmaSquared = demo.blurSigma * demo.blurSigma;
        gl.useProgram(blurProg.ref());
        gl.uniform1f(blurProg.uLilSigLoc, sigmaSquared);

        return "Sigma: " + demo.blurSigma;
    };

    SEC3.ui.addSlider("Sigma: " + demo.blurSigma,
                 lilSigCallback,
                 demo.blurSigma * demo.blurSigma,
                 0.1, 6.0,
                 0.1);
};

var updateLightCount = function( newCount ) {

    var difference = newCount - scene.getNumLights();
    if( difference < 0 ) {
        while (difference < 0) {
            scene.popLight(gl);
            difference++;
        }
    }
    else if( difference > 0 ) {
        while ( difference > 0 ) {
            addLight();
            difference--;
        }
    }
    demo.selectedLight =  newCount - 1;
    // buildShadowMapProg.dispose(gl);
    // buildShadowMapProg = SEC3.ShaderCreator.buildShadowMapPrograms(gl, scene);
    // renderWithCascadesProg.dispose(gl);
    // renderWithCascadesProg = SEC3.ShaderCreator.renderCascShadowProg(gl, scene);
    // SEC3.run(gl);
}

/*
 * Creates a light at a random position inside Sponza
 * TODO: within camera's view frustum
 */
var addLight = function() {

    var viewBounds = scene.getCamera().getFrustumBounds();
    var xPos = SEC3.math.randomRange(-10, 10);
    var yPos = SEC3.math.randomRange(4, 15);
    var zPos = SEC3.math.randomRange(-1, 1);
    // var xPos = SEC3.math.randomRange(viewBounds[0], viewBounds[3]);
    // var yPos = SEC3.math.randomRange(0, viewBounds[4]);
    // var zPos = SEC3.math.randomRange(viewBounds[2], viewBounds[5]);
    var azimuth = Math.random() * 360;
    var elevation = Math.random() * -90;

    var nextLight = new SEC3.SpotLight();
    nextLight.goHome ( [xPos, yPos, zPos] ); 
    nextLight.setAzimuth(azimuth );    
    nextLight.setElevation( elevation );
    nextLight.setPerspective(25, 1.0, demo.zNear, demo.zFar);
    nextLight.setupCascades( 1, 256, gl, scene );
    scene.addLight(nextLight);
}


/*
 * Sets up basics of scene; camera, viewport, projection matrix, fbo
 */
var setupScene = function(canvasId, messageId ) {
    var canvas;
    var msg;
    //----SETUP scene
    //get WebGL context
    canvas = document.getElementById( canvasId );
    SEC3.canvas = canvas;
    msg = document.getElementById( messageId );
    gl = SEC3.getWebGLContext( canvas, msg );
    if (! gl) {
        console.log("Bad GL Context!");
        return;
    }
    
    gl.viewport( 0, 0, canvas.width, canvas.height );
    gl.viewportWidth = canvas.width;
    gl.viewportHeight = canvas.height;
    // gl.clearColor( 0.3, 0.3, 0.3, 1.0 );
    gl.clearColor( 0.0, 0.0, 0.0, 0.5);

    gl.enable( gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);

    scene = new SEC3.Scene();

    //Setup camera
    camera = new SEC3.Camera();
    camera.goHome( [-5.0, 7.0, 1.5] ); //initial camera posiiton
    camera.setAzimuth( 75.0 );
    camera.setElevation( 0.0 );
    interactor = SEC3.CameraInteractor( camera, canvas );
    camera.setPerspective( 60, canvas.width / canvas.height, demo.zNear, demo.zFar );

    scene.setCamera(camera);

    var nextLight = new SEC3.SpotLight();
    nextLight.goHome ( [ 0, 15, 0] ); 
    nextLight.setAzimuth( 90.0 );    
    nextLight.setElevation( -40.0 );
    nextLight.setPerspective( 30, 1, demo.zNear, demo.zFar );
    nextLight.setupCascades( 1, 512, gl, scene );
    scene.addLight(nextLight);
    demo.cascadeToDisplay = 0.0;
    lightAngle = 0.0;
    elCounter = 125;

    loadObjects();

    var particleSpecs = {
        maxParticles : 10000,
        emitters : [],
        gravityModifier : -800.0,
        RGBA : [0.0, 0.2, 0.9, 0.311],
        damping : 1.01,
        type : "nBody",
        activeBodies : 2,
        particleSize : 1.0,
        luminence : 40.0,
        scatterMultiply : 2.0,
        shadowMultiply : 0.1,
        scale : 30.0
        //TODO phi and theta?
    };
    particleSystem = SEC3.createParticleSystem(particleSpecs);

    //Create FBO's 
    //TODO: modularize

    SEC3.gBuffer = SEC3.createFBO();
    if (! SEC3.gBuffer.initialize( gl, canvas.width, canvas.height )) {
        console.log( "FBO initialization failed.");
        return;
    }

    fbo = SEC3.createFBO();
    if (! fbo.initialize( gl, canvas.width, canvas.height )) {
        console.log( "FBO initialization failed.");
        return;
    }

    lowResFBO = SEC3.createFBO();
    if (! lowResFBO.initialize( gl, 512.0, 512.0 )) {
        console.log( "display FBO initialization failed.");
        return;
    }


    workingFBO = SEC3.createFBO();
    if (! workingFBO.initialize( gl, canvas.width, canvas.height )) {
        console.log( "workingFBO initialization failed.");
        return;
    }

    finalFBO = SEC3.createFBO();
    if (! finalFBO.initialize( gl, canvas.width, canvas.height )) {
        console.log( "finalFBO initialization failed.");
        return;
    }

    shadowFBO = SEC3.createFBO();
    if (! shadowFBO.initialize( gl, demo.SHADOWMAP_SIZE, demo.SHADOWMAP_SIZE, 2 )) {
        console.log( "shadowFBO initialization failed.");
        return;
    }

    debugFBO = SEC3.createFBO(); //TODO hide this stuff
    if (! debugFBO.initialize( gl, canvas.width, canvas.height, 4 )) {
        console.log( "debugFBO initialization failed.");
        return;
    }

    lightFBO = SEC3.createFBO(); //TODO hide this stuff
    if (! lightFBO.initialize( gl, canvas.width, canvas.height, 4 )) {
        console.log( "lightFBO initialization failed.");
        return;
    }

};
