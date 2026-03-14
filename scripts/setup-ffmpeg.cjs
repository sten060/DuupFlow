'use strict';
/**
 * Prebuild script — runs before `next build` (via npm lifecycle "prebuild").
 *
 * Problem: @ffmpeg-installer/linux-x64 has no index.js and no "main" field,
 * so Vercel's NFT file tracer cannot auto-include the ffmpeg binary when it
 * follows require('@ffmpeg-installer/linux-x64').
 *
 * Solution: create a minimal index.js inside the package that uses
 *   path.join(__dirname, 'ffmpeg')
 * This is a pattern that @vercel/nft recognises and statically traces,
 * so the binary ends up in the deployed serverless function bundle.
 */

const fs   = require('fs');
const path = require('path');

const pkgDir = path.join(__dirname, '..', 'node_modules', '@ffmpeg-installer', 'linux-x64');

if (!fs.existsSync(pkgDir)) {
  console.warn('[setup-ffmpeg] @ffmpeg-installer/linux-x64 not found in node_modules, skipping');
  process.exit(0);
}

const binPath = path.join(pkgDir, 'ffmpeg');
if (!fs.existsSync(binPath)) {
  console.warn('[setup-ffmpeg] ffmpeg binary not found at', binPath, '— skipping');
  process.exit(0);
}

// Ensure the binary is executable.
try { fs.chmodSync(binPath, 0o755); } catch { /* ignore on Windows */ }

// Create index.js with a path.join(__dirname, 'ffmpeg') expression.
// @vercel/nft statically evaluates path.join(__dirname, '<literal>') and
// automatically adds the referenced file to the function bundle.
const indexJs = path.join(pkgDir, 'index.js');
fs.writeFileSync(indexJs, `'use strict';
const path = require('path');
// path.join(__dirname, 'ffmpeg') is statically traceable by @vercel/nft.
// This causes the ffmpeg binary to be deployed with every serverless function
// that requires this package.
module.exports = { path: path.join(__dirname, 'ffmpeg') };
`);

console.log('[setup-ffmpeg] index.js written to', indexJs);
console.log('[setup-ffmpeg] ffmpeg binary:', binPath);
