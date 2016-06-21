//http://learningwebgl.com/blog/?p=28  source!

//-------------------------------------------------------CONSTANTS/FIELDS:

var CHOMP_DISTANCE = 0.5;
var SCALE_FACTOR = 3.8;
var mvMatrix = mat4.create();
var pMatrix = mat4.create();
var gl;
var shaderProgram;
var squareVertexPositionBuffer;
var tearTexture, headTexture, jawTexture;
var tearImage, headImage, jawImage;
var scaledTearSize, scaledThelmaSize;


//--------------------------------------------------------------FUNCTIONS:

function drawScene(model) {

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    mat4.identity(mvMatrix);

    drawThelma(model.thelma);
    drawTears(model);
}
function setTexture(texture){
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
}
function drawSquare() {

   
    
    setMatrixUniforms();
    gl.uniform1i(samplerLocation, 0); // save this to a value in the beginning
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.BLEND);
    gl.drawArrays(gl.TRIANGLE_STRIP, 
                  0, 
                  squareVertexPositionBuffer.numItems);
}

function drawTears(model) {

    var tears = model.tears;
    setTexture(tearTexture);
   
    var i;
    for (i = 0; i < model.numTears; i++) {

        transformTear(tears[i]);
        drawSquare();
    }
}

function drawThelma(thelma) {
    
    var thelmaPos = vec3.clone(thelma.position);
    mat4.identity(mvMatrix);
    vec3.scale(thelmaPos, thelmaPos, SCALE_FACTOR);

    mat4.scale(mvMatrix, mvMatrix, scaledThelmaSize); // TODO SCALE VAR
    mat4.translate(mvMatrix, mvMatrix, thelmaPos);

    //draw jaw
    setTexture(jawTexture);
    drawSquare();
    //adjust head if eating/finished eating tear
    if (thelma.framesToChew > 0) {
        mat4.translate(mvMatrix, mvMatrix, vec3.fromValues(0, CHOMP_DISTANCE, 0));
    }
    else if (thelma.framesToChew === 0) {
        mat4.translate(mvMatrix, mvMatrix, vec3.fromValues(0, -CHOMP_DISTANCE, 0));
    }
    //draw head
    setTexture(headTexture);
    drawSquare(); 
}

/*
 * gl - canvas context
 * id - DOM id of the shader
 */
function getShader(gl, id) {

    var shader;
    var shaderScript = document.getElementById(id);
    var str = "";
    var k = shaderScript.firstChild;

    if (! shaderScript)   { return null; }

    while (k) {

        if (k.nodeType == 3)   { str += k.textContent; }
        k = k.nextSibling;
    }

    if (shaderScript.type == "x-shader/x-fragment") {

        shader = gl.createShader(gl.FRAGMENT_SHADER);
    } 
    else if (shaderScript.type == "x-shader/x-vertex") {

        shader = gl.createShader(gl.VERTEX_SHADER);
    } 
    else   { return null; }

    gl.shaderSource(shader, str);
    gl.compileShader(shader);

    if (! gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {

        alert(gl.getShaderInfoLog(shader));
        return null;
    }
    return shader;
}

function handleTextureLoaded(image, texture) {

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindTexture(gl.TEXTURE_2D, null);
}

function initGL(canvas) {

    try {

        gl = canvas.getContext("experimental-webgl");
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

function initShaders() {

    var fragmentShader = getShader(gl, "shader-fs");
    var vertexShader = getShader(gl, "shader-vs");

    shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (! gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        alert("Could not initialise shaders");
    }

    gl.useProgram(shaderProgram);

    shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, 
                                                                 "aVertexPosition");
    gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

    shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, 
                                                         "uPMatrix");
    shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, 
                                                          "uMVMatrix");

    shaderProgram.textureCoordAttribute = gl.getAttribLocation(shaderProgram, 
                                                               "aTextureCoord");
    gl.enableVertexAttribArray(shaderProgram.textureCoordAttribute);

    samplerLocation = gl.getUniformLocation(shaderProgram, "uSampler")
}

function initBuffers() {

    vertices = [
         1.0,  1.0,  0.0,
        -1.0,  1.0,  0.0,
         1.0, -1.0,  0.0,
        -1.0, -1.0,  0.0
    ];

    squareVertexPositionBuffer = gl.createBuffer();  
    squareVertexPositionBuffer.itemSize = 3;
    squareVertexPositionBuffer.numItems = 4;

    gl.bindBuffer(gl.ARRAY_BUFFER, squareVertexPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, 
                           squareVertexPositionBuffer.itemSize, 
                           gl.FLOAT, false, 0, 0);

}

function initTextures() {

    tearTexture = gl.createTexture();
    headTexture = gl.createTexture();
    jawTexture = gl.createTexture();

    tearImage = new Image();
    headImage = new Image();
    jawImage = new Image();

    tearImage.onload = function() { handleTextureLoaded(tearImage, tearTexture); }
    headImage.onload = function() { handleTextureLoaded(headImage, headTexture); }
    jawImage.onload = function() { handleTextureLoaded(jawImage, jawTexture); }

    tearImage.src = "tear.png";
    headImage.src = "head.png";
    jawImage.src = "jaw.png";
}

function setDimensions(model) {

    scaledTearSize = vec3.create();
    scaledThelmaSize = vec3.create();
    vec3.scale(scaledTearSize, model.tearDimension, SCALE_FACTOR);
    vec3.scale(scaledThelmaSize, model.thelmaDimension, SCALE_FACTOR);
}

function setMatrixUniforms() {

    gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, false, pMatrix);
    gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix);
}

function transformTear(tear) {
    // This should be done in an engine's scene graph or
    // perhaps on the GPU
    
    var tearPos = vec3.clone(tear.position);

    mat4.identity(mvMatrix);
    vec3.scale(tearPos,tearPos,SCALE_FACTOR);
    
    mat4.rotate(mvMatrix, mvMatrix, tear.rotation * Math.PI / 180, vec3.fromValues(0,1,0))
    mat4.rotate(mvMatrix, mvMatrix, tear.rotation, vec3.fromValues(0,1,0))        
    mat4.scale(mvMatrix, mvMatrix, scaledTearSize); 
    mat4.translate(mvMatrix, mvMatrix, tearPos);
}

function webGLStart(model) {

    var canvas = document.getElementById("glcanvas");
    initGL(canvas);
    initShaders();
    initBuffers();
    initTextures();
    setDimensions(model);

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.enable(gl.DEPTH_TEST); //set in renderObjects or renderObjectImmediate...

    // This is work for a Camera class!
    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    mat4.perspective(pMatrix, Math.PI / 4, 
                     gl.viewportWidth / gl.viewportHeight, 
                     0.1, 100.0);
    mat4.lookAt(mvMatrix, 
                vec3.fromValues(0,0,7),
                vec3.fromValues(0,0,0),
                vec3.fromValues(0,1,0));
    mat4.mul(pMatrix, pMatrix, mvMatrix);
}