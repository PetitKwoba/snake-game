// Snake Arena game engine
// Features: modes, smooth progression, safe obstacle spawning, moving obstacle warnings,
// input buffering, pause, mobile controls, combo/bonus scoring, high score, seeded RNG, and audio toggles.

(() => {
  "use strict";

  // --------------------------- DOM ---------------------------
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const modeTextEl = document.getElementById("modeText");
  const stateEl = document.getElementById("state");
  const levelTextEl = document.getElementById("levelText");
  const speedTextEl = document.getElementById("speedText");
  const comboTextEl = document.getElementById("comboText");
  const timerTextEl = document.getElementById("timerText");

  const modeSelect = document.getElementById("modeSelect");
  const difficultySelect = document.getElementById("difficultySelect");
  const startBtn = document.getElementById("startBtn");
  const restartBtn = document.getElementById("restartBtn");
  const sfxBtn = document.getElementById("sfxBtn");
  const musicBtn = document.getElementById("musicBtn");
  const volumeInput = document.getElementById("volume");
  const seedInput = document.getElementById("seedInput");
  const pauseBtn = document.getElementById("pauseBtn");

  const boardWrap = document.getElementById("boardWrap");
  const bannerEl = document.getElementById("banner");
  const randomUtils = window.SnakeRandom || {};
  const gridUtils = window.SnakeGrid || {};

  // --------------------------- Config ---------------------------
  const GRID = 20;
  const CELL = canvas.width / GRID;
  const MAX_OBS_DENSITY = 0.22;
  const MAX_OBSTACLES = Math.floor(GRID * GRID * MAX_OBS_DENSITY);
  const OBSTACLE_STEP_PER_LEVEL = 2;
  const LEVEL_UP_EVERY = 5;
  const LEVEL_OBSTACLE_GRACE_MS = 2200;

  const COMBO_WINDOW_MS = 3500;
  const BONUS_FOOD_CHANCE = 0.2;
  const BONUS_FOOD_LIFETIME_MS = 5000;
  const TIME_ATTACK_ROUND_MS = 90_000;
  const TIME_ATTACK_FOOD_MS = 6500;

  const DIFFICULTY = {
    easy: {
      baseSpeedMs: 145,
      minSpeedMs: 82,
      speedStepMs: 2,
      baseObstacles: 6,
      movingObstacles: false,
      movingRatio: 0.2,
    },
    normal: {
      baseSpeedMs: 125,
      minSpeedMs: 68,
      speedStepMs: 2,
      baseObstacles: 14,
      movingObstacles: false,
      movingRatio: 0.3,
    },
    hard: {
      baseSpeedMs: 110,
      minSpeedMs: 54,
      speedStepMs: 3,
      baseObstacles: 24,
      movingObstacles: true,
      movingRatio: 0.45,
    },
  };

  const MODES = {
    classic: "classic",
    survival: "survival",
    timeAttack: "timeAttack",
  };

  // --------------------------- State ---------------------------
  let rng = Math.random;
  let seedLabel = "";

  let snake = [];
  let direction = { x: 1, y: 0 };
  let inputQueue = [];
  let canApplyDirectionThisTick = true;

  let food = null;
  let bonusFood = null;

  let obstacles = [];
  let warningCells = [];
  let queuedObstacleMoves = [];
  let pendingObstacleAdds = [];
  let levelObstacleActivateAt = 0;

  let running = false;
  let paused = false;
  let gameOver = false;
  let started = false;

  let mode = MODES.survival;
  let difficultyKey = "normal";
  let difficulty = DIFFICULTY.normal;

  let score = 0;
  let bestScore = 0;
  let level = 0;
  let combo = 1;
  let lastFoodTime = 0;
  let gameStartTime = 0;
  let endAtTime = 0;
  let foodExpireAt = 0;

  let currentTickMs = difficulty.baseSpeedMs;
  let gameTimer = null;

  let eatPulseUntil = 0;

  // --------------------------- Audio ---------------------------
  let audioCtx = null;
  let sfxEnabled = true;
  let musicEnabled = false;
  let volume = parseFloat(volumeInput.value) || 0.22;
  let musicInterval = null;
  let musicStep = 0;

  function ensureAudio() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) {
        audioCtx = new Ctx();
      }
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
  }

  function beep(freq, dur, type = "sine", gainScale = 1) {
    if (!sfxEnabled) {
      return;
    }
    ensureAudio();
    if (!audioCtx) {
      return;
    }

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = 0.0001;

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;
    const targetGain = Math.max(0.01, Math.min(0.25, volume * gainScale));
    gain.gain.exponentialRampToValueAtTime(targetGain, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur / 1000);

    osc.start(now);
    osc.stop(now + dur / 1000 + 0.02);
  }

  function startMusic() {
    stopMusic();
    if (!musicEnabled) {
      return;
    }
    ensureAudio();
    if (!audioCtx) {
      return;
    }

    const seq = [220, 277, 330, 277, 247, 220, 165, 196];
    musicInterval = window.setInterval(() => {
      if (!running || paused || gameOver || !musicEnabled) {
        return;
      }
      const freq = seq[musicStep % seq.length];
      musicStep += 1;
      beep(freq, 140, "triangle", 0.5);
    }, 220);
  }

  function stopMusic() {
    if (musicInterval) {
      window.clearInterval(musicInterval);
      musicInterval = null;
    }
  }

  // --------------------------- RNG ---------------------------
  function hashString(str) {
    if (typeof randomUtils.hashString === "function") {
      return randomUtils.hashString(str);
    }

    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i += 1) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    if (typeof randomUtils.mulberry32 === "function") {
      return randomUtils.mulberry32(seed);
    }

    let a = seed >>> 0;
    return function next() {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function configureRngFromSeed() {
    const text = (seedInput.value || "").trim();
    if (!text) {
      rng = Math.random;
      seedLabel = "";
      return;
    }
    const seed = hashString(text);
    rng = mulberry32(seed);
    seedLabel = text;
  }

  function randInt(max) {
    return Math.floor(rng() * max);
  }

  // --------------------------- Helpers ---------------------------
  function keyForBest() {
    return `snake-best-${mode}-${difficultyKey}`;
  }

  function loadBest() {
    const raw = localStorage.getItem(keyForBest());
    bestScore = raw ? Number(raw) || 0 : 0;
    bestEl.textContent = String(bestScore);
  }

  function saveBestIfNeeded() {
    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem(keyForBest(), String(bestScore));
      bestEl.textContent = String(bestScore);
    }
  }

  function cellEq(a, b) {
    return a.x === b.x && a.y === b.y;
  }

  function wrapCell(cell) {
    if (typeof gridUtils.wrapCell === "function") {
      return gridUtils.wrapCell(cell, GRID);
    }

    return {
      x: (cell.x + GRID) % GRID,
      y: (cell.y + GRID) % GRID,
    };
  }

  function manhattan(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  function randomCell() {
    return { x: randInt(GRID), y: randInt(GRID) };
  }

  function cellOnSnake(cell) {
    return snake.some((p) => cellEq(p, cell));
  }

  function cellOnObstacles(cell, source = obstacles) {
    return source.some((o) => cellEq(o, cell));
  }

  function isBlocked(cell, obstacleSource = obstacles) {
    if (cellOnSnake(cell)) {
      return true;
    }
    if (cellOnObstacles(cell, obstacleSource)) {
      return true;
    }
    return false;
  }

  function freeNeighborsCount(cell, obstacleSource) {
    const dirs = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ];

    let count = 0;
    dirs.forEach((d) => {
      const n = wrapCell({ x: cell.x + d.x, y: cell.y + d.y });
      if (!isBlocked(n, obstacleSource) && !(food && cellEq(n, food))) {
        count += 1;
      }
    });
    return count;
  }

  function hasPath(head, target, obstacleSource) {
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
        if (cellOnSnake(next) && !cellEq(next, target)) {
          continue;
        }
        if (cellOnObstacles(next, obstacleSource) && !cellEq(next, target)) {
          continue;
        }
        seen.add(key);
        q.push(next);
      }
    }

    return false;
  }

  function showBanner(text) {
    bannerEl.textContent = text;
    bannerEl.classList.add("show");
    window.setTimeout(() => bannerEl.classList.remove("show"), 700);
  }

  function shakeBoard() {
    boardWrap.classList.remove("shake");
    // Trigger reflow to restart animation.
    void boardWrap.offsetWidth;
    boardWrap.classList.add("shake");
  }

  function setStateText(prefix) {
    const speed = `${currentTickMs}ms`;
    const seedTag = seedLabel ? ` | seed:${seedLabel}` : "";
    stateEl.textContent = `${prefix} | ${difficultyKey.toUpperCase()} | ${speed}${seedTag}`;
  }

  function updateHud(now = performance.now()) {
    scoreEl.textContent = String(score);
    modeTextEl.textContent = mode;
    levelTextEl.textContent = String(level);
    speedTextEl.textContent = `${currentTickMs}ms`;
    comboTextEl.textContent = `x${combo}`;

    if (mode === MODES.timeAttack) {
      const gameRemain = Math.max(0, endAtTime - now);
      const foodRemain = Math.max(0, foodExpireAt - now);
      timerTextEl.textContent = `${(gameRemain / 1000).toFixed(0)}s / ${(foodRemain / 1000).toFixed(1)}s`;
    } else {
      timerTextEl.textContent = "--";
    }
  }

  function restartLoop() {
    if (gameTimer) {
      window.clearInterval(gameTimer);
    }
    gameTimer = window.setInterval(gameTick, currentTickMs);
  }

  function getTargetObstacleCount() {
    if (mode === MODES.classic) {
      return 0;
    }
    const scaled = difficulty.baseObstacles + level * OBSTACLE_STEP_PER_LEVEL;
    return Math.min(MAX_OBSTACLES, scaled);
  }

  function getSpeedForLevel() {
    const scaled = difficulty.baseSpeedMs - level * difficulty.speedStepMs;
    return Math.max(difficulty.minSpeedMs, scaled);
  }

  function nextLevelFromScore() {
    return Math.floor(score / LEVEL_UP_EVERY);
  }

  // --------------------------- Spawning ---------------------------
  function spawnFood() {
    for (let tries = 0; tries < 2000; tries += 1) {
      const c = randomCell();
      if (isBlocked(c)) {
        continue;
      }
      if (bonusFood && cellEq(c, bonusFood.cell)) {
        continue;
      }
      // Keep at least one path from head to food.
      if (!hasPath(snake[0], c, obstacles)) {
        continue;
      }
      food = c;
      if (mode === MODES.timeAttack) {
        foodExpireAt = performance.now() + TIME_ATTACK_FOOD_MS;
      }
      return true;
    }
    return false;
  }

  function spawnBonusFood(now) {
    if (bonusFood || mode === MODES.classic) {
      return;
    }
    if (rng() > BONUS_FOOD_CHANCE) {
      return;
    }

    for (let tries = 0; tries < 500; tries += 1) {
      const c = randomCell();
      if (isBlocked(c) || cellEq(c, food)) {
        continue;
      }
      if (!hasPath(snake[0], c, obstacles)) {
        continue;
      }
      bonusFood = {
        cell: c,
        expiresAt: now + BONUS_FOOD_LIFETIME_MS,
        value: 4,
      };
      return;
    }
  }

  function obstaclePatternForLevel(index) {
    if (level < 5) {
      return { axis: rng() < 0.5 ? "h" : "v", dir: rng() < 0.5 ? -1 : 1 };
    }
    // More predictable at higher levels: alternating lanes.
    return { axis: index % 2 === 0 ? "h" : "v", dir: index % 4 < 2 ? 1 : -1 };
  }

  function toObstacle(cell, index = 0) {
    const pattern = obstaclePatternForLevel(index);
    return {
      x: cell.x,
      y: cell.y,
      axis: pattern.axis,
      dir: pattern.dir,
    };
  }

  function safeToAddObstacle(candidate, currentObs, headCell, targetFood) {
    if (cellOnSnake(candidate)) {
      return false;
    }
    if (cellEq(candidate, headCell)) {
      return false;
    }
    if (cellEq(candidate, targetFood)) {
      return false;
    }
    if (manhattan(candidate, headCell) < 4) {
      return false;
    }

    const merged = currentObs.concat([toObstacle(candidate, currentObs.length)]);

    // Avoid surrounding food into dead-end clusters.
    if (freeNeighborsCount(targetFood, merged) < 2) {
      return false;
    }

    // Guarantee at least one path from snake head to food.
    if (!hasPath(headCell, targetFood, merged)) {
      return false;
    }

    return true;
  }

  function buildObstacles(targetCount) {
    const head = snake[0];
    let built = [];

    for (let i = 0; i < targetCount; i += 1) {
      let added = false;
      for (let tries = 0; tries < 1000; tries += 1) {
        const c = randomCell();
        if (cellOnObstacles(c, built)) {
          continue;
        }
        if (!safeToAddObstacle(c, built, head, food)) {
          continue;
        }
        built.push(toObstacle(c, built.length));
        added = true;
        break;
      }

      if (!added) {
        // If strict constraints fail at high density, keep game playable with what we have.
        break;
      }
    }

    return built;
  }

  function scheduleLevelObstacles(now) {
    const target = getTargetObstacleCount();
    const missing = target - obstacles.length;
    if (missing <= 0) {
      return;
    }

    let obsShadow = obstacles.slice();
    const head = snake[0];
    const newAdds = [];

    for (let i = 0; i < missing; i += 1) {
      let placed = false;
      for (let tries = 0; tries < 1000; tries += 1) {
        const c = randomCell();
        if (cellOnObstacles(c, obsShadow)) {
          continue;
        }
        if (!safeToAddObstacle(c, obsShadow, head, food)) {
          continue;
        }

        const o = toObstacle(c, obsShadow.length);
        obsShadow.push(o);
        newAdds.push(o);
        placed = true;
        break;
      }
      if (!placed) {
        break;
      }
    }

    pendingObstacleAdds = newAdds;
    levelObstacleActivateAt = now + LEVEL_OBSTACLE_GRACE_MS;
  }

  function activatePendingObstacles(now) {
    if (pendingObstacleAdds.length === 0) {
      return;
    }
    if (now < levelObstacleActivateAt) {
      return;
    }

    // Final guard to keep path valid after activation.
    const nextObs = obstacles.concat(pendingObstacleAdds);
    if (hasPath(snake[0], food, nextObs) && freeNeighborsCount(food, nextObs) >= 2) {
      obstacles = nextObs;
    }

    pendingObstacleAdds = [];
  }

  // --------------------------- Controls ---------------------------
  function dirFromKey(k) {
    if (k === "arrowup" || k === "w") {
      return { x: 0, y: -1 };
    }
    if (k === "arrowdown" || k === "s") {
      return { x: 0, y: 1 };
    }
    if (k === "arrowleft" || k === "a") {
      return { x: -1, y: 0 };
    }
    if (k === "arrowright" || k === "d") {
      return { x: 1, y: 0 };
    }
    return null;
  }

  function isReverse(a, b) {
    return a.x === -b.x && a.y === -b.y;
  }

  function queueDirection(nextDir) {
    if (!nextDir || gameOver) {
      return;
    }

    const compare = inputQueue.length > 0 ? inputQueue[inputQueue.length - 1] : direction;
    if (isReverse(nextDir, compare)) {
      return;
    }

    if (inputQueue.length < 2) {
      inputQueue.push(nextDir);
    }

    if (!started && !paused) {
      started = true;
      running = true;
      setStateText("Running");
      if (musicEnabled) {
        startMusic();
      }
    }
  }

  function togglePause() {
    if (gameOver || !running) {
      return;
    }

    paused = !paused;
    pauseBtn.textContent = paused ? "Resume" : "Pause";
    setStateText(paused ? "Paused" : "Running");
    if (paused) {
      beep(180, 90, "square", 0.5);
    } else {
      beep(320, 90, "square", 0.5);
    }
  }

  // --------------------------- Modes + Scoring ---------------------------
  function gainPoints(basePoints, now) {
    if (now - lastFoodTime <= COMBO_WINDOW_MS) {
      combo = Math.min(9, combo + 1);
    } else {
      combo = 1;
    }

    const gained = basePoints * combo;
    score += gained;
    lastFoodTime = now;

    const nextLevel = nextLevelFromScore();
    if (nextLevel > level) {
      level = nextLevel;
      scheduleLevelObstacles(now);
      showBanner(`Level ${level}`);
      beep(660, 120, "triangle", 0.8);
    }

    const nextSpeed = getSpeedForLevel();
    if (nextSpeed !== currentTickMs) {
      currentTickMs = nextSpeed;
      restartLoop();
    }

    saveBestIfNeeded();
  }

  function maybeMoveObstacles() {
    warningCells = [];

    if (mode === MODES.classic || !difficulty.movingObstacles || obstacles.length === 0) {
      queuedObstacleMoves = [];
      return;
    }

    // Two-phase movement: warning first, move next tick.
    if (queuedObstacleMoves.length > 0) {
      const next = obstacles.slice();
      queuedObstacleMoves.forEach((plan) => {
        const idx = plan.index;
        const target = plan.to;

        if (idx < 0 || idx >= next.length) {
          return;
        }

        const blockedBySnake = snake.some((s) => cellEq(s, target));
        const blockedByFood = cellEq(food, target) || (bonusFood && cellEq(bonusFood.cell, target));
        const duplicate = next.some((o, i) => i !== idx && o.x === target.x && o.y === target.y);

        if (!blockedBySnake && !blockedByFood && !duplicate) {
          next[idx] = {
            ...next[idx],
            x: target.x,
            y: target.y,
          };
        }
      });
      obstacles = next;
      queuedObstacleMoves = [];
      return;
    }

    const moveCount = Math.max(1, Math.floor(obstacles.length * difficulty.movingRatio));
    const candidates = [];
    for (let i = 0; i < obstacles.length; i += 1) {
      candidates.push(i);
    }

    // Shuffle deterministic based on current RNG.
    for (let i = candidates.length - 1; i > 0; i -= 1) {
      const j = randInt(i + 1);
      const t = candidates[i];
      candidates[i] = candidates[j];
      candidates[j] = t;
    }

    const plans = [];
    for (let i = 0; i < moveCount; i += 1) {
      const idx = candidates[i];
      const o = obstacles[idx];
      if (!o) {
        continue;
      }

      let dx = 0;
      let dy = 0;
      if (o.axis === "h") {
        dx = o.dir;
      } else {
        dy = o.dir;
      }

      const target = wrapCell({ x: o.x + dx, y: o.y + dy });
      plans.push({ index: idx, to: target });
      warningCells.push(target);

      // Keep deterministic lane sweeps by bouncing on wrap boundaries.
      if ((o.axis === "h" && (target.x === 0 || target.x === GRID - 1)) ||
          (o.axis === "v" && (target.y === 0 || target.y === GRID - 1))) {
        o.dir *= -1;
      }
    }

    queuedObstacleMoves = plans;
  }

  // --------------------------- Core Loop ---------------------------
  function gameTick() {
    const now = performance.now();

    updateHud(now);
    if (!running || paused || gameOver) {
      draw(now);
      return;
    }

    activatePendingObstacles(now);

    if (mode === MODES.timeAttack && now >= endAtTime) {
      lose("Time up");
      return;
    }

    if (mode === MODES.timeAttack && now >= foodExpireAt) {
      // Missed food resets combo and respawns food.
      combo = 1;
      spawnFood();
      beep(160, 120, "sawtooth", 0.4);
    }

    if (bonusFood && now >= bonusFood.expiresAt) {
      bonusFood = null;
    }

    canApplyDirectionThisTick = true;
    if (inputQueue.length > 0 && canApplyDirectionThisTick) {
      const candidate = inputQueue.shift();
      if (!isReverse(candidate, direction)) {
        direction = candidate;
        canApplyDirectionThisTick = false;
      }
    }

    const nextHead = wrapCell({
      x: snake[0].x + direction.x,
      y: snake[0].y + direction.y,
    });

    const hitSelf = snake.some((p) => cellEq(p, nextHead));
    const hitObs = mode !== MODES.classic && obstacles.some((o) => cellEq(o, nextHead));

    if (hitSelf || hitObs) {
      lose(hitSelf ? "Self collision" : "Obstacle collision");
      return;
    }

    snake.unshift(nextHead);

    const ateNormal = food && cellEq(nextHead, food);
    const ateBonus = bonusFood && cellEq(nextHead, bonusFood.cell);

    if (ateNormal || ateBonus) {
      const base = ateBonus ? bonusFood.value : mode === MODES.timeAttack ? 2 : 1;
      gainPoints(base, now);

      if (ateBonus) {
        bonusFood = null;
        beep(760, 120, "triangle", 0.8);
      } else {
        beep(520, 80, "square", 0.7);
        if (mode !== MODES.classic) {
          spawnBonusFood(now);
        }
      }

      eatPulseUntil = now + 130;
      spawnFood();
    } else {
      snake.pop();
    }

    maybeMoveObstacles();

    // If warning phase just became move phase and move lands on head, collision on next tick. Check immediate overlap too.
    const movedIntoSnake = obstacles.some((o) => cellEq(o, snake[0]));
    if (movedIntoSnake) {
      lose("Moving obstacle hit");
      return;
    }

    draw(now);
  }

  function lose(reason) {
    running = false;
    gameOver = true;
    paused = false;
    saveBestIfNeeded();
    setStateText(`Game Over (${reason})`);
    shakeBoard();
    showBanner("Game Over");
    beep(120, 220, "sawtooth", 0.9);
  }

  // --------------------------- Rendering ---------------------------
  function drawGrid() {
    ctx.strokeStyle = "#1f3446";
    ctx.lineWidth = 1;

    for (let i = 0; i <= GRID; i += 1) {
      const p = i * CELL;
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

  function drawCell(cell, color, pad = 2) {
    ctx.fillStyle = color;
    ctx.fillRect(cell.x * CELL + pad, cell.y * CELL + pad, CELL - pad * 2, CELL - pad * 2);
  }

  function draw(now) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#11202f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawGrid();

    // Grace period overlays for pending obstacle adds.
    if (pendingObstacleAdds.length > 0) {
      const remain = Math.max(0, levelObstacleActivateAt - now);
      const alpha = 0.2 + 0.35 * (remain / LEVEL_OBSTACLE_GRACE_MS);
      pendingObstacleAdds.forEach((o) => drawCell(o, `rgba(255, 209, 102, ${alpha.toFixed(3)})`, 5));
    }

    // Warning flash cells for moving obstacles.
    warningCells.forEach((c) => drawCell(c, "rgba(255, 209, 102, 0.8)", 6));

    // Obstacles
    obstacles.forEach((o) => drawCell(o, "#5f7a8f"));

    // Food and bonus food.
    if (food) {
      drawCell(food, "#ff6b6b");
    }
    if (bonusFood) {
      drawCell(bonusFood.cell, "#ffd166", 1);
    }

    // Snake with subtle eat pulse.
    const pulse = now < eatPulseUntil ? 1 : 0;
    snake.forEach((seg, i) => {
      if (i === 0) {
        drawCell(seg, pulse ? "#48f4e6" : "#20d6c7", pulse ? 1 : 2);
      } else {
        drawCell(seg, "#1fc58d", 2);
      }
    });

    if (!started && !gameOver) {
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#e8f4ff";
      ctx.textAlign = "center";
      ctx.font = "bold 22px Trebuchet MS";
      ctx.fillText("Press Start", canvas.width / 2, canvas.height / 2 - 4);
      ctx.font = "16px Trebuchet MS";
      ctx.fillText("or use arrow keys / WASD", canvas.width / 2, canvas.height / 2 + 24);
    }

    if (paused && running) {
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#ffd166";
      ctx.textAlign = "center";
      ctx.font = "bold 30px Trebuchet MS";
      ctx.fillText("Paused", canvas.width / 2, canvas.height / 2);
    }
  }

  // --------------------------- Setup + Reset ---------------------------
  function initState() {
    configureRngFromSeed();

    mode = modeSelect.value;
    difficultyKey = difficultySelect.value;
    difficulty = DIFFICULTY[difficultyKey] || DIFFICULTY.normal;

    score = 0;
    level = 0;
    combo = 1;
    lastFoodTime = 0;

    currentTickMs = getSpeedForLevel();

    snake = [{ x: 10, y: 10 }];
    direction = { x: 1, y: 0 };
    inputQueue = [];

    warningCells = [];
    queuedObstacleMoves = [];
    pendingObstacleAdds = [];
    levelObstacleActivateAt = 0;

    food = { x: 14, y: 10 };
    obstacles = buildObstacles(getTargetObstacleCount());
    if (!spawnFood()) {
      food = { x: 14, y: 10 };
    }
    bonusFood = null;

    started = false;
    running = false;
    paused = false;
    gameOver = false;

    gameStartTime = performance.now();
    endAtTime = gameStartTime + TIME_ATTACK_ROUND_MS;
    if (mode === MODES.timeAttack) {
      foodExpireAt = performance.now() + TIME_ATTACK_FOOD_MS;
    }

    loadBest();
    setStateText("Ready");
    pauseBtn.textContent = "Pause";

    if (musicEnabled) {
      startMusic();
    } else {
      stopMusic();
    }

    updateHud(performance.now());
    draw(performance.now());
    restartLoop();
  }

  // --------------------------- Input Wiring ---------------------------
  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();

    if (k === "p") {
      togglePause();
      return;
    }
    if (k === "r") {
      initState();
      return;
    }

    const dir = dirFromKey(k);
    if (dir) {
      e.preventDefault();
      queueDirection(dir);
    }
  });

  document.querySelectorAll(".mobile-pad button[data-dir]").forEach((btn) => {
    const map = {
      up: { x: 0, y: -1 },
      down: { x: 0, y: 1 },
      left: { x: -1, y: 0 },
      right: { x: 1, y: 0 },
    };

    const d = map[btn.getAttribute("data-dir")];
    ["click", "touchstart"].forEach((evt) => {
      btn.addEventListener(evt, (ev) => {
        ev.preventDefault();
        queueDirection(d);
      }, { passive: false });
    });
  });

  // Swipe controls for touch devices.
  let touchStart = null;
  canvas.addEventListener("touchstart", (e) => {
    const t = e.changedTouches[0];
    touchStart = { x: t.clientX, y: t.clientY };
  }, { passive: true });

  canvas.addEventListener("touchend", (e) => {
    if (!touchStart) {
      return;
    }
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    touchStart = null;

    if (Math.abs(dx) < 12 && Math.abs(dy) < 12) {
      return;
    }

    if (Math.abs(dx) > Math.abs(dy)) {
      queueDirection(dx > 0 ? { x: 1, y: 0 } : { x: -1, y: 0 });
    } else {
      queueDirection(dy > 0 ? { x: 0, y: 1 } : { x: 0, y: -1 });
    }
  }, { passive: true });

  // --------------------------- UI Wiring ---------------------------
  startBtn.addEventListener("click", () => {
    ensureAudio();
    initState();
    started = true;
    running = true;
    setStateText("Running");
    beep(440, 80, "triangle", 0.6);
  });

  restartBtn.addEventListener("click", () => {
    initState();
    beep(380, 70, "triangle", 0.5);
  });

  pauseBtn.addEventListener("click", () => {
    togglePause();
  });

  modeSelect.addEventListener("change", () => {
    initState();
  });

  difficultySelect.addEventListener("change", () => {
    initState();
  });

  seedInput.addEventListener("change", () => {
    initState();
  });

  volumeInput.addEventListener("input", () => {
    volume = Number(volumeInput.value);
  });

  sfxBtn.addEventListener("click", () => {
    sfxEnabled = !sfxEnabled;
    sfxBtn.textContent = `SFX: ${sfxEnabled ? "On" : "Off"}`;
  });

  musicBtn.addEventListener("click", () => {
    musicEnabled = !musicEnabled;
    musicBtn.textContent = `Music: ${musicEnabled ? "On" : "Off"}`;
    if (musicEnabled) {
      startMusic();
    } else {
      stopMusic();
    }
  });

  // --------------------------- Tiny Internal Checks ---------------------------
  function runSelfChecks() {
    const a = wrapCell({ x: -1, y: 0 });
    const b = wrapCell({ x: GRID, y: GRID - 1 });
    console.assert(a.x === GRID - 1 && a.y === 0, "wrapCell left edge failed");
    console.assert(b.x === 0 && b.y === GRID - 1, "wrapCell right edge failed");

    const seededA = mulberry32(12345);
    const seededB = mulberry32(12345);
    console.assert(seededA() === seededB(), "seeded RNG consistency failed");
  }

  // --------------------------- Boot ---------------------------
  runSelfChecks();
  initState();
})();
