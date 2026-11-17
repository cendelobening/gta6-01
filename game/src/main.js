// SOLMAR HEAT — entry point. Owns the screen state machine (title, play,
// pause, busted, story complete), the animation loop, saving, and the
// ?shot= scenes the screenshots are taken from.
import { STEP, VIEW } from './config.js';
import { queryParams } from './random.js';
import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import { World } from './world.js';
import { Renderer, SCREEN_DONE, SCREEN_OVER, SCREEN_PAUSE, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
canvas.width = VIEW.width;
canvas.height = VIEW.height;

const params = queryParams();
const audio = new AudioEngine();
const input = new Input(canvas);
const world = new World(params.seed, audio);
const renderer = new Renderer(canvas);

let screen = SCREEN_TITLE;
let lastTime = 0;
let accumulator = 0;
let shotMode = params.shot !== '';
let shotReady = false;

function startGame(fresh) {
  if (fresh) {
    world.reset();
  } else if (!world.loadGame()) {
    world.reset();
  }
  world.player.dead = false;
  world.missions.failed = false;
  screen = SCREEN_PLAY;
  audio.ensure();
}

function retryJob() {
  world.missions.retry();
  world.player.health = 100;
  world.player.dead = false;
  world.wanted = 0;
  world.police.length = 0;
  world.player.x = 940;
  world.player.y = 1650;
  if (world.player.car) {
    world.player.car = null;
  }
  screen = SCREEN_PLAY;
}

input.onKey = (code) => {
  audio.ensure();
  if (code === 'KeyM') {
    audio.setMuted(!audio.muted);
    return;
  }
  if (screen === SCREEN_TITLE) {
    if (code === 'Enter' || code === 'NumpadEnter') startGame(false);
    if (code === 'KeyN') startGame(true);
    return;
  }
  if (screen === SCREEN_PLAY) {
    if (code === 'KeyP' || code === 'Escape') {
      screen = SCREEN_PAUSE;
      return;
    }
    if (code === 'KeyS') world.saveGame();
    if (code === 'KeyR') {
      world.reset();
      screen = SCREEN_PLAY;
    }
    return;
  }
  if (screen === SCREEN_PAUSE) {
    if (code === 'KeyP' || code === 'Escape' || code === 'Enter') screen = SCREEN_PLAY;
    if (code === 'KeyS') world.saveGame();
    if (code === 'KeyR') {
      world.reset();
      screen = SCREEN_PLAY;
    }
    return;
  }
  if (screen === SCREEN_OVER) {
    if (code === 'Enter' || code === 'NumpadEnter') retryJob();
    return;
  }
  if (screen === SCREEN_DONE) {
    if (code === 'Enter' || code === 'NumpadEnter') screen = SCREEN_PLAY;
  }
};

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - lastTime) / 1000 || 0);
  lastTime = now;

  if (screen === SCREEN_PLAY) {
    accumulator += dt;
    while (accumulator >= STEP) {
      world.update(STEP, input, renderer.camera);
      accumulator -= STEP;
      if (world.player.dead) {
        screen = SCREEN_OVER;
        break;
      }
      if (world.missions.storyDone && screen === SCREEN_PLAY) {
        screen = SCREEN_DONE;
        break;
      }
    }
    // Aim with the mouse while on foot.
    if (!world.player.car) {
      const wx = renderer.camera.x + input.mouseX;
      const wy = renderer.camera.y + input.mouseY;
      world.player.aimAngle = Math.atan2(wy - world.player.y, wx - world.player.x);
    }
    renderer.follow(world.player.x, world.player.y);
    renderer.drawWorld(world, SCREEN_PLAY);
    // Autosave every 20 seconds of play (never in the first second, where the
    // floor-change test would fire on the opening frame).
    if (world.time > 1 && Math.floor(world.time) % 20 === 0 && Math.floor(world.time) !== Math.floor(world.time - dt)) {
      world.saveGame();
    }
  } else if (screen === SCREEN_TITLE) {
    // The city lives behind the title screen.
    world.update(dt, input, renderer.camera);
    renderer.follow(world.player.x, world.player.y);
    renderer.drawTitle(world, renderer.ctx);
  } else if (screen === SCREEN_PAUSE) {
    renderer.drawPause(world, renderer.ctx);
  } else if (screen === SCREEN_OVER) {
    renderer.drawOver(world, renderer.ctx);
  } else if (screen === SCREEN_DONE) {
    renderer.drawDone(world, renderer.ctx);
  }
  input.endFrame();
}

// Deterministic screenshot scenes: stage the world, draw one frame, and tell
// the screenshot tool the frame is ready. No animation loop runs in shot mode.
if (shotMode) {
  const staged = stageShot(params.shot, world);
  screen = staged.screen;
  renderer.follow(world.player.x, world.player.y);
  if (screen === SCREEN_TITLE) renderer.drawTitle(world, renderer.ctx);
  else renderer.drawWorld(world, SCREEN_PLAY);
  shotReady = true;
  window.__shotReady = true;
  window.__game = { world, screen };
} else {
  window.__game = { world, screen: () => screen };
  requestAnimationFrame(frame);
}

// Expose a tiny handle for play-testing: state, save state and screen.
window.__solmar = {
  get screen() {
    return screen;
  },
  get shotReady() {
    return shotReady;
  },
  world,
  startGame,
  retryJob,
};
