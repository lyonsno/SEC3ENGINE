var UI = {};

(function() {

//-------------------------------------------------------CONSTANTS/FIELDS:

//FIELDS:
	//Array of sliders, rates of incrementing
	var uiDiv;
	var numElements;

//-----------------------------------------------------------CONSTRUCTORS:

	/*
	 * Constructor
	 * String divName
	 */
	function ui(divID) {

		uiDiv = document.getElementById(divID);
		numElements = 0;
		if (uiDiv) {
			uiDiv.style.boxSizing = "border-box";
		}
		// Init fields?
	}

//----------------------------------------------------------------METHODS:

	ui.prototype = {

		/*
		 * Strings: dib, value, 
		 */
		addElement : function() {
			// create new div within button/slider div
		},


		addScrollCallback : function(callback) {
			
			// code written by Vitim.us via stackoverflow
			window.onscroll = function(e) {
				var scrollX = (this.x || window.pageXOffset) - window.pageXOffset;
				var scrollY = (this.y || window.pageYOffset) - window.pageYOffset;

				this.x = window.pageXOffset;
				this.y = window.pageYOffset;
				callback(scrollX, scrollY);
			};

		},
		/*
		 * String label - To be displayed
		 * function onEvent - function to be executed upon slide
		 */

		addButton : function(label, onEvent) {
			var newDiv = document.createElement("div");
			newDiv.style.marginBottom = "8px";

			var newButton = document.createElement("input");

			newButton.type = "button";
			newButton.id = label;
			newButton.value = label;
			newButton.style.width = "100%";

			newDiv.appendChild(newButton);
			uiDiv.appendChild(newDiv);
			newButton.onclick = onEvent;
		},


		/*
		 * Adds sliders to HTML DOM
		 *
		 */ 
		// Called by the init() function of any o
		// Appends HTML slider elements to DOM

		addSlider : function(label, onEvent, value, min, max, step) {

			var newDiv = document.createElement("div");
			newDiv.style.display = "flex";
			newDiv.style.flexDirection = "column";
			newDiv.style.gap = "4px";
			newDiv.style.marginBottom = "10px";

			var newSlider = document.createElement("input");

			newSlider.type = "range";
			newSlider.id = label;
			newSlider.min = min;
			newSlider.max = max;
			newSlider.step = step;
			newSlider.value = value;
			newSlider.style.width = "100%";
			newSlider.style.margin = "0";

			newDiv.appendChild(newSlider);

			var newLabel = document.createElement("label");
			newLabel.innerText = label + "";
			newLabel.style.display = "block";
			newLabel.style.whiteSpace = "normal";
			newLabel.style.wordBreak = "break-word";
			newLabel.style.lineHeight = "1.2";
			newDiv.appendChild(newLabel);

			uiDiv.appendChild(newDiv);
			this.addCallback(newSlider, onEvent);
		},

		addCallback : function(button, callbackFunction) {			
			button.addEventListener("input", function(e){
				
					var newText = callbackFunction(e);

					if (newText != null) {
						button.nextSibling.innerText = newText;
					}
				});
		}
	}
	UI = ui;

})();
