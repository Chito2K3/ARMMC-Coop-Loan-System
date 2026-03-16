const { execSync } = require('child_process');
const fs = require('fs');
try {
  const output = execSync('npx tsc --noEmit', { encoding: 'utf8', cwd: process.cwd() });
  fs.writeFileSync('tsc_ext.txt', output);
} catch (e) {
  fs.writeFileSync('tsc_ext.txt', e.stdout + '\n' + e.stderr);
}
