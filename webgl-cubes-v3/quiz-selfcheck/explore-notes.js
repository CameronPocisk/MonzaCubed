// =====================================================================
//  EXPLORE THE CODE: notes for the exploration page
// =====================================================================
//
// The exploration page shows the whole cube program (index.js, with its
// comments removed) before the quiz starts. Students can:
//   - hover over the code to see which SECTION it belongs to and what
//     that section does
//   - click a line to read a NOTE about that line
//
// The program is split into sections, in the order they appear in
// index.js. Each section has:
//   id       - a short unique name
//   title    - shown in the panel and on the section tag
//   card     - (optional) the quiz card that practices this code
//   summary  - what the section does, in a few sentences
//   links    - (optional) further reading: [link text, url] pairs
//   code     - the code for this section, comments removed. A backtick
//              inside the code must be written as \`
//   notes    - notes for single lines:
//                match - which line(s) the note belongs to:
//                          a string: the first line containing it, searched
//                                    after the previous string match (so
//                                    repeated lines are matched in order)
//                          a RegExp: every line it matches
//                text  - the note
//                links - (optional) [link text, url] pairs
//
// In summary and text, `backticks` show as code.
//
// The code here is a COPY. If index.js changes, update it here too.
// ---------------------------------------------------------------------

// Links to MDN's page for a WebGL function, e.g. mdn('bufferData').
const MDN_GL = 'https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/';
const mdn = (name) => [`MDN: gl.${name}()`, MDN_GL + name];

const WGF = 'https://webglfundamentals.org/webgl/lessons/';
const LOGL = 'https://learnopengl.com/';

const EXPLORE_SECTIONS = [
  // -------------------------------------------------------------------
  {
    id: 'context',
    title: 'Get the WebGL context',
    summary: "Find the `<canvas>` element in index.html and ask it for a WebGL 1 context. The context, `gl`, is the object every WebGL command goes through.",
    links: [
      ['WebGL Fundamentals: the basics', WGF + 'webgl-fundamentals.html'],
      ['MDN: getting started with WebGL', 'https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Getting_started_with_WebGL'],
    ],
    code: `
const canvas = document.getElementById('c');
const gl = canvas.getContext('webgl');`,
    notes: [
      {
        match: 'getElementById',
        text: "Finds the `<canvas id=\"c\">` element in index.html. A canvas is a rectangle on the page that a program can draw into.",
        links: [['MDN: getElementById()', 'https://developer.mozilla.org/en-US/docs/Web/API/Document/getElementById']],
      },
      {
        match: 'getContext',
        text: "Asks the canvas for a WebGL 1 context. It returns `null` if the browser or GPU can't do WebGL. Every drawing command is a method on `gl` (like `gl.drawArrays`), and every WebGL constant is a property of it (like `gl.TRIANGLES`).",
        links: [['MDN: canvas.getContext()', 'https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/getContext']],
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    id: 'vertex-shader',
    title: 'Vertex shader',
    card: 'Vertex shader',
    summary: "A small GLSL program that runs on the GPU once per vertex. It reads each vertex's position and normal from the buffer, transforms the position into clip space with the model, view, and projection matrices, and passes the normal on to the fragment shader.",
    links: [
      ['WebGL Fundamentals: shaders and GLSL', WGF + 'webgl-shaders-and-glsl.html'],
      ['LearnOpenGL: coordinate systems', LOGL + 'Getting-started/Coordinate-Systems'],
      ['GLSL ES 1.00 specification (PDF)', 'https://registry.khronos.org/OpenGL/specs/es/2.0/GLSL_ES_Specification_1.00.pdf'],
    ],
    code: `
const vertexShaderSource = \`
  attribute vec3 aPosition;
  attribute vec3 aNormal;

  uniform mat4 uModel;
  uniform mat4 uView;
  uniform mat4 uProjection;

  varying vec3 vNormal;

  void main() {
    vNormal = normalize(mat3(uModel) * aNormal);
    gl_Position = uProjection * uView * uModel * vec4(aPosition, 1.0);
  }
\`;`,
    notes: [
      {
        match: 'const vertexShaderSource',
        text: "The shader is stored as a JavaScript string. The backtick (a template literal) lets the string span many lines. JavaScript never runs this code: it is handed to the GPU driver, which compiles it (see \"Compiling and linking shaders\").",
      },
      {
        match: 'attribute vec3 aPosition',
        text: "`attribute` means a value that is different for every vertex, read from the buffer. `vec3` is 3 floats. This is the vertex's position (x, y, z) in model space: the cube's own coordinates, before it is placed in the world.",
      },
      {
        match: 'attribute vec3 aNormal',
        text: "The vertex's normal: a unit-length vector perpendicular to the surface, used for lighting. On this cube, every vertex of a face is given that face's normal, so each face is lit evenly and looks flat.",
      },
      {
        match: 'uniform mat4 uModel',
        text: "`uniform` means one value shared by every vertex in a draw call, set from JavaScript. `mat4` is a 4×4 matrix. The model matrix transforms model space to world space: it scales the cube to its height and moves it to its spot in the grid. It changes for every cube.",
      },
      {
        match: 'uniform mat4 uView',
        text: "The view matrix transforms world space to camera (view) space, as if the camera sat at the origin looking down −z. It is made by `lookAt()` and set once per frame.",
        links: [['LearnOpenGL: camera', LOGL + 'Getting-started/Camera']],
      },
      {
        match: 'uniform mat4 uProjection',
        text: "The projection matrix transforms camera space to clip space and adds perspective, so far things look smaller. It is made by `perspective()` and set once per frame.",
      },
      {
        match: 'varying vec3 vNormal',
        text: "`varying` means an output of the vertex shader that becomes an input of the fragment shader. The GPU interpolates it across each triangle, so every pixel gets a blend of the three corners' values.",
      },
      {
        match: 'void main()',
        text: "`main()` runs once for every vertex. Each cube has 36 vertices, so it runs 36 times per draw call, and the GPU runs many copies in parallel.",
      },
      {
        match: 'vNormal = normalize',
        text: "`mat3(uModel)` keeps the top-left 3×3 part of the model matrix and drops the translation, because a direction shouldn't be moved, only turned or scaled. Scaling can change the vector's length, so `normalize()` sets it back to 1. This works here because the cube is only scaled along the axes. In general, normals need the inverse transpose of the model matrix (the \"normal matrix\").",
        links: [['LearnOpenGL: basic lighting (normal matrix)', LOGL + 'Lighting/Basic-Lighting']],
      },
      {
        match: 'gl_Position',
        text: "`gl_Position` is the built-in output: the vertex's position in clip space. Read the multiplication right to left: model, then view, then projection. `vec4(aPosition, 1.0)` adds w = 1 so that the matrix's translation moves the point (with w = 0 it would be treated as a direction and not moved). After this, the GPU divides x, y, and z by w (the perspective divide).",
        links: [['WebGL Fundamentals: 3D perspective', WGF + 'webgl-3d-perspective.html']],
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    id: 'fragment-shader',
    title: 'Fragment shader',
    card: 'Fragment shader',
    summary: "A GLSL program that runs once for every pixel (fragment) a triangle covers. It uses the interpolated normal to compute simple directional lighting and outputs the cube's color, darker on faces turned away from the light.",
    links: [
      ['WebGL Fundamentals: directional lighting', WGF + 'webgl-3d-lighting-directional.html'],
      ['LearnOpenGL: basic lighting', LOGL + 'Lighting/Basic-Lighting'],
      ['The Book of Shaders', 'https://thebookofshaders.com/'],
    ],
    code: `
const fragmentShaderSource = \`
  precision mediump float;

  uniform vec3 uColor;
  varying vec3 vNormal;

  void main() {
    vec3 lightDirection = normalize(vec3(0.5, 1.0, 0.3));
    float brightness = max(dot(vNormal, lightDirection), 0.0);
    float light = 0.3 + 0.7 * brightness;
    gl_FragColor = vec4(uColor * light, 1.0);
  }
\`;`,
    notes: [
      {
        match: 'const fragmentShaderSource',
        text: "Like the vertex shader, this is GLSL stored in a JavaScript string, compiled later for the GPU.",
      },
      {
        match: 'precision mediump float',
        text: "In WebGL 1, fragment shaders have no default precision for floats, so the shader must choose one. `mediump` (medium precision) is plenty for colors and lighting.",
      },
      {
        match: 'uniform vec3 uColor',
        text: "The cube's color as red, green, blue, each from 0 to 1. Set from JavaScript before each cube is drawn.",
      },
      {
        match: 'varying vec3 vNormal',
        text: "Receives the normal from the vertex shader. The name and type must match the vertex shader's `varying` exactly. The value is interpolated between the triangle's corners. Here all three corners have the same normal, so every pixel on a face gets the same one.",
      },
      {
        match: 'void main()',
        text: "Runs once for every fragment (roughly, every pixel) inside every triangle. That is far more often than the vertex shader runs.",
      },
      {
        match: 'lightDirection',
        text: "The direction toward the light: up, and a little to the side. It is the same for every pixel, like sunlight (a directional light). It is normalized so the dot product below gives the cosine of the angle.",
      },
      {
        match: 'brightness',
        text: "For two unit vectors, `dot()` is the cosine of the angle between them: 1 when the face points straight at the light, 0 when it is side-on, and negative when it faces away. `max(…, 0.0)` turns negative values into 0. This is Lambert (diffuse) lighting.",
        links: [['Wikipedia: Lambertian reflectance', 'https://en.wikipedia.org/wiki/Lambertian_reflectance']],
      },
      {
        match: 'float light',
        text: "Adds 30% ambient light so faces turned away from the light aren't pure black. `light` ranges from 0.3 to 1.0.",
      },
      {
        match: 'gl_FragColor',
        text: "`gl_FragColor` is the built-in output: this pixel's final color as (red, green, blue, alpha). The cube's color is scaled by `light`, and alpha 1.0 means fully opaque.",
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    id: 'compile',
    title: 'Compiling and linking shaders',
    card: 'Compiling and linking shaders',
    summary: "Turn the two shader strings into a GPU program: compile each shader, attach both to a program, link them, and make that program the active one.",
    links: [
      ['WebGL Fundamentals: how it works', WGF + 'webgl-how-it-works.html'],
      ['MDN: adding 2D content (shader setup)', 'https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Adding_2D_content_to_a_WebGL_context'],
    ],
    code: `
function compileShader(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader));
  }
  return shader;
}

const program = gl.createProgram();
gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vertexShaderSource));
gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource));
gl.linkProgram(program);
gl.useProgram(program);`,
    notes: [
      {
        match: 'function compileShader',
        text: "A helper that compiles one shader. `type` is `gl.VERTEX_SHADER` or `gl.FRAGMENT_SHADER`; `source` is the GLSL string.",
      },
      {
        match: 'gl.createShader',
        text: "Creates an empty shader object of the given type.",
        links: [mdn('createShader')],
      },
      {
        match: 'gl.shaderSource',
        text: "Gives the shader its GLSL source code.",
        links: [mdn('shaderSource')],
      },
      {
        match: 'gl.compileShader',
        text: "Compiles the GLSL into code the GPU can run. Mistakes in the GLSL don't throw a JavaScript error here; they are only recorded, which is why the next line checks.",
        links: [mdn('compileShader')],
      },
      {
        match: 'getShaderParameter',
        text: "Asks whether compiling worked. `COMPILE_STATUS` is false if the GLSL had an error.",
        links: [mdn('getShaderParameter')],
      },
      {
        match: 'throw new Error',
        text: "`getShaderInfoLog` returns the compiler's error message (with a line number). Throwing it makes the error show up in the browser's console instead of failing silently.",
        links: [mdn('getShaderInfoLog')],
      },
      {
        match: 'return shader',
        text: "Returns the compiled shader so it can be attached to a program.",
      },
      {
        match: 'gl.createProgram',
        text: "A program is a vertex shader and a fragment shader linked together. The GPU always draws with a program.",
        links: [mdn('createProgram')],
      },
      {
        match: 'gl.VERTEX_SHADER',
        text: "Compiles the vertex shader and attaches it to the program.",
        links: [mdn('attachShader')],
      },
      {
        match: 'gl.FRAGMENT_SHADER',
        text: "Compiles the fragment shader and attaches it to the program.",
        links: [mdn('attachShader')],
      },
      {
        match: 'gl.linkProgram',
        text: "Links the two shaders. This is where each `varying` in the vertex shader is connected to the matching one in the fragment shader. This program doesn't check whether linking worked; a fuller version would check `gl.getProgramParameter(program, gl.LINK_STATUS)`.",
        links: [mdn('linkProgram'), mdn('getProgramParameter')],
      },
      {
        match: 'gl.useProgram',
        text: "Makes this the active program: the next draw calls (and uniform settings) use it. This program only has one, so it is set once.",
        links: [mdn('useProgram')],
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    id: 'vertices',
    title: 'Cube vertex data',
    card: 'Cube vertex data',
    summary: "One cube, 1 unit wide, with its bottom at y = 0, written as 12 triangles (2 per face × 6 faces) = 36 vertices. Each row is one vertex: its position (x, y, z), then its normal (nx, ny, nz). Every cube in the scene reuses this same data.",
    links: [
      ['MDN: Float32Array', 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Float32Array'],
      ['LearnOpenGL: hello triangle (vertex data)', LOGL + 'Getting-started/Hello-Triangle'],
    ],
    code: `
const cubeVertices = new Float32Array([
  -0.5, 0, 0.5,   0, 0, 1,
   0.5, 0, 0.5,   0, 0, 1,
   0.5, 1, 0.5,   0, 0, 1,
  -0.5, 0, 0.5,   0, 0, 1,
   0.5, 1, 0.5,   0, 0, 1,
  -0.5, 1, 0.5,   0, 0, 1,

  -0.5, 0, -0.5,  0, 0, -1,
   0.5, 1, -0.5,  0, 0, -1,
   0.5, 0, -0.5,  0, 0, -1,
  -0.5, 0, -0.5,  0, 0, -1,
  -0.5, 1, -0.5,  0, 0, -1,
   0.5, 1, -0.5,  0, 0, -1,

  -0.5, 1, -0.5,  0, 1, 0,
  -0.5, 1,  0.5,  0, 1, 0,
   0.5, 1,  0.5,  0, 1, 0,
  -0.5, 1, -0.5,  0, 1, 0,
   0.5, 1,  0.5,  0, 1, 0,
   0.5, 1, -0.5,  0, 1, 0,

  -0.5, 0, -0.5,  0, -1, 0,
   0.5, 0,  0.5,  0, -1, 0,
  -0.5, 0,  0.5,  0, -1, 0,
  -0.5, 0, -0.5,  0, -1, 0,
   0.5, 0, -0.5,  0, -1, 0,
   0.5, 0,  0.5,  0, -1, 0,

   0.5, 0, -0.5,  1, 0, 0,
   0.5, 1, -0.5,  1, 0, 0,
   0.5, 1,  0.5,  1, 0, 0,
   0.5, 0, -0.5,  1, 0, 0,
   0.5, 1,  0.5,  1, 0, 0,
   0.5, 0,  0.5,  1, 0, 0,

  -0.5, 0, -0.5, -1, 0, 0,
  -0.5, 1,  0.5, -1, 0, 0,
  -0.5, 1, -0.5, -1, 0, 0,
  -0.5, 0, -0.5, -1, 0, 0,
  -0.5, 0,  0.5, -1, 0, 0,
  -0.5, 1,  0.5, -1, 0, 0,
]);
const VERTEX_COUNT = 36;`,
    notes: [
      {
        match: 'new Float32Array',
        text: "A typed array of 32-bit floats: the exact binary format the GPU expects. A plain JavaScript array can't be copied into a GPU buffer directly.",
        links: [['MDN: Float32Array', 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Float32Array']],
      },
      {
        match: /,\s+0, 0, 1,$/,
        text: "A vertex of the FRONT face (the side facing +z). The first 3 numbers are its position (x, y, z); the last 3 are its normal (0, 0, 1), pointing toward +z. The 6 rows of this face make 2 triangles; the corners they share are listed twice because each triangle lists its own 3 corners.",
      },
      {
        match: /0, 0, -1,$/,
        text: "A vertex of the BACK face (−z). Position, then normal (0, 0, −1). The triangles' corners are listed in the opposite order from the front face, so they wind the same way when seen from outside the cube. (Winding only matters if face culling is turned on, which this program doesn't do.)",
      },
      {
        match: /0, 1, 0,$/,
        text: "A vertex of the TOP face. All of its positions have y = 1, and its normal (0, 1, 0) points straight up.",
      },
      {
        match: /0, -1, 0,$/,
        text: "A vertex of the BOTTOM face. All of its positions have y = 0 (the ground), and its normal (0, −1, 0) points down.",
      },
      {
        match: /\s1, 0, 0,$/,
        text: "A vertex of the RIGHT face. All of its positions have x = 0.5, and its normal (1, 0, 0) points toward +x.",
      },
      {
        match: /-1, 0, 0,$/,
        text: "A vertex of the LEFT face. All of its positions have x = −0.5, and its normal (−1, 0, 0) points toward −x.",
      },
      {
        match: 'VERTEX_COUNT',
        text: "6 faces × 2 triangles × 3 vertices = 36. `drawArrays` needs to know how many vertices to read.",
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    id: 'buffer',
    title: 'Creating and filling a buffer',
    card: 'Creating and filling a buffer',
    summary: "The GPU can't read JavaScript arrays while it draws, so the vertex data is copied into GPU memory, a buffer, once at startup. Every draw call then reads from that buffer.",
    links: [
      ['WebGL Fundamentals: how it works', WGF + 'webgl-how-it-works.html'],
      ['MDN: WebGLBuffer', 'https://developer.mozilla.org/en-US/docs/Web/API/WebGLBuffer'],
    ],
    code: `
const buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.bufferData(gl.ARRAY_BUFFER, cubeVertices, gl.STATIC_DRAW);`,
    notes: [
      {
        match: 'gl.createBuffer',
        text: "Creates a new, empty buffer on the GPU. `buffer` is a handle to it, not the data.",
        links: [mdn('createBuffer')],
      },
      {
        match: 'gl.bindBuffer',
        text: "Makes this buffer the current `ARRAY_BUFFER` (the slot for vertex data). Later buffer commands don't name a buffer; they act on whichever one is bound.",
        links: [mdn('bindBuffer')],
      },
      {
        match: 'gl.bufferData',
        text: "Copies the numbers in `cubeVertices` into the bound buffer. `STATIC_DRAW` is a hint that the data will be set once and drawn many times, so the driver can store it where the GPU reads it fastest. (`DYNAMIC_DRAW` would hint that it changes often.)",
        links: [mdn('bufferData')],
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    id: 'attributes',
    title: 'Describing the buffer layout (attributes)',
    card: 'Describing the buffer layout (attributes)',
    summary: "The buffer is just a list of numbers. These lines tell the GPU how to read it: for each vertex, the first 3 floats go to `aPosition` and the next 3 go to `aNormal`, and each vertex takes 24 bytes.",
    links: [
      ['WebGL Fundamentals: attributes', WGF + 'webgl-attributes.html'],
      ['MDN: vertexAttribPointer()', MDN_GL + 'vertexAttribPointer'],
    ],
    code: `
const BYTES_PER_FLOAT = 4;
const stride = 6 * BYTES_PER_FLOAT;

const aPosition = gl.getAttribLocation(program, 'aPosition');
gl.enableVertexAttribArray(aPosition);
gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, stride, 0);

const aNormal = gl.getAttribLocation(program, 'aNormal');
gl.enableVertexAttribArray(aNormal);
gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, stride, 3 * BYTES_PER_FLOAT);`,
    notes: [
      {
        match: 'BYTES_PER_FLOAT',
        text: "A 32-bit float takes 4 bytes. WebGL measures stride and offset in bytes, not in numbers.",
      },
      {
        match: 'const stride',
        text: "The stride is the number of bytes from the start of one vertex to the start of the next: 6 floats × 4 bytes = 24.",
      },
      {
        match: "getAttribLocation(program, 'aPosition')",
        text: "Asks the linked program which slot number (location) the `aPosition` attribute was given. The variable holds that number, not any data.",
        links: [mdn('getAttribLocation')],
      },
      {
        match: 'enableVertexAttribArray(aPosition)',
        text: "Says that this attribute should be read from a buffer (otherwise every vertex would get one constant value).",
        links: [mdn('enableVertexAttribArray')],
      },
      {
        match: 'vertexAttribPointer(aPosition',
        text: "Says how to read `aPosition` from the currently bound buffer: 3 numbers per vertex, of type `FLOAT`, not normalized (`false`), stepping `stride` bytes per vertex, starting at byte 0 of each vertex.",
        links: [mdn('vertexAttribPointer')],
      },
      {
        match: "getAttribLocation(program, 'aNormal')",
        text: "The slot number for `aNormal`. If the name were misspelled, this would return −1.",
        links: [mdn('getAttribLocation')],
      },
      {
        match: 'enableVertexAttribArray(aNormal)',
        text: "Reads `aNormal` from the buffer too.",
        links: [mdn('enableVertexAttribArray')],
      },
      {
        match: 'vertexAttribPointer(aNormal',
        text: "Same layout as `aPosition`, but the offset is `3 * BYTES_PER_FLOAT` = 12 bytes: skip past the 3 position floats to reach the normal.",
        links: [mdn('vertexAttribPointer')],
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    id: 'uniforms',
    title: 'Uniform locations',
    card: 'Uniform locations',
    summary: "Look up where each uniform lives in the program so its value can be set later, in `draw()`. Uniforms don't come from the buffer; their values are sent straight from JavaScript.",
    links: [
      ['WebGL Fundamentals: shaders and GLSL (uniforms)', WGF + 'webgl-shaders-and-glsl.html'],
    ],
    code: `
const uModel = gl.getUniformLocation(program, 'uModel');
const uView = gl.getUniformLocation(program, 'uView');
const uProjection = gl.getUniformLocation(program, 'uProjection');
const uColor = gl.getUniformLocation(program, 'uColor');`,
    notes: [
      {
        match: 'uModel',
        text: "The location of the model matrix uniform. This variable holds a location (an address in the program), not the matrix itself; the matrix is built per cube in `draw()`. If the name were misspelled, this would return `null`, and setting it would silently do nothing.",
        links: [mdn('getUniformLocation')],
      },
      {
        match: 'uView',
        text: "The location of the view (camera) matrix. Set once per frame.",
        links: [mdn('getUniformLocation')],
      },
      {
        match: 'uProjection',
        text: "The location of the projection matrix. Set once per frame.",
        links: [mdn('getUniformLocation')],
      },
      {
        match: 'uColor',
        text: "The location of the color uniform. Set once per cube.",
        links: [mdn('getUniformLocation')],
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    id: 'scene',
    title: 'The scene: a list of cubes',
    summary: "Plain JavaScript with no WebGL: build a list of 10 × 10 = 100 cubes laid out in a grid on the ground, centered on the origin, each with a random height and a random color.",
    links: [
      ['MDN: Math.random()', 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random'],
    ],
    code: `
const GRID_SIZE = 10;
const SPACING = 1.0;

const cubes = [];
for (let row = 0; row < GRID_SIZE; row++) {
  for (let col = 0; col < GRID_SIZE; col++) {
    cubes.push({
      x: (col - (GRID_SIZE - 1) / 2) * SPACING,
      z: (row - (GRID_SIZE - 1) / 2) * SPACING,
      height: 0.5 + Math.random() * 4,
      color: [Math.random(), Math.random(), Math.random()],
    });
  }
}`,
    notes: [
      {
        match: 'GRID_SIZE = 10',
        text: "The grid is GRID_SIZE × GRID_SIZE cubes: 100 here. Each cube is one draw call, so a much bigger grid gets slow quickly (1000 would be a million draw calls).",
      },
      {
        match: 'SPACING',
        text: "The distance between cube centers. The cubes are 1 unit wide, so 1.0 means they touch.",
      },
      {
        match: 'const cubes',
        text: "The scene is just an array of objects. WebGL never sees it; `draw()` reads it to decide what uniforms to set.",
      },
      {
        match: 'let row',
        text: "Rows run along z…",
      },
      {
        match: 'let col',
        text: "…and columns run along x.",
      },
      {
        match: 'x: (col',
        text: "Subtracting `(GRID_SIZE - 1) / 2` (4.5 here) centers the grid on the origin: columns 0 to 9 become x = −4.5 to 4.5.",
      },
      {
        match: 'z: (row',
        text: "The same centering for z. There is no y: every cube sits on the ground (y = 0).",
      },
      {
        match: 'height',
        text: "`Math.random()` is between 0 and 1, so heights run from 0.5 to 4.5. They change every time the page loads.",
      },
      {
        match: 'color',
        text: "A random [red, green, blue], each from 0 to 1: the format the `uColor` uniform expects.",
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    id: 'matrices',
    title: 'Matrix helpers: translate, scale, multiply',
    card: 'The model matrix',
    summary: "Functions that build 4×4 matrices as plain arrays of 16 numbers. WebGL expects column-major order: the first 4 numbers are the first column, so the translation (x, y, z) is in the last 4. Real projects usually use a library such as glMatrix.",
    links: [
      ['WebGL Fundamentals: 2D matrices', WGF + 'webgl-2d-matrices.html'],
      ['WebGL Fundamentals: matrix vs. math (column-major)', WGF + 'webgl-matrix-vs-math.html'],
      ['LearnOpenGL: transformations', LOGL + 'Getting-started/Transformations'],
      ['glMatrix library', 'https://glmatrix.net/'],
    ],
    code: `
function translation(x, y, z) {
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    x, y, z, 1,
  ];
}

function scaling(sx, sy, sz) {
  return [
    sx, 0,  0,  0,
    0,  sy, 0,  0,
    0,  0,  sz, 0,
    0,  0,  0,  1,
  ];
}

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
}`,
    notes: [
      {
        match: 'function translation',
        text: "Builds a matrix that moves a point by (x, y, z).",
      },
      {
        match: 'x, y, z, 1',
        text: "The last column (written as the last row, because the array is column-major). It holds the translation. It only affects points whose w is 1, which is why the vertex shader uses `vec4(aPosition, 1.0)`.",
      },
      {
        match: 'function scaling',
        text: "Builds a matrix that scales a point by (sx, sy, sz) along the axes. The scale factors sit on the diagonal.",
      },
      {
        match: 'function multiply',
        text: "Multiplies two 4×4 matrices. The result applies `b` first, then `a`. That is why the model matrix is `multiply(translation, scaling)`: scale first, then move.",
      },
      {
        match: 'new Array(16)',
        text: "Starts the result as 16 zeros, so the loop can add into each entry.",
      },
      {
        match: 'result[col * 4 + row]',
        text: "Entry (row, col) of the result is row `row` of `a` dotted with column `col` of `b`. In column-major order, entry (row, col) is at index `col * 4 + row`.",
      },
      {
        match: 'return result',
        text: "Returns the 16 numbers, ready to send to the GPU with `gl.uniformMatrix4fv`.",
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    id: 'perspective',
    title: 'Perspective projection',
    card: 'Perspective projection',
    summary: "Builds the projection matrix. It makes far things look smaller and squeezes everything between the near and far distances into clip space. It also copies −z into w, so the GPU's divide by w produces the perspective effect.",
    links: [
      ['WebGL Fundamentals: 3D perspective', WGF + 'webgl-3d-perspective.html'],
      ['Song Ho Ahn: the OpenGL projection matrix (derivation)', 'https://www.songho.ca/opengl/gl_projectionmatrix.html'],
    ],
    code: `
function perspective(fieldOfView, aspect, near, far) {
  const f = 1 / Math.tan(fieldOfView / 2);
  return [
    f / aspect, 0, 0,                               0,
    0,          f, 0,                               0,
    0,          0, (far + near) / (near - far),    -1,
    0,          0, (2 * far * near) / (near - far), 0,
  ];
}`,
    notes: [
      {
        match: 'function perspective',
        text: "`fieldOfView` is the vertical viewing angle in radians. `aspect` is canvas width / height. `near` and `far` are the closest and farthest distances that get drawn; anything outside them is clipped.",
      },
      {
        match: 'const f',
        text: "`f` grows as the field of view shrinks: a narrow field of view zooms in. At 90°, tan(45°) = 1, so f = 1.",
      },
      {
        match: 'f / aspect',
        text: "Scales x. Dividing by the aspect ratio stops a wide canvas from stretching everything sideways.",
      },
      {
        match: '0,          f, 0',
        text: "Scales y by `f`.",
      },
      {
        match: '(far + near) / (near - far)',
        text: "The third column (it multiplies z). `(far + near) / (near - far)` scales z; together with the translation in the next line, it maps depth so `near` ends at −1 and `far` at +1 after the divide. The −1 at the end copies −z into w. The camera looks down −z, so w becomes the distance in front of the camera.",
      },
      {
        match: '(2 * far * near)',
        text: "The rest of the depth mapping (the z translation). Because this term is divided by w, depth precision is concentrated near the camera. That is why `near` should not be set very small, and can never be 0.",
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    id: 'lookat',
    title: 'The camera (lookAt)',
    card: 'The camera (lookAt)',
    summary: "Builds the view matrix for a camera at `eye`, looking at `target`, with `up` as roughly up. It finds the camera's own x, y, and z axes, then builds a matrix that turns the world so the camera sits at the origin looking down −z.",
    links: [
      ['WebGL Fundamentals: 3D cameras', WGF + 'webgl-3d-camera.html'],
      ['LearnOpenGL: camera', LOGL + 'Getting-started/Camera'],
      ['Song Ho Ahn: lookAt', 'https://www.songho.ca/opengl/gl_camera.html'],
    ],
    code: `
function lookAt(eye, target, up) {
  const subtract = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const normalize = (a) => {
    const length = Math.hypot(a[0], a[1], a[2]);
    return [a[0] / length, a[1] / length, a[2] / length];
  };

  const zAxis = normalize(subtract(eye, target));
  const xAxis = normalize(cross(up, zAxis));
  const yAxis = cross(zAxis, xAxis);

  return [
    xAxis[0], yAxis[0], zAxis[0], 0,
    xAxis[1], yAxis[1], zAxis[1], 0,
    xAxis[2], yAxis[2], zAxis[2], 0,
    -dot(xAxis, eye), -dot(yAxis, eye), -dot(zAxis, eye), 1,
  ];
}`,
    notes: [
      {
        match: 'function lookAt',
        text: "`eye`, `target`, and `up` are each [x, y, z] arrays.",
      },
      {
        match: 'const subtract',
        text: "Small vector helpers, defined inside `lookAt` because nothing else needs them. `subtract` gives the vector from b to a.",
      },
      {
        match: 'const dot',
        text: "The dot product: how far one vector goes along another.",
      },
      {
        match: 'const cross',
        text: "The cross product: a vector perpendicular to both a and b. Its direction follows the right-hand rule.",
        links: [['Wikipedia: cross product', 'https://en.wikipedia.org/wiki/Cross_product']],
      },
      {
        match: 'const normalize',
        text: "Scales a vector to length 1, keeping its direction.",
      },
      {
        match: 'const zAxis',
        text: "The camera's z axis points from the target back to the eye: backward, because the camera looks down its own −z.",
      },
      {
        match: 'const xAxis',
        text: "The camera's right direction: perpendicular to both up and z. If `up` were parallel to the viewing direction, the cross product would be zero and this would break.",
      },
      {
        match: 'const yAxis',
        text: "The camera's true up, perpendicular to the other two. It is already length 1, because z and x are unit length and perpendicular.",
      },
      {
        match: 'xAxis[0], yAxis[0]',
        text: "The top-left 3×3 part rotates the world into the camera's axes. Each axis is laid out as a row of the matrix (each array line here is a column), which makes it the inverse of the camera's rotation.",
      },
      {
        match: '-dot(xAxis, eye)',
        text: "The translation: moves the world so the eye ends up at the origin, measured along the camera's own axes.",
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    id: 'prepare',
    title: 'Preparing to draw a frame',
    card: 'Preparing to draw a frame',
    summary: "The start of `draw()`. Everything before this ran once to set things up. Here, each time a picture is drawn: match the canvas size to the window, set the viewport, and clear the old colors and depth.",
    links: [
      ['WebGL Fundamentals: resizing the canvas', WGF + 'webgl-resizing-the-canvas.html'],
      ['LearnOpenGL: depth testing', LOGL + 'Advanced-OpenGL/Depth-testing'],
    ],
    code: `
function draw() {
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0, 0, 0, 1);
  gl.enable(gl.DEPTH_TEST);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);`,
    notes: [
      {
        match: 'function draw',
        text: "`draw()` makes one picture. It runs when the page loads and again whenever the window is resized.",
      },
      {
        match: 'canvas.width',
        text: "A canvas has two sizes: how big it looks on the page (`clientWidth`, set by CSS) and how many pixels it has (`width`). If they differ, the picture is stretched. This makes them match in CSS pixels. High-DPI screens would also need `window.devicePixelRatio` to be fully sharp.",
        links: [
          ['MDN: clientWidth', 'https://developer.mozilla.org/en-US/docs/Web/API/Element/clientWidth'],
          ['MDN: devicePixelRatio', 'https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio'],
        ],
      },
      {
        match: 'canvas.height',
        text: "The same for the height.",
      },
      {
        match: 'gl.viewport',
        text: "Tells WebGL which rectangle of the canvas to draw into: here the whole canvas. It maps normalized device coordinates (−1 to +1 on x and y, after the divide by w) to pixel positions.",
        links: [mdn('viewport')],
      },
      {
        match: 'gl.clearColor',
        text: "Only chooses the color to clear with: black (red, green, blue, alpha). Nothing is cleared until `gl.clear()`.",
        links: [mdn('clearColor')],
      },
      {
        match: 'gl.enable(gl.DEPTH_TEST)',
        text: "Turns on depth testing. WebGL keeps a depth buffer with the distance of the closest thing drawn at each pixel so far, and only keeps a new pixel if it is closer. That way near cubes hide far ones, whatever order they are drawn in.",
        links: [mdn('enable'), ['LearnOpenGL: depth testing', LOGL + 'Advanced-OpenGL/Depth-testing']],
      },
      {
        match: 'gl.clear(',
        text: "Clears both the colors (to the clear color) and the depth buffer (to \"nothing drawn yet\"). The `|` combines the two flags so one call clears both.",
        links: [mdn('clear')],
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    id: 'camera',
    title: 'Setting the camera',
    card: 'The draw loop',
    summary: "The camera is the same for every cube, so the projection and view matrices are built and sent once per frame, before the loop.",
    links: [
      ['MDN: uniformMatrix4fv()', MDN_GL + 'uniformMatrix'],
    ],
    code: `
  const aspect = canvas.width / canvas.height;
  gl.uniformMatrix4fv(uProjection, false, perspective(Math.PI / 4, aspect, 0.1, 100));
  gl.uniformMatrix4fv(uView, false, lookAt([14, 14, 18], [0, 0, 0], [0, 1, 0]));`,
    notes: [
      {
        match: 'const aspect',
        text: "The canvas's width / height, read after resizing, so the projection matches the canvas's current shape.",
      },
      {
        match: 'uProjection',
        text: "Builds the projection matrix (45° vertical field of view = `Math.PI / 4`, the aspect ratio, and a visible range from 0.1 to 100 units) and sends it to the `uProjection` uniform. `4fv` means a 4×4 matrix of floats, given as an array. The `false` means \"don't transpose\"; WebGL 1 requires it to be false.",
        links: [['MDN: uniformMatrix4fv()', MDN_GL + 'uniformMatrix']],
      },
      {
        match: 'uView',
        text: "Puts the camera at (14, 14, 18), up and off to one side, looking at the center of the grid (0, 0, 0), with +y as up. Try changing the first [x, y, z] in index.js to move the camera.",
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    id: 'loop',
    title: 'The draw loop',
    card: 'The draw loop',
    summary: "For each cube: build its model matrix, send its uniforms, and draw the same 36 vertices from the buffer. The triangles are never sent again; each cube costs only a few uniforms and one draw call.",
    links: [
      ['WebGL Fundamentals: drawing multiple things', WGF + 'webgl-drawing-multiple-things.html'],
      ['MDN: drawArrays()', MDN_GL + 'drawArrays'],
    ],
    code: `
  for (const cube of cubes) {
    const model = multiply(
      translation(cube.x, 0, cube.z),
      scaling(1, cube.height, 1),
    );
    gl.uniformMatrix4fv(uModel, false, model);
    gl.uniform3fv(uColor, cube.color);
    gl.drawArrays(gl.TRIANGLES, 0, VERTEX_COUNT);
  }
}`,
    notes: [
      {
        match: 'for (const cube',
        text: "Loops over the 100 cubes in the scene list.",
      },
      {
        match: 'const model',
        text: "The cube's model matrix. In `multiply(a, b)`, b happens first: so the cube is scaled first, then moved.",
      },
      {
        match: 'translation(cube.x',
        text: "Moves the cube to its grid spot. y is 0 because the cube's bottom already sits at y = 0.",
      },
      {
        match: 'scaling(1, cube.height',
        text: "Scales the cube to its height on y only. The bottom is at y = 0, so scaling makes it grow upward. If it were moved first and then scaled, the scale would also stretch its position.",
      },
      {
        match: 'uniformMatrix4fv(uModel',
        text: "Sends this cube's model matrix. Uniforms keep their value until changed, so the next cube simply overwrites it.",
        links: [['MDN: uniformMatrix4fv()', MDN_GL + 'uniformMatrix']],
      },
      {
        match: 'gl.uniform3fv',
        text: "Sends this cube's color. `3fv` means a vector of 3 floats, given as an array.",
        links: [['MDN: uniform3fv()', MDN_GL + 'uniform']],
      },
      {
        match: 'gl.drawArrays',
        text: "The draw call: read 36 vertices from the buffer starting at vertex 0, and treat every 3 as a triangle. For this call the GPU runs the vertex shader 36 times, works out which pixels each triangle covers, runs the fragment shader for each of those pixels, and uses the depth test to keep the closest ones.",
        links: [mdn('drawArrays'), ['WebGL Fundamentals: how it works', WGF + 'webgl-how-it-works.html']],
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    id: 'start',
    title: 'Drawing on load and on resize',
    summary: "Draw the picture once when the page loads, and again whenever the window changes size. Nothing moves, so there's no need to redraw otherwise.",
    links: [
      ['WebGL Fundamentals: animation', WGF + 'webgl-animation.html'],
      ['MDN: requestAnimationFrame()', 'https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame'],
    ],
    code: `
draw();
window.addEventListener('resize', draw);`,
    notes: [
      {
        match: 'draw();',
        text: "Draws the scene once. To animate instead, you would call `draw()` every frame with `requestAnimationFrame` and change something (like the camera) a little each time.",
        links: [['MDN: requestAnimationFrame()', 'https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame']],
      },
      {
        match: 'addEventListener',
        text: "When the window is resized, the canvas has a new size and shape, so `draw()` runs again to update the canvas size, viewport, and aspect ratio. Note that `draw` is passed without `()`: the function itself is handed over, to be called later.",
        links: [['MDN: resize event', 'https://developer.mozilla.org/en-US/docs/Web/API/Window/resize_event']],
      },
    ],
  },
];
