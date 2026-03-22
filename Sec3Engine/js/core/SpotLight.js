//SEC3 is a core function interface
var SEC3 = SEC3 || {};

SEC3.defaultLightResolution = 512;

var NEAR_PLANE = 0;
var FAR_PLANE = 1;

SEC3.SpotLight = function(resolution){
    SEC3.PerspProjector.call( this );
    resolution = resolution || SEC3.defaultLightResolution;
    this.cascadeFramebuffers = [];
    this.cascadeMatrices = [];
    this.cascadeClips = [];
    this.numCascades = 0.0;
    this.nearResolution = resolution;
};

SEC3.SpotLight.prototype = Object.create( SEC3.PerspProjector.prototype );

var resolveLightGl = function(gl) {
    if (gl) {
        return gl;
    }
    if (typeof globalThis !== "undefined" && globalThis.gl) {
        return globalThis.gl;
    }
    if (typeof window !== "undefined" && window.gl) {
        return window.gl;
    }
    return gl;
};

SEC3.SpotLight.prototype.addCascade = function( resolution, near, far, gl ) {

    gl = resolveLightGl(gl);

    var fbo = SEC3.createFBO();
    if (! fbo.initialize( gl, resolution, resolution, 1 )) {
        console.log( "shadowFBO initialization failed.");
        return;
    }
    else {
        this.numCascades = this.cascadeFramebuffers.push(fbo);
        var persp = mat4.create();
        mat4.perspective( persp, this.fov, this.aspect, this.zNear, this.zFar );
        this.cascadeMatrices.push(persp);
        this.cascadeClips.push([near, far]);
    }


};

SEC3.SpotLight.prototype.setupCascades = function( number, nearResolution, gl, scene ) {

    gl = resolveLightGl(gl);
    this.disposeBuffers(gl);
    this.cascadeMatrices = [];
    this.cascadeClips = [];
    this.numCascades = Math.max(number, 1);
    nearResolution =  nearResolution || this.nearResolution;
    this.nearResolution = nearResolution;
    var clipLength = 1.0 / number;
    var near = 0.0;

    for( var i = 0; i < number; i++ ) {
        this.addCascade(nearResolution, near, near + clipLength, gl);
        near += clipLength;
        nearResolution /= 2.0;
    }

};

SEC3.SpotLight.prototype.disposeBuffers = function(gl) {
    gl = resolveLightGl(gl);
    var i;
    for(i = 0; i < this.cascadeFramebuffers.length; i++) {
        this.cascadeFramebuffers[i].dispose(gl);
    }
    this.cascadeFramebuffers = [];
};
