# How to build a self-check code quiz for a new example

These instructions are for a Claude instance that has a well-commented
teaching example (a single program, written for students) and needs to build
a quiz for it. The quiz should use the same approach and structure as the
existing WebGL cube quiz in this folder.

The quiz is a static web page: no backend, no build step, no libraries, no
LLM, and **no scores**. Students work through it on their own and judge their
own answers against examples. Anything they miss goes on a review list.

---

## 1. What the finished quiz does

The quiz has an exploration page, then a set of cards.

**Exploration page (shown first).** The whole program is shown with its
comments removed and split into colored sections.
- Hovering over a line highlights its section. A side panel shows the
  section's summary, which quiz card practices it, and "Read more" links.
- Clicking a line (or using Arrow Up/Down) shows a note about that line, with
  links (for example, the reference page for an API call).
- Lines that have a note are marked with a dot. Buttons above the code jump
  to each section.
- "Go to the quiz" leads to the start screen. The start screen has a "Back to
  explore the code" button.

**Cards (about 8–14, in the order the program runs).** Each card shows one
piece of the program with its comments removed. Each card has four steps:
1. **Summarize.** The student writes a few sentences: what does this code
   accomplish, and why is it needed? Enter moves on.
2. **Check yourself.** The student's summary is shown next to an example
   summary, with a checklist of key ideas. The student ticks the ideas they
   really explained. Nothing is ticked automatically. Where a keyword pattern
   matches the student's text, those words are highlighted as "possibly in
   your summary". After "Done checking", a hint appears for each unticked idea.
3. **Match.** Example comments for the card's lines are shuffled into a bank.
   The student drags each comment onto its line (or clicks a comment, then a
   line), then checks. Each line gets ✓ or ✗. The student can rearrange and
   check again, or reveal the answer.
4. **Questions.** 5 multiple-choice questions per card. Every choice has an
   explanation, so a wrong pick explains the misconception. The student keeps
   trying until they get it right.

**Review list.** These go on a list shown at the end:
- ideas left unticked
- lines that were wrong on the first matching check
- questions missed on the first try

The list is saved in `localStorage` and shown on the start screen next time.

---

## 2. Reuse the engine; write new content

Copy this whole folder to a new folder next to the new example (for example
`quiz/`). The files split into an **engine** (keep it, change only the names)
and **content** (rewrite it completely).

| File | Role | What to do |
|---|---|---|
| `index.html` | engine | Change the `<title>`, the `<h1>`, and the three spots that say "WebGL cube program" (exploration intro, the code's `aria-label`, start screen). |
| `quiz.js` | engine | Change the header comment and `REVIEW_KEY` (`'webglQuizReview'`) to a key unique to the new quiz, so two quizzes don't share a review list. |
| `explore.js` | engine | Change "This is the whole cube program" in `renderSectionPanel`. Update `KEYWORDS` and `TYPES` (the syntax-coloring word lists) for the new language. |
| `style.css` | engine | No changes needed. |
| `cards.js` | **content** | Rewrite: the quiz cards. Keep the header comment (it documents the format). |
| `explore-notes.js` | **content** | Rewrite: the exploration page. Keep the header comment and the link helpers if they fit (`mdn()` builds MDN links for WebGL calls; replace or remove it). |
| `HOW_TO_MAKE_A_NEW_QUIZ.md` | this file | Optional to keep. |

Do not change the quiz's behavior unless asked. The point is that both quizzes
feel the same to students.

### Language limits of the engine

- **Comments must use `//`.** `parseLines()` in `quiz.js` splits code from
  comments at the first `//` on a line. That works for JavaScript, GLSL, C,
  C++, Java, C#, Rust, Go, Swift, and Kotlin. For Python, shell, R, or
  similar, change the comment marker in `parseLines()` (one place). Tell the
  instructor you did.
- **No `//` inside strings in card code** (such as `'https://...'`). It would
  be read as a comment. If a snippet needs one, change the snippet or ask.
- `/* block comments */` are not understood. Use `//` comments in `annotated`.
- In `explore-notes.js` the code sits in JavaScript template literals, so any
  backtick in the code must be written as `` \` ``, and `${` must be written
  as `\${`.

---

## 3. Before you start

Read the whole example and its comments. You need to understand it well
enough to write correct explanations and good wrong answers. Then confirm (or
ask the instructor):
- **The audience.** For example, intro students who have not seen
  homogeneous coordinates yet. Pitch the wording at that level.
- **Terms to use or avoid.** If the course hasn't covered a term yet, explain
  the idea in plain words instead.
- **How to split the program into cards.** Propose a split, one card per idea,
  in the order the program runs, and check it with the instructor if the
  split isn't obvious.
- **Code values.** If the example has leftover experimental values (a huge
  loop count, an odd camera position), ask which version the quiz should
  show. Cards and the exploration page are copies and won't update on their
  own.

---

## 4. Build the exploration page (`explore-notes.js`)

The file defines `EXPLORE_SECTIONS`, a list in program order. Its header
comment documents the format. In short:

```js
{
  id: 'buffer',                          // short unique name
  title: 'Creating and filling a buffer',
  card: 'Creating and filling a buffer', // optional: the card title that practices it
  summary: "What this section does, in 2–4 sentences. `backticks` show as code.",
  links: [['Link text', 'https://...']], // optional "Read more" links
  code: `
const buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);`,
  notes: [
    { match: 'gl.createBuffer', text: "Note about that line.", links: [['MDN: ...', 'https://...']] },
    { match: /0, 0, 1,$/, text: "A RegExp note applies to every line it matches." },
  ],
}
```

- **The code is the whole program with every comment removed,** split into
  sections. Joined back together, the sections must match the original
  program line for line (ignoring comments and whitespace). Keep blank lines
  inside a section where they help readability.
- **Sections:** about 10–20, finer than the program's own headings. Match them
  to the quiz cards where possible, and set `card` on those. Code that no card
  covers (setup, plain data) still gets a section, just without `card`.
- **`match` (string):** the first line containing that text, searched after
  the previous string match. So repeated lines (two `enable...` calls) are
  matched in order. Pick text that is unique from that point on.
- **`match` (RegExp):** every line it matches. Use it for repeated rows such as
  data tables. Test the RegExp against the lines it must *not* match too.
- **Notes:** aim for a note on every line that does something: about two
  thirds of lines. Closing brackets and blank lines don't need notes.
  - Say what the line does *and why*, and mention arguments that matter.
  - Point out gotchas students hit: return values on failure, things the code
    doesn't check, hints vs. guarantees, order of operations.
  - Link the API's reference page for each library call. Link one or two good
    tutorials per section.
- **Links:** prefer stable, well-known sources: official docs (MDN, language
  and library docs), well-known tutorials, and specs. No paywalled links, and
  no links you can't verify.

---

## 5. Write the cards (`cards.js`)

`CARDS` is a list in program order. The header comment documents each field.
Look at an existing card in this folder's `cards.js` for a full example.

```js
{
  title: 'Creating and filling a buffer',
  language: 'javascript',          // informational
  code: `...`,                     // the snippet, no comments
  annotated: `...`,                // the same snippet with example comments
  concepts: [ { label, hint, patterns: [/regex/], need, weight }, ... ],
  modelAnswer: '...',              // example summary
  questions: [ { ask, choices: [ { text, why, correct: true }, ... ] }, ... ],
}
```

### `code` and `annotated`
- `code` is a snippet copied from the program, comments removed. Snippets can
  be shortened (for example, show a few rows of a long data table). Replace the
  gap with a comment line starting with `// ...`; comments starting with `...`
  are skipped in matching.
- `annotated` must be **exactly** `code` plus `//` comments. Same code, same
  line order. Check this mechanically (section 7).
- Each line's comment becomes one matching piece: the comment at the end of
  the line, or else the comment-only line(s) directly above it. A blank line
  breaks that link. A line with no comment gets no slot.
- **Write each comment so it makes sense on its own,** shuffled and away from
  its line. "Same as above" or "the second row" can't be matched. If two lines
  really have identical comments, either slot accepts either piece.
- Keep each card's matching to roughly **3–12 slots**. More is tedious.
- Wording: plain and direct. Use "scale", not "stretch"; use "returns", not
  "hands back". Use the standard technical term once the course has taught it
  (column-major, interpolated, clip space).

### `concepts` (the self-check list)
- 3–6 key ideas per card: what a good summary covers. `label` is shown as a
  checkbox. `hint` is shown if the student leaves it unticked, so make it
  teach the idea in a sentence.
- `patterns` are lowercase regexes. If any matches the student's summary,
  those words are highlighted as possible evidence. They only point things
  out; nothing is graded. Make them generous and include synonyms.
- `need` and `weight` are ignored by this quiz (they're left over from a
  scored version). You can leave them out.
- `modelAnswer`: 3–6 sentences that cover every concept, in plain language.

### `questions` (5 per card)
- Ask about understanding, not recall: "what happens if…", "why is…",
  "which comes first…", "what would break if…". Good topics include common
  mistakes, changing a value, order of operations, what runs how often, and
  the difference between two similar things.
- 3–4 choices. Exactly one has `correct: true`. Choices are shuffled when
  shown, so don't write "both of the above".
- **Every choice needs a `why`.** For wrong choices, name the misconception and
  correct it. For the right choice, add a sentence of reasoning, not just
  "correct".
- Wrong choices should be believable mistakes a student would really make,
  not jokes.
- Avoid ambiguity: if a careful expert could argue for two choices, reword
  the question. Avoid terms the course hasn't introduced, or explain them in
  the question.
- `` `backticks` `` show as code in `ask`, `text`, and `why`.

---

## 6. Accuracy pass

After writing, reread every comment, note, hint, example answer, and question
explanation and look for statements that are only *roughly* true. In the WebGL
quiz, these needed fixing:
- the normal is a per-vertex value, not "the direction the face points"
- `mat3(model)` for normals only works here because the cube's normals line up
  with the axes and the model only scales along the axes; with non-uniform
  scaling or shear in general, you need the inverse transpose
- the dot product equals the cosine only for unit vectors
- `STATIC_DRAW` is a hint, not a rule
- the viewport maps NDC, not clip space
- `clientWidth` is in CSS pixels

Watch for the same kinds of over-simplifications in the new example. Where a
simplification is right *for this program* but not in general, say both
briefly ("This works here because…; in general…").

Keep the cards and the exploration notes consistent with each other.

---

## 7. Verify before handing it over

Run these checks with Node (adjust paths). Fix everything they report.

**a. Every card's `annotated` matches its `code`:**
```js
const fs = require('fs');
const CARDS = new Function(fs.readFileSync('quiz/cards.js', 'utf8') + ';return CARDS;')();
const strip = (t) => t.split('\n')
  .map((l) => { const i = l.indexOf('//'); return (i < 0 ? l : l.slice(0, i)).trim().replace(/\s+/g, ' '); })
  .filter(Boolean).join('\n');
CARDS.forEach((c, i) => {
  if (strip(c.code) !== strip(c.annotated)) console.log('MISMATCH card', i + 1, c.title);
  const right = c.questions.map((q) => q.choices.filter((x) => x.correct).length);
  if (right.some((n) => n !== 1)) console.log('Card', i + 1, 'question without exactly one correct choice');
  if (c.questions.some((q) => q.choices.some((x) => !x.why))) console.log('Card', i + 1, 'choice missing why');
});
console.log(CARDS.length, 'cards checked');
```

**b. The exploration code matches the program, and every note finds a line** (run in the same script as a, which defines `fs` and `strip`):
```js
const S = new Function(fs.readFileSync('quiz/explore-notes.js', 'utf8') + ';return EXPLORE_SECTIONS;')();
const lines = (t) => strip(t).split('\n');
const orig = lines(fs.readFileSync('path/to/program.js', 'utf8'));
const mine = lines(S.map((s) => s.code).join('\n'));
orig.forEach((l, i) => { if (l !== mine[i]) console.log('DIFF at', i, l, '|', mine[i]); });
if (orig.length !== mine.length) console.log('line counts differ', orig.length, mine.length);
for (const s of S) {
  const L = s.code.replace(/^\n/, '').split('\n'); let from = 0;
  for (const n of s.notes) {
    if (n.match instanceof RegExp) { if (!L.some((l) => n.match.test(l))) console.log('RegExp matches nothing:', s.id, n.match); continue; }
    const i = L.findIndex((l, j) => j >= from && l.includes(n.match));
    if (i < 0) console.log('NO MATCH', s.id, n.match); else from = i + 1;
  }
}
```
(If the program's comments use something other than `//`, adjust `strip`.)

**c. Every link opens.** Collect all URLs from both files and request each
one (`curl -L -o /dev/null -w "%{http_code}"`). Some sites (for example
learnopengl.com) reject curl with 406 but work with a browser `User-Agent`
and `Accept: text/html` header. Remove or replace any link that is really
broken.

**d. Click through it in a browser.** Serve the folder locally
(`python3 -m http.server <port>`) and open it.
- On the exploration page, check hover, click, arrow keys, and the section
  buttons.
- Go through every card's four steps. Check the review list at the end and on
  the start screen after reloading.
- Check the console for errors. `explore.js` logs a warning for any note
  whose `match` finds no line.
- Automated mouse drags often don't fire browser drag events. Test matching
  with click-to-place, and tell the instructor to try a real drag by hand.

---

## 8. Hand-off

Tell the instructor:
- where the quiz is and how to open it (`index.html` works straight from the
  file)
- the card list, and the number of exploration sections and notes
- what you verified and how (the checks above)
- anything you couldn't verify, any engine changes (for example, the comment
  marker), and any problems you noticed in the example itself (you can mention
  them, but don't fix the example unless asked)
- that the quiz code is a **copy**: if the example program changes, the cards
  and `explore-notes.js` must be updated by hand
- a request to read the wording of the questions and notes, to check they fit
  the course

If the project keeps a notes file (such as `SESSION_NOTES.md`), add a short
section describing the new quiz.
