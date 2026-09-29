/* DATA — pure static content. Every constant the rest of the game reads.
   No DOM, no Game/World state, no side effects: safe to edit freely and the
   first thing to check when someone asks "where do I change X?".

   Layout
     tuning     TILE/ZOOM/MAP_*, T tile enum, per-tile flag tables, energy,
                movement speeds, day clock, FARMABLE field rect
     entities   CROPS, ITEMS, RECIPES, UPGRADES
     economy    SHOP_STOCK, TAVERN_STOCK
     people     NPC_DEFS (villagers: home/range/likes/loves/lines)
     narrative  STORY chapters, MAIL_TIPS / MAIL_REQUESTS letters,
                FRIEND_MILESTONES, GIFT_THANKS
     display    HELP_LINES, TILE_NAMES

   Cross-file contracts
     * T.<TILE> indexes must match the flag tables in the same order and the
       tile sprites built in sprites.js buildTiles().
     * ITEMS[<id>].k ('tool'|'seed'|'crop'|'mat'|'food') drives
       Game.use()/sell/gift branches — keep it lowercase and consistent.
     * Save/load serialises ids, never names: renaming an ITEM/CROP id
       breaks old saves. Add a new id instead of renaming. */

const TILE = 16;
const ZOOM = 3;
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
const DAY_START = 360;
const DAY_END = 1560;
const FARMABLE = { x0: 8, y0: 22, x1: 33, y1: 47 };

// ---- crops & items ------------------------------------------------

const CROPS = {
  turnip: { name: 'Turnip', days: 4, seeds: 'turnip_seeds', leaf: '#5fae44', leaf2: '#3f8a2f', fruit: '#f0eaf7', fruit2: '#b98fd0', form: 'bulb' },
  carrot: { name: 'Carrot', days: 5, seeds: 'carrot_seeds', leaf: '#4fae3f', leaf2: '#2f8a2f', fruit: '#ef8c2f', fruit2: '#c96a1a', form: 'root' },
  potato: { name: 'Potato', days: 6, seeds: 'potato_seeds', leaf: '#5aa844', leaf2: '#3c8430', fruit: '#cfa86e', fruit2: '#a37f4c', form: 'lump' },
  strawberry: { name: 'Strawberry', days: 7, seeds: 'strawberry_seeds', leaf: '#4fae3f', leaf2: '#2f8a2f', fruit: '#e0453f', fruit2: '#b02e2a', form: 'cluster' },
  pumpkin: { name: 'Pumpkin', days: 9, seeds: 'pumpkin_seeds', leaf: '#4c9c3c', leaf2: '#2f7a2a', fruit: '#e07b1f', fruit2: '#b25c12', form: 'big' },
  corn: { name: 'Corn', days: 6, seeds: 'corn_seeds', leaf: '#4f9c4a', leaf2: '#2f7a34', fruit: '#f0d24a', fruit2: '#c9a421', form: 'big' },
  tomato: { name: 'Tomato', days: 5, seeds: 'tomato_seeds', leaf: '#4aa83f', leaf2: '#2d7f2f', fruit: '#e0453f', fruit2: '#a82f28', form: 'cluster' }
};

const ITEMS = {
  hoe: { n: 'Hoe', k: 'tool', tool: 'hoe', d: 'Tills soil for planting' },
  can: { n: 'Watering Can', k: 'tool', tool: 'can', d: 'Waters tilled soil' },
  axe: { n: 'Axe', k: 'tool', tool: 'axe', d: 'Chops down trees' },
  pick: { n: 'Pickaxe', k: 'tool', tool: 'pick', d: 'Smashes rocks' },

  turnip_seeds: { n: 'Turnip Seeds', k: 'seed', crop: 'turnip', buy: 20, sell: 9, d: 'Grows in 4 days' },
  carrot_seeds: { n: 'Carrot Seeds', k: 'seed', crop: 'carrot', buy: 35, sell: 16, d: 'Grows in 5 days' },
  potato_seeds: { n: 'Potato Seeds', k: 'seed', crop: 'potato', buy: 50, sell: 24, d: 'Grows in 6 days' },
  tomato_seeds: { n: 'Tomato Seeds', k: 'seed', crop: 'tomato', buy: 55, sell: 26, d: 'Grows in 5 days' },
  corn_seeds: { n: 'Corn Seeds', k: 'seed', crop: 'corn', buy: 65, sell: 30, d: 'Grows in 6 days' },
  strawberry_seeds: { n: 'Strawberry Seeds', k: 'seed', crop: 'strawberry', buy: 90, sell: 40, d: 'Grows in 7 days' },
  pumpkin_seeds: { n: 'Pumpkin Seeds', k: 'seed', crop: 'pumpkin', buy: 180, sell: 80, d: 'Grows in 9 days' },

  turnip: { n: 'Turnip', k: 'crop', crop: 'turnip', sell: 45, food: 18, d: 'Crisp and peppery' },
  carrot: { n: 'Carrot', k: 'crop', crop: 'carrot', sell: 85, food: 22, d: 'Sweet crunch' },
  potato: { n: 'Potato', k: 'crop', crop: 'potato', sell: 110, food: 26, d: 'Hearty tuber' },
  tomato: { n: 'Tomato', k: 'crop', crop: 'tomato', sell: 125, food: 20, d: 'Juicy and warm' },
  corn: { n: 'Corn', k: 'crop', crop: 'corn', sell: 155, food: 24, d: 'Golden sweet cob' },
  strawberry: { n: 'Strawberry', k: 'crop', crop: 'strawberry', sell: 190, food: 14, d: 'Sun warm berry' },
  pumpkin: { n: 'Pumpkin', k: 'crop', crop: 'pumpkin', sell: 440, food: 45, d: 'A giant gourd' },

  veg_stew: { n: 'Veggie Stew', k: 'dish', sell: 240, food: 70, d: 'Simmered roots, so warm' },
  omelette: { n: 'Herb Omelette', k: 'dish', sell: 175, food: 42, d: 'Farm fresh eggs' },
  berry_pie: { n: 'Berry Pie', k: 'dish', sell: 310, food: 55, d: 'Golden flaky crust' },
  pumpkin_soup: { n: 'Pumpkin Soup', k: 'dish', sell: 430, food: 85, d: 'Silky and sweet' },

  wood: { n: 'Wood', k: 'mat', sell: 6, d: 'Building material' },
  stone: { n: 'Stone', k: 'mat', sell: 6, d: 'Building material' },
  gem: { n: 'Amethyst', k: 'mat', sell: 160, d: 'Sparkles in the light' },
  berry: { n: 'Wild Berry', k: 'crop', sell: 30, food: 8, d: 'Foraged from bushes' },
  egg: { n: 'Egg', k: 'crop', sell: 55, food: 10, d: 'Fresh from the coop' }
};

// ---- crafting, upgrades & shop stock ------------------------------

const RECIPES = [
  { out: 'veg_stew', need: { potato: 1, carrot: 1, turnip: 1 }, d: 'SIMMER ROOTS OVER A SLOW FLAME' },
  { out: 'omelette', need: { egg: 2 }, d: 'TWO EGGS AND A PINCH OF HERB' },
  { out: 'berry_pie', need: { berry: 2, egg: 1, strawberry: 1 }, d: 'SWEET, WATCH THE CRUST' },
  { out: 'pumpkin_soup', need: { pumpkin: 1, egg: 1, potato: 1 }, d: 'ENOUGH FOR THE WHOLE VALLEY' }
];

const UPGRADES = [
  { id: 'bag', n: 'BIG BACKPACK', cost: 2500, d: 'CARRY 50 SLOTS INSTEAD OF 30' },
  { id: 'chest', n: 'OAK CHEST', cost: 1500, d: 'DOUBLE YOUR HOUSE CHEST SPACE' },
  { id: 'tools', n: 'STEEL TOOLS', cost: 4000, d: 'EVERY TOOL SWING COSTS 1 LESS ENERGY' }
];

const SHOP_STOCK = [
  'turnip_seeds', 'carrot_seeds', 'potato_seeds', 'tomato_seeds', 'corn_seeds',
  'strawberry_seeds', 'pumpkin_seeds', 'chicken'
];

const TAVERN_STOCK = ['omelette', 'veg_stew', 'berry_pie', 'pumpkin_soup'];

// ---- villagers (dialogue, home range, gift tastes) ----------------

const NPC_DEFS = [
  {
    id: 'mira', name: 'Mira', palette: 'mira', map: 'farm',
    home: { x: 30, y: 17 }, range: { x0: 20, y0: 14, x1: 44, y1: 19 },
    likes: ['crop', 'seed'], loves: ['pumpkin', 'strawberry'],
    lines: [
      'The soil here loves a good watering. Crops drink it up!',
      'I sell nothing, but I sure do love looking at your farm.',
      'Rain is a farmer\'s free helper. Watch the sky!',
      'Pumpkins take forever, but oh, the price they fetch.'
    ]
  },
  {
    id: 'bram', name: 'Bram', palette: 'bram', map: 'farm',
    home: { x: 47, y: 34 }, range: { x0: 36, y0: 24, x1: 56, y1: 52 },
    likes: ['mat'], loves: ['gem', 'egg'],
    lines: [
      'Rocks out here hide amethysts. Bring a pickaxe!',
      'I nap by the pond. The lily pads make a fine pillow.',
      'Chop a tree, leave the stump. It grows back, promise.',
      'Watch out for the deep water past the sand, eh?'
    ]
  },
  {
    id: 'juniper', name: 'Juniper', palette: 'juniper', map: 'shop',
    home: { x: 7, y: 5 }, range: { x0: 4, y0: 4, x1: 11, y1: 5 },
    likes: ['crop'], loves: ['strawberry', 'egg'],
    lines: [
      'Welcome in! Seeds are on the shelf, eggs in your pocket.',
      'Buy low, grow high. That is the whole secret.',
      'Your chickens lay whether you watch or not. Handy!'
    ],
    best: [
      'I set aside the good stock for you. Don\'t tell anyone.',
      'You are the reason this store still has a roof.'
    ]
  },
  {
    id: 'pip', name: 'Pip', palette: 'pip', map: 'shop',
    home: { x: 12, y: 5 }, range: { x0: 11, y0: 4, x1: 13, y1: 5 },
    likes: ['crop', 'dish'], loves: ['corn', 'omelette'],
    lines: [
      'I alphabetise the seed shelf every single morning!',
      'Ask Juniper about the upgrades tab. Go on, ask!',
      'I say she counts too much. She says I talk too much.',
      'The big backpack fits forty more turnips. Probably.'
    ],
    best: [
      'You are my best customer. Officially. I wrote it down.',
      'I am saving for my own shop one day. Maybe.'
    ]
  },
  {
    id: 'wren', name: 'Wren', palette: 'wren', map: 'farm',
    home: { x: 30, y: 19 }, range: { x0: 24, y0: 18, x1: 41, y1: 20 },
    likes: ['crop'], loves: ['berry', 'tomato', 'corn'],
    lines: [
      'The woods are singing today. Can you hear it?',
      'Wild berries grow on the bushes at the forest edge.',
      'I track deer prints up north. You should come along.',
      'A farmer and a ranger make fine neighbours.'
    ],
    best: [
      'I saved you a spot by the fire tonight.',
      'The birds have stopped fearing your farm. Good sign.'
    ]
  },
  {
    id: 'sable', name: 'Sable', palette: 'sable', map: 'farm',
    home: { x: 48, y: 52 }, range: { x0: 44, y0: 51, x1: 54, y1: 55 },
    likes: ['mat', 'dish'], loves: ['gem', 'berry_pie'],
    lines: [
      'The pond keeps secrets. So do I.',
      'Amethysts only grow where the water once ran.',
      'I fish at dusk. The light goes soft, then gold.',
      'You have the look of someone building something.'
    ],
    best: [
      'One day I will tell you why I came to Sunvale.',
      'For you, the water parts. Take this kindness.'
    ]
  },
  {
    id: 'peony', name: 'Mayor Peony', palette: 'peony', map: 'hall',
    home: { x: 7, y: 4 }, range: { x0: 4, y0: 3, x1: 11, y1: 6 },
    likes: ['crop', 'dish'], loves: ['pumpkin', 'veg_stew'],
    lines: [
      'Sunvale runs on kindness and a good harvest.',
      'The board by the door lists what the valley needs.',
      'Every farm here started with one turnip and a dream.',
      'The festival is coming. We shall need your finest crops.'
    ],
    best: [
      'I am putting your name on the hall wall, dear.',
      'Sunvale chose well the day you arrived.'
    ]
  },
  {
    id: 'odin', name: 'Odin', palette: 'odin', map: 'tavern',
    home: { x: 5, y: 3 }, static: true,
    likes: ['crop', 'dish'], loves: ['veg_stew', 'pumpkin_soup'],
    lines: [
      'Sit, sit! The stew is on and the fire is lit.',
      'The stove in your house knows my recipes. Try them.',
      'Every good farm ends up on a plate in here.',
      'The rafters hold a hundred years of laughter.'
    ],
    best: [
      'First round is on the house. Always.',
      'You eat like someone who works. I respect that.'
    ]
  }
];

// ---- narrative: chapters, letters, milestones ---------------------

const STORY = [
  {
    id: 'arrival', title: 'A NEW BEGINNING', giver: 'peony',
    desc: 'MEET MAYOR PEONY IN THE TOWN HALL',
    obj: [{ type: 'talk', npc: 'peony' }],
    outro: [
      'AH! YOU MUST BE THE NEW FARMER. WELCOME, WELCOME.',
      'SUNVALE HAS FALLEN ON HARD TIMES SINCE THE MILLS CLOSED.',
      'PROVE YOUR FARM CAN FEED THIS VALLEY. START WITH FIVE TURNIPS.'
    ],
    reward: { money: 200 }
  },
  {
    id: 'harvest', title: 'THE FIRST HARVEST', giver: 'peony',
    desc: 'BRING 5 TURNIPS TO YOUR CHEST OR POCKETS',
    obj: [{ type: 'collect', id: 'turnip', n: 5 }],
    outro: [
      'FIVE TURNIPS! THE VALLEY WHISPERS ABOUT YOU ALREADY.',
      'BRAM NEEDS TIMBER FOR THE OLD FOOTBRIDGE.',
      'CHOP TREES AT THE FOREST EDGE AND SEND HIM 20 WOOD.'
    ],
    reward: { money: 400, items: { pumpkin_seeds: 2 } }
  },
  {
    id: 'timber', title: 'TIMBER FOR THE BRIDGE', giver: 'bram',
    desc: 'COLLECT 20 WOOD FOR BRAM',
    obj: [{ type: 'collect', id: 'wood', n: 20 }],
    outro: [
      'TWENTY LENGTHS! THAT BRIDGE WILL STAND ANOTHER CENTURY.',
      'SABLE DOWN BY THE POND HAS BEEN ASKING AFTER YOU.',
      'SHE WANTS 3 AMETHYSTS. THE PALE ROCKS BY THE POND HOLD THEM.'
    ],
    reward: { money: 500, items: { potato_seeds: 3 } }
  },
  {
    id: 'gems', title: 'A SPARK IN THE STONE', giver: 'sable',
    desc: 'DELIVER 3 AMETHYSTS TO SABLE BY THE POND',
    obj: [{ type: 'deliver', id: 'gem', n: 3, npc: 'sable' }],
    outro: [
      'THREE SPARKS OF OLD SUNVALE. YOU LISTEN WELL, FARMER.',
      'ODIN AT THE TAVERN IS PLANNING A FEAST.',
      'COOK 3 DISHES ON YOUR HOME STOVE AND HE WILL BE IMPRESSED.'
    ],
    reward: { money: 1500 }
  },
  {
    id: 'feast', title: 'A TABLE FOR SUNVALE', giver: 'odin',
    desc: 'COOK 3 DISHES ON YOUR STOVE AT HOME',
    obj: [{ type: 'cook', n: 3 }],
    outro: [
      'THREE DISHES AND NOT A BURNT CRUST IN SIGHT!',
      'JUNIPER WANTS PROOF YOUR FARM PAYS ITS WAY.',
      'SELL GOODS WORTH 3000G AT THE GENERAL STORE.'
    ],
    reward: { money: 800, items: { egg: 3 } }
  },
  {
    id: 'market', title: 'A FAIR EXCHANGE', giver: 'juniper',
    desc: 'SELL GOODS WORTH 3000G AT THE STORE',
    obj: [{ type: 'sold', n: 3000 }],
    outro: [
      'THREE THOUSAND GOLD! THE STORE IS BUZZING ABOUT YOU.',
      'THE FESTIVAL NEEDS YOUR BEST GROW.',
      'BRING ME A PUMPKIN AND 5 CORN AND SUNVALE WILL CELEBRATE.'
    ],
    reward: { money: 700, items: { strawberry_seeds: 2 } }
  },
  {
    id: 'festival', title: 'THE SUNVALE FESTIVAL', giver: 'peony',
    desc: 'GROW 1 PUMPKIN AND 5 CORN FOR THE FESTIVAL',
    obj: [{ type: 'collect', id: 'pumpkin', n: 1 }, { type: 'collect', id: 'corn', n: 5 }],
    outro: [
      'THE WHOLE VALLEY IS EATING AT YOUR TABLE TONIGHT.',
      'SUNVALE LIVES AGAIN, FARMER. YOU DID THIS.',
      'THE STORIES WILL BE TOLD LONG AFTER THE LANTERNS GO OUT.'
    ],
    reward: { money: 3000 }
  }
];

const MAIL_TIPS = [
  {
    from: 'MIRA', subject: 'WATERING WISDOM',
    body: ['Dear farmer, crops drink best when', 'the soil stays wet overnight.', 'Rain counts too - watch the sky!']
  },
  {
    from: 'BRAM', subject: 'ROCKS AND TREASURE',
    body: ['Amethysts hide in the pale rocks', 'out past the sand by the pond.', 'Bring a pickaxe and a full energy bar.']
  },
  {
    from: 'JUNIPER', subject: 'MARKET DAY',
    body: ['The store pays full price for anything', 'you grow or mine.', 'Seeds are restocked every single day.']
  },
  {
    from: 'SUNVALE POST', subject: 'VILLAGE FLYER',
    body: ['CHICKENS LAY EGGS OVERNIGHT.', 'PET YOUR BIRDS DAILY FOR FRIENDSHIP.', 'THE COOP HOLDS UP TO SIX HENS.']
  },
  {
    from: 'MIRA', subject: 'PUMPKIN SEASON',
    body: ['Pumpkins take nine whole days but', 'fetch a giant price.', 'Plant them early and forget them.']
  },
  {
    from: 'BRAM', subject: 'STUMP WATCH',
    body: ['Chopped trees leave stumps behind.', 'They sprout again in a few days,', 'so the forest always comes back.']
  },
  {
    from: 'JUNIPER', subject: 'A FULL STOMACH',
    body: ['Eating a crop restores energy.', 'Keep a berry or two in your pocket', 'so you never pass out at dusk.']
  },
  {
    from: 'SUNVALE POST', subject: 'WEATHER ALMANAC',
    body: ['Storms soak every tilled plot at once.', 'Sunny days dry the soil right out.', 'Plan your watering around the forecast.']
  },
  {
    from: 'BRAM', subject: 'SEND A GIFT',
    body: ['Hold an item and press G near a', 'villager to gift it. Crops win hearts.', 'Loved gifts win the most!']
  },
  {
    from: 'MIRA', subject: 'ABOUT THE MAILBOX',
    body: ['Your requests from the village arrive', 'here each morning. Deliver what they', 'ask for and the gold is yours.']
  }
];

const MAIL_REQUESTS = [
  {
    from: 'MIRA', npc: 'mira', subject: 'A SMALL FAVOR',
    body: ['Could you spare three turnips?', 'I am making a stew for Bram.', 'I will pay you well for them.'],
    req: { item: 'turnip', n: 3, gold: 200 }
  },
  {
    from: 'BRAM', npc: 'bram', subject: 'FENCE REPAIR',
    body: ['My fence down by the pond is', 'falling apart again. Send me eight', 'lengths of wood and I will fix it.'],
    req: { item: 'wood', n: 8, gold: 240 }
  },
  {
    from: 'JUNIPER', npc: 'juniper', subject: 'BAKING ORDER',
    body: ['Four fresh eggs, if you have them.', 'The morning rush needs baking', 'and the gold is ready and waiting.'],
    req: { item: 'egg', n: 4, gold: 340 }
  },
  {
    from: 'MIRA', npc: 'mira', subject: 'JAM TIME',
    body: ['Five wild berries would be lovely.', 'I am putting up jam for the winter', 'and I will trade gold for them.'],
    req: { item: 'berry', n: 5, gold: 260 }
  },
  {
    from: 'BRAM', npc: 'bram', subject: 'PATH WORK',
    body: ['The village path needs mending.', 'Send eight stone my way and consider', 'the whole town grateful.'],
    req: { item: 'stone', n: 8, gold: 250 }
  },
  {
    from: 'JUNIPER', npc: 'juniper', subject: 'SOUP SPECIAL',
    body: ['The store is running a carrot soup', 'special this week. Four carrots from', 'you and the profit is yours.'],
    req: { item: 'carrot', n: 4, gold: 460 }
  },
  {
    from: 'MIRA', npc: 'mira', subject: 'PICNIC SUPPLY',
    body: ['Three ripe strawberries, please.', 'We are having a picnic by the pond', 'and I will pay top gold for them.'],
    req: { item: 'strawberry', n: 3, gold: 760 }
  },
  {
    from: 'BRAM', npc: 'bram', subject: 'JEWEL TRADE',
    body: ['One amethyst and I can trade up', 'with the travelling merchant.', 'Send it my way, friend!'],
    req: { item: 'gem', n: 1, gold: 560 }
  }
];

const FRIEND_MILESTONES = [
  {
    at: 10, item: 'turnip_seeds', n: 3, subject: 'A LITTLE SOMETHING',
    body: ['You have been kind to me lately,', 'so I saved you some seeds.', 'Plant them and think of me!']
  },
  {
    at: 25, item: 'carrot_seeds', n: 3, subject: 'THANK YOU GIFT',
    body: ['A proper thank you from the village.', 'These carrots grow sweet and quick.', 'Do not sell them all at once.']
  },
  {
    at: 45, item: 'potato_seeds', n: 3, subject: 'FOR A GOOD FRIEND',
    body: ['We do not say it enough out here:', 'you are a good friend to Sunvale.', 'Please take these seeds.']
  },
  {
    at: 70, item: 'strawberry_seeds', n: 4, subject: 'FROM THE HEART',
    body: ['You are practically family now.', 'The whole village talks about your', 'farm. These are the best I have.']
  }
];

const GIFT_THANKS = [
  'THANK YOU! THIS IS JUST WHAT I WANTED.',
  'HOW THOUGHTFUL OF YOU!',
  'YOU HAVE A KIND HEART, FARMER.',
  'I WILL TREASURE THIS. THANK YOU!'
];

// ---- display strings (help overlay, tile names) -------------------

const HELP_LINES = [
  'MOVE        WASD / ARROWS',
  'USE TOOL    SPACE / CLICK',
  'INTERACT    E',
  'GIVE GIFT   G',
  'RUN         SHIFT',
  'HOTBAR      1 - 0 KEYS',
  'INVENTORY   I OR TAB',
  'JOURNAL     J',
  'MAIL        MAILBOX / ENVELOPE',
  'MUTE MUSIC  M',
  'PAUSE       ESC',
  'CLOSE       ESC'
];

const TILE_NAMES = ['grass', 'grass', 'flowers', 'path', 'water', 'soil', 'wet soil',
  'floor', 'wall', 'rug', 'stone', 'deck', 'bridge', 'sand', 'fence', 'hardwood'];
