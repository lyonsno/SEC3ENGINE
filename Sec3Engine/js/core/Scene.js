var SEC3 = SEC3 || {};

SEC3.Scene = function(){
	this.lights = [];
	this.camera = [];
	this.geometry = [];
	this.xMax; this.xMin;
	this.yMax, this.yMin;
	this.zMax, this.zMin;
};

SEC3.Scene.prototype = {

	constructor: SEC3.Scene,

	addLight: function (light) {
		return this.lights.push(light);
	},

	getLight: function (lightIndex) {
		return this.lights[lightIndex];
	},

	getLights: function () {
		return this.lights;
	},

	popLight: function (gl) {
		this.lights[this.lights.length -1].disposeBuffers(gl);
		this.lights.pop();
	},

	clearLights: function () {
		this.lights = [];
	},

	getNumLights: function () {
		return this.lights.length;
	},

	setCamera: function (newCamera) {
		this.camera = newCamera;
	},

	getCamera: function () {
		return this.camera;
	},

	updateBounds: function ( vertex ) {
		
		this.xMax = this.xMax || vertex.x;
		this.xMax = Math.max( this.xMax, vertex.x );

		this.xMin = this.xMin || vertex.x;
		this.xMin = Math.min( this.xMin, vertex.x );

		this.yMax = this.yMax || vertex.y;
		this.yMax = Math.max( this.yMax, vertex.y );

		this.yMin = this.yMin || vertex.y;
		this.yMin = Math.min( this.yMin, vertex.y );

		this.zMax = this.zMax || vertex.z;
		this.zMax = Math.max( this.zMax, vertex.z );

		this.zMin = this.zMin || vertex.z;
		this.zMin = Math.min( this.zMin, vertex.z );

	},

	getBoundingRadius: function () {

		var x = this.xMax - this.xMin;
		var y = this.yMax - this.yMin;
		var z = this.zMax - this.zMin;

		return Math.sqrt(x*x + y*y + z*z);
	}

};