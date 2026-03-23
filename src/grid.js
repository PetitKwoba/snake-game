(function attachSnakeGrid(globalObj) {
  "use strict";

  function wrapCell(cell, gridSize) {
    return {
      x: (cell.x + gridSize) % gridSize,
      y: (cell.y + gridSize) % gridSize,
    };
  }

  globalObj.SnakeGrid = {
    wrapCell,
  };
})(window);
