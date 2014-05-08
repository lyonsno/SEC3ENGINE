var SEC3 = SEC3 || {};

/*
 * Constructor
 */
SEC3.PerspProjector = function() {

	SEC3.Projector.call( this );
    this.fov = 0.0;
    this.aspect = 1.0;
    
    this.xMax; this.xMin;
    this.yMax, this.yMin;
    this.zMax, this.zMin;
};

SEC3.PerspProjector.prototype = Object.create( SEC3.Projector.prototype );

SEC3.PerspProjector.prototype.updatePerspective = function () {
    var persp = mat4.create();
    mat4.perspective( persp, this.fov, 
                  this.aspect, this.zNear, this.zFar );
    this.projectionMat = persp;
};

SEC3.PerspProjector.prototype.setFov = function (newFov) {
    this.fov = newFov * Math.PI / 180;
    this.updatePerspective();
};

SEC3.PerspProjector.prototype.setAspect = function (newAspect) {
    this.aspect = newAspect;
    this.updatePerspective();
};

SEC3.PerspProjector.prototype.setPerspective = function (newFov, newAspect, newNear, newFar) {
    this.fov = newFov * Math.PI / 180;
    this.aspect = newAspect;
    this.zNear = newNear;
    this.zFar = newFar;
    this.updatePerspective();
};

SEC3.PerspProjector.prototype.initBounds = function () {

    this.xMax = null; 
    this.xMin = null;
    this.yMax = null;
    this.yMin = null;
    this.zMax = null;
    this.zMin = null;
}

SEC3.PerspProjector.prototype.updateBounds = function ( vertex ) {
        
    this.xMax = this.xMax || vertex[0];
    this.xMax = Math.max( this.xMax, vertex[0] );

    this.xMin = this.xMin || vertex[0];
    this.xMin = Math.min( this.xMin, vertex[0] );

    this.yMax = this.yMax || vertex[1];
    this.yMax = Math.max( this.yMax, vertex[1] );

    this.yMin = this.yMin || vertex[1];
    this.yMin = Math.min( this.yMin, vertex[1] );

    this.zMax = this.zMax || vertex[2];
    this.zMax = Math.max( this.zMax, vertex[2] );

    this.zMin = this.zMin || vertex[2];
    this.zMin = Math.min( this.zMin, vertex[2] );

};

SEC3.PerspProjector.prototype.getBoundingRadius = function () {
    
    this.initBounds();

    var verts = this.getFrustumVerts();

    for( var i = 0; i < verts.length; i ++ ){
        this.updateBounds(verts[i]);
    }

    var x = this.xMax - this.xMin;
    var y = this.yMax - this.yMin;
    var z = this.zMax - this.zMin;

    return Math.sqrt(x*x + y*y + z*z);
};


SEC3.PerspProjector.prototype.getFrustumVerts = function () {

    // The height and width of the rectangular boundary on the near plane are defined as follows:
    var spanXNear = Math.tan(this.fov / 2) * this.zNear;
    var spanYNear = spanXNear * 1.0;
    spanXNear = vec4.fromValues( spanXNear, 0, 0, 0 );
    spanYNear = vec4.fromValues( 0, spanYNear, 0, 0 );

    // The same reasoning can be applied to the far plane:
    var spanXFar = Math.tan(this.fov / 2) * this.zFar;
    var spanYFar = spanXFar * 1.0;
    spanXFar = vec4.fromValues( spanXFar, 0, 0, 0 );
    spanYFar = vec4.fromValues( 0, spanYFar, 0, 0 );

    var nearCenter = vec4.fromValues(0, 0, this.zNear, 1);
    var farCenter = vec4.fromValues(0, 0, this.zFar, 1);

    var verts = [];

    var result = vec4.create();
    var negated = vec4.create();
    //---------Near plane verts

    vec4.add( result, spanXNear, spanYNear);
    vec4.add( result, result, nearCenter);
    vec4.transformMat4(result, result, this.matrix);
    verts.push(vec4.clone(result));

    vec4.negate(negated, spanYNear);
    vec4.add( result, spanXNear, negated);
    vec4.add( result, result, nearCenter);
    vec4.transformMat4(result, result, this.matrix);
    verts.push(vec4.clone(result));

    vec4.negate(negated, spanXNear);
    vec4.add( result, negated, spanYNear);
    vec4.add( result, result, nearCenter);
    vec4.transformMat4(result, result, this.matrix);
    verts.push(vec4.clone(result));

    vec4.add( result, spanXNear, spanYNear);
    vec4.negate(result, result);
    vec4.add( result, result, nearCenter);
    vec4.transformMat4(result, result, this.matrix);
    verts.push(vec4.clone(result));

    //---------Far plane verts

    vec4.add( result, spanXFar, spanYFar);
    vec4.add( result, result, farCenter);
    vec4.transformMat4(result, result, this.matrix);
    verts.push(vec4.clone(result));

    vec4.negate(negated, spanYFar);
    vec4.add( result, spanXFar, negated);
    vec4.add( result, result, farCenter);
    vec4.transformMat4(result, result, this.matrix);
    verts.push(vec4.clone(result));


    vec4.negate(negated, spanXFar);
    vec4.add( result, negated, spanYFar);
    vec4.add( result, result, farCenter);
    vec4.transformMat4(result, result, this.matrix);
    verts.push(vec4.clone(result));

    vec4.add( result, spanXFar, spanYFar);
    vec4.negate(result, result);
    vec4.add( result, result, farCenter);
    vec4.transformMat4(result, result, this.matrix);
    verts.push(vec4.clone(result));

    return verts;
};

// returns far plane verts in world space
SEC3.PerspProjector.prototype.getFarPlaneVerts = function () {

    var inverseMvp = mat4.create();
    var proj = mat4.clone(this.getProjectionMat());
    mat4.invert(proj, proj);
    var view = mat4.clone(this.getViewTransform());
    mat4.invert(view, view);
    mat4.multiply( inverseMvp, this.getProjectionMat(), this.getViewTransform() );
    mat4.invert(inverseMvp, inverseMvp);

    var upLeft = vec4.fromValues(-1, 1, 1, 1);
    var downLeft = vec4.fromValues(-1, -1, 1, 1);
    var downRight = vec4.fromValues(1, -1, 1, 1);
    var upRight = vec4.fromValues(1, 1, 1, 1);

    var vertices = [ upLeft, downLeft, downRight, upRight ];

    for (var i = 0; i < vertices.length; i++ ) {

        vec4.transformMat4(vertices[i], vertices[i], proj);
        vec4.transformMat4(vertices[i], vertices[i], view);           
        var scale = 1.0 / vertices[i][3];   
        vec4.scale( vertices[i], vertices[i], scale );   
        // vertices[i][2] = 1.0 * vertices[i][2];
    }
    return vertices;
}

// returns far plane verts in world space
SEC3.PerspProjector.prototype.getNearPlaneVerts = function () {

    var inverseMvp = mat4.create();
    var proj = mat4.clone(this.getProjectionMat());
    mat4.invert(proj, proj);
    var view = mat4.clone(this.getViewTransform());
    mat4.invert(view, view);
    mat4.multiply( inverseMvp, this.getProjectionMat(), this.getViewTransform() );
    mat4.invert(inverseMvp, inverseMvp);

    var upLeft = vec4.fromValues(-1, 1, -1, 1);
    var downLeft = vec4.fromValues(-1, -1, -1, 1);
    var downRight = vec4.fromValues(1, -1, -1, 1);
    var upRight = vec4.fromValues(1, 1, -1, 1);

    var vertices = [ upLeft, downLeft, downRight, upRight ];

    for (var i = 0; i < vertices.length; i++ ) {

        vec4.transformMat4(vertices[i], vertices[i], proj);
        vec4.transformMat4(vertices[i], vertices[i], view);           
        var scale = 1.0 / vertices[i][3];   
        vec4.scale( vertices[i], vertices[i], scale );
        vertices[i][2] = -1.0 * vertices[i][2];     
    }
    return vertices;
}


SEC3.PerspProjector.prototype.getEyeRays = function () {

    var farVertices = this.getFarPlaneVerts();
    // var nearVertices = this.getNearPlaneVerts();
    var components = [];

    for( var i = 0; i < 4; i++ ) {
        for( var j = 0; j < 3; j++ ) {
    
            components.push(farVertices[i][j]);
        }
    }
    return components;
};

/*
 * Returns bounds of frustum in array: { xMin, yMin, zMin, xMax, yMax, zMax}
 */ 
SEC3.PerspProjector.prototype.getFrustumBounds = function () {

    var xMin = Number.MAX_VALUE;
    var yMin = Number.MAX_VALUE;
    var zMin = Number.MAX_VALUE;
    var xMax = -1 * Number.MAX_VALUE;
    var yMax = -1 * Number.MAX_VALUE;
    var zMax = -1 * Number.MAX_VALUE;

    var verts = this.getFrustumVerts();
    var numVerts = verts.length;

    for (var i = 0; i < numVerts; i++) {

        xMin = Math.min(verts[i][0], xMin);
        yMin = Math.min(verts[i][1], yMin);
        zMin = Math.min(verts[i][2], zMin);            
        xMax = Math.max(verts[i][0], xMax);
        yMax = Math.max(verts[i][1], yMax);
        zMax = Math.max(verts[i][2], zMax);      
    }
    return [ xMin, yMin, zMin, xMax, yMax, zMax ];
};

