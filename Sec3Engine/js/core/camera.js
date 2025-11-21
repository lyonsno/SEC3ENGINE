/**
*   Camera object
*   Based on the code sample from WebGL Beginner's Guide.
*/

//SEC3 is a core function interface
var SEC3 = SEC3 || {};

// Camera type constants expected by legacy demos.
var CAMERA_EXPLORING_TYPE = 0;
var CAMERA_TRACKING_TYPE = 1;

SEC3.Camera = function(){

   SEC3.PerspProjector.call( this );

};

SEC3.Camera.prototype = Object.create( SEC3.PerspProjector.prototype );

// Convenience factory used by demo pages.
SEC3.createCamera = function(/* type */){
    // Only one camera type is implemented; ignore the requested type for now.
    return new SEC3.Camera();
};
