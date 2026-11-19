// The living world: the player on foot or in a car, traffic, pedestrians,
// police and the wanted level, bullets, particles and the save file.
import { CAR, COLORS, MISSIONS, PLAYER, POLICE, SAVE_KEY, WORLD } from './config.js';
import { buildCity, hitsBuilding, isInSea, isOnRoad, nearestRoadX, nearestRoadY } from './city.js';
import { angleDiff, angleTo, clamp, dist, mulberry32, pick, range } from './random.js';
import { MissionRunner } from './missions.js';

let nextId = 1;

function makeCar(rng, x, y, angle, opts = {}) {
  return {
    id: nextId++,
    x, y, angle,
    speed: opts.speed ?? 0,
    color: opts.color ?? pick(rng, COLORS.car),
    police: opts.police ?? false,
    parked: opts.parked ?? false,
    driver: opts.driver ?? true,
    health: 100,
    honkTimer: 0,
    targetSpeed: opts.targetSpeed ?? range(rng, 90, 170),
    lane: opts.lane ?? 0,
    vertical: opts.vertical ?? false,
    stuckTimer: 0,
  };
}

export class World {
  constructor(seed, audio) {
    this.seed = seed;
    this.rng = mulberry32(seed);
    this.audio = audio;
    this.city = buildCity(seed);
    this.missions = new MissionRunner();
    this.time = 0;
    this.money = 0;
    this.kills = 0;
    this.carsStolen = 0;
    this.reset();
  }

  reset() {
    this.player = {
      x: 940, y: 1650, angle: -Math.PI / 2,
      vx: 0, vy: 0,
      health: PLAYER.health,
      car: null,
      shootTimer: 0,
      aimAngle: 0,
      dead: false,
      speed: 0,
    };
    this.cars = [];
    this.peds = [];
    this.police = [];
    this.bullets = [];
    this.particles = [];
    this.wanted = 0;
    this.wantedTimer = 0;
    this.policeTimer = 0;
    this.spawnTimer = 0;
    this.time = 0;
    this.money = 0;
    this.kills = 0;
    this.carsStolen = 0;
    this.missions.reset();
    this.spawnTraffic();
    this.spawnParkedCars();
    this.spawnPeds();
  }

  // ---- spawning ------------------------------------------------------------
  spawnTraffic() {
    const rng = this.rng;
    // Denser streets (v3): 35 ambient cars, ~35% up from the original 26.
    // Spawning still draws only from the seeded rng, in the same order of
    // picks per car, so a given seed always builds the same city traffic.
    for (let i = 0; i < 35; i += 1) {
      const vertical = rng() < 0.5;
      const road = vertical ? pick(rng, [620, 920, 1220, 1520, 1820, 2120, 2420, 2720, 3020, 3320])
        : pick(rng, [300, 600, 900, 1200, 1500, 1800, 2100, 2400]);
      const along = range(rng, 300, WORLD.height - 100);
      const car = vertical
        ? makeCar(rng, road + (rng() < 0.5 ? -16 : 16), along, rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2, { vertical: true })
        : makeCar(rng, along, road + (rng() < 0.5 ? -16 : 16), rng() < 0.5 ? 0 : Math.PI, { vertical: false });
      car.speed = car.targetSpeed;
      this.cars.push(car);
    }
  }

  spawnParkedCars() {
    const rng = this.rng;
    // Parked cars sit on road edges (26 px off a road centre line, facing
    // along the road) so a stolen car can pull straight onto the avenue
    // instead of nosing into the nearest building.
    const spots = [
      [946, 1680, -Math.PI / 2], [894, 1740, Math.PI / 2],
      [1500, 1226, 0], [1220, 1474, Math.PI],
      [2120, 926, 0], [2420, 1226, Math.PI],
      [1820, 2126, 0], [3020, 926, Math.PI],
      [620, 2126, 0], [2720, 1826, Math.PI / 2],
      [946, 2050, -Math.PI / 2], [3320, 1526, 0],
      // Four extra spots (v3, ~+33% parked density), each 26 px off a road
      // centre line like the originals so they clear buildings the same way.
      [946, 926, -Math.PI / 2], [1546, 1526, Math.PI / 2],
      [2426, 626, Math.PI / 2], [3326, 926, Math.PI / 2],
    ];
    // A parked car must sit on open ground: nudge the spot until it clears
    // every building (a car inside a wall can never be stolen or driven).
    const nudges = [[0, 0], [0, 50], [0, -50], [50, 0], [-50, 0], [0, 100], [0, -100], [100, 0], [-100, 0]];
    for (const [sx, sy, angle] of spots) {
      let placed = null;
      for (const [dx, dy] of nudges) {
        const x = sx + dx;
        const y = sy + dy;
        if (!isInSea(x, y) && !hitsBuilding(this.city, x, y, 26)) {
          placed = { x, y };
          break;
        }
      }
      if (!placed) continue;
      this.cars.push(makeCar(rng, placed.x, placed.y, angle, { parked: true, speed: 0, driver: false }));
    }
  }

  spawnPeds() {
    const rng = this.rng;
    // Denser sidewalks (v3): 56 pedestrians, up from 42 (~+33%).
    for (let i = 0; i < 56; i += 1) {
      const x = range(rng, 300, WORLD.width - 100);
      const y = range(rng, 320, WORLD.height - 100);
      if (isInSea(x, y) || isOnRoad(x, y)) continue;
      this.peds.push({
        id: nextId++,
        x, y,
        angle: rng() * Math.PI * 2,
        speed: range(rng, 28, 55),
        color: pick(rng, COLORS.ped),
        panic: 0,
        walkPhase: rng() * 10,
      });
    }
  }

  spawnPoliceCar() {
    const rng = this.rng;
    const angle = rng() * Math.PI * 2;
    const px = this.player.x + Math.cos(angle) * POLICE.spawnDistance;
    const py = this.player.y + Math.sin(angle) * POLICE.spawnDistance;
    const x = clamp(px, 300, WORLD.width - 60);
    const y = clamp(py, 320, WORLD.height - 60);
    const car = makeCar(rng, x, y, angleTo(x, y, this.player.x, this.player.y), {
      police: true, color: COLORS.policeCar, speed: 120,
    });
    this.police.push(car);
    this.cars.push(car);
  }

  // ---- wanted level --------------------------------------------------------
  setWanted(level) {
    if (level > this.wanted) {
      this.wanted = level;
      this.wantedTimer = 0;
    }
  }

  raiseWanted(amount) {
    this.setWanted(Math.min(5, this.wanted + amount));
  }

  // ---- entering / exiting cars ---------------------------------------------
  nearestCar(maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const car of this.cars) {
      if (car.police) continue;
      const d = dist(this.player.x, this.player.y, car.x, car.y);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  tryEnterCar() {
    if (this.player.car) {
      // Get out: step beside the car.
      const car = this.player.car;
      const side = car.angle + Math.PI / 2;
      this.player.x = car.x + Math.cos(side) * 30;
      this.player.y = car.y + Math.sin(side) * 30;
      this.player.angle = car.angle;
      this.player.car = null;
      return;
    }
    const car = this.nearestCar(60);
    if (!car) return;
    this.player.car = car;
    car.parked = false;
    car.driver = true;
    if (!car.stolen) {
      car.stolen = true;
      this.carsStolen += 1;
      // Stealing in plain sight of the law draws heat.
      if (this.police.length > 0 || this.wanted > 0) this.raiseWanted(1);
      else if (this.rng() < 0.35) this.raiseWanted(1);
    }
    this.audio.blip(440, 0.1, 'square', 0.08);
  }

  // ---- shooting ------------------------------------------------------------
  shoot(targetX, targetY) {
    const p = this.player;
    if (p.shootTimer > 0 || p.dead) return;
    p.shootTimer = PLAYER.shootCooldown;
    p.aimAngle = angleTo(p.x, p.y, targetX, targetY);
    const bx = p.x + Math.cos(p.aimAngle) * 20;
    const by = p.y + Math.sin(p.aimAngle) * 20;
    this.bullets.push({
      x: bx, y: by,
      vx: Math.cos(p.aimAngle) * PLAYER.bulletSpeed,
      vy: Math.sin(p.aimAngle) * PLAYER.bulletSpeed,
      life: 0.9,
    });
    this.audio.gunshot();
    this.raiseWanted(1);
    this.burst(bx, by, '#ffd94d', 4);
  }

  burst(x, y, color, n) {
    for (let i = 0; i < n; i += 1) {
      const a = this.rng() * Math.PI * 2;
      const s = range(this.rng, 40, 160);
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.4, color });
    }
  }

  // ---- per-frame update ----------------------------------------------------
  update(dt, input, camera) {
    this.time += dt;
    const p = this.player;
    if (p.dead) return;
    if (p.shootTimer > 0) p.shootTimer -= dt;

    // Enter / exit car.
    if (input.wasPressed('KeyE')) this.tryEnterCar();

    if (p.car) this.updateDriving(dt, input);
    else this.updateOnFoot(dt, input, camera);

    // Shooting (on foot, or leaning out of the window while driving).
    if (input.mouseDown || input.clicked) {
      const wx = camera.x + input.mouseX;
      const wy = camera.y + input.mouseY;
      this.shoot(wx, wy);
    }

    this.updateTraffic(dt);
    this.updatePeds(dt);
    this.updatePolice(dt);
    this.updateBullets(dt);
    this.updateParticles(dt);
    this.updateWanted(dt);
    this.missions.update(dt, this);

    if (p.health <= 0) {
      p.dead = true;
      this.burst(p.x, p.y, '#ff4d4d', 24);
      this.audio.crash();
    }
    // Keep the player inside the world.
    p.x = clamp(p.x, 280, WORLD.width - 40);
    p.y = clamp(p.y, 300, WORLD.height - 40);
  }

  updateOnFoot(dt, input) {
    const p = this.player;
    const mv = input.moveVector();
    const running = input.down('ShiftLeft') || input.down('ShiftRight');
    const speed = running ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const nx = p.x + mv.x * speed * dt;
    const ny = p.y + mv.y * speed * dt;
    if (!hitsBuilding(this.city, nx, p.y, PLAYER.radius) && !isInSea(nx, p.y)) p.x = nx;
    if (!hitsBuilding(this.city, p.x, ny, PLAYER.radius) && !isInSea(p.x, ny)) p.y = ny;
    p.speed = Math.hypot(mv.x, mv.y) * speed;
    if (mv.x !== 0 || mv.y !== 0) p.angle = Math.atan2(mv.y, mv.x);
    this.audio.setEngine(false, 0);
  }

  updateDriving(dt, input) {
    const p = this.player;
    const car = p.car;
    const forward = input.down('KeyW') || input.down('ArrowUp');
    const back = input.down('KeyS') || input.down('ArrowDown');
    const left = input.down('KeyA') || input.down('ArrowLeft');
    const right = input.down('KeyD') || input.down('ArrowRight');
    if (forward) car.speed = Math.min(CAR.maxSpeed, car.speed + CAR.accel * dt);
    else if (back) {
      car.speed = car.speed > 20 ? car.speed - CAR.brake * dt : Math.max(-CAR.reverseMax, car.speed - CAR.accel * 0.6 * dt);
    } else {
      car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 140 * dt);
    }
    const steer = (left ? -1 : 0) + (right ? 1 : 0);
    const dir = car.speed >= 0 ? 1 : -1;
    car.angle += steer * CAR.steer * dt * dir * Math.min(1, Math.abs(car.speed) / 120 + 0.25);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const blocked = hitsBuilding(this.city, nx, ny, 22) || isInSea(nx, ny);
    if (blocked) {
      if (Math.abs(car.speed) > 180) {
        this.audio.crash();
        this.burst(car.x, car.y, '#ffaa33', 10);
        car.health -= 12;
        p.health -= 4;
      }
      car.speed *= -0.25;
    } else {
      car.x = nx;
      car.y = ny;
    }
    // Bumping traffic cars shoves them and costs the driver a little health.
    for (const other of this.cars) {
      if (other === car || other.police) continue;
      if (dist(car.x, car.y, other.x, other.y) < 44 && Math.abs(car.speed) > 60) {
        other.x += Math.cos(car.angle) * 12;
        other.y += Math.sin(car.angle) * 12;
        other.health -= 8;
        if (other.health <= 0 && !other.wrecked) {
          other.wrecked = true;
          this.burst(other.x, other.y, '#888888', 14);
        }
      }
    }
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    p.speed = Math.abs(car.speed);
    this.audio.setEngine(true, Math.abs(car.speed) / CAR.maxSpeed);
  }

  updateTraffic(dt) {
    for (const car of this.cars) {
      if (car.police || car.parked || car === this.player.car) continue;
      if (car.wrecked) continue;
      car.stuckTimer += dt;
      const target = car.vertical ? nearestRoadX(car.x) : nearestRoadY(car.y);
      const along = car.vertical ? car.y : car.x;
      // Steer back onto the road centre, then cruise along it.
      if (car.vertical) {
        const dx = target - car.x;
        car.x += clamp(dx, -60 * dt, 60 * dt);
        car.y += Math.sin(car.angle) * car.speed * dt;
        if (Math.abs(car.speed) < 10) car.speed = car.targetSpeed * (Math.sin(car.angle) > 0 ? 1 : 1);
      } else {
        const dy = target - car.y;
        car.y += clamp(dy, -60 * dt, 60 * dt);
        car.x += Math.cos(car.angle) * car.speed * dt;
      }
      // Wrap around the city edges so traffic never runs dry.
      if (car.x < 280) car.x = WORLD.width - 80;
      if (car.x > WORLD.width - 40) car.x = 320;
      if (car.y < 300) car.y = WORLD.height - 80;
      if (car.y > WORLD.height - 40) car.y = 340;
      // A slow car ahead makes the one behind ease off.
      for (const other of this.cars) {
        if (other === car) continue;
        const d = dist(car.x, car.y, other.x, other.y);
        if (d < 60 && d > 0.1) {
          car.speed = Math.max(40, car.speed - 120 * dt);
        }
      }
      if (Math.abs(car.speed) < 1) car.speed = car.targetSpeed;
    }
  }

  updatePeds(dt) {
    for (const ped of this.peds) {
      ped.walkPhase += dt * 6;
      if (ped.panic > 0) {
        ped.panic -= dt;
        ped.x += Math.cos(ped.angle) * 130 * dt;
        ped.y += Math.sin(ped.angle) * 130 * dt;
      } else {
        ped.x += Math.cos(ped.angle) * ped.speed * dt;
        ped.y += Math.sin(ped.angle) * ped.speed * dt;
        if (this.rng() < 0.002) ped.angle = this.rng() * Math.PI * 2;
      }
      if (hitsBuilding(this.city, ped.x, ped.y, 8) || isInSea(ped.x, ped.y)) {
        ped.angle += Math.PI / 2;
        ped.x = clamp(ped.x, 280, WORLD.width - 40);
        ped.y = clamp(ped.y, 320, WORLD.height - 40);
      }
      // A speeding car scares nearby pedestrians.
      const p = this.player;
      if (p.car && p.speed > 200 && dist(ped.x, ped.y, p.x, p.y) < 130) {
        ped.panic = 1.2;
        ped.angle = angleTo(p.x, p.y, ped.x, ped.y);
      }
    }
  }

  updatePolice(dt) {
    // Spawn to match the wanted level, up to 6 cruisers.
    this.policeTimer -= dt;
    const want = Math.min(this.wanted, 6);
    if (this.wanted > 0 && this.police.length < want && this.policeTimer <= 0) {
      this.spawnPoliceCar();
      this.policeTimer = 2.5;
    }
    this.audio.setSiren(this.wanted > 0);
    for (const car of [...this.police]) {
      const p = this.player;
      const targetAngle = angleTo(car.x, car.y, p.x, p.y);
      car.angle += clamp(angleDiff(car.angle, targetAngle), -3.2 * dt, 3.2 * dt);
      const d = dist(car.x, car.y, p.x, p.y);
      const desired = d > 90 ? POLICE.maxSpeed : 120;
      car.speed = Math.min(desired, car.speed + POLICE.accel * dt);
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      if (!hitsBuilding(this.city, nx, ny, 22) && !isInSea(nx, ny)) {
        car.x = nx;
        car.y = ny;
      } else {
        car.angle += Math.PI * 0.5 * dt * 4;
        car.speed *= 0.6;
      }
      // Ram: contact hurts the player (or their car) — hard on foot, a
      // shove with a health cost while driving.
      if (d < 46) {
        if (p.car) {
          p.car.health -= 2 * dt * 10;
          p.health -= 0.4 * dt * 10;
        } else {
          p.health -= 4 * dt * 10;
        }
        if (this.rng() < 0.02) this.audio.crash();
        this.burst(car.x, car.y, '#ffcc33', 2);
      }
      // A wrecked or far-gone cruiser leaves the chase.
      if (car.health <= 0 || d > 2400) {
        this.burst(car.x, car.y, '#666666', 12);
        this.police = this.police.filter((c) => c !== car);
        this.cars = this.cars.filter((c) => c !== car);
      }
    }
    // A police car the player shoots loses health and can be wrecked.
    for (const car of this.police) {
      if (car.health <= 0) {
        this.burst(car.x, car.y, '#666666', 12);
        this.police = this.police.filter((c) => c !== car);
        this.cars = this.cars.filter((c) => c !== car);
      }
    }
  }

  updateBullets(dt) {
    for (const b of [...this.bullets]) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      let dead = b.life <= 0;
      if (hitsBuilding(this.city, b.x, b.y, 2)) {
        this.burst(b.x, b.y, '#cccccc', 3);
        dead = true;
      }
      // Hit a police car.
      for (const car of this.police) {
        if (dist(b.x, b.y, car.x, car.y) < 26) {
          car.health -= PLAYER.bulletDamage;
          this.burst(b.x, b.y, '#ff5533', 6);
          dead = true;
          break;
        }
      }
      if (!dead) {
        for (const car of this.cars) {
          if (car.police || car === this.player.car) continue;
          if (dist(b.x, b.y, car.x, car.y) < 26) {
            car.health -= PLAYER.bulletDamage;
            this.burst(b.x, b.y, '#ff5533', 6);
            if (car.health <= 0 && !car.wrecked) {
              car.wrecked = true;
              this.burst(car.x, car.y, '#888888', 14);
            }
            dead = true;
            break;
          }
        }
      }
      if (!dead) {
        for (const ped of [...this.peds]) {
          if (dist(b.x, b.y, ped.x, ped.y) < 14) {
            this.peds = this.peds.filter((q) => q !== ped);
            this.kills += 1;
            this.burst(b.x, b.y, '#ff4444', 8);
            this.raiseWanted(1);
            dead = true;
            break;
          }
        }
      }
      if (dead) this.bullets = this.bullets.filter((q) => q !== b);
    }
  }

  updateParticles(dt) {
    for (const pt of [...this.particles]) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
      if (pt.life <= 0) this.particles = this.particles.filter((q) => q !== pt);
    }
  }

  updateWanted(dt) {
    if (this.wanted === 0) return;
    // Heat cools when the player stays out of sight of the police.
    const nearest = this.police.reduce((m, c) => Math.min(m, dist(c.x, c.y, this.player.x, this.player.y)), Infinity);
    if (nearest > 900) {
      this.wantedTimer += dt;
      if (this.wantedTimer > 12) {
        this.wanted -= 1;
        this.wantedTimer = 0;
      }
    } else {
      this.wantedTimer = 0;
    }
  }

  // ---- save / load -----------------------------------------------------------
  saveGame() {
    try {
      const data = {
        money: this.money,
        health: this.player.health,
        x: this.player.x,
        y: this.player.y,
        missions: this.missions.serialize(),
        kills: this.kills,
        carsStolen: this.carsStolen,
        time: this.time,
      };
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  loadGame() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      this.money = data.money ?? 0;
      this.player.health = data.health ?? PLAYER.health;
      this.player.x = data.x ?? this.player.x;
      this.player.y = data.y ?? this.player.y;
      this.kills = data.kills ?? 0;
      this.carsStolen = data.carsStolen ?? 0;
      this.time = data.time ?? 0;
      this.missions.restore(data.missions);
      return true;
    } catch {
      return false;
    }
  }

  static hasSave() {
    try {
      return window.localStorage.getItem(SAVE_KEY) !== null;
    } catch {
      return false;
    }
  }
}
