// Get the libraraies we need for glMatrix
const { mat4, vec3 } = glMatrix;

// Setup the canvas as global
const canvas= document.getElementById("level0Canvas");
const gl = canvas.getContext("webgl");
const numComponents = 3;

// Vertex Shader (GLSL)
// "Its job is to transform the input vertex from its original coordinate system into the clip space"
const vsSource = `
    attribute vec4 aVertexPosition;
    attribute vec4 aVertexColor;
    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;

    varying lowp vec4 vColor;

    void main() {
      gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
      // We also need to get the color information with the veretx
      vColor = aVertexColor;
    }`;
// "return the transformed vertex by saving it in a special variable provided by GLSL, called gl_Position."

// Fragment Shader 
// "called once for every pixel on each shape to be drawn, after the shape's vertices have been processed by the vertex shader."
const fsSource = `
    // This is a color that was coming from the vertex shader. 
    varying lowp vec4 vColor;

    void main() {
        gl_FragColor = vColor;
    }`;
// "The color is then returned to the WebGL layer by storing it in the special variable gl_FragColor. That color is then drawn to the screen"


function initShaderProgram(vsSource, fsSource) {
  const vertexShader = loadShader(gl.VERTEX_SHADER, vsSource);
  const fragmentShader = loadShader(gl.FRAGMENT_SHADER, fsSource);

  // Create the shader program
  const shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  // If creating the shader program failed, alert
  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert(`Unable to initialize the shader program: ${gl.getProgramInfoLog(  shaderProgram,)}`,);
    return null;
  }

  // If it did not fail, give us a shader program to use
  return shaderProgram;
}

function loadShader(type, source) {
  const shader = gl.createShader(type);

  // Send the source to the shader object
  gl.shaderSource(shader, source);

  // Compile the shader program
  gl.compileShader(shader);

  // Make sure it compiled successfully
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert( `An error occurred compiling the shaders: ${gl.getShaderInfoLog(shader)}`, );
    gl.deleteShader(shader);
    return null;
  }

  // Return the successfully compiled shader (Vertex or fragment)
  return shader;
}

function initBuffers() {

    const positionBuffer = initPositionBuffer();
    const fourVertexColorBuffer = initColorBuffer();
    const indexBuffer = initIndexBuffer();

    return { 
        position: positionBuffer, 
        color: fourVertexColorBuffer,
        indices: indexBuffer,
    };
}

function initPositionBuffer() {
  // Create a buffer for the square's positions.
  const positionBuffer = gl.createBuffer();

  // Select the positionBuffer as the one to apply buffer
  // operations to from here out.
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  // Now create an array of positions for the square.
  const positions = [
        // Front face
        -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0, 1.0, 1.0, -1.0, 1.0, 1.0,
        // Back face
        -1.0, -1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0, -1.0, -1.0,
        // Top face
        -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0,
        // Bottom face
        -1.0, -1.0, -1.0, 1.0, -1.0, -1.0, 1.0, -1.0, 1.0, -1.0, -1.0, 1.0,
        // Right face
        1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0, 1.0, 1.0, -1.0, 1.0,
        // Left face
        -1.0, -1.0, -1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0, -1.0,
    ];

  // Now pass the list of positions into WebGL to build the shape.
  // We do this by creating a Float32Array from the
  /// This is being filled by an JS float array of the positions we defined.
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  return positionBuffer;
}

function drawScene(programInfo, buffers, cubeRotation){
    // gl.clearColor(1.0, 1.0, 1.0, 1.0) // I like a white bkg
    gl.clearColor(0.0, 0.0, 0.0, 1.0) // black Bkg
    gl.clearDepth(1.0); // Clear everything
    gl.enable(gl.DEPTH_TEST); // Enable depth testing
    gl.depthFunc(gl.LEQUAL); // Near things obscure far things

    // This is allowing me to have transparency
    gl.enable(gl.BLEND);
    // gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.disable(gl.DEPTH_TEST);

    // Clear the canvas before we start drawing on it.

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Create a perspective matrix, a special matrix that is
    // used to simulate the distortion of perspective in a camera.
    // Our field of view is 45 degrees, with a width/height
    // ratio that matches the display size of the canvas
    // and we only want to see objects between 0.1 units
    // and 100 units away from the camera.

    const fieldOfView = (45 * Math.PI) / 180; // in radians
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const zNear = 0.1;
    const zFar = 100.0;
    const projectionMatrix = mat4.create();

    // note: glMatrix always has the first argument
    // as the destination to receive the result.
    mat4.perspective(projectionMatrix, fieldOfView, aspect, zNear, zFar);

    // Set the drawing position to the "identity" point, which is
    // the center of the scene.
    const modelViewMatrix = mat4.create();

    // Now move the drawing position a bit to where we want to
    // start drawing the square.
    mat4.translate(
        modelViewMatrix, // destination matrix
        modelViewMatrix, // matrix to translate
        [-0.0, 0.0, -6.0],
    ); // amount to translate

    mat4.rotate(
        modelViewMatrix, // destination matrix
        modelViewMatrix, // matrix to translate
        cubeRotation,
        [1.0, 0.0, 0.0],
    );
    mat4.rotate(
        modelViewMatrix, // destination matrix
        modelViewMatrix, // matrix to translate
        cubeRotation,
        [0.0, 1.0, 0.0],
    );
    mat4.rotate(
        modelViewMatrix, // destination matrix
        modelViewMatrix, // matrix to translate
        cubeRotation,
        [0.0, 0.0, 1.0],
    );

    // Tell WebGL how to pull out the positions from the position
    // buffer into the vertexPosition attribute.
    setPositionAttribute(buffers, programInfo);

    // On top of setting position attribute, set a color attribute
    setColorAttribute(gl, buffers, programInfo);

    // Tell WebGL which indices to use to index the vertices
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);

    // Tell WebGL to use our program when drawing
    gl.useProgram(programInfo.program);

    // Set the shader uniforms
    gl.uniformMatrix4fv(
    programInfo.uniformLocations.projectionMatrix,
        false,
        projectionMatrix,
    );
    gl.uniformMatrix4fv(
        programInfo.uniformLocations.modelViewMatrix,
        false,
        modelViewMatrix,
    );

    // Not sure why this needs to be a block, but I think this actually draws the stuff
    {
        const vertexCount = 36; // 6 faces * 2 tris * 3 verticies
        const type = gl.UNSIGNED_SHORT;
        const offset = 0;
        gl.drawElements(gl.TRIANGLES, vertexCount, type, offset);
    }
}

function setPositionAttribute(buffers, programInfo) {
    const type = gl.FLOAT; // the data in the buffer is 32bit floats
    const normalize = false; // don't normalize
    const stride = 0; // how many bytes to get from one set of values to the next
    // 0 = use type and numComponents above
    const offset = 0; // how many bytes inside the buffer to start from
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
    gl.vertexAttribPointer(
        programInfo.attribLocations.vertexPosition,
        numComponents,
        type,
        normalize,
        stride,
        offset,
    );
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);
}

// Tell WebGL how to pull out the colors from the color buffer
// into the vertexColor attribute.
function setColorAttribute(gl, buffers, programInfo) {
    const numComponents = 4;
    const type = gl.FLOAT;
    const normalize = false;
    const stride = 0;
    const offset = 0;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.color);
    gl.vertexAttribPointer(
        programInfo.attribLocations.vertexColor,
        numComponents,
        type,
        normalize,
        stride,
        offset,
    );
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexColor);
}

function initColorBuffer() {
    // I decided to make this look like a CMYK cube
    const opaque = 1.0;
    const translucent = 0.5;

    const faceColors = [
        [0.0, 1.0, 1.0, translucent], // Front face: Cyan
        [0.0, 1.0, 1.0, translucent], // Back face: Cyan
        [1.0, 0.0, 1.0, translucent], // Top face: Magenta
        [1.0, 0.0, 1.0, translucent], // Bottom face: Magenta
        [1.0, 1.0, 0.0, translucent], // Right face: Yellow
        [1.0, 1.0, 0.0, translucent], // Left face: Yellow
    ];
    
    // After defining the colors to apply to the shader for each vertex in a nice way
    // We are going to put them all in one array
    let colors = [];

    for (const c of faceColors) {
        // Repeat each color four times for the four vertices of the face
        colors = colors.concat(c, c, c, c);
    }

    const colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);

    return colorBuffer;
}

function initIndexBuffer() {
    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

    // This array defines each face as two triangles, using the
    // indices into the vertex array to specify each triangle's
    // position.

    // prettier-ignore
    const indices = [
        0,  1,  2,      0,  2,  3,    // front
        4,  5,  6,      4,  6,  7,    // back
        8,  9,  10,     8,  10, 11,   // top
        12, 13, 14,     12, 14, 15,   // bottom
        16, 17, 18,     16, 18, 19,   // right
        20, 21, 22,     20, 22, 23,   // left
    ];

    // Now send the element array to GL

    gl.bufferData(
        gl.ELEMENT_ARRAY_BUFFER,
        new Uint16Array(indices),
        gl.STATIC_DRAW,
    );

    return indexBuffer;
}

function main(){
    console.log("Hello from level0.js");
    
    if (!gl) {
        alert( "Unable to initialize WebGL. Your browser or machine may not support it." );
        return;
    }

    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);

    // Web GL base tutorial (init webgl Canvas)
    // gl.clearColor(1.0, 1.0, 1.0, 1.0) // I like a white bkg
    gl.clearColor(0.0, 0.0, 0.0, 1.0) // black Bkg
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    // Setup positions for each of the cubes verticies
    const shaderProgram = initShaderProgram(vsSource, fsSource);
    
    // Collect all the info needed to use the shader program.
    // Look up which attribute our shader program is using
    // for aVertexPosition and look up uniform locations.
    const programInfo = {
        program: shaderProgram,
        attribLocations: {
            vertexPosition: gl.getAttribLocation(shaderProgram, "aVertexPosition"),
            vertexColor: gl.getAttribLocation(shaderProgram, "aVertexColor"),
        },
        uniformLocations: {
            projectionMatrix: gl.getUniformLocation(shaderProgram, "uProjectionMatrix"),
            modelViewMatrix: gl.getUniformLocation(shaderProgram, "uModelViewMatrix"),
        },
    };

    const buffers = initBuffers();

    let cubeRotation = 0.0;
    let deltaTime = 0;
    let then = 0;

    // Draw the scene repeatedly
    function render(now) {
        // Figure out time change
        now *= 0.001; // convert to seconds
        deltaTime = now - then;
        then = now;

        // I want one full rotation in 2 seconds (pi degrees per second)

        drawScene(programInfo, buffers, cubeRotation);
        cubeRotation += deltaTime;

        requestAnimationFrame(render);
    }
    
    requestAnimationFrame(render);
}

main();