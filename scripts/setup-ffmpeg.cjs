'use strict';
/**
 * Prebuild script — runs before `next build` (via npm lifecycle "prebuild").
 *
 * Creates a smart index.js inside @ffmpeg-installer/linux-x64 so that the
 * package can be required and returns the correct binary path regardless of
 * whether webpack bundles the module (wrong __dirname = chunk dir) or keeps
 * it external (correct __dirname = node_modules dir).
 *
 * The index.js tries __dirname first; if that path doesn't exist at runtime
 * (because webpack bundled the file into .next/server/chunks/ and replaced
 * __dirname with the chunk directory), it falls back to
 * process.cwd() + known relative path, which is /var/task/node_modules/...
 * on Vercel.
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

// Create a smart index.js that handles two cases:
//
//   Case A — module is EXTERNAL (serverExternalPackages works correctly):
//     Node.js loads the real file from node_modules; __dirname is the real
//     package directory → __dirname/ffmpeg is correct.
//
//   Case B — module is BUNDLED by webpack (serverExternalPackages ignored):
//     __dirname is webpack's chunk output directory (.next/server/chunks/);
//     __dirname/ffmpeg does not exist → fall back to process.cwd() path.
//     On Vercel, process.cwd() = /var/task and the binary is deployed to
//     /var/task/node_modules/@ffmpeg-installer/linux-x64/ffmpeg via
//     outputFileTracingIncludes in next.config.js.
const indexJs = path.join(pkgDir, 'index.js');
fs.writeFileSync(indexJs, `'use strict';
const path = require('path');
const fs   = require('fs');

// Case A: module external — __dirname is the real node_modules package dir.
const viaDir = path.join(__dirname, 'ffmpeg');

// Case B: module bundled — __dirname is webpack chunk dir, fall back to cwd.
const viaCwd = path.join(
  process.cwd(),
  'node_modules', '@ffmpeg-installer', 'linux-x64', 'ffmpeg'
);

const ffmpegPath = fs.existsSync(viaDir) ? viaDir : viaCwd;

module.exports = { path: ffmpegPath };
`);

console.log('[setup-ffmpeg] index.js written to', indexJs);
console.log('[setup-ffmpeg] ffmpeg binary:', binPath);
