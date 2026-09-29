// Shared constants - used by both server and client
// This mirrors data.js but in CommonJS for Node.js

const TILE = 16;
const MAP_W = 60;
const MAP_H = 60;

const T = {
  GRASS: 0, GRASS2: 1, WILDFLOWER: 2, PATH: 3, WATER: 4, SOIL: 5,
  SOIL_WET: 6, FLOOR: 7, WALL: 8, RUG: 9, STONE: 10, DECK: 11,
  BRIDGE: 12, SAND: 13, FENCE: 14, HARDWOOD: 15
};

const TILE_SOLID = [false, false, false, false, true, false, false, false, true, false, false, false, false, false, true, false];
const TILE_FARM = [true, true, true, false, false, true, true, false, false, false, false, false, false, false, false, false];
const TILE_WETABLE = [false, false, false, false, false, true, true, false, false, false, false, false, false, false, false, false];

const ENERGY = { till: 2, water: 1, chop: 3, mine: 3 };
const MAX_ENERGY = 127;
const WALK = 62;
const RUN = 96;
const SEC_PER_MIN = 0.45;
const DAY_START = 360;  // 6:00 AM
const DAY_END = 1560;   // 10:00 PM
const FARMABLE = { x0: 8, y0: 22, x1: 33, y1: 47 };

// Direction vectors
const DIRV = {
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
  left: { x: -1, y: 0 }, right: { x: 1, y: 0 }
};

// Items - must match client data.js
const ITEMS = {
  hoe: { n: 'Hoe', k: 'tool', tool: 'hoe' },
  can: { n: 'Watering Can', k: 'tool', tool: 'can' },
  axe: { n: 'Axe', k: 'tool', tool: 'axe' },
  pick: { n: 'Pickaxe', k: 'tool', tool: 'pick' },
  turnip_seeds: { n: 'Turnip Seeds', k: 'seed', crop: 'turnip', buy: 20, sell: 9 },
  carrot_seeds: { n: 'Carrot Seeds', k: 'seed', crop: 'carrot', buy: 35, sell: 16 },
  potato_seeds: { n: 'Potato Seeds', k: 'seed', crop: 'potato', buy: 50, sell: 24 },
  tomato_seeds: { n: 'Tomato Seeds', k: 'seed', crop: 'tomato', buy: 55, sell: 26 },
  corn_seeds: { n: 'Corn Seeds', k: 'seed', crop: 'corn', buy: 65, sell: 30 },
  strawberry_seeds: { n: 'Strawberry Seeds', k: 'seed', crop: 'strawberry', buy: 90, sell: 40 },
  pumpkin_seeds: { n: 'Pumpkin Seeds', k: 'seed', crop: 'pumpkin', buy: 180, sell: 80 },
  turnip: { n: 'Turnip', k: 'crop', crop: 'turnip', sell: 45, food: 18 },
  carrot: { n: 'Carrot', k: 'crop', crop: 'carrot', sell: 85, food: 22 },
  potato: { n: 'Potato', k: 'crop', crop: 'potato', sell: 110, food: 26 },
  tomato: { n: 'Tomato', k: 'crop', crop: 'tomato', sell: 125, food: 20 },
  corn: { n: 'Corn', k: 'crop', crop: 'corn', sell: 155, food: 24 },
  strawberry: { n: 'Strawberry', k: 'crop', crop: 'strawberry', sell: 190, food: 14 },
  pumpkin: { n: 'Pumpkin', k: 'crop', crop: 'pumpkin', sell: 440, food: 45 },
  veg_stew: { n: 'Veggie Stew', k: 'dish', sell: 240, food: 70 },
  omelette: { n: 'Herb Omelette', k: 'dish', sell: 175, food: 42 },
  berry_pie: { n: 'Berry Pie', k: 'dish', sell: 310, food: 55 },
  pumpkin_soup: { n: 'Pumpkin Soup', k: 'dish', sell: 430, food: 85 },
  wood: { n: 'Wood', k: 'mat', sell: 6 },
  stone: { n: 'Stone', k: 'mat', sell: 6 },
  gem: { n: 'Amethyst', k: 'mat', sell: 160 },
  berry: { n: 'Wild Berry', k: 'crop', sell: 30, food: 8 },
  egg: { n: 'Egg', k: 'crop', sell: 55, food: 10 },
  chicken: { n: 'Chicken', k: 'special', buy: 800 }
};

const CROPS = {
  turnip: { name: 'Turnip', days: 4, seeds: 'turnip_seeds', form: 'bulb' },
  carrot: { name: 'Carrot', days: 5, seeds: 'carrot_seeds', form: 'root' },
  potato: { name: 'Potato', days: 6, seeds: 'potato_seeds', form: 'lump' },
  strawberry: { name: 'Strawberry', days: 7, seeds: 'strawberry_seeds', form: 'cluster' },
  pumpkin: { name: 'Pumpkin', days: 9, seeds: 'pumpkin_seeds', form: 'big' },
  corn: { name: 'Corn', days: 6, seeds: 'corn_seeds', form: 'big' },
  tomato: { name: 'Tomato', days: 5, seeds: 'tomato_seeds', form: 'cluster' }
};

const RECIPES = [
  { out: 'veg_stew', need: { potato: 1, carrot: 1, turnip: 1 } },
  { out: 'omelette', need: { egg: 2 } },
  { out: 'berry_pie', need: { berry: 2, egg: 1, strawberry: 1 } },
  { out: 'pumpkin_soup', need: { pumpkin: 1, egg: 1, potato: 1 } }
];

const UPGRADES = [
  { id: 'bag', n: 'BIG BACKPACK', cost: 2500 },
  { id: 'chest', n: 'OAK CHEST', cost: 1500 },
  { id: 'tools', n: 'STEEL TOOLS', cost: 4000 }
];

const SHOP_STOCK = [
  'turnip_seeds', 'carrot_seeds', 'potato_seeds', 'tomato_seeds', 'corn_seeds',
  'strawberry_seeds', 'pumpkin_seeds', 'chicken'
];

// NPC definitions (simplified for server)
const NPC_DEFS = [
  { id: 'mira', name: 'Mira', map: 'farm', home: { x: 30, y: 17 }, range: { x0: 20, y0: 14, x1: 44, y1: 19 }, static: false },
  { id: 'bram', name: 'Bram', map: 'farm', home: { x: 47, y: 34 }, range: { x0: 36, y0: 24, x1: 56, y1: 52 }, static: false },
  { id: 'juniper', name: 'Juniper', map: 'shop', home: { x: 7, y: 5 }, range: { x0: 4, y0: 4, x1: 11, y1: 5 }, static: true },
  { id: 'pip', name: 'Pip', map: 'shop', home: { x: 12, y: 5 }, range: { x0: 11, y0: 4, x1: 13, y1: 5 }, static: false },
  { id: 'wren', name: 'Wren', map: 'farm', home: { x: 30, y: 19 }, range: { x0: 24, y0: 18, x1: 41, y1: 20 }, static: false },
  { id: 'sable', name: 'Sable', map: 'farm', home: { x: 48, y: 52 }, range: { x0: 44, y0: 51, x1: 54, y1: 55 }, static: false },
  { id: 'peony', name: 'Mayor Peony', map: 'hall', home: { x: 7, y: 4 }, range: { x0: 4, y0: 3, x1: 11, y1: 6 }, static: false },
  { id: 'odin', name: 'Odin', map: 'tavern', home: { x: 5, y: 3 }, range: null, static: true }
];

// Message types for network protocol
const MSG = {
  // Client -> Server
  JOIN: 'join',
  INPUT: 'input',
  CHAT: 'chat',
  PING: 'ping',
  // Server -> Client
  WELCOME: 'welcome',
  STATE: 'state',
  PLAYER_JOINED: 'player_joined',
  PLAYER_LEFT: 'player_left',
  CHAT: 'chat',
  PONG: 'pong',
  ERROR: 'error',
  LOBBY_INFO: 'lobby_info'
};

// Game states
const GAME_STATE = {
  LOBBY: 'lobby',
  PLAYING: 'playing'
};

module.exports = {
  TILE, MAP_W, MAP_H, T, TILE_SOLID, TILE_FARM, TILE_WETABLE,
  ENERGY, MAX_ENERGY, WALK, RUN, SEC_PER_MIN, DAY_START, DAY_END, FARMABLE,
  DIRV, ITEMS, CROPS, RECIPES, UPGRADES, SHOP_STOCK, NPC_DEFS,
  MSG, GAME_STATE
};