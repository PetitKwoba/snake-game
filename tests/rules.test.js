// Lightweight browser tests for rule helpers.
(function runRulesTests() {
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
    const { createRules } = window.SnakeRules;
    const rules = createRules({
      gridSize: 5,
      wrapCell(cell) {
        return {
          x: (cell.x + 5) % 5,
          y: (cell.y + 5) % 5,
        };
      },
    });

    assert(rules.isReverse({ x: 1, y: 0 }, { x: -1, y: 0 }), "reverse detection failed");
    assert(rules.manhattan({ x: 0, y: 0 }, { x: 2, y: 3 }) === 5, "manhattan distance failed");

    const snake = [{ x: 0, y: 0 }];
    const obstacles = [{ x: 1, y: 0 }, { x: 1, y: 1 }];
    const pathExists = rules.hasPath({ x: 0, y: 0 }, { x: 2, y: 0 }, snake, obstacles);
    assert(pathExists, "path should exist around obstacles");

    const neighbors = rules.freeNeighborsCount({ x: 2, y: 2 }, snake, obstacles, { x: 2, y: 3 });
    assert(neighbors >= 1, "freeNeighborsCount should be >= 1 in this setup");

    log("Rules tests passed.");
  }

  try {
    run();
  } catch (error) {
    log(`Rules test failed: ${error.message}`);
    throw error;
  }
})();
