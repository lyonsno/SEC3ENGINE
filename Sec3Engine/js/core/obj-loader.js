//A loader for loading OBJ models
// Use the loaders in Three.js: http://threejs.org/

//SEC3 is a core function interface
var SEC3 = SEC3 || {};
                            // Scene
SEC3.createOBJLoader = function( s ){
    "use strict"

    var ready = false;
    var content;
    var callbackFunArray = [];

    var vertexGroup = [];
    var normalGroup = [];
    var texcoordGroup = [];
    var indexGroup = [];

    var scene = s;

    var textures = [];

    function initTexture( gl, url, index ){
        textures[index] = gl.createTexture();

        textures[index].image = new Image();
        textures[index].image.onload = function(){
            loadTexture( gl, textures[index] );
        }

        textures[index].image.src = url;
        textures[index].ready = false;
    }
    // var anisotropyExt = gl.getExtension("WEBKIT_EXT_texture_filter_anisotropic");
    // if(! anisotropyExt ) {
    //     alert("no Anisotropy support!");
    // }

    function loadTexture( gl, texture) {
        gl.bindTexture(gl.TEXTURE_2D, texture);
    
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.map.image);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        // if( anisotropyExt ) {
        //     gl.texParameterf(gl.TEXTURE_2D, anisotropyExt.TEXTURE_MAX_ANISOTROPY_EXT, 4);
        // }
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.bindTexture(gl.TEXTURE_2D, null);
        texture.ready = true;
    }


    function load( gl, filename, mtl ){
    	var loader;

        var eventlistener = function(object){
            
    		content = object;
    		// console.log(filename);
            // console.log("children count: " + object.children.length );
    		//Start parse vertices, normals, indices, and texcoords
    		content.traverse( function(child){
    			if( child instanceof THREE.Mesh ){

    				var numVertices = child.geometry.vertices.length;
    				var numFaces = child.geometry.faces.length;
    				var numTexcoords = child.geometry.faceVertexUvs[0].length;
                    var meshVertexArray = []; //vertex data
                    var meshNormalArray = [];
                    var meshIndexArray = [];
                    var meshTexcoordArray = [];
                    var point = 0;

                    // console.log("start traverse OBJ");
    				if( numFaces != 0 ){
                        var texCount = textures.length;
    					if( child.material.map !== null ){
                            
                            textures[texCount] = gl.createTexture();
                            textures[texCount].map = child.material.map;

                            textures[texCount].ready = false;                             
    					}
    					else{
                            textures[texCount] = null;
    					}
                        
                        //Extract vertices info
    					for( var i = 0; i < numVertices;i++ ){
    						meshVertexArray.push( child.geometry.vertices[i].x );
    						meshVertexArray.push( child.geometry.vertices[i].y );
    						meshVertexArray.push( child.geometry.vertices[i].z );

                            scene.updateBounds( child.geometry.vertices[i] );
                            
    					}
                        
                        //Array of texture coordinates of 1st layer texture 
                        var UVs = child.geometry.faceVertexUvs[0]; 

    					//Extract faces info (UVs, normals, indices)
    					for( var i = 0; i < numFaces;i++ ){

    						//Extract vertices info per face

    						meshIndexArray.push( child.geometry.faces[i].a );
    						meshIndexArray.push( child.geometry.faces[i].b );
    						meshIndexArray.push( child.geometry.faces[i].c ); 
                     
                            var offset = 3*child.geometry.faces[i].a;
    						meshNormalArray[ offset ] = child.geometry.faces[i].normal.x;
    						meshNormalArray[ offset+1 ] = child.geometry.faces[i].normal.y;
    						meshNormalArray[ offset+2 ] = child.geometry.faces[i].normal.z;
                            
                            offset = 3*child.geometry.faces[i].b; 
    						meshNormalArray[ offset ] = child.geometry.faces[i].normal.x;
    						meshNormalArray[ offset+1 ] = child.geometry.faces[i].normal.y;
    						meshNormalArray[ offset+2 ] = child.geometry.faces[i].normal.z;
    						
                            offset = 3*child.geometry.faces[i].c; 
    						meshNormalArray[ offset ] = child.geometry.faces[i].normal.x;
    						meshNormalArray[ offset+1 ] = child.geometry.faces[i].normal.y;
    						meshNormalArray[ offset+2 ] = child.geometry.faces[i].normal.z;


                            var uv = UVs[i];
                            offset = 2*child.geometry.faces[i].a;
                            meshTexcoordArray[ offset ]   = uv[0].x;
                            meshTexcoordArray[ offset+1 ] = 1.0 - uv[0].y;

                            offset = 2*child.geometry.faces[i].b;
                            meshTexcoordArray[ offset ]   = uv[1].x;
                            meshTexcoordArray[ offset+1 ] = 1.0 - uv[1].y;

                            offset = 2*child.geometry.faces[i].c;
                            meshTexcoordArray[ offset ]   = uv[2].x;
                            meshTexcoordArray[ offset+1 ] = 1.0 - uv[2].y;

    					}
                        // console.log( 'num of faces '+numFaces);

                        vertexGroup.push( meshVertexArray );
                        normalGroup.push( meshNormalArray );
                        texcoordGroup.push( meshTexcoordArray );
                        indexGroup.push( meshIndexArray );
    				}
    			}
    		});
            //Indicate the loading is completed
    		ready = true;
    	};

        if( mtl === null ){
            loader = new THREE.OBJLoader();
            loader.load( filename, eventlistener );
        }
        else{
            loader = new THREE.OBJMTLLoader();
            loader.load(filename,mtl,eventlistener);
        }

    }

    return {
        ref: function(){
        	return content;
        },
        loadFromFile: function( gl, name,mtl){
        	load( gl,name,mtl );
        },
        numGroups: function(){
            return vertexGroup.length;
        },
        vertices: function(i){
        	return vertexGroup[i];
        },
        normals: function(i){
        	return normalGroup[i];
        },
        indices: function(i){
        	return indexGroup[i];
        },
        texcoords: function(i){
        	return texcoordGroup[i];
        },
        numTextures: function(){
            return textures.length;
        },
        texture: function(i){
            return textures[i];
        },
        ///// The following 3 functions should be implemented for all objects
        ///// whose resources are retrieved asynchronously
        isReady: function(){
        	var isReady = ready;
            for( var i = 0; i < textures.length; ++i ){
                if( textures[i] !== null && !textures[i].ready ){

                    if( textures[i].map.image.src.length > 0){
                        // console.log( textures[i].map.image.src );
                        loadTexture( gl, textures[i] );
                        isReady &= textures[i].ready;
                    }
                }
                
                //console.log( textures[i].map.image.src );
            }

            // console.log( isReady );
            return isReady;
        },
        addCallback: function( functor ){
            callbackFunArray[callbackFunArray.length] = functor;
        },
        executeCallBackFunc: function(){
            var i;
            for( i = 0; i < callbackFunArray.length; ++i ){
                callbackFunArray[i]();
            }
        }       
    };

};