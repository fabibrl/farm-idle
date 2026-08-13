/**
 * Builds farm-evolution.html — the whole game in one self-contained file.
 * Reads index.html and inlines the stylesheet and every script in place,
 * so the load order always matches the normal build.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g,
  (_, href) => `<style>\n${read(href)}</style>`);

html = html.replace(/<script src="([^"]+)"><\/script>/g,
  (_, src) => `<script>\n${read(src)}</script>`);

if (/<link rel="stylesheet"|<script src=/.test(html)) {
  throw new Error('build-single: some external references were not inlined');
}

const out = path.join(root, 'farm-evolution.html');
fs.writeFileSync(out, html);
console.log(`farm-evolution.html built (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
