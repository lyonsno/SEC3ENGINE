var SEC3 = SEC3 || {};

	

(function(){
	function geometry(){

	}

	geometry.prototype = {
	}
SEC3.geometry = geometry;
	
})();
(function() {
	function fullScreenQuad(){
		SEC3.geometry.apply(this);
			return [ -1.0, 1.0,
					 1.0, 1.0,
					 1.0, -1.0,
					 -1.0, -1.0,
					 1.0, -1.0,
					 -1.0, 1.0 ];

		}
		
SEC3.geometry.fullScreenQuad = fullScreenQuad;
})();