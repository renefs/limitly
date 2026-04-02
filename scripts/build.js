const { execSync } = require('node:child_process');
const { readFileSync, unlinkSync, statSync } = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const EXT_DIR = path.join(ROOT, 'extension');
const OUTPUT = path.join(ROOT, 'limitly.zip');

const manifest = JSON.parse(
  readFileSync(path.join(EXT_DIR, 'manifest.json'), 'utf8')
);

// Remove old zip if present
try {
  unlinkSync(OUTPUT);
} catch {}

if (process.platform === 'win32') {
  execSync(
    `powershell -Command "Compress-Archive -Path '${EXT_DIR}\\*' -DestinationPath '${OUTPUT}'"`,
    { stdio: 'inherit' }
  );
} else {
  execSync(`cd "${EXT_DIR}" && zip -r "${OUTPUT}" . -x "*.DS_Store"`, {
    stdio: 'inherit',
  });
}

const size = statSync(OUTPUT).size;
console.log(
  `\nBuilt: limitly.zip (v${manifest.version}, ${(size / 1024).toFixed(1)} KB)`
);
