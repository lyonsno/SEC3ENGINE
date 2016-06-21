
SEC3 = SEC3 || {};

SEC3.drawBuffersExt = SEC3.drawBuffersExt || null;
SEC3.extensions = {};

SEC3.extensions.drawBuffers = function(gl){
	if (! SEC3.drawBuffersExt) {
		try {
			SEC3.drawBuffersExt = gl.getExtension("WEBGL_draw_buffers");
	        if(! SEC3.drawBuffersExt){
	            alert("sorry, your browser does not support multiple draw buffers");
	        }
	        return SEC3.drawBuffersExt;
	    }
	    catch (e) {
	    	alert("bad gl context given to extension manager");
	    	return null;
	    }
	}
	return SEC3.drawBuffersExt;
};

SEC3.depthTextureExt = SEC3.depthTextureExt || null;

SEC3.extensions.depthTexture = function(gl){
	if (! SEC3.depthTextureExt) {
		try {
			SEC3.depthTextureExt = gl.getExtension("WEBKIT_WEBGL_depth_texture");
	        if(! SEC3.depthTextureExt){
	            alert("sorry, depth textures not implemented for this browser");
	        }
	        return SEC3.depthTextureExt;
	    }
	    catch (e) {
	    	alert("bad gl context given to extension manager");
	    	return null;
	    }
	}
	return SEC3.depthTextureExt;
};