/**
*   projector object
*   Based on the code sample from WebGL Beginner's Guide.
*/

//SEC3 is a core function interface
var SEC3 = SEC3 || {};
/*
 * Constructor
 */
SEC3.Projector = function() {

    SEC3.SceneObject.call(this);
    this.projectionMat = mat4.create();
    this.zNear = 0.1;
    this.zFar = 1.0;

};


SEC3.Projector.prototype = Object.create( SEC3.SceneObject.prototype );
   

SEC3.Projector.prototype.setFarClip = function (farPlane) {
    this.zFar = farPlane;
    this.updatePerspective();
};

SEC3.Projector.prototype.setNearClip = function (nearPlane) {
    this.zNear = nearPlane;
    this.updatePerspective();
};

SEC3.Projector.prototype.getProjectionMat = function () {
    var m = this.projectionMat;
    return m;
};


SEC3.Projector.prototype.dolly = function(s){
    
    var p =  vec3.create();
    var n = vec3.create();
    
    p = this.position;
    
    var step = s - this.steps;
    
    vec3.normalize( n, this.normal );
    
    var newPosition = vec3.create();
    
    // if(type == CAMERA_TRACKING_TYPE){
        newPosition[0] = p[0] - step*n[0];
        newPosition[1] = p[1] - step*n[1];
        newPosition[2] = p[2] - step*n[2];
    // }
    // else{
    //     newPosition[0] = p[0];
    //     newPosition[1] = p[1];
    //     newPosition[2] = p[2] - step; 
    // }
	
    this.setPosition(newPosition);
    this.steps = s;
};

SEC3.Projector.prototype.getViewTransform = function(){
    var m = mat4.create();
    mat4.invert( m, this.matrix );
    return m;
};

SEC3.Projector.prototype.getInverseMVP = function() {
    var mvp = this.getMVP();
    mat4.invert( mvp, mvp );
    return mvp;
};

SEC3.Projector.prototype.getMVP = function() {
    var v = this.getViewTransform();
    var p = this.getProjectionMat();
    var mvp = mat4.create();
    mat4.multiply( mvp, p, v);
    return mvp;
};

// SEC3.EventDispatcher.prototype.apply( SEC3.)