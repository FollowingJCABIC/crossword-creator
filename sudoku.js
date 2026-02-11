const boardEl = document.getElementById("board");
const numpadEl = document.getElementById("numpad");
const timerEl = document.getElementById("timer");
const statusDifficultyEl = document.getElementById("status-difficulty");
const statusSeedEl = document.getElementById("status-seed");
const scriptureDateEl = document.getElementById("scripture-date");
const scriptureTextEl = document.getElementById("scripture-text");
const scriptureRefEl = document.getElementById("scripture-ref");
const musicToggleEl = document.getElementById("music-toggle");
const musicVolumeEl = document.getElementById("music-volume");
const musicTempoEl = document.getElementById("music-tempo");
const playView = document.getElementById("play-view");
const learnView = document.getElementById("learn-view");
const viewButtons = {
  play: document.getElementById("view-play"),
  learn: document.getElementById("view-learn"),
};

const controls = {
  newGame: document.getElementById("new-game"),
  restart: document.getElementById("restart"),
  check: document.getElementById("check"),
  solve: document.getElementById("solve"),
  toggleNotes: document.getElementById("toggle-notes"),
  erase: document.getElementById("erase"),
  hint: document.getElementById("hint"),
  autoNotes: document.getElementById("auto-notes"),
  undo: document.getElementById("undo"),
  redo: document.getElementById("redo"),
  applySettings: document.getElementById("apply-settings"),
};

const settingsInputs = {
  difficulty: document.getElementById("difficulty"),
  size: document.getElementById("size"),
  theme: document.getElementById("theme"),
  seed: document.getElementById("seed"),
  scale: document.getElementById("scale"),
  timer: document.getElementById("toggle-timer"),
  peers: document.getElementById("toggle-peers"),
  same: document.getElementById("toggle-same"),
  autoCheck: document.getElementById("toggle-autocheck"),
};

const DEFAULT_SETTINGS = {
  difficulty: "medium",
  size: 9,
  theme: "paper",
  seed: "",
  scale: 100,
  showTimer: true,
  highlightPeers: true,
  highlightSame: true,
  autoCheck: false,
};

const DIFFICULTY_LABELS = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  expert: "Expert",
};

const CLUE_MAP = {
  9: { easy: 45, medium: 36, hard: 30, expert: 24 },
  4: { easy: 10, medium: 8, hard: 6, expert: 5 },
};

const SYMBOLS = "123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DAILY_SCRIPTURE = [
  { ref: "Psalm 23:1", theme: "Guidance and provision." },
  { ref: "Matthew 5:9", theme: "Peacemaking and calm." },
  { ref: "Isaiah 41:10", theme: "Strength over fear." },
  { ref: "Philippians 4:6-7", theme: "Prayer over anxiety." },
  { ref: "Romans 8:28", theme: "Trust in purpose." },
  { ref: "1 Corinthians 13:4", theme: "Love in action." },
  { ref: "Proverbs 3:5-6", theme: "Trust over understanding." },
];

const MUSIC_MODES = {
  ionian: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
};

const MUSIC_BASE_OPTIONS = [45, 47, 48, 50, 52, 53, 55];
const HARMONY_TEMPLATES = [
  { degrees: [0, 3, 4, 0], weight: 4 },
  { degrees: [0, 5, 1, 4, 0], weight: 3 },
  { degrees: [0, 3, 5, 4, 0], weight: 2 },
  { degrees: [0, 1, 4, 0], weight: 3 },
  { degrees: [0, 2, 5, 4, 0], weight: 2 },
  { degrees: [0, 6, 5, 4, 0], weight: 1 },
];
const musicState = {
  context: null,
  master: null,
  running: false,
  tempo: 78,
  volume: 0.35,
  scheduleAhead: 0.45,
  interval: 30,
  timer: null,
  nextTime: 0,
  beatIndex: 0,
  rng: null,
  scale: MUSIC_MODES.ionian,
  baseMidi: 48,
  harmony: {
    progression: [],
    chordBeats: 2,
  },
  phrase: {
    length: 8,
    beat: 0,
    targetDegree: 4,
  },
  cantus: {
    pitch: { degree: 0, octave: 1 },
    remaining: 0,
    lastMidi: null,
    prevMidi: null,
    moved: false,
    lastMove: 0,
    leapDirection: 0,
    wave: "triangle",
    gain: 0.18,
  },
  counter: {
    pitch: { degree: 2, octave: 1 },
    lastMidi: null,
    lastInterval: null,
    lastWasDissonant: false,
    remaining: 0,
    pattern: [1, 1, 1, 2, 1, 1, 2],
    patternIndex: 0,
    forceResolution: false,
    resolutionDirection: -1,
    range: { min: 58, max: 84 },
    wave: "sine",
    gain: 0.14,
    detune: -4,
  },
};

const state = {
  size: 9,
  base: 3,
  symbols: [],
  puzzle: [],
  solution: [],
  initialPuzzle: [],
  notes: [],
  given: new Set(),
  selected: null,
  noteMode: false,
  history: [],
  future: [],
  conflicts: new Set(),
  seed: "",
  startTime: 0,
  timerInterval: null,
  elapsedOffset: 0,
};

const cellEls = [];

function loadSettings() {
  const raw = localStorage.getItem("sudokuSettings");
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(settings) {
  localStorage.setItem("sudokuSettings", JSON.stringify(settings));
}

function applyTheme(theme) {
  document.body.className = `theme-${theme}`;
}

function applyScale(scale) {
  boardEl.style.setProperty("--board-scale", scale);
}

function seedFromString(seed) {
  let h = 1779033703;
  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeRng(seedString) {
  const seedGen = seedFromString(seedString);
  return mulberry32(seedGen());
}

function shuffle(array, rng) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function buildSymbols(size) {
  return SYMBOLS.slice(0, size).split("");
}

function getBoxIndex(row, col, base) {
  return Math.floor(row / base) * base + Math.floor(col / base);
}

function popcount(x) {
  let count = 0;
  while (x) {
    x &= x - 1;
    count += 1;
  }
  return count;
}

function buildMasks(grid, size, base) {
  const rowMask = new Array(size).fill(0);
  const colMask = new Array(size).fill(0);
  const boxMask = new Array(size).fill(0);
  for (let i = 0; i < grid.length; i += 1) {
    const value = grid[i];
    if (!value) continue;
    const row = Math.floor(i / size);
    const col = i % size;
    const box = getBoxIndex(row, col, base);
    const bit = 1 << (value - 1);
    rowMask[row] |= bit;
    colMask[col] |= bit;
    boxMask[box] |= bit;
  }
  return { rowMask, colMask, boxMask };
}

function getCandidateMask(row, col, size, base, masks, fullMask) {
  const box = getBoxIndex(row, col, base);
  return fullMask & ~(masks.rowMask[row] | masks.colMask[col] | masks.boxMask[box]);
}

function solveGrid(grid, size, base, countLimit = 1, rng = null) {
  const fullMask = (1 << size) - 1;
  const masks = buildMasks(grid, size, base);
  let count = 0;
  let solution = null;

  function backtrack() {
    if (count >= countLimit) return;

    let bestIndex = -1;
    let bestMask = 0;
    let bestCount = Infinity;

    for (let i = 0; i < grid.length; i += 1) {
      if (grid[i] !== 0) continue;
      const row = Math.floor(i / size);
      const col = i % size;
      const mask = getCandidateMask(row, col, size, base, masks, fullMask);
      const c = popcount(mask);
      if (c === 0) return;
      if (c < bestCount) {
        bestCount = c;
        bestIndex = i;
        bestMask = mask;
        if (c === 1) break;
      }
    }

    if (bestIndex === -1) {
      count += 1;
      if (!solution) solution = grid.slice();
      return;
    }

    let candidates = [];
    for (let n = 1; n <= size; n += 1) {
      if (bestMask & (1 << (n - 1))) candidates.push(n);
    }
    if (rng) shuffle(candidates, rng);

    const row = Math.floor(bestIndex / size);
    const col = bestIndex % size;
    const box = getBoxIndex(row, col, base);

    for (const value of candidates) {
      const bit = 1 << (value - 1);
      grid[bestIndex] = value;
      masks.rowMask[row] |= bit;
      masks.colMask[col] |= bit;
      masks.boxMask[box] |= bit;

      backtrack();

      grid[bestIndex] = 0;
      masks.rowMask[row] ^= bit;
      masks.colMask[col] ^= bit;
      masks.boxMask[box] ^= bit;

      if (count >= countLimit) return;
    }
  }

  backtrack();
  return { solution, count };
}

function generateSolved(size, base, rng) {
  const grid = new Array(size * size).fill(0);
  const result = solveGrid(grid, size, base, 1, rng);
  return result.solution || grid;
}

function generatePuzzle(size, base, rng, difficulty) {
  const solution = generateSolved(size, base, rng);
  const puzzle = solution.slice();
  const targetClues = CLUE_MAP[size]?.[difficulty] ?? Math.floor(size * size * 0.4);
  let filled = puzzle.filter((n) => n !== 0).length;

  const indices = Array.from({ length: size * size }, (_, i) => i);
  shuffle(indices, rng);

  for (const index of indices) {
    if (filled <= targetClues) break;
    const backup = puzzle[index];
    puzzle[index] = 0;

    const { count } = solveGrid(puzzle.slice(), size, base, 2, null);
    if (count !== 1) {
      puzzle[index] = backup;
    } else {
      filled -= 1;
    }
  }

  return { puzzle, solution };
}

function formatTime(ms) {
  const total = Math.floor(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function startTimer() {
  clearInterval(state.timerInterval);
  state.startTime = Date.now();
  if (!settings.showTimer) {
    timerEl.textContent = "--:--";
    state.timerInterval = null;
    return;
  }
  state.timerInterval = setInterval(() => {
    const elapsed = Date.now() - state.startTime + state.elapsedOffset;
    timerEl.textContent = formatTime(elapsed);
  }, 250);
}

function stopTimer() {
  clearInterval(state.timerInterval);
  state.timerInterval = null;
}

function buildBoard() {
  boardEl.innerHTML = "";
  cellEls.length = 0;
  boardEl.style.setProperty("--size", state.size);
  const noteGrid = Math.ceil(Math.sqrt(state.size));

  for (let row = 0; row < state.size; row += 1) {
    for (let col = 0; col < state.size; col += 1) {
      const index = row * state.size + col;
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cell";
      cell.dataset.index = index;
      cell.style.setProperty("--note-grid", noteGrid);

      if (col % state.base === state.base - 1 && col !== state.size - 1) {
        cell.classList.add("block-right");
      }
      if (row % state.base === state.base - 1 && row !== state.size - 1) {
        cell.classList.add("block-bottom");
      }

      const valueSpan = document.createElement("span");
      valueSpan.className = "value";
      cell.appendChild(valueSpan);

      const notes = document.createElement("div");
      notes.className = "notes";
      const noteSlots = noteGrid * noteGrid;
      for (let i = 0; i < noteSlots; i += 1) {
        const note = document.createElement("span");
        notes.appendChild(note);
      }
      cell.appendChild(notes);

      cell.addEventListener("click", () => selectCell(index));
      boardEl.appendChild(cell);
      cellEls.push(cell);
    }
  }
}

function buildNumpad() {
  numpadEl.innerHTML = "";
  for (let n = 1; n <= state.size; n += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn";
    button.textContent = state.symbols[n - 1];
    button.addEventListener("click", () => handleInput(n));
    numpadEl.appendChild(button);
  }
}

function selectCell(index) {
  state.selected = index;
  render();
}

function recordChange(index, nextValue, nextNotes) {
  const prevValue = state.puzzle[index];
  const prevNotes = state.notes[index];
  state.history.push({ index, prevValue, nextValue, prevNotes, nextNotes });
  state.future = [];
}

function applyChange(change, direction) {
  state.puzzle[change.index] = direction === "undo" ? change.prevValue : change.nextValue;
  state.notes[change.index] = direction === "undo" ? change.prevNotes : change.nextNotes;
}

function undo() {
  const change = state.history.pop();
  if (!change) return;
  applyChange(change, "undo");
  state.future.push(change);
  render();
}

function redo() {
  const change = state.future.pop();
  if (!change) return;
  applyChange(change, "redo");
  state.history.push(change);
  render();
}

function handleInput(value) {
  if (state.selected === null) return;
  if (state.given.has(state.selected)) return;

  if (state.noteMode) {
    const mask = 1 << (value - 1);
    const nextNotes = state.notes[state.selected] ^ mask;
    recordChange(state.selected, state.puzzle[state.selected], nextNotes);
    state.notes[state.selected] = nextNotes;
  } else {
    recordChange(state.selected, value, 0);
    state.puzzle[state.selected] = value;
    state.notes[state.selected] = 0;
  }

  render();
  checkSolved();
}

function erase() {
  if (state.selected === null) return;
  if (state.given.has(state.selected)) return;
  recordChange(state.selected, 0, 0);
  state.puzzle[state.selected] = 0;
  state.notes[state.selected] = 0;
  render();
}

function candidateMaskForIndex(index) {
  if (state.puzzle[index]) return 0;
  const size = state.size;
  const base = state.base;
  const row = Math.floor(index / size);
  const col = index % size;
  const fullMask = (1 << size) - 1;
  const masks = buildMasks(state.puzzle, size, base);
  return getCandidateMask(row, col, size, base, masks, fullMask);
}

function autoNotes() {
  if (state.selected === null) return;
  if (state.given.has(state.selected)) return;
  if (state.puzzle[state.selected]) return;
  const mask = candidateMaskForIndex(state.selected);
  recordChange(state.selected, state.puzzle[state.selected], mask);
  state.notes[state.selected] = mask;
  render();
}

function hint() {
  const emptyIndices = state.puzzle
    .map((value, index) => (value === 0 ? index : null))
    .filter((value) => value !== null);
  if (emptyIndices.length === 0) return;
  const index = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
  recordChange(index, state.solution[index], 0);
  state.puzzle[index] = state.solution[index];
  state.notes[index] = 0;
  render();
  checkSolved();
}

function restart() {
  state.puzzle = state.initialPuzzle.slice();
  state.notes = new Array(state.size * state.size).fill(0);
  state.history = [];
  state.future = [];
  state.selected = null;
  state.noteMode = false;
  state.given = new Set(
    state.puzzle.map((value, index) => (value ? index : null)).filter((v) => v !== null)
  );
  state.elapsedOffset = 0;
  startTimer();
  render();
}

function reveal() {
  state.puzzle = state.solution.slice();
  render();
  stopTimer();
}

function checkSolved() {
  for (let i = 0; i < state.puzzle.length; i += 1) {
    if (state.puzzle[i] !== state.solution[i]) return;
  }
  stopTimer();
  setTimeout(() => {
    alert("Solved! Great work.");
  }, 50);
}

function computeConflicts() {
  const conflicts = new Set();
  const size = state.size;

  function markDuplicates(indices) {
    const seen = new Map();
    for (const index of indices) {
      const value = state.puzzle[index];
      if (!value) continue;
      if (seen.has(value)) {
        conflicts.add(index);
        conflicts.add(seen.get(value));
      } else {
        seen.set(value, index);
      }
    }
  }

  for (let r = 0; r < size; r += 1) {
    const rowIndices = [];
    for (let c = 0; c < size; c += 1) rowIndices.push(r * size + c);
    markDuplicates(rowIndices);
  }

  for (let c = 0; c < size; c += 1) {
    const colIndices = [];
    for (let r = 0; r < size; r += 1) colIndices.push(r * size + c);
    markDuplicates(colIndices);
  }

  for (let br = 0; br < state.base; br += 1) {
    for (let bc = 0; bc < state.base; bc += 1) {
      const block = [];
      for (let r = 0; r < state.base; r += 1) {
        for (let c = 0; c < state.base; c += 1) {
          const row = br * state.base + r;
          const col = bc * state.base + c;
          block.push(row * size + col);
        }
      }
      markDuplicates(block);
    }
  }

  return conflicts;
}

function render() {
  state.conflicts = computeConflicts();

  const selectedValue =
    state.selected !== null ? state.puzzle[state.selected] : null;

  for (let i = 0; i < cellEls.length; i += 1) {
    const cell = cellEls[i];
    const value = state.puzzle[i];
    const notesMask = state.notes[i];
    const valueSpan = cell.querySelector(".value");
    const notesEl = cell.querySelector(".notes");
    const noteSlots = notesEl.children;

    cell.classList.toggle("given", state.given.has(i));
    cell.classList.toggle("selected", i === state.selected);

    if (settings.highlightPeers && state.selected !== null) {
      const row = Math.floor(i / state.size);
      const col = i % state.size;
      const selRow = Math.floor(state.selected / state.size);
      const selCol = state.selected % state.size;
      const selBox = getBoxIndex(selRow, selCol, state.base);
      const box = getBoxIndex(row, col, state.base);
      cell.classList.toggle("peer", row === selRow || col === selCol || box === selBox);
    } else {
      cell.classList.remove("peer");
    }

    if (settings.highlightSame && selectedValue && value === selectedValue) {
      cell.classList.add("same");
    } else {
      cell.classList.remove("same");
    }

    if (settings.autoCheck && value && value !== state.solution[i]) {
      cell.classList.add("wrong");
    } else {
      cell.classList.remove("wrong");
    }

    if (state.conflicts.has(i)) {
      cell.classList.add("conflict");
    } else {
      cell.classList.remove("conflict");
    }

    if (value) {
      valueSpan.textContent = state.symbols[value - 1];
      notesEl.style.display = "none";
    } else {
      valueSpan.textContent = "";
      notesEl.style.display = "grid";
      for (let n = 1; n <= noteSlots.length; n += 1) {
        const span = noteSlots[n - 1];
        if (n <= state.size && notesMask & (1 << (n - 1))) {
          span.textContent = state.symbols[n - 1];
        } else {
          span.textContent = "";
        }
      }
    }
  }

  controls.toggleNotes.classList.toggle("active", state.noteMode);
}

function handleKeydown(event) {
  const key = event.key.toLowerCase();
  if (key === "n") {
    toggleNotes();
    return;
  }
  if (key === "h") {
    hint();
    return;
  }
  if (key === "a") {
    autoNotes();
    return;
  }
  if (key === "backspace" || key === "delete" || key === "0") {
    erase();
    return;
  }

  if (key === "arrowup" || key === "arrowdown" || key === "arrowleft" || key === "arrowright") {
    moveSelection(key);
    return;
  }

  const num = parseInt(key, 10);
  if (!Number.isNaN(num) && num >= 1 && num <= state.size) {
    handleInput(num);
  }
}

function moveSelection(key) {
  if (state.selected === null) {
    selectCell(0);
    return;
  }
  const row = Math.floor(state.selected / state.size);
  const col = state.selected % state.size;
  let nextRow = row;
  let nextCol = col;

  if (key === "arrowup") nextRow = (row - 1 + state.size) % state.size;
  if (key === "arrowdown") nextRow = (row + 1) % state.size;
  if (key === "arrowleft") nextCol = (col - 1 + state.size) % state.size;
  if (key === "arrowright") nextCol = (col + 1) % state.size;

  selectCell(nextRow * state.size + nextCol);
}

function toggleNotes() {
  state.noteMode = !state.noteMode;
  render();
}

function checkBoard() {
  const conflicts = computeConflicts();
  if (conflicts.size === 0) {
    alert("No conflicts found.");
  } else {
    alert(`Conflicts found in ${conflicts.size} cells.`);
  }
}

function createGame() {
  state.size = settings.size;
  state.base = Math.sqrt(state.size);
  state.symbols = buildSymbols(state.size);

  const seed = settings.seed.trim() || `auto-${Date.now()}`;
  state.seed = seed;
  const rng = makeRng(seed);

  const { puzzle, solution } = generatePuzzle(state.size, state.base, rng, settings.difficulty);
  state.puzzle = puzzle.slice();
  state.solution = solution.slice();
  state.initialPuzzle = puzzle.slice();
  state.notes = new Array(state.size * state.size).fill(0);
  state.history = [];
  state.future = [];
  state.selected = null;
  state.noteMode = false;
  state.given = new Set(
    puzzle.map((value, index) => (value ? index : null)).filter((value) => value !== null)
  );

  statusDifficultyEl.textContent = DIFFICULTY_LABELS[settings.difficulty];
  statusSeedEl.textContent = seed;
  timerEl.textContent = "00:00";
  state.elapsedOffset = 0;
  startTimer();

  buildBoard();
  buildNumpad();
  render();
}

function syncSettingsToInputs() {
  settingsInputs.difficulty.value = settings.difficulty;
  settingsInputs.size.value = String(settings.size);
  settingsInputs.theme.value = settings.theme;
  settingsInputs.seed.value = settings.seed;
  settingsInputs.scale.value = settings.scale;
  settingsInputs.timer.checked = settings.showTimer;
  settingsInputs.peers.checked = settings.highlightPeers;
  settingsInputs.same.checked = settings.highlightSame;
  settingsInputs.autoCheck.checked = settings.autoCheck;
}

function updateSettingsFromInputs() {
  settings = {
    difficulty: settingsInputs.difficulty.value,
    size: parseInt(settingsInputs.size.value, 10),
    theme: settingsInputs.theme.value,
    seed: settingsInputs.seed.value,
    scale: parseInt(settingsInputs.scale.value, 10),
    showTimer: settingsInputs.timer.checked,
    highlightPeers: settingsInputs.peers.checked,
    highlightSame: settingsInputs.same.checked,
    autoCheck: settingsInputs.autoCheck.checked,
  };
  saveSettings(settings);
}

let settings = loadSettings();

function applySettings() {
  updateSettingsFromInputs();
  applyTheme(settings.theme);
  applyScale(settings.scale);
  createGame();
}

function initMusic() {
  if (!musicState.context) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    musicState.context = new AudioCtx();
    musicState.master = musicState.context.createGain();
    musicState.master.gain.value = musicState.volume;
    musicState.master.connect(musicState.context.destination);
  }
}

function midiToFrequency(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function pitchToMidi(pitch) {
  return musicState.baseMidi + musicState.scale[pitch.degree] + 12 * pitch.octave;
}

function movePitch(pitch, degreeSteps) {
  let degree = pitch.degree + degreeSteps;
  let octave = pitch.octave;
  const total = musicState.scale.length;
  while (degree < 0) {
    degree += total;
    octave -= 1;
  }
  while (degree >= total) {
    degree -= total;
    octave += 1;
  }
  return { degree, octave };
}

function weightedPick(options) {
  const total = options.reduce((sum, option) => sum + option.weight, 0);
  let pick = musicRand() * total;
  for (const option of options) {
    pick -= option.weight;
    if (pick <= 0) return option;
  }
  return options[options.length - 1];
}

function musicRand() {
  return musicState.rng ? musicState.rng() : Math.random();
}

function randomChoice(list) {
  return list[Math.floor(musicRand() * list.length)];
}

function chordTones(rootDegree) {
  const size = musicState.scale.length;
  return [rootDegree % size, (rootDegree + 2) % size, (rootDegree + 4) % size];
}

function isChordTone(degree, chordDegree) {
  return chordTones(chordDegree).includes(degree);
}

function buildProgression(lengthChords) {
  if (lengthChords <= 0) return [0];
  const template = weightedPick(HARMONY_TEMPLATES).degrees;
  let progression = [];
  while (progression.length < lengthChords) {
    progression = progression.concat(template);
  }
  progression = progression.slice(0, lengthChords);
  if (lengthChords >= 2) {
    progression[lengthChords - 2] = 4;
    progression[lengthChords - 1] = 0;
  }
  const size = musicState.scale.length;
  return progression.map((degree) => ((degree % size) + size) % size);
}

function nearestMidiForDegree(currentMidi, degree) {
  const base = musicState.baseMidi + musicState.scale[degree];
  const octave = Math.round((currentMidi - base) / 12);
  return base + 12 * octave;
}

function chooseCantusPitch(chordDegree, beatStrong) {
  const range = { min: 48, max: 74 };
  const steps = [-3, -2, -1, 0, 1, 2, 3];
  const phrase = musicState.phrase;
  const cadence = phrase.beat >= phrase.length - 2;
  const currentPitch = musicState.cantus.pitch;
  const currentMidi = pitchToMidi(currentPitch);
  const chordSet = chordTones(chordDegree);

  let targetDegree = chordDegree;
  if (!cadence) {
    const inFirstHalf = phrase.beat < phrase.length / 2;
    targetDegree = inFirstHalf ? phrase.targetDegree : chordDegree;
  } else {
    targetDegree = 0;
  }

  const targetMidi = nearestMidiForDegree(currentMidi, targetDegree);
  let allowedSteps = steps;
  if (musicState.cantus.leapDirection !== 0) {
    allowedSteps = steps.filter(
      (step) => Math.abs(step) === 1 && Math.sign(step) === -musicState.cantus.leapDirection
    );
    if (allowedSteps.length === 0) allowedSteps = steps;
  }

  const candidates = allowedSteps
    .map((step) => {
      const pitch = movePitch(currentPitch, step);
      const midi = pitchToMidi(pitch);
      if (midi < range.min || midi > range.max) return null;
      let weight = 2;
      const size = Math.abs(step);
      if (size === 0) weight = 2.4;
      if (size === 1) weight = 6.4;
      if (size === 2) weight = 4.1;
      if (size >= 3) weight = 2.1;
      if (step === musicState.cantus.lastMove) weight *= 0.6;
      const direction = Math.sign(targetMidi - currentMidi);
      if (direction !== 0 && Math.sign(step) === direction) weight *= 1.6;
      if (cadence && pitch.degree === 0) weight *= 2.2;
      if (cadence && size > 2) weight *= 0.5;
      if (chordSet.includes(pitch.degree)) {
        weight *= beatStrong ? 1.7 : 1.2;
      } else {
        weight *= beatStrong ? 0.25 : 0.6;
      }
      return { value: pitch, weight, step };
    })
    .filter(Boolean);

  const choice = weightedPick(candidates);
  const next = choice.value;
  const nextMidi = pitchToMidi(next);
  if (musicState.cantus.lastMidi !== null) {
    musicState.cantus.lastMove = Math.sign(nextMidi - musicState.cantus.lastMidi);
  }
  musicState.cantus.leapDirection = Math.abs(choice.step) >= 2 ? Math.sign(choice.step) : 0;
  return next;
}

function isPerfectInterval(interval) {
  const mod = Math.abs(interval) % 12;
  return mod === 0 || mod === 7;
}

function isConsonant(interval) {
  const mod = Math.abs(interval) % 12;
  return mod === 0 || mod === 3 || mod === 4 || mod === 7 || mod === 8 || mod === 9;
}

function chooseCounterPitch(cantusPitch, beatStrong, chordDegree) {
  const cantusMidi = pitchToMidi(cantusPitch);
  const range = musicState.counter.range;
  const consonantDegrees = [2, 4, 5, 7, 9, 11];
  const chordSet = chordTones(chordDegree);
  const options = [];

  for (const degreeSteps of consonantDegrees) {
    const pitch = movePitch(cantusPitch, degreeSteps);
    const midi = pitchToMidi(pitch);
    if (midi < range.min || midi > range.max) continue;
    if (midi <= cantusMidi + 2) continue;
    const interval = midi - cantusMidi;
    const chordTone = chordSet.includes(pitch.degree);
    if (beatStrong && !chordTone) continue;
    if (!beatStrong || isConsonant(interval)) {
      let weight = 2.5;
      const mod = Math.abs(interval) % 12;
      if (mod === 3 || mod === 4 || mod === 8 || mod === 9) weight = 6.5;
      if (mod === 7) weight = 3.4;
      if (chordTone) {
        weight *= 1.5;
      } else {
        weight *= 0.5;
      }
      options.push({ value: pitch, weight, interval, dissonant: false });
    }
  }

  const prevCantus = musicState.cantus.moved
    ? musicState.cantus.prevMidi ?? musicState.cantus.lastMidi
    : musicState.cantus.lastMidi;
  const prevCounter = musicState.counter.lastMidi;
  const prevInterval = musicState.counter.lastInterval;

  const filtered = options.filter((option) => {
    if (prevCantus === null || prevCounter === null || prevInterval === null) return true;
    const cantusDir = Math.sign(cantusMidi - prevCantus);
    const counterDir = Math.sign(pitchToMidi(option.value) - prevCounter);
    if (cantusDir === 0 || counterDir === 0) return true;
    if (isPerfectInterval(prevInterval) && isPerfectInterval(option.interval)) {
      if (Math.abs(prevInterval) % 12 === Math.abs(option.interval) % 12 && cantusDir === counterDir) {
        return false;
      }
    }
    return true;
  });

  const choices = filtered.length ? filtered : options;
  if (!choices.length) return null;
  let best = choices[0];
  if (musicState.counter.lastMidi !== null) {
    best = weightedPick(
      choices.map((choice) => {
        const midi = pitchToMidi(choice.value);
        const leap = Math.abs(midi - musicState.counter.lastMidi);
        let weight = choice.weight;
        if (leap <= 2) weight *= 1.8;
        else if (leap <= 5) weight *= 1.2;
        else weight *= 0.6;
        if (prevCantus !== null && prevCounter !== null) {
          const cantusDir = Math.sign(cantusMidi - prevCantus);
          const counterDir = Math.sign(midi - prevCounter);
          if (cantusDir !== 0 && counterDir !== 0) {
            weight *= cantusDir === counterDir ? 0.8 : 1.4;
          }
        }
        return { ...choice, weight };
      })
    );
  } else {
    best = weightedPick(choices);
  }

  return best;
}

function resolveCounterPitch(cantusPitch, chordDegree, beatStrong) {
  const direction = musicState.counter.resolutionDirection || -1;
  const pitch = movePitch(musicState.counter.pitch, direction);
  const midi = pitchToMidi(pitch);
  const cantusMidi = pitchToMidi(cantusPitch);
  if (midi < musicState.counter.range.min || midi > musicState.counter.range.max) return null;
  if (midi <= cantusMidi + 2) return null;
  const interval = midi - cantusMidi;
  if (!isConsonant(interval)) return null;
  if (beatStrong && !isChordTone(pitch.degree, chordDegree)) return null;
  return { value: pitch, interval, dissonant: false, resolved: true };
}

function tryPassingTone(cantusPitch) {
  if (musicState.counter.lastMidi === null) return null;
  if (musicState.counter.lastWasDissonant) return null;
  const direction = musicRand() < 0.5 ? -1 : 1;
  const pitch = movePitch(musicState.counter.pitch, direction);
  const midi = pitchToMidi(pitch);
  const cantusMidi = pitchToMidi(cantusPitch);
  if (midi < musicState.counter.range.min || midi > musicState.counter.range.max) return null;
  if (midi <= cantusMidi + 2) return null;
  const interval = midi - cantusMidi;
  if (isConsonant(interval)) return null;
  return {
    value: pitch,
    interval,
    dissonant: true,
    forceResolution: true,
    resolutionDirection: direction,
  };
}

function playTone(frequency, time, duration, voice) {
  const osc = musicState.context.createOscillator();
  const gain = musicState.context.createGain();
  osc.type = voice.wave;
  osc.frequency.setValueAtTime(frequency, time);
  if (voice.detune) osc.detune.setValueAtTime(voice.detune, time);

  const attack = Math.min(0.03, duration * 0.2);
  const release = Math.min(0.25, duration * 0.45);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(voice.gain, time + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration - release);

  osc.connect(gain);
  gain.connect(musicState.master);
  osc.start(time);
  osc.stop(time + duration);
}

function scheduleMusic() {
  if (!musicState.running) return;
  const now = musicState.context.currentTime;
  const beat = 60 / musicState.tempo;

  while (musicState.nextTime < now + musicState.scheduleAhead) {
    const beatStrong = musicState.beatIndex % 4 === 0 || musicState.beatIndex % 4 === 2;
    musicState.cantus.moved = false;

    if (musicState.phrase.beat === 0) {
      musicState.phrase.length = musicRand() < 0.5 ? 8 : 12;
      musicState.phrase.targetDegree = musicRand() < 0.5 ? 4 : 5;
      const chordCount = Math.ceil(musicState.phrase.length / musicState.harmony.chordBeats);
      musicState.harmony.progression = buildProgression(chordCount);
    }

    const chordIndex = Math.floor(musicState.phrase.beat / musicState.harmony.chordBeats);
    const progression = musicState.harmony.progression;
    const chordDegree = progression.length
      ? progression[chordIndex % progression.length]
      : 0;

    if (musicState.cantus.remaining <= 0) {
      const inCadence = musicState.phrase.beat >= musicState.phrase.length - 2;
      const cantusDuration = inCadence ? 2 : musicRand() < 0.25 ? 1 : 2;
      const nextCantus = chooseCantusPitch(chordDegree, beatStrong);
      musicState.cantus.pitch = nextCantus;
      musicState.cantus.remaining = cantusDuration;

      const cantusMidi = pitchToMidi(nextCantus);
      playTone(
        midiToFrequency(cantusMidi),
        musicState.nextTime,
        beat * cantusDuration * 0.95,
        musicState.cantus
      );
      musicState.cantus.prevMidi = musicState.cantus.lastMidi;
      musicState.cantus.lastMidi = cantusMidi;
      musicState.cantus.moved = true;
    }

    const cantusPitch = musicState.cantus.pitch;
    const cantusMidi = pitchToMidi(cantusPitch);
    const counter = musicState.counter;

    if (counter.remaining > 0) {
      counter.remaining -= 1;
    } else {
      let durationBeats = counter.pattern[counter.patternIndex];
      counter.patternIndex = (counter.patternIndex + 1) % counter.pattern.length;
      let choice = null;

      if (counter.forceResolution) {
        choice = resolveCounterPitch(cantusPitch, chordDegree, beatStrong);
        counter.forceResolution = false;
      }

      if (!choice && !beatStrong && musicRand() < 0.28) {
        const passing = tryPassingTone(cantusPitch);
        if (passing) {
          choice = passing;
          if (passing.forceResolution) {
            counter.forceResolution = true;
            counter.resolutionDirection = passing.resolutionDirection;
          }
        }
      }

      if (!choice) {
        choice = chooseCounterPitch(cantusPitch, beatStrong, chordDegree);
      }

      if (!choice && counter.lastMidi !== null) {
        const interval = counter.lastMidi - cantusMidi;
        if (isConsonant(interval)) {
          choice = { value: counter.pitch, interval, dissonant: false };
        }
      }

      if (choice) {
        if (choice.dissonant) durationBeats = 1;
        const counterPitch = choice.value;
        const counterMidi = pitchToMidi(counterPitch);
        playTone(midiToFrequency(counterMidi), musicState.nextTime, beat * durationBeats * 0.9, counter);

        counter.pitch = counterPitch;
        counter.lastInterval = choice.interval ?? counterMidi - cantusMidi;
        counter.lastWasDissonant = choice.dissonant;
        counter.lastMidi = counterMidi;
        counter.remaining = durationBeats - 1;
      }
    }

    musicState.nextTime += beat;
    musicState.beatIndex += 1;
    musicState.cantus.remaining -= 1;
    musicState.phrase.beat += 1;
    if (musicState.phrase.beat >= musicState.phrase.length) {
      musicState.phrase.beat = 0;
    }
  }
}

function startMusic() {
  initMusic();
  const seed = (() => {
    if (window.crypto && window.crypto.getRandomValues) {
      const buffer = new Uint32Array(1);
      window.crypto.getRandomValues(buffer);
      return `music-${buffer[0]}`;
    }
    return `music-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  })();

  musicState.rng = makeRng(seed);
  musicState.scale = randomChoice(Object.values(MUSIC_MODES));
  musicState.baseMidi = randomChoice(MUSIC_BASE_OPTIONS);

  const startDegree = randomChoice([0, 2, 4, 5]);
  musicState.cantus.pitch = { degree: startDegree, octave: 1 };
  musicState.counter.range = {
    min: musicState.baseMidi + 12,
    max: musicState.baseMidi + 38,
  };

  const counterOptions = [2, 4, 5, 7];
  let counterPitch = null;
  for (let i = 0; i < counterOptions.length * 2; i += 1) {
    const step = randomChoice(counterOptions);
    const candidate = movePitch(musicState.cantus.pitch, step);
    const midi = pitchToMidi(candidate);
    if (midi >= musicState.counter.range.min && midi <= musicState.counter.range.max) {
      counterPitch = candidate;
      break;
    }
  }
  musicState.counter.pitch = counterPitch || movePitch(musicState.cantus.pitch, 4);
  musicState.counter.pattern = randomChoice([
    [1, 1, 1, 2, 1, 1, 2],
    [1, 2, 1, 1, 2, 1],
    [2, 1, 1, 2, 1, 1],
    [1, 1, 2, 1, 1, 1, 2],
  ]);

  musicState.context.resume();
  if (musicState.running) return;
  const now = musicState.context.currentTime + 0.05;
  musicState.nextTime = now;
  musicState.beatIndex = 0;
  musicState.phrase.beat = 0;
  musicState.phrase.targetDegree = musicRand() < 0.5 ? 4 : 5;
  musicState.cantus.remaining = 0;
  musicState.cantus.lastMidi = null;
  musicState.cantus.prevMidi = null;
  musicState.cantus.leapDirection = 0;
  musicState.counter.lastMidi = null;
  musicState.counter.lastInterval = null;
  musicState.counter.lastWasDissonant = false;
  musicState.counter.remaining = 0;
  musicState.counter.patternIndex = Math.floor(musicRand() * musicState.counter.pattern.length);
  musicState.counter.forceResolution = false;
  musicState.running = true;
  musicState.timer = setInterval(scheduleMusic, musicState.interval);
  if (musicToggleEl) {
    musicToggleEl.textContent = "Stop Music";
    musicToggleEl.classList.add("active");
  }
}

function stopMusic() {
  if (!musicState.running) return;
  clearInterval(musicState.timer);
  musicState.timer = null;
  musicState.running = false;
  if (musicToggleEl) {
    musicToggleEl.textContent = "Start Music";
    musicToggleEl.classList.remove("active");
  }
}

function setupMusicControls() {
  if (!musicToggleEl || !musicVolumeEl || !musicTempoEl) return;
  musicVolumeEl.value = String(Math.round(musicState.volume * 100));
  musicTempoEl.value = String(musicState.tempo);

  musicToggleEl.addEventListener("click", () => {
    if (musicState.running) {
      stopMusic();
    } else {
      startMusic();
    }
  });

  musicVolumeEl.addEventListener("input", () => {
    musicState.volume = parseInt(musicVolumeEl.value, 10) / 100;
    if (musicState.master) musicState.master.gain.value = musicState.volume;
  });

  musicTempoEl.addEventListener("input", () => {
    musicState.tempo = parseInt(musicTempoEl.value, 10);
  });
}

function dayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  return Math.floor(diff / 86400000);
}

function setDailyScripture() {
  if (!scriptureDateEl || !scriptureTextEl || !scriptureRefEl) return;
  const today = new Date();
  const index = dayOfYear(today) % DAILY_SCRIPTURE.length;
  const entry = DAILY_SCRIPTURE[index];
  const formatter = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  scriptureDateEl.textContent = formatter.format(today);
  scriptureTextEl.textContent = `Theme: ${entry.theme}`;
  scriptureRefEl.textContent = entry.ref;
}

function setView(view) {
  const isLearn = view === "learn";
  playView.classList.toggle("hidden", isLearn);
  learnView.classList.toggle("hidden", !isLearn);
  viewButtons.play.classList.toggle("active", !isLearn);
  viewButtons.learn.classList.toggle("active", isLearn);
  viewButtons.play.setAttribute("aria-selected", String(!isLearn));
  viewButtons.learn.setAttribute("aria-selected", String(isLearn));
}

controls.newGame.addEventListener("click", () => createGame());
controls.restart.addEventListener("click", () => restart());
controls.check.addEventListener("click", () => checkBoard());
controls.solve.addEventListener("click", () => reveal());
controls.toggleNotes.addEventListener("click", () => toggleNotes());
controls.erase.addEventListener("click", () => erase());
controls.hint.addEventListener("click", () => hint());
controls.autoNotes.addEventListener("click", () => autoNotes());
controls.undo.addEventListener("click", () => undo());
controls.redo.addEventListener("click", () => redo());
controls.applySettings.addEventListener("click", () => applySettings());
viewButtons.play.addEventListener("click", () => setView("play"));
viewButtons.learn.addEventListener("click", () => setView("learn"));
settingsInputs.theme.addEventListener("change", () => {
  settings.theme = settingsInputs.theme.value;
  applyTheme(settings.theme);
  saveSettings(settings);
});
settingsInputs.scale.addEventListener("input", () => {
  settings.scale = parseInt(settingsInputs.scale.value, 10);
  applyScale(settings.scale);
});

window.addEventListener("keydown", handleKeydown);

syncSettingsToInputs();
applyTheme(settings.theme);
applyScale(settings.scale);
setView("play");
setDailyScripture();
setupMusicControls();
createGame();
