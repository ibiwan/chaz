// Copy server.mjs to dist/server.mjs after backend build
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, 'src', 'server.mjs');
const dest = path.join(__dirname, 'dist', 'server.mjs');

fs.copyFileSync(src, dest);
console.log('Copied src/server.mjs to dist/server.mjs');
