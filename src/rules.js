(function attachSnakeRules(globalObj) {
  "use strict";

  function createRules(options) {
    const gridSize = options.gridSize;
    const wrapCell = options.wrapCell;

    function cellEq(a, b) {
      return a.x === b.x && a.y === b.y;
    }

    function manhattan(a, b) {
      return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    }

    function isReverse(a, b) {
      return a.x === -b.x && a.y === -b.y;
    }

    function hasPath(head, target, snake, obstacles) {
      const q = [head];
      const seen = new Set([`${head.x},${head.y}`]);
      const dirs = [
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: -1 },
      ];

      while (q.length > 0) {
        const cur = q.shift();
        if (cellEq(cur, target)) {
          return true;
        }

        for (let i = 0; i < dirs.length; i += 1) {
          const next = wrapCell({ x: cur.x + dirs[i].x, y: cur.y + dirs[i].y });
          const key = `${next.x},${next.y}`;
          if (seen.has(key)) {
            continue;
          }

          const blockedBySnake = snake.some((s) => cellEq(s, next));
          const blockedByObstacle = obstacles.some((o) => cellEq(o, next));
          if ((blockedBySnake || blockedByObstacle) && !cellEq(next, target)) {
            continue;
          }

          seen.add(key);
          q.push(next);
        }
      }

      return false;
    }

    function freeNeighborsCount(cell, snake, obstacles, food) {
      const dirs = [
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: -1 },
      ];

      let count = 0;
      dirs.forEach((d) => {
        const n = wrapCell({ x: cell.x + d.x, y: cell.y + d.y });
        const blockedBySnake = snake.some((s) => cellEq(s, n));
        const blockedByObstacle = obstacles.some((o) => cellEq(o, n));
        const blockedByFood = food ? cellEq(food, n) : false;
        if (!blockedBySnake && !blockedByObstacle && !blockedByFood) {
          count += 1;
        }
      });

      return count;
    }

    function obstaclePatternForLevel(level, index, rand) {
      if (level < 5) {
        return { axis: rand() < 0.5 ? "h" : "v", dir: rand() < 0.5 ? -1 : 1 };
      }
      return { axis: index % 2 === 0 ? "h" : "v", dir: index % 4 < 2 ? 1 : -1 };
    }

    return {
      gridSize,
      cellEq,
      manhattan,
      isReverse,
      hasPath,
      freeNeighborsCount,
      obstaclePatternForLevel,
    };
  }

  globalObj.SnakeRules = {
    createRules,
  };
})(window);
