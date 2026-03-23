// Classic Snake Game
// DOM requirements in HTML:
// <canvas id="game" width="400" height="400"></canvas>
// <span id="score">0</span>
// <div id="state"></div>

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const stateEl = document.getElementById("state");

// Grid and timing configuration.
const gridCount = 20;
const cellSize = canvas.width / gridCount;
const defaultTickMs = 120;
const obstacleStepPerLevel = 3;

// Difficulty presets.
const difficultyConfig = {
  easy: { baseObstacles: 8, movingObstacles: false, tickMs: 130 },
  normal: { baseObstacles: 18, movingObstacles: false, tickMs: 115 },
  hard: { baseObstacles: 40, movingObstacles: true, tickMs: 85 },
};

// Mutable game state.
let snake;
let direction;
let nextDirection;
let food;
let obstacles;
let score;
let level;
let difficulty;
let baseObstacleCount;
let movingObstaclesEnabled;
let activeTickMs;
let running;
let gameOver;
let loopId;

function initGame() {
  // Reset all gameplay values to the starting state.
  if (!difficulty) {
    setDifficulty("normal");
  }

  snake = [{ x: 10, y: 10 }];
  direction = { x: 0, y: 0 };
  nextDirection = { x: 0, y: 0 };
  level = 0;
  obstacles = spawnObstacles(getTargetObstacleCount());
  food = spawnFood();
  score = 0;
  running = false;
  gameOver = false;

  scoreEl.textContent = String(score);
  updateStatusText("Press an arrow key or WASD to start");

  clearInterval(loopId);
  draw();
}

function setDifficulty(mode) {
  const config = difficultyConfig[mode];
  if (!config) {
    return;
  }

  difficulty = mode;
  baseObstacleCount = config.baseObstacles;
  movingObstaclesEnabled = config.movingObstacles;
  activeTickMs = config.tickMs ?? defaultTickMs;
}

function updateStatusText(prefix) {
  stateEl.textContent = `${prefix} | ${difficulty.toUpperCase()} | Speed ${activeTickMs}ms | Level ${level}`;
}

function getTargetObstacleCount() {
  return baseObstacleCount + level * obstacleStepPerLevel;
}

function randomCell() {
  return {
    x: Math.floor(Math.random() * gridCount),
    y: Math.floor(Math.random() * gridCount),
  };
}

function isBlockedCell(cell, options = {}) {
  const { ignoreFood = false, ignoreObstacles = false } = options;

  const onSnake = snake?.some(
    (segment) => segment.x === cell.x && segment.y === cell.y
  );
  if (onSnake) {
    return true;
  }

  if (!ignoreObstacles) {
    const onObstacle = obstacles?.some(
      (block) => block.x === cell.x && block.y === cell.y
    );
    if (onObstacle) {
      return true;
    }
  }

  if (!ignoreFood && food && food.x === cell.x && food.y === cell.y) {
    return true;
  }

  return false;
}

function spawnFood() {
  // Keep trying random cells until one is not occupied by the snake.
  while (true) {
    const candidate = randomCell();

    if (!isBlockedCell(candidate, { ignoreFood: true })) {
      return candidate;
    }
  }
}

function spawnObstacles(count) {
  const blocks = [];

  while (blocks.length < count) {
    const candidate = randomCell();

    // Keep the snake spawn zone open for fair starts.
    const inSpawnZone =
      Math.abs(candidate.x - 10) <= 2 && Math.abs(candidate.y - 10) <= 2;

    const onSnake = snake?.some(
      (segment) => segment.x === candidate.x && segment.y === candidate.y
    );
    const duplicate = blocks.some(
      (block) => block.x === candidate.x && block.y === candidate.y
    );

    if (!inSpawnZone && !onSnake && !duplicate) {
      blocks.push(candidate);
    }
  }

  return blocks;
}

function startGameLoop() {
  if (running || gameOver) {
    return;
  }

  running = true;
  updateStatusText("Running");
  loopId = setInterval(update, activeTickMs);
}

function setDirection(x, y) {
  if (gameOver) {
    return;
  }

  // Prevent reversing directly into the snake body.
  if (snake.length > 1 && x === -direction.x && y === -direction.y) {
    return;
  }

  nextDirection = { x, y };
  startGameLoop();
}

function update() {
  // Apply queued direction from the latest key press.
  direction = nextDirection;

  if (direction.x === 0 && direction.y === 0) {
    return;
  }

  const head = snake[0];
  // Wrap through walls instead of dying on edges.
  const newHead = {
    x: (head.x + direction.x + gridCount) % gridCount,
    y: (head.y + direction.y + gridCount) % gridCount,
  }

  // Stop if the new head overlaps any body segment.
  const hitSelf = snake.some(
    (segment) => segment.x === newHead.x && segment.y === newHead.y
  );

  const hitObstacle = obstacles.some(
    (block) => block.x === newHead.x && block.y === newHead.y
  );

  if (hitSelf || hitObstacle) {
    endGame();
    return;
  }

  snake.unshift(newHead);

  // Grow on food collision, otherwise keep length by removing the tail.
  const ateFood = newHead.x === food.x && newHead.y === food.y;
  if (ateFood) {
    score += 1;
    level = Math.floor(score / 5);
    scoreEl.textContent = String(score);
    syncObstaclesToLevel();
    food = spawnFood();
  } else {
    snake.pop();
  }

  if (movingObstaclesEnabled) {
    moveObstacles();

    const blockedByMovedObstacle = obstacles.some(
      (block) => block.x === snake[0].x && block.y === snake[0].y
    );

    if (blockedByMovedObstacle) {
      endGame();
      return;
    }
  }

  draw();
}

function syncObstaclesToLevel() {
  const target = getTargetObstacleCount();

  while (obstacles.length < target) {
    const candidate = randomCell();
    const inSpawnZone =
      Math.abs(candidate.x - 10) <= 2 && Math.abs(candidate.y - 10) <= 2;

    const duplicate = obstacles.some(
      (block) => block.x === candidate.x && block.y === candidate.y
    );

    if (!inSpawnZone && !duplicate && !isBlockedCell(candidate, { ignoreObstacles: true })) {
      obstacles.push(candidate);
    }
  }

  while (obstacles.length > target) {
    obstacles.pop();
  }

  updateStatusText(running ? "Running" : "Ready");
}

function moveObstacles() {
  const directions = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];

  const nextBlocks = [];

  obstacles.forEach((block) => {
    const move = directions[Math.floor(Math.random() * directions.length)];
    const candidate = {
      x: (block.x + move.x + gridCount) % gridCount,
      y: (block.y + move.y + gridCount) % gridCount,
    };

    const duplicate = nextBlocks.some(
      (nextBlock) => nextBlock.x === candidate.x && nextBlock.y === candidate.y
    );

    const collidesSnake = snake.some(
      (segment) => segment.x === candidate.x && segment.y === candidate.y
    );

    const onFood = food.x === candidate.x && food.y === candidate.y;

    if (duplicate || collidesSnake || onFood) {
      nextBlocks.push(block);
    } else {
      nextBlocks.push(candidate);
    }
  });

  obstacles = nextBlocks;
}

function endGame() {
  running = false;
  gameOver = true;
  clearInterval(loopId);
  updateStatusText("Game Over - Press R to restart");
  draw();
}

function drawGrid() {
  ctx.strokeStyle = "#1f2937";
  ctx.lineWidth = 1;

  for (let i = 0; i <= gridCount; i += 1) {
    const p = i * cellSize;

    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, canvas.height);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(canvas.width, p);
    ctx.stroke();
  }
}

function draw() {
  // Clear frame and paint board background.
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#111827";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawGrid();

  // Draw food.
  ctx.fillStyle = "#ef4444";
  ctx.fillRect(
    food.x * cellSize + 2,
    food.y * cellSize + 2,
    cellSize - 4,
    cellSize - 4
  );

  // Draw snake.
  snake.forEach((segment, index) => {
    ctx.fillStyle = index === 0 ? "#16a34a" : "#22c55e";
    ctx.fillRect(
      segment.x * cellSize + 2,
      segment.y * cellSize + 2,
      cellSize - 4,
      cellSize - 4
    );
  });

  // Draw random obstacles.
  ctx.fillStyle = "#64748b";
  obstacles.forEach((block) => {
    ctx.fillRect(
      block.x * cellSize + 2,
      block.y * cellSize + 2,
      cellSize - 4,
      cellSize - 4
    );
  });

  if (gameOver) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#e5e7eb";
    ctx.textAlign = "center";
    ctx.font = "bold 28px Segoe UI";
    ctx.fillText("Game Over", canvas.width / 2, canvas.height / 2 - 8);
    ctx.font = "16px Segoe UI";
    ctx.fillText("Press R to restart", canvas.width / 2, canvas.height / 2 + 24);
  }
}

window.addEventListener("keydown", (event) => {
  // Translate keyboard input into game direction vectors.
  const key = event.key.toLowerCase();

  if (key === "arrowup" || key === "w") {
    setDirection(0, -1);
  } else if (key === "arrowdown" || key === "s") {
    setDirection(0, 1);
  } else if (key === "arrowleft" || key === "a") {
    setDirection(-1, 0);
  } else if (key === "arrowright" || key === "d") {
    setDirection(1, 0);
  } else if (key === "1") {
    setDifficulty("easy");
    initGame();
  } else if (key === "2") {
    setDifficulty("normal");
    initGame();
  } else if (key === "3") {
    setDifficulty("hard");
    initGame();
  } else if (key === "r") {
    initGame();
  }
});

initGame();
