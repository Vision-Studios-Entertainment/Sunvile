/* ART — raw pixel-art source data. No logic, no canvas work.
   One string = one row of pixels; each character is a palette key
   (see ART.palettes), '.' = transparent.
   Exposed as `var` so Node can require() it (tools/preview.js).
   Consumed by: sprites.js buildCharacters() -> Sprites.player[<palette>].
   INVARIANT: every row must be exactly `w` chars or the sprite shears —
   `node tools/preview.js` prints row widths for the player grids. */
var ART = {
  player: {
    w: 16,
    h: 20,
    down: [
      [
        '......oooo......',
        '....oohhhhoo....',
        '...ohhhhhhhho...',
        '..ohhhhhhhhhho..',
        '..ohhhhhhhhhho..',
        '..ohssssssssho..',
        '..ohswsssswsho..',
        '..ohsssoosssho..',
        '..ohssssssssho..',
        '...osssssssso...',
        '....osssssso....',
        '...obbbbbbbbo...',
        '..obbbbbbbbbbo..',
        '..obbbbbbbbbbo..',
        '..oBBByyyyBBBo..',
        '..osbbbbbbbso...',
        '....pppppppp....',
        '....ppp..ppp....',
        '....kkk..kkk....',
        '...kkkk..kkkk...'
      ],
      [
        '......oooo......',
        '....oohhhhoo....',
        '...ohhhhhhhho...',
        '..ohhhhhhhhhho..',
        '..ohhhhhhhhhho..',
        '..ohssssssssho..',
        '..ohswsssswsho..',
        '..ohsssoosssho..',
        '..ohssssssssho..',
        '...osssssssso...',
        '....osssssso....',
        '...obbbbbbbbo...',
        '..obbbbbbbbbbo..',
        '..obbbbbbbbbbo..',
        '..oBBByyyyBBBo..',
        '..osbbbbbbbso...',
        '....pppppppp....',
        '....ppp..ppp....',
        '....kkk..kkk....',
        '....kkk.........'
      ],
      [
        '......oooo......',
        '....oohhhhoo....',
        '...ohhhhhhhho...',
        '..ohhhhhhhhhho..',
        '..ohhhhhhhhhho..',
        '..ohssssssssho..',
        '..ohswsssswsho..',
        '..ohsssoosssho..',
        '..ohssssssssho..',
        '...osssssssso...',
        '....osssssso....',
        '...obbbbbbbbo...',
        '..obbbbbbbbbbo..',
        '..obbbbbbbbbbo..',
        '..oBBByyyyBBBo..',
        '..osbbbbbbbso...',
        '....pppppppp....',
        '....ppp..ppp....',
        '....kkk..kkk....',
        '.........kkk....'
      ]
    ],
    up: [
      [
        '......oooo......',
        '....oohhhhoo....',
        '...ohhhhhhhho...',
        '..ohhhhhhhhhho..',
        '..ohhhhhhhhhho..',
        '..ohhhhhhhhhho..',
        '..ohhhhhhhhhho..',
        '..ohHHhhhhHHho..',
        '..ohhhhhhhhhho..',
        '...oHHhhhhHHo...',
        '....osssssso....',
        '...obbbbbbbbo...',
        '..obbbbbbbbbbo..',
        '..obbbbbbbbbbo..',
        '..oBBByyyyBBBo..',
        '..osbbbbbbbso...',
        '....pppppppp....',
        '....ppp..ppp....',
        '....kkk..kkk....',
        '...kkkk..kkkk...'
      ],
      [
        '......oooo......',
        '....oohhhhoo....',
        '...ohhhhhhhho...',
        '..ohhhhhhhhhho..',
        '..ohhhhhhhhhho..',
        '..ohhhhhhhhhho..',
        '..ohhhhhhhhhho..',
        '..ohHHhhhhHHho..',
        '..ohhhhhhhhhho..',
        '...oHHhhhhHHo...',
        '....osssssso....',
        '...obbbbbbbbo...',
        '..obbbbbbbbbbo..',
        '..obbbbbbbbbbo..',
        '..oBBByyyyBBBo..',
        '..osbbbbbbbso...',
        '....pppppppp....',
        '....ppp..ppp....',
        '....kkk..kkk....',
        '....kkk.........'
      ],
      [
        '......oooo......',
        '....oohhhhoo....',
        '...ohhhhhhhho...',
        '..ohhhhhhhhhho..',
        '..ohhhhhhhhhho..',
        '..ohhhhhhhhhho..',
        '..ohhhhhhhhhho..',
        '..ohHHhhhhHHho..',
        '..ohhhhhhhhhho..',
        '...oHHhhhhHHo...',
        '....osssssso....',
        '...obbbbbbbbo...',
        '..obbbbbbbbbbo..',
        '..obbbbbbbbbbo..',
        '..oBBByyyyBBBo..',
        '..osbbbbbbbso...',
        '....pppppppp....',
        '....ppp..ppp....',
        '....kkk..kkk....',
        '.........kkk....'
      ]
    ],
    side: [
      [
        '.....oooo.......',
        '...oohhhhoo.....',
        '..ohhhhhhhho....',
        '.ohhhhhhhhhho...',
        '.ohhhhhhhhhho...',
        '.ohhsssssshhhho.',
        '.ohhswsssshhhho.',
        '.ohhsoossshhhho.',
        '.ohhssssssHHHHo.',
        '..ohhssssshhhho.',
        '...osssss.......',
        '...obbbbbbo.....',
        '..obbbbbbbbo....',
        '..obbbbbbbbo....',
        '..oBBByyyBBo....',
        '..osbbbbbbso....',
        '....pppppp......',
        '....pppppp......',
        '....kkkkkk......',
        '...kkkkkk.......'
      ],
      [
        '.....oooo.......',
        '...oohhhhoo.....',
        '..ohhhhhhhho....',
        '.ohhhhhhhhhho...',
        '.ohhhhhhhhhho...',
        '.ohhsssssshhhho.',
        '.ohhswsssshhhho.',
        '.ohhsoossshhhho.',
        '.ohhssssssHHHHo.',
        '..ohhssssshhhho.',
        '...osssss.......',
        '...obbbbbbo.....',
        '..obbbbbbbbo....',
        '..obbbbbbbbo....',
        '..oBBByyyBBo....',
        '..osbbbbbbso....',
        '....pppppp......',
        '..ppppp..ppp....',
        '..kkkkk..kkk....',
        '.kkkkkk..kkkk...'
      ],
      [
        '.....oooo.......',
        '...oohhhhoo.....',
        '..ohhhhhhhho....',
        '.ohhhhhhhhhho...',
        '.ohhhhhhhhhho...',
        '.ohhsssssshhhho.',
        '.ohhswsssshhhho.',
        '.ohhsoossshhhho.',
        '.ohhssssssHHHHo.',
        '..ohhssssshhhho.',
        '...osssss.......',
        '...obbbbbbo.....',
        '..obbbbbbbbo....',
        '..obbbbbbbbo....',
        '..oBBByyyBBo....',
        '..osbbbbbbso....',
        '....pppppp......',
        '....pppppp......',
        '....kkkkkk......',
        '.........kkk....'
      ]
    ]
  },
  palettes: {
    player: {
      o: '#241611', h: '#7a4a21', H: '#5e3817', s: '#f2c49b', S: '#d9a877',
      b: '#4a7ec2', B: '#35598f', p: '#46528c', k: '#5a3a22', y: '#e8c452', w: '#241611'
    },
    mira: {
      o: '#241611', h: '#e0b13e', H: '#b8871f', s: '#f6d3b0', S: '#dcae87',
      b: '#d46a8c', B: '#a8486a', p: '#6f5a9e', k: '#4a3a2a', y: '#f0e0a0', w: '#241611'
    },
    bram: {
      o: '#241611', h: '#3f3f46', H: '#2a2a30', s: '#c98f5f', S: '#a8734a',
      b: '#6a8f4f', B: '#4c6b38', p: '#5c4a3a', k: '#3a2e22', y: '#c9a24a', w: '#241611'
    },
    juniper: {
      o: '#241611', h: '#8e3b5c', H: '#6d2845', s: '#e8b48a', S: '#c9946a',
      b: '#3fa7a0', B: '#2b7c77', p: '#4a5568', k: '#3a3a44', y: '#e8c452', w: '#241611'
    },
    peony: {
      o: '#2a1a24', h: '#b9a0d8', H: '#8f76b5', s: '#f4d2b4', S: '#dcb191',
      b: '#4f8f6a', B: '#3a6d50', p: '#6b4a7a', k: '#3a2a3a', y: '#f0d24a', w: '#2a1a24'
    },
    odin: {
      o: '#241611', h: '#b5502a', H: '#8a3a1e', s: '#e8b48a', S: '#c9946a',
      b: '#7a4a2a', B: '#5f3820', p: '#3f4a5a', k: '#2b2b34', y: '#e8c452', w: '#241611'
    },
    wren: {
      o: '#1e2a1a', h: '#a85a2a', H: '#7f421e', s: '#f0c49b', S: '#d4a37c',
      b: '#4f7a3f', B: '#3a5c2e', p: '#5a4a34', k: '#3a2e22', y: '#c9a24a', w: '#1e2a1a'
    },
    pip: {
      o: '#1a2430', h: '#3fa7c0', H: '#2b7f96', s: '#f6d3b0', S: '#dcae87',
      b: '#e0b23a', B: '#b88d24', p: '#4a5568', k: '#3a3a44', y: '#f7e07a', w: '#1a2430'
    },
    sable: {
      o: '#16161f', h: '#2f3140', H: '#22232e', s: '#d9b48f', S: '#b8946e',
      b: '#3f4a7a', B: '#2d3560', p: '#2b2b34', k: '#1f1f26', y: '#8fd0c0', w: '#16161f'
    }
  }
};

if (typeof module !== 'undefined' && module.exports) module.exports = ART;
