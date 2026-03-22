
//----------------------------------------------------------------GLOBALS:

var particleSpecs = {
    maxParticles : 200000,
    emitters : [],
    gravityModifier : 1.0,
    RGBA : [0.0, 0.2, 0.9, 0.1],
    damping : 1.004,
    type : "nBody",
    activeBodies : 0,
    particleSize : 4.0,
    luminence : 166.0,
    scatterMultiply : 1.75,
    shadowMultiply : 0.1,
    scale : 350.0
    //TODO phi and theta?
};

var emitterSpecs = {
    emissionRate : 10,
}

var canvas;
var gl;
var system;
var particleDemoResizeHandler = null;

var mvMatrix = mat4.create();
var pMatrix = mat4.create();

function syncCanvasToWindow(canvas) {
    var viewportWidth = canvas.width;
    var viewportHeight = canvas.height;

    if (typeof window !== "undefined" && window.innerWidth && window.innerHeight) {
        viewportWidth = window.innerWidth;
        viewportHeight = window.innerHeight;
    }
    else if (
        typeof document !== "undefined" &&
        document.documentElement &&
        document.documentElement.clientWidth &&
        document.documentElement.clientHeight
    ) {
        viewportWidth = document.documentElement.clientWidth;
        viewportHeight = document.documentElement.clientHeight;
    }

    var dpr = 1;
    if (typeof window !== "undefined" && window.devicePixelRatio) {
        dpr = Math.min(window.devicePixelRatio, 2);
    }

    canvas.width = Math.max(1, Math.floor(viewportWidth * dpr));
    canvas.height = Math.max(1, Math.floor(viewportHeight * dpr));
}

function resizeParticleDemoViewport() {
    if (!canvas || !gl) {
        return;
    }

    syncCanvasToWindow(canvas);
    gl.viewportWidth = canvas.width;
    gl.viewportHeight = canvas.height;
    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);

    if (camera && camera.setPerspective) {
        camera.setPerspective(60, canvas.width / canvas.height, 0.6, 30.0);
    }
}

//--------------------------------------------------------------FUNCTIONS:

function drawScene() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    system.stepParticles();
    system.draw();
}

function renderLoop() {

    if(! SEC3ENGINE.ui) {
        initUiButtons();
    }
    requestAnimationFrame(renderLoop);
    drawScene();
}

function initGL(canvas) {
    var msg;
    //get WebGL context
    msg = document.getElementById("message");

    gl = SEC3ENGINE.getWebGLContext( canvas, msg );
    if( !gl ){
        return;
    }
    try {
        //extension to use floating point values in positionTextures
        gl.getExtension("OES_texture_float");  
        //extension allowing us to write to more than one buffer per render Pass
        // ext = gl.getExtension("WEBGL_draw_buffers");
        // if(! ext){
        //     alert("sorry, your browser does not support multiple draw buffers");
        // }

        gl.viewportWidth = canvas.width;    
        gl.viewportHeight = canvas.height;
    } 
    catch (e) {

        alert("Error finding canvas context");
    }
    if (! gl) {

        alert("Could not initialise WebGL, sorry :-(");
    }
}

function initUiButtons() {
    
    SEC3ENGINE.ui = new UI("uiWrapper");

    var withPresentationPrograms = function(callback) {
        if (system.withRenderPrograms) {
            system.withRenderPrograms(callback);
            return;
        }
        if (system.renderProgram) {
            callback(system.renderProgram);
        }
    };

    var updatePresentationFloatUniform = function(uniformName, value) {
        withPresentationPrograms(function(program) {
            if (!program || !program.ref || !program[uniformName]) {
                return;
            }
            gl.useProgram(program.ref());
            gl.uniform1f(program[uniformName], value);
        });
    };

    //courtesy of http://stackoverflow.com/a/2901298
    var numberWithCommas = function(stringMe) {
        return stringMe.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    };
        
    //-----RESTART
    var restartCallback = function() {
        // system = SEC3ENGINE.createParticleSystem(INITIAL_PARTICLES,INITIAL_MASS_MULTIPLIER);
        system.restart();
    };

    SEC3ENGINE.ui.addButton("Restart", restartCallback);

    //-----PARTICLE COUNT
    var countCallback = function(e) {

        var newSliderVal = e.target.value;
        // calc 
        var textureEdgeLength = Math.pow(2, newSliderVal);
        // 
        system.textureSideLength = textureEdgeLength;
        system.maxParticles = textureEdgeLength * textureEdgeLength;
        system.restart();
        // Return new label for slider
        return numberWithCommas(system.maxParticles) + " Particles";
    };
    
    SEC3ENGINE.ui.addSlider(numberWithCommas(system.maxParticles) + " Particles ", 
                 countCallback, 
                 Math.log(Math.sqrt(system.maxParticles)) / Math.log(2), // value (power of 2)
                 8, 12, // min, max
                 1); // step
    //-----

    //-----PARTICLE MASS RANGE
    var massCallback = function(e) {

        var newSliderVal = e.target.value;
        gl.useProgram(system.stepProgram.ref());
        gl.uniform1f(system.stepProgram.uGravityModifier, newSliderVal);
        system.massMultiplier = newSliderVal;        
        // Return new label for slider
        return "Gravity: " + newSliderVal;
    };

    SEC3ENGINE.ui.addSlider("Gravity: " + system.gravityModifier,
                 massCallback,
                 1,
                 -4000, 4000,
                 0.1);
    //-----

    //--------PARTICLE ALPHA TRANSPARENCY
    var alphaCallback = function(e) {

        var newSliderVal = e.target.value;
        system.RGBA[3] = newSliderVal;
        updatePresentationFloatUniform("uAlpha", newSliderVal);
        return "Particle transparency: " + newSliderVal;
    };

    SEC3ENGINE.ui.addSlider("Particle transparency: " + system.RGBA[3],
                 alphaCallback,
                 system.RGBA[3],
                 0.001, 0.1,
                 0.001);
    //-----

    //-------PARTICLE POINT SIZE
    var sizeCallback = function(e) {

        var newSliderVal = e.target.value;
        system.particleSize = newSliderVal;
        updatePresentationFloatUniform("uSize", newSliderVal);
        return "Particle draw size: " + newSliderVal;
    };

    SEC3ENGINE.ui.addSlider("Particle draw size: " + system.particleSize,
                 sizeCallback,
                 system.particleSize,
                 0.0, 4.0,
                 0.01);
    //-----

    //--------- Light intensity 
    var luminenceCallback = function(e) {

        var newSliderVal = e.target.value;
        system.luminence = newSliderVal;
        updatePresentationFloatUniform("uLuminence", newSliderVal);
        return "luminence: " + newSliderVal;
    };

    SEC3ENGINE.ui.addSlider("luminence: " + system.luminence,
                 luminenceCallback,
                 system.luminence,
                 0.0, 200.0,
                 0.1);
    //-----

    //--------- scatter intensity 
    var scatterCallback = function(e) {

        var newSliderVal = e.target.value;
        system.scatterMultiply = newSliderVal;
        updatePresentationFloatUniform("uScatterMultiply", newSliderVal);
        return "Scatter intensity: " + newSliderVal;
    };

    SEC3ENGINE.ui.addSlider("Scatter intensity: " + system.scatterMultiply,
                 scatterCallback,
                 system.scatterMultiply,
                 0.0, 20.0,
                 0.01);
    //-----

     //--------- shadow intensity 
    var shadowCallback = function(e) {

        var newSliderVal = e.target.value;
        system.shadowMultiply = newSliderVal;
        updatePresentationFloatUniform("uShadowMultiply", newSliderVal);
        return "Shadow intensity: " + newSliderVal;
    };

    SEC3ENGINE.ui.addSlider("Shadow intensity: " + system.shadowMultiply,
                 shadowCallback,
                 system.shadowMultiply,
                 0.0, 1.0,
                 0.01);
    //-----

     //--------- scale factor 
    var scaleCallback = function(e) {

        var newSliderVal = e.target.value;
        system.scale = newSliderVal;
        updatePresentationFloatUniform("uScale", newSliderVal);
        return "Scale factor: " + newSliderVal;
    };

    SEC3ENGINE.ui.addSlider("Scale factor: " + system.scale,
                 scaleCallback,
                 system.scale,
                 1.0, 400.0,
                 1.0);
    //-----


    //------Damping
    var dampingCallback = function(e) {

        var newSliderVal = e.target.value;
        gl.useProgram(system.stepProgram.ref());
        gl.uniform1f(system.stepProgram.uDamping, newSliderVal);
        system.damping = newSliderVal;
        return "Damping: " + newSliderVal;
    };

    SEC3ENGINE.ui.addSlider("Damping: " + system.damping,
                 dampingCallback,
                 system.damping,
                 1.0, 1.01,
                 0.001);
    //-----

    //------NUMBER OF INTERACTIONS
    var interactionsCallback = function(e) {

        var newSliderVal = e.target.value;
        gl.useProgram(system.stepProgram.ref());
        gl.uniform1f(system.stepProgram.uInteractions, newSliderVal);
        system.activeBodies = newSliderVal;
        return Math.pow(newSliderVal, 2) + " Interactions";
    };

    SEC3ENGINE.ui.addSlider(Math.pow(system.activeBodies, 2) + " Interactions",
                 interactionsCallback,
                 system.activeBodies,
                 0.0, 16.0,
                 1.0);
    //------
}

function startDemo() {
    // READ IN JSON FROM FILE
    // Gen texture for spark particles
    spriteTex = new Texture();
    spriteTex.setImage(SEC3.resolveResourcePath("Sec3Engine/textures/spark.png"));

    // FEED SPECS INTO IT
    // interactor = SEC3ENGINE.ParticleInteractor(canvas);//SEC3ENGINE.CameraInteractor(camera, canvas);
    
    // moved other inits into shader callbacks as they are dependent on async shader loading
    system = SEC3ENGINE.createParticleSystem(particleSpecs);

    SEC3ENGINE.render = drawScene;
    SEC3ENGINE.renderLoop = renderLoop;
    SEC3ENGINE.run(gl);
}

function webGLStart() {

    canvas = document.getElementById("glcanvas");
    SEC3.canvas = canvas;
    syncCanvasToWindow(canvas);
    initGL(canvas);

    camera = SEC3ENGINE.createCamera(CAMERA_TRACKING_TYPE);
    camera.setPerspective(60, canvas.width / canvas.height, 0.6, 30.0);
    camera.goHome([0.0, 0.0, 10.0]);
    
    interactor = SEC3ENGINE.ParticleInteractor(canvas);// SEC3ENGINE.cameraInteractor(camera, canvas);
    // interactor.attractor = [0.0, 0.0, 0.01];
     
    gl.clearColor(0.2, 0.2, 0.2, 1.0);
    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);

    if (typeof window !== "undefined" && window.addEventListener) {
        if (particleDemoResizeHandler && window.removeEventListener) {
            window.removeEventListener("resize", particleDemoResizeHandler);
        }
        particleDemoResizeHandler = function() {
            resizeParticleDemoViewport();
        };
        window.addEventListener("resize", particleDemoResizeHandler);
    }
    
    startDemo();
}
