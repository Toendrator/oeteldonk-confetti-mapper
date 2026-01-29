// oeteldonk-confetti-mapper/components/Simulator.tsx

import React, { useRef, useEffect, useState } from 'react';
import Matter from 'matter-js';
import { Obstacle, SimulationSettings, SimulationStats } from '../types';

interface SimulatorProps {
  imageUrl: string;
  obstacles: Obstacle[];
  settings: SimulationSettings;
  isRecording: boolean;
  autoLoop: boolean;
  clearTrigger: number;
  onRecordingComplete: () => void;
  onStatsUpdate: (stats: SimulationStats) => void;
}

const COLORS = ['#D10000', '#F2F2F2', '#FFD700'];

// --- DETERMINISTIC NOISE FOR WIND FIELD ---
// Simple hash-based noise (replaces Math.random for wind to keep recordings stable)
function pseudoRandom(x: number, y: number, t: number) {
    const dot = x * 12.9898 + y * 78.233 + t * 0.5;
    return Math.sin(dot) * 43758.5453 - Math.floor(Math.sin(dot) * 43758.5453);
}
// 2D Value Noise approx for smoother wind gradients
function noise2D(x: number, y: number, t: number) {
    const ix = Math.floor(x); const iy = Math.floor(y);
    const fx = x - ix; const fy = y - iy;
    const a = pseudoRandom(ix, iy, t);
    const b = pseudoRandom(ix + 1, iy, t);
    const c = pseudoRandom(ix, iy + 1, t);
    const d = pseudoRandom(ix + 1, iy + 1, t);
    const ux = fx * fx * (3.0 - 2.0 * fx);
    const uy = fy * fy * (3.0 - 2.0 * fy);
    return a * (1 - ux) + b * ux + (c - a) * uy * (1 - ux) + (d - b) * ux * uy;
}

// --- TRIG LOOKUP TABLES (Optimization 3) ---
// Precompute sin(2a) and sin^2(a) indexed by dot product |v.n|
// dot(v, n) = sin(alpha) where alpha is angle to plane
const LUT_SIZE = 1000;
const SIN2_LUT = new Float32Array(LUT_SIZE + 1); // sin^2(alpha)
const SIN2A_LUT = new Float32Array(LUT_SIZE + 1); // sin(2*alpha)

for (let i = 0; i <= LUT_SIZE; i++) {
    const dot = i / LUT_SIZE; // range 0 to 1
    // if dot = sin(alpha), then alpha = asin(dot)
    // sin^2(alpha) = dot * dot
    SIN2_LUT[i] = dot * dot;
    // sin(2*alpha) = 2 * sin(alpha) * cos(alpha) = 2 * dot * sqrt(1 - dot^2)
    SIN2A_LUT[i] = 2 * dot * Math.sqrt(Math.max(0, 1 - dot * dot));
}

// Render-Only Particle (Optimization 4)
interface BakedParticle {
    x: number; y: number; angle: number;
    w: number; h: number; color: string;
    opacity: number;
}

interface ConfettiBody extends Matter.Body {
    createdAt: number;
    staticSince?: number;
    area: number; // Precomputed aero area
    renderWidth: number;  // ADDED: Original unrotated width
    renderHeight: number; // ADDED: Original unrotated height
}

const Simulator: React.FC<SimulatorProps> = ({ 
  imageUrl, obstacles, settings, isRecording, autoLoop, clearTrigger, onRecordingComplete, onStatsUpdate 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const frameRef = useRef(0);
  const emissionAccumulator = useRef(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const settingsRef = useRef(settings);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });

  // Separate lists for physics vs rendering (Performance)
  const activeParticles = useRef<Set<ConfettiBody>>(new Set());
  const bakedParticles = useRef<BakedParticle[]>([]);

  useEffect(() => { settingsRef.current = settings; }, [settings]);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setImgSize({ w: img.width, h: img.height });
    img.src = imageUrl;
  }, [imageUrl]);

  // Handle Manual Clear
  useEffect(() => {
    if (engineRef.current && clearTrigger > 0) {
      const { Composite } = Matter;
      // Clear Physics
      activeParticles.current.forEach(b => Composite.remove(engineRef.current!.world, b));
      activeParticles.current.clear();
      // Clear Baked
      bakedParticles.current = [];
    }
  }, [clearTrigger]);

  useEffect(() => {
    if (!canvasRef.current || imgSize.w === 0) return;

    const { Engine, Bodies, Composite, World, Body, Vector, Events } = Matter;
    
    // 1. Setup Engine
    const engine = Engine.create({ 
        enableSleeping: true, 
        gravity: { x: 0, y: settings.gravity, scale: 0.001 } // Explicit gravity scale
    });
    engineRef.current = engine;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: true })!;
    const width = 1920;
    const height = Math.round(1920 * (imgSize.h / imgSize.w));
    canvas.width = width; 
    canvas.height = height;

    // 2. Build World
    const worldObstacles = obstacles.map(obs => Bodies.rectangle(
      (obs.x + obs.width / 2) * width, (obs.y + obs.height / 2) * height,
      obs.width * width, obs.height * height,
      { isStatic: true, label: 'Obstacle', friction: 1.0 }
    ));
    const floor = Bodies.rectangle(width / 2, height + 100, width * 2, 200, { isStatic: true, label: 'Obstacle' });
    Composite.add(engine.world, [...worldObstacles, floor]);

    // 3. Collision Handling (Sticky Logic - Event Driven)
    Events.on(engine, 'collisionStart', (event) => {
        const pairs = event.pairs;
        const cur = settingsRef.current;
        for (let i = 0; i < pairs.length; i++) {
            const pair = pairs[i];
            // Identify Confetti vs Static
            let confetti: ConfettiBody | null = null;
            let other: Matter.Body | null = null;
            
            if (pair.bodyA.label === 'Confetti') { confetti = pair.bodyA as ConfettiBody; other = pair.bodyB; }
            else if (pair.bodyB.label === 'Confetti') { confetti = pair.bodyB as ConfettiBody; other = pair.bodyA; }

            if (confetti && other && (other.isStatic || other.label === 'Stuck')) {
                // STICKY LOGIC
                if (!confetti.isStatic && confetti.speed < cur.collisionStickiness) {
                    // Check surface normal to prefer horizontal stacking
                    const ny = Math.abs(pair.collision.normal.y);
                    // ny > 0.5 means reasonably horizontal surface
                    if (ny > 0.5 || Math.random() < 0.2) {
                        Body.setStatic(confetti, true);
                        confetti.staticSince = frameRef.current;
                        confetti.label = 'Stuck';
                        // Keep in activeParticles for now, but label changed so aero ignores it
                    }
                }
            }
        }
    });

    // 4. Main Simulation Loop
    const renderLoop = () => {
      if (!engineRef.current) return;
      frameRef.current++;
      const frame = frameRef.current;
      const cur = settingsRef.current;

      // Sync Gravity
      engine.gravity.y = cur.gravity;

      // --- A. DIRECTOR MODE ---
      if (isRecording || autoLoop) {
        const LOOP_FRAMES = 1800; 
        const t = frame % LOOP_FRAMES;
        
        if (t < 300) { // Intro
            cur.density = 2; cur.windStrength = 0;
        } else if (t < 1200) { // Build
            const p = (t - 300) / 900;
            cur.density = 2 + p * 18;
            cur.windStrength = Math.sin(t * 0.01) * 5;
        } else if (t < 1600) { // Storm
            cur.density = 0; 
            cur.windStrength = 15; // Blow away
            cur.gravity = 0.05;
        } else { // Kill/Fade
            cur.density = 0;
            // Aggressive cleanup
            activeParticles.current.forEach(p => p.render.opacity = Math.max(0, p.render.opacity - 0.1));
            bakedParticles.current.forEach(p => p.opacity -= 0.1);
        }
      }

      // --- B. EMISSION ---
      if (cur.density > 0) {
        emissionAccumulator.current += 1;
        const interval = 10 / cur.density;
        while (emissionAccumulator.current >= interval) {
            emissionAccumulator.current -= interval;
            const size = cur.particleSize;
            // Variance
            const w = size * (0.8 + Math.random() * 0.4);
            const h = size * (0.5 + Math.random() * 0.4);
            const x = Math.random() * width;
            
            const p = Bodies.rectangle(x, -20, w, h, {
                label: 'Confetti',
                friction: cur.horizontalFriction,
                frictionAir: 0.001, // Minimal base friction, let Aero do the work
                restitution: cur.restitution,
                density: 0.001,
                render: { 
                    fillStyle: COLORS[Math.floor(Math.random() * COLORS.length)],
                    opacity: 1 
                },
                angle: Math.random() * Math.PI * 2
            }) as ConfettiBody;
            
            p.area = (w * h) / 100; // Normalized area factor
            p.createdAt = frame;
            p.renderWidth = w;   // FIXED: Store original width
            p.renderHeight = h;  // FIXED: Store original height
            
            Composite.add(engine.world, p);
            activeParticles.current.add(p);
        }
      }

      // --- C. AERODYNAMICS (Pre-Update) ---
      const windSpeed = cur.windNoiseSpeed;
      const windScale = cur.windNoiseScale;
      const baseWind = cur.windStrength;
      const liftScale = cur.liftMax;
      const dragMin = cur.dragMin;
      const dragRange = cur.dragMax - cur.dragMin;
      
      activeParticles.current.forEach(b => {
          if (b.isStatic || b.label !== 'Confetti') return;

          // 1. Calculate Wind at Body Position (Deterministic)
          // Use seeded noise for reproducibility
          const nx = b.position.x * windScale;
          const ny = b.position.y * windScale;
          const nt = frame * windSpeed;
          
          const noiseVal = noise2D(nx, ny, nt); // -1 to 1 approx
          const wx = baseWind + (noiseVal * 10); // X-axis wind
          const wy = (noise2D(nx + 100, ny, nt) * 5); // Y-axis turbulence

          // 2. Relative Velocity
          const vrx = b.velocity.x - wx;
          const vry = b.velocity.y - wy;
          const vSq = vrx*vrx + vry*vry;
          
          if (vSq < 0.01) return; // Too slow for aero

          // 3. Angle of Attack (Alpha)
          // Normal vector of the plate: (-sin(a), cos(a))
          const sina = Math.sin(b.angle);
          const cosa = Math.cos(b.angle);
          const nx_plate = -sina;
          const ny_plate = cosa;
          
          // Normalize Rel Velocity
          const vLen = Math.sqrt(vSq);
          const vhatx = vrx / vLen;
          const vhaty = vry / vLen;

          // Dot product |v_hat . n_hat| = sin(alpha)
          const dot = Math.abs(vhatx * nx_plate + vhaty * ny_plate);
          const lutIdx = Math.floor(Math.min(dot, 1.0) * LUT_SIZE);

          // Coefficients from LUT
          const sin2Alpha = SIN2A_LUT[lutIdx]; // sin(2a)
          const sinSqAlpha = SIN2_LUT[lutIdx]; // sin^2(a)
          
          const CL = liftScale * sin2Alpha;
          const CD = dragMin + dragRange * sinSqAlpha;

          // 4. Forces
          const qA = 0.5 * cur.aeroScale * b.area * vSq; // Dynamic Pressure * Area
          
          // Drag: Anti-parallel to velocity
          const Fdx = -qA * CD * vhatx;
          const Fdy = -qA * CD * vhaty;

          // Lift: Perpendicular to velocity. Direction depends on orientation.
          // Cross product (v x n) determines 'side'
          const cross = vhatx * ny_plate - vhaty * nx_plate;
          const liftDir = cross > 0 ? 1 : -1;
          
          // Rotate vhat 90 degrees: (-y, x)
          const lx = -vhaty * liftDir;
          const ly = vhatx * liftDir;
          
          const Flx = qA * CL * lx;
          const Fly = qA * CL * ly;

          // Apply Force
          Body.applyForce(b, b.position, { x: Fdx + Flx, y: Fdy + Fly });

          // 5. Aerodynamic Torque (Stall/Align)
          // Torque tends to align plate with flow (stable at 90 deg or 0 deg depending on center of pressure)
          // Simplified: Torque proportional to sin(2a) to maximize at 45 deg
          const torque = cur.torqueStrength * qA * sin2Alpha * (cross > 0 ? 1 : -1) * 0.01;
          
          // Damping
          b.torque = torque - (b.angularVelocity * cur.rotDamping * 100);
      });

      // --- D. STEP PHYSICS ---
      Engine.update(engine, 16.667);

      // --- E. OPTIMIZATION: BAKE STATIC PARTICLES ---
      // Move old static bodies to render-only array to save physics cycles
      const MAX_PHYSICS_BODIES = 1200;
      let staticCount = 0;
      const toRemove: ConfettiBody[] = [];
      
      activeParticles.current.forEach(b => {
          if (b.render.opacity <= 0) {
              toRemove.push(b);
              return;
          }
          if (b.isStatic || b.label === 'Stuck') {
              staticCount++;
              // Erosion (Life limit)
              const age = frame - (b.staticSince || 0);
              if (age > cur.staticThreshold * 60) {
                  b.render.opacity -= (1 / (cur.fadeDuration * 60));
              }

              // Baking (Performance limit)
              if (activeParticles.current.size > MAX_PHYSICS_BODIES && staticCount > 500) {
                  if (age > 60) { // Ensure it's settled
                     // Bake it!
                     bakedParticles.current.push({
                         x: b.position.x, y: b.position.y, angle: b.angle,
                         w: b.renderWidth,  // FIXED: Use stored width
                         h: b.renderHeight, // FIXED: Use stored height
                         color: b.render.fillStyle as string,
                         opacity: b.render.opacity
                     });
                     toRemove.push(b);
                  }
              }
          }
      });
      
      toRemove.forEach(b => {
          Composite.remove(engine.world, b);
          activeParticles.current.delete(b);
      });

      // --- F. RENDER ---
      ctx.clearRect(0, 0, width, height);

      // Shadows
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 5;

      // Draw Baked
      bakedParticles.current.forEach(p => {
          if (p.opacity <= 0) return;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.angle);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.opacity;
          ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
          ctx.restore();
      });

      // Draw Active
      activeParticles.current.forEach(b => {
          ctx.save();
          ctx.translate(b.position.x, b.position.y);
          ctx.rotate(b.angle);
          ctx.fillStyle = b.render.fillStyle as string;
          ctx.globalAlpha = b.render.opacity;
          // FIXED: Use stored dimensions instead of calculating from bounds
          const w = b.renderWidth; 
          const h = b.renderHeight;
          ctx.fillRect(-w/2, -h/2, w, h);
          ctx.restore();
      });

      // Stats
      if (frame % 20 === 0) {
          onStatsUpdate({
              fps: 60,
              totalParticles: activeParticles.current.size + bakedParticles.current.length,
              activeParticles: activeParticles.current.size - staticCount,
              staticParticles: staticCount + bakedParticles.current.length
          });
      }

      requestRef.current = requestAnimationFrame(renderLoop);
    };

    const requestRef = { current: requestAnimationFrame(renderLoop) };
    return () => {
      cancelAnimationFrame(requestRef.current);
      Engine.clear(engine);
    };
  }, [imgSize, obstacles]);

  // Recording Logic (VP9)
  useEffect(() => {
    if (isRecording && canvasRef.current) {
      frameRef.current = 0;
      const stream = canvasRef.current.captureStream(60);
      const recorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 15000000 
      });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `oeteldonk-aero-${Date.now()}.webm`;
        a.click();
        onRecordingComplete();
      };
      recorder.start();
      recorderRef.current = recorder;
      setTimeout(() => recorder.state === 'recording' && recorder.stop(), 30000); // 30s exact
    }
  }, [isRecording]);

  return (
    <div className="relative max-w-full max-h-full overflow-hidden rounded-lg bg-transparent" style={{ aspectRatio: `${imgSize.w}/${imgSize.h}` }}>
      {!isRecording && <img src={imageUrl} alt="Wall" className="absolute inset-0 block w-full h-full opacity-20 grayscale pointer-events-none" />}
      <canvas ref={canvasRef} className="relative block w-full h-full z-10" />
    </div>
  );
};

export default Simulator;
