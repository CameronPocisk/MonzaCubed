import {getFinalArrFromAssets} from './ColorAndHeightImageToArr.js'
import {loadObjModel, textureFromImage, FLOATS_PER_VERTEX} from './ObjModel.js'

// =====================================================================
//  LEVEL 4 FUN - a race simulator built WITH AI ASSISTANCE (Claude) on
//  top of our Level 4 code. The new code
//  is at the bottom of this file, after the Level 4 code it builds on.
// =====================================================================

// Level 4 = everything from Level 3 (landscape, Bezier track, race, blimp,
// TV helicopters) + Cameron's skybox from the original level4.js.

// Skybox assets
const up    = './assets/SunnyCloudSkybox/clouds1_up.bmp';
const down  = './assets/SunnyCloudSkybox/clouds1_down.bmp';
const north = './assets/SunnyCloudSkybox/clouds1_north.bmp';
const east  = './assets/SunnyCloudSkybox/clouds1_east.bmp';
const south = './assets/SunnyCloudSkybox/clouds1_south.bmp';
const west  = './assets/SunnyCloudSkybox/clouds1_west.bmp';

// =====================================================================
//  A grid of cubes with random colors and random heights, in WebGL
// =====================================================================
//
// THE BIG PICTURE
// ---------------
// WebGL can only draw points, lines and triangles. To draw a cube we
// describe it as 12 triangles (2 per face × 6 faces), hand those
// triangles to the GPU, and then ask the GPU to draw that cube once for
// every cube in our list, each time with a different position, height
// and color.
//
// Every frame of WebGL drawing follows the same basic steps:
//
//   1. SHADERS  - small programs that run on the GPU. The *vertex shader*
//                 decides where each corner (vertex) of a triangle lands
//                 on the screen. The *fragment shader* decides the color
//                 of each pixel inside the triangle.
//   2. BUFFERS  - we copy our vertex data (the corners of the cube) into
//                 GPU memory once, at startup.
//   3. UNIFORMS - values that stay the same for a whole draw call, like
//                 "this cube is red" or "this cube is 3 units tall".
//                 We change them before drawing each cube.
//   4. DRAW     - we tell the GPU "draw 36 vertices as triangles".
//
// The sections below follow that same order.


// ---------------------------------------------------------------------
// 0. Get a WebGL "context" from the <canvas> element in index.html.
//    The context (gl) is the object we use to issue every WebGL command.
// ---------------------------------------------------------------------
const canvas = document.getElementById('level4funCanvas');
const gl = canvas.getContext('webgl');


// ---------------------------------------------------------------------
// 1. SHADERS
//    Shaders are written in GLSL, a C-like language. We store the source
//    code in JavaScript strings, then compile them for the GPU.
//
//    Three kinds of shader variables:
//      attribute - a different value for every vertex (e.g. its position)
//      uniform   - one value shared by every vertex in a draw call
//      varying   - passed from the vertex shader to the fragment shader
// ---------------------------------------------------------------------

const vertexShaderSource = /* glsl */`
  attribute vec3 aPosition;   // corner position of the cube (model space)
  attribute vec3 aNormal;     // direction the face is pointing

  uniform mat4 uModel;        // moves/scales THIS cube into the world
  uniform mat4 uView;         // where the camera is and where it looks
  uniform mat4 uProjection;   // perspective: far things look smaller

  varying vec3 vNormal;       // handed to the fragment shader
  varying float vDistance;   // how far this vertex is from the camera
  // The varying output gets Barycentriced by the fragment shader
  // So the varying values get Interpolated into one value from
  // The 3 verticies

  void main() {
    // Turn the normal the same way the cube is turned. Our cubes are only
    // stretched and moved, never rotated, so this changes nothing here.
    // It would matter if you added rotation.
    vNormal = normalize(mat3(uModel) * aNormal);

    // model -> world -> camera -> screen.
    // Read right to left: first place the cube in the world (uModel),
    // then view it from the camera (uView), then apply perspective (uProjection).
    vec4 cameraSpace = uView * uModel * vec4(aPosition, 1.0);   // the point as seen from the camera
    vDistance = length(cameraSpace.xyz);                        // camera is at (0,0,0) here
    gl_Position = uProjection * cameraSpace;
  }
`;

const fragmentShaderSource = /* glsl */`
  precision mediump float;    // how accurate decimal numbers are (medium is plenty)

  uniform vec3 uColor;        // this cube's color (red, green, blue: 0..1)
  varying vec3 vNormal;       // received from the vertex shader

  varying float vDistance; // how far this pixel is from the camera (in world units)
  uniform vec3 uFogColor; // the color of the fog (red, green, blue: 0..1)
  uniform float uFogDensity; // how thick the fog is (0 = none, 1 = very thick)
  uniform vec3 uLightDirection;   // where the sun is (set from the Sun slider)
  uniform vec3 uLightColor;       // sun color: orange when low, white at noon

  void main() {
    // This runs once for EVERY PIXEL inside each triangle. The GPU blends
    // vNormal between the triangle's three corners, so each pixel gets
    // its own value. On a flat cube face all corners share the same
    // normal, so every pixel on that face gets the same one.

    // Simple lighting so we can tell the faces of a cube apart.
    // The light shines from above and slightly to the side.
    

    // dot() measures how closely two directions line up:
    //   1 = the face points straight at the light (brightest)
    //   0 = the face is sideways to the light
    //   negative = the face points away, so max() clamps it to 0 (dark)
    float brightness = max(dot(normalize(vNormal), normalize(uLightDirection)), 0.0);   // dot = how directly the face points at the sun

    // Ambient light (0.3) + directional light (0.7 * brightness) = final light level.
    vec3 light = vec3(0.3) + 0.7 * brightness * uLightColor;   // ambient + colored sunlight
    vec3 color = uColor * light; // the cube's color, dimmed by the light level
    float fogAmount = 1.0 - exp(-pow(uFogDensity * vDistance, 2.0));
    gl_FragColor = vec4(mix(color, uFogColor, fogAmount), 1.0);
  }
`;

// Compile one shader and report any GLSL errors.
function compileShader(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader));
  }
  return shader;
}

// A "program" for the GPU
// is a vertex shader + a fragment shader linked together.
const program = gl.createProgram();
gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vertexShaderSource));
gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource));
gl.linkProgram(program);
gl.useProgram(program);


// ---------------------------------------------------------------------
// 2. CUBE GEOMETRY → BUFFER
//
//    WHAT IS A BUFFER?
//    The GPU has its own memory, separate from the memory JavaScript
//    uses. The GPU can't reach into our JavaScript arrays while it
//    draws, so we copy the data over ahead of time. A BUFFER is a block
//    of GPU memory that holds that copy.
//
//    WHAT DOES IT HOLD?
//    Just a long list of numbers. A buffer has no idea what the numbers
//    mean. Here they are the corners (vertices) of a cube: each vertex's
//    position and its normal, packed one vertex after another.
//
//    DETAILS
//    We copy the cube into the buffer ONCE, at startup. After
//    that, every draw call reads straight from GPU memory, so drawing
//    100 cubes (or 100 cubes every frame) never re-sends the triangles.
//
//    Using a buffer takes three steps, all in the code below:
//      1. Put the numbers in a JavaScript array   (cubeVertices)
//      2. Copy that array into a GPU buffer       (createBuffer, bufferData)
//      3. Tell the GPU how to read the numbers    (vertexAttribPointer):
//         "the first 3 numbers of each vertex go to aPosition,
//          the next 3 go to aNormal"
//
//    CUBE details
//    One cube, 1 unit wide, with its bottom at y = 0 (so it sits on the
//    ground). Every cube in the scene reuses this same data;
//    uModel is what makes each one different- it is a 4×4 matrix
//    that takes the one shared cube and places it in the world.
//
//    Each face = 2 triangles = 6 vertices. Each vertex has 6 numbers:
//         x,    y,    z,      nx, ny, nz   (position, then normal)
// ---------------------------------------------------------------------
const cubeVertices = new Float32Array([
  // Front face (normal points toward +z)
  -0.5, 0, 0.5,   0, 0, 1,
   0.5, 0, 0.5,   0, 0, 1,
   0.5, 1, 0.5,   0, 0, 1,
  -0.5, 0, 0.5,   0, 0, 1,
   0.5, 1, 0.5,   0, 0, 1,
  -0.5, 1, 0.5,   0, 0, 1,

  // Back face (-z)
  -0.5, 0, -0.5,  0, 0, -1,
   0.5, 1, -0.5,  0, 0, -1,
   0.5, 0, -0.5,  0, 0, -1,
  -0.5, 0, -0.5,  0, 0, -1,
  -0.5, 1, -0.5,  0, 0, -1,
   0.5, 1, -0.5,  0, 0, -1,

  // Top face (+y)
  -0.5, 1, -0.5,  0, 1, 0,
  -0.5, 1,  0.5,  0, 1, 0,
   0.5, 1,  0.5,  0, 1, 0,
  -0.5, 1, -0.5,  0, 1, 0,
   0.5, 1,  0.5,  0, 1, 0,
   0.5, 1, -0.5,  0, 1, 0,

  // Bottom face (-y)
  -0.5, 0, -0.5,  0, -1, 0,
   0.5, 0,  0.5,  0, -1, 0,
  -0.5, 0,  0.5,  0, -1, 0,
  -0.5, 0, -0.5,  0, -1, 0,
   0.5, 0, -0.5,  0, -1, 0,
   0.5, 0,  0.5,  0, -1, 0,

  // Right face (+x)
   0.5, 0, -0.5,  1, 0, 0,
   0.5, 1, -0.5,  1, 0, 0,
   0.5, 1,  0.5,  1, 0, 0,
   0.5, 0, -0.5,  1, 0, 0,
   0.5, 1,  0.5,  1, 0, 0,
   0.5, 0,  0.5,  1, 0, 0,

  // Left face (-x)
  -0.5, 0, -0.5, -1, 0, 0,
  -0.5, 1,  0.5, -1, 0, 0,
  -0.5, 1, -0.5, -1, 0, 0,
  -0.5, 0, -0.5, -1, 0, 0,
  -0.5, 0,  0.5, -1, 0, 0,
  -0.5, 1,  0.5, -1, 0, 0,
]);
const VERTEX_COUNT = 36;

// Copy the vertex data into GPU memory.
//   createBuffer - reserve a new, empty buffer on the GPU
//   bindBuffer   - make it the "current" buffer; the next buffer
//                  commands act on whichever buffer is bound
//                  (ARRAY_BUFFER means "this holds vertex data")
//   bufferData   - copy our numbers into it. STATIC_DRAW is a hint
//                  that we'll fill it once and draw from it many times.
const buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.bufferData(gl.ARRAY_BUFFER, cubeVertices, gl.STATIC_DRAW);

// Tell the GPU how to read the buffer: which numbers are the position
// and which are the normal.
//   stride = bytes from one vertex to the next = 6 floats × 4 bytes = 24
//   offset = where in each vertex this attribute starts
const BYTES_PER_FLOAT = 4;
const stride = 6 * BYTES_PER_FLOAT;

// Each attribute is hooked up in three steps:
//   getAttribLocation       - ask the linked program for the attribute's
//                             slot number (the JS variable holds that
//                             number, not the data itself)
//   enableVertexAttribArray - say "fill this attribute from a buffer"
//   vertexAttribPointer     - say HOW: read from the currently bound
//                             buffer, 3 numbers per vertex, as floats,
//                             not normalized, stepping `stride` bytes
//                             per vertex, starting at this offset

// aPosition: the first 3 numbers of each vertex (x, y, z), offset 0.
const aPosition = gl.getAttribLocation(program, 'aPosition');
gl.enableVertexAttribArray(aPosition);
gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, stride, 0);

// aNormal: the next 3 numbers (nx, ny, nz), so skip past the 3 position
// floats = 12 bytes into each vertex.
const aNormal = gl.getAttribLocation(program, 'aNormal');
gl.enableVertexAttribArray(aNormal);
gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, stride, 3 * BYTES_PER_FLOAT);

// Look up where each uniform lives so we can set it later.
// Unlike attributes, uniforms don't come from the buffer: we send their
// values directly from JavaScript (gl.uniformMatrix4fv, gl.uniform3fv)
// in draw(). As with attributes, these variables hold a LOCATION
// (an address in the program), not the value itself.
//   uModel      - per cube: moves and stretches the cube into place
//   uView       - per frame: the camera's position and direction
//   uProjection - per frame: perspective (far things look smaller)
//   uColor      - per cube: the cube's RGB color
const uModel = gl.getUniformLocation(program, 'uModel');
const uView = gl.getUniformLocation(program, 'uView');
const uProjection = gl.getUniformLocation(program, 'uProjection');
const uColor = gl.getUniformLocation(program, 'uColor');
const uFogColor = gl.getUniformLocation(program, 'uFogColor'); // the color of the fog (red, green, blue: 0..1)
const uFogDensity = gl.getUniformLocation(program, 'uFogDensity'); // how thick the fog is (0 = none, 1 = very thick)
const uLightDirection = gl.getUniformLocation(program, 'uLightDirection'); // where the sun is (set from the Sun slider)
const uLightColor = gl.getUniformLocation(program, 'uLightColor'); // sun color: orange when low, white at noon
// =====================================================================
//  SKYBOX (Cameron's, from the original level4.js)
// =====================================================================
// Shaders for the skybox
// Skybox Vertex
const skyboxVertexShader = /* glsl */ `
attribute vec4 a_position;
varying vec4 v_position;
void main() {
  v_position = a_position;
  gl_Position = a_position;
  gl_Position.z = 1.0;
}

// Skybox Fragment
`
const skyboxFragmentShader = /* glsl */ `
precision mediump float;

uniform samplerCube u_skybox;
uniform mat4 u_viewDirectionProjectionInverse;

varying vec4 v_position;
void main() {
  vec4 t = u_viewDirectionProjectionInverse * v_position;
  gl_FragColor = textureCube(u_skybox, normalize(t.xyz / t.w));
}
`

// Create a second program for the skybox
const skyboxProgram = gl.createProgram();
gl.attachShader(skyboxProgram, compileShader(gl.VERTEX_SHADER, skyboxVertexShader));
gl.attachShader(skyboxProgram, compileShader(gl.FRAGMENT_SHADER, skyboxFragmentShader));
gl.linkProgram(skyboxProgram);

// Skybox Buffer

// look up where the vertex data needs to go.
var positionLocation = gl.getAttribLocation(skyboxProgram, "a_position");

// lookup uniforms
var skyboxLocation = gl.getUniformLocation(skyboxProgram, "u_skybox");
var viewDirectionProjectionInverseLocation =
gl.getUniformLocation(skyboxProgram, "u_viewDirectionProjectionInverse");

// Create a buffer for positions
var positionBuffer = gl.createBuffer();
// Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = positionBuffer)
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);


// Fill the buffer with the values that define a quad.
function setGeometry(gl) {
  var positions = new Float32Array(
    [
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1,
    ]);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
}

// Put the positions in the buffer
setGeometry(gl);

// Create a texture.
var texture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);

const faceInfos = [
  {
    target: gl.TEXTURE_CUBE_MAP_POSITIVE_X,
    url: west,
  },
  {
    target: gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
    url: east,
  },
  {
    target: gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
    url: up,
  },
  {
    target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
    url: down
  },
  {
    target: gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
    url: south,
  },
  {
    target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
    url: north,
  },
];

faceInfos.forEach((faceInfo) => {
  const {target, url} = faceInfo;

  // Upload the canvas to the cubemap face.
  const level = 0;
  const internalFormat = gl.RGBA;
  const width = 512;
  const height = 512;
  const format = gl.RGBA;
  const type = gl.UNSIGNED_BYTE;

  // setup each face so it's immediately renderable
  gl.texImage2D(target, level, internalFormat, width, height, 0, format, type, null);

  // Asynchronously load an image
  const image = new Image();
  image.src = url;
  image.addEventListener('load', function() {
    // Now that the image has loaded make copy it to the texture.
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
    gl.texImage2D(target, level, internalFormat, format, type, image);
    gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
  });
});
gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);


// The skybox uses its own shader + buffer, so after drawing it we switch
// back to the cube shader and point its attributes at the cube buffer again.
function useCubeProgram() {
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.enableVertexAttribArray(aPosition);
  gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, stride, 0);
  gl.enableVertexAttribArray(aNormal);
  gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, stride, 3 * BYTES_PER_FLOAT);
}

// Same field of view as the cube camera (perspective(Math.PI / 4, ...) in
// draw), so the sky lines up with the landscape.
var fieldOfViewRadians = Math.PI / 4;

function drawSkybox(){
  // Tell it to use our program (pair of shaders)
  gl.useProgram(skyboxProgram);

  // glsl flags for the skybox
  gl.enable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);

  // Turn on the position attribute
  gl.enableVertexAttribArray(positionLocation);

  // Bind the position buffer.
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  // Tell the position attribute how to get data out of positionBuffer (ARRAY_BUFFER)
  var size = 2;          // 2 components per iteration
  var type = gl.FLOAT;   // the data is 32bit floats
  var normalize = false; // don't normalize the data
  var stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
  var offset = 0;        // start at the beginning of the buffer
  
  gl.vertexAttribPointer(
        positionLocation, size, type, normalize, stride, offset);
  var aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
  var projectionMatrix =
    m4.perspective(fieldOfViewRadians, aspect, 1, 2000);

  // Have it use our camera positions
  var cameraPosition = [cameraVec3[X], cameraVec3[Y], cameraVec3[Z]];
  var target = [lookAtVec3[X], lookAtVec3[Y], lookAtVec3[Z]];
  var up = [upVec3[X], upVec3[Y], upVec3[Z]];
  // Compute the camera's matrix using look at.
  var cameraMatrix = m4.lookAt(cameraPosition, target, up);

  // Make a view matrix from the camera matrix.
  var viewMatrix = m4.inverse(cameraMatrix);

  // We only care about direciton so remove the translation
  viewMatrix[12] = 0;
  viewMatrix[13] = 0;
  viewMatrix[14] = 0;

  var viewDirectionProjectionMatrix =
      m4.multiply(projectionMatrix, viewMatrix);
  var viewDirectionProjectionInverseMatrix =
      m4.inverse(viewDirectionProjectionMatrix);

  // Set the uniforms
  gl.uniformMatrix4fv(
      viewDirectionProjectionInverseLocation, false,
      viewDirectionProjectionInverseMatrix);

  // Tell the shader to use texture unit 0 for u_skybox
  gl.uniform1i(skyboxLocation, 0);

  // let our quad pass the depth test at 1.0
  gl.depthFunc(gl.LEQUAL);

  // Draw the geometry.
  gl.drawArrays(gl.TRIANGLES, 0, 1 * 6);

  // Reset the glsl flags bc I changed
  gl.disable(gl.CULL_FACE);
  // gl.depthFunc(gl.LESS); // Return to default
  // gl.depthMask(true);
}


// ---------------------------------------------------------------------
// 3. THE SCENE: a plain JavaScript list of cubes
//    This part has nothing to do with WebGL - it's just data.
//    The cubes are laid out in a GRID_SIZE × GRID_SIZE grid on the
//    ground plane (y = 0), centered on the origin.
// ---------------------------------------------------------------------
const GRID_SIZE = 100;   //bigger
// const GRID_SIZE = 10;    // 10 × 10 = 100 cubes
const SPACING = 1.0;    // distance between cube ce// nters

// Get my arr
// Heights in the heightmap are 0..1 after sampling. The Height slider
// (default 10) sets how tall a cube with height 1 becomes, live.
const heightSlider = document.getElementById('heightScale');
// Camera speed slider: how far one WASD / arrow key press moves the camera.
const moveSpeedSlider = document.getElementById('moveSpeed');
// Fog slider: how thick the haze is (0 = no fog). Read every frame in draw().
const fogSlider = document.getElementById('fogDensity');
// Sun angle slider: where the sun is in the sky (0 = sunrise, 0.5 = noon, 1 = sunset).   
const sunSlider = document.getElementById('sunAngle');
// After dragging a slider, give keyboard focus back to the page so the
// arrow keys move the camera instead of nudging the slider.
for (const slider of [heightSlider, moveSpeedSlider]) {
  slider.addEventListener('change', () => slider.blur());
}
let cubes = [];      // shared with draw(); replaced whenever the resolution changes
let mapRows = 0;     // size of the current sampled grid (used for the far plane)
let mapCols = 0;
let heightGrid = [];  // heightGrid[row][col] = 0..1 ground height (for placing the track on top)

const statusLabel = document.getElementById('status');

// Sample the two images at roughly `numCubes` cubes and rebuild the scene.
// async because loading + reading the images takes a moment.
async function buildLandscape(numCubes){
  statusLabel.textContent = `Loading ${numCubes.toLocaleString()} cubes…`;
  const finalArr = await getFinalArrFromAssets("assets/MonzaSataliteJustTrack.png", "assets/MonzaHeightmapJustTrack.png", numCubes, true);

  // Build into a new list, then swap it in all at once so draw()
  // never sees a half-built landscape.
  const newCubes = [];
  for (let row = 0; row < finalArr.length -1 ; row++) {
    for (let col = 0; col < finalArr[0].length - 1; col++) {
      newCubes.push({
        // col walks across the image (columns), row walks down it (rows),
        // so x is centered with the column count and z with the row count.
        x: (col - (finalArr[0].length - 1) / 2) * SPACING,
        z: (row - (finalArr.length - 1) / 2) * SPACING,
        height: finalArr[row][col].height,   // 0..1 from the heightmap; scaled by the Height slider in draw()
        color: [finalArr[row][col].r, finalArr[row][col].g, finalArr[row][col].b],
      });
    }
  }
  cubes = newCubes;
  mapRows = finalArr.length;
  mapCols = finalArr[0].length;
  heightGrid = finalArr.map(row => row.map(cell => cell.height));
  buildTrack();   // the track's world positions depend on the grid size
  onWorldBuilt(); // Level 4 Fun: race path, scenery, grandstands (built once per map)
  statusLabel.textContent = `${mapCols} × ${mapRows} grid`;
}

// =====================================================================
//  THE TRACK: Monza as a chain of cubic Bezier curves
// =====================================================================
// track_points.js (exported from Blender) gives TRACK_SEGMENTS: 44 cubic
// Bezier segments, each [P0, P1, P2, P3] with every point as [x, z] in
// Blender units. Segment i ends exactly where segment i+1 starts, and the
// last one ends at the first one's start, so the loop is closed.
//
// A cubic Bezier is a weighted blend of its 4 control points:
//   B(t) = (1-t)^3 P0 + 3(1-t)^2 t P1 + 3(1-t) t^2 P2 + t^3 P3,  t in [0, 1]
// P0 and P3 are where the segment starts and ends; P1 and P2 are the
// "handles" that pull the curve toward them without it touching them.

// In Blender the reference image sat at the origin, 5 units tall (Blender's
// default for reference images), so the track's Blender coordinates can be
// turned into a 0..1 position across the image, then into grid coordinates.
const BLENDER_IMAGE_HEIGHT = 5;
const trackImage = new Image();
trackImage.src = "assets/MonzaSataliteJustTrack.png";
await trackImage.decode();
const BLENDER_IMAGE_WIDTH = BLENDER_IMAGE_HEIGHT * trackImage.naturalWidth / trackImage.naturalHeight;

// Blender [x, z] -> world [x, z] on our cube grid
function blenderToWorld([bx, bz]) {
  const u = bx / BLENDER_IMAGE_WIDTH + 0.5;    // 0 = left edge of the image, 1 = right edge
  const v = bz / BLENDER_IMAGE_HEIGHT + 0.5;   // 0 = top edge, 1 = bottom edge
  return [
    (u * mapCols - (mapCols - 1) / 2) * SPACING,
    (v * mapRows - (mapRows - 1) / 2) * SPACING,
  ];
}

// Ground height (0..1) under a world position, using the nearest cube.
function groundHeightAt(x, z) {
  const col = Math.round(x / SPACING + (mapCols - 1) / 2);
  const row = Math.round(z / SPACING + (mapRows - 1) / 2);
  const r = Math.min(Math.max(row, 0), mapRows - 1);
  const c = Math.min(Math.max(col, 0), mapCols - 1);
  return heightGrid[r][c];
}

// Evaluate one cubic Bezier segment at t (same formula as above).
function bezier(p0, p1, p2, p3, t) {
  const u = 1 - t; // u= 1-t, so u+t = 1.0
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t; // weights for each control point
  return [
    a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], // x in world space is Blender's x
    a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1], // z in world space is Blender's z, not y
  ];
}

function bezier3(p0, p1, p2, p3, t) {
  const u = 1 - t;
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;

  return [ a*p0[0] + b*p1[0] + c*p2[0] + d*p3[0],  //x
  a*p0[1] + b*p1[1] + c*p2[1] + d*p3[1], //y
  a*p0[2] + b*p1[2] + c*p2[2] + d*p3[2] ]; //z
}

function bezierTangent3(p0, p1, p2, p3, t) {
  const u = 1 - t;

  // Weights for the three ARROWS between control points
  // (these are the derivatives of bezier3's weights)
  const w1 = 3 * u * u;   // how much of (P1 - P0)
  const w2 = 6 * u * t;   // how much of (P2 - P1)
  const w3 = 3 * t * t;   // how much of (P3 - P2)

  return [
    w1 * (p1[0] - p0[0]) + w2 * (p2[0] - p1[0]) + w3 * (p3[0] - p2[0]),   // x
    w1 * (p1[1] - p0[1]) + w2 * (p2[1] - p1[1]) + w3 * (p3[1] - p2[1]),   // y
    w1 * (p1[2] - p0[2]) + w2 * (p2[2] - p1[2]) + w3 * (p3[2] - p2[2]),   // z
  ];
}

 

const BLIMP_PATH = [
     [-60, 40,  30],   // P0: off the map on the left
     [-10, 50,  70],   // P1: handle
     [ 10, 35, -70],   // P2: handle
     [ 60, 42, -30],   // P3: off the map on the right
   ];
let blimpT = 0;     // where along the curve the blimp is (0..1)

// The race: 20 cars, each with its OWN state (that's why this lives outside
// draw() - it has to remember where every car is between frames).
//   s     - 0..44: which Bezier segment the car is on + t within it
//   speed - segments per second (each car slightly different)
//   lane  - -1..1: how far left/right of the center line it drives
const NUM_CARS = 20;
const GRID_GAP = 0.5;          // starting gap between cars, in segments
const LANE_WIDTH = 0.9;        // world units from the center line at lane = +/-1
const cars = [];
for (let i = 0; i < NUM_CARS; i++) {
  cars.push({
    // staggered grid: car 0 on the start line, the others lined up behind it
    s: (TRACK_SEGMENTS.length - i * GRID_GAP) % TRACK_SEGMENTS.length,
    speed: 0.55 + Math.random() * 0.1,
    lane: i % 2 === 0 ? -0.5 : 0.5,    // two columns, like a real F1 grid
  });
}


let trackCenter = [0, 0];   // middle of the track (average of its anchor points), set in buildTrack
let trackCubes = [];     // small red cubes sampled along the curve
let controlCubes = [];   // the control points themselves (for explaining Beziers)
const TRACK_SPACING = 0.5;   // aim for a cube every half unit along the track

// Road shape (world units)
const ROAD_HALF_WIDTH = 1.4;     // center line to edge: wide enough for 2 cars side by side
const ROAD_THICKNESS = 0.15;
const LINE_WIDTH = 0.12;         // white edge lines
const ASPHALT = [0.13, 0.13, 0.14];
const LINE_WHITE = [0.95, 0.95, 0.95];

// The road is wider than one ground cube, and the ground under it is bumpy.
// So we lay the road on the HIGHEST ground cube near this spot - that way
// it never sinks into the landscape. Cars use the same height to drive on.
function roadHeightAt(x, z) {
  let highest = 0;
  for (const dx of [-1, 0, 1]) {
    for (const dz of [-1, 0, 1]) {
      highest = Math.max(highest, groundHeightAt(x + dx * ROAD_HALF_WIDTH, z + dz * ROAD_HALF_WIDTH));
    }
  }
  return highest;
}

function buildTrack() {
  trackCubes = [];
  controlCubes = [];
  for (const segment of TRACK_SEGMENTS) {
    const [p0, p1, p2, p3] = segment.map(blenderToWorld);

    // Longer segments get more samples so the cubes stay evenly spaced.
    // The control polygon's length is a quick upper bound on the curve's length.
    const roughLength = Math.hypot(p1[0] - p0[0], p1[1] - p0[1])
                      + Math.hypot(p2[0] - p1[0], p2[1] - p1[1])
                      + Math.hypot(p3[0] - p2[0], p3[1] - p2[1]);
    const steps = Math.max(2, Math.ceil(roughLength / TRACK_SPACING));

    // t from 0 up to (but not including) 1; the next segment starts at t = 0
    // The same segment as 3D points on the ground (y = 0), so we can reuse
    // bezier3 / bezierTangent3 - the tangent tells each road piece which way to face.
    const pts3 = [p0, p1, p2, p3].map(([x, z]) => [x, 0, z]);
    for (let i = 0; i < steps; i++) {
      const [x, , z] = bezier3(...pts3, i / steps);
      const dir = bezierTangent3(...pts3, i / steps);
      trackCubes.push({ x, z, dir, ground: roadHeightAt(x, z) });
    }

    // P0/P3 are on the curve (anchors), P1/P2 are the handles.
    controlCubes.push({ x: p0[0], z: p0[1], ground: groundHeightAt(...p0), anchor: true });
    controlCubes.push({ x: p1[0], z: p1[1], ground: groundHeightAt(...p1), anchor: false });
    controlCubes.push({ x: p2[0], z: p2[1], ground: groundHeightAt(...p2), anchor: false });
  }
  // Center of the track = average of every segment's starting anchor (P0)
  let cx = 0, cz = 0;
  for (const segment of TRACK_SEGMENTS) {
    const [x, z] = blenderToWorld(segment[0]);
    cx += x;
    cz += z;
  }
  trackCenter = [cx / TRACK_SEGMENTS.length, cz / TRACK_SEGMENTS.length];

  trackCountLabel.textContent = `${TRACK_SEGMENTS.length} Bezier segments · ${trackCubes.length} track cubes`;
}

const showTrackBox = document.getElementById('showTrack');
const showControlBox = document.getElementById('showControl');
const trackCountLabel = document.getElementById('trackCount');

// Start at 10k so the track's corners are visible; the buttons go lower or higher.
buildLandscape(10000);

// Resolution buttons
const resolutionButtons = document.querySelectorAll('.resolution');
for (const button of resolutionButtons) {
  button.addEventListener('click', async () => {
    resolutionButtons.forEach(b => b.classList.remove('active'));
    button.classList.add('active');
    await buildLandscape(Number(button.dataset.cubes));
  });
}

// FPS counter (same idea as Level 1): average over half a second.
const fpsLabel = document.getElementById('fps');
let fpsTime = 0;
let fpsFrames = 0;
function updateFps(dt) {
  if (!(dt > 0)) return;            // skip the first frame
  fpsTime += dt;
  fpsFrames++;
  if (fpsTime >= 0.5) {
    fpsLabel.textContent = `${Math.round(fpsFrames / fpsTime)} FPS · ${cubes.length.toLocaleString()} cubes`;
    fpsTime = 0;
    fpsFrames = 0;
  }
}

// ---------------------------------------------------------------------
// 4. MATRIX HELPERS
//    A 4×4 matrix can move, scale, or rotate points. WebGL stores
//    matrices as 16 numbers in "column-major" order: the first 4 numbers
//    are the first COLUMN, not the first row. That's why the translation
//    (x, y, z) appears in the last 4 numbers below.
//
//    (Real projects usually use a library such as glMatrix for this.)
// ---------------------------------------------------------------------

// Move a point by (x, y, z).
function translation(x, y, z) {
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    x, y, z, 1,
  ];
}

// Stretch a point by (sx, sy, sz).
function scaling(sx, sy, sz) {
  return [
    sx, 0,  0,  0,
    0,  sy, 0,  0,
    0,  0,  sz, 0,
    0,  0,  0,  1,
  ];
}

// Multiply two matrices: the result does b first, then a.
function multiply(a, b) {
  const result = new Array(16).fill(0);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      for (let k = 0; k < 4; k++) {
        result[col * 4 + row] += a[k * 4 + row] * b[col * 4 + k];
      }
    }
  }
  return result;
}

// Cleaner for accessing (hehe)
const X = 0;
const Y = 1;
const Z = 2;

// Vector Functions
function add(a, b){
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function subtract(a, b){
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale(a, scale){
  return [a[0] * scale, a[1] * scale, a[2] * scale];
}

function divide(a, b){
  return [a[0] / b[0], a[1] / b[1], a[2] / b[2]];
}

function normalize(a) {
  const length = Math.hypot(a[0], a[1], a[2]);
  return [a[0] / length, a[1] / length, a[2] / length];
}

function inverse(a) {
  return [0 - a[0] , 0 - a[1],0 - a[2]];
}

function dot(a, b){
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a, b){
  return [ 
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}


// Perspective projection: makes far-away objects look smaller.
//   fieldOfView - how wide the camera sees, in radians
//   aspect      - canvas width / height, so things aren't stretched
//   near, far   - nothing closer than near or farther than far is drawn
function perspective(fieldOfView, aspect, near, far) {
  const f = 1 / Math.tan(fieldOfView / 2);
  return [
    f / aspect, 0, 0,                               0,
    0,          f, 0,                               0,
    0,          0, (far + near) / (near - far),    -1,
    0,          0, (2 * far * near) / (near - far), 0,
  ];
}

// Camera matrix: place a camera at `eye`, looking at `target`.
// `up` says which way is "up" for the camera (normally +y).
function lookAt(eye, target, up) {

  // Build the camera's own three axes:
  const zAxis = normalize(subtract(eye, target)); // points backward, away from what we look at
  const xAxis = normalize(cross(up, zAxis));      // points to the camera's right
  const yAxis = cross(zAxis, xAxis);              // points to the camera's up

  return [
    xAxis[0], yAxis[0], zAxis[0], 0,
    xAxis[1], yAxis[1], zAxis[1], 0,
    xAxis[2], yAxis[2], zAxis[2], 0,
    -dot(xAxis, eye), -dot(yAxis, eye), -dot(zAxis, eye), 1,
  ];
}

// Like lookAt, but for placing an OBJECT: its +z (nose) points from `eye` toward `target`.
function targetTo(eye, target, up) {
  const zAxis = normalize(subtract(target, eye));   // nose direction (note: target − eye)
  const xAxis = normalize(cross(up, zAxis));        // the object's right side
  const yAxis = cross(zAxis, xAxis);                // the object's up
  return [
    xAxis[0], xAxis[1], xAxis[2], 0,   // column 0: where the object's x axis points
    yAxis[0], yAxis[1], yAxis[2], 0,   // column 1: its y axis
    zAxis[0], zAxis[1], zAxis[2], 0,   // column 2: its z axis (nose)
    eye[0],   eye[1],   eye[2],   1,   // column 3: where it is
  ];
}

// =====================================================================
//  THE BLIMP, built from cube parts
// =====================================================================
// The blimp is described in its OWN space ("blimp space"): it is 1 unit
// long, its nose points toward +z, and its center is at the origin.
// Every part is a cube that is scaled, rotated and moved into place in
// blimp space. Then ONE matrix (from targetTo) puts the whole blimp into
// the world, so all the parts move and turn together.
//
//   world position of a part = blimpMatrix * [extra rotation] * translate(center) * scale(size) * cube

// Rotations around the x axis and the z axis (the blimp's long axis).
function rotationX(angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return [1, 0, 0, 0,  0, c, s, 0,  0, -s, c, 0,  0, 0, 0, 1];
}
function rotationZ(angle) { // used for tail fins and propellers
  const c = Math.cos(angle), s = Math.sin(angle);
  return [c, s, 0, 0,  -s, c, 0, 0,  0, 0, 1, 0,  0, 0, 0, 1];
}

// Our cube has its BOTTOM at y = 0 (it was made for the landscape).
// Shift it down half a unit first so it is centered, then parts scale and
// rotate around their own middle.
const CENTER_CUBE = translation(0, -0.5, 0);

function drawPart(objectMatrix, center, size, color, extraRotation = null) {
  let part = multiply(translation(center[0], center[1], center[2]),
                      multiply(scaling(size[0], size[1], size[2]), CENTER_CUBE));
  if (extraRotation) part = multiply(extraRotation, part);
  gl.uniformMatrix4fv(uModel, false, multiply(objectMatrix, part));
  gl.uniform3fv(uColor, color);
  gl.drawArrays(gl.TRIANGLES, 0, VERTEX_COUNT);
}

const BLIMP_LENGTH = 16;   // world units
const BLIMP_WHITE = [0.94, 0.94, 0.96];
const BLIMP_RED   = [0.82, 0.04, 0.06];
const BLIMP_DARK  = [0.12, 0.12, 0.15];
const BLIMP_GLASS = [0.35, 0.55, 0.75];

// The envelope: 9 slices along the body. Each slice's radius follows an
// ellipse, r(z) = R * sqrt(1 - (z / halfLength)^2), so the blimp is fat in
// the middle and pointed at both ends. Each slice is drawn twice - once
// straight and once rotated 45 degrees around the long axis - which turns
// a square cross-section into an octagon (rounder from every angle).
// Note: the rotated square's corners reach r * sqrt(2) from the axis, so parts
// that hang under the body (gondola, engines) sit below ~0.21.
const ENVELOPE = [];
for (let k = -4; k <= 4; k++) {
  const z = k * 0.105;
  const r = 0.15 * Math.sqrt(1 - (z / 0.5) ** 2);
  ENVELOPE.push({ z, r, color: k === 0 || k === 1 ? BLIMP_RED : BLIMP_WHITE });   // red band in the middle
}

function drawBlimp(blimpMatrix, time) {
  // Envelope slices (octagonal)
  for (const slice of ENVELOPE) {
    const size = [slice.r * 2, slice.r * 2, 0.12];
    drawPart(blimpMatrix, [0, 0, slice.z], size, slice.color);
    drawPart(blimpMatrix, [0, 0, slice.z], size, slice.color, rotationZ(Math.PI / 4));
  }
  // Nose cap and tail tip
  drawPart(blimpMatrix, [0, 0,  0.49], [0.06, 0.06, 0.04], BLIMP_DARK);
  drawPart(blimpMatrix, [0, 0, -0.49], [0.05, 0.05, 0.04], BLIMP_WHITE);

  // Tail fins in an X: the SAME fin, rotated around the long axis 4 times
  for (let i = 0; i < 4; i++) {
    const angle = Math.PI / 4 + i * Math.PI / 2;   // 45, 135, 225, 315 degrees
    drawPart(blimpMatrix, [0, 0.15, -0.40], [0.012, 0.17, 0.13], BLIMP_RED, rotationZ(angle));
  }

  // Gondola (passenger cabin) under the middle, with a strip of windows
  drawPart(blimpMatrix, [0, -0.225, 0.03], [0.075, 0.05, 0.19], BLIMP_DARK);
  drawPart(blimpMatrix, [0, -0.218, 0.04], [0.078, 0.018, 0.15], BLIMP_GLASS);

  // Two engine pods with spinning propellers (rotation over time)
  const spin = time * 18;
  for (const side of [-1, 1]) {
    const pod = [side * 0.075, -0.215, -0.04];
    drawPart(blimpMatrix, pod, [0.03, 0.03, 0.06], BLIMP_WHITE);
    const hub = translation(pod[0], pod[1], pod[2] - 0.035);
    drawPart(blimpMatrix, [0, 0, 0], [0.11, 0.008, 0.005], BLIMP_DARK, multiply(hub, rotationZ(spin)));
  }
}

// =====================================================================
//  TV HELICOPTERS: flying a shrunken, lifted copy of the track
// =====================================================================
// A Bezier curve is a weighted average of its control points, so if we
// move every control point, the whole curve moves the same way. Here we
// pull each of the track's control points toward the track's center
// (by `shrink`) and lift it to `height`:
//
//   newPoint = center + (point - center) * shrink,   y = height
//
// That gives a smaller Monza floating above the infield, and a
// helicopter flies along it with the same s = segment + t idea as the cars.

// Rotation around y (turning left/right) - for the spinning main rotor.
function rotationY(angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return [c, 0, -s, 0,  0, 1, 0, 0,  s, 0, c, 0,  0, 0, 0, 1];
}

const HELICOPTERS = [
  //   s: start segment   speed: segments/sec   dir: 1 = with the race, -1 = against it
  { s: 0,  speed: 0.45, shrink: 0.8, height: 22, dir:  1 },
  { s: 22, speed: 0.35, shrink: 0.6, height: 30, dir: -1 },
];
const HELI_LENGTH = 5;   // world units

// Control points of segment `seg` of the shrunken, lifted track (3D world points)
function heliSegmentPoints(seg, shrink, height) {
  return TRACK_SEGMENTS[seg].map(p => {
    const [x, z] = blenderToWorld(p);
    return [
      trackCenter[0] + (x - trackCenter[0]) * shrink,
      height,
      trackCenter[1] + (z - trackCenter[1]) * shrink,
    ];
  });
}

const HELI_BLUE  = [0.08, 0.18, 0.45];
const HELI_GLASS = [0.55, 0.75, 0.90];
const HELI_GREY  = [0.30, 0.30, 0.32];

// The helicopter in its own space: 1 unit long, nose toward +z, skids at y = 0.
function drawHelicopter(heliMatrix, time) {
  drawPart(heliMatrix, [0, 0.20, 0.06],  [0.22, 0.22, 0.36], HELI_BLUE);    // cabin
  drawPart(heliMatrix, [0, 0.18, 0.27],  [0.18, 0.15, 0.10], HELI_GLASS);   // windscreen
  drawPart(heliMatrix, [0, 0.24, -0.30], [0.06, 0.06, 0.42], HELI_BLUE);    // tail boom
  drawPart(heliMatrix, [0, 0.32, -0.50], [0.02, 0.16, 0.08], BLIMP_WHITE);  // tail fin
  for (const side of [-1, 1]) {
    drawPart(heliMatrix, [side * 0.12, 0.02, 0.06], [0.03, 0.02, 0.42], HELI_GREY);   // skids
    drawPart(heliMatrix, [side * 0.08, 0.07, 0.06], [0.08, 0.02, 0.02], HELI_GREY);   // struts
  }
  drawPart(heliMatrix, [0, 0.335, 0.06], [0.04, 0.05, 0.04], HELI_GREY);    // rotor mast
  drawPart(heliMatrix, [0, 0.18, 0.27],  [0.05, 0.05, 0.08], BLIMP_DARK);   // TV camera pod

  // Main rotor: two blades spinning around the mast (rotation over time)
  const hub = translation(0, 0.365, 0.06);
  drawPart(heliMatrix, [0, 0, 0], [1.05, 0.012, 0.05], BLIMP_DARK, multiply(hub, rotationY(time * 25)));
  drawPart(heliMatrix, [0, 0, 0], [1.05, 0.012, 0.05], BLIMP_DARK, multiply(hub, rotationY(time * 25 + Math.PI / 2)));
  // Tail rotor: spinning around x, on the side of the fin
  const tailHub = translation(0.025, 0.32, -0.52);
  drawPart(heliMatrix, [0, 0, 0], [0.01, 0.18, 0.03], BLIMP_DARK, multiply(tailHub, rotationX(time * 40)));
}


// globals we are going to be using for draw
var deltaTime = 0;
var then = 0;

const startPosVec3 = [0, 150, 45];   // high up, so the whole track is in view
var cameraVec3 = [startPosVec3[X], startPosVec3[Y], startPosVec3[Z]];
var lookAtVec3 = [0, 0, 0];
var upVec3 = [0, 1, 0];
// ---------------------------------------------------------------------
// 5. DRAW
//    Everything above was SETUP: it ran once and got the shaders, the
//    buffer, and the list of cubes ready. draw() is where we actually
//    produce a picture. It follows the same steps every time:
//
//      a. size the drawing area to match the window
//      b. wipe the previous picture
//      c. set the camera
//      d. for each cube: set its uniforms, then tell the GPU to draw
//
//    Note that we never send the cube's triangles again here - they
//    are already sitting in the GPU buffer. Each cube costs us only a
//    few uniforms plus one draw call.
// ---------------------------------------------------------------------

// #####################################################################
// #####################################################################
//
//   LEVEL 4 FUN: MONZA GRAND PRIX SIMULATOR
//
//   A fun extra built WITH AI ASSISTANCE (Claude) on top of our Level 4
//   scene. Everything above this line is the Level 4 code (landscape,
//   Bezier track, blimp, helicopters, Cameron's skybox, fog, sun). This
//   part adds:
//     - the 2026 grid: 22 "2026 Audi R26" models (Dave Love, Sketchfab,
//       CC BY 4.0) recolored per team
//     - a 3-lap race with simple physics, slipstream and overtaking
//     - procedural scenery (terrain around the map, trees), grandstands,
//       pit wall + garages, kerbs in the corners
//     - TV cameras: chase, onboard, helicopter and blimp (auto-zoom)
//     - a clickable leaderboard
//
// #####################################################################
// #####################################################################

// ---------------------------------------------------------------------
//  Seeded randomness + smooth noise (so the scenery is the same each load)
// ---------------------------------------------------------------------
function mulberry32(seed) {
  return function () {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash2(ix, iz) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
// Value noise: random heights on a grid, smoothly blended in between.
function valueNoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);   // smoothstep
  const a = hash2(ix, iz), b = hash2(ix + 1, iz), c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  const top = a + (b - a) * sx, bottom = c + (d - c) * sx;
  return top + (bottom - top) * sz;
}
// Fractal noise: several layers of value noise, each finer and fainter.
function fbm(x, z) {
  let sum = 0, amp = 0.5, freq = 1;
  for (let o = 0; o < 4; o++) { sum += amp * valueNoise(x * freq, z * freq); freq *= 2; amp *= 0.5; }
  return sum / 0.9375;
}

// ---------------------------------------------------------------------
//  Shared lighting + fog (same maths as the Level 4 cube shader)
// ---------------------------------------------------------------------
const SCENE_SHADING_GLSL = /* glsl */`
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  uniform vec3 uLightDirection;
  uniform vec3 uLightColor;
  vec3 shade(vec3 base, vec3 normal, float dist) {
    float brightness = max(dot(normalize(normal), normalize(uLightDirection)), 0.0);
    vec3 color = base * (vec3(0.3) + 0.7 * brightness * uLightColor);
    float fogAmount = 1.0 - exp(-pow(uFogDensity * dist, 2.0));
    return mix(color, uFogColor, fogAmount);
  }
`;

function makeProgram(vertexSource, fragmentSource) {
  const p = gl.createProgram();
  gl.attachShader(p, compileShader(gl.VERTEX_SHADER, vertexSource));
  gl.attachShader(p, compileShader(gl.FRAGMENT_SHADER, fragmentSource));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  return p;
}
function sceneLocations(p) {
  return {
    uView: gl.getUniformLocation(p, 'uView'),
    uProjection: gl.getUniformLocation(p, 'uProjection'),
    uFogColor: gl.getUniformLocation(p, 'uFogColor'),
    uFogDensity: gl.getUniformLocation(p, 'uFogDensity'),
    uLightDirection: gl.getUniformLocation(p, 'uLightDirection'),
    uLightColor: gl.getUniformLocation(p, 'uLightColor'),
  };
}
function setSceneUniforms(loc, scene) {
  gl.uniformMatrix4fv(loc.uView, false, scene.view);
  gl.uniformMatrix4fv(loc.uProjection, false, scene.projection);
  gl.uniform3fv(loc.uFogColor, scene.fogColor);
  gl.uniform1f(loc.uFogDensity, scene.fogDensity);
  gl.uniform3fv(loc.uLightDirection, scene.lightDirection);
  gl.uniform3fv(loc.uLightColor, scene.lightColor);
}

// =====================================================================
//  STATIC BATCH: everything that doesn't move, in ONE draw call
// =====================================================================
// Levels 1-4 draw every cube with its own draw call (~10,000 per frame).
// Here all the things that never move - landscape, road, kerbs, scenery,
// grandstands - are transformed on the CPU once and packed into one big
// buffer. Each vertex carries its own color, so the GPU draws the whole
// world in a single gl.drawArrays. It's rebuilt only when the Height
// slider or the resolution changes.
const batchProgram = makeProgram(/* glsl */`
  attribute vec3 aPosition;
  attribute vec3 aNormal;
  attribute vec3 aColor;
  uniform mat4 uView;
  uniform mat4 uProjection;
  varying vec3 vNormal;
  varying vec3 vColor;
  varying float vDistance;
  void main() {
    vNormal = aNormal;
    vColor = aColor;
    vec4 cameraSpace = uView * vec4(aPosition, 1.0);
    vDistance = length(cameraSpace.xyz);
    gl_Position = uProjection * cameraSpace;
  }
`, /* glsl */`
  precision mediump float;
` + SCENE_SHADING_GLSL + `
  varying vec3 vNormal;
  varying vec3 vColor;
  varying float vDistance;
  void main() {
    gl_FragColor = vec4(shade(vColor, vNormal, vDistance), 1.0);
  }
`);
const batchLoc = {
  ...sceneLocations(batchProgram),
  aPosition: gl.getAttribLocation(batchProgram, 'aPosition'),
  aNormal: gl.getAttribLocation(batchProgram, 'aNormal'),
  aColor: gl.getAttribLocation(batchProgram, 'aColor'),
};

// The cube's 36 vertices, minus the bottom face (never visible).
const CUBE_VERTS = [];
for (let i = 0; i < 36; i++) {
  const v = Array.from(cubeVertices.slice(i * 6, i * 6 + 6));
  if (v[4] !== -1) CUBE_VERTS.push(v);
}

const staticBatch = {
  data: new Float32Array(1 << 21),
  count: 0,
  vertexCount: 0,
  buffer: gl.createBuffer(),

  reset() { this.count = 0; },

  // Add one cube transformed by `m` (same matrices we give uModel elsewhere).
  addCube(m, color) {
    const need = this.count + CUBE_VERTS.length * 9;
    if (need > this.data.length) {
      let size = this.data.length * 2;
      while (size < need) size *= 2;
      const bigger = new Float32Array(size);
      bigger.set(this.data.subarray(0, this.count));
      this.data = bigger;
    }
    const d = this.data;
    let k = this.count;
    for (const v of CUBE_VERTS) {
      const x = v[0], y = v[1], z = v[2];
      d[k++] = m[0] * x + m[4] * y + m[8] * z + m[12];
      d[k++] = m[1] * x + m[5] * y + m[9] * z + m[13];
      d[k++] = m[2] * x + m[6] * y + m[10] * z + m[14];
      const nx = m[0] * v[3] + m[4] * v[4] + m[8] * v[5];
      const ny = m[1] * v[3] + m[5] * v[4] + m[9] * v[5];
      const nz = m[2] * v[3] + m[6] * v[4] + m[10] * v[5];
      const len = Math.hypot(nx, ny, nz) || 1;
      d[k++] = nx / len; d[k++] = ny / len; d[k++] = nz / len;
      d[k++] = color[0]; d[k++] = color[1]; d[k++] = color[2];
    }
    this.count = k;
  },

  upload() {
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.subarray(0, this.count), gl.STATIC_DRAW);
    this.vertexCount = this.count / 9;
  },

  draw(scene) {
    if (!this.vertexCount) return;
    gl.useProgram(batchProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    const S = 9 * 4;
    gl.enableVertexAttribArray(batchLoc.aPosition);
    gl.vertexAttribPointer(batchLoc.aPosition, 3, gl.FLOAT, false, S, 0);
    gl.enableVertexAttribArray(batchLoc.aNormal);
    gl.vertexAttribPointer(batchLoc.aNormal, 3, gl.FLOAT, false, S, 12);
    gl.enableVertexAttribArray(batchLoc.aColor);
    gl.vertexAttribPointer(batchLoc.aColor, 3, gl.FLOAT, false, S, 24);
    setSceneUniforms(batchLoc, scene);
    gl.drawArrays(gl.TRIANGLES, 0, this.vertexCount);
    gl.disableVertexAttribArray(batchLoc.aColor);
  },
};

// Box helpers. Our cube has its bottom at y = 0 and is centered in x and z,
// so "box at (x, y, z)" means: centered at x/z, sitting on height y.
function boxIn(frame, x, y, z, sx, sy, sz, color) {
  staticBatch.addCube(multiply(frame, multiply(translation(x, y, z), scaling(sx, sy, sz))), color);
}
const IDENTITY = translation(0, 0, 0);

// =====================================================================
//  RACE PATH: the track sampled finely, with distance + curvature
// =====================================================================
const MONZA_LENGTH_M = 5793;   // real lap length; scales world units to meters
let racePath = [];             // { x, z, dx, dz, dist, curv }
let raceLength = 0;            // world units
let metersPerUnit = 1;

function buildRacePath() {
  const oldLength = raceLength;
  racePath = [];
  for (const segment of TRACK_SEGMENTS) {
    const pts = segment.map(p => { const [x, z] = blenderToWorld(p); return [x, 0, z]; });
    for (let i = 0; i < 40; i++) {
      const t = i / 40;
      const p = bezier3(...pts, t);
      const d = normalize(bezierTangent3(...pts, t));
      racePath.push({ x: p[0], z: p[2], dx: d[0], dz: d[2], dist: 0, curv: 0 });
    }
  }
  const n = racePath.length;
  let total = 0;
  for (let i = 0; i < n; i++) {
    racePath[i].dist = total;
    const a = racePath[i], b = racePath[(i + 1) % n];
    total += Math.hypot(b.x - a.x, b.z - a.z);
  }
  raceLength = total;
  metersPerUnit = MONZA_LENGTH_M / total;

  // Curvature = how fast the heading turns per meter (1 / turn radius),
  // measured over a few samples and lightly smoothed so Bezier joins don't
  // look like hairpins.
  const W = 4, raw = [];
  for (let i = 0; i < n; i++) {
    const a = racePath[(i - W + n) % n], b = racePath[i], c = racePath[(i + W) % n];
    let turn = Math.atan2(c.z - b.z, c.x - b.x) - Math.atan2(b.z - a.z, b.x - a.x);
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    const len = (Math.hypot(b.x - a.x, b.z - a.z) + Math.hypot(c.x - b.x, c.z - b.z)) * metersPerUnit;
    raw.push(Math.abs(turn) / (len / 2));
  }
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let k = -3; k <= 3; k++) sum += raw[(i + k + n) % n];
    racePath[i].curv = sum / 7;
  }

  // Keep every car's place on track when the resolution changes
  if (oldLength > 0) for (const car of raceCars) car.d *= total / oldLength;
}

// Index of the sample at (wrapped) distance s, by binary search.
function pathIndex(s) {
  let lo = 0, hi = racePath.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (racePath[mid].dist <= s) lo = mid; else hi = mid - 1;
  }
  return lo;
}
function wrapDist(d) { return ((d % raceLength) + raceLength) % raceLength; }

// Position + direction on the center line at distance d (any lap).
function pathAt(d) {
  const s = wrapDist(d);
  const i = pathIndex(s);
  const a = racePath[i], b = racePath[(i + 1) % racePath.length];
  const end = i + 1 === racePath.length ? raceLength : b.dist;
  const t = (s - a.dist) / ((end - a.dist) || 1);
  const dx = a.dx + (b.dx - a.dx) * t, dz = a.dz + (b.dz - a.dz) * t;
  const len = Math.hypot(dx, dz) || 1;
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, dx: dx / len, dz: dz / len, i };
}

// Smooth road height. The ground under the track is bumpy (one cube per
// unit), so laying each road piece on its own ground gives a staircase.
// Instead: take the highest ground in a window around each sample (so the
// road never sinks into a hill), then average that, so it rises and falls
// smoothly. Cars, kerbs and buildings all use this same height.
let roadY = [];   // per racePath sample, 0..1 like the heightmap
function buildRoadHeights() {
  const n = racePath.length;
  const raw = racePath.map(p => roadHeightAt(p.x, p.z));
  const peak = raw.map((_, i) => {
    let m = 0;
    for (let k = -8; k <= 8; k++) m = Math.max(m, raw[(i + k + n) % n]);
    return m;
  });
  roadY = peak.map((_, i) => {
    let sum = 0;
    for (let k = -12; k <= 12; k++) sum += peak[(i + k + n) % n];
    return sum / 25;
  });
}
function roadGroundAt(d) {
  const s = wrapDist(d);
  const i = pathIndex(s);
  const j = (i + 1) % racePath.length;
  const end = j === 0 ? raceLength : racePath[j].dist;
  const t = (s - racePath[i].dist) / ((end - racePath[i].dist) || 1);
  return roadY[i] + (roadY[j] - roadY[i]) * t;
}

// Coarse grid of track samples, to keep trees off the road.
let trackGrid = new Map();
function buildTrackGrid() {
  trackGrid = new Map();
  for (const p of racePath) {
    const key = Math.floor(p.x / 2) + ',' + Math.floor(p.z / 2);
    if (!trackGrid.has(key)) trackGrid.set(key, []);
    trackGrid.get(key).push(p);
  }
}
function nearTrack(x, z, r) {
  const cx = Math.floor(x / 2), cz = Math.floor(z / 2), cells = Math.ceil(r / 2);
  for (let i = -cells; i <= cells; i++) for (let j = -cells; j <= cells; j++) {
    const list = trackGrid.get((cx + i) + ',' + (cz + j));
    if (list) for (const p of list) if (Math.hypot(p.x - x, p.z - z) < r) return true;
  }
  return false;
}

// =====================================================================
//  BUILD THE STATIC WORLD
// =====================================================================
const KERB_RED = [0.85, 0.08, 0.08];
const CONCRETE = [0.62, 0.62, 0.60];

function rebuildStaticWorld() {
  if (!racePath.length) return;
  const hs = Number(heightSlider.value);
  const rng = mulberry32(2026);
  staticBatch.reset();

  // 1. Landscape cubes (the satellite + heightmap map)
  for (const cube of cubes) {
    staticBatch.addCube(multiply(translation(cube.x, 0, cube.z),
      scaling(1, Math.max(cube.height * hs, 0.05), 1)), cube.color);
  }

  // 2. Road: asphalt slabs + white edge lines (same idea as Level 3/4,
  //    but on the smoothed road height so it doesn't look like stairs)
  for (let i = 0; i < racePath.length; i += 3) {
    const p = racePath[i];
    const next = racePath[(i + 3) % racePath.length];
    const len = Math.hypot(next.x - p.x, next.z - p.z) * 1.7;
    const y = roadY[i] * hs;
    const piece = targetTo([p.x, y, p.z], [p.x + p.dx, y, p.z + p.dz], [0, 1, 0]);
    boxIn(piece, 0, 0, 0, ROAD_HALF_WIDTH * 2, ROAD_THICKNESS, len, ASPHALT);
    for (const side of [-1, 1]) {
      boxIn(piece, side * (ROAD_HALF_WIDTH - LINE_WIDTH), 0, 0, LINE_WIDTH, ROAD_THICKNESS + 0.02, len, LINE_WHITE);
    }
    // a little skirt under the road edge so it never looks like it floats
    for (const side of [-1, 1]) {
      boxIn(piece, side * (ROAD_HALF_WIDTH + 0.45), -0.6, 0, 0.9, 0.6 + 0.01, len, [0.30, 0.38, 0.22]);
    }
  }
  // Start / finish checkerboard
  const start = racePath[0];
  const startY = roadY[0] * hs;
  const startFrame = targetTo([start.x, startY, start.z], [start.x + start.dx, startY, start.z + start.dz], [0, 1, 0]);
  const SQUARES = 8, sq = (ROAD_HALF_WIDTH * 2) / SQUARES;
  for (let row = 0; row < 2; row++) for (let i = 0; i < SQUARES; i++) {
    boxIn(startFrame, -ROAD_HALF_WIDTH + sq * (i + 0.5), 0, (row - 0.5) * sq, sq, ROAD_THICKNESS + 0.03, sq,
      (i + row) % 2 === 0 ? LINE_WHITE : [0.02, 0.02, 0.02]);
  }

  // 3. Kerbs: red/white blocks on both edges wherever the track bends hard
  for (let i = 0; i < racePath.length; i += 2) {
    const p = racePath[i];
    if (p.curv < 0.011) continue;
    const y = roadY[i] * hs;
    const frame = targetTo([p.x, y, p.z], [p.x + p.dx, y, p.z + p.dz], [0, 1, 0]);
    const color = Math.floor(p.dist / 0.55) % 2 === 0 ? KERB_RED : LINE_WHITE;
    for (const side of [-1, 1]) {
      boxIn(frame, side * (ROAD_HALF_WIDTH + 0.17), 0, 0, 0.34, ROAD_THICKNESS + 0.04, 0.4, color);
    }
  }

  // 4. Procedural terrain around the map, so it isn't a floating island.
  //    Tiles get taller (hills) the further they are from the map, using
  //    fractal noise for natural-looking variation.
  const hx = (mapCols / 2) * SPACING, hz = (mapRows / 2) * SPACING;
  const TILE = 5;
  const EXT = Math.max(hx, hz) * 1.8;
  const FIELD_COLORS = [[0.30, 0.44, 0.20], [0.36, 0.50, 0.22], [0.52, 0.50, 0.30], [0.24, 0.36, 0.17], [0.42, 0.46, 0.24]];
  const outerTiles = [];
  for (let x = -EXT; x < EXT; x += TILE) for (let z = -EXT; z < EXT; z += TILE) {
    const cx = x + TILE / 2, cz = z + TILE / 2;
    if (Math.abs(cx) < hx - TILE / 2 && Math.abs(cz) < hz - TILE / 2) continue;   // fully under the real map
    const overlapsMap = Math.abs(cx) < hx + TILE / 2 && Math.abs(cz) < hz + TILE / 2;
    const out = Math.hypot(Math.max(Math.abs(cx) - hx, 0), Math.max(Math.abs(cz) - hz, 0));
    const n = fbm(cx * 0.025, cz * 0.025);
    const hills = Math.min(out / 45, 1);
    // Tiles on the map's edge stay flat and low, just filling the gap under it
    // Start at the height of the nearest map edge, then blend out into the hills,
    // so the map doesn't look like a raised table.
    const edgeX = Math.max(-hx + 0.5, Math.min(hx - 0.5, cx)), edgeZ = Math.max(-hz + 0.5, Math.min(hz - 0.5, cz));
    const edgeH = groundHeightAt(edgeX, edgeZ) * hs;
    const blend = Math.min(out / 18, 1);
    const wild = (0.5 + 1.6 * n) * hs / 10 + hills * hills * (3 + 22 * n);
    const h = overlapsMap ? 0.05 : edgeH * (1 - blend) + wild * blend;
    const field = FIELD_COLORS[Math.floor(hash2(Math.floor(cx / 15), Math.floor(cz / 15)) * FIELD_COLORS.length)];
    const shade = 0.85 + 0.3 * n;
    const color = hills > 0.6 ? [0.20 * shade, 0.32 * shade, 0.16 * shade] : field.map(c => c * shade);
    boxIn(IDENTITY, cx, -4, cz, TILE, h + 4, TILE, color);
    outerTiles.push({ cx, cz, h, hills });
  }

  // 5. Trees: on green parts of the map (away from the road) and on the outer tiles
  function tree(x, y, z, size) {
    const s = size * (0.8 + rng() * 0.6);
    const green = [0.10 + rng() * 0.08, 0.26 + rng() * 0.14, 0.08 + rng() * 0.05];
    boxIn(IDENTITY, x, y, z, 0.18 * s, 0.8 * s, 0.18 * s, [0.30, 0.20, 0.12]);              // trunk
    boxIn(IDENTITY, x, y + 0.55 * s, z, 0.95 * s, 0.75 * s, 0.95 * s, green);               // canopy
    staticBatch.addCube(multiply(translation(x, y + 1.2 * s, z),
      multiply(rotationY(Math.PI / 4), scaling(0.6 * s, 0.5 * s, 0.6 * s))),
      green.map(c => c * 1.15));                                                             // top, turned 45°
  }
  for (const cube of cubes) {
    const [r, g, b] = cube.color;
    if (g > r * 1.08 && g > b * 1.05 && rng() < 0.10 && !nearTrack(cube.x, cube.z, ROAD_HALF_WIDTH + 1.8)) {
      tree(cube.x + (rng() - 0.5) * 0.6, Math.max(cube.height * hs, 0.05), cube.z + (rng() - 0.5) * 0.6, 1.0);
    }
  }
  for (const t of outerTiles) {
    const count = t.hills > 0.6 ? 2 : (rng() < 0.4 ? 1 : 0);
    for (let k = 0; k < count; k++) {
      tree(t.cx + (rng() - 0.5) * TILE * 0.8, t.h, t.cz + (rng() - 0.5) * TILE * 0.8, 1.3);
    }
  }

  // 6. Main straight: grandstands outside, pit wall + pit lane + garages inside
  const center = trackCenter;
  // A frame at track distance d whose +x points AWAY from the infield.
  function sideFrame(d, flip = false) {
    const p = pathAt(d);
    const y = roadGroundAt(d) * hs;
    const side = [p.dz, 0, -p.dx];                    // = cross(up, direction)
    const outward = (side[0] * (p.x - center[0]) + side[2] * (p.z - center[1]) > 0) !== flip;
    const dir = outward ? [p.dx, 0, p.dz] : [-p.dx, 0, -p.dz];   // flip so +x faces outward
    return { frame: targetTo([p.x, y, p.z], [p.x + dir[0], y, p.z + dir[2]], [0, 1, 0]), p, y };
  }
  // Would a grandstand here sit on the track? Check points across its
  // footprint (in the stand's own space -> world, using its frame matrix).
  function standBlocked(frame, length) {
    const x0 = ROAD_HALF_WIDTH + 1.4;
    for (let x = x0 - 0.3; x <= x0 + 2.4; x += 0.5) {
      for (let z = -length / 2 - 0.3; z <= length / 2 + 0.3; z += 0.5) {
        const wx = frame[0] * x + frame[8] * z + frame[12];
        const wz = frame[2] * x + frame[10] * z + frame[14];
        if (nearTrack(wx, wz, ROAD_HALF_WIDTH + 0.4)) return true;
      }
    }
    return false;
  }
  // Place a grandstand on the outside if there's room, else the inside, else skip
  function placeGrandstand(d, length) {
    for (const flip of [false, true]) {
      const { frame } = sideFrame(d, flip);
      if (!standBlocked(frame, length)) { grandstand(frame, length); return; }
    }
  }
  function grandstand(frame, length) {
    const SEAT_COLORS = [[0.85, 0.1, 0.1], [0.95, 0.95, 0.95], [0.1, 0.45, 0.2]];
    const x0 = ROAD_HALF_WIDTH + 1.4;
    for (let tier = 0; tier < 4; tier++) {
      const x = x0 + tier * 0.55, top = 0.5 + tier * 0.45;
      boxIn(frame, x, 0, 0, 0.55, top, length, CONCRETE);
      boxIn(frame, x, top, 0, 0.55, 0.06, length, SEAT_COLORS[tier % 3]);
      for (let z = -length / 2 + 0.25; z < length / 2; z += 0.32) {        // the crowd
        if (rng() < 0.7) {
          boxIn(frame, x + (rng() - 0.5) * 0.2, top + 0.06, z, 0.16, 0.18 + rng() * 0.08, 0.16,
            [0.3 + rng() * 0.7, 0.3 + rng() * 0.7, 0.3 + rng() * 0.7]);
        }
      }
    }
    boxIn(frame, x0 + 0.85, 2.7, 0, 2.6, 0.08, length + 0.2, [0.92, 0.92, 0.94]);   // roof
    boxIn(frame, x0 + 2.25, 0, 0, 0.12, 2.7, length + 0.2, [0.45, 0.45, 0.47]);     // back wall
    for (const z of [-length / 2, 0, length / 2]) boxIn(frame, x0 - 0.2, 0, z, 0.08, 2.7, 0.08, [0.45, 0.45, 0.47]);
  }

  // Find the main straight: the start line sits at the exit of the last
  // corner, so scan forward to where the track straightens out, then on
  // to where it starts bending again.
  const curvAt = d => racePath[pathIndex(wrapDist(d))].curv;
  let straightStart = 0;
  while (straightStart < raceLength * 0.25 && curvAt(straightStart) >= 0.003) straightStart += 1;
  let straightEnd = straightStart;
  while (straightEnd < straightStart + raceLength * 0.3 && curvAt(straightEnd) < 0.004) straightEnd += 1;
  for (let d = straightStart + 3; d < straightEnd - 3; d += 6.2) {
    const { frame } = sideFrame(d);
    if (!standBlocked(frame, 5.8)) grandstand(frame, 5.8);   // main straight: outside only (pits are inside)
  }

  // Pit wall, pit lane and team garages on the infield side
  for (let d = straightStart - 2; d < straightEnd - 2; d += 1) {
    const { frame } = sideFrame(d);
    boxIn(frame, -(ROAD_HALF_WIDTH + 0.35), 0, 0, 0.22, 0.6, 1.05, CONCRETE);                  // pit wall
    boxIn(frame, -(ROAD_HALF_WIDTH + 0.35), 0.6, 0, 0.05, 0.5, 1.05, [0.75, 0.78, 0.8]);        // fence
    boxIn(frame, -(ROAD_HALF_WIDTH + 1.45), 0, 0, 1.9, ROAD_THICKNESS, 1.05, [0.22, 0.22, 0.23]); // pit lane
  }
  TEAMS.forEach((team, i) => {
    const d = straightStart + 4 + i * 4.4;
    if (d > straightEnd - 3) return;
    const { frame } = sideFrame(d);
    const x = -(ROAD_HALF_WIDTH + 3.4);
    boxIn(frame, x, 0, 0, 1.8, 1.5, 4.1, [0.28, 0.28, 0.30]);              // garage building
    boxIn(frame, x + 0.91, 0, 0, 0.03, 1.0, 3.2, [0.08, 0.08, 0.09]);      // open door
    boxIn(frame, x + 0.92, 1.08, 0, 0.04, 0.28, 3.9, team.primary);        // team-colored sign
  });

  // A few grandstands at the slowest corners
  const corners = [];
  for (let i = 0; i < racePath.length; i++) {
    const p = racePath[i];
    if (p.curv > 0.02 && corners.every(c => Math.abs(c.dist - p.dist) > 25)) corners.push(p);
  }
  corners.sort((a, b) => b.curv - a.curv).slice(0, 4).forEach(c => placeGrandstand(c.dist + 1, 4.5));

  staticBatch.upload();
}

// Called from buildLandscape() each time the map is (re)built.
function onWorldBuilt() {
  buildRacePath();
  buildRoadHeights();
  buildTrackGrid();
  rebuildStaticWorld();
  if (!raceCars.length) setupRace();
}
let rebuildTimer = null;
heightSlider.addEventListener('input', () => {
  clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(rebuildStaticWorld, 120);   // rebuild once the slider settles
});

// =====================================================================
//  THE 2026 GRID
// =====================================================================
// Team pace and colors are approximate - this is a toy, not a prediction.
const TEAMS = [
  { name: 'McLaren',      rating: 1.00, primary: [1.00, 0.50, 0.05], secondary: [0.10, 0.10, 0.11], accent: [0.00, 0.55, 0.95],
    drivers: [['Lando Norris', 'NOR', 1], ['Oscar Piastri', 'PIA', 81]] },
  { name: 'Mercedes',     rating: 0.98, primary: [0.78, 0.80, 0.82], secondary: [0.06, 0.06, 0.07], accent: [0.00, 0.83, 0.75],
    drivers: [['George Russell', 'RUS', 63], ['Kimi Antonelli', 'ANT', 12]] },
  { name: 'Red Bull',     rating: 0.97, primary: [0.09, 0.13, 0.38], secondary: [0.05, 0.07, 0.20], accent: [0.90, 0.10, 0.15],
    drivers: [['Max Verstappen', 'VER', 3], ['Isack Hadjar', 'HAD', 6]] },
  { name: 'Ferrari',      rating: 0.97, primary: [0.86, 0.04, 0.04], secondary: [0.10, 0.10, 0.10], accent: [0.97, 0.97, 0.97],
    drivers: [['Charles Leclerc', 'LEC', 16], ['Lewis Hamilton', 'HAM', 44]] },
  { name: 'Audi',         rating: 0.93, original: true, primary: [0.75, 0.76, 0.78], secondary: [0.08, 0.08, 0.09], accent: [0.95, 0.30, 0.00],
    drivers: [['Aditya Pawar', 'PAW', 26], ['Cameron Pocisk', 'POC', 62]] },
  { name: 'Williams',     rating: 0.91, primary: [0.02, 0.30, 0.78], secondary: [0.02, 0.08, 0.25], accent: [0.00, 0.75, 1.00],
    drivers: [['Alexander Albon', 'ALB', 23], ['Carlos Sainz', 'SAI', 55]] },
  { name: 'Racing Bulls', rating: 0.90, primary: [0.93, 0.93, 0.95], secondary: [0.15, 0.30, 0.85], accent: [0.90, 0.10, 0.15],
    drivers: [['Liam Lawson', 'LAW', 30], ['Arvid Lindblad', 'LIN', 41]] },
  { name: 'Aston Martin', rating: 0.89, primary: [0.00, 0.40, 0.30], secondary: [0.05, 0.07, 0.06], accent: [0.80, 1.00, 0.00],
    drivers: [['Fernando Alonso', 'ALO', 14], ['Lance Stroll', 'STR', 18]] },
  { name: 'Haas',         rating: 0.88, primary: [0.93, 0.93, 0.93], secondary: [0.10, 0.10, 0.10], accent: [0.85, 0.05, 0.10],
    drivers: [['Esteban Ocon', 'OCO', 31], ['Oliver Bearman', 'BEA', 87]] },
  { name: 'Alpine',       rating: 0.87, primary: [0.05, 0.30, 0.80], secondary: [0.06, 0.06, 0.08], accent: [1.00, 0.40, 0.70],
    drivers: [['Pierre Gasly', 'GAS', 10], ['Franco Colapinto', 'COL', 43]] },
  { name: 'Cadillac',     rating: 0.86, primary: [0.08, 0.08, 0.09], secondary: [0.92, 0.92, 0.93], accent: [0.75, 0.65, 0.40],
    drivers: [['Sergio Pérez', 'PER', 11], ['Valtteri Bottas', 'BOT', 77]] },
];

// =====================================================================
//  THE RACE
// =====================================================================
const RACE_LAPS = 3;
const CAR_LENGTH = 1.9;               // world units (exaggerated ~7x so you can see the cars)
const LANE_HALF = ROAD_HALF_WIDTH - 0.55;   // how far off the center line a car can drive

let raceCars = [];
let raceSpeed = 1;                    // 1x / 2x / 3x buttons
let selectedCar = null;
const race = { state: 'lights', lights: 0, goAt: 6, time: 0, finishCount: 0, trace: [] };
// Timing like real F1: remember WHEN the leader passed each point of the
// race distance. A car's gap = now - when the leader was where it is now.
function leaderTimeAt(d) {
  const tr = race.trace;
  if (!tr.length || d <= tr[0].d) return 0;
  let lo = 0, hi = tr.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (tr[mid].d <= d) lo = mid; else hi = mid - 1; }
  const a = tr[lo], b = tr[Math.min(lo + 1, tr.length - 1)];
  return b.d > a.d ? a.t + (b.t - a.t) * (d - a.d) / (b.d - a.d) : a.t;
}

function setupRace() {
  const rng = mulberry32((Math.random() * 1e9) | 0);   // a different race every time
  raceCars = [];
  for (const team of TEAMS) for (const [name, short, number] of team.drivers) {
    const perf = team.rating + (rng() - 0.5) * 0.04;   // driver skill on top of the car
    raceCars.push({
      team, name, short, number, perf,
      maxSpeed: 87 + 8 * perf,       // m/s  (~340 km/h for the best)
      accel: 8.5 + 3 * perf,         // m/s^2
      brake: 41 + 5 * perf,          // m/s^2
      grip: 33 + 9 * perf,           // m/s^2 sideways in corners
      d: 0, v: 0, lat: 0, targetLat: 0, wobble: 0,
      reaction: 0.15 + rng() * 0.45,  // seconds to react when the lights go out
      form: 0, formTarget: 0, formTimer: rng() * 8,   // pace that drifts up and down during the race
      finished: false, finishTime: 0, prefSide: rng() < 0.5 ? -1 : 1,
    });
  }
  // "Qualifying": sort by pace with a bit of luck, then line up on a staggered grid
  raceCars.sort((a, b) => (b.perf + rng() * 0.06) - (a.perf + rng() * 0.06));
  raceCars.forEach((car, i) => {
    car.grid = i + 1;
    car.d = -0.6 - i * CAR_LENGTH * 1.25;
    car.lat = car.targetLat = (i % 2 === 0 ? -0.45 : 0.45);
  });
  race.state = 'lights';
  race.lights = 0;
  race.goAt = 5 + 0.4 + rng() * 1.2;   // 5 lights, then a random pause before lights out
  race.time = 0;
  race.finishCount = 0;
  race.trace = [];
  if (!selectedCar || !raceCars.includes(selectedCar)) {
    selectedCar = raceCars.find(c => c.short === 'PAW') || raceCars[0];
  } else {
    selectedCar = raceCars.find(c => c.short === selectedCar.short);
  }
}

const chaosSlider = document.getElementById('chaos');

// The fastest speed (m/s) a car can take a corner: v^2 * curvature <= grip
function cornerSpeed(car, curv) {
  return Math.sqrt(car.grip / Math.max(curv, 1e-6));
}

// How fast the car may go right now: for every sample ahead (up to its
// braking distance), it must still be able to slow to that corner's speed:
//   v_now^2 = v_corner^2 + 2 * brake * distance
function allowedSpeed(car, topSpeed) {
  const s = wrapDist(car.d);
  const lookMeters = (car.v * car.v) / (2 * car.brake) + 40;
  let allowed = topSpeed;
  const n = racePath.length;
  const i0 = pathIndex(s);
  for (let k = 1; k < n; k++) {
    const p = racePath[(i0 + k) % n];
    let ahead = p.dist - s;
    if (ahead < 0) ahead += raceLength;
    const aheadM = ahead * metersPerUnit;
    if (aheadM > lookMeters) break;
    const vc = Math.min(topSpeed, cornerSpeed(car, p.curv));
    allowed = Math.min(allowed, Math.sqrt(vc * vc + 2 * car.brake * aheadM));
  }
  return allowed;
}

// Signed gap from car a to car b along the track, wrapped into (-L/2, L/2]
function trackGap(a, b) {
  let g = wrapDist(b.d - a.d);
  if (g > raceLength / 2) g -= raceLength;
  return g;
}

function updateRace(dt) {
  if (!racePath.length || !raceCars.length) return;
  if (race.state === 'lights') {
    race.lights += dt;
    if (race.lights >= race.goAt) race.state = 'racing';
    return;
  }
  race.time += dt;
  const chaos = chaosSlider ? Number(chaosSlider.value) : 1;

  for (const car of raceCars) {
    // Reaction time at the start: nobody moves until they've reacted
    if (race.time < car.reaction) continue;

    // "Form": every few seconds each car's pace drifts a little (tyres,
    // traffic, driver). More chaos = bigger swings = more overtaking.
    car.formTimer -= dt;
    if (car.formTimer <= 0) {
      car.formTimer = 5 + Math.random() * 6;
      car.formTarget = (Math.random() - 0.5) * 0.07 * chaos;
    }
    car.form += (car.formTarget - car.form) * Math.min(dt * 0.5, 1);

    // Who is near me? First: the closest car ahead that's in my way.
    let blocker = null, blockGap = Infinity, anyoneClose = false;
    for (const other of raceCars) {
      if (other === car) continue;
      const g = trackGap(car, other);
      if (g > -CAR_LENGTH * 1.4 && g < CAR_LENGTH * 6) anyoneClose = true;
      if (g > 0 && g < CAR_LENGTH * 6 && Math.abs(other.lat - car.lat) < 0.7 && g < blockGap) {
        blocker = other;
        blockGap = g;
      }
    }
    // Is there room to pull out on a side? (any OTHER car alongside on that side)
    const sideFree = side => raceCars.every(other => {
      if (other === car || other === blocker) return true;
      const g = trackGap(car, other);
      return Math.abs(g) > CAR_LENGTH * 1.4 || Math.abs(other.lat - side * 0.62) > 0.6;
    });

    // Slipstream: tucked in behind another car = less drag = higher top speed.
    // DRS: within ~1 second of the car ahead on a straight = flap open, even faster.
    const onStraight = racePath[pathIndex(wrapDist(car.d))].curv < 0.003;
    let boost = 1;
    if (blocker && blockGap < CAR_LENGTH * 5) boost = 1.05;
    if (blocker && blockGap < CAR_LENGTH * 3 && onStraight) boost = 1.09;
    const form = 1 + car.form;
    const gripNow = car.grip;
    car.grip = gripNow * form;                       // form changes cornering speed...
    let allowed = allowedSpeed(car, car.maxSpeed * boost * (1 + car.form * 0.5));   // ...and top speed
    car.grip = gripNow;
    if (car.finished) allowed = Math.min(allowed, 45);   // cool-down lap

    if (blocker) {
      // Faster than the car ahead and close: pull out to pass on the free side
      if (allowed > blocker.v + 0.5 && blockGap < CAR_LENGTH * 3.5) {
        // go round the side the car ahead ISN'T on; if that's taken, try the other
        let side = blocker.lat > 0.1 ? -1 : blocker.lat < -0.1 ? 1 : car.prefSide;
        if (!sideFree(side)) side = -side;
        if (sideFree(side)) car.targetLat = side * 0.62;
      }
      // Still directly behind: can't drive through it, so match its speed
      if (Math.abs(blocker.lat - car.lat) < 0.7) {
        if (blockGap < CAR_LENGTH * 1.3) allowed = Math.min(allowed, blocker.v - 0.5);
        if (blockGap < CAR_LENGTH * 1.05) allowed = Math.min(allowed, blocker.v * 0.9);
      }
    } else if (!anyoneClose) {
      car.targetLat *= 1 - Math.min(dt * 0.4, 1);         // drift back to the racing line
    }

    // Chaos: small chance of a lock-up while braking
    if (car.v > allowed + 2 && Math.random() < dt * 0.03 * chaos) {
      car.v *= 0.72;                                   // lock-up / run wide
      car.wobble = 1;
      car.targetLat = (Math.random() < 0.5 ? -1 : 1) * 0.8;
    }
    car.wobble = Math.max(0, car.wobble - dt * 1.5);

    // Throttle or brakes
    if (car.v < allowed) car.v = Math.min(allowed, car.v + car.accel * dt * (1 - car.v / (car.maxSpeed * 1.15)) * 1.6);
    else car.v = Math.max(allowed, car.v - car.brake * dt);
    car.v = Math.max(car.v, 0);

    // Move sideways toward the chosen line, and forward along the track
    const latStep = dt * 0.9;
    car.lat += Math.max(-latStep, Math.min(latStep, car.targetLat - car.lat));
    car.lat = Math.max(-1, Math.min(1, car.lat));
    car.d += (car.v * dt) / metersPerUnit;

    // Chequered flag
    if (!car.finished && car.d >= RACE_LAPS * raceLength) {
      car.finished = true;
      car.finishTime = race.time;
      car.finishPos = ++race.finishCount;
    }
  }
  // Record the leader's progress for the timing gaps
  let leadD = -Infinity;
  for (const car of raceCars) leadD = Math.max(leadD, car.d);
  const last = race.trace[race.trace.length - 1];
  if (!last || leadD > last.d + 0.25) race.trace.push({ d: leadD, t: race.time });

  if (race.finishCount === raceCars.length) race.state = 'finished';
  else if (race.finishCount > 0) race.state = 'chequered';
}

// Running order: finished cars by finishing position, then by distance
function standings() {
  return [...raceCars].sort((a, b) => {
    if (a.finished && b.finished) return a.finishPos - b.finishPos;
    if (a.finished) return -1;
    if (b.finished) return 1;
    return b.d - a.d;
  });
}

// Where a car is this frame (world position, direction, matrix)
function carPose(car) {
  const p = pathAt(car.d);
  const hs = Number(heightSlider.value);
  const side = [p.dz, 0, -p.dx];
  const wob = car.wobble * Math.sin(race.time * 18) * 0.25;
  const x = p.x + side[0] * car.lat * LANE_HALF;
  const z = p.z + side[2] * car.lat * LANE_HALF;
  const y = roadGroundAt(car.d) * hs + ROAD_THICKNESS;
  const dir = normalize([p.dx + side[0] * wob, 0, p.dz + side[2] * wob]);
  return { pos: [x, y, z], dir, side };
}

// =====================================================================
//  THE CAR MODEL: textured shader + team liveries
// =====================================================================
const carProgram = makeProgram(/* glsl */`
  attribute vec3 aPosition;
  attribute vec3 aNormal;
  attribute vec2 aTexCoord;     // where on the texture this corner reads from
  uniform mat4 uModel;
  uniform mat4 uView;
  uniform mat4 uProjection;
  varying vec3 vNormal;
  varying vec2 vTexCoord;
  varying float vDistance;
  void main() {
    vNormal = mat3(uModel) * aNormal;
    vTexCoord = aTexCoord;
    vec4 cameraSpace = uView * uModel * vec4(aPosition, 1.0);
    vDistance = length(cameraSpace.xyz);
    gl_Position = uProjection * cameraSpace;
  }
`, /* glsl */`
  precision mediump float;
` + SCENE_SHADING_GLSL + `
  uniform sampler2D uTexture;
  uniform vec3 uBaseColor;
  varying vec3 vNormal;
  varying vec2 vTexCoord;
  varying float vDistance;
  void main() {
    vec4 tex = texture2D(uTexture, vTexCoord);
    if (tex.a < 0.05) discard;    // see-through parts of decals draw nothing
    gl_FragColor = vec4(shade(tex.rgb * uBaseColor, vNormal, vDistance), tex.a);
  }
`);
const carLoc = {
  ...sceneLocations(carProgram),
  aPosition: gl.getAttribLocation(carProgram, 'aPosition'),
  aNormal: gl.getAttribLocation(carProgram, 'aNormal'),
  aTexCoord: gl.getAttribLocation(carProgram, 'aTexCoord'),
  uModel: gl.getUniformLocation(carProgram, 'uModel'),
  uTexture: gl.getUniformLocation(carProgram, 'uTexture'),
  uBaseColor: gl.getUniformLocation(carProgram, 'uBaseColor'),
};

// "2026 Audi R26" by Dave Love (Sketchfab), CC BY 4.0 - see README credits.
let carModel = null;
loadObjModel(gl, 'assets/car/audrs26.obj').then(model => {
  for (const g of model.groups) {
    g.transparent = /decal|number|glass/i.test(g.material);
    g.audiOnly = /decal|number/i.test(g.material);     // Audi's sponsors + #27 only on the Audis
    g.paint = /paint/i.test(g.material);
  }
  model.groups.sort((a, b) => a.transparent - b.transparent);
  const { min, max } = model;
  const length = max[2] - min[2];
  // OBJ is in meters, nose +z, y up: center it, tyres on y = 0, 1 unit long
  model.fit = multiply(scaling(1 / length, 1 / length, 1 / length),
    translation(-(min[0] + max[0]) / 2, -min[1], -(min[2] + max[2]) / 2));
  carModel = model;
}).catch(err => console.warn('Car model failed to load:', err));

// Liveries: the car's paint texture is a palette of 128-pixel color squares
// (silver, black, Audi orange...). Every painted panel points its UVs at one
// square. Repainting the squares on a copy of the image recolors the car.
const paintImage = new Image();
paintImage.src = 'assets/car/textures/image_8.png';
paintImage.decode().then(() => {
  const css = c => `rgb(${c.map(v => Math.round(v * 255)).join(',')})`;
  for (const team of TEAMS) {
    if (team.original) continue;     // Audi keeps its real livery
    const cnv = document.createElement('canvas');
    cnv.width = paintImage.naturalWidth;
    cnv.height = paintImage.naturalHeight;
    const ctx = cnv.getContext('2d');
    ctx.drawImage(paintImage, 0, 0);
    const T = 128 * cnv.width / 1024;
    ctx.fillStyle = css(team.primary);   ctx.fillRect(0, 0, T, T); ctx.fillRect(T, T, T, T);         // silver squares
    ctx.fillStyle = css(team.secondary); ctx.fillRect(T, 0, T, T); ctx.fillRect(T, 2 * T, T, T);     // black squares
    ctx.fillStyle = css(team.accent);    ctx.fillRect(0, T, T, T);                                    // orange square
    team.paintTexture = textureFromImage(gl, cnv);
  }
}).catch(err => console.warn('Paint texture failed to load:', err));

function drawCars(scene, poses) {
  if (!carModel) return;
  const S = FLOATS_PER_VERTEX * 4;
  gl.useProgram(carProgram);
  gl.bindBuffer(gl.ARRAY_BUFFER, carModel.buffer);
  gl.enableVertexAttribArray(carLoc.aPosition);
  gl.vertexAttribPointer(carLoc.aPosition, 3, gl.FLOAT, false, S, 0);
  gl.enableVertexAttribArray(carLoc.aNormal);
  gl.vertexAttribPointer(carLoc.aNormal, 3, gl.FLOAT, false, S, 12);
  gl.enableVertexAttribArray(carLoc.aTexCoord);
  gl.vertexAttribPointer(carLoc.aTexCoord, 2, gl.FLOAT, false, S, 24);
  setSceneUniforms(carLoc, scene);
  gl.activeTexture(gl.TEXTURE1);   // unit 0 belongs to Cameron's skybox cube map
  gl.uniform1i(carLoc.uTexture, 1);

  for (const car of raceCars) {
    const { pos, dir } = poses.get(car);
    const model = multiply(
      multiply(targetTo(pos, add(pos, dir), [0, 1, 0]), scaling(CAR_LENGTH, CAR_LENGTH, CAR_LENGTH)),
      carModel.fit);
    gl.uniformMatrix4fv(carLoc.uModel, false, model);
    let blending = false;
    for (const g of carModel.groups) {
      if (g.audiOnly && !car.team.original) continue;
      if (g.transparent && !blending) {
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.enable(gl.POLYGON_OFFSET_FILL);
        gl.polygonOffset(-1, -1);
        blending = true;
      }
      gl.bindTexture(gl.TEXTURE_2D, g.paint && car.team.paintTexture ? car.team.paintTexture : g.texture);
      gl.uniform3fv(carLoc.uBaseColor, g.color);
      gl.drawArrays(gl.TRIANGLES, g.start, g.count);
    }
    gl.disable(gl.BLEND);
    gl.disable(gl.POLYGON_OFFSET_FILL);
  }
  gl.disableVertexAttribArray(carLoc.aTexCoord);
  gl.activeTexture(gl.TEXTURE0);
}

// =====================================================================
//  CAMERAS
// =====================================================================
//   free    - WASD + mouse, like the other levels
//   tv      - cuts between the cameras below every few seconds, like a broadcast
//   chase   - behind the selected car
//   onboard - the driver's view
//   heli    - a TV helicopter tracking the selected car, zooming to keep it framed
//   blimp   - from the blimp's gondola, zooming in on the selected car
// Every camera is just an eye + a target (+ a field of view) for lookAt().
let cameraMode = 'tv';
let tvShot = 'chase', tvTimer = 0;
let chaseEye = null;
const tvHeli = { pos: null, dir: [0, 0, 1] };
let zoomFactor = 1;   // mouse wheel

const deg = d => d * Math.PI / 180;

// Field of view that keeps an object of `size` filling ~1/3 of the screen
// at distance `dist`: the narrower the view, the more it's zoomed in.
function zoomFov(size, dist) {
  return Math.min(deg(55), Math.max(deg(2.5), 2 * Math.atan((size * 1.6 * zoomFactor) / dist)));
}

function updateTvHeli(dt, carPos, carDir) {
  // Hover above and to the side of the car, a little behind, and glide there
  const side = [carDir[2], 0, -carDir[0]];
  const want = [carPos[0] + side[0] * 14 - carDir[0] * 8, carPos[1] + 16, carPos[2] + side[2] * 14 - carDir[2] * 8];
  if (!tvHeli.pos) tvHeli.pos = want;
  const k = 1 - Math.exp(-dt * 0.9);
  const old = tvHeli.pos;
  tvHeli.pos = old.map((v, i) => v + (want[i] - v) * k);
  const move = subtract(tvHeli.pos, old);
  if (Math.hypot(move[0], move[2]) > 1e-4) tvHeli.dir = normalize([move[0], 0, move[2]]);
}

function cameraFor(dt, poses, blimpPos) {
  const free = {
    eye: [cameraVec3[X], cameraVec3[Y], cameraVec3[Z]],
    target: [lookAtVec3[X], lookAtVec3[Y], lookAtVec3[Z]],
    fov: deg(45), near: 0.1,
  };
  if (cameraMode === 'free' || !selectedCar || !poses.size) return free;

  let shot = cameraMode;
  if (cameraMode === 'tv') {
    tvTimer += dt;
    if (tvTimer > 7) {
      tvTimer = 0;
      const shots = ['chase', 'heli', 'onboard', 'blimp', 'heli'];
      tvShot = shots[(shots.indexOf(tvShot) + 1 + Math.floor(Math.random() * 2)) % shots.length];
      chaseEye = null;
      // Broadcast director: follow the closest battle on track
      if (race.state === 'racing') {
        const order = standings();
        let best = null, bestGap = Infinity;
        for (let i = 1; i < order.length; i++) {
          const g = trackGap(order[i], order[i - 1]);
          if (g > 0 && g < bestGap) { bestGap = g; best = order[i]; }
        }
        if (best) selectedCar = best;
      }
    }
    shot = tvShot;
  }

  const { pos, dir } = poses.get(selectedCar);
  const L = CAR_LENGTH;

  if (shot === 'onboard') {
    const ahead = pathAt(selectedCar.d + L * 3.5);
    const hs = Number(heightSlider.value);
    return {
      eye: [pos[0] + dir[0] * L * 0.02, pos[1] + L * 0.2, pos[2] + dir[2] * L * 0.02],
      target: [ahead.x + (pos[0] - pathAt(selectedCar.d).x), roadGroundAt(selectedCar.d + L * 3.5) * hs + ROAD_THICKNESS + L * 0.12,
               ahead.z + (pos[2] - pathAt(selectedCar.d).z)],
      fov: deg(70), near: 0.02,
    };
  }
  if (shot === 'chase') {
    const want = [pos[0] - dir[0] * L * 2.6, pos[1] + L * 0.9, pos[2] - dir[2] * L * 2.6];
    const k = chaseEye ? 1 - Math.exp(-dt * 6) : 1;
    chaseEye = (chaseEye || want).map((v, i) => v + (want[i] - v) * k);
    return { eye: chaseEye, target: [pos[0] + dir[0] * L, pos[1] + L * 0.25, pos[2] + dir[2] * L], fov: deg(50), near: 0.05 };
  }
  if (shot === 'heli') {
    const eye = [tvHeli.pos[0], tvHeli.pos[1] - 0.6, tvHeli.pos[2]];
    return { eye, target: [pos[0], pos[1] + L * 0.15, pos[2]], fov: zoomFov(L, Math.hypot(...subtract(pos, eye))), near: 0.5 };
  }
  // blimp: from just under the gondola
  const eye = [blimpPos[0], blimpPos[1] - BLIMP_LENGTH * 0.28, blimpPos[2]];
  return { eye, target: [pos[0], pos[1] + L * 0.15, pos[2]], fov: zoomFov(L, Math.hypot(...subtract(pos, eye))), near: 0.5 };
}

// =====================================================================
//  UI: buttons, leaderboard, HUD
// =====================================================================
document.querySelectorAll('.raceSpeed').forEach(b => b.addEventListener('click', () => {
  raceSpeed = Number(b.dataset.speed);
  document.querySelectorAll('.raceSpeed').forEach(x => x.classList.toggle('active', x === b));
}));
document.querySelectorAll('.camMode').forEach(b => b.addEventListener('click', () => {
  cameraMode = b.dataset.cam;
  chaseEye = null;
  tvTimer = 0;
  document.querySelectorAll('.camMode').forEach(x => x.classList.toggle('active', x === b));
}));
document.getElementById('restartRace').addEventListener('click', () => setupRace());
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  zoomFactor = Math.min(4, Math.max(0.25, zoomFactor * Math.exp(e.deltaY * 0.001)));
}, { passive: false });

const board = document.getElementById('boardRows');
const boardTitle = document.getElementById('boardTitle');
const hud = document.getElementById('hud');
board.addEventListener('click', e => {
  const row = e.target.closest('[data-short]');
  if (!row) return;
  selectedCar = raceCars.find(c => c.short === row.dataset.short);
  if (cameraMode === 'free' || cameraMode === 'tv') {
    cameraMode = 'chase';
    document.querySelectorAll('.camMode').forEach(x => x.classList.toggle('active', x.dataset.cam === 'chase'));
  }
  chaseEye = null;
});

let uiTimer = 0;
function updateRaceUI(dt) {
  uiTimer += dt;
  if (uiTimer < 0.25 || !raceCars.length) return;
  uiTimer = 0;
  const order = standings();
  const leader = order[0];
  const lap = Math.min(RACE_LAPS, Math.max(1, Math.floor(leader.d / raceLength) + 1));
  boardTitle.textContent = race.state === 'lights' ? 'MONZA · GRID'
    : race.state === 'racing' ? `MONZA · LAP ${lap} / ${RACE_LAPS}` : 'MONZA · FINISHED';

  const css = c => `rgb(${c.map(v => Math.round(v * 255)).join(',')})`;
  board.innerHTML = order.map((car, i) => {
    let gap;
    if (i === 0) gap = car.finished ? 'WINNER' : (race.state === 'lights' ? 'POLE' : 'LEADER');
    else if (car.finished && leader.finished) gap = '+' + (car.finishTime - leader.finishTime).toFixed(1) + 's';
    else {
      const meters = (leader.d - car.d) * metersPerUnit;
      if (meters > MONZA_LENGTH_M) gap = '+' + Math.floor(meters / MONZA_LENGTH_M) + ' LAP';
      else if (race.state === 'lights' || car.d <= 0) gap = '';
      else gap = '+' + Math.max(0, (car.finished ? car.finishTime : race.time) - leaderTimeAt(car.d)).toFixed(1) + 's';
    }
    const sel = car === selectedCar ? ' sel' : '';
    return `<div class="row${sel}" data-short="${car.short}">
      <span class="pos">${i + 1}</span>
      <span class="bar" style="background:${css(car.team.primary)}"></span>
      <span class="code">${car.short}</span>
      <span class="num">#${car.number}</span>
      <span class="gap">${gap}</span>
    </div>`;
  }).join('');

  // HUD: start lights, or the selected driver
  let lights = '';
  if (race.state === 'lights') {
    const on = Math.min(5, Math.floor(race.lights));
    lights = '<div class="lights">' + [0, 1, 2, 3, 4].map(i => `<span class="${i < on ? 'on' : ''}"></span>`).join('') + '</div>';
  }
  const s = selectedCar;
  const posNow = order.indexOf(s) + 1;
  const myLap = Math.min(RACE_LAPS, Math.max(1, Math.floor(s.d / raceLength) + 1));
  const flag = race.state === 'chequered' || race.state === 'finished' ? '🏁 ' : '';
  hud.innerHTML = lights + `<div class="driver" style="border-color:${css(s.team.primary)}">
      <b>${flag}P${posNow} · ${s.name}</b> <span>${s.team.name} #${s.number}</span>
      <span class="spd">${Math.round(s.v * 3.6)} km/h · Lap ${myLap}/${RACE_LAPS} · ${cameraMode === 'tv' ? 'TV: ' + tvShot : cameraMode}</span>
    </div>`;
}


// =====================================================================
//  DRAW (Level 4 Fun): simulate, place the camera, draw everything
// =====================================================================
function draw(now) {
  now *= 0.001;                    // seconds
  deltaTime = now - then;
  then = now;
  const realDt = Math.min(Math.max(deltaTime, 0), 0.1);

  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0.55, 0.75, 0.95, 1);
  gl.enable(gl.DEPTH_TEST);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // --- 1. Run the race simulation (in small steps, sped up by 1x/2x/3x)
  let simDt = realDt * raceSpeed;
  while (simDt > 1e-6) {
    const step = Math.min(simDt, 1 / 60);
    updateRace(step);
    simDt -= step;
  }

  // --- 2. Where everything is this frame (cameras need it before drawing)
  const poses = new Map();
  if (racePath.length) for (const car of raceCars) poses.set(car, carPose(car));
  blimpT += realDt / 90;
  if (blimpT > 1) blimpT -= 1;
  const blimpPos = bezier3(...BLIMP_PATH, blimpT);
  const blimpDir = bezierTangent3(...BLIMP_PATH, blimpT);
  if (selectedCar && poses.size) {
    const p = poses.get(selectedCar);
    updateTvHeli(realDt, p.pos, p.dir);
  }

  // --- 3. Camera
  const cam = cameraFor(realDt, poses, blimpPos);
  const activeShot = cameraMode === 'tv' ? tvShot : cameraMode;
  const aspect = canvas.width / canvas.height;
  const projection = perspective(cam.fov, aspect, cam.near, Math.max(600, (mapRows + mapCols) * 4));
  const view = lookAt(cam.eye, cam.target, [0, 1, 0]);

  // Cameron's skybox reads the global camera + field of view, so point
  // those at this frame's camera while it draws, then put them back.
  const savedEye = cameraVec3, savedTarget = lookAtVec3;
  cameraVec3 = cam.eye;
  lookAtVec3 = cam.target;
  fieldOfViewRadians = cam.fov;
  drawSkybox();
  cameraVec3 = savedEye;
  lookAtVec3 = savedTarget;

  // Sun + fog, shared by every shader
  const sunAngle = Number(sunSlider.value) * Math.PI / 180;
  const sunHeight = Math.sin(sunAngle);
  const scene = {
    view, projection,
    fogColor: [0.78, 0.82, 0.88],
    fogDensity: Number(fogSlider.value),
    lightDirection: [Math.cos(sunAngle), sunHeight, 0.3],
    lightColor: [1.0, 0.55 + 0.45 * sunHeight, 0.3 + 0.7 * sunHeight],
  };

  // --- 4. The whole static world in one draw call
  staticBatch.draw(scene);

  // --- 5. Moving cube objects (cube shader)
  useCubeProgram();
  gl.uniformMatrix4fv(uProjection, false, projection);
  gl.uniformMatrix4fv(uView, false, view);
  gl.uniform3fv(uFogColor, scene.fogColor);
  gl.uniform1f(uFogDensity, scene.fogDensity);
  gl.uniform3fv(uLightDirection, scene.lightDirection);
  gl.uniform3fv(uLightColor, scene.lightColor);

  drawBlimp(multiply(targetTo(blimpPos, add(blimpPos, blimpDir), [0, 1, 0]),
                     scaling(BLIMP_LENGTH, BLIMP_LENGTH, BLIMP_LENGTH)), now);

  // The two helicopters flying the shrunken track (from Level 3/4)
  if (racePath.length) {
    const n = TRACK_SEGMENTS.length;
    for (const heli of HELICOPTERS) {
      heli.s = (heli.s + realDt * heli.speed * heli.dir + n) % n;
      const seg = Math.floor(heli.s), t = heli.s - seg;
      const pts = heliSegmentPoints(seg, heli.shrink, heli.height);
      const pos = bezier3(...pts, t);
      const dir = bezierTangent3(...pts, t).map(v => v * heli.dir);
      drawHelicopter(multiply(multiply(targetTo(pos, add(pos, dir), [0, 1, 0]), rotationX(0.15)),
                              scaling(HELI_LENGTH, HELI_LENGTH, HELI_LENGTH)), now);
    }
  }

  // The TV helicopter tracking the selected car (hidden while we're riding in it)
  if (tvHeli.pos && selectedCar && activeShot !== 'heli') {
    const toCar = subtract(poses.get(selectedCar).pos, tvHeli.pos);
    const face = normalize([toCar[0], 0, toCar[2]]);
    drawHelicopter(multiply(multiply(targetTo(tvHeli.pos, add(tvHeli.pos, face), [0, 1, 0]), rotationX(0.12)),
                            scaling(HELI_LENGTH * 0.8, HELI_LENGTH * 0.8, HELI_LENGTH * 0.8)), now);
  }

  // A spinning diamond in team colors above the selected car
  if (selectedCar && poses.size && activeShot !== 'onboard') {
    const { pos } = poses.get(selectedCar);
    drawPart(multiply(translation(pos[0], pos[1] + CAR_LENGTH * 0.95 + 0.12 * Math.sin(now * 4), pos[2]),
                      multiply(rotationY(now * 2), rotationZ(Math.PI / 4))),
             [0, 0, 0], [0.2, 0.2, 0.2], selectedCar.team.primary);
  }

  // --- 6. The 22 cars (textured model shader)
  if (poses.size) drawCars(scene, poses);
  useCubeProgram();

  updateFps(deltaTime);
  updateRaceUI(realDt);
  requestAnimationFrame(draw);
}

// Draw the scene once when the page loads. Nothing moves, so we don't
// need to redraw again unless something changes.
requestAnimationFrame(draw);   // start the one and only render loop

// Redraw if the browser window changes size: the canvas has a new
// shape, so the viewport and aspect ratio must be updated.
// (To animate, you would instead call draw() every frame with
// requestAnimationFrame and change something - like the camera -
// a little each time.)
// Removed: draw() already loops with requestAnimationFrame and resizes the
// canvas every frame. Calling it on resize started an EXTRA loop each time,
// which stacked up and tanked the FPS.
// window.addEventListener('resize', draw);

function main(){
  // I think this will essentially be Calling draw in the request loop

  requestAnimationFrame(draw);
}

// Add Keypress stuff so the game can move
// Even though I used AI for the mouse looking, I did this all myself :)
document.addEventListener("keydown", (event) => {
    // Going to use these to find the axii to move at
    // Use th cross product to get the left and right parts
    const cameraToTarget = subtract(lookAtVec3, cameraVec3);
    const perp = normalize(cross(cameraToTarget, upVec3));
    // The forward part is known as the rejection (found out via https://www.vectorvisualizer.com/visualizer)
    // I found a formula online and applied it here
    const a = cameraToTarget
    const b = upVec3
    const projBonA = scale(b, (dot(a, b)) / (dot(b, b)));
    const rejection = subtract(a, projBonA);
    const forward = normalize(rejection); 

  const step = Number(moveSpeedSlider.value);   // camera speed slider
  const forwardStep = scale(forward, step);
  const sideStep = scale(perp, step);
  switch (event.key) {
    case "w":
      cameraVec3 = add(cameraVec3, forwardStep);
      lookAtVec3 = add(lookAtVec3, forwardStep);
      break;
    case "a":
      cameraVec3 = subtract(cameraVec3, sideStep);
      lookAtVec3 = subtract(lookAtVec3, sideStep);
    break;
      case "s":
      cameraVec3 = subtract(cameraVec3, forwardStep);
      lookAtVec3 = subtract(lookAtVec3, forwardStep);
    break;
      case "d":
      cameraVec3 = add(cameraVec3, sideStep);
      lookAtVec3 = add(lookAtVec3, sideStep);
    break;
    case "ArrowUp":
      //****TO DO: Change camera z position go further away
      cameraVec3[Y] += step; // Down is Z decrement
      lookAtVec3[Y] += step;
    break;
    case "ArrowDown":
      //****TO DO: Change camera z position go further away
      cameraVec3[Y] -= step; // Down is Z decrement
      lookAtVec3[Y] -= step;
    break;
    // Reset with shift R
    case 'R':
      cameraVec3[X] = startPosVec3[X]; // copy the values so we dont confuse the object
      cameraVec3[Y] = startPosVec3[Y];
      cameraVec3[Z] = startPosVec3[Z];
      lookAtVec3[X] = 0;
      lookAtVec3[Y] = 0;
      lookAtVec3[Z] = 0;
    break;

    default:
    return;
  }
});

var isHolding = false;
// Start the continuous loop
document.addEventListener('mousedown', (e) => {
  if (e.target.closest('#controls, #board')) return;   // clicking a slider/button shouldn't swing the camera
  if (e.button !== 0) return;
    isHolding = true;
});

// Stop the loop when released
document.addEventListener('mouseup', () => {
    isHolding = false;
});


// THIS IS AI GENERATED. I have no idea how to get this to work normally
var sensitivity = 0.004;

// Starting direction, from your current camera -> target
var dx = lookAtVec3[X] - cameraVec3[X];
var dy = lookAtVec3[Y] - cameraVec3[Y];
var dz = lookAtVec3[Z] - cameraVec3[Z];
var lookDist = Math.hypot(dx, dy, dz);

var yaw   = Math.atan2(dx, dz);
var pitch = Math.asin(dy / lookDist);

function applyLook() {
  lookAtVec3[X] = cameraVec3[X] + lookDist * Math.cos(pitch) * Math.sin(yaw);
  lookAtVec3[Y] = cameraVec3[Y] + lookDist * Math.sin(pitch);
  lookAtVec3[Z] = cameraVec3[Z] + lookDist * Math.cos(pitch) * Math.cos(yaw);
}

document.addEventListener('mousemove', (e) => {
  if (!isHolding) return;

  yaw   -= e.movementX * sensitivity;   // no limit: full 360
  pitch -= e.movementY * sensitivity;

  // Only clamp pitch (just short of straight up/down)
  const limit = Math.PI / 2 - 0.01;
  pitch = Math.max(-limit, Math.min(limit, pitch));

  applyLook();
});
