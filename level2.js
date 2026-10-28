import {getFinalArrFromAssets} from './ColorAndHeightImageToArr.js'

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
const canvas = document.getElementById('level1Canvas');
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
    gl_Position = uProjection * uView * uModel * vec4(aPosition, 1.0);
  }
`;

const fragmentShaderSource = /* glsl */`
  precision mediump float;    // how accurate decimal numbers are (medium is plenty)

  uniform vec3 uColor;        // this cube's color (red, green, blue: 0..1)
  varying vec3 vNormal;       // received from the vertex shader

  void main() {
    // This runs once for EVERY PIXEL inside each triangle. The GPU blends
    // vNormal between the triangle's three corners, so each pixel gets
    // its own value. On a flat cube face all corners share the same
    // normal, so every pixel on that face gets the same one.

    // Simple lighting so we can tell the faces of a cube apart.
    // The light shines from above and slightly to the side.
    vec3 lightDirection = normalize(vec3(0.5, 1.0, 0.3));

    // dot() measures how closely two directions line up:
    //   1 = the face points straight at the light (brightest)
    //   0 = the face is sideways to the light
    //   negative = the face points away, so max() clamps it to 0 (dark)
    float brightness = max(dot(vNormal, lightDirection), 0.0);

    // Keep 30% "ambient" light so faces in shadow aren't pure black.
    float light = 0.3 + 0.7 * brightness;

    // gl_FragColor is the built-in output: the final color of this pixel.
    // Multiplying the cube's color by light darkens it on dim faces.
    gl_FragColor = vec4(uColor * light, 1.0);   // 1.0 = fully opaque
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
const maxHeight = 20;
const finalArr = await getFinalArrFromAssets("assets/MonzaSataliteJustTrack.png", "assets/MonzaHeightmapJustTrack.png", true);
var cubes = [];
for (let row = 0; row < finalArr.length -1 ; row++) {
  for (let col = 0; col < finalArr[0].length - 1; col++) {
    cubes.push({
      // x: (col - (GRID_SIZE - 1) / 2) * SPACING,
      x: (col - (finalArr.length - 1) / 2) * SPACING,
      // z: (row - (GRID_SIZE - 1) / 2) * SPACING,
      z: (row - (finalArr[0].length - 1) / 2) * SPACING,
      // height: 0.5 + Math.random() * 4,                        // 0.5 to 4.5
      height: finalArr[row][col].height * maxHeight, // Apply the height normal. 
      color: [finalArr[row][col].r, finalArr[row][col].g, finalArr[row][col].b],
    });
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

// globals we are going to be using for draw
var deltaTime = 0;
var then = 0;

const startPosVec3 = [20, 50, 20];
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
function draw(now) {
  // Difference in time (standard for the req anamation frame stuff)
  now *= 0.001; // convert to seconds
  deltaTime = now - then;
  then = now;

  // Get the arr we need to render the cubes
  // I have this using the ratio since it should be a tiny bit more accurate
  // --- a. Size the drawing area -------------------------------------
  // A canvas has two sizes: how big it looks on the page (set by CSS),
  // and how many pixels it actually has. If they don't match, the
  // picture gets stretched and blurry, so we make them match.
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;

  // The viewport tells WebGL which rectangle of the canvas to draw
  // into. After projection, the shader's output positions run from -1
  // to +1 on each axis; the viewport maps that range onto real pixels
  // (here, the whole canvas).
  gl.viewport(0, 0, canvas.width, canvas.height);

  // --- b. Wipe the previous picture ---------------------------------
  // clearColor only CHOOSES the color to clear with: black
  // (red, green, blue, alpha). Nothing is cleared until gl.clear().
  gl.clearColor(0, 0, 0, 1);

  // Depth testing makes near cubes hide far cubes, no matter which
  // order we draw them in. Each frame we clear the depth info too.
  //
  // How it works: alongside the colors, WebGL keeps a DEPTH BUFFER that
  // stores, for every pixel, how far away the closest thing drawn there
  // so far is. When a new pixel arrives, WebGL compares its distance to
  // the stored one and only keeps it if it is closer.
  gl.enable(gl.DEPTH_TEST);

  // Erase both the colors (to black) and the depth info (to "nothing
  // drawn yet") so the last picture doesn't leak into this one.
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // --- c. Set the camera --------------------------------------------
  // The camera is the same for every cube, so set it once.
  //
  // Projection: a 45° (PI / 4) field of view, the canvas's aspect ratio
  // so cubes aren't squashed, and a visible range from 0.1 to 100 units
  // away from the camera. Anything outside that range is not drawn.
  const aspect = canvas.width / canvas.height;
  gl.uniformMatrix4fv(uProjection, false, perspective(Math.PI / 4, aspect, 0.1, 100));

  // View: the camera sits at (14, 14, 18) - up and off to one side -
  // looks at the center of the grid (0, 0, 0), and +y is "up".
  // Try changing the first triple to move the camera around!
  //
  // (The `false` argument means "don't transpose the matrix".
  // WebGL requires it to be false.)
  // function lookAt(eye, target, up) { // I think up is a normal vector
  // gl.uniformMatrix4fv(uView, false, lookAt([14, 14, 18], [0, 0, 0], [0, 1, 0]));
  // gl.uniformMatrix4fv(uView, false, lookAt([cameraVec3[X], cameraVec3[Y], cameraVec3[X]], [0, 0, 0], [0, 1, 0]));
  gl.uniformMatrix4fv(uView, false, lookAt(
    [cameraVec3[X], cameraVec3[Y], cameraVec3[Z]], // Eye 
    [lookAtVec3[X], lookAtVec3[Y], lookAtVec3[Z]], // Look at
    [upVec3[X], upVec3[Y], upVec3[Z]] // up
  ));

  // --- d. Draw every cube -------------------------------------------
  // Draw every cube: same triangles each time, different uniforms.
  for (const cube of cubes) {
    // Build this cube's model matrix.
    // First stretch the cube to its height, then move it to its spot.
    // (In multiply(a, b), b happens first, so scaling goes on the right.)
    // y stays 0 in the translation because the cube's bottom already
    // sits at y = 0, so stretching it makes it grow upward.
    const model = multiply(
      translation(cube.x, 0, cube.z),
      scaling(1, cube.height, 1),
    );

    // Send this cube's uniforms to the shaders. They stay set until we
    // change them, so the next cube simply overwrites them.
    gl.uniformMatrix4fv(uModel, false, model);
    gl.uniform3fv(uColor, cube.color);   // 3fv = a vector of 3 floats

    // The actual draw call: "read VERTEX_COUNT (36) vertices from the
    // buffer, starting at vertex 0, and treat every 3 as a triangle."
    // For this call the GPU:
    //   1. runs the vertex shader once per vertex (36 times) to find
    //      where each corner lands on the screen
    //   2. figures out which pixels each triangle covers
    //   3. runs the fragment shader once per covered pixel to color it
    //   4. uses the depth test to keep only the closest pixels
    gl.drawArrays(gl.TRIANGLES, 0, VERTEX_COUNT);
  }

  requestAnimationFrame(draw);
}

// Draw the scene once when the page loads. Nothing moves, so we don't
// need to redraw again unless something changes.
draw();

// Redraw if the browser window changes size: the canvas has a new
// shape, so the viewport and aspect ratio must be updated.
// (To animate, you would instead call draw() every frame with
// requestAnimationFrame and change something - like the camera -
// a little each time.)
window.addEventListener('resize', draw);

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

    switch (event.key) {
    case "w":
      cameraVec3 = add(cameraVec3, forward);
      lookAtVec3 = add(lookAtVec3, forward);
      break;
    case "a":
      cameraVec3 = subtract(cameraVec3, perp);
      lookAtVec3 = subtract(lookAtVec3, perp);
    break;
      case "s":
      cameraVec3 = subtract(cameraVec3, forward);
      lookAtVec3 = subtract(lookAtVec3, forward);
    break;
      case "d":
      cameraVec3 = add(cameraVec3, perp);
      lookAtVec3 = add(lookAtVec3, perp);
    break;
    case "ArrowUp":
      //****TO DO: Change camera z position go further away
      cameraVec3[Y] += 1; // Down is Z decrement
      lookAtVec3[Y] += 1
    break;
    case "ArrowDown":
      //****TO DO: Change camera z position go further away
      cameraVec3[Y] -= 1; // Down is Z decrement
      lookAtVec3[Y] -= 1;
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
