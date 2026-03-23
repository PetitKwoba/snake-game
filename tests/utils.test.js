// Lightweight browser test file for core utilities.
(function runUtilityTests() {
  "use strict";

  const resultsEl = document.getElementById("results");

  function assert(condition, message) {
    if (!condition) {
      throw new Error(message);
    }
  }

  function log(line) {
    resultsEl.textContent += `${line}\n`;
  }

  function run() {
    const { hashString, mulberry32 } = window.SnakeRandom;
    const { wrapCell } = window.SnakeGrid;

    assert(typeof hashString === "function", "hashString missing");
    assert(typeof mulberry32 === "function", "mulberry32 missing");
    assert(typeof wrapCell === "function", "wrapCell missing");

    const a1 = hashString("debug-seed");
    const a2 = hashString("debug-seed");
    assert(a1 === a2, "hashString should be deterministic");

    const rngA = mulberry32(12345);
    const rngB = mulberry32(12345);
    assert(rngA() === rngB(), "mulberry32 should be deterministic for same seed");

    const w1 = wrapCell({ x: -1, y: 0 }, 20);
    assert(w1.x === 19 && w1.y === 0, "wrap left edge failed");

    const w2 = wrapCell({ x: 20, y: 19 }, 20);
    assert(w2.x === 0 && w2.y === 19, "wrap right edge failed");

    log("All utility tests passed.");
  }

  try {
    run();
  } catch (error) {
    log(`Test failed: ${error.message}`);
    throw error;
  }
})();
