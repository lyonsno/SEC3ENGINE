//SEC3 is a core function interface
var SEC3 = SEC3 || {};

var NEAR_PLANE = 0;
var FAR_PLANE = 1;

SEC3.DiLight = function(){

    SEC3.OrthoProjector.call( this );
    this.cascadeFramebuffers = [];
    this.cascadeMatrices = [];
    this.cascadeClips = [];
    this.numCascades = 0.0;
};

SEC3.DiLight.prototype = Object.create( SEC3.OrthoProjector.prototype );

SEC3.DiLight.prototype.addCascade = function(resolution, near, far, scene) {

    var fbo = SEC3.createFBO();
    if (! fbo.initialize( gl, resolution, resolution, 1 )) {
        console.log( "shadowFBO initialization failed.");
        return;
    }
    else {

        var radius = scene.getCamera().getBoundingRadius();
        this.numCascades = this.cascadeFramebuffers.push(fbo);
        var orth = mat4.create();
        // Generates a orthogonal projection matrix with the given bounds
        // (out, left, right, bottom, top, near, far)
        mat4.ortho( orth, -this.width, this.width, -this.height, this.height, this.zNear, this.zFar );
        this.cascadeMatrices.push(orth);
        this.cascadeClips.push([near, far]);
    }


};

SEC3.DiLight.prototype.setupCascades = function( number, nearResolution, gl, scene) {

    this.disposeBuffers(gl);
    this.cascadeMatrices = [];
    this.cascadeClips = [];
    this.numCascades = Math.max(number, 1);
    nearResolution =  nearResolution || this.nearResolution;
    this.nearResolution = nearResolution;
    var clipLength = 1.0 / number;
    var near = 0.0;

    for( var i = 0; i < number; i++ ) {
        this.addCascade(nearResolution, near, near + clipLength, scene );
        near += clipLength;
        nearResolution /= 2.0;
    }


};

SEC3.DiLight.prototype.disposeBuffers = function(gl) {
    var i;
    for(i = 0; i < this.cascadeFramebuffers.length; i++) {
        this.cascadeFramebuffers[i].dispose(gl);
    }
    this.cascadeFramebuffers = [];
};

SEC3.DiLight.prototype.getPosition = function() {

    var p = vec3.create();
    vec3.scale(p, this.normal, 1.0 );
    return p;

};