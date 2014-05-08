
//SEC3 is a core function interface
var SEC3 = SEC3 || {};

SEC3.createBuffer = function(itemSize, numItems, content, location) {
        
    var newBuffer = gl.createBuffer();  
    newBuffer.itemSize = itemSize;
    newBuffer.numItems = numItems;
    gl.bindBuffer(gl.ARRAY_BUFFER, newBuffer);
    var vert32Array = new Float32Array(content);
    gl.bufferData(gl.ARRAY_BUFFER, vert32Array, gl.STATIC_DRAW);
    gl.vertexAttribPointer(location, itemSize, gl.FLOAT, false, 0, 0);  
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    return newBuffer;
};

SEC3.getWebGLContext = function( canvas, message ){

    var ctx = null;
    var names = [ "webgl", "experimental-webgl", "webkit-3d" ];
    if( !window.WebGLRenderingContext ){
        message.innerText = "The browser does not support WebGL.  Visit http://get.webgl.org.";
        return undefined;
    }
    for (var ii = 0; ii < names.length; ++ii) {
        try {
            ctx = canvas.getContext(names[ii], { stencil : true, antialias : true });
        } 
        catch(e) {}
        if (ctx) {
            break;
        }
    }

    if( !ctx ){
    	message.innerText = "browser supports WebGL but initialization failed.";
    }
    return ctx;
};

//
SEC3.registerAsyncObj = function( gl, asyncObj ){
    if( !gl.asyncObjArray ){
        gl.asyncObjArray = [];
    }
    SEC3.isWaiting = true;
    gl.asyncObjArray[gl.asyncObjArray.length] = asyncObj;

};

//Make sure all objects with asynchronously-requested resources are ready before starting the rendering loop
SEC3.run = function(gl){
    var i;
    var n;

    n = gl.asyncObjArray.length;

    //check if resources are ready, one by one
    for( i = 0; i < gl.asyncObjArray.length; ++i ){
        if( gl.asyncObjArray[i].isReady() ){
            //Run object's registered callback functions
            gl.asyncObjArray[i].executeCallBackFunc();
            n -= 1;
        }
    }


    if( n === 0 ){
        SEC3.isWaiting = false;
        SEC3.renderLoop(); 
        gl.asyncObjArray = [];
    }
    else{
        window.setTimeout( SEC3.run, 500, gl );
    }
};
