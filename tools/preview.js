/* PREVIEW — dev-only art validator, not loaded by the game.
   Run: node tools/preview.js
   Prints every player sprite grid and flags rows that are not 16 wide
   (a wrong-width row shears the sprite). Use it after editing art-data.js. */
const ART = require('../js/art-data.js');
let bad = 0;
function show(name, rows) {
  const w = Math.max(...rows.map(r => r.length));
  console.log('--- ' + name + ' (w=' + w + ', h=' + rows.length + ') ---');
  rows.forEach((r, i) => {
    if (r.length !== 16) { bad++; console.log('  !! row ' + i + ' len=' + r.length + ' -> ' + r); }
    console.log('  ' + r.padEnd(16, '?'));
  });
}
for (const dir of ['down', 'up', 'side']) {
  ART.player[dir].forEach((f, i) => show(dir + i, f));
}
console.log(bad ? ('BAD ROWS: ' + bad) : 'all rows 16 wide');
