import { EasingType, BezierControlPoints, Vector2, Transform } from './types';

/**
 * Easing functions for animation interpolation
 */
export function easeLinear(t: number): number {
  return t;
}

export function easeIn(t: number): number {
  return t * t * t;
}

export function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function cubicBezier(t: number, cp1: Vector2, cp2: Vector2): number {
  // Simplified cubic bezier for easing
  const cx = 3 * cp1.x;
  const bx = 3 * (cp2.x - cp1.x) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * cp1.y;
  const by = 3 * (cp2.y - cp1.y) - cy;
  const ay = 1 - cy - by;

  // Find t for x using Newton's method
  let tGuess = t;
  for (let i = 0; i < 8; i++) {
    const xGuess = ((ax * tGuess + bx) * tGuess + cx) * tGuess;
    const xSlope = (3 * ax * tGuess + 2 * bx) * tGuess + cx;
    if (Math.abs(xSlope) < 1e-6) break;
    tGuess -= (xGuess - t) / xSlope;
  }

  return ((ay * tGuess + by) * tGuess + cy) * tGuess;
}

export function getEasingValue(t: number, easingType: EasingType, bezierPoints?: BezierControlPoints): number {
  switch (easingType) {
    case 'linear':
      return easeLinear(t);
    case 'easeIn':
      return easeIn(t);
    case 'easeOut':
      return easeOut(t);
    case 'easeInOut':
      return easeInOut(t);
    case 'bezier':
      if (bezierPoints) {
        return cubicBezier(t, bezierPoints.cp1, bezierPoints.cp2);
      }
      return easeLinear(t);
    default:
      return easeLinear(t);
  }
}

/**
 * Interpolate between two values
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Interpolate between two vectors
 */
export function lerpVector(a: Vector2, b: Vector2, t: number): Vector2 {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
  };
}

/**
 * Interpolate between two transforms
 */
export function lerpTransform(a: Transform, b: Transform, t: number): Transform {
  return {
    position: lerpVector(a.position, b.position, t),
    rotation: lerp(a.rotation, b.rotation, t),
    scale: lerpVector(a.scale, b.scale, t),
  };
}

/**
 * Get default transform
 */
export function getDefaultTransform(): Transform {
  return {
    position: { x: 0, y: 0 },
    rotation: 0,
    scale: { x: 1, y: 1 },
  };
}
