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
    if (screen === SCREEN_PLAY) {
      this.drawHud(world, ctx);
      this.drawMinimap(world, ctx);
    }
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
    // Parks.
    for (const park of world.city.parks) {
      ctx.fillStyle = COLORS.park;
      ctx.fillRect(park.x, park.y, park.w, park.h);
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
      ctx.fillStyle = '#00000033';
      ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
      ctx.fillStyle = COLORS.buildingWall;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x, b.y, b.w, Math.min(14, b.h * 0.2));
      // Windows.
      ctx.fillStyle = '#2b3a55';
      const cols = Math.max(1, Math.floor(b.w / 26));
      const rows = Math.max(1, Math.floor(b.h / 26));
      for (let i = 0; i < cols; i += 1) {
        for (let j = 0; j < rows; j += 1) {
          if ((i + j) % 3 === 0) continue;
          ctx.fillRect(b.x + 8 + i * 24, b.y + 20 + j * 24, 10, 12);
        }
      }
      if (b.floors >= 4) {
        ctx.fillStyle = '#00000022';
        ctx.fillRect(b.x, b.y, b.w, 4);
      }
    }
    // Palm trees.
    for (const t of world.city.trees) {
      ctx.fillStyle = '#6b4a2b';
      ctx.fillRect(t.x - 2, t.y - 2, 4, 4);
      ctx.fillStyle = '#3f8a3f';
      ctx.beginPath();
      ctx.arc(t.x, t.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#57a857';
      ctx.beginPath();
      ctx.arc(t.x - 3, t.y - 3, 5, 0, Math.PI * 2);
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
    ctx.fillStyle = '#222831';
    ctx.fillRect(-6, -CAR.width / 2 + 3, 14, CAR.width - 6);
    ctx.fillStyle = '#dfe8f2';
    ctx.fillRect(CAR.length / 2 - 6, -CAR.width / 2 + 4, 4, 6);
    ctx.fillRect(CAR.length / 2 - 6, CAR.width / 2 - 10, 4, 6);
    if (car.police) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-CAR.length / 2 + 2, -CAR.width / 2, CAR.length - 4, 7);
      ctx.fillStyle = '#ff3b30';
      ctx.fillRect(-8, -CAR.width / 2 - 3, 7, 5);
      ctx.fillStyle = '#2b6bff';
      ctx.fillRect(1, -CAR.width / 2 - 3, 7, 5);
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
    ctx.fillStyle = '#2e7f9e';
    ctx.fillRect(x0, y0, 260 * sx, size);
    ctx.fillStyle = '#7fae5a';
    ctx.fillRect(x0 + 260 * sx, y0, size - 260 * sx, size);
    ctx.fillStyle = '#3d3a38';
    for (const x of roadXs()) ctx.fillRect(x0 + x * sx - 1, y0, 2, size);
    for (const y of roadYs()) ctx.fillRect(x0, y0 + y * sy, size, 2);
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
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x0 + world.player.x * sx, y0 + world.player.y * sy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffd94d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x0 + world.player.x * sx, y0 + world.player.y * sy, 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('SOLMAR BAY', x0, y0 + size + 16);
  }

  drawTitle(world, ctx) {
    // A live city behind the title: the world keeps simulating under it.
    this.drawWorld(world, SCREEN_TITLE);
    ctx.fillStyle = 'rgba(10,18,28,0.62)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 84px system-ui, sans-serif';
    ctx.fillText('SOLMAR HEAT', VIEW.width / 2, 250);
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
