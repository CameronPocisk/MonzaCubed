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
  //gl.clearColor(0, 0, 0, 1);
  gl.clearColor(0.55, 0.75, 0.95, 1)
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
  // (trackCubes is empty until the landscape has loaded - skip until then)
  if (showTrackBox.checked && trackCubes.length) {
    for (const c of trackCubes) {
      // Place + turn this piece of road to face along the curve (targetTo, like the blimp).
      // In the piece's own space: x = across the road, z = along it, y = up.
      const y = c.ground * heightScale;
      const piece = targetTo([c.x, y, c.z], [c.x + c.dir[X], y, c.z + c.dir[Z]], [0, 1, 0]);

      // Asphalt: one flat slab across the whole width, a bit longer than the
      // gap to the next sample so the pieces overlap with no holes.
      gl.uniformMatrix4fv(uModel, false,
        multiply(piece, scaling(ROAD_HALF_WIDTH * 2, ROAD_THICKNESS, TRACK_SPACING * 1.6)));
      gl.uniform3fv(uColor, ASPHALT);
      gl.drawArrays(gl.TRIANGLES, 0, VERTEX_COUNT);

      // White lines on both edges: slightly taller so they sit on top of the asphalt
      gl.uniform3fv(uColor, LINE_WHITE);
      for (const side of [-1, 1]) {
        gl.uniformMatrix4fv(uModel, false, multiply(piece, multiply(
          translation(side * (ROAD_HALF_WIDTH - LINE_WIDTH), 0, 0),
          scaling(LINE_WIDTH, ROAD_THICKNESS + 0.02, TRACK_SPACING * 1.6))));
        gl.drawArrays(gl.TRIANGLES, 0, VERTEX_COUNT);
      }
    }

    // Start / finish line: a checkerboard across the road where segment 0 begins
    const start = trackCubes[0];
    const startY = start.ground * heightScale;
    const startPiece = targetTo([start.x, startY, start.z],
                                [start.x + start.dir[X], startY, start.z + start.dir[Z]], [0, 1, 0]);
    const SQUARES = 8, sq = (ROAD_HALF_WIDTH * 2) / SQUARES;
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < SQUARES; i++) {
        gl.uniform3fv(uColor, (i + row) % 2 === 0 ? LINE_WHITE : [0.02, 0.02, 0.02]);
        gl.uniformMatrix4fv(uModel, false, multiply(startPiece, multiply(
          translation(-ROAD_HALF_WIDTH + sq * (i + 0.5), 0, (row - 0.5) * sq),
          scaling(sq, ROAD_THICKNESS + 0.03, sq))));
        gl.drawArrays(gl.TRIANGLES, 0, VERTEX_COUNT);
      }
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

  // Blimp 

  blimpT += deltaTime / 60;
  if (blimpT > 1) blimpT -= 1;   // loop back to the start
  const blimpPos = bezier3(...BLIMP_PATH, blimpT);
  const tangent  = bezierTangent3(...BLIMP_PATH, blimpT);          // which way it's moving
  const target   = [blimpPos[X] + tangent[X],                       // a point just ahead of it
                    blimpPos[Y] + tangent[Y],
                    blimpPos[Z] + tangent[Z]];
  // targetTo places + turns the blimp; scaling makes "1 blimp unit" = BLIMP_LENGTH world units
  const blimpMatrix = multiply(targetTo(blimpPos, target, [0, 1, 0]),
                               scaling(BLIMP_LENGTH, BLIMP_LENGTH, BLIMP_LENGTH));
  drawBlimp(blimpMatrix, now);

  // Cars
  // Wait until the landscape has loaded: the cars need the ground heights
  // (heightGrid) to sit on, and crashing here would stop the whole draw loop.
  if (heightGrid.length) {
    const dt = Math.min(deltaTime, 0.05);   // cap, so switching tabs can't teleport cars
    for (const car of cars) {
      // Chaos: every frame each car's pace and lane drift a little at random
      car.speed += (Math.random() - 0.5) * 0.6 * dt;
      car.speed = Math.min(Math.max(car.speed, 0.45), 0.75);   // keep it within limits
      car.lane += (Math.random() - 0.5) * 3 * dt;
      car.lane = Math.min(Math.max(car.lane, -1), 1);

      car.s += dt * car.speed;   // move forward a little every frame
      if (car.s >= TRACK_SEGMENTS.length) car.s -= TRACK_SEGMENTS.length;   // finished a lap
      const seg = Math.floor(car.s);
      const t = car.s - seg;

      // This segment's 4 control points, in world space, as 3D points on the ground (y = 0)
      const pts = TRACK_SEGMENTS[seg].map(p => {
        const [x, z] = blenderToWorld(p);
        return [x, 0, z];
      });

      const carPos = bezier3(...pts, t);         // where on the center line
      const carDir = bezierTangent3(...pts, t);  // which way the track goes here
      const roadGround = roadHeightAt(carPos[X], carPos[Z]);   // road height here (before moving to a lane)

      // Lanes: push the car sideways, perpendicular to the track direction.
      // cross(up, direction) points to the car's side (left/right).
      const side = normalize(cross([0, 1, 0], carDir));
      carPos[X] += side[X] * car.lane * LANE_WIDTH;
      carPos[Z] += side[Z] * car.lane * LANE_WIDTH;

      // Drive on top of the road surface
      carPos[Y] = roadGround * Number(heightSlider.value) + ROAD_THICKNESS;   // on top of the asphalt

      const carTarget = add(carPos, carDir);     // a point just ahead of the car
      const carMatrix = multiply(targetTo(carPos, carTarget, [0, 1, 0]), scaling(1.6, 1.6, 1.6));
      drawPart(carMatrix, [0, 0.1, 0], [0.35, 0.2, 1.0], [1, 1, 1]);   // white
    }
  }

  // TV helicopters
  if (trackCubes.length) {
    const dt = Math.min(deltaTime, 0.05);
    const n = TRACK_SEGMENTS.length;
    for (const heli of HELICOPTERS) {
      heli.s += dt * heli.speed * heli.dir;
      heli.s = (heli.s + n) % n;               // wrap both ways (it can fly backwards)
      const seg = Math.floor(heli.s);
      const t = heli.s - seg;

      const pts = heliSegmentPoints(seg, heli.shrink, heli.height);
      const pos = bezier3(...pts, t);
      const dir = bezierTangent3(...pts, t).map(v => v * heli.dir);   // flying backwards: flip the direction

      // Face along the curve (targetTo), dip the nose a little like a real
      // helicopter flying forward (rotationX), then scale to size.
      const heliMatrix = multiply(
        multiply(targetTo(pos, add(pos, dir), [0, 1, 0]), rotationX(0.15)),
        scaling(HELI_LENGTH, HELI_LENGTH, HELI_LENGTH),
      );
      drawHelicopter(heliMatrix, now);

      // With "Control points" on, show the shrunken flight path as a dotted line
      if (showControlBox.checked) {
        gl.uniform3fv(uColor, [1.0, 0.85, 0.1]);
        for (let k = 0; k < n; k++) {
          const p = heliSegmentPoints(k, heli.shrink, heli.height);
          for (let i = 0; i < 6; i++) {
            const q = bezier3(...p, i / 6);
            gl.uniformMatrix4fv(uModel, false, multiply(translation(q[X], q[Y], q[Z]), scaling(0.3, 0.3, 0.3)));
            gl.drawArrays(gl.TRIANGLES, 0, VERTEX_COUNT);
          }
        }
      }
    }
  }

  // Show Blimp Track

  // Blimp path: show the Bezier curve, its control points and control polygon
  if (showControlBox.checked) {
    // 1. The curve: a small white cube every 1/60 of the way along
    gl.uniform3fv(uColor, [1, 1, 1]);
    const SAMPLES = 60;
    for (let i = 0; i <= SAMPLES; i++) {
      const p = bezier3(...BLIMP_PATH, i / SAMPLES);
      gl.uniformMatrix4fv(uModel, false, multiply(translation(p[X], p[Y], p[Z]), scaling(0.6, 0.6, 0.6)));
      gl.drawArrays(gl.TRIANGLES, 0, VERTEX_COUNT);
    }

    // 2. Control points: yellow = anchors (on the curve), cyan = handles (pull it)
    BLIMP_PATH.forEach((p, i) => {
      const isAnchor = (i === 0 || i === 3);
      gl.uniform3fv(uColor, isAnchor ? [1.0, 0.85, 0.1] : [0.1, 0.9, 1.0]);
      gl.uniformMatrix4fv(uModel, false, multiply(translation(p[X], p[Y], p[Z]), scaling(2, 2, 2)));
      gl.drawArrays(gl.TRIANGLES, 0, VERTEX_COUNT);
    });

    // 3. Control polygon: dotted lines P0→P1→P2→P3
    gl.uniform3fv(uColor, [0.1, 0.9, 1.0]);
    for (let k = 0; k < 3; k++) {
      const a = BLIMP_PATH[k], b = BLIMP_PATH[k + 1];
      for (let s = 0; s <= 20; s++) {
        const f = s / 20;
        // straight-line blend from a to b: a*(1-f) + b*f
        const p = [a[X] * (1 - f) + b[X] * f, a[Y] * (1 - f) + b[Y] * f, a[Z] * (1 - f) + b[Z] * f];
        gl.uniformMatrix4fv(uModel, false, multiply(translation(p[X], p[Y], p[Z]), scaling(0.3, 0.3, 0.3)));
        gl.drawArrays(gl.TRIANGLES, 0, VERTEX_COUNT);
      }
    }
  }

  // Update the FPS counter (averaged over half a second)

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
