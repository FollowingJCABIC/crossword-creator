import { useEffect, useMemo, useRef, useState } from "react";
import { generateCrossword, renderGrid } from "./generator";
import { PRELOADED_LISTS, PRELOADED_TRANSLATIONS, listNames } from "./preloaded";
import "./styles.css";

const dedupeWords = (words) => {
  const seen = new Set();
  const result = [];
  for (const word of words) {
    if (seen.has(word)) continue;
    seen.add(word);
    result.push(word);
  }
  return result;
};

const parseWords = (input) => {
  const trimmed = input.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map(String).map((word) => word.trim()).filter(Boolean);
      }
      if (parsed && Array.isArray(parsed.words)) {
        return parsed.words.map(String).map((word) => word.trim()).filter(Boolean);
      }
    } catch (error) {
      // Fall through to line parsing.
    }
  }
  return trimmed
    .split(/[,\n]/g)
    .map((word) => word.trim())
    .filter(Boolean);
};

const formatListForTextarea = (words) => words.join("\n");

export default function App() {
  const [selectedList, setSelectedList] = useState("hebrew_library");
  const [wordsInput, setWordsInput] = useState(
    formatListForTextarea(PRELOADED_LISTS.hebrew_library)
  );
  const [sizeInput, setSizeInput] = useState("");
  const [maxSizeIncrease, setMaxSizeIncrease] = useState(10);
  const [allowDisconnected, setAllowDisconnected] = useState(true);
  const [emptyChar, setEmptyChar] = useState(".");
  const [keepDuplicates, setKeepDuplicates] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [audioSrc, setAudioSrc] = useState("/chant.mp3");
  const [audioName, setAudioName] = useState("chant.mp3");
  const [audioError, setAudioError] = useState("");
  const audioRef = useRef(null);
  const audioUrlRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const parsedWords = useMemo(() => parseWords(wordsInput), [wordsInput]);
  const translations = PRELOADED_TRANSLATIONS[selectedList] || {};

  const handleSelectList = (event) => {
    const name = event.target.value;
    setSelectedList(name);
    const list = PRELOADED_LISTS[name] || [];
    setWordsInput(formatListForTextarea(list));
  };

  const handleGenerate = () => {
    const words = keepDuplicates ? parsedWords : dedupeWords(parsedWords);
    if (!words.length) {
      setError("Add at least one word to generate a crossword.");
      setResult(null);
      return;
    }

    const size = Number.isFinite(Number(sizeInput)) && sizeInput !== "" ? Number(sizeInput) : null;
    const gridResult = generateCrossword(words, {
      size,
      allowDisconnected,
      maxSizeIncrease: Number(maxSizeIncrease) || 0,
    });

    if (!gridResult) {
      setError("No valid arrangement found. Try a bigger grid or allow disconnected words.");
      setResult(null);
      return;
    }

    setError("");
    setResult(gridResult);
  };

  const gridText = result ? renderGrid(result.grid, emptyChar || ".") : "";

  const handleAudioFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
    }
    audioUrlRef.current = url;
    setAudioSrc(url);
    setAudioName(file.name);
    setAudioError("");
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const toggleChant = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      if (audio.paused) {
        await audio.play();
        setIsPlaying(true);
      } else {
        audio.pause();
        setIsPlaying(false);
      }
    } catch (err) {
      setAudioError("Audio playback was blocked. Try clicking play again.");
    }
  };

  useEffect(() => {
    return () => {
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
    };
  }, []);

  return (
    <div className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">Crossword Workshop</p>
          <h1>Generate a crossword from any word list.</h1>
          <p className="subtitle">
            Paste words, choose a preset, and let the generator stitch the grid.
            Works with Unicode, including RTL scripts like Hebrew.
          </p>
        </div>
        <div className="hero-card">
          <div className="hero-stat">
            <span>Words</span>
            <strong>{parsedWords.length}</strong>
          </div>
          <div className="hero-stat">
            <span>Mode</span>
            <strong>{allowDisconnected ? "Flexible" : "Classic"}</strong>
          </div>
          <div className="hero-stat">
            <span>Preset</span>
            <strong>{selectedList.replace("_", " ")}</strong>
          </div>
          <div className="hero-stat hero-audio">
            <span>Chant</span>
            <button type="button" className="ghost" onClick={toggleChant}>
              {isPlaying ? "Pause" : "Play"}
            </button>
          </div>
          <div className="hero-stat hero-link">
            <span>Sudoku</span>
            <a className="ghost" href="/sudoku.html">Open</a>
          </div>
        </div>
      </header>

      <main className="workspace">
        <section className="panel">
          <div className="panel-header">
            <h2>Inputs</h2>
            <div className="select-row">
              <label htmlFor="preset">Preset</label>
              <select id="preset" value={selectedList} onChange={handleSelectList}>
                {listNames.map((name) => (
                  <option key={name} value={name}>
                    {name.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label className="field">
            <span>Words (one per line or comma-separated)</span>
            <textarea
              rows={10}
              value={wordsInput}
              onChange={(event) => setWordsInput(event.target.value)}
            />
          </label>

          <div className="grid-row">
            <label className="field small">
              <span>Grid size (optional)</span>
              <input
                type="number"
                min="3"
                value={sizeInput}
                onChange={(event) => setSizeInput(event.target.value)}
                placeholder="auto"
              />
            </label>
            <label className="field small">
              <span>Max size increase</span>
              <input
                type="number"
                min="0"
                value={maxSizeIncrease}
                onChange={(event) => setMaxSizeIncrease(event.target.value)}
              />
            </label>
          </div>

          <div className="grid-row">
            <label className="field small">
              <span>Empty cell</span>
              <input
                type="text"
                maxLength={1}
                value={emptyChar}
                onChange={(event) => setEmptyChar(event.target.value)}
              />
            </label>
            <label className="toggle">
              <input
                type="checkbox"
                checked={allowDisconnected}
                onChange={(event) => setAllowDisconnected(event.target.checked)}
              />
              <span>Allow disconnected words</span>
            </label>
          </div>

          <label className="field">
            <span>Chant audio (optional)</span>
            <input type="file" accept="audio/*" onChange={handleAudioFile} />
            <span className="helper">
              Using: {audioName}. Add a file or place `chant.mp3` in `public/`.
            </span>
            {audioError ? <span className="error-inline">{audioError}</span> : null}
          </label>

          <label className="toggle">
            <input
              type="checkbox"
              checked={keepDuplicates}
              onChange={(event) => setKeepDuplicates(event.target.checked)}
            />
            <span>Keep duplicate words</span>
          </label>

          <button type="button" className="primary" onClick={handleGenerate}>
            Generate crossword
          </button>
          {error ? <p className="error">{error}</p> : null}
        </section>

        <section className="panel result">
          <div className="panel-header">
            <h2>Grid</h2>
            {result ? (
              <span className="pill">{result.grid.length} x {result.grid.length}</span>
            ) : null}
          </div>

          {!result ? (
            <div className="placeholder">
              <p>Generate a crossword to see the grid and placements.</p>
              <p className="muted">
                Tip: If the generator can’t place everything, increase the grid or
                allow disconnected words.
              </p>
            </div>
          ) : (
            <>
              <div
                className="grid"
                style={{
                  "--cols": result.grid.length,
                  gridTemplateColumns: `repeat(${result.grid.length}, var(--cell))`,
                }}
              >
                {result.grid.flatMap((row, rowIndex) =>
                  row.map((cell, colIndex) => (
                    <div key={`${rowIndex}-${colIndex}`} className={cell ? "cell" : "cell empty"}>
                      {cell || emptyChar || "."}
                    </div>
                  ))
                )}
              </div>

              <div className="split">
                <div>
                  <h3>Placements</h3>
                  <ul className="placements">
                    {result.placements.map((placement) => {
                      const entry = translations[placement.word];
                      const translation = entry?.translation ?? entry?.english ?? entry;
                      const pronunciation = entry?.pronunciation ?? entry?.pronounce ?? "";
                      const tooltip = translation
                        ? `EN: ${translation}${pronunciation ? `\\nPron: ${pronunciation}` : ""}`
                        : pronunciation
                          ? `Pron: ${pronunciation}`
                          : "";
                      return (
                        <li key={`${placement.word}-${placement.row}-${placement.col}-${placement.direction}`}>
                          <span
                            className={`placement-word${translation ? " has-translation" : ""}`}
                            data-translation={tooltip}
                            title={tooltip}
                          >
                            {placement.word}
                          </span>
                          <span>
                            ({placement.row},{placement.col}) {placement.direction === "H" ? "Horizontal" : "Vertical"}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <div>
                  <h3>Grid (text)</h3>
                  <pre className="grid-text">{gridText}</pre>
                </div>
              </div>
            </>
          )}
        </section>
      </main>
      <audio
        ref={audioRef}
        src={audioSrc}
        loop
        preload="auto"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onError={() => setAudioError("Unable to load the audio file.")}
      />
    </div>
  );
}
