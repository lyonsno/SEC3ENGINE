var GameModel; //will be assigned constructor

(function(){
//-------------------------------------------------------CONSTANTS/FIELDS:
	
	var MAX_TEARS = 2000;
	var CHEW_DURATION = 4;

//-----------------------------------------------------------CONSTRUCTORS:

	function Model() {

		this.self = this;
	  	this.score = 0;
		this.tears = [];
		this.numTears = 0;
		this.tearDimension = vec3.fromValues(0.026,0.026,0.026);
		this.eatTimer = 0;
		this.thelma = new ThelmaObj();
		this.thelmaDimension = vec3.fromValues(0.18,0.18,0.18);
		this.gameOver = false;

	}

//----------------------------------------------------------------METHODS:

	Model.prototype = {

		checkForCollisions : function(){

			var i;
			for(i = 0; i < this.numTears; i++){
				var curTear = this.tears[i];
				var dist = vec3.distance(curTear.position,this.thelma.position);
				if ( dist < (this.thelmaDimension[0] * 0.7)){
					this.removeTear(i);
					this.thelma.framesToChew = CHEW_DURATION;
				}   
			}
		},

		createTear : function(){
			var randomPositionX =  -1 + (Math.random() * 2);
			var randomPositionY =  -1 + (Math.random() * 2);
			this.tears.push(new TearObj(vec3.fromValues(randomPositionX,
										 randomPositionY,
										 0)));
			this.numTears++;
		},

		createTears : function(){
			if(this.numTears < MAX_TEARS) {
				if(Math.random() > 0.1) {
					this.createTear();
				}
			}
		},

		moveThelma : function(key){
			this.thelma.move(key);
		},

		moveTears : function() {
			var i;
			for(i = 0; i < this.numTears; i++){

				this.tears[i].update();
			}
		},

		removeTear : function(index){

			this.numTears--;
			this.tears.splice(index,1);
		},

		step : function(self){
			
			this.moveTears();
			this.checkForCollisions();
			this.thelma.framesToChew--;
	 		this.createTears();
			drawScene(self);  
		}
	}
	GameModel = Model;
})();

