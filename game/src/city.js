// The city of Solmar Bay: a seeded grid of roads, blocks, buildings, parks,
// a beach on the west edge and the sea beyond it. Generated once per seed;
// the render module draws from this structure every frame.
import { COLORS, DISTRICTS, LANDMARKS, WORLD } from './config.js';
import { mulberry32, pick, range } from './random.js';

export const ROAD_SPACING = 300;
export const ROAD_WIDTH = 64;

export function roadXs() {
  const xs = [];
  for (let x = 620; x < WORLD.width; x += ROAD_SPACING) xs.push(x);
  return xs;
}

export function roadYs() {
  const ys = [];
  for (let y = 300; y < WORLD.height; y += ROAD_SPACING) ys.push(y);
  return ys;
}

/** Nearest road centre line to a point, used by traffic to stay on roads. */
export function nearestRoadX(x) {
  const xs = roadXs();
  let best = xs[0];
  for (const v of xs) if (Math.abs(v - x) < Math.abs(best - x)) best = v;
  return best;
}

export function nearestRoadY(y) {
  const ys = roadYs();
  let best = ys[0];
  for (const v of ys) if (Math.abs(v - y) < Math.abs(best - y)) best = v;
  return best;
}

export function isOnRoad(x, y) {
  for (const rx of roadXs()) if (Math.abs(x - rx) < ROAD_WIDTH / 2) return true;
  for (const ry of roadYs()) if (Math.abs(y - ry) < ROAD_WIDTH / 2) return true;
  return false;
}

export function isInSea(x, y) {
  return x < 260;
}

export function buildCity(seed) {
  const rng = mulberry32(seed);
  const buildings = [];
  const trees = [];
  const parks = [];

  // Buildings fill the blocks between roads, skipping the beach strip.
  for (let bx = 620; bx < WORLD.width - 120; bx += ROAD_SPACING) {
    for (let by = 300; by < WORLD.height - 120; by += ROAD_SPACING) {
      const roll = rng();
      if (roll < 0.16) {
        // A park with palm trees instead of a building.
        parks.push({ x: bx + 40, y: by + 40, w: ROAD_SPACING - 130, h: ROAD_SPACING - 130 });
        for (let i = 0; i < 7; i += 1) {
          trees.push({ x: bx + 60 + rng() * (ROAD_SPACING - 170), y: by + 60 + rng() * (ROAD_SPACING - 170) });
        }
        continue;
      }
      const count = 1 + Math.floor(rng() * 2);
      for (let i = 0; i < count; i += 1) {
        const w = range(rng, 70, 150);
        const h = range(rng, 60, 130);
        const x = bx + 45 + rng() * (ROAD_SPACING - 130 - w);
        const y = by + 45 + rng() * (ROAD_SPACING - 130 - h);
        buildings.push({
          x, y, w, h,
          roof: pick(rng, COLORS.buildingRoof),
          floors: 1 + Math.floor(rng() * 5),
        });
      }
      if (rng() < 0.7) {
        trees.push({ x: bx + 30 + rng() * 40, y: by + 30 + rng() * 40 });
        trees.push({ x: bx + ROAD_SPACING - 70 + rng() * 40, y: by + ROAD_SPACING - 70 + rng() * 40 });
      }
    }
  }

  // Palm-lined beach promenade along the sea.
  for (let y = 320; y < WORLD.height - 60; y += 90) {
    trees.push({ x: 300 + rng() * 40, y });
  }

  return {
    seed,
    buildings,
    trees,
    parks,
    districts: DISTRICTS,
    landmarks: LANDMARKS,
  };
}

/** True when a circle of radius r at (x, y) overlaps any building. */
export function hitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}
