
// oeteldonk-confetti-mapper/types.ts

export interface Obstacle {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SimulationSettings {
  // Emissie & Formaat
  density: number;
  particleSize: number;
  
  // Aerodynamics (New Evidence-Based Model)
  gravity: number;
  aeroScale: number;      // Global force multiplier
  liftMax: number;        // C_L peak
  dragMin: number;        // C_D min (edge-on)
  dragMax: number;        // C_D max (face-on)
  torqueStrength: number; // Aero torque magnitude
  rotDamping: number;     // Angular drag
  windStrength: number;   // Base wind speed
  windNoiseSpeed: number; // How fast gusts change
  windNoiseScale: number; // Size of wind swirls
  
  // Sticky Physics
  collisionStickiness: number;
  horizontalFriction: number;
  restitution: number; 
  
  // Lifecycle
  staticThreshold: number;
  fadeDuration: number;
}

export interface SimulationStats {
  fps: number;
  totalParticles: number;
  activeParticles: number;
  staticParticles: number;
}

export enum AppMode {
  SETUP = 'SETUP',
  SIMULATE = 'SIMULATE'
}
