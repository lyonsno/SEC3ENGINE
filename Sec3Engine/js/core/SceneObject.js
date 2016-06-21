/**
*   projector object
*   Based on the code sample from WebGL Beginner's Guide.
*/

//SEC3 is a core function interface
var SEC3 = SEC3 || {};
/*
 * Constructor
 */
SEC3.SceneObject = function() {

    this.matrix      = mat4.create();
    this.up          = vec3.create();
    this.right       = vec3.create();
    this.normal      = vec3.create();
    this.position    = vec3.create();
    this.home        = vec3.create();
    this.azimuth     = 0.0;
    this.elevation   = 0.0;
   
};

SEC3.SceneObject.prototype = {

    constructor: SEC3.SceneObject,

    update: function () {
        mat4.identity(this.matrix);
        mat4.translate( this.matrix, this.matrix, this.position );
        mat4.rotateY( this.matrix, this.matrix, this.azimuth * Math.PI/180 );
        mat4.rotateX( this.matrix, this.matrix, this.elevation * Math.PI/180 );

        var m = this.matrix;
        
        vec4.transformMat4( this.right, [1,0,0,0], m );
        vec4.transformMat4( this.up, [0,1,0,0], m );
        vec4.transformMat4( this.normal, [0,0,1,0], m );
        vec3.normalize( this.normal, this.normal );
        vec3.normalize( this.up, this.up );
        vec3.normalize( this.right, this.right );
        vec4.transformMat4( this.position, [0,0,0,1], m );
    },

    setPosition: function (p){
        vec3.set( this.position, p[0], p[1], p[2] );
        this.update();
    },
    
    getPosition: function (){
        return this.position;
    },


    setAzimuth: function(az){
        this.changeAzimuth(az - this.azimuth);
    },

    changeAzimuth: function(az){
        
        this.azimuth +=az;
        
        if (this.azimuth > 360 || this.azimuth <-360) {
            this.azimuth = this.azimuth % 360;
        }
        this.update();
    },

    setElevation: function(el){
        this.changeElevation(el - this.elevation);
    },

    changeElevation: function(el){
        
        this.elevation +=el;
        
        if (this.elevation > 360 || this.elevation <-360) {
            this.elevation = this.elevation % 360;
        }
        this.update();
    },

    goHome: function(h){
        if (h != null){
            this.home = h;
        }
        this.setPosition(this.home);
        this.setAzimuth(0);
        this.setElevation(0);
        this.steps = 0;
    },

    moveForward: function(direction){
       direction = direction || 0.1;
        vec3.scaleAndAdd( this.position, this.position, this.normal, -direction );
        this.update();
    },

    moveBackward: function(direction){
       direction = direction || 0.1;
        vec3.scaleAndAdd( this.position, this.position, this.normal, direction );
        this.update();
    },

    moveLeft: function(direction){
        direction = direction || 0.1;
        vec3.scaleAndAdd( this.position, this.position, this.right, -direction );
        this.update();
    },

    moveRight: function(direction){
        direction = direction || 0.1;
        vec3.scaleAndAdd( this.position, this.position, this.right, direction );
        this.update();
    },

    moveUp: function(direction){
        direction = direction || 0.1;
        vec3.scaleAndAdd( this.position, this.position, this.up, direction );
        this.update();
    },

    moveDown: function(direction){
        direction = direction || 0.1;
        vec3.scaleAndAdd( this.position, this.position, this.up, -direction );
        this.update();
    }

};

// SEC3.EventDispatcher.prototype.apply( SEC3.)