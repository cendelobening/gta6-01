// SOLMAR HEAT — configuration: world size, colours, tuning, districts and the
// five-job story. Every value the rest of the game reads lives here so the
// balance can be tuned in one place.
export const WORLD = { width: 3600, height: 2600 };
export const VIEW = { width: 1280, height: 720 };
export const STEP = 1 / 60;

export const PLAYER = {
  walkSpeed: 200,
  runSpeed: 290,
  radius: 13,
  health: 100,
  shootCooldown: 0.22,
  bulletSpeed: 900,
  bulletDamage: 34,
};

export const CAR = {
  maxSpeed: 460,
  accel: 320,
  brake: 520,
  reverseMax: 150,
  steer: 2.6,
  length: 46,
  width: 22,
};

export const POLICE = {
  maxSpeed: 500,
  accel: 360,
  ramDamage: 9,
  spawnDistance: 700,
};

// Sun-soaked coastal palette: warm sand, teal sea, terracotta roofs.
export const COLORS = {
  grass: '#7fae5a',
  park: '#69a34e',
  sand: '#e8cf9a',
  sea: '#2e7f9e',
  seaDeep: '#226b8a',
  road: '#3d3a38',
  roadLine: '#e8d44d',
  sidewalk: '#b9b2a4',
  buildingRoof: ['#c96f4a', '#d9a05b', '#a85f6e', '#7d8aa5', '#b0825a', '#8a6f9e'],
  buildingWall: '#e6ddc9',
  car: ['#d94f3d', '#3d7dd9', '#e8b93d', '#7dd94f', '#c9c9c9', '#8a5fd9', '#3dd9c4'],
  policeCar: '#2b3a55',
  player: '#f2c14e',
  ped: ['#e8e8e8', '#5a8ad9', '#d95a8a', '#7ad95a', '#e8a35a'],
  hud: '#101820',
};

export const DISTRICTS = [
  { name: 'Marina Bay', x: 0, y: 300, w: 620, h: 2000, tint: '#e8cf9a' },
  { name: 'Old Town', x: 620, y: 0, w: 1100, h: 900, tint: '#d9c9a8' },
  { name: 'Downtown', x: 620, y: 900, w: 1100, h: 1000, tint: '#c9b8a0' },
  { name: 'Harbour South', x: 620, y: 1900, w: 1100, h: 700, tint: '#b8a88e' },
  { name: 'Palm Hills', x: 1720, y: 0, w: 1880, h: 2600, tint: '#c9d9a8' },
];

export const LANDMARKS = [
  { name: 'Solmar Pier', x: 180, y: 1250, kind: 'pier' },
  { name: 'Bay Tower', x: 1080, y: 1330, kind: 'tower' },
  { name: 'Marina Market', x: 420, y: 700, kind: 'market' },
  { name: 'Grand Casino', x: 1450, y: 1150, kind: 'casino' },
  { name: 'Bay Bank', x: 1150, y: 1500, kind: 'bank' },
  { name: 'Sunset Stadium', x: 2600, y: 1900, kind: 'stadium' },
  { name: 'Rico\u2019s Garage', x: 900, y: 1750, kind: 'garage' },
  { name: 'Hideout', x: 2900, y: 600, kind: 'hideout' },
];

// The five jobs Rico Vane hands Jax Marlowe. Each job is a chain of stages;
// a stage is { kind, x, y, text, time? } and completes when the player (or the
// player's car) reaches its marker, or its timer / condition is met.
export const MISSIONS = [
  {
    id: 1,
    title: 'First Wheels',
    giver: 'Rico Vane',
    reward: 250,
    briefing:
      'New in town, kid? Every wheelman needs wheels. Borrow a car — any car — and bring it to my garage.',
    stages: [
      { kind: 'steal', text: 'Steal a car (walk up to one and press E)', x: 0, y: 0 },
      { kind: 'reach', text: 'Drive to Rico\u2019s Garage', x: 920, y: 1800, inCar: true },
    ],
  },
  {
    id: 2,
    title: 'The Package',
    giver: 'Rico Vane',
    reward: 500,
    briefing:
      'A package is waiting at Marina Market. Pick it up and drop it at the Grand Casino. No detours, no cops.',
    stages: [
      { kind: 'reach', text: 'Pick up the package at Marina Market', x: 420, y: 700 },
      { kind: 'reach', text: 'Deliver the package to the Grand Casino', x: 1520, y: 1200, time: 150 },
    ],
  },
  {
    id: 3,
    title: 'Getaway Driver',
    giver: 'Rico Vane',
    reward: 900,
    briefing:
      'My crew is stuck at Bay Tower with the heat on. Pick up Lena, then lose the cops and get her to the Hideout.',
    stages: [
      { kind: 'reach', text: 'Pick up Lena at Bay Tower', x: 1080, y: 1200 },
      { kind: 'evade', text: 'Lose the cops, then reach the Hideout', x: 2900, y: 600, wanted: 2 },
    ],
  },
  {
    id: 4,
    title: 'Heat Wave',
    giver: 'Rico Vane',
    reward: 1400,
    briefing:
      'The whole Solmar PD is on us. Survive the heat — stay alive, shake the tail, and lay low at the Hideout.',
    stages: [
      { kind: 'survive', text: 'Survive the police hunt — stay alive', x: 2900, y: 600, time: 75, wanted: 3 },
      { kind: 'reach', text: 'Reach the Hideout once the heat cools', x: 2900, y: 600 },
    ],
  },
  {
    id: 5,
    title: 'The Big Score',
    giver: 'Rico Vane',
    reward: 3000,
    briefing:
      'One last job: the Bay Bank vault. Grab the score, outrun the whole city, and meet me at Solmar Pier. Make me proud, Jax.',
    stages: [
      { kind: 'reach', text: 'Hit the Bay Bank', x: 1150, y: 1500, time: 20 },
      { kind: 'grab', text: 'Grab the score (stand in the vault)', x: 1150, y: 1500, hold: 4 },
      { kind: 'evade', text: 'Escape to Solmar Pier — the whole city is coming', x: 300, y: 1250, wanted: 4 },
    ],
  },
];

export const SAVE_KEY = 'solmar-heat-save-v1';
