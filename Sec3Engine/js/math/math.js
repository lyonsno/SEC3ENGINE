SEC3 = SEC3 || {};
SEC3.math = {};

/*
 * Rounds num up to the nearest power of 2
 */
SEC3.math.roundUpToPower = function(num, power) {

	var x = 1;

	while (x < num) {
		x *= power;
	}

	return x;
};

SEC3.math.randomRange = function(min, max) {

	return Math.random() * (max - min) + min;

}

SEC3.math.randomIntRange = function(min, max) {

    return Math.floor(Math.random() * (max - min + 1)) + min;

}