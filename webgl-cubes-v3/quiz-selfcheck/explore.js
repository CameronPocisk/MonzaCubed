// =====================================================================
//  Explore the code: the page shown before the quiz
// =====================================================================
//
// The content lives in explore-notes.js. This file draws it:
//   - the whole program, one row per line, grouped by section
//   - hovering a line highlights its section and shows the section's
//     summary in the side panel
//   - clicking a line selects it and shows its note (if it has one)
//   - Arrow Up / Down move the selection while the code has focus

const explore = {
  nav: document.getElementById('explore-nav'),
  code: document.getElementById('explore-code'),
  section: document.getElementById('explore-section'),
  line: document.getElementById('explore-line'),
};

// Section colors for the stripe beside the code (cycled).
const SECTION_COLORS = ['#82aaff', '#c3e88d', '#ffcb6b', '#f78c6c', '#c792ea', '#89ddff'];

let exploreRows = [];        // every rendered line: { row, section, note }
let hoveredSection = null;   // section the mouse is over, or null
let selectedRow = null;      // index into exploreRows, or null


// ---------------------------------------------------------------------
// Syntax coloring (small and approximate: enough for this program)
// ---------------------------------------------------------------------

const KEYWORDS = new Set([
  'const', 'let', 'function', 'return', 'for', 'of', 'new', 'if', 'throw',
  'attribute', 'uniform', 'varying', 'precision', 'mediump', 'void',
]);
const TYPES = new Set(['float', 'vec3', 'vec4', 'mat3', 'mat4']);

// Returns the line as a list of spans and text nodes.
function colorize(line) {
  const parts = [];
  const token = /('(?:[^'\\]|\\.)*')|(`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)|([^'`\w]+|.)/g;
  let found;
  while ((found = token.exec(line)) !== null) {
    const [text, string, backtick, number, word] = found;
    let kind = '';
    if (string || backtick) kind = 'tok-string';
    else if (number) kind = 'tok-number';
    else if (word) {
      const next = line.slice(token.lastIndex).trimStart()[0];
      if (KEYWORDS.has(word)) kind = 'tok-keyword';
      else if (TYPES.has(word)) kind = 'tok-type';
      else if (/^[A-Z][A-Z0-9_]+$/.test(word)) kind = 'tok-constant';
      else if (next === '(') kind = 'tok-function';
    }
    parts.push(kind ? make('span', kind, text) : document.createTextNode(text));
  }
  return parts;
}


// ---------------------------------------------------------------------
// Building the page
// ---------------------------------------------------------------------

// Pair each line of a section's code with its note (or null).
function linesWithNotes(section) {
  const lines = section.code.replace(/^\n/, '').split('\n');
  const notes = new Array(lines.length).fill(null);
  let searchFrom = 0;

  for (const note of section.notes) {
    if (note.match instanceof RegExp) {
      lines.forEach((line, i) => {
        if (note.match.test(line)) notes[i] = note;
      });
    } else {
      const i = lines.findIndex((line, j) => j >= searchFrom && line.includes(note.match));
      if (i === -1) {
        console.warn(`explore-notes.js: no line in "${section.title}" contains`, note.match);
        continue;
      }
      notes[i] = note;
      searchFrom = i + 1;
    }
  }
  return lines.map((text, i) => ({ text, note: notes[i] }));
}

function buildExplore() {
  let lineNumber = 0;
  exploreRows = [];

  const blocks = EXPLORE_SECTIONS.map((section, s) => {
    const block = make('div', 'code-section');
    block.dataset.section = section.id;
    block.style.setProperty('--section-color', SECTION_COLORS[s % SECTION_COLORS.length]);
    block.append(make('span', 'section-tag', section.title));

    for (const { text, note } of linesWithNotes(section)) {
      lineNumber++;
      const row = make('div', note ? 'code-line has-note' : 'code-line');
      row.dataset.index = exploreRows.length;
      row.append(make('span', 'ln', String(lineNumber)), make('span', 'dot'));
      const code = make('span', 'code-text');
      code.append(...colorize(text));
      row.append(code);
      block.append(row);
      exploreRows.push({ row, section, note });
    }
    return block;
  });
  explore.code.replaceChildren(...blocks);

  explore.nav.replaceChildren(...EXPLORE_SECTIONS.map((section, s) => {
    const chip = make('button', 'nav-chip', section.title);
    chip.type = 'button';
    chip.style.setProperty('--section-color', SECTION_COLORS[s % SECTION_COLORS.length]);
    chip.addEventListener('click', () => {
      const first = exploreRows.findIndex((r) => r.section === section);
      selectRow(first);
      exploreRows[first].row.closest('.code-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return chip;
  }));

  renderSectionPanel();
  renderLinePanel();
}


// ---------------------------------------------------------------------
// The side panel
// ---------------------------------------------------------------------

function linkList(links) {
  const list = make('ul', 'link-list');
  for (const [text, url] of links) {
    const li = make('li');
    const a = make('a', '', text);
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    li.append(a);
    list.append(li);
  }
  return list;
}

// The section box shows the hovered section, or else the selected
// line's section, or else the instructions.
function renderSectionPanel() {
  const section = hoveredSection
    || (selectedRow !== null ? exploreRows[selectedRow].section : null);

  if (!section) {
    explore.section.replaceChildren(
      make('h3', '', 'How to explore'),
      make('p', '', 'This is the whole cube program, with its comments removed.'),
      make('p', '', 'Hover over the code to see which part of the program it belongs to and what that part does.'),
      make('p', '', 'Click a line to read about it. Lines marked with a dot have a note.'),
    );
    return;
  }

  const summary = make('p');
  setRichText(summary, section.summary);
  const children = [make('p', 'panel-kicker', 'Section'), make('h3', '', section.title), summary];
  if (section.card) {
    const card = make('p', 'note');
    setRichText(card, `Quiz card: "${section.card}"`);
    children.push(card);
  }
  if (section.links && section.links.length) {
    children.push(make('p', 'panel-kicker', 'Read more'), linkList(section.links));
  }
  explore.section.replaceChildren(...children);
}

function renderLinePanel() {
  if (selectedRow === null) {
    explore.line.hidden = true;
    return;
  }
  const { row, note } = exploreRows[selectedRow];
  const lineCode = make('pre', 'panel-code');
  lineCode.textContent = row.querySelector('.code-text').textContent.trim() || '(blank line)';

  const children = [
    make('p', 'panel-kicker', `Line ${row.querySelector('.ln').textContent}`),
    lineCode,
  ];
  if (note) {
    const text = make('p');
    setRichText(text, note.text);
    children.push(text);
    if (note.links && note.links.length) children.push(linkList(note.links));
  } else {
    children.push(make('p', 'note', 'No note for this line. The section summary below explains what it is part of.'));
  }
  explore.line.replaceChildren(...children);
  explore.line.hidden = false;
}


// ---------------------------------------------------------------------
// Hover, click, and keys
// ---------------------------------------------------------------------

function setHover(section) {
  if (section === hoveredSection) return;
  hoveredSection = section;
  for (const block of explore.code.children) {
    block.classList.toggle('hover', section !== null && block.dataset.section === section.id);
  }
  renderSectionPanel();
}

function selectRow(index) {
  if (selectedRow !== null) exploreRows[selectedRow].row.classList.remove('selected');
  selectedRow = index;
  exploreRows[index].row.classList.add('selected');
  renderSectionPanel();
  renderLinePanel();
}

explore.code.addEventListener('mouseover', (event) => {
  const row = event.target.closest('.code-line');
  if (row) setHover(exploreRows[row.dataset.index].section);
});

explore.code.addEventListener('mouseleave', () => setHover(null));

explore.code.addEventListener('click', (event) => {
  const row = event.target.closest('.code-line');
  if (row) selectRow(Number(row.dataset.index));
});

explore.code.addEventListener('keydown', (event) => {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  event.preventDefault();
  const step = event.key === 'ArrowDown' ? 1 : -1;
  const from = selectedRow === null ? (step === 1 ? -1 : exploreRows.length) : selectedRow;
  const next = Math.min(exploreRows.length - 1, Math.max(0, from + step));
  selectRow(next);
  exploreRows[next].row.scrollIntoView({ block: 'nearest' });
});

buildExplore();
