    //A wrapper for creating framebuffer objects
    //TODO: delete texture attatchments
    //SEC3 is a core function interface
    var SEC3 = SEC3 || {};

    SEC3.createFBO = function() {
    "use strict"

    var textures = [];
    var depthTex = null;
    var fbo = null;
    var resolution = [];
    var drawbuffers = [];

    function init( gl, width, height, numAttatchments ){
        numAttatchments = numAttatchments || 4;

    	gl.getExtension( "OES_texture_float" );
    	gl.getExtension( "OES_texture_float_linear" );
    	var extDrawBuffers = gl.getExtension( "WEBGL_draw_buffers");
    	var extDepthTex = gl.getExtension( "WEBGL_depth_texture" );

        resolution = [width, height];

    	if( !extDepthTex || !extDrawBuffers ){
    		alert("Depth texture extension unavailable on your browser!");
    		return false;
    	}

    	//Create depth texture 
    	depthTex = gl.createTexture();
    	gl.bindTexture( gl.TEXTURE_2D, depthTex );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT, width, height, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_SHORT, null);

        //Create textures for FBO attachment
        for( var i = 0; i < numAttatchments; ++i ){
        	textures[i] = gl.createTexture()
        	gl.bindTexture( gl.TEXTURE_2D,  textures[i] );
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); // TODO nearest?
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.FLOAT, null); 
        }

        //Create FBO
        fbo = gl.createFramebuffer();
        gl.bindFramebuffer( gl.FRAMEBUFFER, fbo );

        //Create render target;
        drawbuffers = [];
        drawbuffers[0] = extDrawBuffers.COLOR_ATTACHMENT0_WEBGL;
        drawbuffers[1] = extDrawBuffers.COLOR_ATTACHMENT1_WEBGL;
        drawbuffers[2] = extDrawBuffers.COLOR_ATTACHMENT2_WEBGL;
        drawbuffers[3] = extDrawBuffers.COLOR_ATTACHMENT3_WEBGL;
        extDrawBuffers.drawBuffersWEBGL( drawbuffers );

        //Attach textures to FBO
        gl.framebufferTexture2D( gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depthTex, 0 );
        for( var i = 0; i < numAttatchments; ++i ) {
            gl.framebufferTexture2D( gl.FRAMEBUFFER, drawbuffers[i], gl.TEXTURE_2D, textures[i], 0 );
        }
        var FBOstatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if( FBOstatus !== gl.FRAMEBUFFER_COMPLETE ){
            console.log( "FBO incomplete! Initialization failed!" );
            return false;
        }
        gl.bindFramebuffer( gl.FRAMEBUFFER, null );
        gl.bindTexture( gl.TEXTURE_2D, null );
        return true;
    }

        return {
            swapBuffers: function(a, b, gl){
                gl.bindFramebuffer( gl.FRAMEBUFFER, fbo );
                var tempTex = textures[a];
                textures[a] = textures[b];
                textures[b] = tempTex;
                gl.framebufferTexture2D( gl.FRAMEBUFFER, drawbuffers[a], gl.TEXTURE_2D, textures[a], 0 );
                gl.framebufferTexture2D( gl.FRAMEBUFFER, drawbuffers[b], gl.TEXTURE_2D, textures[b], 0 );
                // var FBOstatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
                // if( FBOstatus !== gl.FRAMEBUFFER_COMPLETE ){
                //     console.log( "FBO incomplete! Initialization failed!" );
                //     return false;
                // }
                gl.bindFramebuffer( gl.FRAMEBUFFER, null );
                gl.bindTexture( gl.TEXTURE_2D, null );
            },
            getWidth: function(){
                return resolution[0];
            },
            getHeight: function(){
                return resolution[1];
            },
            ref: function(){
            	return fbo;    
            },
            initialize: function( gl, width, height, numAttatchments ){
                return init( gl, width, height, numAttatchments );
            },
            dispose: function(gl) {
                var i;
                for(i = 0; i < textures.length; i++) {
                    gl.deleteTexture(textures[i]);
                }
                gl.deleteTexture(depthTex);
                gl.deleteFramebuffer(fbo);
            },
            bind: function(gl){
                gl.bindFramebuffer( gl.FRAMEBUFFER, fbo );
            },
            unbind: function(gl){
                gl.bindFramebuffer( gl.FRAMEBUFFER, null );
            },
            texture: function(i){
                return textures[i];
            },
            depthTexture: function(){
                return depthTex; 
            },
            ///// The following 3 functions should be implemented for all objects
            ///// whose resources are retrieved asynchronously
            isReady: function(){
            	var isReady = ready;
                for( var i = 0; i < textures.length; ++i ){
                    isReady &= textures[i].ready;
                }
                console.log( isReady );
                return isReady;
            },
            addCallback: function( functor ){
                callbackFunArray[callbackFunArray.length] = functor;
            },
            executeCallBackFunc: function(){
                var i;
                for( i = 0; i < callbackFunArray.length; ++i ){
                    callbackFunArray[i]();
            }
        }       
    };

};

