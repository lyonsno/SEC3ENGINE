var SEC3ENGINE = SEC3ENGINE || {};

SEC3ENGINE.ParticleInteractor = function(canvas){
    var canvas = canvas;
    var rect = canvas.getBoundingClientRect();
    var x = 0;
    var y = 0;
    var attractor = [0.0,0.0,0.0]; // x y and an on/off bit
    var newObj={}; 
    
    var onMouseUp = function(ev){
        attractor[2] = 0.0;
    };
    var onMouseDown = function(ev){
        attractor[2] = 1.0;
    };

    var onMouseMove = function(ev){
        x = ev.clientX - rect.left;
        y = ev.clientY - rect.top;
        x /= gl.viewportWidth;
        y /= gl.viewportHeight;

        x -= 0.5;
        y -= 0.5;

        x *= 12.0;
        y *= -12.0;
        attractor[0] = x;
        attractor[1] = y;
    };

    var update = function(){
           
        canvas.onmousedown = function(ev) {
            onMouseDown(ev);
        }

        canvas.onmouseup = function(ev) {
            onMouseUp(ev);
        }
        
        canvas.onmousemove = function(ev) {
            onMouseMove(ev);
        }
        
    };

    update();

    newObj.onMouseUp = onMouseUp;
    newObj.onMouseDown = onMouseDown;
    newObj.onMouseMove = onMouseMove;
    newObj.update = update;
    newObj.attractor = attractor;
    return newObj;
};
