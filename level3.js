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
const canvas = document.getElementById('level3Canvas');
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
// Heights in the heightmap are 0..1 after sampling. The Height slider
// (default 10) sets how tall a cube with height 1 becomes, live.
const heightSlider = document.getElementById('heightScale');
// Camera speed slider: how far one WASD / arrow key press moves the camera.
const moveSpeedSlider = document.getElementById('moveSpeed');
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
  const u = 1 - t;
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return [
    a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
    a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
  ];
}

let trackCubes = [];     // small red cubes sampled along the curve
let controlCubes = [];   // the control points themselves (for explaining Beziers)
const TRACK_SPACING = 0.5;   // aim for a cube every half unit along the track

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
    for (let i = 0; i < steps; i++) {
      const [x, z] = bezier(p0, p1, p2, p3, i / steps);
      trackCubes.push({ x, z, ground: groundHeightAt(x, z) });
    }

    // P0/P3 are on the curve (anchors), P1/P2 are the handles.
    controlCubes.push({ x: p0[0], z: p0[1], ground: groundHeightAt(...p0), anchor: true });
    controlCubes.push({ x: p1[0], z: p1[1], ground: groundHeightAt(...p1), anchor: false });
    controlCubes.push({ x: p2[0], z: p2[1], ground: groundHeightAt(...p2), anchor: false });
  }
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
  gl.uniformMatrix4fv(uProjection, false, perspective(Math.PI / 4, aspect, 0.1, Math.max(400, (mapRows + mapCols) * 2)));

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
      scaling(1, cube.height * Number(heightSlider.value), 1),   // Height slider = tallest a cube can be
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

  // --- e. Draw the Bezier track on top of the landscape -------------
  // Each sample is a small flat cube: moved to its spot on the curve and
  // lifted to sit just above the ground cube underneath it.
  const heightScale = Number(heightSlider.value);
  if (showTrackBox.checked) {
    gl.uniform3fv(uColor, [1.0, 0.05, 0.05]);   // Monza red
    for (const c of trackCubes) {
      const model = multiply(
        translation(c.x, c.ground * heightScale + 0.05, c.z),
        scaling(0.7, 0.25, 0.7),
      );
      gl.uniformMatrix4fv(uModel, false, model);
      gl.drawArrays(gl.TRIANGLES, 0, VERTEX_COUNT);
    }
  }

  // Control points: yellow = anchors (on the curve), cyan = handles (pull the curve)
  if (showControlBox.checked) {
    for (const c of controlCubes) {
      gl.uniform3fv(uColor, c.anchor ? [1.0, 0.85, 0.1] : [0.1, 0.9, 1.0]);
      const model = multiply(
        translation(c.x, c.ground * heightScale + 0.05, c.z),
        scaling(0.6, 2.5, 0.6),
      );
      gl.uniformMatrix4fv(uModel, false, model);
      gl.drawArrays(gl.TRIANGLES, 0, VERTEX_COUNT);
    }
  }

  updateFps(deltaTime);
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
  if (e.target.closest('#controls')) return;   // clicking a slider/button shouldn't swing the camera
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
