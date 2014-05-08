var SEC3 = SEC3 || {};

/*
 * Constructor
 */
SEC3.OrthoProjector = function() {

	SEC3.Projector.call( this );
    this.width = 1.0;
    this.height = 1.0;
  
};

SEC3.OrthoProjector.prototype = Object.create( SEC3.Projector.prototype );

SEC3.OrthoProjector.prototype.updateOrtho = function () {
    var ortho = mat4.create();
    mat4.ortho( ortho, -this.width, this.width, 
                  -this.height, this.height, this.zNear, this.zFar );
    this.projectionMat = ortho;
};

SEC3.OrthoProjector.prototype.setWidth = function (newWidth) {
    this.width = newWidth;
    this.updateOrtho();
};

SEC3.OrthoProjector.prototype.setHeight = function (newHeight) {
    this.height = newHeight;
    this.updateOrtho();
};

SEC3.OrthoProjector.prototype.setOrtho = function (newWidth, newHeight, newNear, newFar) {
    this.width = newWidth;
    this.height = newHeight;
    this.zNear = newNear;
    this.zFar = newFar;
    this.updateOrtho();
};