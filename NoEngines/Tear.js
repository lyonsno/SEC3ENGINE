var TearObj = [];

(function(){

//--------------------------------------------------CONSTANTS/FIELDS:

	var MAX_TEAR_ROTATION = 0.05;

//------------------------------------------------------CONSTRUCTORS:

	function Tear(pos){
	
		this.position = pos;
		this.rotation = 0;
		this.speed = Math.random() + 0.3;
	}
	
//-----------------------------------------------------------METHODS:

	Tear.prototype = {

		update : function(){

			this.rotation += Math.random() * MAX_TEAR_ROTATION;
			this.position[1] -= (0.002 * this.speed);

			if (this.position[1] < -2) { this.position[1] = 1.5; }

		}
	}
	TearObj = Tear;
})();