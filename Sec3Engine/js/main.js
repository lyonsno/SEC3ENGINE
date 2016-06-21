
// By Cheng

//Global variables
//Bad practice, but let's just leave them here
var gl;    //GL context object
var persp; //perspective matrix
var view;  //viewing matrix

var camera; //camera object
var interactor; //camera interactor

var floor_vbo;   //vertex buffer object for floor 
var floor_ibo;   //index buffer object for floor
var floorProg;   //a simple shader program for floor


///Paticle stuff
var particles = [];
var particleArray = null;
var particle_vbo;  //vertex buffer object for particles
var particleProg;  //a simple shader program for particles
var lastFrameTime = 0.0;
var spriteTex;

// Customized draw function
// Do whatever you think fit
var myRender = function() {
    
////Render the floor/////////////////////////
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );
    gl.useProgram( floorProg.ref() );
    //update the model-view matrix
    gl.uniformMatrix4fv( floorProg.uModelViewLoc, false, camera.getViewTransform());        

    gl.bindBuffer( gl.ARRAY_BUFFER, floor_vbo );
    gl.vertexAttribPointer( floorProg.aVertexPosLoc, 3, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( floorProg.aVertexPosLoc );

    gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, floor_ibo );
    gl.drawElements( gl.LINES, Floor.indices.length, gl.UNSIGNED_SHORT, 0 );

    gl.bindBuffer( gl.ARRAY_BUFFER, null );
    gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, null );

////Render particles/////////////////
   
    var time = Date.now();
    // Update the particle positions
    updateParticles((time - lastFrameTime) / 1000.0);

    lastFrameTime = time;
    gl.enable(gl.BLEND);
    gl.useProgram( particleProg.ref() );
    gl.uniformMatrix4fv( particleProg.uModelViewLoc, false, camera.getViewTransform()); 
    gl.uniform1f( particleProg.uPointSizeLoc, 14);

    gl.bindBuffer( gl.ARRAY_BUFFER, particle_vbo );
    gl.vertexAttribPointer( particleProg.aVertexPosLoc, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray( particleProg.aVertexPosLoc);

    gl.activeTexture( gl.TEXTURE0 );
    gl.bindTexture( gl.TEXTURE_2D, spriteTex.tex );
    gl.uniform1i( particleProg.uSamplerLoc, 0);

    gl.drawArrays( gl.POINTS, 0, particles.length );
    gl.bindBuffer( gl.ARRAY_BUFFER, null );
    gl.disable(gl.BLEND);
};

// Customized looping function
// Do whatever you think fit
var myRenderLoop = function(){
    window.requestAnimationFrame( myRenderLoop );
    myRender();
};

var main = function( canvasId, messageId ){

    var canvas;
    var msg;

    //get WebGL context
    canvas = document.getElementById( canvasId );
    msg = document.getElementById( messageId );
	gl = SEC3ENGINE.getWebGLContext( canvas, msg );
    if( !gl ){
        return;
    }
    
    gl.viewport( 0, 0, canvas.width, canvas.height );
    gl.clearColor( 0.3, 0.3, 0.3, 1.0 );

    gl.depthFunc(gl.LESS);

    gl.blendFunc(gl.SRC_ALPHA,gl.ONE);
    //Setup camera
    view = mat4.create();
    mat4.identity( view );

    persp = mat4.create();

    //mat4.perspective use radiance
    mat4.perspective( persp, 60*3.1415926/180, canvas.width/canvas.height, 0.1, 100.0 );

    //Create a camera, and attach it to the interactor
    camera = SEC3ENGINE.createCamera(CAMERA_TRACKING_TYPE);
    camera.goHome( [0, 4, 20] ); //initial camera posiiton
    interactor = SEC3ENGINE.CameraInteractor( camera, canvas );

    //Create a floor geometry and upload the vertex data
    Floor.build(80,2);
    floor_vbo = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, floor_vbo );
    gl.bufferData( gl.ARRAY_BUFFER, new Float32Array(Floor.vertices), gl.STATIC_DRAW );
    gl.bindBuffer( gl.ARRAY_BUFFER, null );

    floor_ibo = gl.createBuffer();
    gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, floor_ibo );
    gl.bufferData( gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(Floor.indices), gl.STATIC_DRAW );
    gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, null );



    //Create a shader program for floor rendering
    floorProg = SEC3ENGINE.createShaderProgram();

    //Load the shader source asynchronously
    floorProg.loadShader( gl, "shader/basic.vert", "shader/basic.frag" );
    
    //prog1 might not be ready even after loadShader returned
   
    //We register necessary callback functions, like querying attrib and uniform indices  
    floorProg.addCallback( function(){
        gl.useProgram( floorProg.ref() );
        //query the locations of shader parameters
        floorProg.aVertexPosLoc = gl.getAttribLocation( floorProg.ref(), "a_vpos" );
        floorProg.uPerspLoc = gl.getUniformLocation( floorProg.ref(), "u_persp" );
        floorProg.uModelViewLoc = gl.getUniformLocation( floorProg.ref(), "u_mv" );

        //Setup perspective matrix here, since it won't change
        gl.uniformMatrix4fv( floorProg.uPerspLoc, false, persp);
    } );

    //We can register another callback if it's needed
    floorProg.addCallback( function(){
         
    } );

    //Finally, we register the asynchronously-requested resources with the engine core
    //asynchronously-requested resources are loaded using AJAX 
    SEC3ENGINE.registerAsyncObj( gl, floorProg );


////////// Let's add a simple particle system//////////////////////////////////////
    //First we initialize the particle data
    configureParticles(1024);

    //create a shader program for rendering particles
    particleProg = SEC3ENGINE.createShaderProgram();
    particleProg.loadShader( gl, "shader/particle.vert", "shader/particle.frag" );

    // //Register an index-query callback function
    particleProg.addCallback( function(){

        gl.useProgram( particleProg.ref() );
        particleProg.aVertexPosLoc = gl.getAttribLocation( particleProg.ref(), "a_Particle" );
        particleProg.uSamplerLoc = gl.getUniformLocation( particleProg.ref(), "u_Sampler" );
        particleProg.uPerspLoc = gl.getUniformLocation( particleProg.ref(), "u_persp" );
        particleProg.uModelViewLoc = gl.getUniformLocation( particleProg.ref(), "u_mv" );
        particleProg.uPointSizeLoc = gl.getUniformLocation( particleProg.ref(), "u_PointSize" );
        //Setup perspective matrix here, since it won't change
        gl.uniformMatrix4fv( particleProg.uPerspLoc, false, persp);
    } );

    //create a texture
    spriteTex = new Texture();
    spriteTex.setImage( "textures/spark.png" );

    SEC3ENGINE.registerAsyncObj( gl, particleProg );
    lastFrameTime = Date.now();
////////// End of creating particle system//////////////////////////////////////


    //Attach our custom rendering functions
    SEC3ENGINE.render = myRender;
    SEC3ENGINE.renderLoop = myRenderLoop;

    //Start rendering loop
    //This function will iterately check if asynchronously-requested resources are ready
    //before starting the rendering loop
    SEC3ENGINE.run(gl);
    
};

var resetParticle = function(p) {
    p.pos = [0.0, 0.0, 0.0];

    p.vel = [
        (Math.random() * 20.0) - 10.0,
        (Math.random() * 20.0),
        (Math.random() * 20.0) - 10.0,
    ];

    p.lifespan = (Math.random() * 3);
    p.remainingLife = p.lifespan;
};

var configureParticles = function(count) {
    var i, p;

    particleArray = new Float32Array(count * 4);

    for(i = 0; i < count; ++i) {
        p = {};
        resetParticle(p);
        particles.push(p);

        particleArray[(i*4) + 0] = p.pos[0];
        particleArray[(i*4) + 1] = p.pos[1];
        particleArray[(i*4) + 2] = p.pos[2];
        particleArray[(i*4) + 3] = p.remainingLife / p.lifespan;
    }

    particle_vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, particle_vbo);
    gl.bufferData(gl.ARRAY_BUFFER, particleArray, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
};

var updateParticles = function(elapsed) {
    var i, p, count = particles.length;

    // Loop through all the particles in the array
    for(i = 0; i < count; ++i) {
        p = particles[i];

        // Track the particles lifespan
        p.remainingLife -= elapsed;
        if(p.remainingLife <= 0) {
            resetParticle(p); // Once the particle expires, reset it to the origin with a new velocity
        }

        // Update the particle position
        p.pos[0] += p.vel[0] * elapsed;
        p.pos[1] += p.vel[1] * elapsed;
        p.pos[2] += p.vel[2] * elapsed;
        
        // Apply gravity to the velocity
        p.vel[1] -= 9.8 * elapsed;
        if(p.pos[1] < 0) {
            p.vel[1] *= -0.75; // Allow particles to bounce off the floor
            p.pos[1] = 0;
        }

        // Update the corresponding values in the array
        particleArray[(i*4) + 0] = p.pos[0];
        particleArray[(i*4) + 1] = p.pos[1];
        particleArray[(i*4) + 2] = p.pos[2];
        particleArray[(i*4) + 3] = p.remainingLife / p.lifespan;
    }

    // Once we are done looping through all the particles, update the buffer once
    gl.bindBuffer(gl.ARRAY_BUFFER, particle_vbo);
    gl.bufferData(gl.ARRAY_BUFFER, particleArray, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
};