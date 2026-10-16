// =====================================================================
//  QUIZ CARDS
// =====================================================================
//
// Each card shows one piece of the WebGL cube program (with its comments
// removed). There are no scores: students check their own work. Each card
// has four steps:
//   1. Summarize   - write a high-level summary of what the code does
//   2. Self-check  - compare their summary with the example and tick off
//                    the key ideas they covered
//   3. Match       - drag the example comments onto the right lines
//   4. Questions   - multiple-choice questions (5 per card)
// Anything missed goes on a review list shown at the end.
//
// Each card has:
//   code        - the uncommented code the student starts from
//   annotated   - the same code with example comments. Its code (with
//                 comments removed) must match `code` exactly. Each line's
//                 comment becomes one piece in the matching step: the
//                 comment at the end of the line, or else the comment on
//                 the line(s) just above it. Comments starting with "..."
//                 are placeholders and are skipped.
//   concepts    - the key ideas for the self-check list:
//                   label    - the idea, as the student sees it
//                   hint     - shown if the student doesn't tick the idea
//                   patterns - regular expressions (lowercase). If one
//                              matches the student's summary, the list
//                              points out the matching words as a hint.
//                              Nothing is ticked automatically.
//                   (need and weight are left over from the scored
//                   version in ../quiz and are ignored here.)
//   modelAnswer - an example summary
//   questions   - multiple-choice questions:
//                   ask      - the question (`backticks` show as code)
//                   choices  - { text, why, correct: true on exactly one }
//                              `why` is shown when that choice is picked,
//                              so wrong choices should explain the mistake.
//                              Choices are shuffled when shown.
//
// To add a card, copy an existing one and edit it.
// ---------------------------------------------------------------------

const CARDS = [
  // -------------------------------------------------------------------
  {
    title: 'Vertex shader',
    language: 'glsl',
    code: `
attribute vec3 aPosition;
attribute vec3 aNormal;

uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProjection;

varying vec3 vNormal;

void main() {
  vNormal = normalize(mat3(uModel) * aNormal);
  gl_Position = uProjection * uView * uModel * vec4(aPosition, 1.0);
}`,
    annotated: `
attribute vec3 aPosition;   // input: this vertex's position (x, y, z), read from the buffer
attribute vec3 aNormal;     // input: this vertex's normal vector, read from the buffer (used for lighting)

uniform mat4 uModel;        // model matrix: transforms the cube from model space to world space
uniform mat4 uView;         // view matrix: transforms world space to camera (view) space
uniform mat4 uProjection;   // projection matrix: transforms camera space to clip space, adding perspective

varying vec3 vNormal;       // output: the normal, passed to the fragment shader

void main() {               // runs once per vertex
  // Transform the normal by the 3×3 part of the model matrix (no translation), then normalize to length 1.
  // This works here because the cube is only scaled along the axes; in general normals need the inverse transpose.
  vNormal = normalize(mat3(uModel) * aNormal);
  // Transform the position by model, then view, then projection; gl_Position is the result in clip space
  gl_Position = uProjection * uView * uModel * vec4(aPosition, 1.0);
}`,
    concepts: [
      {
        label: 'It is the vertex shader, which runs on the GPU once per vertex',
        hint: 'This is a vertex shader: a small GPU program that runs once for every vertex (corner) of every triangle.',
        patterns: [/vertex shader|per vertex|each vertex|every vertex|each corner|every corner|each point/],
      },
      {
        label: 'Transforms the position with the model, view, and projection matrices',
        hint: 'The position is multiplied by uModel (place in the world), then uView (relative to the camera), then uProjection (perspective).',
        patterns: [/model|world/, /view|camera/, /projection|perspective|mvp|transform|matri/],
        need: 2,
        weight: 2,
      },
      {
        label: 'Outputs where the vertex lands on screen (gl_Position)',
        hint: 'gl_Position is the required output: where this vertex ends up on the screen (in clip space).',
        patterns: [/gl_position|screen|clip|lands|ends up|final position|output/],
      },
      {
        label: 'Passes the normal on to the fragment shader (varying)',
        hint: 'vNormal is a varying: it carries the (transformed) normal from the vertex shader to the fragment shader for lighting.',
        patterns: [/varying|normal.*(fragment|pass|send|hand)|(pass|send|hand).*normal/],
      },
      {
        label: 'Inputs: attributes (per vertex) and uniforms (shared by the whole draw)',
        hint: 'Attributes (aPosition, aNormal) come from the buffer and differ per vertex; uniforms (the matrices) are the same for every vertex in a draw call.',
        patterns: [/attribute|uniform|from the buffer|input/],
      },
    ],
    modelAnswer:
      'This is the vertex shader, a GPU program that runs once for each vertex. Its inputs are per-vertex attributes from the buffer (position and normal) and uniform matrices shared by the whole draw call. It transforms the vertex position by the model matrix (into the world), the view matrix (relative to the camera), and the projection matrix (perspective), and writes the result to gl_Position, which says where the vertex lands on screen. It also passes the normal to the fragment shader through a varying so lighting can be computed.',
    questions: [
      {
        ask: 'How many times does this shader\'s `main()` run when one cube is drawn?',
        choices: [
          { text: '36 times: once per vertex', correct: true,
            why: 'drawArrays sends the 36 vertices of the cube, and the vertex shader runs once for each one.' },
          { text: 'Once per cube',
            why: 'Once per cube is how often the uniforms change. The shader itself runs for every vertex.' },
          { text: 'Once per pixel',
            why: 'That is the fragment shader. The vertex shader runs per vertex.' },
          { text: '8 times, once per corner',
            why: 'A cube has 8 corners, but each face stores its own copies of its corners (with its own normal), so the buffer holds 36 vertices.' },
        ],
      },
      {
        ask: 'In `uProjection * uView * uModel * vec4(aPosition, 1.0)`, which matrix is applied to the position first?',
        choices: [
          { text: '`uModel`', correct: true,
            why: 'Matrix products act right to left: the matrix next to the vector goes first. The cube is placed in the world before anything else.' },
          { text: '`uProjection`',
            why: 'It is written first but applied last. Read the product from right to left.' },
          { text: '`uView`',
            why: 'The view matrix is applied second, after uModel has placed the cube in the world.' },
        ],
      },
      {
        ask: 'What is the difference between `aNormal` and `uModel`?',
        choices: [
          { text: '`aNormal` can be different for every vertex (it comes from the buffer); `uModel` is the same for every vertex in a draw call', correct: true,
            why: 'Attributes are read from the buffer, one value per vertex. Uniforms are set from JavaScript and shared by the whole draw call.' },
          { text: '`aNormal` is set from JavaScript before each draw; `uModel` comes from the buffer',
            why: 'It is the other way around: attributes come from the buffer, uniforms are set from JavaScript.' },
          { text: 'Both come from the buffer',
            why: 'Only attributes come from the buffer. uModel is a uniform, set with gl.uniformMatrix4fv.' },
        ],
      },
      {
        ask: '`aPosition` has three numbers (x, y, z), but the shader multiplies `vec4(aPosition, 1.0)`. Why add a fourth number, 1.0?',
        choices: [
          { text: 'The matrices are 4×4, so the vector needs four numbers, and a 1 lets the matrix move (translate) the point', correct: true,
            why: 'A 4×4 matrix multiplies a vector with four numbers. The fourth number, w, decides whether translation applies: with w = 1 the point is moved, with w = 0 it would not be.' },
          { text: 'The 1.0 is the opacity (alpha)',
            why: 'Alpha is the fourth number of a color. For a position, the fourth number is w.' },
          { text: 'It makes the position 1 unit long',
            why: 'Adding 1.0 does not change x, y, or z. It only adds a fourth number, w.' },
        ],
      },
      {
        ask: 'Why is `normalize()` called on `mat3(uModel) * aNormal`?',
        choices: [
          { text: 'The model matrix scales the cube, which changes the normal\'s length, and lighting needs length 1', correct: true,
            why: 'The top normal (0, 1, 0) scaled by a height of 3 becomes (0, 3, 0). normalize brings it back to length 1, so the dot product in the fragment shader gives a cosine.' },
          { text: 'It turns the normal toward the camera',
            why: 'normalize only changes a vector\'s length, never its direction.' },
          { text: 'It converts the normal to clip space',
            why: 'Only gl_Position goes to clip space. vNormal stays in world space, where the light direction is defined.' },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    title: 'Fragment shader',
    language: 'glsl',
    code: `
precision mediump float;

uniform vec3 uColor;
varying vec3 vNormal;

void main() {
  vec3 lightDirection = normalize(vec3(0.5, 1.0, 0.3));
  float brightness = max(dot(vNormal, lightDirection), 0.0);
  float light = 0.3 + 0.7 * brightness;
  gl_FragColor = vec4(uColor * light, 1.0);
}`,
    annotated: `
precision mediump float;    // floats in this shader use medium precision

uniform vec3 uColor;        // the cube's color as (r, g, b), each from 0 to 1
varying vec3 vNormal;       // the vertex normals, interpolated across the triangle for this fragment

void main() {               // runs once per fragment (each pixel a triangle covers)
  // Unit vector pointing toward a directional light: mostly up, tilted toward +x and +z
  vec3 lightDirection = normalize(vec3(0.5, 1.0, 0.3));
  // Diffuse brightness: dot = cosine of the angle between normal and light (both length 1 here); negatives become 0
  float brightness = max(dot(vNormal, lightDirection), 0.0);
  // 30% ambient + 70% diffuse, so surfaces facing away from the light are dim, not black
  float light = 0.3 + 0.7 * brightness;
  // Output color: the cube's color times the light, with alpha 1 (opaque)
  gl_FragColor = vec4(uColor * light, 1.0);
}`,
    concepts: [
      {
        label: 'It is the fragment shader, which runs once per pixel',
        hint: 'This is a fragment shader: it runs once for every pixel (fragment) covered by a triangle.',
        patterns: [/fragment shader|per pixel|each pixel|every pixel|per fragment|each fragment|every fragment/],
      },
      {
        label: 'Computes simple lighting from a light direction',
        hint: 'It shades the cube using a fixed light direction so the faces look different from each other.',
        patterns: [/light|shad|bright|illuminat/],
      },
      {
        label: 'Uses the dot product of the normal and light direction',
        hint: 'dot(normal, light) measures how directly the surface at this fragment faces the light: 1 = facing it, 0 or less = facing away (clamped by max).',
        patterns: [/dot|angle|cosine|facing|faces? (toward|towards|away)|points? (toward|towards|at)|line(s)? up|darker|dimmer|depending on (which way|the direction|direction)/],
        weight: 2,
      },
      {
        label: 'Adds ambient light so shadowed faces are not black',
        hint: 'The 0.3 is ambient light: even faces turned away from the light keep 30% of their color.',
        patterns: [/ambient|not (completely |pure |fully |totally )?black|minimum|base (light|brightness)|30 ?%|0\.3/],
      },
      {
        label: "Outputs the pixel's final color (cube color × light) via gl_FragColor",
        hint: "gl_FragColor is the output: the cube's color (uColor) scaled by the light amount, fully opaque.",
        patterns: [/gl_fragcolor|final colou?r|output|colou?r of (the|each|this) pixel|colou?rs? (each|every|the) pixel|ucolor|cube'?s colou?r|sets? the colou?r/],
      },
    ],
    modelAnswer:
      "This is the fragment shader, which runs once for each pixel covered by a triangle. It computes simple lighting: the dot product of the surface normal and a fixed light direction says how directly the surface faces the light (clamped to 0 when facing away). It adds 30% ambient light so faces in shadow aren't pure black, multiplies the cube's color by that light amount, and writes the result to gl_FragColor as the pixel's final color.",
    questions: [
      {
        ask: 'A face points directly away from the light, so `dot(vNormal, lightDirection)` is negative. How is that face drawn?',
        choices: [
          { text: 'At 30% of the cube\'s color', correct: true,
            why: 'max() clamps the negative value to 0, so light = 0.3 + 0.7 * 0 = 0.3. That is the ambient light.' },
          { text: 'Black',
            why: 'The 0.3 ambient term keeps faces in shadow from going completely black.' },
          { text: 'With inverted colors, because the value is negative',
            why: 'max(..., 0.0) clamps negative values to 0 before they are used, so nothing goes negative.' },
        ],
      },
      {
        ask: 'Why is every pixel on one face of a cube the same shade?',
        choices: [
          { text: 'All the face\'s vertices have the same normal, so the blended normal is the same on every pixel', correct: true,
            why: 'The GPU blends vNormal across the triangle, but blending identical values gives the same value everywhere.' },
          { text: 'The fragment shader runs only once per face',
            why: 'It runs once per pixel. The pixels just all receive the same inputs.' },
          { text: '`uColor` is set separately for each face',
            why: 'uColor is set once per cube, not per face. The shading difference comes from the normals.' },
        ],
      },
      {
        ask: 'What does the `1.0` in `vec4(uColor * light, 1.0)` mean?',
        choices: [
          { text: 'Alpha: the pixel is fully opaque', correct: true,
            why: 'A color vec4 is red, green, blue, alpha. 1.0 alpha means not transparent at all.' },
          { text: 'Full brightness',
            why: 'Brightness is already in uColor * light. The fourth value of a color is alpha (opacity).' },
          { text: 'The w coordinate used for perspective',
            why: 'w matters for gl_Position in the vertex shader. For a color, the fourth value is alpha.' },
        ],
      },
      {
        ask: 'A face\'s normal points exactly along `lightDirection`. What is `light` for that face?',
        choices: [
          { text: '1.0: the full cube color', correct: true,
            why: 'dot = 1, so brightness = 1 and light = 0.3 + 0.7 × 1 = 1.0.' },
          { text: '0.7',
            why: '0.7 is only the diffuse part. The 0.3 ambient part is added on top.' },
          { text: '1.3',
            why: 'The diffuse part is 0.7 × brightness, not 1 × brightness. The weights 0.3 and 0.7 add up to 1.' },
        ],
      },
      {
        ask: 'Why is `vec3(0.5, 1.0, 0.3)` normalized before it is used?',
        choices: [
          { text: 'The dot product equals the cosine of the angle only when both vectors have length 1', correct: true,
            why: 'This vector has length about 1.16. Without normalize, brightness could go above 1 and faces would look too bright.' },
          { text: 'normalize makes the light point downward, like sunlight',
            why: 'normalize keeps the direction the same and only changes the length.' },
          { text: 'GLSL requires every vec3 to be normalized',
            why: 'Only directions used for angles need length 1. Colors and positions are not normalized.' },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    title: 'Compiling and linking shaders',
    language: 'javascript',
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
    annotated: `
function compileShader(type, source) {   // compiles GLSL source code into a shader
  const shader = gl.createShader(type);  // create an empty shader (vertex or fragment)
  gl.shaderSource(shader, source);       // set the shader's GLSL source code
  gl.compileShader(shader);              // compile the source code
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {   // check whether compiling failed
    throw new Error(gl.getShaderInfoLog(shader));            // if it failed, throw an error with the compiler's message
  }
  return shader;                         // return the compiled shader
}

const program = gl.createProgram();      // create a program to hold the two shaders
// Compile the vertex shader and attach it to the program
gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vertexShaderSource));
// Compile the fragment shader and attach it to the program
gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource));
gl.linkProgram(program);                 // link the two shaders into one program the GPU can run
gl.useProgram(program);                  // use this program for all following draw calls`,
    concepts: [
      {
        label: 'Compiles the GLSL shader source code for the GPU',
        hint: 'The shader source is just a string; compileShader turns it into something the GPU can run.',
        patterns: [/compil/],
        weight: 2,
      },
      {
        label: 'Checks for and reports compile errors',
        hint: 'COMPILE_STATUS is checked, and if compiling failed the error log is thrown so you can see the GLSL mistake.',
        patterns: [/error|fail|status|log|throw|mistake|bug/],
      },
      {
        label: 'Combines the vertex and fragment shader into one program',
        hint: 'A program is a vertex shader + a fragment shader attached together.',
        patterns: [/attach|combin|together|both|pair|vertex (shader )?and (the )?fragment/],
      },
      {
        label: 'Links the program',
        hint: 'linkProgram connects the two shaders (e.g. matching varyings) into a finished program.',
        patterns: [/link/],
      },
      {
        label: 'Makes it the active program for drawing (useProgram)',
        hint: 'useProgram tells WebGL to use this program for the draw calls that follow.',
        patterns: [/useprogram|use (the |this )?program|active|current|select|tells? .*(to )?use/],
      },
    ],
    modelAnswer:
      'compileShader takes GLSL source code, compiles it for the GPU, and throws the error log if compiling fails. Then a program is created, the compiled vertex and fragment shaders are attached to it, the program is linked so the two shaders work together, and useProgram makes it the active program for the draw calls that follow.',
    questions: [
      {
        ask: 'If the GLSL source has a typo, when do you find out?',
        choices: [
          { text: 'When `compileShader` runs: the code checks COMPILE_STATUS and throws the error log', correct: true,
            why: 'The GPU driver compiles the GLSL at startup, and this code checks the result right away.' },
          { text: 'When the JavaScript file loads',
            why: 'To JavaScript the shader is just a string. It is not checked until the driver compiles it.' },
          { text: 'Only when drawArrays runs',
            why: 'Compiling happens at startup, before any drawing, and this code checks for errors immediately.' },
        ],
      },
      {
        ask: 'What does `gl.linkProgram` do that compiling each shader does not?',
        choices: [
          { text: 'Connects the two shaders into one program, e.g. matching the vertex shader\'s varyings to the fragment shader\'s', correct: true,
            why: 'Each shader is compiled on its own. Linking checks that they fit together and produces the finished program.' },
          { text: 'Compiles the fragment shader',
            why: 'Both shaders were already compiled by compileShader before they were attached.' },
          { text: 'Sends the vertex data to the GPU',
            why: 'That is bufferData. Linking only deals with the shader program.' },
        ],
      },
      {
        ask: 'Why call `gl.useProgram(program)`?',
        choices: [
          { text: 'So the draw calls that follow use these shaders', correct: true,
            why: 'WebGL can hold many programs. useProgram picks the one that later draw calls (and uniform calls) apply to.' },
          { text: 'To run the shaders once and test them',
            why: 'Shaders only run during draw calls. useProgram just selects which program they will use.' },
          { text: 'To free the memory used by the shader source',
            why: 'useProgram does not free anything. It makes this program the current one.' },
        ],
      },
      {
        ask: 'What does `gl.getShaderInfoLog(shader)` return?',
        choices: [
          { text: 'The compiler\'s error and warning messages for that shader', correct: true,
            why: 'If compiling fails, the log says which line is wrong and why. Throwing it shows the message in the console.' },
          { text: 'The GLSL source code',
            why: 'The source was given with gl.shaderSource. The info log is the compiler\'s output.' },
          { text: 'A list of the shader\'s attributes and uniforms',
            why: 'Those are looked up later, with getAttribLocation and getUniformLocation.' },
        ],
      },
      {
        ask: 'Why is `compileShader` written as a function?',
        choices: [
          { text: 'The same steps are needed for both the vertex shader and the fragment shader', correct: true,
            why: 'It is called twice: once with gl.VERTEX_SHADER and once with gl.FRAGMENT_SHADER.' },
          { text: 'WebGL requires shaders to be compiled inside a function',
            why: 'There is no such rule. The function only avoids writing the same steps twice.' },
          { text: 'So the shaders are recompiled every frame',
            why: 'It runs only twice, at startup. The linked program is reused for every draw.' },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    title: 'Cube vertex data',
    language: 'javascript',
    code: `
const cubeVertices = new Float32Array([
  -0.5, 0, 0.5,   0, 0, 1,
   0.5, 0, 0.5,   0, 0, 1,
   0.5, 1, 0.5,   0, 0, 1,
  -0.5, 0, 0.5,   0, 0, 1,
   0.5, 1, 0.5,   0, 0, 1,
  -0.5, 1, 0.5,   0, 0, 1,

  // ... 5 more faces, 6 rows each
]);
const VERTEX_COUNT = 36;`,
    annotated: `
const cubeVertices = new Float32Array([   // vertex data as 32-bit floats (matches gl.FLOAT in vertexAttribPointer)
  // Front face: 2 triangles = 6 vertices. Each row: position x, y, z, then normal nx, ny, nz.
  // Every vertex of this face gets the face's normal (0, 0, 1), so corners are repeated for each face.
  -0.5, 0, 0.5,   0, 0, 1,
   0.5, 0, 0.5,   0, 0, 1,
   0.5, 1, 0.5,   0, 0, 1,
  -0.5, 0, 0.5,   0, 0, 1,
   0.5, 1, 0.5,   0, 0, 1,
  -0.5, 1, 0.5,   0, 0, 1,

  // ... 5 more faces, 6 rows each
]);
const VERTEX_COUNT = 36;                  // total vertices: 6 faces × 2 triangles × 3 vertices`,
    concepts: [
      {
        label: 'Defines the geometry of a cube',
        hint: 'This array is the shape data for one cube, shared by every cube in the scene.',
        patterns: [/cube|geometry|shape|mesh|model/],
      },
      {
        label: 'The cube is built from triangles',
        hint: 'WebGL only draws points, lines, and triangles, so each square face is made of 2 triangles.',
        patterns: [/triangle/],
        weight: 2,
      },
      {
        label: 'Each vertex has a position (x, y, z)',
        hint: 'The first 3 numbers of each row are the vertex position: x, y, z.',
        patterns: [/position|x,? ?y,? ?(and )?z|xyz|coordinate|corner|location/],
      },
      {
        label: 'Each vertex has a normal vector, used for lighting',
        hint: 'The last 3 numbers of each row are the vertex normal, used for lighting. On this cube, every vertex of a face is given that face\'s normal.',
        patterns: [/normal/],
      },
      {
        label: '36 vertices = 6 faces × 2 triangles × 3 vertices',
        hint: '6 faces × 2 triangles per face × 3 vertices per triangle = 36 vertices.',
        patterns: [/36|thirty.six|(6|six) faces|(2|two) triangles|(12|twelve) triangles|(6|six) (vertices|vertexes|rows|points) (per|for each|a) face/],
      },
      {
        label: 'Stored as 32-bit floats (Float32Array), the format the GPU expects',
        hint: 'Float32Array packs the numbers as 32-bit floats, ready to be copied straight into a GPU buffer.',
        patterns: [/float|typed array|32.?bit/],
      },
    ],
    modelAnswer:
      'This is the geometry for one cube, stored as a Float32Array (32-bit floats, the format the GPU expects). The cube is made of triangles: 6 faces × 2 triangles × 3 vertices = 36 vertices. Each row is one vertex with 6 numbers: its position (x, y, z) followed by its normal (used for lighting). Every vertex of a face is given that face\'s normal, so the cube is lit with flat faces.',
    questions: [
      {
        ask: 'A cube has only 8 corners. Why does it need 36 vertices?',
        choices: [
          { text: 'Each of the 6 faces is 2 triangles of 3 vertices, and corners are repeated so each face has its own normal', correct: true,
            why: '6 × 2 × 3 = 36. A corner shared by 3 faces needs 3 different normals, so it is stored 3 times.' },
          { text: 'WebGL needs 36 vertices for any 3D shape',
            why: 'The count depends on the shape. 36 comes from 12 triangles × 3 vertices.' },
          { text: 'The extra vertices make the edges smoother',
            why: 'Repeating vertices gives each face its own flat normal, which keeps the edges sharp. A smooth mesh does the opposite: it shares each vertex and gives it one normal averaged from the faces around it.' },
        ],
      },
      {
        ask: 'In the row `0.5, 1, 0.5,   0, 0, 1`, what do the last three numbers mean?',
        choices: [
          { text: 'The vertex normal: here it is the front face\'s normal, pointing toward +z', correct: true,
            why: 'Each row is a position (x, y, z) followed by a normal (nx, ny, nz). On this cube, every vertex of a face is given that face\'s normal.' },
          { text: 'The color of the vertex',
            why: 'Color comes from the uColor uniform, not from the buffer.' },
          { text: 'A second position for the same vertex',
            why: 'Each vertex has one position: the first three numbers. The last three are its normal.' },
        ],
      },
      {
        ask: 'Why does the cube go from y = 0 to y = 1, instead of being centered on the origin?',
        choices: [
          { text: 'So that stretching it to a height keeps it sitting on the ground', correct: true,
            why: 'Scaling multiplies y. A cube from 0 to 1 stretches upward from y = 0; a centered cube would also sink below the ground.' },
          { text: 'WebGL cannot draw negative y values',
            why: 'Negative coordinates are fine. The choice is about how scaling behaves.' },
          { text: 'So the camera can see it',
            why: 'The camera can see either version. The bottom at y = 0 is so stretched cubes stay on the ground.' },
        ],
      },
      {
        ask: 'Which normal would each vertex of the top face (y = 1) be given?',
        choices: [
          { text: '`0, 1, 0`', correct: true,
            why: 'The top face points up, along +y, so each of its 6 vertices is given (0, 1, 0).' },
          { text: '`0, 0, 1`',
            why: 'That is the front face\'s normal, pointing toward +z.' },
          { text: '`0, -1, 0`',
            why: 'That points down. It is the bottom face\'s normal.' },
          { text: '`1, 1, 1`',
            why: 'That points diagonally and has length about 1.73. A normal is a unit-length direction.' },
        ],
      },
      {
        ask: 'In a smooth mesh, such as a sphere, how is a vertex normal usually computed?',
        choices: [
          { text: 'By averaging the normals of the faces that share the vertex', correct: true,
            why: 'Each shared vertex gets one averaged normal. Interpolating between those normals makes the shading change smoothly across faces.' },
          { text: 'By copying the normal of one face that uses the vertex',
            why: 'That gives flat shading with sharp edges, which is what this cube does on purpose.' },
          { text: 'Smooth meshes do not need normals',
            why: 'Lighting needs a normal at every vertex, smooth or not.' },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    title: 'Creating and filling a buffer',
    language: 'javascript',
    code: `
const buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.bufferData(gl.ARRAY_BUFFER, cubeVertices, gl.STATIC_DRAW);`,
    annotated: `
const buffer = gl.createBuffer();          // create a new buffer object (it holds no data yet)
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);    // bind it as the current vertex-data buffer (ARRAY_BUFFER)
// Copy the vertex data into the bound buffer; STATIC_DRAW hints it is set once and drawn many times
gl.bufferData(gl.ARRAY_BUFFER, cubeVertices, gl.STATIC_DRAW);`,
    concepts: [
      {
        label: 'Creates a new buffer',
        hint: 'createBuffer reserves a new, empty buffer object.',
        patterns: [/creat|make|allocat|reserv|new buffer/],
      },
      {
        label: 'The buffer lives in GPU memory',
        hint: 'A buffer is a block of GPU memory. The GPU cannot read JavaScript arrays directly while it draws.',
        patterns: [/gpu|graphics card|video memory|vram|graphics memory|graphics hardware/],
        weight: 2,
      },
      {
        label: 'Copies the cube vertex data into it',
        hint: 'bufferData copies the numbers from cubeVertices into the buffer.',
        patterns: [/cop(y|ies|ied)|upload|send|transfer|load|fill|put|stor|move|push/],
        weight: 2,
      },
      {
        label: 'Binding makes it the "current" buffer (ARRAY_BUFFER = vertex data)',
        hint: 'bindBuffer makes this the current ARRAY_BUFFER, so the next buffer commands act on it.',
        patterns: [/bind|current|active|select/],
      },
      {
        label: 'STATIC_DRAW: filled once, drawn many times',
        hint: "STATIC_DRAW hints that the data won't change: we fill it once and draw from it many times.",
        patterns: [/static|once|won'?t change|doesn'?t change|not change|never change|many times|reus/],
      },
    ],
    modelAnswer:
      "This creates a buffer, a block of GPU memory, binds it as the current ARRAY_BUFFER (vertex data), and copies the cube's vertex data into it with bufferData. STATIC_DRAW tells WebGL the data is filled once and drawn many times, so the vertices only travel to the GPU once.",
    questions: [
      {
        ask: 'Why copy the vertices into a buffer instead of drawing straight from the JavaScript array?',
        choices: [
          { text: 'The GPU has its own memory and can\'t read JavaScript arrays while it draws', correct: true,
            why: 'The data has to be copied into GPU memory first. A buffer is that copy.' },
          { text: 'Buffers compress the data so it takes less space',
            why: 'Nothing is compressed. The same numbers are copied into GPU memory.' },
          { text: 'JavaScript arrays can only hold integers',
            why: 'JavaScript arrays hold decimals fine. The issue is where the data lives: the GPU needs it in its own memory.' },
        ],
      },
      {
        ask: 'What would go wrong if you skipped `gl.bindBuffer` before `gl.bufferData`?',
        choices: [
          { text: 'bufferData would not know which buffer to fill, so the new buffer stays empty', correct: true,
            why: 'bufferData does not take a buffer argument. It fills whichever buffer is currently bound to ARRAY_BUFFER.' },
          { text: 'Nothing; binding is optional',
            why: 'WebGL calls act on the currently bound buffer, so binding is how you say which buffer you mean.' },
          { text: 'The buffer would be created twice',
            why: 'createBuffer makes the buffer. Binding only selects it.' },
        ],
      },
      {
        ask: 'With 100 cubes on screen, how many times is the cube vertex data sent to the GPU?',
        choices: [
          { text: 'Once, at startup', correct: true,
            why: 'bufferData runs once. Every draw call reuses the same buffer; only the uniforms change.' },
          { text: '100 times, once per cube',
            why: 'All cubes share one buffer. What changes per cube is the model matrix and color (uniforms).' },
          { text: 'Once every frame',
            why: 'STATIC_DRAW data stays on the GPU between frames. It is not re-sent.' },
        ],
      },
      {
        ask: 'What does `gl.createBuffer()` return?',
        choices: [
          { text: 'A new buffer object that holds no data yet', correct: true,
            why: 'The buffer gets its data (and its size) when gl.bufferData copies the vertices into it.' },
          { text: 'A copy of `cubeVertices`',
            why: 'createBuffer takes no data. gl.bufferData copies the vertices in later.' },
          { text: 'The number of bytes reserved',
            why: 'It returns a buffer object, not a size. The size comes from the data passed to gl.bufferData.' },
        ],
      },
      {
        ask: 'When would `gl.DYNAMIC_DRAW` be a better choice than `gl.STATIC_DRAW`?',
        choices: [
          { text: 'When the data in the buffer is changed often, for example every frame', correct: true,
            why: 'The usage value is a hint about how often the data changes. The cube is uploaded once, so STATIC_DRAW fits.' },
          { text: 'When many cubes are drawn',
            why: 'The number of draws does not matter. The hint is about how often the data in the buffer changes.' },
          { text: 'When the cubes move',
            why: 'Moving a cube changes its model matrix (a uniform), not the vertex data in the buffer.' },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    title: 'Describing the buffer layout (attributes)',
    language: 'javascript',
    code: `
const BYTES_PER_FLOAT = 4;
const stride = 6 * BYTES_PER_FLOAT;

const aPosition = gl.getAttribLocation(program, 'aPosition');
gl.enableVertexAttribArray(aPosition);
gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, stride, 0);

const aNormal = gl.getAttribLocation(program, 'aNormal');
gl.enableVertexAttribArray(aNormal);
gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, stride, 3 * BYTES_PER_FLOAT);`,
    annotated: `
const BYTES_PER_FLOAT = 4;                 // each float is 4 bytes
const stride = 6 * BYTES_PER_FLOAT;        // bytes from one vertex to the next: 6 floats = 24 bytes

const aPosition = gl.getAttribLocation(program, 'aPosition');   // get the location of aPosition in the program
gl.enableVertexAttribArray(aPosition);                          // enable reading aPosition from the buffer
// aPosition reads from the bound buffer: 3 floats per vertex, starting at byte 0
gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, stride, 0);

const aNormal = gl.getAttribLocation(program, 'aNormal');       // get the location of aNormal in the program
gl.enableVertexAttribArray(aNormal);                            // enable reading aNormal from the buffer
// aNormal reads from the bound buffer: 3 floats per vertex, starting at byte 12 (after the position)
gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, stride, 3 * BYTES_PER_FLOAT);`,
    concepts: [
      {
        label: 'Tells the GPU how to read the numbers in the buffer',
        hint: 'The buffer is just numbers; vertexAttribPointer describes their layout so the GPU knows what each number is.',
        patterns: [/how to read|interpret|layout|format|structure|organi[sz]|which numbers|what (the|each) number|(first|next) (3|three)/],
        weight: 2,
      },
      {
        label: 'Connects the buffer to the shader attributes aPosition and aNormal',
        hint: 'getAttribLocation finds each attribute in the shader; the pointer feeds it from the buffer.',
        patterns: [/attribute|aposition|anormal|shader (input|variable)|connect|hook|link|feed|position.*normal|normal.*position/],
      },
      {
        label: 'Stride: each vertex is 6 floats = 24 bytes',
        hint: 'stride = the distance from one vertex to the next: 6 floats × 4 bytes = 24 bytes.',
        patterns: [/stride|24|(6|six) (floats|numbers|values)|bytes? (per|between|from one) vertex|step/],
      },
      {
        label: 'Offset: position starts at 0, normal starts after 3 floats (12 bytes)',
        hint: 'The offset says where in each vertex the attribute starts: position at byte 0, normal at byte 12.',
        patterns: [/offset|12|after (the )?(first )?(3|three)|next (3|three)|starts? at|skip/],
      },
      {
        label: 'Each attribute is 3 floats (a vec3)',
        hint: 'Both attributes read 3 floats per vertex (x, y, z or nx, ny, nz).',
        patterns: [/(3|three) (floats|numbers|components|values)|vec3|x,? ?y,? ?(and )?z/],
      },
      {
        label: 'Enables each attribute to read from a buffer',
        hint: 'enableVertexAttribArray turns on reading this attribute from a buffer.',
        patterns: [/enabl|turns? on|activat|switch(es)? on/],
      },
    ],
    modelAnswer:
      'This tells the GPU how to read the numbers in the buffer and connects them to the shader attributes. For each attribute (aPosition and aNormal) it looks up the attribute location in the program, enables it, and calls vertexAttribPointer: each attribute is 3 floats, each vertex is 6 floats = 24 bytes apart (the stride), position starts at offset 0, and the normal starts after the 3 position floats (offset 12 bytes).',
    questions: [
      {
        ask: 'Why is the stride 24?',
        choices: [
          { text: 'Each vertex is 6 floats, and each float is 4 bytes', correct: true,
            why: 'The stride is the number of bytes from the start of one vertex to the start of the next: 6 × 4 = 24.' },
          { text: 'There are 24 numbers in each face',
            why: 'A face has 6 vertices × 6 numbers = 36 numbers. The stride is measured per vertex, in bytes.' },
          { text: 'The cube has 24 vertices',
            why: 'The cube has 36 vertices. The stride is the size of one vertex in bytes.' },
        ],
      },
      {
        ask: 'Why is the normal\'s offset `3 * BYTES_PER_FLOAT` (12 bytes)?',
        choices: [
          { text: 'Inside each vertex, the normal comes right after the 3 position floats', correct: true,
            why: 'The data is interleaved: position, normal, position, normal... The offset says where in each vertex the normal starts.' },
          { text: 'All the normals are stored after all the positions',
            why: 'This buffer is interleaved: each vertex has its position and then its normal, one vertex after another.' },
          { text: 'The cube has 12 triangles',
            why: 'It does, but the offset is in bytes within one vertex: 3 floats × 4 bytes = 12.' },
        ],
      },
      {
        ask: 'In `gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, stride, 0)`, what does the `3` mean?',
        choices: [
          { text: 'Read 3 floats per vertex for this attribute (a vec3)', correct: true,
            why: 'aPosition is a vec3, so each vertex supplies 3 numbers: x, y, z.' },
          { text: '3 vertices per triangle',
            why: 'Triangles are set up by drawArrays(gl.TRIANGLES, ...). This argument is the attribute\'s size.' },
          { text: 'The attribute\'s location in the shader',
            why: 'The location is the first argument (aPosition). The second is how many components to read.' },
        ],
      },
      {
        ask: 'What would happen if `aNormal` also used offset 0?',
        choices: [
          { text: '`aNormal` would read the position numbers, so the lighting would be wrong', correct: true,
            why: 'Offset 0 points at x, y, z. Each vertex\'s normal would be its position, so the faces would be shaded incorrectly.' },
          { text: 'WebGL would report an error',
            why: 'Overlapping attributes are allowed. WebGL reads whatever bytes you point it to.' },
          { text: 'Nothing: WebGL finds the normal by its name',
            why: 'WebGL only knows the layout you describe. It cannot tell positions from normals.' },
        ],
      },
      {
        ask: 'Which buffer does `gl.vertexAttribPointer` connect the attribute to?',
        choices: [
          { text: 'The buffer bound to `gl.ARRAY_BUFFER` when it is called', correct: true,
            why: 'vertexAttribPointer records the bound buffer along with the layout. The attribute keeps reading from that buffer even if another one is bound later.' },
          { text: 'The buffer named in the shader',
            why: 'Shaders do not name buffers. The connection is made in JavaScript.' },
          { text: 'Every buffer that has been created',
            why: 'Each attribute reads from exactly one buffer: the one bound when vertexAttribPointer was called.' },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    title: 'Uniform locations',
    language: 'javascript',
    code: `
const uModel = gl.getUniformLocation(program, 'uModel');
const uView = gl.getUniformLocation(program, 'uView');
const uProjection = gl.getUniformLocation(program, 'uProjection');
const uColor = gl.getUniformLocation(program, 'uColor');`,
    annotated: `
// Get the location of each uniform in the program (where to send it, not its value).
// The values are set later, in draw().
const uModel = gl.getUniformLocation(program, 'uModel');             // location of the model matrix (positions one cube)
const uView = gl.getUniformLocation(program, 'uView');               // location of the view matrix (the camera)
const uProjection = gl.getUniformLocation(program, 'uProjection');   // location of the projection matrix (perspective)
const uColor = gl.getUniformLocation(program, 'uColor');             // location of the cube's color`,
    concepts: [
      {
        label: 'Looks up the location (address) of each uniform in the program',
        hint: 'getUniformLocation returns where each uniform lives in the linked program, not its value.',
        patterns: [/locat|address|handle|slot|look(s|ing)? ?up|find|reference|pointer/],
        weight: 2,
      },
      {
        label: 'Uniforms are values shared by every vertex in a draw call',
        hint: 'A uniform has one value for the whole draw call, unlike an attribute, which differs per vertex.',
        patterns: [/same|constant|shared|whole draw|all (the )?vertices|every vertex|per (draw|cube|object|frame)|don'?t change|global/],
      },
      {
        label: 'What they are: model, view, projection matrices and the color',
        hint: 'uModel places the cube, uView is the camera, uProjection is perspective, and uColor is the cube color.',
        patterns: [/model|place|position/, /view|camera/, /projection|perspective/, /colou?r/],
        need: 2,
      },
      {
        label: 'The values are set later, when drawing',
        hint: 'The locations are saved now so draw() can send values to them (uniformMatrix4fv, uniform3fv).',
        patterns: [/later|when drawing|in draw|before drawing|each frame|set (them|their|the values?)|send/],
      },
    ],
    modelAnswer:
      'This looks up the location of each uniform in the linked shader program and saves it, so that later, when drawing, we can send values to them. Uniforms hold one value shared by every vertex in a draw call: uModel (places the cube in the world), uView (the camera), uProjection (perspective), and uColor (the cube color).',
    questions: [
      {
        ask: 'What does the JavaScript variable `uModel` hold after this code runs?',
        choices: [
          { text: 'The location of the uModel uniform in the program, not a matrix', correct: true,
            why: 'getUniformLocation returns where to send a value. The matrix itself (model) is sent later.' },
          { text: 'The model matrix',
            why: 'The matrix is the variable model, built in draw() and sent with uniformMatrix4fv.' },
          { text: 'A copy of the vertex shader',
            why: 'It is just a handle that points at one uniform inside the linked program.' },
        ],
      },
      {
        ask: 'When are values actually given to these uniforms?',
        choices: [
          { text: 'Later, in draw(), with uniformMatrix4fv and uniform3fv', correct: true,
            why: 'This code only finds the locations. Values are sent right before drawing.' },
          { text: 'Right here, by getUniformLocation',
            why: 'getUniformLocation only looks up the location. No value is set.' },
          { text: 'When the shaders are compiled',
            why: 'Compiling does not set uniform values. JavaScript sets them before each draw.' },
        ],
      },
      {
        ask: 'Why look up the locations once at startup instead of before every draw?',
        choices: [
          { text: 'They never change after the program is linked, so looking them up again would be wasted work', correct: true,
            why: 'A uniform\'s location is fixed once the program is linked.' },
          { text: 'Locations can only be looked up once',
            why: 'You can look them up any time. It is just unnecessary, because they never change.' },
          { text: 'The values would be lost if you looked them up again',
            why: 'Looking up a location does not change any value.' },
        ],
      },
      {
        ask: 'What happens if the name is misspelled, as in `gl.getUniformLocation(program, \'uModle\')`?',
        choices: [
          { text: 'It returns `null`, and setting that uniform later silently does nothing', correct: true,
            why: 'WebGL does not throw an error, so the mistake is easy to miss. The same happens for a uniform the shader declares but never uses, because the compiler removes it.' },
          { text: 'An error is thrown right away',
            why: 'WebGL returns null instead of throwing.' },
          { text: 'WebGL creates a new uniform named `uModle`',
            why: 'Uniforms are declared in the shader. JavaScript can only look up ones that exist.' },
        ],
      },
      {
        ask: 'Why is `uColor` a uniform rather than an attribute?',
        choices: [
          { text: 'Every vertex of one cube has the same color, set once per cube', correct: true,
            why: 'Attributes give each vertex its own value. One value for the whole draw call is what a uniform is for.' },
          { text: 'Colors must always be uniforms',
            why: 'Colors can be attributes too, with one color per vertex. A uniform fits here because each cube has a single color.' },
          { text: 'Attributes cannot hold three numbers',
            why: 'aPosition and aNormal are both vec3 attributes.' },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    title: 'The model matrix',
    language: 'javascript',
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

const model = multiply(
  translation(cube.x, 0, cube.z),
  scaling(1, cube.height, 1),
);`,
    annotated: `
function translation(x, y, z) {   // returns a matrix that moves a point by (x, y, z)
  return [                        // 16 values in column-major order (one column at a time)
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    x, y, z, 1,                   // the last column holds the translation amounts
  ];
}

function scaling(sx, sy, sz) {    // returns a matrix that scales by (sx, sy, sz)
  return [                        // 16 values in column-major order (one column at a time)
    sx, 0,  0,  0,                // scale x by sx
    0,  sy, 0,  0,                // scale y by sy
    0,  0,  sz, 0,                // scale z by sz
    0,  0,  0,  1,
  ];
}

const model = multiply(            // model matrix = translation × scaling
  translation(cube.x, 0, cube.z),  // applied second: move the cube to its grid position (y = 0 keeps it on the ground)
  scaling(1, cube.height, 1),      // applied first: scale the 1-unit cube's height to cube.height
);`,
    concepts: [
      {
        label: "Builds the cube's model matrix, placing it in the world",
        hint: 'The model matrix moves the one shared cube from model space into its place in the world.',
        patterns: [/model matri|world|place|scene|transform/],
      },
      {
        label: "Scales (stretches) the cube to its height",
        hint: 'scaling(1, cube.height, 1) stretches the unit cube vertically to this cube\'s height.',
        patterns: [/scal|stretch|height|tall/],
        weight: 2,
      },
      {
        label: 'Translates (moves) the cube to its grid position',
        hint: 'translation(cube.x, 0, cube.z) moves the cube to its spot on the grid.',
        patterns: [/translat|move|shift|grid|spot/],
        weight: 2,
      },
      {
        label: 'Order matters: scale first, then translate',
        hint: 'In multiply(a, b), b is applied first, so the cube is scaled first and then moved (read right to left).',
        patterns: [/(scal|stretch)\w* (first|before)|right.to.left|order|first\w* (scal|stretch)|then (translat|mov)/],
      },
      {
        label: '4×4 matrices (translation in the last column, column-major)',
        hint: 'These are 4×4 matrices stored column-major, which is why x, y, z appear in the last 4 numbers.',
        patterns: [/4 ?(x|×|by) ?4|homogeneous|column.?major|last (row|column|four)|4d/],
      },
    ],
    modelAnswer:
      "This builds each cube's model matrix, which places the shared unit cube in the world. scaling(1, height, 1) stretches it to its height, and translation(x, 0, z) moves it to its grid position. These are 4×4 matrices stored column-major (translation sits in the last column). multiply(a, b) applies b first, so the cube is scaled first and then translated.",
    questions: [
      {
        ask: 'In `multiply(translation(...), scaling(...))`, which happens to the cube first?',
        choices: [
          { text: 'It is stretched (scaling)', correct: true,
            why: 'As in the shader, the matrix next to the vertex acts first: scale the cube, then move it.' },
          { text: 'It is moved (translation)',
            why: 'translation is written first but applied last. Matrix products act right to left.' },
          { text: 'Both at the same time; order never matters for matrices',
            why: 'Order usually matters: moving then scaling would also scale the move.' },
        ],
      },
      {
        ask: 'Why is the y value 0 in `translation(cube.x, 0, cube.z)`?',
        choices: [
          { text: 'So every cube sits on the ground; the cube\'s bottom is already at y = 0', correct: true,
            why: 'The cubes only move across the grid (x and z). Their bottoms stay on the ground.' },
          { text: 'translation ignores y',
            why: 'translation can move in y. We pass 0 because the cubes should not move up or down.' },
          { text: 'Because all cubes are the same height',
            why: 'They have different heights. Height is handled by scaling, not translation.' },
        ],
      },
      {
        ask: 'In `translation()`, why are x, y, z among the last four numbers of the array?',
        choices: [
          { text: 'WebGL lists a matrix one column at a time, and the move amounts belong in the last column', correct: true,
            why: 'This is column-major order. The last four numbers are the fourth column.' },
          { text: 'The move amounts belong in the bottom row',
            why: 'It looks like a row in the code, but WebGL reads the array one column at a time.' },
          { text: 'The order of the numbers doesn\'t matter',
            why: 'Each position in the 16-number array is a specific matrix entry.' },
        ],
      },
      {
        ask: 'A point at the origin is moved by `translation(3, 0, 0)` and then scaled by `scaling(2, 2, 2)`. Where does it end up?',
        choices: [
          { text: '(6, 0, 0)', correct: true,
            why: 'Translating gives (3, 0, 0). Scaling then doubles every coordinate, including the move. That is why scaling is usually applied first.' },
          { text: '(3, 0, 0)',
            why: 'That is the result of scaling first (the origin stays at the origin) and then translating.' },
          { text: '(5, 0, 0)',
            why: 'Scaling multiplies coordinates. It does not add 2.' },
        ],
      },
      {
        ask: 'What does `scaling(1, cube.height, 1)` do to the 1×1×1 cube when `cube.height` is 3?',
        choices: [
          { text: 'It becomes 3 units tall, and stays 1 unit wide and deep', correct: true,
            why: 'Only y is multiplied by 3. The cube ran from y = 0 to 1, so it now runs from y = 0 to 3.' },
          { text: 'It becomes 3 units long on every side',
            why: 'Only the y scale is cube.height. x and z are scaled by 1.' },
          { text: 'It moves up 3 units',
            why: 'Scaling multiplies coordinates, so the bottom at y = 0 stays at 0. Moving is what translation does.' },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    title: 'Perspective projection',
    language: 'javascript',
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
    annotated: `
function perspective(fieldOfView, aspect, near, far) {   // builds the perspective projection matrix (fieldOfView is vertical, in radians)
  const f = 1 / Math.tan(fieldOfView / 2);               // f = 1 / tan(fieldOfView / 2); a smaller field of view gives a larger f (more zoom)
  return [                                               // 16 values in column-major order (one column at a time)
    f / aspect, 0, 0,                               0,   // scale x by f / aspect so the image is not stretched
    0,          f, 0,                               0,   // scale y by f
    0,          0, (far + near) / (near - far),    -1,   // depth scale; the -1 sets w = -z, the distance in front of the camera
    0,          0, (2 * far * near) / (near - far), 0,   // depth offset. After the GPU divides by w, near maps to -1, far to +1, and farther points appear smaller
  ];
}`,
    concepts: [
      {
        label: 'Builds the projection matrix',
        hint: 'This builds the projection matrix (uProjection), the last transform in the vertex shader.',
        patterns: [/projection|project/],
      },
      {
        label: 'Perspective: far-away objects look smaller',
        hint: 'A perspective projection makes distant things appear smaller, like a real camera.',
        patterns: [/perspective|smaller|farther|further|distan|foreshorten|realistic|3d look/],
        weight: 2,
      },
      {
        label: 'Field of view controls how wide the camera sees',
        hint: 'fieldOfView is the angle the camera can see; a bigger angle shows more (zooms out).',
        patterns: [/field of view|fov|angle|how wide|zoom|wide/],
      },
      {
        label: 'Aspect ratio keeps things from being stretched',
        hint: 'aspect = width / height, so the image is not squashed when the canvas is not square.',
        patterns: [/aspect|width.*height|stretch|squash|distort/],
      },
      {
        label: 'Near and far planes limit what is drawn',
        hint: 'Nothing closer than near or farther than far is drawn (the clipping planes).',
        patterns: [/near|clip|range|frustum/],
      },
    ],
    modelAnswer:
      'This builds a perspective projection matrix, which makes far-away objects look smaller. The field of view sets how wide the camera sees, the aspect ratio (width / height) keeps the image from being stretched, and the near and far planes set the range of distances that get drawn; anything outside is clipped.',
    questions: [
      {
        ask: 'What does a larger `fieldOfView` do?',
        choices: [
          { text: 'Shows more of the scene, so everything looks smaller (zoomed out)', correct: true,
            why: 'A wider viewing angle fits more of the world into the same canvas.' },
          { text: 'Zooms in',
            why: 'A narrower field of view zooms in. A larger one zooms out.' },
          { text: 'Moves the camera farther back',
            why: 'The camera does not move. It sees a wider angle from the same spot.' },
        ],
      },
      {
        ask: 'The window gets wider, but `aspect` is not updated. What do you see?',
        choices: [
          { text: 'The image looks stretched sideways', correct: true,
            why: 'aspect corrects for the canvas shape. With the old value, x is scaled for a narrower canvas.' },
          { text: 'Nothing changes',
            why: 'The canvas shape changed, so without the right aspect, the picture no longer fits it correctly.' },
          { text: 'The cubes disappear',
            why: 'They are still drawn, just with the wrong proportions.' },
        ],
      },
      {
        ask: 'The draw code uses near = 0.1 and far = 100. A cube 150 units from the camera is missing. Why?',
        choices: [
          { text: 'It is beyond the far plane, so it is clipped', correct: true,
            why: 'Anything farther than far (or closer than near) is not drawn.' },
          { text: 'It is too small to see',
            why: 'It would be small, but the actual reason is clipping at the far plane.' },
          { text: 'It is behind the camera',
            why: 'Distance alone does not put it behind the camera. It is just past the far plane.' },
        ],
      },
      {
        ask: 'After the vertex shader, the GPU divides x, y, and z by w. What is w for a point 10 units in front of the camera?',
        choices: [
          { text: '10', correct: true,
            why: 'The -1 sets w = -z. The camera looks down -z, so a point 10 units ahead has z = -10 and w = 10. Dividing by a larger w makes farther points smaller.' },
          { text: '1',
            why: 'The input position has w = 1, but the projection matrix replaces it with -z.' },
          { text: '-10',
            why: 'w = -z, and z = -10 for a point in front of the camera, so w = +10.' },
        ],
      },
      {
        ask: 'Why can `near` not be 0?',
        choices: [
          { text: 'Every depth would map to the same value, so the depth test could not tell which surface is closer', correct: true,
            why: 'With near = 0, the depth formula gives the same result for every distance. Depth precision also gets worse as near gets smaller, so keep near as large as you can.' },
          { text: 'Objects at the camera would be drawn infinitely large',
            why: 'The problem is depth, not size: every depth becomes the same value, which breaks the depth test.' },
          { text: 'WebGL only allows near values of 1 or more',
            why: 'Any positive near value works. This code uses 0.1.' },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    title: 'The camera (lookAt)',
    language: 'javascript',
    code: `
function lookAt(eye, target, up) {
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
    annotated: `
function lookAt(eye, target, up) {                 // builds a view matrix: camera at eye, looking at target
  const zAxis = normalize(subtract(eye, target));  // camera's back axis: unit vector from target to eye
  const xAxis = normalize(cross(up, zAxis));       // camera's right axis: perpendicular to up and zAxis
  const yAxis = cross(zAxis, xAxis);               // camera's up axis: perpendicular to zAxis and xAxis

  return [                                         // 16 values in column-major order (one column at a time)
    xAxis[0], yAxis[0], zAxis[0], 0,               // x components of the camera's right, up, and back axes
    xAxis[1], yAxis[1], zAxis[1], 0,               // y components of the camera's right, up, and back axes
    xAxis[2], yAxis[2], zAxis[2], 0,               // z components of the camera's right, up, and back axes
    -dot(xAxis, eye), -dot(yAxis, eye), -dot(zAxis, eye), 1,   // translation: moves the world so the camera is at the origin
  ];
}`,
    concepts: [
      {
        label: 'Builds the view (camera) matrix',
        hint: 'lookAt builds the view matrix (uView), which describes the camera.',
        patterns: [/camera|view/],
        weight: 2,
      },
      {
        label: 'eye = where the camera is',
        hint: 'eye is the position of the camera in the world.',
        patterns: [/eye|camera'?s? (position|location)|where the camera|located|sits|placed/],
      },
      {
        label: 'target = the point the camera looks at',
        hint: 'target is the point the camera is aimed at.',
        patterns: [/target|look(s|ing)? (at|toward)|point(s|ing|ed)? (at|toward)|aim|direction|facing/],
      },
      {
        label: 'up = which way is up for the camera',
        hint: 'up (normally +y) keeps the camera from tilting sideways.',
        patterns: [/up vector|up direction|which way is up|is up|the up\b|\+y|upright|tilt|roll|orient/],
      },
      {
        label: "Builds the camera's own x, y, z axes with cross products",
        hint: 'The cross products build three perpendicular axes for the camera: right, up, and backward.',
        patterns: [/cross|axes|axis|basis|perpendicular|orthogonal|orthonormal/],
      },
      {
        label: 'Moves the world so it is seen relative to the camera',
        hint: 'The matrix moves/rotates the whole world so the camera ends up at the origin looking down -z (the -dot(..., eye) row).',
        patterns: [/invers|opposite|relative to (the )?camera|camera (space|coordinates)|view space|negat|(move|transform|rotate)s? the (world|scene)/],
      },
    ],
    modelAnswer:
      "lookAt builds the view (camera) matrix. eye is where the camera is, target is the point it looks at, and up says which way is up. It uses cross products to build the camera's own three perpendicular axes (right, up, backward), then packs them into a matrix that moves and rotates the world so everything is expressed relative to the camera.",
    questions: [
      {
        ask: 'What direction is `zAxis = normalize(subtract(eye, target))`?',
        choices: [
          { text: 'From the target back toward the camera: the camera looks along its own -z', correct: true,
            why: 'By WebGL convention, the camera looks down its negative z axis, so +z points backward.' },
          { text: 'The direction the camera looks',
            why: 'It is the opposite: eye - target points from the target back to the eye.' },
          { text: 'The camera\'s position',
            why: 'The position is eye. zAxis is a direction of length 1.' },
        ],
      },
      {
        ask: 'Why does this code use `cross()`?',
        choices: [
          { text: 'To get a direction perpendicular to two others, which builds the camera\'s right and up axes', correct: true,
            why: 'The cross product of two directions is perpendicular to both.' },
          { text: 'To measure the angle between two directions',
            why: 'That is dot(). cross() produces a new, perpendicular direction.' },
          { text: 'To make a vector length 1',
            why: 'That is normalize().' },
        ],
      },
      {
        ask: 'What would you see with `up = [0, -1, 0]`?',
        choices: [
          { text: 'The scene upside down', correct: true,
            why: 'up says which way is up on the screen. Pointing it at -y flips the picture.' },
          { text: 'The camera looking straight down',
            why: 'Where the camera looks is set by eye and target. up only sets its roll.' },
          { text: 'No change',
            why: 'up decides which way is up on screen, so flipping it flips the image.' },
        ],
      },
      {
        ask: 'Why is `yAxis` not normalized?',
        choices: [
          { text: '`zAxis` and `xAxis` are perpendicular and length 1, so their cross product is already length 1', correct: true,
            why: 'The length of a × b is |a| |b| sin(angle) = 1 × 1 × sin(90°) = 1.' },
          { text: 'It is a bug: it should be normalized',
            why: 'Normalizing would not hurt, but it is not needed. The cross product of two perpendicular unit vectors is already a unit vector.' },
          { text: 'The up axis does not need to be length 1',
            why: 'All three camera axes must be length 1 for the matrix to be a pure rotation. yAxis already is.' },
        ],
      },
      {
        ask: 'The camera looks straight down (the eye is directly above the target) with `up = [0, 1, 0]`. What goes wrong?',
        choices: [
          { text: '`cross(up, zAxis)` is zero, so the camera\'s right axis cannot be computed', correct: true,
            why: 'up and zAxis are parallel, and parallel vectors have a zero cross product. normalize then divides by zero. Choose an up vector that is not parallel to the view direction.' },
          { text: 'The image is upside down',
            why: 'Flipping comes from up pointing the wrong way. Here up gives no sideways direction at all.' },
          { text: 'Nothing: lookAt corrects up automatically',
            why: 'lookAt corrects an up that is tilted (that is what yAxis is for), but not one that is parallel to the view direction.' },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    title: 'Preparing to draw a frame',
    language: 'javascript',
    code: `
canvas.width = canvas.clientWidth;
canvas.height = canvas.clientHeight;
gl.viewport(0, 0, canvas.width, canvas.height);

gl.clearColor(0, 0, 0, 1);
gl.enable(gl.DEPTH_TEST);
gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);`,
    annotated: `
canvas.width = canvas.clientWidth;      // make the drawing buffer as many pixels wide as the canvas is displayed (CSS pixels)
canvas.height = canvas.clientHeight;    // same for height, so the image is not stretched
gl.viewport(0, 0, canvas.width, canvas.height);   // map normalized device coordinates (-1 to +1) onto the whole canvas

gl.clearColor(0, 0, 0, 1);              // set the clear color to opaque black
gl.enable(gl.DEPTH_TEST);               // turn on depth testing: keep only the nearest surface at each pixel
gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);   // clear the color buffer and the depth buffer`,
    concepts: [
      {
        label: "Matches the canvas's pixel size to its size on the page",
        hint: 'canvas.width/height set how many pixels the canvas has; matching its displayed size avoids a blurry, stretched image.',
        patterns: [/resiz|size|width|dimension|match|blur/],
      },
      {
        label: 'Sets the viewport: the area of the canvas to draw into',
        hint: 'gl.viewport maps the -1..+1 output of the shaders onto the canvas pixels.',
        patterns: [/viewport|pixel|region|rectangle|area|map/],
      },
      {
        label: 'Clears the screen to black',
        hint: 'clearColor picks black, and gl.clear erases the previous picture with it.',
        patterns: [/clear|eras|wipe|reset|black|background|blank/],
        weight: 2,
      },
      {
        label: 'Depth testing: near things hide far things',
        hint: 'DEPTH_TEST keeps only the closest surface at each pixel, so near cubes hide far ones regardless of draw order.',
        patterns: [/depth|z.?buffer|hidden|occlu|hide|in front|behind|closer|nearer|closest/],
        weight: 2,
      },
      {
        label: 'Clears the depth buffer too, not just the color',
        hint: 'DEPTH_BUFFER_BIT resets the stored depths so the last frame does not affect this one.',
        patterns: [/depth\w* (buffer )?(is |are |gets )?(also )?(clear|reset|eras|wip)|(clear|reset|eras|wip)\w* .*(depth|both)|both/],
      },
    ],
    modelAnswer:
      "This prepares a new frame. It sets the canvas's pixel size to match its size on the page and sets the viewport so drawing covers the whole canvas. It picks black as the clear color, enables depth testing so near cubes hide far ones, and clears both the color buffer and the depth buffer so nothing from the last frame remains.",
    questions: [
      {
        ask: 'What happens if you leave out `gl.enable(gl.DEPTH_TEST)`?',
        choices: [
          { text: 'Cubes drawn later cover earlier ones, even when they are farther away', correct: true,
            why: 'Without the depth test, the last thing drawn at a pixel wins, no matter how far away it is.' },
          { text: 'Nothing is drawn',
            why: 'Everything is still drawn, just in draw order instead of by distance.' },
          { text: 'The screen is not cleared',
            why: 'Clearing is gl.clear. The depth test decides which surface is in front.' },
        ],
      },
      {
        ask: 'Why clear `DEPTH_BUFFER_BIT` as well as `COLOR_BUFFER_BIT`?',
        choices: [
          { text: 'Old depth values from the last frame could hide pixels in this frame', correct: true,
            why: 'Each new frame should start with "nothing drawn yet" at every pixel.' },
          { text: 'To make the background black',
            why: 'That is the color buffer and clearColor. The depth buffer holds distances.' },
          { text: 'It is not needed; the depth buffer resets itself',
            why: 'It keeps its values until you clear it.' },
        ],
      },
      {
        ask: 'Why set `canvas.width = canvas.clientWidth`?',
        choices: [
          { text: 'So the canvas draws as many pixels as the space it takes on the page, which avoids a blurry, stretched image', correct: true,
            why: 'clientWidth is the displayed size (in CSS pixels). canvas.width is how many pixels are actually drawn. On high-DPI screens, multiplying by window.devicePixelRatio makes it fully sharp.' },
          { text: 'To make the canvas fill the window',
            why: 'CSS sets the displayed size. This line matches the drawing resolution to it.' },
          { text: 'WebGL needs it before it can create a context',
            why: 'The context already exists. This is about drawing at the right resolution.' },
        ],
      },
      {
        ask: 'What does `gl.clearColor(0, 0, 0, 1)` do on its own?',
        choices: [
          { text: 'It only sets the color. Nothing is erased until `gl.clear` is called', correct: true,
            why: 'clearColor stores the color to use. gl.clear(gl.COLOR_BUFFER_BIT) fills the canvas with it.' },
          { text: 'It fills the canvas with black',
            why: 'Setting the color does not draw anything. gl.clear does the erasing.' },
          { text: 'It makes all the cubes black',
            why: 'Cube colors come from uColor in the fragment shader.' },
        ],
      },
      {
        ask: 'The canvas is displayed at 800 × 600 on the page, but `canvas.width` and `canvas.height` stay at their defaults (300 × 150). What do you see?',
        choices: [
          { text: 'A blurry, stretched image: 300 × 150 pixels scaled up to 800 × 600', correct: true,
            why: 'The browser stretches the small drawing buffer to the displayed size. Setting canvas.width and canvas.height to the displayed size avoids this.' },
          { text: 'Only the top-left 300 × 150 area is drawn',
            why: 'The whole canvas is scaled to fit, so the image is stretched, not cropped.' },
          { text: 'Nothing changes',
            why: 'canvas.width and canvas.height set how many pixels are drawn. CSS only sets the displayed size.' },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------
  {
    title: 'The draw loop',
    language: 'javascript',
    code: `
const aspect = canvas.width / canvas.height;
gl.uniformMatrix4fv(uProjection, false, perspective(Math.PI / 4, aspect, 0.1, 100));
gl.uniformMatrix4fv(uView, false, lookAt([14, 14, 18], [0, 0, 0], [0, 1, 0]));

for (const cube of cubes) {
  const model = multiply(
    translation(cube.x, 0, cube.z),
    scaling(1, cube.height, 1),
  );

  gl.uniformMatrix4fv(uModel, false, model);
  gl.uniform3fv(uColor, cube.color);
  gl.drawArrays(gl.TRIANGLES, 0, VERTEX_COUNT);
}`,
    annotated: `
const aspect = canvas.width / canvas.height;     // aspect ratio: width divided by height
// Send the projection matrix: 45° vertical field of view, near plane 0.1, far plane 100
gl.uniformMatrix4fv(uProjection, false, perspective(Math.PI / 4, aspect, 0.1, 100));
// Send the view matrix: camera at (14, 14, 18), looking at the origin, with +y as up
gl.uniformMatrix4fv(uView, false, lookAt([14, 14, 18], [0, 0, 0], [0, 1, 0]));

for (const cube of cubes) {                      // draw each cube
  const model = multiply(                        // build this cube's model matrix
    translation(cube.x, 0, cube.z),              // applied second: move it to its grid position
    scaling(1, cube.height, 1),                  // applied first: scale it to its height
  );

  gl.uniformMatrix4fv(uModel, false, model);     // send the model matrix to the shader (false = no transpose)
  gl.uniform3fv(uColor, cube.color);             // send the cube's color to the shader
  gl.drawArrays(gl.TRIANGLES, 0, VERTEX_COUNT);  // draw the 36 vertices as 12 triangles
}`,
    concepts: [
      {
        label: 'Sets the camera (projection and view) once for all cubes',
        hint: 'The projection and view matrices are the same for every cube, so they are sent once before the loop.',
        patterns: [/camera|projection|perspective|view|lookat/],
      },
      {
        label: 'Loops over every cube',
        hint: 'The for loop visits each cube in the scene list.',
        patterns: [/each cube|every cube|loop|all (the )?cubes|for each|iterat|one (cube )?at a time/],
      },
      {
        label: "Sends each cube's model matrix and color as uniforms",
        hint: "Before each draw, uModel and uColor are set to this cube's matrix and color.",
        patterns: [/model|matri|position|place|height/, /colou?r/],
        need: 2,
        weight: 2,
      },
      {
        label: 'Draw call: draws the 36 vertices as triangles',
        hint: 'drawArrays(TRIANGLES, 0, 36) runs the shaders on the 36 vertices in the buffer, every 3 forming a triangle.',
        patterns: [/drawarrays|draw(s|ing)?|render/, /triangle|36|vert/],
        need: 2,
        weight: 2,
      },
      {
        label: 'The same geometry in the buffer is reused for every cube',
        hint: 'The triangles are never re-sent; every cube reuses the same buffer, only the uniforms change.',
        patterns: [/same (geometry|triangles|vertices|buffer|cube|data|shape)|reus|already (in|on)|shared|one buffer|only the uniforms/],
      },
    ],
    modelAnswer:
      "First the camera is set once for all cubes by sending the projection and view matrices. Then the loop goes over every cube: it builds the cube's model matrix, sends it and the cube's color as uniforms, and calls drawArrays to draw the 36 vertices as triangles. The same cube geometry in the buffer is reused for every cube; only the uniforms change.",
    questions: [
      {
        ask: 'Why are the projection and view matrices set before the loop, but the model matrix inside it?',
        choices: [
          { text: 'The camera is the same for every cube, but each cube has its own position and height', correct: true,
            why: 'Uniforms stay set until changed, so shared values are sent once and per-cube values every time.' },
          { text: 'Projection and view must be set first or the program crashes',
            why: 'They just need to be set before drawing. Setting them once is an efficiency choice.' },
          { text: 'The model matrix is too large to set only once',
            why: 'All three are 4×4 matrices. The model matrix changes per cube, so it is set per cube.' },
        ],
      },
      {
        ask: 'How many draw calls does this code make for 100 cubes?',
        choices: [
          { text: '100', correct: true,
            why: 'drawArrays runs once per loop iteration, drawing one cube with the current uniforms.' },
          { text: '1',
            why: 'Drawing many copies in one call (instancing) is possible, but this code draws one cube per call.' },
          { text: '3600 (100 cubes × 36 vertices)',
            why: 'One draw call processes all 36 vertices of a cube.' },
        ],
      },
      {
        ask: 'What does the `false` in `gl.uniformMatrix4fv(uModel, false, model)` mean?',
        choices: [
          { text: 'Do not transpose the matrix; it is already in the column order WebGL expects', correct: true,
            why: 'WebGL 1 requires this argument to be false.' },
          { text: 'Do not draw yet',
            why: 'Drawing only happens in drawArrays. This argument is about transposing.' },
          { text: 'The matrix is not a projection matrix',
            why: 'The same call and argument are used for every matrix, including the projection.' },
        ],
      },
      {
        ask: 'Every cube is drawn from the same 36 vertices. What puts the cubes in different places, with different heights?',
        choices: [
          { text: 'A different `uModel` matrix is sent before each draw', correct: true,
            why: 'The vertex shader multiplies every vertex by uModel, so changing it moves and scales the shared cube.' },
          { text: 'Each cube has its own buffer',
            why: 'There is one buffer for all the cubes. Only the uniforms change between draws.' },
          { text: '`gl.drawArrays` is given the cube\'s position',
            why: 'drawArrays only says which vertices to draw (36, starting at 0). The position comes from uModel.' },
        ],
      },
      {
        ask: 'You want the cubes to spin over time. What needs to change?',
        choices: [
          { text: 'Redraw every frame with `requestAnimationFrame`, adding a rotation that changes with time to each model matrix', correct: true,
            why: 'The scene is drawn once (and again on resize). Animation needs a new frame, with updated matrices, many times per second.' },
          { text: 'Change `gl.STATIC_DRAW` to `gl.DYNAMIC_DRAW`',
            why: 'The vertex data does not change, only the model matrices do. The buffer can stay STATIC_DRAW.' },
          { text: 'Call `gl.drawArrays` twice for each cube',
            why: 'Drawing twice gives the same picture twice. Motion needs new matrices over time.' },
        ],
      },
    ],
  },
];
