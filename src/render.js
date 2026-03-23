(function attachSnakeRender(globalObj) {
  "use strict";

  function createRenderer(options) {
    const ctx = options.ctx;
    const canvas = options.canvas;
    const grid = options.grid;
    const cell = options.cell;

    function drawGrid() {
      ctx.strokeStyle = "#1f3446";
      ctx.lineWidth = 1;
      for (let i = 0; i <= grid; i += 1) {
        const p = i * cell;
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

    function drawCell(c, color, pad) {
      const p = typeof pad === "number" ? pad : 2;
      ctx.fillStyle = color;
      ctx.fillRect(c.x * cell + p, c.y * cell + p, cell - p * 2, cell - p * 2);
    }

    function draw(state) {
      const now = state.now;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#11202f";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      drawGrid();

      if (state.pendingObstacleAdds.length > 0) {
        const remain = Math.max(0, state.levelObstacleActivateAt - now);
        const alpha = 0.2 + 0.35 * (remain / state.levelObstacleGraceMs);
        state.pendingObstacleAdds.forEach((o) => {
          drawCell(o, `rgba(255, 209, 102, ${alpha.toFixed(3)})`, 5);
        });
      }

      state.warningCells.forEach((c) => drawCell(c, "rgba(255, 209, 102, 0.8)", 6));
      state.obstacles.forEach((o) => drawCell(o, "#5f7a8f", 2));

      if (state.food) {
        drawCell(state.food, "#ff6b6b", 2);
      }
      if (state.bonusFood) {
        drawCell(state.bonusFood.cell, "#ffd166", 1);
      }

      const pulse = now < state.eatPulseUntil;
      state.snake.forEach((seg, i) => {
        if (i === 0) {
          drawCell(seg, pulse ? "#48f4e6" : "#20d6c7", pulse ? 1 : 2);
        } else {
          drawCell(seg, "#1fc58d", 2);
        }
      });

      if (!state.started && !state.gameOver) {
        ctx.fillStyle = "rgba(0,0,0,0.28)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#e8f4ff";
        ctx.textAlign = "center";
        ctx.font = "bold 22px Trebuchet MS";
        ctx.fillText("Press Start", canvas.width / 2, canvas.height / 2 - 4);
        ctx.font = "16px Trebuchet MS";
        ctx.fillText("or use arrow keys / WASD", canvas.width / 2, canvas.height / 2 + 24);
      }

      if (state.paused && state.running) {
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#ffd166";
        ctx.textAlign = "center";
        ctx.font = "bold 30px Trebuchet MS";
        ctx.fillText("Paused", canvas.width / 2, canvas.height / 2);
      }
    }

    return {
      draw,
    };
  }

  globalObj.SnakeRender = {
    createRenderer,
  };
})(window);
