/**
*   Camera object
*   Based on the code sample from WebGL Beginner's Guide.
*/

//SEC3 is a core function interface
var SEC3 = SEC3 || {};

SEC3.Camera = function(){
   
   SEC3.PerspProjector.call( this );

};
    
SEC3.Camera.prototype = Object.create( SEC3.PerspProjector.prototype );