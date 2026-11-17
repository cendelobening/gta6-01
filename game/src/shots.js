// Screenshot scenes behind ?shot=start|street|drive|chase. Each scene plays the
// real game forward from a fresh world for a fixed number of steps, steered by
// a small autopilot (walk toward the nearest car, steal it, drive along the
// avenue, or flee the police), so every frame is what real play looks like
// and the same seed always gives the same frame.
import { angleDiff, angleTo, dist } from './random.js';
import { nearestRoadX } from './city.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const SAMPLE = 1 / 30;

/** Drive the player's car toward a point: returns {forward, reverse, steer}. */
function driveToward(world, tx, ty) {
  const car = world.player.car;
  if (!car) return { forward: false, reverse: false, steer: 0 };
  const want = angleTo(car.x, car.y, tx, ty);
  const diff = angleDiff(car.angle, want);
  if (Math.abs(diff) > 2.4) {
    // Facing away: reverse out while turning the nose around.
    return { forward: false, reverse: true, steer: diff > 0 ? -1 : 1 };
  }
  return {
    forward: Math.abs(diff) < 1.4,
    reverse: false,
    steer: diff > 0.12 ? 1 : diff < -0.12 ? -1 : 0,
  };
}

/** A fake input object shaped like the real Input class, for the autopilot. */
function fakeInput() {
  const keys = new Set();
  const pressed = new Set();
  return {
    keys,
    pressed,
    mouseX: 640,
    mouseY: 200,
    mouseDown: false,
    clicked: false,
    down(code) { return keys.has(code); },
    wasPressed(code) { return pressed.has(code); },
    moveVector() {
      let x = 0;
      let y = 0;
      if (keys.has('KeyA')) x -= 1;
      if (keys.has('KeyD')) x += 1;
      if (keys.has('KeyW')) y -= 1;
      if (keys.has('KeyS')) y += 1;
      return { x, y };
    },
    endFrame() { pressed.clear(); },
  };
}

/** Step the world with the autopilot's keys held down. */
function stepWith(world, input, keys, seconds) {
  for (let t = 0; t < seconds; t += SAMPLE) {
    input.keys.clear();
    for (const k of keys) input.keys.add(k);
    world.update(SAMPLE, input, { x: world.player.x - 640, y: world.player.y - 360 });
    input.endFrame();
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * Names: start (title), street (on foot), drive (behind the wheel),
 * chase (wanted, police on the tail). Any other name is start.
 */
export function stageShot(name, world) {
  world.reset();
  const input = fakeInput();
  if (name !== 'street' && name !== 'drive' && name !== 'chase') {
    // Title scene: let traffic and pedestrians move for a few seconds.
    stepWith(world, input, [], 5);
    return { screen: SCREEN_TITLE };
  }

  if (name === 'street') {
    // Walk Jax toward the nearest parked car on the avenue.
    const car = world.cars.find((c) => c.parked);
    const target = car ? { x: car.x, y: car.y } : { x: 1000, y: 1650 };
    for (let t = 0; t < 8; t += SAMPLE) {
      input.keys.clear();
      const dx = target.x - world.player.x;
      const dy = target.y - world.player.y;
      if (dx > 10) input.keys.add('KeyD');
      if (dx < -10) input.keys.add('KeyA');
      if (dy > 10) input.keys.add('KeyS');
      if (dy < -10) input.keys.add('KeyW');
      if (dist(world.player.x, world.player.y, target.x, target.y) < 40) break;
      world.update(SAMPLE, input, { x: world.player.x - 640, y: world.player.y - 360 });
      input.endFrame();
    }
    world.missions.banner = 'JOB 1/5 — FIRST WHEELS: Steal a car (walk up to one and press E)';
    world.missions.bannerTimer = 99;
    return { screen: SCREEN_PLAY };
  }

  // drive + chase: steal the nearest parked car, then drive the avenue.
  const car = world.cars.find((c) => c.parked);
  if (car) {
    world.player.x = car.x - 20;
    world.player.y = car.y;
    world.tryEnterCar();
  }
  if (name === 'chase') {
    world.missions.jobIndex = 3;
    world.missions.stageIndex = 0;
    world.setWanted(3);
    world.missions.banner = 'JOB 4/5 — HEAT WAVE: Survive the police hunt — stay alive';
    world.missions.bannerTimer = 99;
    // A couple of cruisers already on the tail.
    world.spawnPoliceCar();
    world.spawnPoliceCar();
  } else {
    world.missions.banner = 'JOB 1/5 — FIRST WHEELS: Drive to Rico\u2019s Garage';
    world.missions.bannerTimer = 99;
  }
  // Drive the avenue: first reach the nearest road intersection, then cruise
  // east along the road, so the car is always on tarmac, never wedged in a
  // building. Waypoints are road centres by construction.
  const startX = world.player.x;
  const startY = world.player.y;
  const firstRoadX = nearestRoadX(startX);
  const firstRoadY = startY < 1500 ? 1500 : 1800;
  const waypoints = [
    { x: firstRoadX, y: firstRoadY },
    { x: firstRoadX + 600, y: firstRoadY },
    { x: firstRoadX + 1200, y: firstRoadY },
  ];
  let wp = 0;
  for (let t = 0; t < 12; t += SAMPLE) {
    input.keys.clear();
    const target = waypoints[Math.min(wp, waypoints.length - 1)];
    if (dist(world.player.x, world.player.y, target.x, target.y) < 60 && wp < waypoints.length - 1) wp += 1;
    const drive = driveToward(world, target.x, target.y);
    if (drive.forward) input.keys.add('KeyW');
    if (drive.reverse) input.keys.add('KeyS');
    if (drive.steer > 0) input.keys.add('KeyD');
    if (drive.steer < 0) input.keys.add('KeyA');
    if (name === 'chase' && t > 4) input.mouseDown = true;
    world.update(SAMPLE, input, { x: world.player.x - 640, y: world.player.y - 360 });
    input.mouseDown = false;
    input.endFrame();
    // End the scene mid-cruise, while the car is visibly moving: a frame
    // taken after the car has stopped (0 mph) reads as a parked car.
    const speed = Math.abs(world.player.car.speed);
    const moved = dist(world.player.x, world.player.y, startX, startY);
    if (name === 'drive' && moved > 500 && speed > 250) break;
    if (name === 'chase') {
      const nearPolice = world.police.some((c) => dist(c.x, c.y, world.player.x, world.player.y) < 260);
      if (moved > 400 && speed > 200 && nearPolice) break;
    }
  }
  return { screen: SCREEN_PLAY };
}
