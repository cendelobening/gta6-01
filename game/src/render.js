// Rendering: the top-down city, cars, people, bullets and particles, then the
// HUD (health, cash, wanted stars, mission objective), the minimap, and the
// title / pause / game-over / story-complete screens. All canvas 2D, no assets.
import { CAR, COLORS, PLAYER, VIEW, WORLD } from './config.js';
import { ROAD_SPACING, ROAD_WIDTH, isOnRoad, roadXs, roadYs } from './city.js';
import { clamp } from './random.js';
import { World } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSE = 'pause';
export const SCREEN_OVER = 'over';
export const SCREEN_DONE = 'done';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.camera = { x: 0, y: 0 };
  }

  /** Keep the camera on the player, clamped to the world edges. */
  follow(x, y) {
    this.camera.x = clamp(x - VIEW.width / 2, 0, WORLD.width - VIEW.width);
    this.camera.y = clamp(y - VIEW.height / 2, 0, WORLD.height - VIEW.height);
  }

  drawWorld(world, screen) {
    const ctx = this.ctx;
    const cam = this.camera;
    // Stash the frame time so helpers (police light bars, foam drift) can
    // animate from the deterministic world clock, never the wall clock.
    this.frameTime = world.time;
    ctx.fillStyle = '#1a2a33';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.save();
    ctx.translate(-cam.x, -cam.y);
    this.drawGround(world, ctx, cam);
    this.drawCity(world, ctx);
    this.drawMarker(world, ctx);
    for (const car of world.cars) this.drawCar(ctx, car);
    for (const ped of world.peds) this.drawPed(ctx, ped);
    for (const b of world.bullets) this.drawBullet(ctx, b);
    for (const pt of world.particles) this.drawParticle(ctx, pt);
    this.drawPlayer(world, ctx);
    ctx.restore();
    this.drawSunsetGrade(ctx);
    if (screen === SCREEN_PLAY) {
      this.drawHud(world, ctx);
      this.drawMinimap(world, ctx);
    }
  }

  /** Golden-hour grade painted over the world (never over the HUD): a warm
   * wash from the top of the frame plus a soft radial vignette that deepens
   * the corners, so every scene reads as late-afternoon Solmar Bay. */
  drawSunsetGrade(ctx) {
    const warm = ctx.createLinearGradient(0, 0, 0, VIEW.height);
    warm.addColorStop(0, 'rgba(255,166,66,0.14)');
    warm.addColorStop(0.45, 'rgba(255,120,80,0.05)');
    warm.addColorStop(1, 'rgba(64,20,80,0.07)');
    ctx.fillStyle = warm;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    // Low sun glow pooled near the horizon line of the frame.
    const glow = ctx.createRadialGradient(VIEW.width * 0.28, VIEW.height * 0.92, 40, VIEW.width * 0.28, VIEW.height * 0.92, 520);
    glow.addColorStop(0, 'rgba(255,176,84,0.10)');
    glow.addColorStop(1, 'rgba(255,176,84,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    const cx = VIEW.width / 2;
    const cy = VIEW.height / 2;
    const radius = Math.hypot(cx, cy);
    const vignette = ctx.createRadialGradient(cx, cy, radius * 0.42, cx, cy, radius);
    vignette.addColorStop(0, 'rgba(26,8,38,0)');
    vignette.addColorStop(0.72, 'rgba(26,8,38,0.07)');
    vignette.addColorStop(1, 'rgba(26,8,38,0.20)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }

  drawGround(world, ctx, cam) {
    // Sea on the west edge, sand beach, then grass with district tints.
    ctx.fillStyle = COLORS.sea;
    ctx.fillRect(cam.x - 10, cam.y - 10, 270, VIEW.height + 20);
    ctx.fillStyle = COLORS.seaDeep;
    for (let y = 300; y < WORLD.height; y += 160) {
      ctx.fillRect(40, y, 180, 8);
      ctx.fillRect(90, y + 80, 140, 6);
    }
    ctx.fillStyle = COLORS.sand;
    ctx.fillRect(260, 280, 60, WORLD.height - 280);
    ctx.fillStyle = COLORS.grass;
    ctx.fillRect(320, 280, WORLD.width - 320, WORLD.height - 280);
    for (const d of world.city.districts) {
      ctx.fillStyle = d.tint;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(d.x, d.y, d.w, d.h);
      ctx.globalAlpha = 1;
    }
    // Mow stripes: a faint checker over the grass blocks between roads, so
    // the lawns read as tended ground instead of one flat fill. Stripes sit
    // under the roads, which are painted over them below.
    const blockXs = [320, ...roadXs(), WORLD.width];
    const blockYs = [280, ...roadYs(), WORLD.height];
    for (let i = 0; i + 1 < blockXs.length; i += 1) {
      for (let j = 0; j + 1 < blockYs.length; j += 1) {
        if ((i + j) % 2 !== 0) continue;
        ctx.fillStyle = (i % 2 === 0) ? 'rgba(255,255,220,0.05)' : 'rgba(10,40,10,0.05)';
        ctx.fillRect(blockXs[i], blockYs[j], blockXs[i + 1] - blockXs[i], blockYs[j + 1] - blockYs[j]);
      }
    }
    // Parks.
    for (const park of world.city.parks) {
      ctx.fillStyle = COLORS.park;
      ctx.fillRect(park.x, park.y, park.w, park.h);
    }
    // Sand speckles: a fixed, hashed scatter of darker grains on the beach.
    ctx.fillStyle = 'rgba(150,115,60,0.35)';
    for (let y = 300; y < WORLD.height - 20; y += 46) {
      for (let k = 0; k < 3; k += 1) {
        const sx = 266 + ((y * 7 + k * 53) % 48);
        const sy = y + ((y * 3 + k * 29) % 34);
        ctx.fillRect(sx, sy, 3, 2);
      }
    }
    // Foam lines where the sea meets the sand, drifting with the world
    // clock: two broken white crests that slide slowly along the shore.
    const drift = Math.sin(world.time * 0.7) * 6;
    ctx.strokeStyle = 'rgba(255,255,255,0.62)';
    ctx.lineWidth = 2.5;
    for (const foamX of [252, 240]) {
      ctx.beginPath();
      for (let y = 286; y < WORLD.height; y += 28) {
        const waveX = foamX + Math.sin(world.time * 1.3 + y * 0.02) * 4 + (foamX === 252 ? drift : -drift);
        if (y === 286) ctx.moveTo(waveX, y);
        else ctx.lineTo(waveX, y);
      }
      ctx.stroke();
    }
    // Roads.
    ctx.fillStyle = COLORS.road;
    for (const x of roadXs()) ctx.fillRect(x - ROAD_WIDTH / 2, 280, ROAD_WIDTH, WORLD.height - 280);
    for (const y of roadYs()) ctx.fillRect(300, y - ROAD_WIDTH / 2, WORLD.width - 300, ROAD_WIDTH);
    // Centre dashes.
    ctx.fillStyle = COLORS.roadLine;
    for (const x of roadXs()) {
      for (let y = 320; y < WORLD.height; y += 80) ctx.fillRect(x - 2, y, 4, 34);
    }
    for (const y of roadYs()) {
      for (let x = 340; x < WORLD.width; x += 80) ctx.fillRect(x, y - 2, 34, 4);
    }
    // Sidewalks.
    ctx.fillStyle = COLORS.sidewalk;
    for (const x of roadXs()) {
      ctx.fillRect(x - ROAD_WIDTH / 2 - 10, 280, 10, WORLD.height - 280);
      ctx.fillRect(x + ROAD_WIDTH / 2, 280, 10, WORLD.height - 280);
    }
    // Pier jutting into the sea.
    ctx.fillStyle = '#8a6f4d';
    ctx.fillRect(120, 1210, 170, 90);
    ctx.fillStyle = '#a8875f';
    for (let x = 130; x < 280; x += 24) ctx.fillRect(x, 1210, 8, 90);
  }

  drawCity(world, ctx) {
    for (const b of world.city.buildings) {
      // Stable per-building hash (position arithmetic only) so rooftop
      // details and lit windows never flicker between frames.
      const hash = Math.abs(Math.floor(b.x * 31 + b.y * 17));
      // Long, soft drop shadow for fake height.
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(b.x + 10, b.y + 12, b.w, b.h);
      // Full roof surface: wall-colour parapet border, roof colour inside.
      ctx.fillStyle = COLORS.buildingWall;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
      // Parapet highlight along the top edge, shadow line just inside the
      // rim so the roof surface reads as recessed rather than painted on.
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(b.x, b.y, b.w, 3);
      ctx.fillStyle = 'rgba(0,0,0,0.14)';
      ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, 3);
      ctx.fillRect(b.x + 5, b.y + 5, 3, b.h - 10);
      // Rooftop details, chosen by the hash.
      if (hash % 5 !== 0) {
        ctx.fillStyle = '#9aa0a3';
        ctx.fillRect(b.x + 10 + (hash % 23), b.y + 10 + (hash % 13), 14, 10);
        ctx.fillStyle = '#7e858a';
        ctx.fillRect(b.x + 12 + (hash % 23), b.y + 12 + (hash % 13), 14, 3);
      }
      if (hash % 3 === 1 && b.w > 84 && b.h > 70) {
        ctx.fillStyle = '#8d9296';
        ctx.fillRect(b.x + b.w - 30 - (hash % 11), b.y + b.h - 28, 12, 9);
      }
      if (b.floors >= 5) {
        // Water tower: brown tank on legs with a cone cap, near a corner.
        const tx = b.x + b.w - 26;
        const ty = b.y + 10;
        ctx.fillStyle = '#6e5136';
        ctx.fillRect(tx, ty + 6, 16, 12);
        ctx.fillStyle = '#54382a';
        ctx.beginPath();
        ctx.moveTo(tx - 2, ty + 6);
        ctx.lineTo(tx + 8, ty - 3);
        ctx.lineTo(tx + 18, ty + 6);
        ctx.closePath();
        ctx.fill();
        ctx.fillRect(tx + 2, ty + 18, 3, 5);
        ctx.fillRect(tx + 11, ty + 18, 3, 5);
      } else if (hash % 4 === 0 && b.w > 92 && b.h > 76) {
        // Rooftop pool: teal water inside a pale deck rim.
        ctx.fillStyle = '#e8e2d2';
        ctx.fillRect(b.x + 12, b.y + b.h - 30, 34, 20);
        ctx.fillStyle = '#3fbfae';
        ctx.fillRect(b.x + 15, b.y + b.h - 27, 28, 14);
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.fillRect(b.x + 18, b.y + b.h - 24, 12, 3);
      }
      // Windows: a denser grid, a few warm-lit at golden hour.
      const cols = Math.max(1, Math.floor((b.w - 12) / 19));
      const rows = Math.max(1, Math.floor((b.h - 12) / 19));
      for (let i = 0; i < cols; i += 1) {
        for (let j = 0; j < rows; j += 1) {
          if ((i * 3 + j + hash) % 7 === 0) continue;
          const lit = (i * 7 + j * 13 + hash) % 9 === 0;
          ctx.fillStyle = lit ? '#ffd98a' : '#2b3a55';
          ctx.fillRect(b.x + 8 + i * 18, b.y + 8 + j * 18, 8, 10);
        }
      }
      // Darker shading strip along the bottom edge sells the height.
      ctx.fillStyle = 'rgba(0,0,0,0.24)';
      ctx.fillRect(b.x, b.y + b.h - 7, b.w, 7);
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(b.x + b.w - 6, b.y, 6, b.h);
    }
    // Palm trees: a short leaning trunk and six curved fronds, no lollipops.
    for (const t of world.city.trees) {
      const sway = Math.floor(t.x * 13 + t.y * 7) % 5 - 2;
      // Ground shadow.
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.ellipse(t.x + 5, t.y + 6, 11, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      // Trunk: a tapered line leaning with the tree's stable sway.
      ctx.strokeStyle = '#6b4a2b';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(t.x - sway, t.y + 8);
      ctx.quadraticCurveTo(t.x, t.y + 2, t.x + sway, t.y - 4);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#86603a';
      ctx.beginPath();
      ctx.moveTo(t.x - sway, t.y + 8);
      ctx.quadraticCurveTo(t.x, t.y + 2, t.x + sway, t.y - 4);
      ctx.stroke();
      // Fronds: six quadratic arcs fanning out, alternating two greens.
      const crownX = t.x + sway;
      const crownY = t.y - 4;
      for (let k = 0; k < 6; k += 1) {
        const a = (k / 6) * Math.PI * 2 + sway * 0.14;
        const tipX = crownX + Math.cos(a) * 15;
        const tipY = crownY + Math.sin(a) * 11 + 5;
        const midX = crownX + Math.cos(a) * 8;
        const midY = crownY + Math.sin(a) * 6 - 4;
        ctx.strokeStyle = k % 2 === 0 ? '#2f7a35' : '#4da34d';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(crownX, crownY);
        ctx.quadraticCurveTo(midX, midY, tipX, tipY);
        ctx.stroke();
      }
      // Coconut cluster at the crown.
      ctx.fillStyle = '#7a5a30';
      ctx.beginPath();
      ctx.arc(crownX, crownY + 1, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Landmark labels.
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const lm of world.city.landmarks) {
      ctx.fillStyle = '#00000055';
      ctx.fillRect(lm.x - 62, lm.y - 34, 124, 18);
      ctx.fillStyle = '#fff8e0';
      ctx.fillText(lm.name.toUpperCase(), lm.x, lm.y - 21);
    }
    // District names, large and faint.
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff22';
    for (const d of world.city.districts) {
      ctx.fillText(d.name.toUpperCase(), d.x + d.w / 2, d.y + d.h / 2);
    }
  }

  drawMarker(world, ctx) {
    const marker = world.missions.marker();
    if (!marker) return;
    const pulse = 1 + Math.sin(world.time * 4) * 0.15;
    ctx.save();
    ctx.translate(marker.x, marker.y);
    ctx.strokeStyle = '#ffd94d';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 34 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // A guiding arrow at the screen edge when the marker is off-screen.
    const cam = this.camera;
    const onScreen = marker.x > cam.x && marker.x < cam.x + VIEW.width
      && marker.y > cam.y && marker.y < cam.y + VIEW.height;
    if (!onScreen) {
      const cx = clamp(marker.x, cam.x + 30, cam.x + VIEW.width - 30);
      const cy = clamp(marker.y, cam.y + 30, cam.y + VIEW.height - 30);
      ctx.save();
      ctx.translate(cx - cam.x, cy - cam.y);
      ctx.rotate(Math.atan2(marker.y - world.player.y, marker.x - world.player.x));
      ctx.fillStyle = '#ffd94d';
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(-8, -11);
      ctx.lineTo(-8, 11);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  drawCar(ctx, car) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    if (car.wrecked) ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#00000044';
    ctx.fillRect(-CAR.length / 2 + 3, -CAR.width / 2 + 3, CAR.length, CAR.width);
    ctx.fillStyle = car.color;
    ctx.fillRect(-CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width);
    // Racing stripe on roughly a third of civilian cars (stable per car).
    const stripeHash = car.id != null ? car.id : Math.floor(car.x + car.y);
    if (!car.police && stripeHash % 3 === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillRect(-CAR.length / 2, -3, CAR.length, 6);
      ctx.fillStyle = 'rgba(20,20,30,0.35)';
      ctx.fillRect(-CAR.length / 2, -1, CAR.length, 2);
    }
    // Shaded cabin: dark glasshouse with a lighter roof panel inside it.
    ctx.fillStyle = '#1d232c';
    ctx.fillRect(-8, -CAR.width / 2 + 2, 17, CAR.width - 4);
    ctx.fillStyle = '#39424e';
    ctx.fillRect(-5, -CAR.width / 2 + 5, 11, CAR.width - 10);
    ctx.fillStyle = 'rgba(190,220,245,0.55)';
    ctx.fillRect(6, -CAR.width / 2 + 3, 3, CAR.width - 6);
    // Headlights at the nose, red taillights at the rear.
    ctx.fillStyle = '#ffeeb8';
    ctx.fillRect(CAR.length / 2 - 5, -CAR.width / 2 + 3, 4, 6);
    ctx.fillRect(CAR.length / 2 - 5, CAR.width / 2 - 9, 4, 6);
    ctx.fillStyle = '#e8322a';
    ctx.fillRect(-CAR.length / 2 + 1, -CAR.width / 2 + 3, 3, 6);
    ctx.fillRect(-CAR.length / 2 + 1, CAR.width / 2 - 9, 3, 6);
    if (car.police) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-CAR.length / 2 + 2, -CAR.width / 2, CAR.length - 4, 7);
      // Light bar flashes: red and blue alternate on the world clock.
      const baseAlpha = car.wrecked ? 0.55 : 1;
      const phase = Math.floor((this.frameTime || 0) * 4) % 2;
      ctx.globalAlpha = baseAlpha * (phase === 0 ? 1 : 0.22);
      ctx.fillStyle = '#ff3b30';
      ctx.fillRect(-8, -CAR.width / 2 - 3, 7, 5);
      ctx.globalAlpha = baseAlpha * (phase === 1 ? 1 : 0.22);
      ctx.fillStyle = '#2b6bff';
      ctx.fillRect(1, -CAR.width / 2 - 3, 7, 5);
      // Halo glow on whichever lamp is lit.
      ctx.globalAlpha = baseAlpha * 0.28;
      ctx.fillStyle = phase === 0 ? '#ff3b30' : '#2b6bff';
      ctx.beginPath();
      ctx.arc(phase === 0 ? -5 : 4, -CAR.width / 2 - 1, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = baseAlpha;
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PD', 0, 4);
    }
    if (car.health < 50 && !car.wrecked) {
      ctx.fillStyle = '#555555';
      ctx.fillRect(-CAR.length / 2, -CAR.width / 2, 10, 8);
    }
    ctx.restore();
  }

  drawPed(ctx, ped) {
    ctx.save();
    ctx.translate(ped.x, ped.y);
    const bob = Math.sin(ped.walkPhase) * 1.5;
    ctx.fillStyle = '#00000033';
    ctx.beginPath();
    ctx.ellipse(0, 3, 7, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(0, bob * 0.3, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b88a';
    ctx.beginPath();
    ctx.arc(Math.cos(ped.angle) * 4, Math.sin(ped.angle) * 4 + bob * 0.3, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawBullet(ctx, b) {
    ctx.fillStyle = '#ffe14d';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  drawParticle(ctx, pt) {
    ctx.globalAlpha = Math.max(0, pt.life / 0.4);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4);
    ctx.globalAlpha = 1;
  }

  drawPlayer(world, ctx) {
    const p = world.player;
    if (p.dead) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.car) {
      // The driver is inside the car; draw a small direction tick instead.
      ctx.restore();
      return;
    }
    ctx.rotate(p.aimAngle || p.angle);
    ctx.fillStyle = '#00000044';
    ctx.beginPath();
    ctx.ellipse(0, 4, 12, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.player;
    ctx.beginPath();
    ctx.arc(0, 0, PLAYER.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2b2b2b';
    ctx.fillRect(6, -3, 14, 6);
    ctx.fillStyle = '#e8b88a';
    ctx.beginPath();
    ctx.arc(2, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Name tag.
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('JAX', p.x, p.y - 20);
  }

  drawHud(world, ctx) {
    const p = world.player;
    ctx.textAlign = 'left';
    // Top-left panel: health, cash, wanted stars.
    ctx.fillStyle = 'rgba(16,24,32,0.78)';
    ctx.fillRect(12, 12, 300, 92);
    ctx.strokeStyle = '#ffd94d';
    ctx.lineWidth = 2;
    ctx.strokeRect(12, 12, 300, 92);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText(`JAX MARLOWE  •  $${world.money}`, 24, 36);
    ctx.fillStyle = '#333333';
    ctx.fillRect(24, 48, 180, 12);
    ctx.fillStyle = p.health > 40 ? '#57d957' : '#ff5533';
    ctx.fillRect(24, 48, 180 * Math.max(0, p.health / 100), 12);
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(`HP ${Math.max(0, Math.round(p.health))}`, 212, 59);
    ctx.font = 'bold 20px system-ui, sans-serif';
    let stars = '';
    for (let i = 0; i < 5; i += 1) stars += i < world.wanted ? '★' : '☆';
    ctx.fillStyle = world.wanted > 0 ? '#ffd94d' : '#888888';
    ctx.fillText(stars, 24, 90);
    // Objective banner.
    const job = world.missions.job;
    ctx.fillStyle = 'rgba(16,24,32,0.78)';
    ctx.fillRect(12, 112, 460, 54);
    ctx.strokeStyle = '#ffd94d';
    ctx.lineWidth = 2;
    ctx.strokeRect(12, 112, 460, 54);
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText(job ? `JOB ${job.id}/5 — ${job.title.toUpperCase()}` : 'FREE ROAM', 24, 134);
    ctx.fillStyle = '#ffffff';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(world.missions.objective, 24, 154);
    // Mission banner (job complete / failed).
    if (world.missions.bannerTimer > 0) {
      ctx.fillStyle = 'rgba(16,24,32,0.85)';
      const w = Math.min(760, 40 + world.missions.banner.length * 8.5);
      ctx.fillRect((VIEW.width - w) / 2, 180, w, 44);
      ctx.fillStyle = '#ffd94d';
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(world.missions.banner, VIEW.width / 2, 208);
      ctx.textAlign = 'left';
    }
    // Bottom hint bar.
    ctx.fillStyle = 'rgba(16,24,32,0.7)';
    ctx.fillRect(12, VIEW.height - 34, 760, 24);
    ctx.fillStyle = '#dddddd';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(
      p.car
        ? 'W/S drive • A/D steer • E exit car • Click shoot • P pause • M mute'
        : 'WASD move • Shift run • E enter car • Click shoot • P pause • M mute',
      22, VIEW.height - 17,
    );
    // Speedometer while driving.
    if (p.car) {
      ctx.fillStyle = 'rgba(16,24,32,0.78)';
      ctx.fillRect(VIEW.width - 180, VIEW.height - 66, 168, 54);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 26px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round(Math.abs(p.car.speed) * 0.35)} mph`, VIEW.width - 28, VIEW.height - 28);
      ctx.textAlign = 'left';
    }
  }

  drawMinimap(world, ctx) {
    const size = 190;
    const x0 = VIEW.width - size - 12;
    const y0 = 12;
    const sx = size / WORLD.width;
    const sy = size / WORLD.height;
    ctx.fillStyle = 'rgba(16,24,32,0.8)';
    ctx.fillRect(x0 - 4, y0 - 4, size + 8, size + 8);
    // Sea, then a sand strip for the beach, then dark slate-green land so
    // the lighter roads read as a network instead of a green grid.
    ctx.fillStyle = '#2e7f9e';
    ctx.fillRect(x0, y0, 260 * sx, size);
    ctx.fillStyle = '#e8cf9a';
    ctx.fillRect(x0 + 260 * sx, y0, 60 * sx, size);
    ctx.fillStyle = '#3f5a3c';
    ctx.fillRect(x0 + 320 * sx, y0, size - 320 * sx, size);
    ctx.fillStyle = '#9a937f';
    for (const x of roadXs()) ctx.fillRect(x0 + x * sx - 1, y0, 2, size);
    for (const y of roadYs()) ctx.fillRect(x0, y0 + y * sy - 1, size, 2);
    // Landmarks as small gold dots.
    ctx.fillStyle = '#ffd94d';
    for (const lm of world.city.landmarks) {
      ctx.beginPath();
      ctx.arc(x0 + lm.x * sx, y0 + lm.y * sy, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffd94d';
    const marker = world.missions.marker();
    if (marker) {
      ctx.beginPath();
      ctx.arc(x0 + marker.x * sx, y0 + marker.y * sy, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const car of world.police) {
      ctx.fillStyle = '#2b6bff';
      ctx.fillRect(x0 + car.x * sx - 2, y0 + car.y * sy - 2, 4, 4);
    }
    // Player as an oriented triangle (car angle while driving).
    const heading = world.player.car ? world.player.car.angle : (world.player.aimAngle || world.player.angle);
    ctx.save();
    ctx.translate(x0 + world.player.x * sx, y0 + world.player.y * sy);
    ctx.rotate(heading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-5, -4.5);
    ctx.lineTo(-2.5, 0);
    ctx.lineTo(-5, 4.5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffd94d';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
    // Thin gold frame around the whole minimap, with a darker outer edge
    // so the frame stays readable over bright grass and sand.
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 4;
    ctx.strokeRect(x0 - 5, y0 - 5, size + 10, size + 10);
    ctx.strokeStyle = '#ffd94d';
    ctx.lineWidth = 2;
    ctx.strokeRect(x0 - 4, y0 - 4, size + 8, size + 8);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('SOLMAR BAY', x0, y0 + size + 16);
  }

  drawTitle(world, ctx) {
    // A live city behind the title: the world keeps simulating under it.
    this.drawWorld(world, SCREEN_TITLE);
    // Sunset gradient veil: deep indigo at the top melting into warm
    // magenta and burnt orange low over the bay.
    const veil = ctx.createLinearGradient(0, 0, 0, VIEW.height);
    veil.addColorStop(0, 'rgba(24,16,64,0.70)');
    veil.addColorStop(0.45, 'rgba(94,28,84,0.60)');
    veil.addColorStop(0.75, 'rgba(196,62,92,0.55)');
    veil.addColorStop(1, 'rgba(238,118,52,0.58)');
    ctx.fillStyle = veil;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    // Title in a gold-to-pink gradient with a soft warm glow behind it.
    ctx.save();
    ctx.shadowColor = 'rgba(255,120,60,0.55)';
    ctx.shadowBlur = 26;
    const titleGrad = ctx.createLinearGradient(VIEW.width / 2 - 320, 0, VIEW.width / 2 + 320, 0);
    titleGrad.addColorStop(0, '#ffd94d');
    titleGrad.addColorStop(0.55, '#ffab4a');
    titleGrad.addColorStop(1, '#ff5e8a');
    ctx.fillStyle = titleGrad;
    ctx.font = 'bold 84px system-ui, sans-serif';
    ctx.fillText('SOLMAR HEAT', VIEW.width / 2, 250);
    ctx.restore();
    // Thin neon accent bar under the title.
    const barGrad = ctx.createLinearGradient(VIEW.width / 2 - 260, 0, VIEW.width / 2 + 260, 0);
    barGrad.addColorStop(0, 'rgba(255,217,77,0)');
    barGrad.addColorStop(0.25, '#ffd94d');
    barGrad.addColorStop(0.75, '#ff5e8a');
    barGrad.addColorStop(1, 'rgba(255,94,138,0)');
    ctx.fillStyle = barGrad;
    ctx.fillRect(VIEW.width / 2 - 260, 266, 520, 3);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText('An open-world crime story in Solmar Bay', VIEW.width / 2, 292);
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillStyle = '#e8e8e8';
    ctx.fillText('You are Jax Marlowe, a wheelman new in town. Five jobs for Rico Vane.', VIEW.width / 2, 330);
    ctx.fillText('Steal cars, outrun the Solmar PD, and pull off the Big Score.', VIEW.width / 2, 354);
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(World.hasSave() ? 'Press ENTER to continue  •  N for a new game' : 'Press ENTER to start', VIEW.width / 2, 430);
    ctx.fillStyle = '#cccccc';
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText('WASD move / drive  •  E enter & exit cars  •  Mouse aim, click to shoot', VIEW.width / 2, 480);
    ctx.fillText('P pause  •  M mute  •  Progress saves automatically', VIEW.width / 2, 504);
    ctx.textAlign = 'left';
  }

  drawPause(world, ctx) {
    this.drawWorld(world, SCREEN_PAUSE);
    ctx.fillStyle = 'rgba(10,18,28,0.66)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 56px system-ui, sans-serif';
    ctx.fillText('PAUSED', VIEW.width / 2, 320);
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText('P to resume  •  S to save now  •  R to restart the story', VIEW.width / 2, 360);
    ctx.textAlign = 'left';
  }

  drawOver(world, ctx) {
    this.drawWorld(world, SCREEN_OVER);
    ctx.fillStyle = 'rgba(20,8,8,0.7)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff6b5e';
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.fillText('BUSTED', VIEW.width / 2, 300);
    ctx.fillStyle = '#ffffff';
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText('The Solmar PD caught up with Jax. The story restarts from the last job.', VIEW.width / 2, 344);
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText('Press ENTER to retry the job', VIEW.width / 2, 420);
    ctx.textAlign = 'left';
  }

  drawDone(world, ctx) {
    this.drawWorld(world, SCREEN_DONE);
    ctx.fillStyle = 'rgba(10,24,16,0.62)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 60px system-ui, sans-serif';
    ctx.fillText('THE BIG SCORE', VIEW.width / 2, 300);
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText(`Jax pulled it off. $${world.money} earned across ${world.missions.completed} jobs.`, VIEW.width / 2, 344);
    ctx.fillText('Solmar Bay is yours now — keep driving, keep the heat low.', VIEW.width / 2, 372);
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText('Press ENTER to keep playing in free roam', VIEW.width / 2, 440);
    ctx.textAlign = 'left';
  }
}
