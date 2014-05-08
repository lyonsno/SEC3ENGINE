
/**
* Camera Interactor
*
* This object listens for mouse and keyboard events on the canvas, then, it interprets them and sends the intended instruction to the camera
*
* Based on the code sample from WebGL Beginner's Guide.
*/
var SEC3 = SEC3 || {};


SEC3.CameraInteractor = function(camera,canvas){
    
    this.camera = camera;
    this.canvas = canvas;
  
    
    this.dragging = false;
    this.x = 0;
    this.y = 0;
    this.lastX = 0;
    this.lastY = 0;
    this.button = 0;
    this.ctrl = false;
    this.alt = true;
    this.key = 0;
    
    this.MOTION_FACTOR = 10.0;

	this.onMouseUp = function(ev){
	    this.dragging = false;
	};

	this. onMouseDown = function(ev){
	    this.dragging = true;
	    this.x = ev.clientX;
		this.y = ev.clientY;
		this.button = ev.button;
		this.alt = ev.altKey;
	};

	this.onMouseMove = function(ev){
		this.lastX = this.x;
		this.lastY = this.y;
		this.x = ev.clientX;
	    this.y = ev.clientY;
		this.alt = ev.altKey;
		
		if (! this.dragging) return;
		this.ctrl = ev.ctrlKey;
		var dx = this.x - this.lastX;
		var dy = this.y - this.lastY;
		



		if (this.button == 0 && this.alt == false ) { 
			moveSphere( interactor.x * 0.5, interactor.y * 0.5 );
		}
		else {
				this.rotate(dx,dy);
		}
	};

	this.onKeyDown = function(ev){
		
		this.key = ev.keyCode;
		this.ctrl = ev.ctrlKey;
		
		if (!this.ctrl){
			if (this.key == 38){
				this.camera.changeElevation(10);
			}
			else if (this.key == 40){
				this.camera.changeElevation(-10);
			}
			else if (this.key == 37){
				this.camera.changeAzimuth(-10);
			}
			else if (this.key == 39){
				this.camera.changeAzimuth(10);
			}
			else if( this.key == 87 ){
				this.camera.moveForward();
			}
			else if( this.key == 65){
				this.camera.moveLeft();
			}
			else if( this.key == 83 ){
				this.camera.moveBackward();
			}
			else if( this.key == 68 ){
				this.camera.moveRight();
			}
			else if( this.key == 82 ){
				this.camera.moveUp();
			}
			else if( this.key == 70 ){
				this.camera.moveDown();
			}
	
		}
	     
	};

	this.onKeyUp = function(ev){
	    if (ev.keyCode == 17){
			this.ctrl = false;
		}
	};

	this.update = function(self){
	   

		canvas.onmousedown = function(ev) {
			self.onMouseDown(ev);
	    }

	    window.onmouseup = function(ev) {
			self.onMouseUp(ev);
	    }
		
		window.onmousemove = function(ev) {
			self.onMouseMove(ev);
	    }
		
		window.onkeydown = function(ev){
			self.onKeyDown(ev);
			
		}
		
		window.onkeyup = function(ev){
			self.onKeyUp(ev);
		}
	};

	this.translate = function(value){
		
		var c = this.camera;
		var dv = 2 * this.MOTION_FACTOR * value / this.canvas.height;
		
		c.dolly(Math.pow(1.1,dv));
	};

	this.rotate = function(dx, dy){
		
		
		var delta_elevation = -20.0 / this.canvas.height;
		var delta_azimuth   = -20.0 / this.canvas.width;
					
		var nAzimuth = dx * delta_azimuth * this.MOTION_FACTOR;
		var nElevation = dy * delta_elevation * this.MOTION_FACTOR;
		
		this.camera.changeAzimuth(nAzimuth);
		this.camera.changeElevation(nElevation);
	};

   this.update(this);

};