//Dependent on Chunker

SEC3 = SEC3 || {};

SEC3.ShaderCreator = {};

SEC3.ShaderCreator.buildShadowMapPrograms = function (gl, scene) {
   
    var prefixes = ["", 
                "const float NEAR = float(" + demo.zNear + "); \n" +
                "const float FAR = float(" + demo.zFar + "); \n"
                ];
    program = SEC3.createShaderProgram();
    program.loadShader( gl,
                                   "Sec3Engine/shader/buildShadowMap.vert",
                                  "Sec3Engine/shader/buildShadowMap.frag",
                                  prefixes );

    program.addCallback( function(){

        program.aVertexPosLoc = gl.getAttribLocation( program.ref(), "a_pos");
        program.aVertexNormalLoc = gl.getAttribLocation( program.ref(), "a_normal");
        program.aVertexTexcoordLoc = gl.getAttribLocation( program.ref(), "a_texcoord");
        program.uMLPLoc = gl.getUniformLocation( program.ref(), "u_mlp");
    });

    SEC3.registerAsyncObj( gl, program );

    return program;
}

/*
 * Returns a program to render with cascading shadows
 */
SEC3.ShaderCreator.renderCascShadowProg = function (gl, scene) {

	var vsString = SEC3.Chunker.renderCascadedShadowMapsVS(scene);
	var fsString = SEC3.Chunker.renderCascadedShadowMapsFS(scene);

	var shader = SEC3.createShaderProgram();
	shader.loadShaderFromStrings(gl, vsString, fsString);
    
    shader.addCallback( function(){
        //query the locations of shader parameters
        shader.aVertexPosLoc = gl.getAttribLocation( shader.ref(), "a_pos" );
        shader.aVertexNormalLoc = gl.getAttribLocation( shader.ref(), "a_normal" );
        shader.aVertexTexcoordLoc = gl.getAttribLocation( shader.ref(), "a_texcoord" );

        shader.uMVPLoc = gl.getUniformLocation( shader.ref(), "u_mvp" );
        shader.uSamplerLoc = gl.getUniformLocation( shader.ref(), "u_sampler");
        shader.uCPosLoc = gl.getUniformLocation( shader.ref(), "u_cPos" );      
        shader.uNumCascades = gl.getUniformLocation( shader.ref(), "u_numCascades" );
        
        shader.lights = [];
        gl.useProgram( shader.ref() );

        for(var i = 0; i < scene.getNumLights(); i++ ) {
            var thisLight = [];
            var light = scene.getLight(i);  
            thisLight.uModelLightLoc = gl.getUniformLocation( shader.ref(), "u_modelLight" + i );
            thisLight.uLPosLoc = gl.getUniformLocation( shader.ref(), "u_lPos" + i );
            thisLight.uMLPLoc = gl.getUniformLocation( shader.ref(), "u_mlp" + i );

            thisLight.uCascadeLocs = [];
            thisLight.uClipPlaneLocs = [];
            thisLight.uCascadeMatLocs = [];

            
            for(var j = 0; j < light.numCascades; j++ ){

                thisLight.uCascadeLocs[j] = gl.getUniformLocation( shader.ref(), "u_shadowMap" + i + "_" + j);
                thisLight.uClipPlaneLocs[j] = gl.getUniformLocation( shader.ref(), "u_clipPlane" + i + "_" + j);
                thisLight.uCascadeMatLocs[j] = gl.getUniformLocation( shader.ref(), "u_cascadeMat" + i + "_" + j);
                gl.uniform2f(thisLight.uClipPlaneLocs[j], 
                             light.cascadeClips[j][NEAR_PLANE], 
                             light.cascadeClips[j][FAR_PLANE] );
                gl.uniformMatrix4fv(thisLight.uCascadeMatLocs[j], false, light.cascadeMatrices[j] );
            }

            shader.lights.push(thisLight);
        }
    });

    SEC3.registerAsyncObj( gl, shader );

    

    return shader;
}