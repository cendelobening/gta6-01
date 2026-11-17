// The five-job story: Rico Vane's jobs for Jax Marlowe. The mission runner
// owns the current job, its stage and timers, and answers one question per
// frame: what is the objective right now, and did the player just complete it?
import { MISSIONS } from './config.js';
import { dist } from './random.js';

export class MissionRunner {
  constructor() {
    this.jobIndex = 0; // index into MISSIONS
    this.stageIndex = 0;
    this.stageTimer = 0;
    this.holdTimer = 0;
    this.completed = 0;
    this.storyDone = false;
    this.banner = '';
    this.bannerTimer = 0;
    this.failed = false;
    this.failReason = '';
  }

  get job() {
    return MISSIONS[this.jobIndex] ?? null;
  }

  get stage() {
    const job = this.job;
    return job ? job.stages[this.stageIndex] : null;
  }

  get objective() {
    const stage = this.stage;
    if (this.storyDone) return 'Story complete — free roam Solmar Bay!';
    if (!stage) return '';
    return stage.text;
  }

  reset() {
    this.jobIndex = 0;
    this.stageIndex = 0;
    this.stageTimer = 0;
    this.holdTimer = 0;
    this.completed = 0;
    this.storyDone = false;
    this.banner = '';
    this.bannerTimer = 0;
    this.failed = false;
    this.failReason = '';
  }

  /** Marker the HUD/minimap should point at, or null. */
  marker() {
    const stage = this.stage;
    if (!stage || this.storyDone) return null;
    return { x: stage.x, y: stage.y, label: this.job.title };
  }

  /** Called when the current job finishes: pay out and advance. */
  completeJob(world) {
    const job = this.job;
    world.money += job.reward;
    this.completed += 1;
    this.banner = `JOB COMPLETE — ${job.title}  +$${job.reward}`;
    this.bannerTimer = 4;
    this.jobIndex += 1;
    this.stageIndex = 0;
    this.stageTimer = 0;
    this.holdTimer = 0;
    if (this.jobIndex >= MISSIONS.length) {
      this.storyDone = true;
      this.banner = 'THE BIG SCORE — DONE! Solmar Bay is yours, Jax.';
      this.bannerTimer = 6;
    } else {
      const next = this.job;
      this.banner = `${this.banner}  |  Next: ${next.title}`;
    }
    world.audio.chime();
    world.saveGame();
  }

  fail(reason) {
    this.failed = true;
    this.failReason = reason;
    this.banner = `JOB FAILED — ${reason}`;
    this.bannerTimer = 5;
  }

  /** Advance one frame. Returns nothing; world reads stage/job afterwards. */
  update(dt, world) {
    if (this.bannerTimer > 0) this.bannerTimer -= dt;
    if (this.storyDone || this.failed) return;
    const stage = this.stage;
    if (!stage) return;
    this.stageTimer += dt;
    const player = world.player;
    const px = player.x;
    const py = player.y;

    // A timed stage that runs out fails the job (retry from the same job).
    if (stage.time && this.stageTimer > stage.time) {
      this.fail(`${this.job.title}: out of time`);
      return;
    }

    switch (stage.kind) {
      case 'steal': {
        if (player.car) this.advance(world);
        break;
      }
      case 'reach': {
        const needCar = stage.inCar === true;
        if (dist(px, py, stage.x, stage.y) < 70 && (!needCar || player.car)) {
          this.advance(world);
        }
        break;
      }
      case 'grab': {
        if (dist(px, py, stage.x, stage.y) < 80) {
          this.holdTimer += dt;
          if (this.holdTimer >= (stage.hold ?? 3)) this.advance(world);
        } else {
          this.holdTimer = 0;
        }
        break;
      }
      case 'evade': {
        // Wanted level is set when the stage starts; reaching the marker
        // while the heat is down (wanted 0) completes it.
        if (dist(px, py, stage.x, stage.y) < 90 && world.wanted === 0) {
          this.advance(world);
        }
        break;
      }
      case 'survive': {
        if (this.stageTimer >= (stage.time ?? 60)) this.advance(world);
        break;
      }
      default:
        break;
    }
  }

  advance(world) {
    this.stageIndex += 1;
    this.stageTimer = 0;
    this.holdTimer = 0;
    const job = this.job;
    if (this.stageIndex >= job.stages.length) {
      this.completeJob(world);
      return;
    }
    // Entering a stage that names a wanted level raises the heat.
    const next = this.stage;
    if (next && next.wanted) world.setWanted(next.wanted);
    if (next && next.kind === 'survive') world.setWanted(next.wanted ?? 3);
    this.banner = `${job.title}: ${next.text}`;
    this.bannerTimer = 3.5;
  }

  /** Called by the world when a job fails and the player retries it. */
  retry() {
    this.stageIndex = 0;
    this.stageTimer = 0;
    this.holdTimer = 0;
    this.failed = false;
    this.failReason = '';
    this.banner = `${this.job.title} — try again, Jax.`;
    this.bannerTimer = 3;
  }

  serialize() {
    return {
      jobIndex: this.jobIndex,
      stageIndex: this.stageIndex,
      completed: this.completed,
      storyDone: this.storyDone,
    };
  }

  restore(data) {
    if (!data) return;
    this.jobIndex = data.jobIndex ?? 0;
    this.stageIndex = data.stageIndex ?? 0;
    this.completed = data.completed ?? 0;
    this.storyDone = data.storyDone ?? false;
  }
}
