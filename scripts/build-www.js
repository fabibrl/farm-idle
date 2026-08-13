/**
 * Copies the game's static files (index.html, css/, js/) into www/,
 * which Capacitor bundles into the native app as web assets.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'www');

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

fs.copyFileSync(path.join(root, 'index.html'), path.join(out, 'index.html'));
for (const dir of ['css', 'js']) {
  fs.cpSync(path.join(root, dir), path.join(out, dir), { recursive: true });
}
console.log('www/ built');
