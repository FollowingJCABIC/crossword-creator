const EMPTY = "";

const wordLength = (word) => Array.from(word).length;

const estimateSize = (words) => {
  if (!words.length) return 0;
  const maxLen = Math.max(...words.map(wordLength));
  const total = words.reduce((sum, word) => sum + wordLength(word), 0);
  const size = Math.max(maxLen + 2, Math.floor(Math.sqrt(total) * 1.6));
  return Math.max(size, maxLen);
};

const createGrid = (size) =>
  Array.from({ length: size }, () => Array.from({ length: size }, () => EMPTY));

const gridHasAny = (grid) => grid.some((row) => row.some((cell) => cell !== EMPTY));

const tryPlacement = (grid, wordChars, row, col, direction) => {
  const size = grid.length;
  const length = wordChars.length;
  const filled = [];
  let intersections = 0;

  if (direction === "H") {
    if (row < 0 || row >= size || col < 0 || col + length > size) return null;
    if (col > 0 && grid[row][col - 1] !== EMPTY) return null;
    if (col + length < size && grid[row][col + length] !== EMPTY) return null;
    for (let i = 0; i < length; i += 1) {
      const r = row;
      const c = col + i;
      const cell = grid[r][c];
      const ch = wordChars[i];
      if (cell !== EMPTY && cell !== ch) return null;
      if (cell === EMPTY) {
        if (r > 0 && grid[r - 1][c] !== EMPTY) return null;
        if (r < size - 1 && grid[r + 1][c] !== EMPTY) return null;
        filled.push([r, c]);
      } else {
        intersections += 1;
      }
    }
    return { filled, intersections };
  }

  if (direction === "V") {
    if (col < 0 || col >= size || row < 0 || row + length > size) return null;
    if (row > 0 && grid[row - 1][col] !== EMPTY) return null;
    if (row + length < size && grid[row + length][col] !== EMPTY) return null;
    for (let i = 0; i < length; i += 1) {
      const r = row + i;
      const c = col;
      const cell = grid[r][c];
      const ch = wordChars[i];
      if (cell !== EMPTY && cell !== ch) return null;
      if (cell === EMPTY) {
        if (c > 0 && grid[r][c - 1] !== EMPTY) return null;
        if (c < size - 1 && grid[r][c + 1] !== EMPTY) return null;
        filled.push([r, c]);
      } else {
        intersections += 1;
      }
    }
    return { filled, intersections };
  }

  return null;
};

const scorePlacement = (wordChars, placement, intersections, size) => {
  const center = Math.floor(size / 2);
  if (placement.direction === "H") {
    const wordCenter = placement.col + Math.floor(wordChars.length / 2);
    const distance = Math.abs(center - wordCenter) + Math.abs(center - placement.row);
    return intersections * 10 - distance;
  }
  const wordCenter = placement.row + Math.floor(wordChars.length / 2);
  const distance = Math.abs(center - wordCenter) + Math.abs(center - placement.col);
  return intersections * 10 - distance;
};

const findPlacements = (grid, word, allowDisconnected) => {
  const size = grid.length;
  const wordChars = Array.from(word);
  const options = [];

  if (!gridHasAny(grid)) {
    const center = Math.floor(size / 2);
    ["H", "V"].forEach((direction) => {
      let row = center;
      let col = center;
      if (direction === "H") {
        col = Math.max(0, center - Math.floor(wordChars.length / 2));
      } else {
        row = Math.max(0, center - Math.floor(wordChars.length / 2));
      }
      const info = tryPlacement(grid, wordChars, row, col, direction);
      if (info) {
        const placement = { word, row, col, direction };
        const score = scorePlacement(wordChars, placement, info.intersections, size);
        options.push({ placement, filled: info.filled, score });
      }
    });
    return options.sort((a, b) => b.score - a.score);
  }

  ["H", "V"].forEach((direction) => {
    for (let r = 0; r < size; r += 1) {
      for (let c = 0; c < size; c += 1) {
        const cell = grid[r][c];
        if (cell === EMPTY) continue;
        for (let i = 0; i < wordChars.length; i += 1) {
          if (wordChars[i] !== cell) continue;
          const row = direction === "H" ? r : r - i;
          const col = direction === "H" ? c - i : c;
          const info = tryPlacement(grid, wordChars, row, col, direction);
          if (info) {
            const placement = { word, row, col, direction };
            const score = scorePlacement(wordChars, placement, info.intersections, size);
            options.push({ placement, filled: info.filled, score });
          }
        }
      }
    }
  });

  if (!options.length && allowDisconnected) {
    ["H", "V"].forEach((direction) => {
      for (let r = 0; r < size; r += 1) {
        for (let c = 0; c < size; c += 1) {
          const info = tryPlacement(grid, wordChars, r, c, direction);
          if (info) {
            const placement = { word, row: r, col: c, direction };
            const score = scorePlacement(wordChars, placement, info.intersections, size);
            options.push({ placement, filled: info.filled, score });
          }
        }
      }
    });
  }

  return options.sort((a, b) => b.score - a.score);
};

const placeWord = (grid, placement) => {
  const wordChars = Array.from(placement.word);
  const filled = [];
  if (placement.direction === "H") {
    for (let i = 0; i < wordChars.length; i += 1) {
      const r = placement.row;
      const c = placement.col + i;
      if (grid[r][c] === EMPTY) {
        grid[r][c] = wordChars[i];
        filled.push([r, c]);
      }
    }
  } else {
    for (let i = 0; i < wordChars.length; i += 1) {
      const r = placement.row + i;
      const c = placement.col;
      if (grid[r][c] === EMPTY) {
        grid[r][c] = wordChars[i];
        filled.push([r, c]);
      }
    }
  }
  return filled;
};

const undo = (grid, filled) => {
  filled.forEach(([r, c]) => {
    grid[r][c] = EMPTY;
  });
};

const backtrack = (grid, placements, words, allowDisconnected) => {
  if (!words.length) return true;
  const [word, ...rest] = words;
  const options = findPlacements(grid, word, allowDisconnected);
  for (const option of options) {
    const filled = placeWord(grid, option.placement);
    placements.push(option.placement);
    if (backtrack(grid, placements, rest, allowDisconnected)) return true;
    placements.pop();
    undo(grid, filled);
  }
  return false;
};

export const generateCrossword = (
  words,
  { size = null, allowDisconnected = false, maxSizeIncrease = 6 } = {}
) => {
  if (!words.length) return null;
  const sorted = [...words].sort((a, b) => wordLength(b) - wordLength(a));
  const baseSize = size || estimateSize(sorted);

  for (let delta = 0; delta <= maxSizeIncrease; delta += 1) {
    const gridSize = baseSize + delta;
    const grid = createGrid(gridSize);
    const placements = [];
    if (backtrack(grid, placements, sorted, allowDisconnected)) {
      return { grid, placements };
    }
  }

  return null;
};

export const renderGrid = (grid, empty = ".") =>
  grid.map((row) => row.map((cell) => (cell === EMPTY ? empty : cell)).join(" ")).join("\n");
