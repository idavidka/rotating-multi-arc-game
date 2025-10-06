/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useRef, useState } from "react";

type CircleConfig = { rotationSpeed: number; direction: 1 | -1 };

type Config = {
  baseDiameter: number;
  initialBalls: number;
  circleCount: number;
  gapDegrees: number;
  ballsOnEscape: number;
  ballRadius: number;
  ballSpeed: number;
  circleThickness: number;
  circles: CircleConfig[];
};

const defaultConfig: Config = {
  baseDiameter: 400,
  initialBalls: 1,
  circleCount: 3,
  gapDegrees: 40,
  ballsOnEscape: 2,
  ballRadius: 6,
  ballSpeed: 250,
  circleThickness: 10,
  circles: [
    { rotationSpeed: 1.2, direction: 1 },
    { rotationSpeed: 0.8, direction: -1 },
    { rotationSpeed: 1.5, direction: 1 },
  ],
};

export default function App() {
  const [config, setConfig] = useState(defaultConfig);
  const [running, setRunning] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ballsRef = useRef<{ x: number; y: number; vx: number; vy: number; r: number }[]>([]);
  const rotRef = useRef<number[]>([]);
  const lastRef = useRef(performance.now());
  const centerRef = useRef({ x: 0, y: 0 });
  const animRef = useRef<number | undefined>(undefined);
  const spawnIndex = useRef(0);

  // Canvas setup
  const resize = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    centerRef.current = { x: canvas.width / 2, y: canvas.height / 2 };
  };
  useEffect(() => {
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // Utility functions
  const normAngle = (a: number) => {
    a = (a + Math.PI) % (2 * Math.PI);
    if (a < 0) a += 2 * Math.PI;
    return a - Math.PI;
  };

  const isInGap = (px: number, py: number, rot: number, gapDegrees: number) => {
    const { x: cx, y: cy } = centerRef.current;
    const a = Math.atan2(py - cy, px - cx);
    const half = (gapDegrees * Math.PI) / 180 / 2;
    return Math.abs(normAngle(a - rot)) <= half;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const normalizeSpeed = (b: any) => {
    const s = Math.hypot(b.vx, b.vy);
    if (s === 0) return;
    const k = config.ballSpeed / s;
    b.vx *= k;
    b.vy *= k;
  };

  // Ball creation
  const createBallAtCenter = () => {
    const { x: cx, y: cy } = centerRef.current;
    const angle = Math.PI / 2 + (Math.random() - 0.5) * 0.2;
    const vx = Math.cos(angle) * config.ballSpeed;
    const vy = Math.sin(angle) * config.ballSpeed;
    return { x: cx, y: cy, vx, vy, r: config.ballRadius };
  };

  const resetBalls = () => {
    ballsRef.current = [];
    spawnIndex.current = 0;
  };
  useEffect(() => {
    resetBalls();
  }, [config.initialBalls]);

  // Collision helpers
  const collideBalls = (a: any, b: any) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy);
    const minDist = a.r + b.r;
    if (dist < minDist && dist > 0) {
      const nx = dx / dist;
      const ny = dy / dist;
      const overlap = (minDist - dist) / 2;
      a.x -= nx * overlap;
      a.y -= ny * overlap;
      b.x += nx * overlap;
      b.y += ny * overlap;

      const vaDotN = a.vx * nx + a.vy * ny;
      const vbDotN = b.vx * nx + b.vy * ny;
      const vaNewX = a.vx + (vbDotN - vaDotN) * nx;
      const vaNewY = a.vy + (vbDotN - vaDotN) * ny;
      const vbNewX = b.vx + (vaDotN - vbDotN) * nx;
      const vbNewY = b.vy + (vaDotN - vbDotN) * ny;
      a.vx = vaNewX;
      a.vy = vaNewY;
      b.vx = vbNewX;
      b.vy = vbNewY;

      normalizeSpeed(a);
      normalizeSpeed(b);
    }
  };

  const reflectFromCircle = (b: any, nx: number, ny: number) => {
    const dot = b.vx * nx + b.vy * ny;
    b.vx -= 2 * dot * nx;
    b.vy -= 2 * dot * ny;
    normalizeSpeed(b);
  };

  // Main loop
  const loop = (now: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx || !running) return;

    const dt = Math.min(0.033, (now - lastRef.current) / 1000);
    lastRef.current = now;

    const { x: cx, y: cy } = centerRef.current;
    const baseR = config.baseDiameter / 2;
    const spacing = config.ballRadius * 3 * 2;
    const gapRad = (config.gapDegrees * Math.PI) / 180 / 2;
    const halfThickness = config.circleThickness / 2;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    rotRef.current = rotRef.current.length ? rotRef.current : Array(config.circleCount).fill(0);
    const rings: { inner: number; outer: number; rot: number }[] = [];

    for (let i = 0; i < config.circleCount; i++) {
      const circ = config.circles[i] || config.circles[0];
      rotRef.current[i] += circ.rotationSpeed * circ.direction * dt;
      const R = baseR + i * spacing;
      rings.push({ inner: R - halfThickness, outer: R + halfThickness, rot: rotRef.current[i] });

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rotRef.current[i]);
      ctx.beginPath();
      ctx.arc(0, 0, R, gapRad, 2 * Math.PI - gapRad);
      ctx.lineWidth = config.circleThickness;
      ctx.strokeStyle = "#fff";
      ctx.stroke();
      ctx.restore();
    }

    const balls = ballsRef.current;

    // Ball spawn
    if (spawnIndex.current < config.initialBalls) {
      const last = balls[balls.length - 1];
      const distFromCenter = last ? Math.hypot(last.x - cx, last.y - cy) : Infinity;
      if (!last || distFromCenter > config.ballRadius * 2) {
        balls.push(createBallAtCenter());
        spawnIndex.current++;
      }
    }

    // Movement + collisions
    for (const b of balls) {
      const oldX = b.x, oldY = b.y;
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      const dx = b.x - cx;
      const dy = b.y - cy;
      const dist = Math.hypot(dx, dy);
      const nx = dx / dist;
      const ny = dy / dist;

      rings.forEach((ring, ringIndex) => {
        const allowEscape = ringIndex === 0;
        const inGap = isInGap(b.x, b.y, ring.rot, config.gapDegrees);

        // Outer rings are solid; inner ring has an opening
        if (!allowEscape || !inGap) {
          const innerEdge = ring.inner - b.r;
          const outerEdge = ring.outer + b.r;

          if (dist > innerEdge && dist < outerEdge) {
            reflectFromCircle(b, nx, ny);

            if (Math.abs(dist - innerEdge) < Math.abs(dist - outerEdge))
              b.x = cx + nx * (innerEdge - 0.5);
            else
              b.x = cx + nx * (outerEdge + 0.5);

            b.y = cy + ny * (
              Math.abs(dist - innerEdge) < Math.abs(dist - outerEdge)
                ? innerEdge - 0.5
                : outerEdge + 0.5
            );
          }
        }
      });
    }

    // Ball–ball collisions
    for (let i = 0; i < balls.length; i++) {
      for (let j = i + 1; j < balls.length; j++) collideBalls(balls[i], balls[j]);
    }

    // Escape: if ball leaves the canvas → spawn new ones
    for (let i = balls.length - 1; i >= 0; i--) {
      const b = balls[i];
      if (
        b.x < -b.r ||
        b.y < -b.r ||
        b.x > canvas.width + b.r ||
        b.y > canvas.height + b.r
      ) {
        balls.splice(i, 1);
        for (let k = 0; k < config.ballsOnEscape; k++)
          balls.push(createBallAtCenter());
      }
    }

    // Draw balls
    ctx.fillStyle = "#fff";
    for (const b of balls) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }

    animRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    if (running) {
      lastRef.current = performance.now();
      animRef.current = requestAnimationFrame(loop);
    } else if (animRef.current) cancelAnimationFrame(animRef.current);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [running, config]);

  // Config update
  const updateConfig = (key: keyof Config, val: number) =>
    setConfig((c) => ({ ...c, [key]: val }));

  const updateCircle = (index: number, key: keyof CircleConfig, val: number) => {
    setConfig((c) => {
      const circles = [...c.circles];
      circles[index] = { ...circles[index], [key]: val };
      return { ...c, circles };
    });
  };

  // Circle controls
  const addCircle = () =>
    setConfig((c) => ({
      ...c,
      circleCount: c.circleCount + 1,
      circles: [
        ...c.circles,
        { rotationSpeed: 1 + Math.random(), direction: Math.random() > 0.5 ? 1 : -1 },
      ],
    }));

  const removeCircle = () =>
    setConfig((c) => ({
      ...c,
      circleCount: Math.max(1, c.circleCount - 1),
      circles: c.circles.slice(0, -1),
    }));

  // UI
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <canvas ref={canvasRef} style={{ background: "#0a0f0a" }} />

      <fieldset style={{ background: "#111", color: "#ccc", padding: 10, borderRadius: 6 }}>
        <label>Inner circle diameter
          <input type="range" min={200} max={800} step={10}
            value={config.baseDiameter}
            onChange={(e) => updateConfig("baseDiameter", parseFloat(e.target.value))} />
          <span>{config.baseDiameter}</span>
        </label>
        <label>Initial balls
          <input type="range" min={1} max={30} step={1}
            value={config.initialBalls}
            onChange={(e) => updateConfig("initialBalls", parseInt(e.target.value))} />
          <span>{config.initialBalls}</span>
        </label>
        <label>Circle count
          <input type="range" min={1} max={10} step={1}
            value={config.circleCount}
            onChange={(e) => updateConfig("circleCount", parseInt(e.target.value))} />
          <span>{config.circleCount}</span>
        </label>
        <label>Gap (°)
          <input type="range" min={10} max={120} step={2}
            value={config.gapDegrees}
            onChange={(e) => updateConfig("gapDegrees", parseFloat(e.target.value))} />
          <span>{config.gapDegrees}</span>
        </label>
        <label>Balls on escape
          <input type="range" min={0} max={5} step={1}
            value={config.ballsOnEscape}
            onChange={(e) => updateConfig("ballsOnEscape", parseFloat(e.target.value))} />
          <span>{config.ballsOnEscape}</span>
        </label>
        <label>Ball radius
          <input type="range" min={2} max={20} step={1}
            value={config.ballRadius}
            onChange={(e) => updateConfig("ballRadius", parseFloat(e.target.value))} />
          <span>{config.ballRadius}</span>
        </label>
        <label>Ball speed
          <input type="range" min={50} max={600} step={10}
            value={config.ballSpeed}
            onChange={(e) => updateConfig("ballSpeed", parseFloat(e.target.value))} />
          <span>{config.ballSpeed}</span>
        </label>
        <label>Circle thickness
          <input type="range" min={2} max={30} step={1}
            value={config.circleThickness}
            onChange={(e) => updateConfig("circleThickness", parseFloat(e.target.value))} />
          <span>{config.circleThickness}</span>
        </label>
      </fieldset>

      <fieldset style={{ background: "#111", color: "#ccc", width: "min(400px, 90vw)" }}>
        <legend>Circles</legend>
        {Array.from({ length: config.circleCount }).map((_, i) => {
          const circ = config.circles[i] || config.circles[0];
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span>#{i + 1}</span>
              <input type="range" min={0} max={3} step={0.1}
                value={circ.rotationSpeed}
                onChange={(e) => updateCircle(i, "rotationSpeed", parseFloat(e.target.value))} />
              <select value={circ.direction}
                onChange={(e) => updateCircle(i, "direction", parseInt(e.target.value))}>
                <option value={1}>↻</option>
                <option value={-1}>↺</option>
              </select>
              <span>{circ.rotationSpeed.toFixed(1)}</span>
            </div>
          );
        })}
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <button onClick={addCircle} style={{ flex: 1, background: "#2d2", border: "none", borderRadius: 6, padding: 6 }}>+ Add</button>
          <button onClick={removeCircle} style={{ flex: 1, background: "#c33", border: "none", borderRadius: 6, padding: 6, color: "#fff" }}>− Remove</button>
        </div>
      </fieldset>

      <button onClick={() => setRunning((r) => !r)}
        style={{
          marginTop: 6,
          padding: "6px 14px",
          border: "none",
          borderRadius: 6,
          background: running ? "#c33" : "#eee",
          color: running ? "#fff" : "#111",
          fontWeight: 600
        }}>
        {running ? "Stop" : "Start"}
      </button>

      <div style={{ fontSize: 14, opacity: 0.8 }}>Balls: {ballsRef.current.length}</div>
    </div>
  );
}
