# Session notes: WebGL cube grid teaching project

_Last updated: 2026-10-14_

## Project overview

A WebGL 1 teaching example for intro computer graphics students. It has no
libraries and no build step. It draws a grid of cubes with random heights and
colors from a fixed camera.

- `index.html`: a full-window `<canvas id="c">` that loads `index.js`.
- `index.js`: the whole program, in numbered sections:
  0. Get the WebGL context
  1. Shaders (vertex + fragment, compile, link)
  2. Cube geometry → buffer, attribute layout, uniform locations
  3. The scene (plain JS list of cubes)
  4. Matrix helpers (`translation`, `scaling`, `multiply`, `perspective`, `lookAt`)
  5. Draw
- `package.json`: a placeholder (name is still `untitled2`). Nothing is installed.
- `quiz/`: a flashcard quiz on the code (see below).

To run it, open `index.html` (or `quiz/index.html`) in a browser.

## What was done this session

All changes to `index.js` were **comments only**. No code was changed by Claude.

### 1. Fragment shader comments (section 1)
Brought the fragment shader to the same comment level as the vertex shader:
- added trailing comments on `precision` and `varying vNormal`
- explained that `main()` runs once per pixel and how `vNormal` is blended
  across a triangle
- explained what `dot()` returns (1 / 0 / negative) and why `max()` clamps it
- explained `gl_FragColor` as the pixel's final color

### 2. Buffer explanation (section 2)
- Section header now answers **What is a buffer?** (GPU memory, separate
  from JS), **What does it hold?** (just numbers: position + normal per
  vertex), and **why** (copied once, reused by every draw call). It also lists
  the three steps: JS array → GPU buffer → `vertexAttribPointer`.
- Added a comment on each of `createBuffer`, `bindBuffer` (`ARRAY_BUFFER`),
  and `bufferData` (`STATIC_DRAW`).

### 3. Explained `uModel` (answered in chat)
`uModel` is the model matrix: it places the one shared cube in the world
(scale to height, then translate to grid position). In GLSL it's the matrix;
in JS, the variable `uModel` holds the uniform's **location**, and the matrix
itself is `model`.

### 4. Attribute and uniform comments (section 2, end)
- Explained the three calls that hook up an attribute:
  `getAttribLocation`, `enableVertexAttribArray`, `vertexAttribPointer`
  (with its arguments).
- One-line comments for `aPosition` (offset 0) and `aNormal` (offset 12 bytes).
- Uniforms: they don't come from the buffer and are set from JS in `draw()`.
  The variables hold locations, not values. Also added a short line for each of
  `uModel`, `uView`, `uProjection`, and `uColor`, saying how often it changes.

### 5. Draw section comments (section 5)
- Header explains setup vs. drawing and lists steps a–d:
  size → clear → camera → per-cube uniforms + draw.
- Comments inside `draw()` cover: the two canvas sizes, what the viewport does,
  `clearColor` vs. `clear`, how the depth buffer works, the `perspective` and
  `lookAt` arguments, the `false` (no transpose) argument, why y = 0 in the
  translation, how long uniforms stay set, and what the GPU does in one
  `drawArrays` call (vertex shader → which pixels → fragment shader → depth
  test).
- Explained why it draws once plus on resize, with a pointer to
  `requestAnimationFrame` for animation.

### 6. Flashcard quiz (`quiz/` folder)
A frontend-only quiz with no backend. Students see uncommented snippets and
describe what each one does.

- `quiz/index.html`: start screen, card screen, results screen
- `quiz/style.css`: styling
- `quiz/quiz.js`: quiz flow, grading, run history (`localStorage` key
  `webglQuizHistory`)
- `quiz/cards.js`: **all quiz content**. Edit this to change or add cards.
  The header comment explains the format.

**12 cards, in pipeline order:** vertex shader, fragment shader, compile/link,
cube vertex data, creating the buffer, buffer layout (attributes), uniform
locations, model matrix, perspective, lookAt camera, preparing a frame, draw
loop.

**Behavior:**
- Enter submits; Shift+Enter adds a newline; Enter on "Next" advances.
- After each answer: a 0–100% score + rating, a ✓ list of key ideas covered,
  a ✗ list of key ideas missed (each with a short explanation), and an example
  answer the student can reveal.
- At the end: overall score (the average of the cards), score for each card, a
  **Try again** button, and saved history of past runs with the best one marked.

**Grading:** each card has weighted `concepts`. Each concept is a list of regex
`patterns` matched against the lowercased answer. A concept counts as covered
when `need` patterns match (default 1). Card score = earned weight / total
weight.
- Verified with Node: every example answer scores 100%. Empty answers
  ("it draws stuff") score 0%. Realistic partial answers score about 70–85%
  after loosening a few patterns.
- Limitation: keyword matching. It can be gamed by keyword stuffing and can
  miss correct but unusually phrased answers. The start screen tells students
  it's a study guide, not a grade.
- Clicked through in Chrome after the two-part revision (see section 7).

### 7. Two-part quiz cards (later on 2026-10-13)
Each card now has two parts:
1. **Summarize**: a high-level summary, graded by the same `concepts` as before.
   Enter moves on to part 2.
2. **Comment each line**: the code opens in a small editor (a textarea with a
   line-number gutter, Tab = 2 spaces, Enter auto-indents, Ctrl/Cmd+Enter
   submits, and a "Reset code" button). Students add `//` comments at the end
   of a line or on the line above it.

- Comment score = the share of lines that need a comment (lines with a name or
  keyword, not just numbers or brackets) that got a comment of 2+ words. The
  content isn't checked. Students compare theirs with the card's new
  `annotated` field (example comments) after submitting.
- Submitting is blocked if the code itself was changed (compared after
  removing comments and extra whitespace). The error names the line.
- Card score = the average of the summary and comment scores. The results table
  shows Summary / Comments / Score.
- The cube vertex card's `...` placeholder line is now a `//` comment.
- Verified: all 12 `annotated` examples match their `code` and score 100%.
  Clicked through in Chrome (served from a local server) with no console errors.

### 8. Discussion: how should answers be assessed? (no code changes)
**How the `quiz/` grading works.** No LLM. The summary is checked with keyword
regexes, which test whether the right *words* appear, not whether the answer is
*correct*. The comment score only checks that comments exist. Both can be gamed
and can miss correct answers phrased in unusual words.

**LLM grading options considered** (not built):
- Decision 1: practice tool (instant feedback) vs. graded assessment
  (consistency, review before release).
- Decision 2, where the grader runs (the API key can never be in the browser):
  A. serverless function (Cloudflare/Netlify/Vercel), B. a university server,
  C. batch grading of exported answers (no server, 50% batch discount),
  D. hybrid: keyword feedback for practice, plus batch LLM grading of submissions.
- Rough Claude costs per 12-card run (estimates, not measured): Opus 5.5 ~$0.30,
  Sonnet 5.5 ~$0.15, Haiku 5.5 ~$0.01.
- Concerns: student privacy (check university policy, send anonymous IDs),
  students trying to trick the grader, and checking the grader against
  hand-graded answers.
- **Free open models on a server you manage** are possible (Ollama or vLLM, with
  Qwen, Llama, Gemma, Mistral, or gpt-oss models). Quality and speed depend on
  GPU memory: about 8–16 GB for small models, 24 GB for ~30B, 48 GB+ for 70B.
  CPU-only is fine for overnight batch grading, but too slow for live feedback.
  Student data stays on campus. Ask UC research computing about GPU access.

**Decision: no score, and no LLM.** Students should see for themselves what
they got and missed. Non-LLM options discussed: line-by-line comparison,
side-by-side summaries, highlighting where key ideas were found, a self-check
list, rating each line, revise-then-compare, one hint at a time, matching example
comments to lines, short multiple-choice questions, and reordering lines.
Chosen to try: **self-check list**, **match comments to lines**, and **targeted
multiple-choice questions**, built in a new folder so `quiz/` is kept as is
(see section 9).

### 9. New quiz: `quiz-selfcheck/` (no scores, no LLM)
`quiz/` is kept unchanged as the scored version. `quiz-selfcheck/` is a new copy
with its own `index.html`, `quiz.js`, `style.css`, and `cards.js`. There are no
scores. As first built, each card had five steps (section 10 has the current
four-step version):
1. **Summarize**: same as before.
2. **Comment**: the same editor as before. You can't move on if the code
   itself was changed.
3. **Match**: the card's example comments (from `annotated`), shuffled into a
   bank. Students drag each one onto its line, or click a comment and then a
   line. All comments must be placed before checking. Then each line gets ✓/✗,
   and students can rearrange and check again, or reveal the answer. Comments
   that are identical can go on either of their lines. Comments starting with
   `...` are skipped.
4. **Check yourself**: the student's summary next to the example summary,
   with the card's `concepts` as a checklist. Nothing is ticked
   automatically. Where a concept's keyword pattern matches, the words are
   highlighted as "Possibly in your summary". After "Done checking", the
   hints appear for unticked ideas. A collapsible block compares the
   student's comments with the example comments.
5. **Questions**: new `questions` field, 3 multiple-choice questions per card
   (36 total). Choices are shuffled, and every choice has a `why` explanation,
   so a wrong pick explains the misconception. Students keep trying until
   they get it right.

**Review list:** these go on a review list shown at the end: ideas left
unticked, lines wrong on the first matching check, and questions missed on
the first try. It's saved in `localStorage` (`webglQuizReview`) and shown on
the start screen next time.

**Content changes in `quiz-selfcheck/cards.js`:** a new header explaining the
format; the lookAt matrix-row comments were rewritten so each line's comment
makes sense on its own (needed for matching); and `questions` were added.

**Example comments rewritten (2026-10-14):** every `annotated` comment in
`quiz-selfcheck/cards.js` was reworded to be plain and direct (e.g. "scale"
instead of "stretch", "returns" instead of "hands back", standard terms like
column-major, interpolated, clip space, depth testing). Code is unchanged.
`quiz/cards.js` still has the old wording.

**Accuracy pass (2026-10-14):** fixed comments, hints, and example answers in
`quiz-selfcheck/cards.js`. Normals are now described as per-vertex normals; on
this cube each face's vertices are given that face's normal, which is why corners
are repeated (a smooth mesh would average face normals instead). Also corrected:
`mat3(uModel)` for normals (fine here, inverse transpose in general), dot = cosine
only for unit vectors, viewport maps NDC (not clip space), `clientWidth` is in CSS
pixels (doesn't prevent blur on high-DPI screens), STATIC_DRAW is a hint, vertical
field of view, and the perspective depth columns. `index.js` and `quiz/cards.js`
still say "direction the face is pointing" for `aNormal`.

**Verified:** all 12 `annotated` examples match their code. Matching has 3–12
slots per card. Clicked through all 12 cards in Chrome with no console
errors. Click-to-place was tested with real clicks. Drag-and-drop was tested
with synthetic drag events, because the automated mouse drag doesn't fire
browser drag events, so **try a real drag by hand**.

### 10. Self-check quiz: steps reordered, more questions (2026-10-14)
- Removed the **Comment** step (the editor). Matching covers line-by-line
  understanding. The editor code, its CSS, and the "compare your comments"
  block are gone from `quiz-selfcheck/`. (`quiz/` still has the editor.)
- New order: **Summarize → Check yourself → Match → Questions**, so students
  check their summary right after writing it.
- Questions: 2 new per card, now 5 per card (60 total). New topics include w = 1
  in `vec4(aPosition, 1.0)`, why the normal is normalized, smooth vs. flat
  normals, DYNAMIC_DRAW, offsets, misspelled uniform names, translate-then-scale
  order, w = -z, near = 0, parallel up vector, clearColor vs. clear, default
  canvas size, and animation.
- Corrected an older question: `canvas.width = canvas.clientWidth` matches the
  canvas's displayed size in CSS pixels; high-DPI screens also need
  `window.devicePixelRatio` to be fully sharp.
- Verified in Chrome: all 12 cards go through the 4 steps, with 5 questions each,
  and the review list appears at the end. No console errors.
- Reworded card 1 (vertex shader), question 4 because it was unclear. It now
  asks: "`aPosition` has three numbers (x, y, z), but the shader multiplies
  `vec4(aPosition, 1.0)`. Why add a fourth number, 1.0?" The choices and
  explanations no longer use "homogeneous coordinate" or "translation part";
  they say that w = 1 lets the 4×4 matrix move the point and w = 0 would not.
  If the course has already covered homogeneous coordinates, the term could be
  added back.

### 11. Exploration page before the self-check quiz (2026-10-14)
`quiz-selfcheck/` now opens on an **Explore the code** page. "Go to the quiz"
leads to the old start screen, which has a "Back to explore the code" button.

- Shows the whole program (`index.js` with its comments removed), split into 16
  colored sections: context, vertex shader, fragment shader, compile/link,
  vertex data, buffer, attributes, uniforms, scene, matrix helpers,
  perspective, lookAt, preparing a frame, camera, draw loop, load/resize.
- **Hover** a line: its section is highlighted and labeled, and the side panel
  shows the section summary, the matching quiz card, and "Read more" links.
- **Click** a line (or use Arrow Up/Down when the code has focus): the
  panel shows a note on that line, with links (mostly MDN pages for each `gl.*`
  call). Lines with a note have a dot; 137 of 204 lines have one.
- Section chips above the code jump to each section.
- New files: `explore-notes.js` (all content; the header explains the format)
  and `explore.js` (rendering). `index.html`, `quiz.js`, and `style.css` got
  small additions. The quiz itself is unchanged.
- Notes follow the accuracy fixes in `quiz-selfcheck/cards.js` (per-vertex
  normals, inverse transpose, CSS pixels, etc.).
- Verified: the code copy matches `index.js` line for line once comments
  are removed; every note matches a line; all 60 links resolve; hover,
  click, arrow keys, chips, and the screen buttons work in Chrome with no
  console errors.
- **The code is a copy.** If `index.js` changes, update `explore-notes.js`.

## Open issues / things to check

- `index.js` section 3: `GRID_SIZE = 1000` makes 1,000,000 cubes, which is one
  draw call each and very slow. The comment still says "10 × 10 = 100 cubes".
  The original value was `10` (`SPACING` was `1.5`, now `1.0`).
- `index.js` section 5: the camera is now `lookAt([56, 56, 72], [50, 0, 50], ...)`,
  but the grid is centered on the origin. The original was
  `lookAt([14, 14, 18], [0, 0, 0], [0, 1, 0])`.
- The quiz's draw-loop card uses the **original** camera values. If you change
  `index.js` further, the quiz snippets in `quiz/cards.js` are copies and
  won't update automatically.
- Git: nothing committed yet. `index.js` and `package.json` were staged at the
  start of the session; `index.html`, `quiz/`, `quiz-selfcheck/`, and this
  file are untracked.
- Read through the exploration notes in `quiz-selfcheck/explore-notes.js`
  and check the wording and links fit the course.
- `index.js` line with `SPACING` has a typo in its comment ("ce// nters").
- `quiz-selfcheck/`: try drag-and-drop by hand, and read through the 60
  questions to check that the wording fits the course.
- `index.js` (line 50, `aNormal`) and `quiz/cards.js` still describe the vertex
  normal as "the direction the face is pointing". The accuracy fixes were made
  only in `quiz-selfcheck/cards.js`.

## Possible next steps

- Try `quiz-selfcheck/` with a few students and decide which steps to keep.
- Optionally shuffle card order on "Try again".
- Add animation (`requestAnimationFrame`) or rotation as a follow-up exercise.
  Note the vertex shader's normal transform would then matter.
- Commit the work.
