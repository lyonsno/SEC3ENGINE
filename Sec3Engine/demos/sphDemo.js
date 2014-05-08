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
    demo.spherePosition = vec3.fromValues(2.6,2,2);
    demo.sphereModelMatrix = mat4.create();
    mat4.translate( demo.sphereModelMatrix, demo.sphereModelMatrix, demo.spherePosition);
    demo.resetSphere = function() {
        demo.spherePosition = vec3.fromValues(0,0,1);
        demo.sphereModelMatrix = mat4.create();
        mat4.translate( demo.sphereModelMatrix, demo.sphereModelMatrix, demo.spherePosition);
    }
    return demo;

})();

//--------------------------------------------GLOBALS:
var demo;

var gl;
var scene;
var sph;
var stats;

var model_vertexVBOs = [];   //buffer object for loaded model (vertex)
var model_indexVBOs = [];    //buffer object for loaded model (index)
var model_normalVBOs = [];   //buffer object for loaded model (normal)
var model_texcoordVBOs = []; //buffer object for loaded model (texture)

//--------------------------------------------FUNCTIONS:
var myRenderLoop = function() {
	window.requestAnimationFrame( myRenderLoop );
    
        stats.begin();
        myRender();
        stats.end();

};

var getSphereMovementVector = function( screenX, screenY ) {
    var sphereScreenCenter = vec4.fromValues( demo.spherePosition[0], demo.spherePosition[1], 0.0, 1.0 );
    vec4.transformMat4( sphereScreenCenter, sphereScreenCenter, scene.getCamera().getMVP() );
    vec4.scale( sphereScreenCenter, sphereScreenCenter, 1.0 / sphereScreenCenter[3] );
    // vec4.add( sphereScreenCenter, sphereScreenCenter, vec4.fromValues( 0.5, 0.5, 0.5, 0.0));
    var movementVector = vec4.fromValues( screenX - sphereScreenCenter[0], screenY - sphereScreenCenter[1], 0.0, 1.0 );
     // vec4.subtract( movementVector, movementVector, sphereScreenCenter );

    // vec4.transformMat4( movementVector, movementVector, scene.getCamera().getInverseMVP() );
    vec4.normalize( movementVector, movementVector );
    return [ movementVector[0], movementVector[1], movementVector[2] ];
};

var moveSphere = function(screenX, screenY){
    var scale = 0.2;
    screenX /= SEC3.canvas.width * 0.5;
    screenY /= SEC3.canvas.height * 0.5;
    screenX -= 1.0;
    screenY -= 1.0;
    screenY = - screenY;
    var xyz = getSphereMovementVector( screenX, screenY );
    var x = scale * xyz[0];
    var y = scale * xyz[1];
    var z = scale * xyz[2];

    mat4.translate( demo.sphereModelMatrix, demo.sphereModelMatrix, vec3.fromValues( x, y, z ));
    demo.spherePosition = vec3.add( demo.spherePosition, demo.spherePosition, vec3.fromValues( x, y, z ));

};

var myRender = function() {
    if(interactor.button == 0 && interactor.dragging && ! interactor.alt ) {
        moveSphere( interactor.x * 0.5, interactor.y * 0.5 );
    }
    //TODO getter / only call once
    // if( ! demo.gBufferFilled ) {
        gl.enable( gl.CULL_FACE );
        gl.cullFace( gl.BACK );
        gl.frontFace( gl.CCW );
        for( var i = 0; i < sph.projectors.length; i++ ){
            SEC3.renderer.fillGPass( sph.projectors[i].gBuffer, sph.projectors[i] );
        }
        demo.gBufferFilled = true;
        // sph.updateBuckets();
        // SEC3.postFx.blurGaussian( sph.projectors[0].gBuffer.texture(1),  demo.blurFBO, 4.0 );
        // sph.projectors[0].gBuffer.setTexture( 1, demo.blurFBO.texture(0), gl);
    // }
    SEC3.renderer.fillGPass( scene.gBuffer, scene.getCamera() );
    // // SEC3.renderer.deferredRender( scene, scene.gBuffer );
    SEC3.postFx.finalPass( scene.gBuffer.texture(2));

    if( ! sph.paused ) {
        // bucketStats.begin();
        // sph.updateBuckets();
        // bucketStats.end();
    
        // positionStats.begin();
        sph.updatePositions();
        // positionStats.end();

        sph.updateBuckets();

        // densityStats.begin();
        sph.updateDensity();
        // densityStats.end();

        // velocityStats.begin();
        sph.updateVelocities();
        // velocityStats.end();
    }

    if( sph.viewGrid ) {
        SEC3.postFx.finalPass(sph.bucketFBO.texture(0)); // TEMP
    }
    else if( sph.viewDepth ) {
        SEC3.postFx.finalPass( sph.projectors[sph.currentProjector].gBuffer.texture(0) );
    }

    else if( sph.viewNormals ) {
        SEC3.postFx.finalPass( sph.projectors[sph.currentProjector].gBuffer.texture(1));
         // SEC3.postFx.finalPass( demo.blurFBO.texture(0) );
    }
    else {
        sph.draw( scene, null );
    }
    
};

var main = function( canvasId, messageId ){

    initGL( canvasId, messageId );
    var extDrawBuffers = gl.getExtension( "WEBGL_draw_buffers");
    SEC3.renderer.init(); // TEMP
    SEC3.postFx.init(); // TEMP
	setupScene();
	SEC3.render = myRender;
	SEC3.renderLoop = myRenderLoop;
	SEC3.run(gl);

};

/*
 * Sets up basics of scene; camera, viewport, projection matrix, fbo
 */
var setupScene = function(){

    scene = new SEC3.Scene();

    initCamera();
    initLight();
    loadObjects();
    initParticleSystem();
    initFBOs();
    initUI();
};

var initLight = function() {
    var nextLight = new SEC3.SpotLight();
    nextLight.goHome ( [ 0, 6, 0] ); 
    nextLight.setAzimuth( 90.0 );    
    nextLight.setElevation( -60.0 );
    nextLight.setPerspective( 30, 1, 0.2, 10.0 );
    nextLight.setupCascades( 1, 512, gl, scene );
    scene.addLight(nextLight);
}

var initCamera = function() {

	var canvas = SEC3.canvas;
	var camera = new SEC3.Camera();
    camera.goHome( [5.0, 5.0, 8.0] ); //initial camera posiiton
    // camera.setAzimuth( -30.0 );
    camera.setElevation( -30.0 );
    interactor = new SEC3.CameraInteractor( camera, canvas );
    // interactor.update();
    camera.setPerspective( 60, canvas.width / canvas.height, 0.1, 30.0 );
    scene.setCamera(camera);
    SEC3.canvas = canvas;

}

var initFBOs = function() {

    var canvas = SEC3.canvas;
    // var blurFBO = SEC3.createFBO();
    // blurFBO.initialize( gl, 2048, 2048 );
    // demo.blurFBO = blurFBO;
    var gBuffer = SEC3.createFBO();
    gBuffer.initialize( gl, SEC3.canvas.width, SEC3.canvas.height );
    scene.gBuffer = gBuffer;

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
    if (! shadowFBO.initialize( gl, 512, 512, 2 )) {
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
}

var initGL = function(canvasId, messageId) {
    //get WebGL context
    var canvas = document.getElementById( canvasId );
    canvas.width = document.body.clientWidth * 0.5;
    canvas.height = document.body.clientHeight * 0.5;
    SEC3.canvas = canvas;
    var msg = document.getElementById( messageId );
    gl = SEC3.getWebGLContext( canvas, msg );
    if (! gl) {
        console.log("Bad GL Context!");
        return;
    }
    
    gl.viewport( 0, 0, canvas.width, canvas.height );
    gl.viewportWidth = canvas.width;
    gl.viewportHeight = canvas.height;
    gl.clearColor( 0.4, 0.4, 0.4, 1.0);
    gl.depthFunc(gl.LESS);
}
var initParticleSystem = function() {

    var specsFast = {
        // numParticles : 65536,
         // numParticles : 30276,
        numParticles : 16384,
        RGBA : vec4.fromValues( 0.0, 0.0, 1.0, 1.0 ),
        particleSize : 1.3,
        stepsPerFrame : 1.0,
        gravity : 9.8,
        pressureK : 10,
        nearPressureK : 24,
        restDensity : 0.3,
        restPressure : 100.0,
        viscosityK : 16,
        viscosityLinearK : 15,
        h : 0.1625,   
        mass : 0.001,
        surfaceTension : 0.26,
        maxVelocity : 8.0
    }

	sph = new SEC3.SPH(specsFast);

    sph.addDetectorProjector( [12.0, 12.0, 12.0], 45.0, -45.0, 256, 30.0 );     
    sph.addDetectorProjector( [-2.0, -12.0, -2.0], -135.0, 45.0, 256, 30.0 );         
    sph.addDetectorProjector( [-2.0, 12.0, 12.0], -45.0, -45.0, 256, 30.0 );         
    sph.addDetectorProjector( [12.0, -12.0, -2.0], 135.0, 45.0, 256, 30.0 );         


    // TODO:
    // particleSize : 0.7,
    // stepsPerFrame : 4,
    // gravity : 9.8,
    // pressureK : 1000,
    // nearPressureK : 228,
    // restDensity : 0.8,
    // restPressure : 100.0,
    // viscosityK : 12,
    // viscosityLinearK : 2,
    // h : 0.12,   
    // mass : 0.001,
    // surfaceTension : 0.0,
    // maxVelocity : 50.0
}

var initUI = function() {
    
    stats = new Stats();
    stats.setMode(0); // 0: fps, 1: ms
    // Align top-left
    stats.domElement.style.position = 'absolute';
    stats.domElement.style.left = '0px';
    stats.domElement.style.top = '0px';
    document.body.appendChild( stats.domElement );

    // bucketStats = new Stats();
    // positionStats = new Stats();
    // densityStats = new Stats();
    // velocityStats = new Stats();

    // bucketStats.setMode(1);
    // positionStats.setMode(1);
    // densityStats.setMode(1);
    // velocityStats.setMode(1);

    // bucketStats.domElement.style.position = 'absolute';
    // bucketStats.domElement.style.left = '0px';
    // bucketStats.domElement.style.top = '100px';
    // document.body.appendChild( bucketStats.domElement );

    // positionStats.domElement.style.position = 'absolute';
    // positionStats.domElement.style.left = '0px';
    // positionStats.domElement.style.top = '200px';
    // document.body.appendChild( positionStats.domElement );

    // densityStats.domElement.style.position = 'absolute';
    // densityStats.domElement.style.left = '0px';
    // densityStats.domElement.style.top = '300px';
    // document.body.appendChild( densityStats.domElement );

    // velocityStats.domElement.style.position = 'absolute';
    // velocityStats.domElement.style.left = '0px';
    // velocityStats.domElement.style.top = '400px';
    // document.body.appendChild( velocityStats.domElement );

    var gui = new dat.GUI();
    gui.add(sph, 'stepsPerFrame', 1, 10).name('Time Step');
    gui.add(sph, 'maxVelocity', 1, 20).name('Max Velocity');
    gui.add(sph, 'h', 0.04, 0.2).name('Scale');
    var pressureSlider = gui.add(sph, 'pressureK', 0.0, 40.0 ).name('Incompressibility');
    pressureSlider.onChange = (function(value) {
        sph.nearPressureK = 2.4 * value;
    });
    // gui.add(sph, 'nearPressureK', 0.0, 500.0 ); //TODO combine
    // gui.add(sph, 'viscosityK', 0.0, 24.0);
    // gui.add(sph, 'viscosityLinearK', 0.0, 100.0).name('Viscostity');
    gui.add(sph, 'surfaceTension', 0.0, 2.0).name('Surface Tension');
    gui.add(sph, 'restDensity', 0.001, 1.0).name('Rest Density');
    
    // gui.add(sph, 'showDepth' ).name('Show collision depth');
    // gui.add(sph, 'showNormals' ).name('Show collision normal');
    // gui.add(sph, 'showNextProjector').name('Show next projector');
    gui.add(sph, 'particleSize', 0.1, 2.0 ).name('Size');
    gui.add(sph, 'showGrid' ).name('Show voxel grid');
    gui.add(sph, 'pause' ).name('Pause');
    gui.add(sph, 'initFBOs' ).name('Restart');
    // gui.add(demo, 'resetSphere').name('Reset Sphere');
}

/*
 * Loads objects from obj files into the model_VBOs
 */
var loadObjects = function() {
    //Load a OBJ model from file
    var objLoader = SEC3.createOBJLoader(scene);
    
    
    objLoader.loadFromFile( gl, 'Sec3Engine/models/sphere/sphere2.obj', 'Sec3Engine/models/sphere/sphere.mtl');
    // objLoader.loadFromFile( gl, 'Sec3Engine/models/thickPlane/terrain4.obj', 'Sec3Engine/models/thickPlane/terrain4.mtl');
    // objLoader.loadFromFile( gl, 'Sec3Engine/models/alien/decimated5.obj', 'Sec3Engine/models/alien/decimated5.mtl');
    objLoader.loadFromFile( gl, 'Sec3Engine/models/bigSphere/sphere.obj', 'Sec3Engine/models/bigSphere/sphere.mtl');
    
        
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