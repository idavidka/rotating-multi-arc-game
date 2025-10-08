/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";

type CircleConfig = { rotationSpeed: number; direction: 1 | -1; gapDegrees: number, angle: number };

type Config = {
  baseDiameter: number;
  initialBalls: number;
  circleCount: number;
  gapDegrees: number;
  ballsOnEscape: number;
  ballRadius: number;
  ballSpeed: number;
  circleThickness: number;
  kickStrength: number;
  circles: CircleConfig[];
  mode: '2D' | '3D';
};

const defaultConfig: Config = {
  baseDiameter: 400,
  initialBalls: 2,
  circleCount: 3,
  gapDegrees: 40,
  ballsOnEscape: 2,
  ballRadius: 6,
  ballSpeed: 250,
  circleThickness: 10,
  kickStrength: 0.6,
  circles: [
    { rotationSpeed: 1.2, direction: 1, gapDegrees: 40, angle: 60 },
    { rotationSpeed: 0.8, direction: -1, gapDegrees: 40, angle: 60 },
    { rotationSpeed: 1.5, direction: 1, gapDegrees: 40, angle: 60, },
  ],
  mode: '2D',
};

export default function App() {
  const [config, setConfig] = useState(defaultConfig);
  const [running, setRunning] = useState(true);
  const [rotationEnabled, setRotationEnabled] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ballsRef = useRef<{ x: number; y: number; vx: number; vy: number; r: number }[]>([]);
  const rotRef = useRef<number[]>([]);
  const lastRef = useRef(performance.now());
  const centerRef = useRef({ x: 0, y: 0 });
  const animRef = useRef<number | undefined>(undefined);
  const spawnQueue = useRef(0);
  const spawnCooldown = useRef(0);
  const canvasSize = useRef(0);

  // --- Compute required canvas size based on largest circle ---
  const computeCanvasSize = () => {
    const spacing = config.ballRadius * 5 * 2;
    const largestRadius =
      config.baseDiameter / 2 +
      (9) * spacing +
      config.circleThickness / 2;
    const margin = 50;
    return Math.ceil(largestRadius * 2 + margin);
  };

  const resize = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const size = computeCanvasSize();
    canvas.width = size;
    canvas.height = size;
    canvasSize.current = size;
    centerRef.current = { x: size / 2, y: size / 2 };
  };

  useEffect(() => {
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [config]);

  // --- Utility ---
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

  const normalizeSpeed = (b: any) => {
    const s = Math.hypot(b.vx, b.vy);
    if (s === 0) return;
    const k = config.ballSpeed / s;
    b.vx *= k;
    b.vy *= k;
  };

  const createBallAtCenter = () => {
    const { x: cx, y: cy } = centerRef.current;
    return { x: cx, y: cy, vx: 0, vy: config.ballSpeed, r: config.ballRadius };
  };

  const resetBalls = () => {
    ballsRef.current = [];
    spawnQueue.current = 0;
    spawnCooldown.current = 0;
  };

  const reflectFromCircle = (
    b: any,
    nx: number,
    ny: number,
    dist: number,
    ring: { inner: number; outer: number; rot: number },
    ringAngularSpeed: number,
    kickStrength: number
  ) => {
    const innerDiff = Math.abs(dist - ring.inner);
    const outerDiff = Math.abs(dist - ring.outer);
    const isInner = innerDiff < outerDiff;
    const normalX = isInner ? -nx : nx;
    const normalY = isInner ? -ny : ny;
    const tx = -normalY;
    const ty = normalX;

    const tangentSpeed = ringAngularSpeed * dist;
    const surfaceVx = tx * tangentSpeed;
    const surfaceVy = ty * tangentSpeed;

    let rvx = b.vx - surfaceVx;
    let rvy = b.vy - surfaceVy;
    const dot = rvx * normalX + rvy * normalY;
    if (dot > 0) return;

    rvx -= 2 * dot * normalX;
    rvy -= 2 * dot * normalY;

    b.vx = rvx + surfaceVx;
    b.vy = rvy + surfaceVy;

    // kis "kick" a forgás miatt
    b.vx += tx * tangentSpeed * kickStrength * 0.5;
    b.vy += ty * tangentSpeed * kickStrength * 0.5;

    normalizeSpeed(b);
  };

  const checkGapEdgeCollision = (
    b: any,
    ring: { inner: number; outer: number; rot: number },
    gapDegrees: number,
    ringAngularSpeed: number
  ) => {
    const { x: cx, y: cy } = centerRef.current;
    const dx = b.x - cx;
    const dy = b.y - cy;
    const dist = Math.hypot(dx, dy);

    // Check if ball is within the radial range of this ring
    if (dist < ring.inner - b.r || dist > ring.outer + b.r) return false;

    const gapHalfAngle = (gapDegrees * Math.PI) / 180 / 2;

    // Calculate the two gap edge angles
    const leftEdgeAngle = ring.rot - gapHalfAngle;
    const rightEdgeAngle = ring.rot + gapHalfAngle;

    // For each edge, we need to check if the ball is close to the line segment
    // that forms the edge (from inner radius to outer radius at that angle)

    const checkEdge = (edgeAngle: number) => {
      // Calculate the edge line endpoints
      const innerX = cx + ring.inner * Math.cos(edgeAngle);
      const innerY = cy + ring.inner * Math.sin(edgeAngle);
      const outerX = cx + ring.outer * Math.cos(edgeAngle);
      const outerY = cy + ring.outer * Math.sin(edgeAngle);

      // Vector from inner to outer point
      const edgeVx = outerX - innerX;
      const edgeVy = outerY - innerY;
      const edgeLength = Math.hypot(edgeVx, edgeVy);

      // Normalized edge vector
      const edgeDx = edgeVx / edgeLength;
      const edgeDy = edgeVy / edgeLength;

      // Vector from inner point to ball
      const toBallX = b.x - innerX;
      const toBallY = b.y - innerY;

      // Project ball position onto edge line
      const t = Math.max(0, Math.min(edgeLength, toBallX * edgeDx + toBallY * edgeDy));

      // Closest point on edge to ball
      const closestX = innerX + edgeDx * t;
      const closestY = innerY + edgeDy * t;

      // Distance from ball to edge
      const distToEdge = Math.hypot(b.x - closestX, b.y - closestY);

      // Check if ball is colliding with edge
      if (distToEdge < b.r) {
        // Normal from edge to ball
        const normalX = (b.x - closestX) / distToEdge;
        const normalY = (b.y - closestY) / distToEdge;

        // Check if ball is approaching the edge
        const velDotNormal = b.vx * normalX + b.vy * normalY;
        if (velDotNormal < 0) {
          // Reflect velocity
          b.vx -= 2 * velDotNormal * normalX;
          b.vy -= 2 * velDotNormal * normalY;

          // Add surface velocity from rotation
          const tangentSpeed = ringAngularSpeed * dist;
          const tx = -normalY;
          const ty = normalX;
          const kickStrength = 0.3;
          b.vx += tx * tangentSpeed * kickStrength;
          b.vy += ty * tangentSpeed * kickStrength;

          normalizeSpeed(b);

          // Push ball out of edge
          const overlap = b.r - distToEdge;
          b.x += normalX * overlap;
          b.y += normalY * overlap;

          return true;
        }
      }
      return false;
    };

    // Check both edges
    if (checkEdge(leftEdgeAngle)) return true;
    if (checkEdge(rightEdgeAngle)) return true;

    return false;
  };

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

  const restartSimulation = () => {
    resetBalls();
    rotRef.current = [];
    setRunning(true);
  };

  // --- Main loop ---
  const loop = (now: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx || !running) return;

    const dt = Math.min(0.033, (now - lastRef.current) / 1000);
    lastRef.current = now;

    const { x: cx, y: cy } = centerRef.current;
    const size = canvasSize.current;
    const spacing = config.ballRadius * 5 * 2;
    const baseR = config.baseDiameter / 2;
    const halfThickness = config.circleThickness / 2;

    ctx.clearRect(0, 0, size, size);

    rotRef.current = rotRef.current.length ? rotRef.current : Array(config.circleCount).fill(0);
    const rings: { inner: number; outer: number; rot: number }[] = [];

    for (let i = 0; i < config.circleCount; i++) {
      const circ = config.circles[i] || config.circles[0];
      if (rotationEnabled) rotRef.current[i] += circ.rotationSpeed * circ.direction * dt;
      const R = baseR + i * spacing;
      rings.push({ inner: R - halfThickness, outer: R + halfThickness, rot: rotRef.current[i] });

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rotRef.current[i]);

      if (config.mode === '2D') {
        // Original 2D rendering
        ctx.beginPath();
        const circGapRad = (circ.gapDegrees * Math.PI) / 180 / 2;
        ctx.arc(0, 0, R, circGapRad, 2 * Math.PI - circGapRad);
        ctx.lineWidth = config.circleThickness;
        ctx.strokeStyle = "#fff";
        ctx.stroke();
      } else {
        // 3D rendering: draw the circle as an ellipse based on the tilt angle
        const tiltAngle = circ.angle;
        const tiltRad = (tiltAngle * Math.PI) / 180;
        const circGapRad = (circ.gapDegrees * Math.PI) / 180 / 2;

        // Calculate ellipse parameters
        const radiusY = R * Math.cos(tiltRad); // vertical radius scales with cos(angle)

        ctx.beginPath();
        ctx.ellipse(0, 0, R, radiusY, 0, circGapRad, 2 * Math.PI - circGapRad);
        ctx.lineWidth = config.circleThickness;
        ctx.strokeStyle = "#fff";
        ctx.stroke();
      }

      ctx.restore();
    }

    const balls = ballsRef.current;

    // Sequential spawn
    if (spawnCooldown.current <= 0 && spawnQueue.current > 0) {
      const last = balls[balls.length - 1];
      const lastDist = last ? Math.abs(last.y - cy) : Infinity;
      if (!last || lastDist > config.ballRadius * 2) {
        balls.push(createBallAtCenter());
        spawnQueue.current--;
        spawnCooldown.current = 0.05;
      }
    } else spawnCooldown.current -= dt;

    if (balls.length < config.initialBalls && spawnQueue.current === 0)
      spawnQueue.current = config.initialBalls - balls.length;

    // Movement + collisions
    for (const b of balls) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      const dx = b.x - cx;
      const dy = b.y - cy;
      const dist = Math.hypot(dx, dy);
      const nx = dx / dist;
      const ny = dy / dist;

      rings.forEach((ring, ringIndex) => {
        const circ = config.circles[ringIndex] || config.circles[0];
        const angularSpeed = rotationEnabled ? circ.rotationSpeed * circ.direction : 0;
        const inGap = isInGap(b.x, b.y, ring.rot, circ.gapDegrees);
        if (!inGap) {
          const innerEdge = ring.inner - b.r;
          const outerEdge = ring.outer + b.r;
          if (dist > innerEdge && dist < outerEdge) {
            reflectFromCircle(b, nx, ny, dist, ring, angularSpeed, config.kickStrength);
            const target =
              Math.abs(dist - innerEdge) < Math.abs(dist - outerEdge)
                ? innerEdge - 0.5
                : outerEdge + 0.5;
            b.x = cx + nx * target;
            b.y = cy + ny * target;
          }
        } else {
          // Check for collision with gap edges
          checkGapEdgeCollision(b, ring, circ.gapDegrees, angularSpeed);
        }
      });
    }

    // Ball collisions
    for (let i = 0; i < balls.length; i++)
      for (let j = i + 1; j < balls.length; j++) collideBalls(balls[i], balls[j]);

    // Escape + respawn
    for (let i = balls.length - 1; i >= 0; i--) {
      const b = balls[i];
      if (b.x < -b.r || b.y < -b.r || b.x > size + b.r || b.y > size + b.r) {
        balls.splice(i, 1);
        spawnQueue.current += config.ballsOnEscape;
      }
    }

    // Draw balls
    ctx.fillStyle = "#fff";
    for (const b of balls) {
      ctx.beginPath();
      if (config.mode === '2D') {
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      } else {
        // In 3D mode, calculate average tilt angle for ball rendering
        let avgTiltAngle = 0;
        rings.forEach((_, ringIndex) => {
          const circ = config.circles[ringIndex] || config.circles[0];
          avgTiltAngle += circ.angle;
        });
        avgTiltAngle /= rings.length;

        const tiltRad = (avgTiltAngle * Math.PI) / 180;
        const radiusY = b.r * Math.cos(tiltRad);

        // Draw ball as ellipse in 3D mode
        ctx.ellipse(b.x, b.y, b.r, radiusY, 0, 0, Math.PI * 2);
      }
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
  }, [running, config, rotationEnabled]);

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
        { rotationSpeed: 1 + Math.random(), direction: Math.random() > 0.5 ? 1 : -1, angle: 60, gapDegrees: c.gapDegrees },
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
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: "100%", maxWidth: "100vw", boxSizing: "border-box" }}>
      <canvas ref={canvasRef} style={{ background: "#0a0f0a", maxWidth: "100%", maxHeight: "calc(100vh - 300px)", height: "auto", width: "auto", display: "block" }} />

      <fieldset style={{ display: "flex", flexDirection: "row", gap: 10, flexWrap: "wrap", background: "#111", color: "#ccc", padding: 10, borderRadius: 6, maxWidth: "100%", boxSizing: "border-box" }}>
        <label>Mode
          <select
            value={config.mode}
            onChange={(e) => setConfig((c) => ({ ...c, mode: e.target.value as '2D' | '3D' }))}>
            <option value="2D">2D</option>
            <option value="3D">3D</option>
          </select>
        </label>
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
        {/* <label>Gap (°)
          <input type="range" min={10} max={120} step={2}
            value={config.gapDegrees}
            onChange={(e) => updateConfig("gapDegrees", parseFloat(e.target.value))} />
          <span>{config.gapDegrees}</span>
        </label> */}
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
        <label>Kick strength
          <input type="range" min={0} max={2} step={0.1}
            value={config.kickStrength}
            onChange={(e) => updateConfig("kickStrength", parseFloat(e.target.value))} />
          <span>{config.kickStrength.toFixed(1)}</span>
        </label>
      </fieldset>

      <fieldset style={{ background: "#111", color: "#ccc", width: "min(400px, calc(100vw - 2rem))", boxSizing: "border-box" }}>
        <legend>Circles</legend>
        {Array.from({ length: config.circleCount }).map((_, i) => {
          const circ = config.circles[i] || config.circles[0];
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8, padding: 6, background: "#1a1a1a", borderRadius: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontWeight: 600 }}>#{i + 1}</span>
                <span style={{ fontSize: 12, opacity: 0.7 }}>Speed:</span>
                <input type="range" min={0} max={3} step={0.1}
                  value={circ.rotationSpeed}
                  onChange={(e) => updateCircle(i, "rotationSpeed", parseFloat(e.target.value))} />
                <select value={circ.direction}
                  onChange={(e) => updateCircle(i, "direction", parseInt(e.target.value))}>
                  <option value={1}>↻</option>
                  <option value={-1}>↺</option>
                </select>
                <span>{circ.rotationSpeed?.toFixed(1) || ''}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.7 }}>Gap:</span>
                <input type="range" min={10} max={120} step={2} style={{ flex: 1 }}
                  value={circ.gapDegrees}
                  onChange={(e) => updateCircle(i, "gapDegrees", parseFloat(e.target.value))} />
                <span style={{ width: 30 }}>{circ.gapDegrees}°</span>
              </div>
              {config.mode === '3D' && (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 12, opacity: 0.7 }}>Angle:</span>
                  <input type="range" min={0} max={90} step={5}
                    value={circ.angle}
                    onChange={(e) => updateCircle(i, "angle", parseFloat(e.target.value))}
                    style={{ flex: 1 }} />
                  <span>{circ.angle}°</span>
                </div>
              )}
            </div >
          );
        })}
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <button onClick={addCircle} style={{ flex: 1, background: "#2d2", border: "none", borderRadius: 6, padding: 6 }}>+ Add</button>
          <button onClick={removeCircle} style={{ flex: 1, background: "#c33", border: "none", borderRadius: 6, padding: 6, color: "#fff" }}>− Remove</button>
        </div>
      </fieldset >


      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => setRunning((r) => !r)}
          style={{
            padding: "6px 14px",
            border: "none",
            borderRadius: 6,
            background: running ? "#c33" : "#eee",
            color: running ? "#fff" : "#111",
            fontWeight: 600,
          }}
        >
          {running ? "Stop" : "Start"}
        </button>

        <button
          onClick={() => setRotationEnabled((v) => !v)}
          style={{
            padding: "6px 14px",
            border: "none",
            borderRadius: 6,
            background: rotationEnabled ? "#39f" : "#999",
            color: "#fff",
            fontWeight: 600,
          }}
        >
          {rotationEnabled ? "Stop Rotation" : "Start Rotation"}
        </button>

        <button
          onClick={restartSimulation}
          style={{
            padding: "6px 14px",
            border: "none",
            borderRadius: 6,
            background: "#3a8",
            color: "#fff",
            fontWeight: 600,
          }}
        >
          Restart
        </button>
      </div>

      <div style={{ fontSize: 14, opacity: 0.8 }}>Canvas: {canvasSize.current}px</div>
      <div style={{ fontSize: 14, opacity: 0.8 }}>Balls: {ballsRef.current.length}</div>
    </div >
  );
}
