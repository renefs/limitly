const { unlinkSync } = require('node:fs');
const path = require('node:path');

const OUTPUT = path.join(__dirname, '..', 'limitly.zip');

try {
  unlinkSync(OUTPUT);
  console.log('Removed limitly.zip');
} catch (err) {
  if (err.code === 'ENOENT') {
    console.log('Nothing to clean (limitly.zip not found)');
  } else {
    throw err;
  }
}
