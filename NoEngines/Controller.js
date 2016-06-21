//-----------------------------------------------------------GLOBALS:

var modelInstance = {};

//---------------------------------------------------------FUNCTIONS:

function runGame(){
	//create new game
	modelInstance = new GameModel();
	//init window
	webGLStart(modelInstance);
	//set game looping	
	setInterval("modelInstance.step(modelInstance)", 16);
}

window.onkeydown = function(e) {

	var key = e.keyCode ? e.keyCode : e.which;

	modelInstance.moveThelma(key);
}