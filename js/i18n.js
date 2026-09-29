/* I18N — localisation core (30 languages, auto localisation).
   Load order: data.js -> i18n.js -> lang_*.js
   (each calls I18N_ADD(code, dict)) -> applyDataTranslations() rewrites the
   CROPS/ITEMS/NPC_DEFS/MAIL_* strings in place. Game/UI then call L().

   NOTE: the translate helper is named L(), NOT T(), because data.js already
   declares the tile enum `const T`. Same global scope, so T() would throw.

   Also here: PixelFont unicode fallback so CJK/Arabic/Cyrillic glyphs render
   instead of falling back to '?'.

   State: current language is persisted under LANG_FILE in localStorage. */

// Sunvale i18n core — 30 languages, auto localisation.
// Load order: data.js -> i18n.js -> lang_*.js -> game/ui/world patches use T().
// PixelFont unicode fallback is installed here so CJK/Arabic/etc render.

// ---- language registry -------------------------------------------

const SUPPORTED_LANGS = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'it', name: 'Italiano' },
  { code: 'pt', name: 'Português' },
  { code: 'nl', name: 'Nederlands' },
  { code: 'pl', name: 'Polski' },
  { code: 'ru', name: 'Русский' },
  { code: 'uk', name: 'Українська' },
  { code: 'tr', name: 'Türkçe' },
  { code: 'ar', name: 'العربية' },
  { code: 'hi', name: 'हिन्दी' },
  { code: 'bn', name: 'বাংলা' },
  { code: 'zh-CN', name: '简体中文' },
  { code: 'zh-TW', name: '繁體中文' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'th', name: 'ไทย' },
  { code: 'vi', name: 'Tiếng Việt' },
  { code: 'id', name: 'Bahasa Indonesia' },
  { code: 'ms', name: 'Bahasa Melayu' },
  { code: 'sv', name: 'Svenska' },
  { code: 'no', name: 'Norsk' },
  { code: 'da', name: 'Dansk' },
  { code: 'fi', name: 'Suomi' },
  { code: 'el', name: 'Ελληνικά' },
  { code: 'he', name: 'עברית' },
  { code: 'cs', name: 'Čeština' },
  { code: 'ro', name: 'Română' }
];

const I18N = {};
const LANG_FILE = 'sunvale_lang_v1';

function I18N_ADD(code, dict) {
  I18N[code] = Object.assign({}, I18N[code] || {}, dict);
}

I18N_ADD('en', {
  'title': 'SUNVALE',
  'subtitle': 'A COZY PIXEL FARM LIFE',
  'start': 'START FARM',
  'continue': 'CONTINUE FARM',
  'new': 'NEW FARM',
  'controls1': 'WASD MOVE   E INTERACT   SPACE USE TOOL',
  'controls2': 'I INVENTORY   H HELP   M MUSIC   ESC PAUSE',
  'fanmade': 'A FAN-MADE COZY FARMING GAME',
  'language': 'LANGUAGE',
  'day': 'DAY',
  'mail': 'MAIL',
  'empty_hands': 'EMPTY HANDS',
  'enter': 'ENTER',
  'leave': 'LEAVE',
  'sleep': 'SLEEP',
  'watch_tv': 'WATCH TV',
  'open_chest': 'OPEN CHEST',
  'read': 'READ',
  'check_mail': 'CHECK MAIL',
  'shop': 'SHOP',
  'pet_chicken': 'PET CHICKEN',
  'talk_to': 'TALK TO {x}',
  'harvest': 'HARVEST {x}',
  'harvest_generic': 'HARVEST',
  'check_mail_new': 'CHECK MAIL ({x} NEW)',
  'sells_for': 'SELLS FOR {x}G   {y}',
  'costs': 'COSTS {x}G   {y}',
  'energy_food': '+{x} ENERGY   {y}',
  'close': 'CLOSE',
  'inventory': 'INVENTORY',
  'inventory_chest': 'INVENTORY + CHEST',
  'chest': 'CHEST',
  'general_store': 'GENERAL STORE',
  'shop_quote': 'JUNIPER: "TAKE YOUR PICK, FARMER."',
  'buy': 'BUY',
  'sell': 'SELL',
  'nothing_sell': 'NOTHING TO SELL YET.',
  'sell_everything': 'SELL EVERYTHING',
  'close_esc': 'CLOSE [ESC]',
  'mailbox': 'MAILBOX',
  'unread': '{x} UNREAD',
  'caught_up': 'ALL CAUGHT UP',
  'no_mail': 'NO MAIL YET.',
  'letters_arrive': 'LETTERS ARRIVE',
  'each_morning': 'EACH MORNING.',
  'letters': '{x} LETTER{s}',
  'mailbox_empty': 'THE MAILBOX IS EMPTY.',
  'village_requests': 'VILLAGE REQUESTS AND GIFTS',
  'arrive_sleep': 'ARRIVE HERE AFTER YOU SLEEP.',
  'from': 'FROM {x}   DAY {y}',
  'request_from': 'REQUEST FROM {x}',
  'have': 'HAVE {x} OF {y}',
  'reward': 'REWARD {x}G',
  'delivered': 'DELIVERED',
  'need_more': 'NEED MORE',
  'deliver': 'DELIVER',
  'enclosed_with': 'ENCLOSED WITH {x}',
  'taken': 'TAKEN',
  'claim': 'CLAIM',
  'nothing_enclosed': '- NOTHING ENCLOSED -',
  'delete': 'DELETE',
  'enter_claims': 'ENTER CLAIMS OR DELIVERS',
  'paused': 'PAUSED',
  'resume': 'RESUME',
  'save_game': 'SAVE GAME',
  'how_to_play': 'HOW TO PLAY',
  'music_on': 'MUSIC: ON',
  'music_off': 'MUSIC: OFF',
  'quit_title': 'QUIT TO TITLE',
  'progress_sleep': 'PROGRESS SAVES WHEN YOU SLEEP',
  'sunny': 'SUNNY',
  'rain': 'RAIN',
  'storm': 'STORM',
  'mon': 'MON', 'tue': 'TUE', 'wed': 'WED', 'thu': 'THU', 'fri': 'FRI', 'sat': 'SAT', 'sun': 'SUN',
  'best_friends': 'BEST FRIENDS',
  'friendship': 'FRIENDSHIP',
  'f_full': 'FRIENDSHIP',
  // help
  'help.0': 'MOVE        WASD / ARROWS',
  'help.1': 'USE TOOL    SPACE / CLICK',
  'help.2': 'INTERACT    E',
  'help.3': 'GIVE GIFT   G',
  'help.4': 'RUN         SHIFT',
  'help.5': 'HOTBAR      1 - 0 KEYS',
  'help.6': 'INVENTORY   I OR TAB',
  'help.7': 'JOURNAL     J',
  'help.8': 'MAIL        MAILBOX / ENVELOPE',
  'help.9': 'MUTE MUSIC  M',
  'help.10': 'PAUSE       ESC',
  'help.11': 'CLOSE       ESC',
  'tip.0': 'USE THE HOE ON GRASS IN YOUR FIELD,',
  'tip.1': 'PLANT SEEDS, THEN WATER EVERY DAY.',
  'tip.2': 'SLEEP IN YOUR BED TO ADVANCE THE DAY.',
  'tip.3': 'SELL CROPS AT THE GENERAL STORE.',
  'tip.4': 'EATING FOOD RESTORES ENERGY.',
  // items
  'item.hoe.name': 'Hoe', 'item.hoe.desc': 'Tills soil for planting',
  'item.can.name': 'Watering Can', 'item.can.desc': 'Waters tilled soil',
  'item.axe.name': 'Axe', 'item.axe.desc': 'Chops down trees',
  'item.pick.name': 'Pickaxe', 'item.pick.desc': 'Smashes rocks',
  'item.turnip_seeds.name': 'Turnip Seeds', 'item.turnip_seeds.desc': 'Grows in 4 days',
  'item.carrot_seeds.name': 'Carrot Seeds', 'item.carrot_seeds.desc': 'Grows in 5 days',
  'item.potato_seeds.name': 'Potato Seeds', 'item.potato_seeds.desc': 'Grows in 6 days',
  'item.tomato_seeds.name': 'Tomato Seeds', 'item.tomato_seeds.desc': 'Grows in 5 days',
  'item.corn_seeds.name': 'Corn Seeds', 'item.corn_seeds.desc': 'Grows in 6 days',
  'item.strawberry_seeds.name': 'Strawberry Seeds', 'item.strawberry_seeds.desc': 'Grows in 7 days',
  'item.pumpkin_seeds.name': 'Pumpkin Seeds', 'item.pumpkin_seeds.desc': 'Grows in 9 days',
  'item.turnip.name': 'Turnip', 'item.turnip.desc': 'Crisp and peppery',
  'item.carrot.name': 'Carrot', 'item.carrot.desc': 'Sweet crunch',
  'item.potato.name': 'Potato', 'item.potato.desc': 'Hearty tuber',
  'item.tomato.name': 'Tomato', 'item.tomato.desc': 'Juicy and warm',
  'item.corn.name': 'Corn', 'item.corn.desc': 'Golden sweet cob',
  'item.strawberry.name': 'Strawberry', 'item.strawberry.desc': 'Sun warm berry',
  'item.pumpkin.name': 'Pumpkin', 'item.pumpkin.desc': 'A giant gourd',
  'item.veg_stew.name': 'Veggie Stew', 'item.veg_stew.desc': 'Simmered roots, so warm',
  'item.omelette.name': 'Herb Omelette', 'item.omelette.desc': 'Farm fresh eggs',
  'item.berry_pie.name': 'Berry Pie', 'item.berry_pie.desc': 'Golden flaky crust',
  'item.pumpkin_soup.name': 'Pumpkin Soup', 'item.pumpkin_soup.desc': 'Silky and sweet',
  'item.wood.name': 'Wood', 'item.wood.desc': 'Building material',
  'item.stone.name': 'Stone', 'item.stone.desc': 'Building material',
  'item.gem.name': 'Amethyst', 'item.gem.desc': 'Sparkles in the light',
  'item.berry.name': 'Wild Berry', 'item.berry.desc': 'Foraged from bushes',
  'item.egg.name': 'Egg', 'item.egg.desc': 'Fresh from the coop',
  'item.chicken.name': 'CHICKEN', 'item.chicken.desc': 'A FRIENDLY BIRD',
  // crops
  'crop.turnip': 'Turnip', 'crop.carrot': 'Carrot', 'crop.potato': 'Potato',
  'crop.strawberry': 'Strawberry', 'crop.pumpkin': 'Pumpkin', 'crop.corn': 'Corn', 'crop.tomato': 'Tomato',
  // recipes / upgrades
  'recipe.veg_stew': 'SIMMER ROOTS OVER A SLOW FLAME',
  'recipe.omelette': 'TWO EGGS AND A PINCH OF HERB',
  'recipe.berry_pie': 'SWEET, WATCH THE CRUST',
  'recipe.pumpkin_soup': 'ENOUGH FOR THE WHOLE VALLEY',
  'upgrade.bag': 'BIG BACKPACK', 'upgrade.bag.d': 'CARRY 50 SLOTS INSTEAD OF 30',
  'upgrade.chest': 'OAK CHEST', 'upgrade.chest.d': 'DOUBLE YOUR HOUSE CHEST SPACE',
  'upgrade.tools': 'STEEL TOOLS', 'upgrade.tools.d': 'EVERY TOOL SWING COSTS 1 LESS ENERGY',
  // npcs
  'npc.mira': 'Mira', 'npc.bram': 'Bram', 'npc.juniper': 'Juniper',
  'npc.mira.0': "The soil here loves a good watering. Crops drink it up!",
  'npc.mira.1': "I sell nothing, but I sure do love looking at your farm.",
  'npc.mira.2': "Rain is a farmer's free helper. Watch the sky!",
  'npc.mira.3': "Pumpkins take forever, but oh, the price they fetch.",
  'npc.bram.0': "Rocks out here hide amethysts. Bring a pickaxe!",
  'npc.bram.1': "I nap by the pond. The lily pads make a fine pillow.",
  'npc.bram.2': "Chop a tree, leave the stump. It grows back, promise.",
  'npc.bram.3': "Watch out for the deep water past the sand, eh?",
  'npc.juniper.0': "Welcome in! Seeds are on the shelf, eggs in your pocket.",
  'npc.juniper.1': "Buy low, grow high. That is the whole secret.",
  'npc.juniper.2': "Your chickens lay whether you watch or not. Handy!",
  // mail tips (subject + 3 body lines joined by |)
  'mail.tip0.from': 'MIRA', 'mail.tip0.sub': 'WATERING WISDOM',
  'mail.tip0.body': "Dear farmer, crops drink best when|the soil stays wet overnight.|Rain counts too - watch the sky!",
  'mail.tip1.from': 'BRAM', 'mail.tip1.sub': 'ROCKS AND TREASURE',
  'mail.tip1.body': "Amethysts hide in the pale rocks|out past the sand by the pond.|Bring a pickaxe and a full energy bar.",
  'mail.tip2.from': 'JUNIPER', 'mail.tip2.sub': 'MARKET DAY',
  'mail.tip2.body': "The store pays full price for anything|you grow or mine.|Seeds are restocked every single day.",
  'mail.tip3.from': 'SUNVALE POST', 'mail.tip3.sub': 'VILLAGE FLYER',
  'mail.tip3.body': "CHICKENS LAY EGGS OVERNIGHT.|PET YOUR BIRDS DAILY FOR FRIENDSHIP.|THE COOP HOLDS UP TO SIX HENS.",
  'mail.tip4.from': 'MIRA', 'mail.tip4.sub': 'PUMPKIN SEASON',
  'mail.tip4.body': "Pumpkins take nine whole days but|fetch a giant price.|Plant them early and forget them.",
  'mail.tip5.from': 'BRAM', 'mail.tip5.sub': 'STUMP WATCH',
  'mail.tip5.body': "Chopped trees leave stumps behind.|They sprout again in a few days,|so the forest always comes back.",
  'mail.tip6.from': 'JUNIPER', 'mail.tip6.sub': 'A FULL STOMACH',
  'mail.tip6.body': "Eating a crop restores energy.|Keep a berry or two in your pocket|so you never pass out at dusk.",
  'mail.tip7.from': 'SUNVALE POST', 'mail.tip7.sub': 'WEATHER ALMANAC',
  'mail.tip7.body': "Storms soak every tilled plot at once.|Sunny days dry the soil right out.|Plan your watering around the forecast.",
  'mail.tip8.from': 'BRAM', 'mail.tip8.sub': 'SEND A GIFT',
  'mail.tip8.body': "Hold an item and press G near a|villager to gift it. Crops win hearts.|Loved gifts win the most!",
  'mail.tip9.from': 'MIRA', 'mail.tip9.sub': 'ABOUT THE MAILBOX',
  'mail.tip9.body': "Your requests from the village arrive|here each morning. Deliver what they|ask for and the gold is yours.",
  // requests
  'mail.req0.from': 'MIRA', 'mail.req0.sub': 'A SMALL FAVOR',
  'mail.req0.body': "Could you spare three turnips?|I am making a stew for Bram.|I will pay you well for them.",
  'mail.req1.from': 'BRAM', 'mail.req1.sub': 'FENCE REPAIR',
  'mail.req1.body': "My fence down by the pond is|falling apart again. Send me eight|lengths of wood and I will fix it.",
  'mail.req2.from': 'JUNIPER', 'mail.req2.sub': 'BAKING ORDER',
  'mail.req2.body': "Four fresh eggs, if you have them.|The morning rush needs baking|and the gold is ready and waiting.",
  'mail.req3.from': 'MIRA', 'mail.req3.sub': 'JAM TIME',
  'mail.req3.body': "Five wild berries would be lovely.|I am putting up jam for the winter|and I will trade gold for them.",
  'mail.req4.from': 'BRAM', 'mail.req4.sub': 'PATH WORK',
  'mail.req4.body': "The village path needs mending.|Send eight stone my way and consider|the whole town grateful.",
  'mail.req5.from': 'JUNIPER', 'mail.req5.sub': 'SOUP SPECIAL',
  'mail.req5.body': "The store is running a carrot soup|special this week. Four carrots from|you and the profit is yours.",
  'mail.req6.from': 'MIRA', 'mail.req6.sub': 'PICNIC SUPPLY',
  'mail.req6.body': "Three ripe strawberries, please.|We are having a picnic by the pond|and I will pay top gold for them.",
  'mail.req7.from': 'BRAM', 'mail.tip7.sub': 'WEATHER ALMANAC',
  'mail.req7.from2': 'BRAM', 'mail.req7.sub': 'JEWEL TRADE',
  'mail.req7.body': "One amethyst and I can trade up|with the travelling merchant.|Send it my way, friend!",
  // milestones
  'mail.ms0.sub': 'A LITTLE SOMETHING',
  'mail.ms0.body': "You have been kind to me lately,|so I saved you some seeds.|Plant them and think of me!",
  'mail.ms1.sub': 'THANK YOU GIFT',
  'mail.ms1.body': "A proper thank you from the village.|These carrots grow sweet and quick.|Do not sell them all at once.",
  'mail.ms2.sub': 'FOR A GOOD FRIEND',
  'mail.ms2.body': "We do not say it enough out here:|you are a good friend to Sunvale.|Please take these seeds.",
  'mail.ms3.sub': 'FROM THE HEART',
  'mail.ms3.body': "You are practically family now.|The whole village talks about your|farm. These are the best I have.",
  'gift.0': 'THANK YOU! THIS IS JUST WHAT I WANTED.',
  'gift.1': 'HOW THOUGHTFUL OF YOU!',
  'gift.2': 'YOU HAVE A KIND HEART, FARMER.',
  'gift.3': 'I WILL TREASURE THIS. THANK YOU!',
  'mail.welcome.sub': 'WELCOME TO SUNVALE',
  'mail.welcome.body': "Welcome to your new farm, farmer!|The mailbox by the path collects your|village mail every morning. A little|gift is enclosed to get you started.",
  'mail.week.sub': 'YOUR FIRST WEEK',
  'mail.week.body': "The village has word of your arrival.|Deliver the requests that arrive here|for gold and goodwill. Talk to the|neighbors - they remember kindness.",
  // toasts / floats / misc gameplay
  'msg.welcome_farm': 'WELCOME TO SUNVALE FARM',
  'msg.press_h': 'PRESS H FOR CONTROLS',
  'msg.welcome_back': 'WELCOME BACK TO SUNVALE',
  'msg.new_mail': 'NEW MAIL HAS ARRIVED',
  'msg.save_failed': 'SAVE FAILED',
  'msg.inv_full': 'INVENTORY FULL',
  'msg.rain_waters': 'RAIN WATERS YOUR CROPS',
  'msg.passed_out': 'YOU PASSED OUT FROM EXHAUSTION',
  'msg.eggs_spoiled': 'EGGS SPOILED - INVENTORY FULL',
  'msg.laid': 'YOUR CHICKENS LAID {x} EGG{s}',
  'msg.not_enough_gold': 'NOT ENOUGH GOLD',
  'msg.coop_full': 'COOP IS FULL',
  'msg.chicken_joins': 'A CHICKEN JOINS YOUR COOP!',
  'msg.sold_all': 'SOLD EVERYTHING FOR {x}G',
  'msg.game_saved': 'GAME SAVED',
  'msg.too_tired': 'TOO TIRED...',
  'msg.not_here': 'NOT HERE',
  'msg.dry_ground': 'DRY GROUND',
  'msg.till_first': 'TILL FIRST',
  'msg.need': 'NEED {x} {y}',
  'msg.delivered': 'DELIVERED! +{x}G',
  'msg.cluck': 'CLUCK',
  'msg.cluck_bang': 'CLUCK!',
  'msg.no_one': 'NO ONE NEARBY',
  'msg.hold_gift': 'HOLD A GIFT FIRST',
  'msg.not_gift': 'NOT A GIFT',
  'msg.sound_muted': 'SOUND MUTED',
  'msg.sound_on': 'SOUND ON',
  'msg.talked': '+2 FRIENDSHIP',
  'msg.closer': '{x} IS A CLOSER FRIEND',
  'msg.day_weather': 'DAY {x} - {y}',
  'tv.0': 'WEATHER REPORT FOR TOMORROW...',
  'tv.1': 'EXPECT {x}. PLAN ACCORDINGLY!',
  'tv.2': 'AND NOW, BACK TO OUR PROGRAMMING.',
  'sign.farm': 'WELCOME TO SUNVALE FARM',
  'sign.shop': 'GENERAL STORE - SEEDS AND SUPPLIES',
  'map.farm': 'Sunvale Farm',
  'map.house': 'Your House',
  'map.shop': 'General Store',
  'gift.line': 'What a lovely gift! Thank you, farmer.',
  'journal': 'JOURNAL',
  'objective.talk': 'TALK TO {x}',
  'objective.collect': 'HOLD {x} {y}',
  'objective.deliver': 'DELIVER {x} {y} TO {z}',
  'objective.cook': 'COOK {x} DISHES AT HOME',
  'objective.sold': 'SELL {x}G WORTH OF GOODS',
  'story.arrival.title': 'A NEW BEGINNING',
  'story.arrival.desc': 'MEET MAYOR PEONY IN THE TOWN HALL',
  'story.harvest.title': 'THE FIRST HARVEST',
  'story.harvest.desc': 'BRING 5 TURNIPS TO YOUR CHEST OR POCKETS',
  'story.timber.title': 'TIMBER FOR THE BRIDGE',
  'story.timber.desc': 'COLLECT 20 WOOD FOR BRAM',
  'story.gems.title': 'A SPARK IN THE STONE',
  'story.gems.desc': 'DELIVER 3 AMETHYSTS TO SABLE BY THE POND',
  'story.feast.title': 'A TABLE FOR SUNVALE',
  'story.feast.desc': 'COOK 3 DISHES ON YOUR STOVE AT HOME',
  'story.market.title': 'A FAIR EXCHANGE',
  'story.market.desc': 'SELL GOODS WORTH 3000G AT THE STORE',
  'story.festival.title': 'THE SUNVALE FESTIVAL',
  'story.festival.desc': 'GROW 1 PUMPKIN AND 5 CORN FOR THE FESTIVAL',
  'npc.pip': 'Pip',
  'npc.wren': 'Wren',
  'npc.sable': 'Sable',
  'npc.peony': 'Mayor Peony',
  'npc.odin': 'Odin',
  'npc.pip.0': 'I alphabetise the seed shelf every single morning!',
  'npc.pip.1': 'Ask Juniper about the upgrades tab. Go on, ask!',
  'npc.pip.2': 'I say she counts too much. She says I talk too much.',
  'npc.pip.3': 'The big backpack fits forty more turnips. Probably.',
  'npc.wren.0': 'The woods are singing today. Can you hear it?',
  'npc.wren.1': 'Wild berries grow on the bushes at the forest edge.',
  'npc.wren.2': 'I track deer prints up north. You should come along.',
  'npc.wren.3': 'A farmer and a ranger make fine neighbours.',
  'npc.sable.0': 'The pond keeps secrets. So do I.',
  'npc.sable.1': 'Amethysts only grow where the water once ran.',
  'npc.sable.2': 'I fish at dusk. The light goes soft, then gold.',
  'npc.sable.3': 'You have the look of someone building something.',
  'npc.peony.0': 'Sunvale runs on kindness and a good harvest.',
  'npc.peony.1': 'The board by the door lists what the valley needs.',
  'npc.peony.2': 'Every farm here started with one turnip and a dream.',
  'npc.peony.3': 'The festival is coming. We shall need your finest crops.',
  'npc.odin.0': 'Sit, sit! The stew is on and the fire is lit.',
  'npc.odin.1': 'The stove in your house knows my recipes. Try them.',
  'npc.odin.2': 'Every good farm ends up on a plate in here.',
  'npc.odin.3': 'The rafters hold a hundred years of laughter.',
  'map.hall': 'Town Hall',
  'map.tavern': 'Tavern',
  'tile.0': 'grass', 'tile.1': 'grass', 'tile.2': 'flowers', 'tile.3': 'path',
  'tile.4': 'water', 'tile.5': 'soil', 'tile.6': 'wet soil', 'tile.7': 'floor',
  'tile.8': 'wall', 'tile.9': 'rug', 'tile.10': 'stone', 'tile.11': 'deck',
  'tile.12': 'bridge', 'tile.13': 'sand', 'tile.14': 'fence', 'tile.15': 'hardwood'
});

// ---- lookup + interpolation ---------------------------------------

const I18n = {
  lang: 'en',
  detect: function () {
    let saved = null;
    try { saved = localStorage.getItem(LANG_FILE); } catch (e) {}
    if (saved && I18N[saved]) return saved;
    let nav = '';
    try { nav = (navigator.language || navigator.userLanguage || 'en'); } catch (e) { nav = 'en'; }
    return this.normalize(nav);
  },
  normalize: function (code) {
    if (!code) return 'en';
    code = String(code).replace('_', '-');
    if (I18N[code]) return code;
    const base = code.split('-')[0].toLowerCase();
    // map base to supported (zh special)
    if (base === 'zh') {
      const low = code.toLowerCase();
      if (low.indexOf('tw') >= 0 || low.indexOf('hant') >= 0 || low.indexOf('hk') >= 0) return I18N['zh-TW'] ? 'zh-TW' : 'en';
      return I18N['zh-CN'] ? 'zh-CN' : 'en';
    }
    if (base === 'pt') return I18N['pt'] ? 'pt' : 'en';
    if (base === 'nb' || base === 'nn') return I18N['no'] ? 'no' : 'en';
    if (I18N[base]) return base;
    // try prefix match
    for (const k in I18N) { if (k.toLowerCase().indexOf(base) === 0) return k; }
    return 'en';
  },
  setLang: function (code, silent) {
    code = this.normalize(code);
    this.lang = code;
    try { localStorage.setItem(LANG_FILE, code); } catch (e) {}
    try { document.documentElement.lang = code; } catch (e) {}
    if (typeof applyDataTranslations === 'function') applyDataTranslations();
    return code;
  },
  t: function (key, vars) {
    const d = I18N[this.lang] || {};
    const e = I18N['en'] || {};
    let s = d[key] !== undefined ? d[key] : e[key];
    if (s === undefined) return key;
    if (vars) {
      for (const k in vars) s = String(s).split('{' + k + '}').join(vars[k]);
      // plural helper {s}: empty if x==1 else S
      if (s.indexOf('{s}') >= 0) {
        const n = vars.x !== undefined ? vars.x : vars.n;
        s = s.split('{s}').join(Number(n) === 1 ? '' : 'S');
      }
    } else if (s.indexOf('{s}') >= 0) s = s.split('{s}').join('S');
    return s;
  }
};

function L(key, vars) { return I18n.t(key, vars); }

// ---- rewrite static content tables in place ----------------------

function applyDataTranslations() {
  try {
    for (const id in CROPS) { const k = I18n.t('crop.' + id, null); if (k && k !== 'crop.' + id) CROPS[id].name = k; }
    for (const id in ITEMS) {
      const n = I18n.t('item.' + id + '.name', null), d = I18n.t('item.' + id + '.desc', null);
      if (n && n.indexOf('item.') !== 0) ITEMS[id].n = n;
      if (d && d.indexOf('item.') !== 0) ITEMS[id].d = d;
    }
    if (typeof RECIPES !== 'undefined') {
      const keys = ['veg_stew', 'omelette', 'berry_pie', 'pumpkin_soup'];
      RECIPES.forEach(function (r, i) { const v = I18n.t('recipe.' + keys[i], null); if (v && v.indexOf('recipe.') !== 0) r.d = v; });
    }
    if (typeof UPGRADES !== 'undefined') {
      const ids = ['bag', 'chest', 'tools'];
      UPGRADES.forEach(function (u, i) {
        const n = I18n.t('upgrade.' + ids[i], null), d = I18n.t('upgrade.' + ids[i] + '.d', null);
        if (n && n.indexOf('upgrade.') !== 0) u.n = n;
        if (d && d.indexOf('upgrade.') !== 0) u.d = d;
      });
    }
    if (typeof NPC_DEFS !== 'undefined') {
      NPC_DEFS.forEach(function (n) {
        const nm = I18n.t('npc.' + n.id, null);
        if (nm && nm.indexOf('npc.') !== 0) n.name = nm;
        for (let i = 0; i < n.lines.length; i++) {
          const v = I18n.t('npc.' + n.id + '.' + i, null);
          if (v && v.indexOf('npc.') !== 0) n.lines[i] = v;
        }
      });
    }
    if (typeof STORY !== 'undefined') {
      STORY.forEach(function (ch) {
        const ti = I18n.t('story.' + ch.id + '.title', null);
        const de = I18n.t('story.' + ch.id + '.desc', null);
        if (ti && ti.indexOf('story.') !== 0) ch.title = ti;
        if (de && de.indexOf('story.') !== 0) ch.desc = de;
      });
    }
    if (typeof MAIL_TIPS !== 'undefined') {
      MAIL_TIPS.forEach(function (m, i) {
        const f = I18n.t('mail.tip' + i + '.from', null), s = I18n.t('mail.tip' + i + '.sub', null), b = I18n.t('mail.tip' + i + '.body', null);
        if (f && f.indexOf('mail.') !== 0) m.from = f;
        if (s && s.indexOf('mail.') !== 0) m.subject = s;
        if (b && b.indexOf('mail.') !== 0) m.body = String(b).split('|');
      });
    }
    if (typeof MAIL_REQUESTS !== 'undefined') {
      MAIL_REQUESTS.forEach(function (m, i) {
        const f = I18n.t('mail.req' + i + '.from', null), s = I18n.t('mail.req' + i + '.sub', null), b = I18n.t('mail.req' + i + '.body', null);
        if (f && f.indexOf('mail.') !== 0) m.from = f;
        if (s && s.indexOf('mail.') !== 0) m.subject = s;
        if (b && b.indexOf('mail.') !== 0) m.body = String(b).split('|');
      });
    }
    if (typeof FRIEND_MILESTONES !== 'undefined') {
      FRIEND_MILESTONES.forEach(function (m, i) {
        const s = I18n.t('mail.ms' + i + '.sub', null), b = I18n.t('mail.ms' + i + '.body', null);
        if (s && s.indexOf('mail.') !== 0) m.subject = s;
        if (b && b.indexOf('mail.') !== 0) m.body = String(b).split('|');
      });
    }
    if (typeof GIFT_THANKS !== 'undefined') {
      for (let i = 0; i < GIFT_THANKS.length; i++) {
        const v = I18n.t('gift.' + i, null);
        if (v && v.indexOf('gift.') !== 0) GIFT_THANKS[i] = v;
      }
    }
    if (typeof HELP_LINES !== 'undefined') {
      for (let i = 0; i < HELP_LINES.length; i++) {
        const v = I18n.t('help.' + i, null);
        if (v && v.indexOf('help.') !== 0) HELP_LINES[i] = v;
      }
    }
    if (typeof TILE_NAMES !== 'undefined') {
      for (let i = 0; i < TILE_NAMES.length; i++) {
        const v = I18n.t('tile.' + i, null);
        if (v && v.indexOf('tile.') !== 0) TILE_NAMES[i] = v;
      }
    }
  } catch (e) {}
}

// --- PixelFont unicode fallback (CJK / Arabic / accents / Cyrillic / etc) ---
(function installFontFallback() {
  function ready() {
    try {
      if (typeof PixelFont === 'undefined' || !PixelFont.draw || PixelFont._i18nPatched) return;
      PixelFont._i18nPatched = true;
      const origDraw = PixelFont.draw.bind(PixelFont);
      const origMeasure = PixelFont.measure.bind(PixelFont);
      PixelFont.measure = function (str, scale) {
        scale = scale || 1;
        str = String(str).toUpperCase();
        let w = 0;
        for (let i = 0; i < str.length; i++) {
          w += (typeof FONT !== 'undefined' && FONT[str[i]]) ? 6 * scale : 7 * scale;
        }
        return w > 0 ? w - scale : 0;
      };
      PixelFont.draw = function (ctx, str, x, y, color, scale, align) {
        scale = scale || 1;
        str = String(str).toUpperCase();
        if (align === 'center') x -= Math.floor(PixelFont.measure(str, scale) / 2);
        if (align === 'right') x -= PixelFont.measure(str, scale);
        x = Math.round(x); y = Math.round(y);
        let cx = x;
        const prevFont = ctx.font, prevBase = ctx.textBaseline;
        let nativeActive = false;
        for (let i = 0; i < str.length; i++) {
          const ch = str[i];
          if (ch === ' ') { cx += 6 * scale; continue; }
          if (typeof FONT !== 'undefined' && FONT[ch]) {
            if (nativeActive) { ctx.font = prevFont; ctx.textBaseline = prevBase; nativeActive = false; }
            ctx.drawImage(PixelFont.glyph(ch, color), cx, y, 5 * scale, 7 * scale);
            cx += 6 * scale;
          } else {
            if (!nativeActive) {
              ctx.font = 'bold ' + (7 * scale) + 'px "Courier New", monospace, sans-serif';
              ctx.textBaseline = 'top';
              nativeActive = true;
            }
            ctx.fillStyle = color;
            ctx.fillText(ch, cx, y - 1);
            cx += 7 * scale;
          }
        }
        if (nativeActive) { ctx.font = prevFont; ctx.textBaseline = prevBase; }
        return cx;
      };
      const origShadow = PixelFont.shadow.bind(PixelFont);
      PixelFont.shadow = function (ctx, str, x, y, color, scale, align) {
        scale = scale || 1;
        PixelFont.draw(ctx, str, x + scale, y + scale, '#14100c', scale, align);
        PixelFont.draw(ctx, str, x, y, color, scale, align);
      };
    } catch (e) {}
  }
  if (document.readyState === 'complete') ready();
  window.addEventListener('load', ready);
  setTimeout(ready, 0);
  setTimeout(ready, 500);
})();
