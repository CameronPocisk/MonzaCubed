// =====================================================================
//  Flashcard quiz: check yourself on what each piece of WebGL code does
// =====================================================================
//
// The cards themselves live in cards.js. This file runs the quiz:
//   explore the code (explore.js) -> start screen -> one card at a time
//   -> review list -> start over
//
// Each card goes through four steps:
//   summary -> check -> match -> questions
//
// There are no scores. Students judge their own answers against the
// examples. Anything they miss is added to a review list, shown at the
// end and saved in this browser for next time.

const REVIEW_KEY = 'webglQuizReview';
const STEPS = ['summary', 'check', 'match', 'questions'];
const STEP_NAMES = {
  summary: 'Summarize',
  check: 'Check yourself',
  match: 'Match',
  questions: 'Questions',
};

const screens = {
  explore: document.getElementById('explore-screen'),
  start: document.getElementById('start-screen'),
  card: document.getElementById('card-screen'),
  results: document.getElementById('results-screen'),
};

const $ = (id) => document.getElementById(id);
const el = {
  cardCount: $('card-count'),
  startButton: $('start-button'),
  lastReview: $('last-review'),

  progress: $('progress'),
  progressBar: $('progress-bar'),
  cardTitle: $('card-title'),
  stepDots: $('step-dots'),

  codeSummary: $('code-summary'),
  answer: $('answer'),
  summaryNext: $('summary-next'),

  yourSummary: $('your-summary'),
  exampleSummary: $('example-summary'),
  ideaList: $('idea-list'),
  checkDone: $('check-done'),
  checkNext: $('check-next'),

  matchBank: $('match-bank'),
  matchBoard: $('match-board'),
  matchStatus: $('match-status'),
  matchCheck: $('match-check'),
  matchReveal: $('match-reveal'),
  matchNext: $('match-next'),

  codeQuestions: $('code-questions'),
  questionList: $('question-list'),
  questionsNext: $('questions-next'),

  reviewSummary: $('review-summary'),
  review: $('review'),
  retryButton: $('retry-button'),
};

// State for the current run.
let current = 0;        // index of the card being shown
let step = 'summary';   // which step of the card is showing
let review = [];        // things to review: { card, kind, text, detail }
let match = null;       // state of the matching step (see startMatch)


// ---------------------------------------------------------------------
// Reading code and comments
// ---------------------------------------------------------------------

// Split code into its code lines. Each entry has:
//   code       - the code, with comments removed and spaces tidied
//   display    - the code as written, with its indentation
//   trailing   - the // comment at the end of the line, if any
//   above      - comment-only lines directly above it (a blank line
//                breaks the connection)
//   lineNumber - 1-based line number in the text
function parseLines(text) {
  const lines = [];
  let above = [];

  text.split('\n').forEach((line, i) => {
    const slash = line.indexOf('//');
    const codePart = slash === -1 ? line : line.slice(0, slash);
    const comment = slash === -1 ? '' : line.slice(slash + 2).trim();
    const code = codePart.trim().replace(/\s+/g, ' ');

    if (code === '') {
      above = comment ? [...above, comment] : [];
      return;
    }
    lines.push({ code, display: codePart.trimEnd(), trailing: comment, above, lineNumber: i + 1 });
    above = [];
  });
  return lines;
}


// ---------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Fill an element with text, showing `backtick` spans as code.
function setRichText(element, text) {
  element.replaceChildren(...text.split('`').map((part, i) => {
    if (i % 2 === 0) return document.createTextNode(part);
    const code = document.createElement('code');
    code.textContent = part;
    return code;
  }));
}

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function addToReview(kind, text, detail) {
  review.push({ card: CARDS[current].title, kind, text, detail });
}


// ---------------------------------------------------------------------
// Moving between cards and steps
// ---------------------------------------------------------------------

function show(name) {
  for (const [key, screen] of Object.entries(screens)) {
    screen.hidden = key !== name;
  }
  // The exploration page needs room for the code and the side panel.
  document.body.classList.toggle('wide', name === 'explore');
  window.scrollTo(0, 0);
}

function startQuiz() {
  current = 0;
  review = [];
  show('card');
  showCard();
}

function showCard() {
  const card = CARDS[current];
  el.progress.textContent = `Card ${current + 1} of ${CARDS.length}`;
  el.cardTitle.textContent = card.title;

  el.codeSummary.textContent = card.code.trim();
  el.codeQuestions.textContent = card.code.trim();
  el.answer.value = '';

  showStep('summary');
  el.answer.focus();
}

function showStep(name) {
  step = name;
  const index = STEPS.indexOf(name);

  for (const section of document.querySelectorAll('.step')) {
    section.hidden = section.dataset.step !== name;
  }

  el.stepDots.replaceChildren(...STEPS.map((s, i) => {
    const dot = make('li', i < index ? 'done' : i === index ? 'current' : '', STEP_NAMES[s]);
    return dot;
  }));

  const done = current * STEPS.length + index;
  el.progressBar.style.width = `${(done / (CARDS.length * STEPS.length)) * 100}%`;
  window.scrollTo(0, 0);
}

function nextCard() {
  current++;
  if (current < CARDS.length) {
    showCard();
  } else {
    showResults();
  }
}


// ---------------------------------------------------------------------
// Step 1: summary
// ---------------------------------------------------------------------

function finishSummary() {
  if (el.answer.value.trim() === '') {
    el.answer.focus();
    return;
  }
  startCheck();
}


// ---------------------------------------------------------------------
// Step 2: self-check the summary against the key ideas
// ---------------------------------------------------------------------

// Look for words in the answer that might match a key idea. Returns the
// matching words with a little text around them, or null.
function findEvidence(concept, answer) {
  const flat = answer.replace(/\s+/g, ' ').trim();
  const lower = flat.toLowerCase().replace(/×/g, 'x');
  for (const pattern of concept.patterns) {
    const found = new RegExp(pattern.source).exec(lower);
    if (found && found[0]) {
      const start = found.index;
      const end = start + found[0].length;
      const from = Math.max(0, start - 30);
      const to = Math.min(flat.length, end + 30);
      return {
        before: (from > 0 ? '…' : '') + flat.slice(from, start),
        match: flat.slice(start, end),
        after: flat.slice(end, to) + (to < flat.length ? '…' : ''),
      };
    }
  }
  return null;
}

function startCheck() {
  const card = CARDS[current];
  const answer = el.answer.value.trim();
  el.yourSummary.textContent = answer;
  el.exampleSummary.textContent = card.modelAnswer;

  el.ideaList.replaceChildren(...card.concepts.map((concept, i) => {
    const item = make('li', 'idea');
    const label = make('label');
    const box = make('input');
    box.type = 'checkbox';
    box.id = `idea-${i}`;
    label.append(box, make('span', 'idea-label', concept.label));
    item.append(label);

    const evidence = findEvidence(concept, answer);
    if (evidence) {
      const spotted = make('div', 'spotted');
      spotted.append('Possibly in your summary: "', evidence.before,
        make('mark', '', evidence.match), evidence.after, '"');
      item.append(spotted);
    }
    const hint = make('div', 'hint', concept.hint);
    hint.hidden = true;
    item.append(hint);
    return item;
  }));

  el.checkDone.hidden = false;
  el.checkNext.hidden = true;
  showStep('check');
}

function finishCheck() {
  const card = CARDS[current];
  [...el.ideaList.children].forEach((item, i) => {
    const box = item.querySelector('input');
    box.disabled = true;
    if (box.checked) {
      item.classList.add('got');
    } else {
      item.classList.add('missed');
      item.querySelector('.hint').hidden = false;
      addToReview('Key idea', card.concepts[i].label, card.concepts[i].hint);
    }
  });
  el.checkDone.hidden = true;
  el.checkNext.hidden = false;
  el.checkNext.focus();
}


// ---------------------------------------------------------------------
// Step 3: match the example comments to their lines
// ---------------------------------------------------------------------
//
// Each line of the card's annotated code that has a comment gets a slot.
// The comments are shuffled into a bank, and the student places one in each slot.
// A placement is right if the comment's text is the slot's comment, so
// two identical comments can go in either of their slots.

function startMatch() {
  const lines = parseLines(CARDS[current].annotated.trim());
  const slots = [];
  const rows = lines.map((line) => {
    const expected = line.trailing || line.above.join(' ');
    const hasSlot = expected !== '' && !expected.startsWith('...');
    if (hasSlot) slots.push({ expected, placed: null, mark: '' });
    return { display: line.display, slot: hasSlot ? slots.length - 1 : null };
  });

  match = {
    rows,
    slots,
    pieces: shuffle(slots.map((slot, id) => ({ id, text: slot.expected }))),
    selected: null,    // id of the piece picked up by clicking
    checked: false,    // has the student checked at least once?
  };

  el.matchStatus.hidden = true;
  el.matchCheck.hidden = false;
  el.matchReveal.hidden = true;
  el.matchNext.hidden = true;
  showStep('match');
  renderMatch();
}

// Put a piece in a slot. Whatever was in that slot goes back to the bank.
function placePiece(pieceId, slotIndex) {
  for (const slot of match.slots) {
    if (slot.placed === pieceId) slot.placed = null;
  }
  const slot = match.slots[slotIndex];
  slot.placed = pieceId;
  slot.mark = '';
  match.selected = null;
  renderMatch();
}

function removePiece(slotIndex) {
  match.slots[slotIndex].placed = null;
  match.slots[slotIndex].mark = '';
  renderMatch();
}

function pieceElement(piece) {
  const button = make('button', 'piece', piece.text);
  button.draggable = true;
  button.addEventListener('dragstart', (event) => {
    event.dataTransfer.setData('text/plain', String(piece.id));
  });
  return button;
}

function renderMatch() {
  // The bank: pieces that aren't in a slot yet
  const placed = new Set(match.slots.map((slot) => slot.placed));
  const loose = match.pieces.filter((piece) => !placed.has(piece.id));
  el.matchBank.replaceChildren(...loose.map((piece) => {
    const button = pieceElement(piece);
    if (match.selected === piece.id) button.classList.add('selected');
    button.addEventListener('click', () => {
      match.selected = match.selected === piece.id ? null : piece.id;
      renderMatch();
    });
    return button;
  }));
  if (loose.length === 0) {
    el.matchBank.append(make('span', 'note', 'All comments are placed.'));
  }

  // The board: each code line, with a slot under the lines that have one
  el.matchBoard.replaceChildren(...match.rows.map((row) => {
    const rowEl = make('div', 'match-row');
    rowEl.append(make('pre', 'match-code', row.display));
    if (row.slot === null) return rowEl;

    const slot = match.slots[row.slot];
    const slotEl = make('div', `slot ${slot.mark}`);
    if (slot.placed === null) {
      const empty = make('button', 'slot-empty', match.selected === null ? 'Drop a comment here' : 'Click to place it here');
      empty.addEventListener('click', () => {
        if (match.selected !== null) placePiece(match.selected, row.slot);
      });
      slotEl.append(empty);
    } else {
      const piece = match.pieces.find((p) => p.id === slot.placed);
      const button = pieceElement(piece);
      button.title = 'Click to take this comment off';
      button.addEventListener('click', () => {
        if (match.selected !== null) placePiece(match.selected, row.slot);
        else removePiece(row.slot);
      });
      slotEl.append(button);
    }
    if (slot.mark) slotEl.append(make('span', 'mark', slot.mark === 'right' ? '✓' : '✗'));

    slotEl.addEventListener('dragover', (event) => event.preventDefault());
    slotEl.addEventListener('drop', (event) => {
      event.preventDefault();
      placePiece(Number(event.dataTransfer.getData('text/plain')), row.slot);
    });
    rowEl.append(slotEl);
    return rowEl;
  }));
}

// Dropping a piece back on the bank takes it out of its slot.
el.matchBank.addEventListener('dragover', (event) => event.preventDefault());
el.matchBank.addEventListener('drop', (event) => {
  event.preventDefault();
  const id = Number(event.dataTransfer.getData('text/plain'));
  const index = match.slots.findIndex((slot) => slot.placed === id);
  if (index !== -1) removePiece(index);
});

function checkMatch() {
  const empty = match.slots.filter((slot) => slot.placed === null).length;
  if (empty > 0) {
    el.matchStatus.textContent = `Place all the comments first (${empty} left).`;
    el.matchStatus.className = 'status';
    el.matchStatus.hidden = false;
    return;
  }

  let right = 0;
  match.slots.forEach((slot, i) => {
    const piece = match.pieces.find((p) => p.id === slot.placed);
    const isRight = piece !== undefined && piece.text === slot.expected;
    slot.mark = isRight ? 'right' : 'wrong';
    if (isRight) right++;

    // The first check decides what goes on the review list.
    if (!match.checked && !isRight) {
      const row = match.rows.find((r) => r.slot === i);
      addToReview('Line comment', `\`${row.display.trim()}\``, slot.expected);
    }
  });
  match.checked = true;

  const total = match.slots.length;
  el.matchStatus.textContent = right === total
    ? `All ${total} matched!`
    : `${right} of ${total} are in the right place. Move the ✗ ones and check again, or show the answer.`;
  el.matchStatus.className = `status ${right === total ? 'right' : ''}`;
  el.matchStatus.hidden = false;
  el.matchReveal.hidden = right === total;
  el.matchNext.hidden = false;
  renderMatch();
}

function revealMatch() {
  // Give each slot a piece with its text (identical texts are interchangeable).
  const unused = [...match.pieces];
  for (const slot of match.slots) {
    const index = unused.findIndex((piece) => piece.text === slot.expected);
    slot.placed = unused.splice(index, 1)[0].id;
    slot.mark = 'right';
  }
  match.selected = null;
  el.matchStatus.textContent = 'Here is where each example comment goes.';
  el.matchStatus.className = 'status';
  el.matchReveal.hidden = true;
  renderMatch();
}


// ---------------------------------------------------------------------
// Step 4: multiple-choice questions
// ---------------------------------------------------------------------
//
// Students can keep trying until they find the right choice. A question
// goes on the review list if the first choice was wrong.

function startQuestions() {
  const card = CARDS[current];
  let solved = 0;

  el.questionList.replaceChildren(...card.questions.map((question, qi) => {
    const block = make('div', 'question');
    const ask = make('p', 'ask');
    setRichText(ask, `${qi + 1}. ${question.ask}`);
    const choices = make('div', 'choices');
    const why = make('p', 'why');
    why.hidden = true;
    let firstTry = true;
    let done = false;

    for (const choice of shuffle(question.choices)) {
      const button = make('button', 'choice');
      setRichText(button, choice.text);
      button.addEventListener('click', () => {
        if (done) return;
        setRichText(why, `${choice.correct ? 'Yes. ' : 'Not quite. '}${choice.why}`);
        why.className = `why ${choice.correct ? 'right' : 'wrong'}`;
        why.hidden = false;
        button.classList.add(choice.correct ? 'right' : 'wrong');
        button.disabled = true;

        if (!choice.correct && firstTry) {
          const answer = question.choices.find((c) => c.correct);
          addToReview('Question', question.ask, `${answer.text}. ${answer.why}`);
        }
        firstTry = false;

        if (choice.correct) {
          done = true;
          for (const other of choices.children) other.disabled = true;
          solved++;
          if (solved === card.questions.length) {
            el.questionsNext.hidden = false;
          }
        }
      });
      choices.append(button);
    }
    block.append(ask, choices, why);
    return block;
  }));

  el.questionsNext.textContent = current === CARDS.length - 1 ? 'See your review list' : 'Next card';
  el.questionsNext.hidden = true;
  showStep('questions');
}


// ---------------------------------------------------------------------
// End: the review list (saved in this browser with localStorage)
// ---------------------------------------------------------------------

function renderReview(container, items) {
  container.replaceChildren();
  const byCard = new Map();
  for (const item of items) {
    if (!byCard.has(item.card)) byCard.set(item.card, []);
    byCard.get(item.card).push(item);
  }
  for (const [card, cardItems] of byCard) {
    container.append(make('h3', '', card));
    const list = make('ul', 'review-list');
    for (const item of cardItems) {
      const li = make('li');
      const main = make('div');
      main.append(make('span', 'tag', item.kind));
      const text = make('span');
      setRichText(text, item.text);
      main.append(text);
      const detail = make('div', 'hint');
      setRichText(detail, item.detail);
      li.append(main, detail);
      list.append(li);
    }
    container.append(list);
  }
}

function showResults() {
  el.progressBar.style.width = '100%';
  el.reviewSummary.textContent = review.length === 0
    ? 'Nothing to review: you covered every key idea, matched every comment, and got every question on the first try.'
    : `${review.length} thing${review.length === 1 ? '' : 's'} to review, grouped by card. Each one shows the idea or answer to study.`;
  renderReview(el.review, review);

  try {
    localStorage.setItem(REVIEW_KEY, JSON.stringify({ date: new Date().toLocaleString(), items: review }));
  } catch {
    // Storage can be unavailable (e.g. private browsing); that's fine.
  }
  show('results');
  el.retryButton.focus();
}

function showLastReview() {
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(REVIEW_KEY));
  } catch {
    // Ignore unreadable storage.
  }
  el.lastReview.replaceChildren();
  if (!saved || saved.items.length === 0) return;

  const details = make('details');
  details.append(make('summary', '',
    `Your review list from last time (${saved.date}): ${saved.items.length} item${saved.items.length === 1 ? '' : 's'}`));
  const body = make('div');
  renderReview(body, saved.items);
  details.append(body);
  el.lastReview.append(details);
}


// ---------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------

$('explore-done').addEventListener('click', () => show('start'));
$('back-to-explore').addEventListener('click', () => show('explore'));
el.startButton.addEventListener('click', startQuiz);
el.retryButton.addEventListener('click', startQuiz);
el.summaryNext.addEventListener('click', finishSummary);
el.checkDone.addEventListener('click', finishCheck);
el.checkNext.addEventListener('click', startMatch);
el.matchCheck.addEventListener('click', checkMatch);
el.matchReveal.addEventListener('click', revealMatch);
el.matchNext.addEventListener('click', startQuestions);
el.questionsNext.addEventListener('click', nextCard);

// In the summary box, Enter moves on; Shift+Enter adds a new line.
el.answer.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    finishSummary();
  }
});

// On the start screen
el.cardCount.textContent = CARDS.length;
showLastReview();
show('explore');
